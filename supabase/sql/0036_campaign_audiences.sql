-- KHEM — campaign audiences: subscribers, customers, and named addresses.
--
-- Applied by `npm run db:migrate` after `0035_marketing.sql`. It rewrites the
-- dispatch functions declared in `0034_campaign_dispatch.sql` and reads
-- `customer_directory` (0024), `"NewsletterSubscriber"` (0025) and `campaigns`
-- (0033).
--
-- ── What changed, and why it needed the database ────────────
--
-- A campaign could reach exactly one audience: the subscribed addresses on its
-- own language list. That was not a UI limitation. `campaign_sends` was keyed
-- `(campaignId, subscriberId)` with a not-null foreign key into
-- `"NewsletterSubscriber"`, so a customer who never joined the list, or an
-- address somebody typed by hand, **could not be recorded as having been
-- written to**. A feature that cannot record what it did is a feature that will
-- eventually send the same letter twice.
--
-- So the claim is now keyed by the thing all three audiences actually share —
-- the address:
--
--     primary key ("campaignId", email)     -- email stored lowercase
--
-- **Deduplication is therefore the primary key, not application code.** An
-- address that is both a subscriber and a consenting customer is claimed once
-- because the second insert conflicts, in the same statement, in the same
-- transaction. There is no code path in which the union is computed by hand and
-- no arrangement of checkboxes that produces two letters.
--
-- ── Consent is not a checkbox on this screen ────────────────
--
-- The Customers audience is `customer_directory` filtered on
-- `"marketingOptIn"`, which 0024 records and 0032 moves. A customer who did not
-- tick the box is not in the audience, whatever the desk selects. Suppressions
-- (below) are subtracted from **every** source including hand-typed addresses:
-- somebody who has asked to be left alone is left alone even when an
-- administrator types their address, which is the whole point of asking.
--
-- ── One language, still ────────────────────────────────────
--
-- 0033's rule stands: a campaign has one locale and speaks to one language.
-- Subscribers carry a locale of their own. A customer's is taken from their
-- subscriber row when they have one and defaults to English otherwise, which is
-- what the Clerk webhook assumes when it subscribes them. Named addresses carry
-- no language and are not filtered — the desk typed them deliberately.
--
-- ── The unsubscribe token moved to the send ─────────────────
--
-- A letter must carry a working unsubscribe link whoever it went to, and a
-- customer or a typed address has no subscriber row to borrow one from. The
-- alternative — quietly enrolling every recipient into the Inner Circle so they
-- have a token — would make the list a record of who we mailed rather than of
-- who asked to hear from us, which is the one thing a consent list must not be.
--
-- So each `campaign_sends` row carries its own random token, and following it
-- does two things: it suppresses the address permanently, and, when the row was
-- a subscriber's, it unsubscribes them from the list as well.
--
-- **Known limitation, deliberately taken.** A customer's account preference is
-- mirrored in Clerk (`unsafeMetadata.marketingOptIn`) and re-synced by the
-- webhook. An anonymous link click cannot write Clerk, so unsubscribing this
-- way does *not* flip that toggle — the suppression is what stops the mail, and
-- it cannot be undone by a later Clerk sync. The account screen therefore keeps
-- showing the customer's own stated preference, which remains true; it is the
-- sending side that has been told to stop.
--
-- ── Trust model ────────────────────────────────────────────
--
-- Unchanged. RLS on, no policy, nothing granted to the public roles, `execute`
-- revoked. `unsubscribe_by_campaign_token()` is the single exception in spirit —
-- it is still service-role only, called by a Server Action, exactly as
-- `unsubscribe_newsletter()` is.

-- ── Enums ───────────────────────────────────────────────────

do $$ begin
  -- Where a claimed recipient came from. Kept on the send row because the
  -- answer decides what following its unsubscribe link means.
  create type public."CampaignRecipientKind" as enum (
    'SUBSCRIBER', 'CUSTOMER', 'SPECIFIC'
  );
exception when duplicate_object then null; end $$;

-- ── email_suppressions ──────────────────────────────────────
--
-- Addresses no campaign may write to again, whatever list they appear on.
--
-- Separate from `"NewsletterSubscriber".status` because it answers a different
-- question. That column records membership of the Inner Circle; this records a
-- refusal, and a refusal has to outlive any particular list — including for
-- people who were never on one.

create table if not exists public.email_suppressions (
  email       text primary key check (email = lower(email) and char_length(email) <= 254),

  -- Why it is here. Never the campaign's content, never a note about the person.
  reason      text not null default 'UNSUBSCRIBED'
                check (reason in ('UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED', 'MANUAL')),

  "createdAt" timestamptz not null default now()
);

-- ── campaigns: which audiences ──────────────────────────────
--
-- Defaults reproduce today's behaviour exactly, so every campaign that already
-- exists keeps the audience it was written for.

alter table public.campaigns
  add column if not exists "toSubscribers" boolean not null default true;

alter table public.campaigns
  add column if not exists "toCustomers" boolean not null default false;

-- ── campaign_recipients ─────────────────────────────────────
--
-- Mode B: the addresses somebody typed. Rows are the campaign's own, deleted
-- with it, and unique per address so the same address cannot be typed twice
-- into one campaign.

create table if not exists public.campaign_recipients (
  "campaignId" text not null
    references public.campaigns(id) on delete cascade,

  email        text not null
    check (email = lower(email) and char_length(email) <= 254),

  "createdAt"  timestamptz not null default now(),

  primary key ("campaignId", email)
);

-- ── campaign_sends: keyed by address ────────────────────────
--
-- Additive first, backfilled, and only then re-keyed — in that order, inside
-- the one transaction `db-migrate.ts` runs everything in. No existing row is
-- deleted or rewritten beyond gaining the three columns it now needs.

alter table public.campaign_sends
  add column if not exists email text;

alter table public.campaign_sends
  add column if not exists "recipientKind" public."CampaignRecipientKind";

alter table public.campaign_sends
  add column if not exists "unsubscribeToken" text
    default replace(gen_random_uuid()::text, '-', '')
         || replace(gen_random_uuid()::text, '-', '');

-- The backfill. Every row that exists today is a subscriber's, by construction:
-- it is the only kind the old claim could write.
update public.campaign_sends cs
   set email = lower(s.email)
  from public."NewsletterSubscriber" s
 where s.id = cs."subscriberId"
   and cs.email is null;

update public.campaign_sends
   set "recipientKind" = 'SUBSCRIBER'
 where "recipientKind" is null;

update public.campaign_sends
   set "unsubscribeToken" = replace(gen_random_uuid()::text, '-', '')
                         || replace(gen_random_uuid()::text, '-', '')
 where "unsubscribeToken" is null;

-- A claim whose subscriber row was deleted underneath it has no address to
-- recover; there is nothing to write to and nothing to record. It goes, and
-- only it — this is the one delete in this file and it removes no history that
-- could still be read.
delete from public.campaign_sends where email is null;

-- Re-key, and note the order: **the old key comes off first**. A column cannot
-- drop NOT NULL while it is part of a primary key, and `subscriberId` is in
-- 0033's. The old key is a strict subset of the new one for existing rows, so
-- nothing that was permitted becomes forbidden by the swap.
alter table public.campaign_sends
  drop constraint if exists campaign_sends_pkey;

alter table public.campaign_sends
  alter column email set not null,
  alter column "recipientKind" set not null,
  alter column "unsubscribeToken" set not null,
  -- A customer or a typed address has no subscriber row. This is the change the
  -- whole feature was blocked on.
  alter column "subscriberId" drop not null;

alter table public.campaign_sends
  drop constraint if exists campaign_sends_email_lowercase;
alter table public.campaign_sends
  add constraint campaign_sends_email_lowercase
    check (email = lower(email) and char_length(email) <= 254);

alter table public.campaign_sends
  add constraint campaign_sends_pkey primary key ("campaignId", email);

-- The guarantee the old key used to give, kept where it still applies.
create unique index if not exists campaign_sends_subscriber_idx
  on public.campaign_sends ("campaignId", "subscriberId")
  where "subscriberId" is not null;

create unique index if not exists campaign_sends_token_idx
  on public.campaign_sends ("unsubscribeToken");

-- ── campaign_audience ───────────────────────────────────────
--
-- Who a campaign would reach, as rows. **One definition of "the audience",**
-- used by the claim that sends and by the count the desk is shown before it
-- presses the button — so the number in the confirmation and the number of
-- letters that leave cannot come from two different queries.
--
-- Returns one row per unique address; the `kind` is which source won, ordered
-- subscriber → customer → specific, so an address on two lists is reported once
-- and attributed to the list it most belongs to.

create or replace function public.campaign_audience(campaign_id text)
returns table (
  email          text,
  "subscriberId" text,
  kind           public."CampaignRecipientKind"
)
language sql
stable
security definer
set search_path = public
as $$
  with campaign as (
    select id, locale, "toSubscribers", "toCustomers"
      from public.campaigns
     where id = campaign_id
  ),
  subscribers as (
    select lower(s.email) as email, s.id as subscriber_id,
           'SUBSCRIBER'::public."CampaignRecipientKind" as kind, 1 as rank
      from public."NewsletterSubscriber" s, campaign c
     where c."toSubscribers"
       and s.status = 'SUBSCRIBED'
       and s.locale = c.locale
  ),
  customers as (
    select d.email, null::text as subscriber_id,
           'CUSTOMER'::public."CampaignRecipientKind" as kind, 2 as rank
      from public.customer_directory d, campaign c
     where c."toCustomers"
       and d."marketingOptIn"
       and d.email is not null
       -- A customer's language is their subscriber row's when they have one,
       -- and English otherwise — what the Clerk webhook assumes on signup.
       and coalesce(
             (select s.locale
                from public."NewsletterSubscriber" s
               where lower(s.email) = d.email
               limit 1),
             'en'
           ) = c.locale
  ),
  specific as (
    select r.email, null::text as subscriber_id,
           'SPECIFIC'::public."CampaignRecipientKind" as kind, 3 as rank
      from public.campaign_recipients r
     where r."campaignId" = campaign_id
  ),
  everyone as (
    select * from subscribers
    union all select * from customers
    union all select * from specific
  )
  select distinct on (e.email) e.email, e.subscriber_id, e.kind
    from everyone e
   where not exists (
     select 1 from public.email_suppressions x where x.email = e.email
   )
   order by e.email, e.rank;
$$;

-- ── campaign_audience_breakdown ─────────────────────────────
--
-- The same rows, counted, for the confirmation the desk reads before sending.
--
-- `total` is the deduplicated figure and is **not** the sum of the other three:
-- an address that is both a subscriber and a consenting customer is counted
-- once, under the source it was attributed to. That is exactly the number of
-- letters that will leave.

create or replace function public.campaign_audience_breakdown(campaign_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'subscribers', count(*) filter (where kind = 'SUBSCRIBER')::int,
    'customers',   count(*) filter (where kind = 'CUSTOMER')::int,
    'specific',    count(*) filter (where kind = 'SPECIFIC')::int,
    'total',       count(*)::int
  )
  from public.campaign_audience(campaign_id);
$$;

-- 0033's counter answered "how many subscribers speak this language", which is
-- no longer what an audience is. Dropped rather than left beside its successor:
-- two functions that both look like the answer is how a screen ends up showing
-- a number the dispatch does not agree with.
drop function if exists public.campaign_audience_count(text);

-- ── guard_campaign_edit ─────────────────────────────────────
--
-- 0033's trigger function, extended to the two audience flags.
--
-- Who a campaign went to is as much a part of "what did we actually send?" as
-- what it said. `setCampaignAudience()` already refuses a campaign that is not a
-- draft, but the action is one of several ways a row can be reached and the
-- question has to be answerable from the row itself.
--
-- `campaign_recipients` needs no equivalent: the claim copies each address onto
-- a `campaign_sends` row, so the record of who was written to survives whatever
-- happens to the list afterwards.

create or replace function public.guard_campaign_edit()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('SENDING', 'SENT') and (
       new.name            is distinct from old.name
    or new.type            is distinct from old.type
    or new.locale          is distinct from old.locale
    or new.subject         is distinct from old.subject
    or new.preheader       is distinct from old.preheader
    or new.body            is distinct from old.body
    or new."heroUrl"       is distinct from old."heroUrl"
    or new."heroAlt"       is distinct from old."heroAlt"
    or new."ctaLabel"      is distinct from old."ctaLabel"
    or new."ctaHref"       is distinct from old."ctaHref"
    or new."discountCode"  is distinct from old."discountCode"
    or new."toSubscribers" is distinct from old."toSubscribers"
    or new."toCustomers"   is distinct from old."toCustomers"
  ) then
    raise exception 'A campaign that has been sent cannot be edited.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- ── begin_campaign_dispatch ─────────────────────────────────
--
-- Claims the audience and moves the campaign to SENDING. Idempotent: a campaign
-- already SENDING returns its outstanding count rather than claiming again.
--
-- Unchanged in shape from 0034 — the lock before the read, one insert, one
-- transaction, the audience fixed at the instant of the claim. Only the source
-- of the rows is wider, and `on conflict do nothing` on the address key is what
-- makes the three sources one letter each.
--
-- Returns `{ ok, reason, claimed, outstanding }`.

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

-- ── next_campaign_batch ─────────────────────────────────────
--
-- A new name for 0034's `next_campaign_chunk`, because the row it returns is a
-- different shape and `create or replace` cannot change a return type. 0034 is
-- left exactly as it was so that re-running the whole directory still works;
-- this file drops its function afterwards, so whatever order the files are
-- applied in, the end state has one batch reader and it is this one.
--
-- The next batch of letters to compose: claimed, not yet sent, and still
-- willing to hear from us.
--
-- That last condition is not redundant with the claim. Somebody may withdraw
-- between the claim and their letter being composed, and the house must not
-- write to them — a withdrawal that arrived one second before dispatch is still
-- a withdrawal. It is now checked twice: the suppression list for every kind,
-- and the subscriber's own status for the rows that have one.
--
-- Returns the address and **the send row's own** unsubscribe token, so a
-- customer and a typed address carry a working link without being enrolled in a
-- list they never joined. **Nothing else in this schema returns either**, and no
-- caller may log them.

drop function if exists public.next_campaign_chunk(text, int);

create or replace function public.next_campaign_batch(
  campaign_id text,
  chunk_size  int default 100
)
returns table (
  email          text,
  token          text,
  kind           public."CampaignRecipientKind"
)
language sql
stable
security definer
set search_path = public
as $$
  select cs.email, cs."unsubscribeToken", cs."recipientKind"
    from public.campaign_sends cs
    left join public."NewsletterSubscriber" s on s.id = cs."subscriberId"
   where cs."campaignId" = campaign_id
     and cs."sentAt" is null
     and cs.error is null
     and (cs."subscriberId" is null or s.status = 'SUBSCRIBED')
     and not exists (
       select 1 from public.email_suppressions x where x.email = cs.email
     )
   order by cs."claimedAt"
   limit greatest(1, least(coalesce(chunk_size, 100), 100));
$$;

-- ── record_campaign_sends ───────────────────────────────────
--
-- Stamps what the provider accepted, and records what it refused.
--
-- `items` is now `[{ email, error? }, …]` — keyed by the address, because that
-- is what the row is keyed by and what the provider was given. An entry with no
-- error is a letter that went; an entry with one is a letter that did not, and
-- its reason is kept against that row so the desk can see which addresses
-- failed without the house retrying them forever.

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
      lower(item->>'email')     as email,
      nullif(item->>'error', '') as err
    from jsonb_array_elements(coalesce(items, '[]'::jsonb)) as item
  ),
  stamped as (
    update public.campaign_sends cs
       set "sentAt" = case when i.err is null then now() else null end,
           error    = left(i.err, 500)
      from incoming i
     where cs."campaignId" = campaign_id
       and cs.email = i.email
       -- Never re-stamp a letter that already went. The claim is single-use and
       -- so is its record.
       and cs."sentAt" is null
    returning 1
  )
  select count(*)::int into v_updated from stamped;

  return v_updated;
end;
$$;

-- ── unsubscribe_by_campaign_token ───────────────────────────
--
-- Following the link in a campaign letter.
--
-- By token, never by id or address — 0025's rule, for 0025's reason: the link
-- travels in plain text through other people's mail servers, and anything
-- guessable would let a stranger unsubscribe anyone.
--
-- Two effects, always in this order:
--
--   1. the address is suppressed, which is what actually stops the mail and
--      applies to every future campaign whatever list it draws from;
--   2. if the row was a subscriber's, they leave the Inner Circle too — the
--      list must not go on claiming somebody who has just said no.
--
-- Idempotent, and returns the same shape as `unsubscribe_newsletter()` so the
-- page can render one outcome: `{ found, alreadyOff, email }`. A token that
-- matches nothing gets `{ found: false }` and tells a prober nothing.

create or replace function public.unsubscribe_by_campaign_token(token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_send       record;
  v_already    boolean;
begin
  select cs.email, cs."subscriberId"
    into v_send
    from public.campaign_sends cs
   where cs."unsubscribeToken" = token;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  select exists (
    select 1 from public.email_suppressions where email = v_send.email
  ) into v_already;

  insert into public.email_suppressions (email, reason)
  values (v_send.email, 'UNSUBSCRIBED')
  on conflict (email) do nothing;

  if v_send."subscriberId" is not null then
    update public."NewsletterSubscriber"
       set status           = 'UNSUBSCRIBED',
           "unsubscribedAt" = coalesce("unsubscribedAt", now()),
           "updatedAt"      = now()
     where id = v_send."subscriberId"
       and status <> 'UNSUBSCRIBED';
  end if;

  return jsonb_build_object(
    'found', true, 'alreadyOff', v_already, 'email', v_send.email
  );
end;
$$;

-- ── Privileges ──────────────────────────────────────────────
--
-- 0033's arrangement, extended to what this file adds. Nothing here is
-- reachable without SUPABASE_SECRET_KEY.

alter table public.campaign_recipients enable row level security;
alter table public.email_suppressions  enable row level security;

revoke all on public.campaign_recipients from public, anon, authenticated;
revoke all on public.email_suppressions  from public, anon, authenticated;

revoke all on function public.campaign_audience(text)
  from public, anon, authenticated;
revoke all on function public.next_campaign_batch(text, int)
  from public, anon, authenticated;
revoke all on function public.campaign_audience_breakdown(text)
  from public, anon, authenticated;
revoke all on function public.unsubscribe_by_campaign_token(text)
  from public, anon, authenticated;
