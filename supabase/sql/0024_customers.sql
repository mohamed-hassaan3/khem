-- KHEM — customers: the people behind the orders.
--
-- Applied by `npm run db:migrate` after `0015_orders.sql` (which this reads)
-- and after `0006_privileges.sql` — which is why this file revokes the public
-- grants explicitly at the bottom rather than trusting the altered default
-- privileges to have covered tables created later. Same reasoning as 0015.
--
-- `src/services/admin/customers.ts` and `src/services/account.ts` read these;
-- `src/app/api/webhooks/clerk/route.ts` writes `"User"` and nothing else does.
--
-- ── Clerk owns identity; this is a replica ──────────────────
--
-- `"User"` stores what the *application* knows about a customer — their name as
-- they gave it, their marketing consent, the addresses they saved. It stores no
-- password, no session, no token, and nothing that could authenticate anybody.
-- Clerk remains the only authority on who a person is, and this table is a
-- projection of it kept current by a signed webhook. If the two disagree, Clerk
-- is right and the webhook is behind.
--
-- There is deliberately **no `role` column**. Authority over the dashboard
-- lives in the `ADMIN_EMAILS` allowlist read by `src/lib/admin/auth.ts`, and a
-- second place to write "this person is an admin" is a second place for the two
-- to disagree — with the disagreement resolving in favour of whichever one some
-- future query happened to ask.
--
-- ── No foreign key from `"Order"."clerkUserId"` ─────────────
--
-- The link stays soft, on purpose, and the join happens in the view below:
--
--  - Most of the order book is walk-in trade with a name and a phone and no
--    account at all. A foreign key would make those orders unrecordable.
--  - A checkout must not fail because Clerk's `user.created` webhook is thirty
--    seconds behind the customer's first purchase. With a constraint, that
--    ordinary race becomes a lost sale.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Identical to `"Order"` in 0015 and for the same reason: identity is Clerk's,
-- so `auth.uid()` is always null and no RLS policy here could express "this row
-- is mine". These rows carry a customer's name, email, phone and home address —
-- the publishable key that ships in every browser must not be able to read one.
-- RLS on, **no policy of any kind**, no grant to the public roles. The
-- `clerkUserId` filter in `src/services/account.ts` is the access control, and
-- it runs behind the secret key.

-- ── User ────────────────────────────────────────────────────

create table if not exists public."User" (
  id                 text primary key default gen_random_uuid()::text,

  -- The join key to Clerk, and the only identifier that is stable across an
  -- email change.
  "clerkId"          text not null unique,

  -- Stored lowercased by `sync_clerk_user()`. Held here rather than fetched
  -- from Clerk per render because the dashboard searches on it and the
  -- newsletter joins on it — neither of which can call an identity API per row.
  email              text not null check (char_length(email) <= 200),

  "firstName"        text check (char_length("firstName") <= 120),
  "lastName"         text check (char_length("lastName")  <= 120),
  phone              text check (char_length(phone) <= 40),

  -- The "Email me with news and offers" box on `/sign-up`, mirrored from the
  -- Clerk user's `unsafeMetadata`. That object is writable by the user it
  -- belongs to — correct for a preference they own — so the webhook treats it
  -- as untrusted input, coerces it to a boolean, and reads nothing else out of
  -- it. It can never influence a role, a price, or admin access.
  "marketingOptIn"   boolean not null default false,

  -- When they agreed. A bare boolean cannot answer "when did they consent?",
  -- which is the only question that matters if the opt-in is ever challenged.
  -- Moved only when the flag actually changes, so editing a surname does not
  -- silently restamp a consent date.
  "marketingOptInAt" timestamptz,

  "createdAt"        timestamptz not null default now(),
  "updatedAt"        timestamptz not null default now(),

  -- Soft delete. A `user.deleted` event removes the person's account; it must
  -- not remove the boutique's record of what it sold and to whom, which is a
  -- financial record with its own retention rules.
  "deletedAt"        timestamptz
);

-- Unique only among the living: a customer who deletes their account and signs
-- up again with the same address is a legitimate second row, and a plain unique
-- constraint would refuse the new one.
create unique index if not exists user_email_live_idx
  on public."User" (lower(email))
  where "deletedAt" is null;

create index if not exists user_clerk_idx on public."User" ("clerkId");
create index if not exists user_created_idx on public."User" ("createdAt" desc);

-- ── Address ─────────────────────────────────────────────────
--
-- Column names match `SavedAddress` in `src/types/account.ts` exactly. That is
-- what makes `getAddressesForUser()` a change of function *body* and nothing
-- else, which is what its own doc comment promised.
--
-- Distinct from the `ship*` columns denormalised onto `"Order"`: those are a
-- snapshot of where one parcel actually went and must never move. This is the
-- customer's editable address book.

create table if not exists public."Address" (
  id           text primary key default gen_random_uuid()::text,

  "userId"     text not null
    references public."User"(id) on delete cascade,

  -- The customer's own name for the place: "Home", "Office".
  label        text not null check (char_length(label) between 1 and 60),
  recipient    text not null check (char_length(recipient) between 2 and 120),

  line1        text not null check (char_length(line1) <= 200),
  line2        text check (char_length(line2) <= 200),
  city         text not null check (char_length(city) <= 80),
  state        text not null check (char_length(state) <= 80),
  "postalCode" text not null check (char_length("postalCode") <= 20),
  country      text not null check (char_length(country) <= 80),

  "isDefault"  boolean not null default false,

  "createdAt"  timestamptz not null default now(),
  "updatedAt"  timestamptz not null default now()
);

create index if not exists address_user_idx
  on public."Address" ("userId", "isDefault" desc);

-- At most one default per customer, enforced by the database rather than by
-- whichever code path last wrote one.
create unique index if not exists address_one_default_idx
  on public."Address" ("userId")
  where "isDefault";

-- ── sync_clerk_user ─────────────────────────────────────────
--
-- Upsert by `clerkId`, called for both `user.created` and `user.updated`. The
-- two events carry the same payload shape and the difference between them is
-- not worth two code paths — a `created` we somehow missed arrives as an
-- `updated` later, and this way that heals instead of failing.
--
-- Returns the row id. Raises only when the payload lacks the two fields without
-- which the row would be meaningless.

create or replace function public.sync_clerk_user(payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clerk text    := nullif(payload->>'clerkId', '');
  v_email text    := lower(nullif(payload->>'email', ''));
  v_opt   boolean := coalesce((payload->>'marketingOptIn')::boolean, false);
  v_id    text;
  v_prev  boolean;
begin
  if v_clerk is null or v_email is null then
    raise exception 'A user needs a clerkId and an email.'
      using errcode = 'check_violation';
  end if;

  select u.id, u."marketingOptIn"
    into v_id, v_prev
    from public."User" u
   where u."clerkId" = v_clerk;

  if v_id is null then
    insert into public."User" (
      "clerkId", email, "firstName", "lastName", phone,
      "marketingOptIn", "marketingOptInAt"
    ) values (
      v_clerk,
      v_email,
      nullif(payload->>'firstName', ''),
      nullif(payload->>'lastName', ''),
      nullif(payload->>'phone', ''),
      v_opt,
      -- Only a *yes* is a consent event worth dating.
      case when v_opt then now() else null end
    )
    returning id into v_id;

    return v_id;
  end if;

  update public."User"
     set email              = v_email,
         "firstName"        = nullif(payload->>'firstName', ''),
         "lastName"         = nullif(payload->>'lastName', ''),
         phone              = nullif(payload->>'phone', ''),
         "marketingOptIn"   = v_opt,
         -- Restamped only on an actual change of mind, in either direction:
         -- a withdrawal needs a date as much as an agreement does.
         "marketingOptInAt" = case
                                when v_opt is distinct from v_prev then now()
                                else "marketingOptInAt"
                              end,
         -- Signing up again after deleting the account revives the same row
         -- rather than orphaning its address book behind a second one.
         "deletedAt"        = null,
         "updatedAt"        = now()
   where id = v_id;

  return v_id;
end;
$$;

-- ── soft_delete_clerk_user ──────────────────────────────────
--
-- True when this call was the one that closed the account. Nothing else is
-- touched: the addresses stay (cascade would take them, but the row survives),
-- and the orders were never pointed at this table to begin with.

create or replace function public.soft_delete_clerk_user(clerk_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed int;
begin
  update public."User"
     set "deletedAt" = now(),
         "updatedAt" = now()
   where "clerkId" = clerk_id
     and "deletedAt" is null;

  get diagnostics v_closed = row_count;

  return v_closed = 1;
end;
$$;

-- ── customer_directory ──────────────────────────────────────
--
-- One row per *customer*, whether or not they ever made an account.
--
-- A Customers screen driven by `"User"` alone would be nearly empty: most of
-- this boutique's trade is walk-in orders typed at the desk, which carry a name
-- and an email and no `clerkUserId` at all. So the directory is the union of
-- two populations, keyed as follows:
--
--   1. an order with an email is keyed by that email. Email is the strongest
--      natural identity a boutique has, and it is the one thing a walk-in and a
--      signed-in checkout share. **Keying on `clerkUserId` first was wrong**:
--      a customer who buys online once and is served at the desk twice has one
--      account id on one order and none on the other two, and the directory
--      showed them as two different people with two different lifetime spends;
--   2. an order with no email but a `clerkUserId` is keyed by *that account's*
--      email, so a signed-in purchase that carried no address still lands on
--      the same person as their other orders;
--   3. failing both, it is keyed by the raw `clerkUserId` — an account whose
--      email we have not yet replicated from Clerk;
--   4. an order with none of the three is keyed by its own id, because there is
--      nothing to recognise a second visit by, and guessing would merge two
--      strangers who both paid cash.
--
-- The aggregation lives here, in SQL, for the reason `supabase/AGENTS.md` §23
-- gives: computing it in TypeScript means fetching every order in the boutique
-- to render fifty rows, and getting slower with every sale.
--
-- Lifetime spend excludes CANCELLED and REFUNDED, matching `getAccountSummary`
-- in `src/services/account.ts` — a refunded order is not money the house kept.
-- Those orders still count as orders *placed*, because they were.

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
    o."placedAt"                         as placed_at
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
  coalesce(a."createdAt", r.first_order_at) as "joinedAt"
from account a
-- Joined on the email, because that is what the orders were keyed by. An
-- account that has never ordered still appears; so does a walk-in who has
-- never registered.
full outer join order_rollup r
  on r.customer_key = a.email;

-- ── customer_summary ────────────────────────────────────────
--
-- The dashboard's page of customers: searched, ordered, paginated, and carrying
-- its own total so the pager does not need a second round trip.
--
-- `position(… in …)` rather than `ilike '%' || term || '%'`: the term is a
-- customer's keystrokes, and in a LIKE pattern a `%` or `_` they typed would be
-- wildcard syntax rather than characters to look for. This is the "real
-- function with real parameters" that `src/lib/admin/filter.ts` names as the
-- answer once a list outgrows filtering in memory.

create or replace function public.customer_summary(
  search_term  text default '',
  limit_count  int  default 50,
  offset_count int  default 0
)
returns table (
  id                     text,
  "clerkId"              text,
  email                  text,
  name                   text,
  phone                  text,
  "hasAccount"           boolean,
  "marketingOptIn"       boolean,
  "marketingOptInAt"     timestamptz,
  "orderCount"           int,
  "lifetimeSpendInCents" bigint,
  "lastOrderAt"          timestamptz,
  "joinedAt"             timestamptz,
  "totalCount"           bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with needle as (
    select lower(btrim(coalesce(search_term, ''))) as q
  ),
  matched as (
    select d.*
      from public.customer_directory d, needle n
     where n.q = ''
        or position(n.q in lower(coalesce(d.name,  ''))) > 0
        or position(n.q in lower(coalesce(d.email, ''))) > 0
        or position(n.q in lower(coalesce(d.phone, ''))) > 0
  )
  select
    m.id, m."clerkId", m.email, m.name, m.phone,
    m."hasAccount", m."marketingOptIn", m."marketingOptInAt",
    m."orderCount", m."lifetimeSpendInCents", m."lastOrderAt", m."joinedAt",
    count(*) over () as "totalCount"
  from matched m
  -- Most recent custom first; accounts that have never ordered fall to the
  -- bottom in registration order rather than disappearing.
  order by m."lastOrderAt" desc nulls last, m."joinedAt" desc nulls last
  limit greatest(1, least(coalesce(limit_count, 50), 200))
  offset greatest(0, coalesce(offset_count, 0));
$$;

-- ── customer_profile ────────────────────────────────────────
--
-- The same row for one customer, by the id the list handed the link. Shares the
-- view rather than restating the union, so the detail screen can never describe
-- a different person from the row that was clicked.

create or replace function public.customer_profile(customer_id text)
returns table (
  id                     text,
  "clerkId"              text,
  email                  text,
  name                   text,
  phone                  text,
  "hasAccount"           boolean,
  "marketingOptIn"       boolean,
  "marketingOptInAt"     timestamptz,
  "orderCount"           int,
  "lifetimeSpendInCents" bigint,
  "lastOrderAt"          timestamptz,
  "joinedAt"             timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id, d."clerkId", d.email, d.name, d.phone,
    d."hasAccount", d."marketingOptIn", d."marketingOptInAt",
    d."orderCount", d."lifetimeSpendInCents", d."lastOrderAt", d."joinedAt"
  from public.customer_directory d
  where d.id = customer_id
  limit 1;
$$;

-- ── customer_orders ─────────────────────────────────────────
--
-- The orders belonging to one directory row, resolved by the same four rules
-- the view keys on. A detail page cannot simply filter `"Order"` by
-- `clerkUserId`: that would drop the guest checkouts rule 2 just finished
-- attributing to this very person.

create or replace function public.customer_orders(customer_id text)
returns table (
  id              text,
  "orderNumber"   text,
  "placedAt"      timestamptz,
  status          public."OrderStatus",
  "paymentStatus" public."PaymentStatus",
  channel         public."OrderChannel",
  "totalInCents"  int,
  "firstOpenedAt" timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select d."clerkId", d.email, d.id
      from public.customer_directory d
     where d.id = customer_id
     limit 1
  )
  select
    o.id, o."orderNumber", o."placedAt", o.status, o."paymentStatus",
    o.channel, o."totalInCents", o."firstOpenedAt"
  from public."Order" o, target t
  where (t."clerkId" is not null and o."clerkUserId" = t."clerkId")
     or (t.email    is not null and lower(o."customerEmail") = t.email)
     -- The keyless walk-in of rule 4: exactly one order, addressed by its id.
     or (t.id like 'order:%' and o.id = substring(t.id from 7))
  order by o."placedAt" desc
  limit 200;
$$;

-- ── Privileges ──────────────────────────────────────────────
--
-- `0006_privileges.sql` runs *before* this file and its altered default
-- privileges grant `select` on newly created tables to the public roles. These
-- rows are a customer's name, email, phone and home address, so the grant is
-- taken back explicitly here — the same thing 0015 does, for the same reason.

alter table public."User"    enable row level security;
alter table public."Address" enable row level security;

revoke all on public."User"    from public, anon, authenticated;
revoke all on public."Address" from public, anon, authenticated;
revoke all on public.customer_directory from public, anon, authenticated;

revoke all on function public.sync_clerk_user(jsonb)        from public, anon, authenticated;
revoke all on function public.soft_delete_clerk_user(text)  from public, anon, authenticated;
revoke all on function public.customer_summary(text, int, int) from public, anon, authenticated;
revoke all on function public.customer_profile(text)        from public, anon, authenticated;
revoke all on function public.customer_orders(text)         from public, anon, authenticated;
