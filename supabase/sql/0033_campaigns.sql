-- KHEM — marketing campaigns.
--
-- Applied by `npm run db:migrate` after `0032_customer_notifications.sql`. It
-- references `discounts` (0028) and `"NewsletterSubscriber"` (0025).
--
-- ── The one irreversible feature in the house ───────────────
--
-- Everything else here can be corrected. A wrong price is edited, a wrong status
-- is set again, a wrong credit is adjusted. **A letter that has left cannot be
-- recalled**, and a letter sent twice to the whole list is not a bug somebody
-- fixes quietly. Every decision in this file is shaped by that.
--
-- ── campaign_sends is a claim, not a log ────────────────────
--
-- The row is written **before** the letter is attempted, and its primary key is
-- `(campaignId, subscriberId)`. A retry — a crashed dispatch, a re-run cron, a
-- double-clicked button — inserts nothing and therefore sends nothing.
--
-- This is the same discipline as `claim_welcome()` in 0030 and
-- `issue_discovery_credits()` in 0026, and it is here for a blunter reason than
-- either: those protect one person from a duplicate letter, this protects every
-- subscriber the house has at once.
--
-- Writing the claim first means a crash between claim and send costs somebody a
-- letter they never receive. That is the right side to fail on: an unsent
-- campaign can be sent again to the addresses that have no row, and a duplicate
-- cannot be unsent.
--
-- ── A sent campaign is a record, not a draft ────────────────
--
-- Once dispatch begins, the content is frozen by a trigger. An archive that
-- could be edited after the fact would describe a letter nobody received, and
-- the one question anybody asks about a campaign afterwards — "what did we
-- actually send?" — would have no answer.
--
-- ── The voucher is a real row ───────────────────────────────
--
-- `discountCode` is a foreign key into `discounts`, so a campaign cannot name a
-- code that does not exist. Whether that code is *usable* — active, in date,
-- within its caps — is `resolve_discount()`'s question and is asked again at
-- dispatch. §7.2's rule from the welcome letter, generalised: never put a code
-- in a template that the checkout would refuse.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Unchanged: RLS on, no policy, nothing granted to the public roles, `execute`
-- revoked. Every caller is behind `requireAdmin()` or `CRON_SECRET`.

-- ── Enums ───────────────────────────────────────────────────

do $$ begin
  create type public."CampaignType" as enum (
    'NEW_ARRIVAL', 'DISCOUNT', 'NEW_COLLECTION',
    'EXCLUSIVE_OFFER', 'SEASONAL', 'CUSTOM'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  -- DRAFT and SCHEDULED are editable; SENDING and SENT are history.
  -- CANCELLED is a schedule withdrawn before it ran.
  create type public."CampaignStatus" as enum (
    'DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED'
  );
exception when duplicate_object then null; end $$;

-- ── campaigns ───────────────────────────────────────────────

create table if not exists public.campaigns (
  id             text primary key default gen_random_uuid()::text,

  -- The desk's own name for it. Never sent; it is how a campaign is found again.
  name           text not null check (char_length(name) between 2 and 120),

  type           public."CampaignType" not null default 'CUSTOM',

  /*
   * Which list this speaks to. `0025` stores a locale per subscriber and says
   * why: "a letter in the wrong language is a letter nobody reads". A campaign
   * therefore has one language and one audience, rather than a translation
   * guessed at send time.
   */
  locale         text not null default 'en' check (locale in ('en', 'ar')),

  subject        text not null check (char_length(subject) between 3 and 200),
  -- What the inbox shows beside the subject.
  preheader      text not null default '' check (char_length(preheader) <= 200),

  /*
   * Plain paragraphs, separated by blank lines, styled by the template.
   *
   * Deliberately **not** HTML from the editor. It would be an injection surface
   * on a letter sent to thousands of people, and it would make every campaign's
   * typography somebody's improvisation rather than the house's.
   */
  body           text not null check (char_length(body) between 10 and 8000),

  "heroUrl"      text check (char_length("heroUrl") <= 600),
  "heroAlt"      text check (char_length("heroAlt") <= 200),

  "ctaLabel"     text not null default '' check (char_length("ctaLabel") <= 60),
  "ctaHref"      text not null default '' check (char_length("ctaHref") <= 600),

  /*
   * The voucher, if this campaign carries one. A foreign key, so the code in a
   * letter is always a code the discount engine knows.
   *
   * `on update cascade` because `discounts.code` is the row's identity and may
   * be corrected; `on delete set null` because deleting a campaign's discount
   * must not delete the record of the campaign.
   */
  "discountCode" text references public.discounts(code)
                   on update cascade on delete set null,

  status         public."CampaignStatus" not null default 'DRAFT',

  -- When it should go. Null while it is a draft or being sent by hand.
  "scheduledAt"  timestamptz,
  "sentAt"       timestamptz,

  -- How many addresses it actually claimed. Written at dispatch; a snapshot,
  -- because the list keeps moving and "who did this reach" must not.
  "audienceCount" int,

  -- The administrator who created it, as a Clerk user id. Never an email.
  "createdBy"    text,

  "createdAt"    timestamptz not null default now(),
  "updatedAt"    timestamptz not null default now()
);

create index if not exists campaign_status_idx
  on public.campaigns (status, "createdAt" desc);

-- The dispatch's one query: everything due, oldest schedule first.
create index if not exists campaign_due_idx
  on public.campaigns ("scheduledAt")
  where status = 'SCHEDULED';

-- ── campaign_sends ──────────────────────────────────────────
--
-- One row per (campaign, subscriber), written **before** the letter is
-- attempted. The primary key is the whole of the duplicate protection.

create table if not exists public.campaign_sends (
  "campaignId"   text not null
    references public.campaigns(id) on delete cascade,

  "subscriberId" text not null
    references public."NewsletterSubscriber"(id) on delete cascade,

  -- Null until the provider accepted it. A row with no stamp is a letter that
  -- was claimed and did not go — visible, and countable, rather than assumed.
  "sentAt"       timestamptz,

  -- The provider's complaint, when there was one. Never the address.
  error          text check (char_length(error) <= 500),

  "claimedAt"    timestamptz not null default now(),

  primary key ("campaignId", "subscriberId")
);

create index if not exists campaign_send_campaign_idx
  on public.campaign_sends ("campaignId", "sentAt");

-- ── guard_campaign_edit ─────────────────────────────────────
--
-- A campaign that has begun sending is history.
--
-- The columns named here are the ones that decide what a recipient sees. Status,
-- `sentAt` and `audienceCount` are deliberately absent: those are how dispatch
-- records its own progress, and freezing them would freeze the dispatch.
--
-- In the database rather than only in the action, because "what did we actually
-- send?" must be answerable from the row, and an action is one of several ways a
-- row can be reached.

create or replace function public.guard_campaign_edit()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('SENDING', 'SENT') and (
       new.name           is distinct from old.name
    or new.type           is distinct from old.type
    or new.locale         is distinct from old.locale
    or new.subject        is distinct from old.subject
    or new.preheader      is distinct from old.preheader
    or new.body           is distinct from old.body
    or new."heroUrl"      is distinct from old."heroUrl"
    or new."heroAlt"      is distinct from old."heroAlt"
    or new."ctaLabel"     is distinct from old."ctaLabel"
    or new."ctaHref"      is distinct from old."ctaHref"
    or new."discountCode" is distinct from old."discountCode"
  ) then
    raise exception 'A campaign that has been sent cannot be edited.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_edit_guard on public.campaigns;

create trigger campaign_edit_guard
  before update on public.campaigns
  for each row
  execute function public.guard_campaign_edit();

-- ── campaign_audience_count ─────────────────────────────────
--
-- How many people a campaign in this language would reach, right now.
--
-- The same predicate the dispatch will claim over, written once so the number
-- the desk is shown before sending and the number of letters that leave cannot
-- come from two different definitions of "the audience".

create or replace function public.campaign_audience_count(campaign_locale text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public."NewsletterSubscriber" s
   where s.status = 'SUBSCRIBED'
     and s.locale = coalesce(nullif(campaign_locale, ''), 'en');
$$;

-- ── Privileges ──────────────────────────────────────────────

alter table public.campaigns      enable row level security;
alter table public.campaign_sends enable row level security;

revoke all on public.campaigns      from public, anon, authenticated;
revoke all on public.campaign_sends from public, anon, authenticated;

revoke all on function public.campaign_audience_count(text)
  from public, anon, authenticated;
revoke all on function public.guard_campaign_edit()
  from public, anon, authenticated;
