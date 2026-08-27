-- KHEM — sending a campaign, once.
--
-- Applied by `npm run db:migrate` after `0033_campaigns.sql`.
--
-- ── The whole design in one sentence ────────────────────────
--
-- **Claim first, send second, record third** — so that every way this can fail
-- costs somebody a letter they never receive, and no way it can fail sends one
-- twice.
--
-- That trade is deliberate and it is the only one available. A letter cannot be
-- unsent. An address that was claimed but never written to still has no `sentAt`
-- stamp, so it is visible, countable, and can be sent to by a later run; an
-- address written to twice is a mistake the house cannot take back.
--
-- ── Two locks, doing two different jobs ─────────────────────
--
-- `begin_campaign_dispatch()` takes `for update` on the campaign row before it
-- reads the status. That is what stops two dispatches — a cron run and a
-- pressed button, or two cron runs — both seeing SCHEDULED and both claiming the
-- audience. The second waits, sees SENDING, and returns nothing.
--
-- The `campaign_sends` primary key is the second lock, and the one that survives
-- everything: even if a claim somehow ran twice, `on conflict do nothing` means
-- the second inserts no rows and therefore hands out no letters.
--
-- ── Why the audience is claimed in one statement ────────────
--
-- Not chunked. The `insert … select` writes a row for every subscribed address
-- on the campaign's list in one transaction, so the audience is fixed at the
-- moment dispatch begins. Somebody who subscribes while the letters are going
-- out is not half-included, and somebody who unsubscribes mid-flight is not sent
-- to — because the claim is already the definitive list, and `next_campaign_chunk`
-- re-checks their status anyway before their letter is composed.
--
-- ── Resuming ───────────────────────────────────────────────
--
-- A run sends a bounded number of chunks and stops; the campaign stays SENDING
-- with unsent claims behind it, and the next run continues. `finish_campaign()`
-- is what decides it is done, by looking for unsent rows rather than by counting
-- what any one run believed it had sent.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Unchanged. RLS on, no policy, nothing granted to the public roles, `execute`
-- revoked. `next_campaign_chunk()` returns email addresses and unsubscribe
-- tokens — the only function in this schema that returns either — and is
-- reachable solely by code holding SUPABASE_SECRET_KEY.

-- ── begin_campaign_dispatch ─────────────────────────────────
--
-- Claims the audience and moves the campaign to SENDING. Idempotent: a campaign
-- already SENDING returns its outstanding count rather than claiming again.
--
-- Returns `{ ok, reason, claimed, outstanding }`.

create or replace function public.begin_campaign_dispatch(campaign_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign   record;
  v_claimed    int := 0;
  v_outstanding int := 0;
begin
  -- The lock, before the read. Two dispatches serialise here.
  select * into v_campaign
    from public.campaigns
   where id = campaign_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'No such campaign.');
  end if;

  if v_campaign.status in ('SENT', 'CANCELLED') then
    return jsonb_build_object('ok', false, 'reason', 'That campaign has already finished.');
  end if;

  -- Already under way: hand back what is left rather than claiming twice.
  if v_campaign.status = 'SENDING' then
    select count(*)::int into v_outstanding
      from public.campaign_sends
     where "campaignId" = campaign_id and "sentAt" is null;

    return jsonb_build_object(
      'ok', true, 'claimed', 0, 'outstanding', v_outstanding
    );
  end if;

  /*
   * The claim. One statement, one transaction: the audience is whoever is
   * subscribed to this list at this instant, and it does not move afterwards.
   */
  with claimed as (
    insert into public.campaign_sends ("campaignId", "subscriberId")
    select campaign_id, s.id
      from public."NewsletterSubscriber" s
     where s.status = 'SUBSCRIBED'
       and s.locale = v_campaign.locale
    on conflict ("campaignId", "subscriberId") do nothing
    returning 1
  )
  select count(*)::int into v_claimed from claimed;

  update public.campaigns
     set status          = 'SENDING',
         "audienceCount" = v_claimed,
         "updatedAt"     = now()
   where id = campaign_id;

  return jsonb_build_object(
    'ok', true, 'claimed', v_claimed, 'outstanding', v_claimed
  );
end;
$$;

-- ── next_campaign_chunk ─────────────────────────────────────
--
-- The next batch of letters to compose: claimed, not yet sent, and still
-- subscribed.
--
-- That last condition is not redundant with the claim. Somebody may withdraw
-- between the claim and their letter being composed, and the house must not
-- write to them — a withdrawal that arrived one second before dispatch is still
-- a withdrawal.
--
-- Returns the address and the row's own unsubscribe token, because a campaign
-- letter carries a link built from it. **Nothing else in this schema returns
-- either**, and no caller may log them.

create or replace function public.next_campaign_chunk(
  campaign_id text,
  chunk_size  int default 100
)
returns table (
  "subscriberId" text,
  email          text,
  token          text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.email, s."unsubscribeToken"
    from public.campaign_sends cs
    join public."NewsletterSubscriber" s on s.id = cs."subscriberId"
   where cs."campaignId" = campaign_id
     and cs."sentAt" is null
     and cs.error is null
     and s.status = 'SUBSCRIBED'
   order by cs."claimedAt"
   limit greatest(1, least(coalesce(chunk_size, 100), 100));
$$;

-- ── record_campaign_sends ───────────────────────────────────
--
-- Stamps what the provider accepted, and records what it refused.
--
-- `items` is `[{ subscriberId, error? }, …]`. An entry with no error is a letter
-- that went; an entry with one is a letter that did not, and its reason is kept
-- against that row so the desk can see which addresses failed without the house
-- retrying them forever.

create or replace function public.record_campaign_sends(
  campaign_id text,
  items       jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if jsonb_typeof(items) <> 'array' then
    return 0;
  end if;

  with incoming as (
    select
      item->>'subscriberId' as subscriber_id,
      nullif(item->>'error', '') as err
    from jsonb_array_elements(coalesce(items, '[]'::jsonb)) as item
  ),
  stamped as (
    update public.campaign_sends cs
       set "sentAt" = case when i.err is null then now() else null end,
           error    = left(i.err, 500)
      from incoming i
     where cs."campaignId" = campaign_id
       and cs."subscriberId" = i.subscriber_id
       -- Never re-stamp a letter that already went. The claim is single-use and
       -- so is its record.
       and cs."sentAt" is null
    returning 1
  )
  select count(*)::int into v_updated from stamped;

  return v_updated;
end;
$$;

-- ── finish_campaign ─────────────────────────────────────────
--
-- Marks a campaign SENT once nothing is outstanding.
--
-- "Outstanding" means a claimed row with no stamp and no recorded error — so a
-- campaign whose last few addresses the provider refused still finishes, with
-- those failures visible against their rows, rather than sitting in SENDING for
-- ever waiting for letters that will never go.

create or replace function public.finish_campaign(campaign_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outstanding int;
begin
  select count(*)::int into v_outstanding
    from public.campaign_sends
   where "campaignId" = campaign_id
     and "sentAt" is null
     and error is null;

  if v_outstanding > 0 then
    return false;
  end if;

  update public.campaigns
     set status      = 'SENT',
         "sentAt"    = coalesce("sentAt", now()),
         "updatedAt" = now()
   where id = campaign_id
     and status = 'SENDING';

  return true;
end;
$$;

-- ── due_campaigns ───────────────────────────────────────────
--
-- What the cron should work on: anything scheduled for a moment that has passed,
-- and anything already sending that did not finish.
--
-- The second half is what makes a bounded run safe. A campaign larger than one
-- invocation can carry is simply picked up again.

create or replace function public.due_campaigns()
returns table (id text, status public."CampaignStatus")
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.status
    from public.campaigns c
   where (c.status = 'SCHEDULED' and c."scheduledAt" is not null
          and c."scheduledAt" <= now())
      or c.status = 'SENDING'
   order by coalesce(c."scheduledAt", c."createdAt")
   limit 10;
$$;

-- ── Privileges ──────────────────────────────────────────────

revoke all on function public.begin_campaign_dispatch(text)
  from public, anon, authenticated;
revoke all on function public.next_campaign_chunk(text, int)
  from public, anon, authenticated;
revoke all on function public.record_campaign_sends(text, jsonb)
  from public, anon, authenticated;
revoke all on function public.finish_campaign(text)
  from public, anon, authenticated;
revoke all on function public.due_campaigns()
  from public, anon, authenticated;
