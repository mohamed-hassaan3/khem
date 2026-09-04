-- KHEM — the delivery fee and the free-delivery minimum, as stored figures.
-- Applied by `npm run db:migrate`, after `0015_orders.sql` (which creates
-- `public."OrderChannel"`). Every statement is idempotent.
--
-- ## What this is
--
-- Two numbers that were constants in `src/lib/cart.ts`:
--
--     FREE_SHIPPING_THRESHOLD_IN_CENTS = 200_000
--     SHIPPING_FEE_IN_CENTS            =   9_000
--
-- with a comment above them warning that `dict.product.trust.delivery` repeats
-- the first one in prose and that the two must be "changed together". They are
-- the terms of business, not a fact about the code: the house changes them for a
-- season, and today changing them is a deploy and a pair of dictionary edits
-- that somebody has to remember to make.
--
-- ## Why a table and not two more columns on `"BoutiqueSetting"`
--
-- Because the answer differs by channel. A walk-in order and a web order are
-- delivered by different arrangements, and `"Order".channel` already records
-- which of the two an order is. Written as `onlineFee`/`offlineFee` columns, the
-- channel would be encoded in column *names* — and a third channel would then be
-- a migration rather than a row.
--
-- ## Nothing here is secret
--
-- The fee is printed on the cart page and the minimum is printed on every
-- product page. `anon` may read it, deliberately: the alternative is a round
-- trip through a server action to fetch a number the site is about to display in
-- 40px type. Writes are service-role only, like every other admin table — there
-- is no insert, update or delete policy below, and there should never be one.
--
-- ## The figures are quoted *and* charged from here
--
-- `src/lib/cart.ts` prices the bag from these values and
-- `src/actions/checkout.ts` re-reads them server-side before calling
-- `place_order()`. The browser's arithmetic remains a courtesy; the row is the
-- authority.

create table if not exists public."DeliverySetting" (
  channel                public."OrderChannel" primary key,

  -- Flat fee charged below the minimum, in piastres. Zero is legal and means
  -- "delivery is always complimentary on this channel".
  "feeInCents"           int not null default 0 check ("feeInCents" >= 0),

  -- The **minimum order** for complimentary delivery, in piastres. A subtotal at
  -- or above this pays nothing. Zero means every order qualifies.
  "freeThresholdInCents" int not null default 0 check ("freeThresholdInCents" >= 0),

  "updatedAt"            timestamptz not null default now()
);

-- ── The opening terms ─────────────────────────────────────────
--
-- EGP 90 delivery, complimentary at EGP 1,400. The fee is the figure the site
-- has always charged; the minimum is a reduction from the EGP 2,000 the constant
-- held, decided by the house.
--
-- `on conflict do nothing` rather than an upsert: this file runs on every
-- `db:migrate`, and an upsert would silently reset a figure an editor had
-- changed on the settings screen — the migration undoing the dashboard, once per
-- deploy, with nothing in the log to say so.

insert into public."DeliverySetting" (channel, "feeInCents", "freeThresholdInCents")
values
  ('ONLINE',  9000, 140000),
  ('OFFLINE', 9000, 140000)
on conflict (channel) do nothing;

-- ── Row Level Security ────────────────────────────────────────

alter table public."DeliverySetting" enable row level security;

drop policy if exists "Delivery terms are readable" on public."DeliverySetting";
create policy "Delivery terms are readable"
  on public."DeliverySetting" for select to anon, authenticated using (true);

grant select on public."DeliverySetting" to anon, authenticated;
