-- KHEM — a campaign that would reach nobody is not a campaign that was sent.
--
-- Applied by `npm run db:migrate` after `0055_campaign_customer_audience.sql`.
-- It re-creates `begin_campaign_dispatch()` (0036) with one guard added.
-- Nothing else in that file changes, and no other function is touched.
--
-- ── The hole ────────────────────────────────────────────────
--
-- `campaign_audience()` returning no rows was indistinguishable, to the claim,
-- from a claim that had already been made. The insert wrote nothing, `v_claimed`
-- came back 0, and the function went on regardless: status SENDING,
-- `"audienceCount"` 0. `finish_campaign()` then looked for outstanding rows,
-- found none — there were never any — and stamped the campaign **SENT**.
--
-- So a campaign with both audience switches off and no named addresses could be
-- queued, dispatched, and filed in the history as delivered, having reached
-- nobody at all. Nothing in the record said otherwise: the list showed "sent",
-- the record screen showed 0 of 0 letters accepted, and both were true.
--
-- `sendCampaignNow()` already refused this at the door, and `scheduleCampaign()`
-- now does too. This is the third check, and the only one that holds when the
-- audience empties *after* the schedule is set — somebody unsubscribes, an
-- address is removed, the last named recipient is cleared — which is precisely
-- the case no Server Action can see coming.
--
-- ── Why refusing is safe here ───────────────────────────────
--
-- A zero claim cannot mean "already claimed". The claim and the move to SENDING
-- happen in one transaction under the row lock, so a campaign whose rows exist
-- is a campaign whose status is SENDING — and that case returns above, before
-- this ever runs. Reaching the insert with an empty audience therefore means the
-- audience is empty, full stop.
--
-- The status is deliberately left alone. The campaign stays DRAFT or SCHEDULED,
-- which is the truth — nothing has gone out — and the desk can fix the audience
-- and dispatch it again. Marking it CANCELLED here would throw away a schedule
-- because of a condition that may be a minute old.

create or replace function public.begin_campaign_dispatch(campaign_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign    record;
  v_claimed     int := 0;
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

  with claimed as (
    insert into public.campaign_sends
      ("campaignId", "subscriberId", email, "recipientKind")
    select campaign_id, a."subscriberId", a.email, a.kind
      from public.campaign_audience(campaign_id) a
    on conflict ("campaignId", email) do nothing
    returning 1
  )
  select count(*)::int into v_claimed from claimed;

  -- The guard. Nothing claimed, nothing sending, nothing sent: the status is
  -- untouched and the campaign remains exactly as editable as it was.
  if v_claimed = 0 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'That campaign would reach nobody. Choose an audience, or add an address to send to.',
      'claimed', 0,
      'outstanding', 0
    );
  end if;

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

-- ── Privileges ──────────────────────────────────────────────
--
-- 0034's revoke, re-issued because the function was replaced. Still service-role
-- only: this one claims an audience and must never be reachable from a browser.

revoke all on function public.begin_campaign_dispatch(text)
  from public, anon, authenticated;

-- The function's signature and return type are unchanged, so PostgREST's cached
-- schema is still accurate — but `npm run db:migrate` signals the reload anyway,
-- and AGENTS.md §9 explains why nothing here is validated before it has.
