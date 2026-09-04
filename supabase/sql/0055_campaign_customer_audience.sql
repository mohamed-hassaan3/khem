-- KHEM — the Customers audience is everyone who has bought.
--
-- Applied by `npm run db:migrate` after `0054_stripe_webhook_events.sql`. It
-- re-creates `customer_directory` (0024) with one column added and rewrites
-- `campaign_audience()` (0036). Nothing else in either file changes.
--
-- ── Why the consent predicate came off ──────────────────────
--
-- 0036 defined the Customers audience as `customer_directory` filtered on
-- `"marketingOptIn"`, and said plainly that a customer who did not tick the box
-- is not in the audience whatever the desk selects. That was the right rule for
-- a box that gets ticked. **This one never could be.**
--
-- `"marketingOptIn"` is written in exactly two places — the sign-up checkbox and
-- the account profile toggle — and neither is on the road a customer actually
-- travels. Checkout does not ask. A guest or a walk-in has no `"User"` row at
-- all, so the view's `coalesce(a."marketingOptIn", false)` returns false by
-- construction, not by choice. The result was an audience that was empty in
-- principle: with three customers and four orders on the books, the desk was
-- shown "0 addresses" and had no action available anywhere in the product that
-- could raise it.
--
-- So the rule is now the soft opt-in one: **somebody who has bought from the
-- house and left an address may be written to about the house.** Owner's
-- decision, 2026-09-04.
--
-- ── What carries the refusal instead ────────────────────────
--
-- `email_suppressions`, which 0036 built for exactly this and which already
-- works for `CUSTOMER`-kind sends. Every letter is claimed in `campaign_sends`
-- against the address with its own `unsubscribeToken`;
-- `unsubscribe_by_campaign_token()` writes the suppression; the audience query
-- below subtracts suppressions from **every** source, hand-typed addresses
-- included. That subtraction is now the only thing standing between a customer
-- and a letter they have refused — do not weaken it, and do not restore the
-- `"marketingOptIn"` predicate below as a bug fix. It was removed deliberately.
--
-- `"marketingOptIn"` keeps its meaning everywhere else. It is still recorded,
-- still shown on the customers list and the customer detail screen, still what
-- the account profile toggle writes. It has stopped being a condition of
-- sending; it has not stopped being a preference the house holds.
--
-- ── The second zero, which nobody had hit yet ───────────────
--
-- 0036 resolved a customer's language as "their subscriber row's locale, and
-- English otherwise". For a customer who is not a subscriber that is not an
-- inference, it is a constant: an Arabic campaign matched `'en' = 'ar'` for
-- every non-subscribing customer in the boutique and reached none of them, and
-- would have gone on doing so after the consent filter came off.
--
-- The directory now carries the locale of the customer's most recent order,
-- which is the language they were last served in and the only evidence the
-- house has. It lives in the view because the view is already the one place
-- that reconciles a person's orders into a person; re-deriving that join inside
-- the audience query would be a second definition of who somebody is.
--
-- A subscriber row still wins over it. A stated list preference beats an
-- inferred one.

-- ── customer_directory + locale ─────────────────────────────
--
-- Re-created, not altered. `create or replace view` keeps every existing column
-- in its existing position and type — `locale` is appended at the end, which is
-- the only shape of change it permits. The three functions 0024 declares on top
-- of this view (`customer_summary`, `customer_profile`, `customer_orders`) name
-- their columns explicitly and are unaffected; no view or matview depends on it,
-- so nothing needs dropping.

create or replace view public.customer_directory as
with order_customer as (
  select
    o.id                                 as order_id,
    nullif(o."clerkUserId", '')          as clerk_id,
    lower(nullif(o."customerEmail", '')) as email,
    o."customerName"                     as name,
    nullif(o."customerPhone", '')        as phone,
    o."totalInCents"                     as total,
    o.status                             as status,
    o."placedAt"                         as placed_at,
    -- 0016: not null, defaulted 'en', checked against ('en', 'ar').
    o.locale                             as locale
  from public."Order" o
),
keyed as (
  select
    coalesce(
      oc.email,
      lower(by_clerk.email),
      oc.clerk_id,
      'order:' || oc.order_id
    ) as customer_key,
    oc.*
  from order_customer oc
  -- Only to borrow the address of an account that placed an order without one.
  left join public."User" by_clerk
    on by_clerk."deletedAt" is null
   and by_clerk."clerkId" = oc.clerk_id
),
order_rollup as (
  select
    k.customer_key,
    max(k.clerk_id) as clerk_id,
    max(k.email)    as email,
    -- The name and phone they used most recently, not the first one on file:
    -- a corrected spelling should win over the typo it replaced.
    (array_agg(k.name  order by k.placed_at desc))[1] as name,
    (array_agg(k.phone order by k.placed_at desc)
       filter (where k.phone is not null))[1]         as phone,
    -- The language they were last served in, for the same reason.
    (array_agg(k.locale order by k.placed_at desc))[1] as locale,
    count(*)::int                                     as order_count,
    coalesce(
      sum(k.total) filter (where k.status not in ('CANCELLED', 'REFUNDED')),
      0
    )::bigint                                         as spend,
    max(k.placed_at)                                  as last_order_at,
    min(k.placed_at)                                  as first_order_at
  from keyed k
  group by k.customer_key
),
account as (
  select
    u.id,
    u."clerkId",
    lower(u.email) as email,
    nullif(btrim(concat_ws(' ', u."firstName", u."lastName")), '') as name,
    u.phone,
    u."marketingOptIn",
    u."marketingOptInAt",
    u."createdAt"
  from public."User" u
  where u."deletedAt" is null
)
select
  -- What the detail route is addressed by. An account's row id when there is
  -- an account; otherwise the key that identified the person above.
  coalesce(a.id, r.customer_key)            as id,
  coalesce(a."clerkId", r.clerk_id)         as "clerkId",
  coalesce(a.email, r.email)                as email,
  coalesce(a.name, r.name)                  as name,
  coalesce(a.phone, r.phone)                as phone,
  (a.id is not null)                        as "hasAccount",
  coalesce(a."marketingOptIn", false)       as "marketingOptIn",
  a."marketingOptInAt"                      as "marketingOptInAt",
  coalesce(r.order_count, 0)                as "orderCount",
  coalesce(r.spend, 0)::bigint              as "lifetimeSpendInCents",
  r.last_order_at                           as "lastOrderAt",
  -- An account holder joined when they registered; a walk-in "joined" the
  -- first time they bought something, which is the only date we have.
  coalesce(a."createdAt", r.first_order_at) as "joinedAt",
  -- Appended, and it must stay last: `create or replace view` cannot insert a
  -- column into the middle of this list. An account that has never ordered has
  -- no order to read a language from, so it falls back to the same 'en' the
  -- checkout column defaults to.
  coalesce(r.locale, 'en')                  as locale
from account a
-- Joined on the email, because that is what the orders were keyed by. An
-- account that has never ordered still appears; so does a walk-in who has
-- never registered.
full outer join order_rollup r
  on r.customer_key = a.email;

-- 0024's grant, re-issued. The view was re-created, and these rows are a
-- customer's name, email and phone.
revoke all on public.customer_directory from public, anon, authenticated;

-- ── campaign_audience ───────────────────────────────────────
--
-- Rewritten whole, because a `create or replace function` is the only way to
-- change one. The subscribers CTE, the specific CTE, the suppression
-- subtraction and the `distinct on (email) … order by email, rank` that makes
-- an address on two lists report once under the list it most belongs to are all
-- carried over unchanged: **deduplication is still the primary key's job**, not
-- this query's, and this query is still the single definition of "the audience"
-- shared by the count the desk reads and the claim that sends.
--
-- The customers CTE is the change, and it is two lines: the `"marketingOptIn"`
-- filter is gone, and the locale fallback is the customer's own rather than a
-- flat 'en'.

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
       -- No consent predicate. See the header of this file before adding one.
       and d.email is not null
       -- Their subscriber row's language when they have one, because that is
       -- stated; otherwise the language of their most recent order, which is
       -- what the directory carries.
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

-- ── Privileges ──────────────────────────────────────────────
--
-- Unchanged from 0036 and re-issued because the function was replaced. Still
-- service-role only, called by admin-guarded Server Actions.

revoke all on function public.campaign_audience(text) from public, anon, authenticated;
