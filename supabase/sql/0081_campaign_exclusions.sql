-- KHEM — leave chosen addresses out of a campaign before it is sent.
--
-- The desk can select whole audiences (the Inner Circle, customers) and type
-- extra addresses (0036), but it could not see who an audience resolved to, nor
-- take one person out of it. This adds the second half: a per-campaign list of
-- addresses NOT to write to (prompts/admin-redesign-stage-6.md, Campaigns).
--
-- `campaign_audience()` stays the single definition of "the audience": the
-- count the desk reads (`campaign_audience_breakdown`), the claim that sends
-- (0056/0057) and the new preview all go through it, so an address left out
-- here is left out of all three. Nothing else in the send path changes.
--
-- Additive and idempotent: a new table, one function re-created with one extra
-- predicate, and one new read-only function.

-- ── campaign_exclusions ──────────────────────────────────────

create table if not exists public.campaign_exclusions (
  "campaignId" text not null
    references public.campaigns(id) on delete cascade,

  email        text not null
    check (email = lower(email) and char_length(email) <= 254),

  "createdAt"  timestamptz not null default now(),

  primary key ("campaignId", email)
);

alter table public.campaign_exclusions enable row level security;

-- Service role only, like every campaign table: written by an admin-guarded
-- Server Action, read by the functions below.
revoke all on public.campaign_exclusions from public, anon, authenticated;

-- A campaign that has gone out is a record. Its exclusions are part of "who did
-- we write to", so they freeze with it — the same rule `guard_campaign_edit`
-- (0036) applies to the audience flags, enforced on the rows themselves.
create or replace function public.guard_campaign_exclusions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_status text;
begin
  select c.status::text into target_status
    from public.campaigns c
   where c.id = coalesce(new."campaignId", old."campaignId");

  if target_status is not null and target_status not in ('DRAFT', 'SCHEDULED') then
    raise exception 'campaign % has been sent; its audience cannot change',
      coalesce(new."campaignId", old."campaignId");
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists campaign_exclusions_guard on public.campaign_exclusions;
create trigger campaign_exclusions_guard
  before insert or update or delete on public.campaign_exclusions
  for each row execute function public.guard_campaign_exclusions();

revoke all on function public.guard_campaign_exclusions() from public, anon, authenticated;

-- ── campaign_audience_all ────────────────────────────────────
--
-- 0055's `campaign_audience()` body, unchanged, under a new name: everyone the
-- selected audiences reach, de-duplicated and minus suppressions — before the
-- desk's exclusions. The preview needs this set to show who was left out.

create or replace function public.campaign_audience_all(campaign_id text)
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
       -- No consent predicate. See the header of 0055 before adding one.
       and d.email is not null
       and coalesce(
             (select s.locale
                from public."NewsletterSubscriber" s
               where lower(s.email) = d.email
               limit 1),
             d.locale
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

-- ── campaign_audience ────────────────────────────────────────
--
-- Same signature and the same rows as before, minus the addresses the desk left
-- out. Every caller — breakdown, claim, preview — is unchanged.

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
  select a.email, a."subscriberId", a.kind
    from public.campaign_audience_all(campaign_id) a
   where not exists (
     select 1
       from public.campaign_exclusions x
      where x."campaignId" = campaign_id
        and x.email = a.email
   );
$$;

-- ── campaign_audience_preview ────────────────────────────────
--
-- What the desk reads before sending: every address the audience reaches, the
-- list it came from, a name where the house has one, and whether it was left
-- out. Read-only.

create or replace function public.campaign_audience_preview(campaign_id text)
returns table (
  email    text,
  kind     public."CampaignRecipientKind",
  name     text,
  excluded boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select a.email,
         a.kind,
         (select d.name
            from public.customer_directory d
           where d.email = a.email
           limit 1) as name,
         exists (
           select 1
             from public.campaign_exclusions x
            where x."campaignId" = campaign_id
              and x.email = a.email
         ) as excluded
    from public.campaign_audience_all(campaign_id) a
   order by a.email;
$$;

-- ── Privileges ───────────────────────────────────────────────

revoke all on function public.campaign_audience_all(text)     from public, anon, authenticated;
revoke all on function public.campaign_audience(text)         from public, anon, authenticated;
revoke all on function public.campaign_audience_preview(text) from public, anon, authenticated;
