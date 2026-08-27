-- KHEM — the Discovery Credit ledger.
--
-- Applied by `npm run db:migrate` after `0017_order_events.sql`, whose bodies
-- for `settle_order_payment()` and `set_order_status()` this file re-declares
-- with one added call each, and after `0024_customers.sql`, whose `clerkUserId`
-- convention it follows.
--
-- ── The policy this implements ──────────────────────────────
--
-- Buying a Discovery Set earns a credit worth what was paid for it. That credit
-- pays for one eligible full-size fragrance, within sixty days of the Set being
-- delivered. Specifically:
--
--   1. Credit = 100% of the paid Discovery Set price.
--   2. Redeemable against a FRAGRANCE-kind product only.
--   3. Valid 60 days from **delivery**, not from purchase.
--   4. Never combined with a promotional discount.
--   5. No cash value.
--   6. Belongs to the purchasing account; not transferable.
--   7. Each paid Set earns its own credit — a line of quantity 2 earns two.
--   8. Refunding the Set cancels its *unspent* credits.
--   9. Refunding a redemption restores the credit.
--
-- Redemption itself is **not in this file**. This is the ledger: credits are
-- earned, activated, expired and cancelled here, and `place_order()` learns to
-- spend one in a later migration. Splitting it that way means nothing in this
-- file can change what a customer is charged.
--
-- ── Why two tables and a view ───────────────────────────────
--
-- `customer_credits` is the *instrument*: which order created this credit, what
-- it was worth, when it becomes spendable, when it lapses. Every column on it is
-- an immutable fact about how the credit came to exist.
--
-- `credit_transactions` is the *ledger*: append-only, signed. A credit's balance
-- is the sum of its rows and is stored nowhere. That is the point — a balance
-- column and a transaction list are two records of the same fact, and the day
-- they disagree there is no way to tell which one is lying. A correction is a
-- new ADJUSTED row, never an edit.
--
-- `credit_balances` derives the state from the two, so "is this credit
-- available?" has exactly one definition in the system rather than one per
-- caller.
--
-- ── Voucher, not a wallet ───────────────────────────────────
--
-- One credit is consumed **whole** in one redemption. Against a cheaper bottle
-- the remainder is forfeited rather than carried — which is what "no cash
-- value" and "each Set generates its own credit" mean taken together. That is
-- why the ledger sums to zero on redemption rather than to a remainder.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- These rows name a customer and an amount of money. Same posture as `"Order"`:
-- RLS on, **no policy of any kind**, no grant to the public roles, `execute`
-- revoked on every function. Nothing reaches them without SUPABASE_SECRET_KEY.
--
-- Identity is Clerk's, so `clerkUserId` carries no foreign key — the same
-- decision, for the same two reasons, as `"Order"."clerkUserId"` in 0015.

-- ── Enums ───────────────────────────────────────────────────

-- The five movements the policy names. Nothing else may be written.
do $$ begin
  create type public."CreditTransactionKind" as enum (
    'EARNED', 'USED', 'REFUNDED', 'EXPIRED', 'ADJUSTED'
  );
exception when duplicate_object then null; end $$;

-- ── customer_credits ────────────────────────────────────────

create table if not exists public.customer_credits (
  id                  text primary key default gen_random_uuid()::text,

  -- Who owns it. Policy 6: a credit is not transferable, and this column is the
  -- whole of that rule — redemption compares it against a verified session.
  "clerkUserId"       text not null,

  -- Where it came from. Both kept: the order for the desk's narrative, the item
  -- for the issuance guard below.
  "sourceOrderId"     text not null
    references public."Order"(id) on delete cascade,
  "sourceOrderItemId" text not null
    references public."OrderItem"(id) on delete cascade,

  -- Which unit of a multi-quantity line this credit is for. Policy 7: a line of
  -- quantity 2 earns two credits, and this is what tells them apart.
  "unitIndex"         int not null check ("unitIndex" >= 0),

  -- What was actually paid for that single unit — a snapshot, like
  -- `"OrderItem"."priceInCents"`. A later reprice must not change what an
  -- already-earned credit is worth.
  "amountInCents"     int not null check ("amountInCents" > 0),

  "earnedAt"          timestamptz not null default now(),

  -- Null until the Set is delivered. Policy 3: the sixty days run from delivery,
  -- so a credit with no `deliveredAt` is not yet spendable and has no expiry.
  "deliveredAt"       timestamptz,
  "expiresAt"         timestamptz,

  -- Policy 8. Set when the source order is refunded or cancelled.
  "cancelledAt"       timestamptz,

  "createdAt"         timestamptz not null default now(),
  "updatedAt"         timestamptz not null default now()
);

-- **The issuance guard.** Stripe redelivers events and the desk can mark an
-- order paid twice; without this, either would mint a second credit for the
-- same bottle. `issue_discovery_credits()` relies on it rather than on checking
-- first, because a check-then-insert has a gap and a unique index does not.
create unique index if not exists customer_credit_unit_idx
  on public.customer_credits ("sourceOrderItemId", "unitIndex");

create index if not exists customer_credit_owner_idx
  on public.customer_credits ("clerkUserId", "earnedAt" desc);

create index if not exists customer_credit_source_idx
  on public.customer_credits ("sourceOrderId");

-- The expiry sweep's query, and only it: credits that could still lapse.
create index if not exists customer_credit_expiry_idx
  on public.customer_credits ("expiresAt")
  where "expiresAt" is not null and "cancelledAt" is null;

-- ── credit_transactions ─────────────────────────────────────
--
-- Append-only. There is no update path and no delete path anywhere in this
-- file: a mistake is corrected by an ADJUSTED row that says so, which leaves
-- the history intact and answerable.

create table if not exists public.credit_transactions (
  id              text primary key default gen_random_uuid()::text,

  "creditId"      text not null
    references public.customer_credits(id) on delete cascade,

  kind            public."CreditTransactionKind" not null,

  -- **Signed.** EARNED and REFUNDED add; USED and EXPIRED subtract; ADJUSTED
  -- does either. The balance is the sum, so the sign is the arithmetic rather
  -- than something a reader has to infer from `kind`.
  "amountInCents" int not null,

  -- The order that spent it (USED) or gave it back (REFUNDED). Null otherwise.
  "orderId"       text references public."Order"(id) on delete set null,

  -- Why, in a sentence, for the rows a policy did not dictate.
  note            text check (char_length(note) <= 500),

  -- The admin who made an ADJUSTED row. Null for everything the system did.
  actor           text check (char_length(actor) <= 200),

  "occurredAt"    timestamptz not null default now()
);

create index if not exists credit_transaction_credit_idx
  on public.credit_transactions ("creditId", "occurredAt");

create index if not exists credit_transaction_order_idx
  on public.credit_transactions ("orderId")
  where "orderId" is not null;

-- ── credit_balances ─────────────────────────────────────────
--
-- The single definition of a credit's state. Every caller — the dashboard, the
-- account portal, and the redemption guard in a later migration — reads it here
-- rather than re-deriving it, so they cannot disagree about whether a credit is
-- spendable.
--
-- The status ladder is ordered by precedence, not by chronology:
--
--   CANCELLED        the source order was refunded (policy 8) — beats everything
--   REDEEMED         nothing left; the transactions say whether it was spent or lapsed
--   PENDING_DELIVERY earned but the Set has not arrived, so the clock has not started
--   EXPIRED          past its window with money still on it
--   AVAILABLE        spendable now

create or replace view public.credit_balances as
select
  c.id,
  c."clerkUserId",
  c."sourceOrderId",
  c."sourceOrderItemId",
  c."unitIndex",
  c."amountInCents",
  c."earnedAt",
  c."deliveredAt",
  c."expiresAt",
  c."cancelledAt",
  coalesce(sum(t."amountInCents"), 0)::int as "balanceInCents",
  case
    when c."cancelledAt" is not null                          then 'CANCELLED'
    when coalesce(sum(t."amountInCents"), 0) <= 0             then 'REDEEMED'
    when c."deliveredAt" is null                              then 'PENDING_DELIVERY'
    when c."expiresAt" is not null and c."expiresAt" <= now() then 'EXPIRED'
    else 'AVAILABLE'
  end as status
from public.customer_credits c
left join public.credit_transactions t on t."creditId" = c.id
group by c.id;

-- ── issue_discovery_credits ─────────────────────────────────
--
-- Called the moment an order's money is real — from `settle_order_payment()`
-- for a card, and from the desk marking a cash order PAID. The trigger is the
-- payment *fact*, never the method.
--
-- One credit per unit, at that line's unit price. `generate_series` is what
-- turns a line of quantity 3 into three credits without a loop in TypeScript.
--
-- Idempotent through `customer_credit_unit_idx` rather than through a prior
-- check: `on conflict do nothing` has no gap, and a redelivered Stripe event is
-- the ordinary case rather than the exceptional one.
--
-- Returns how many credits it actually created, which is what lets the caller
-- log something true.

create or replace function public.issue_discovery_credits(order_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created int := 0;
  v_owner   text;
begin
  select nullif(o."clerkUserId", '')
    into v_owner
    from public."Order" o
   where o.id = order_id;

  -- A walk-in has no account, and a credit with no owner is a credit nobody can
  -- ever spend (policy 6). The desk sells Discovery Sets across the counter, so
  -- this is an ordinary outcome, not an error.
  if v_owner is null then
    return 0;
  end if;

  with issued as (
    insert into public.customer_credits (
      "clerkUserId", "sourceOrderId", "sourceOrderItemId",
      "unitIndex", "amountInCents"
    )
    select
      v_owner,
      order_id,
      i.id,
      unit.n - 1,
      i."priceInCents"
    from public."OrderItem" i
    join public."Product" p on p.slug = i."productSlug"
    join public."Collection" col on col.slug = p."collectionSlug"
    cross join lateral generate_series(1, i.quantity) as unit(n)
    where i."orderId" = order_id
      and col.kind = 'DISCOVERY'
    on conflict ("sourceOrderItemId", "unitIndex") do nothing
    returning id, "amountInCents"
  ),
  logged as (
    -- The EARNED row is written in the same statement as the credit it
    -- describes. A credit without its opening transaction would have a balance
    -- of zero and read as REDEEMED — the ledger is not a second copy of the
    -- instrument, it is where the money is.
    insert into public.credit_transactions ("creditId", kind, "amountInCents", note)
    select i.id, 'EARNED', i."amountInCents", 'Discovery Set purchase'
    from issued i
    returning 1
  )
  select count(*)::int into v_created from logged;

  return v_created;
end;
$$;

-- ── activate_discovery_credits ──────────────────────────────
--
-- Policy 3: the sixty days start at delivery. Called from `set_order_status()`
-- when the source order reaches DELIVERED.
--
-- Only stamps credits that have no `deliveredAt` yet, so a desk that moves an
-- order back to SHIPPED and forward again does not extend the window — the
-- customer's sixty days began the first time the parcel arrived.

create or replace function public.activate_discovery_credits(order_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activated int;
begin
  update public.customer_credits
     set "deliveredAt" = now(),
         "expiresAt"   = now() + interval '60 days',
         "updatedAt"   = now()
   where "sourceOrderId" = order_id
     and "deliveredAt" is null
     and "cancelledAt" is null;

  get diagnostics v_activated = row_count;

  return v_activated;
end;
$$;

-- ── cancel_discovery_credits ────────────────────────────────
--
-- Policy 8: refunding the Set cancels its **unused** credit.
--
-- A credit that has already been spent is deliberately left alone. The customer
-- received the fragrance it paid for; clawing it back would mean charging them
-- for taking a refund on something else. The `balanceInCents > 0` filter is that
-- rule, and it is the whole of it.

create or replace function public.cancel_discovery_credits(order_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelled int := 0;
begin
  with doomed as (
    select b.id, b."balanceInCents"
      from public.credit_balances b
     where b."sourceOrderId" = order_id
       and b."cancelledAt" is null
       and b."balanceInCents" > 0
  ),
  stamped as (
    update public.customer_credits c
       set "cancelledAt" = now(),
           "updatedAt"   = now()
      from doomed d
     where c.id = d.id
    returning c.id, d."balanceInCents"
  ),
  logged as (
    insert into public.credit_transactions ("creditId", kind, "amountInCents", note)
    select s.id, 'EXPIRED', -s."balanceInCents", 'Discovery Set refunded'
    from stamped s
    returning 1
  )
  select count(*)::int into v_cancelled from logged;

  return v_cancelled;
end;
$$;

-- ── expire_discovery_credits ────────────────────────────────
--
-- The nightly sweep, behind `/api/cron/expire-credits`.
--
-- Writes the closing EXPIRED row for anything past its window with money still
-- on it. Idempotent by construction: the row it writes takes the balance to
-- zero, so a second run finds nothing.
--
-- Note it does **not** stamp `cancelledAt` — an expired credit was not
-- cancelled, it lapsed, and `credit_balances` tells the two apart. The
-- distinction matters on a customer's screen.

create or replace function public.expire_discovery_credits()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired int := 0;
begin
  with lapsed as (
    select b.id, b."balanceInCents"
      from public.credit_balances b
     where b."cancelledAt" is null
       and b."expiresAt" is not null
       and b."expiresAt" <= now()
       and b."balanceInCents" > 0
  ),
  logged as (
    insert into public.credit_transactions ("creditId", kind, "amountInCents", note)
    select l.id, 'EXPIRED', -l."balanceInCents", 'Sixty-day window closed'
    from lapsed l
    returning 1
  )
  select count(*)::int into v_expired from logged;

  return v_expired;
end;
$$;

-- ── adjust_credit ───────────────────────────────────────────
--
-- The manual lever, for what a policy cannot anticipate — a goodwill extension,
-- a correction after a support call.
--
-- Always a new row, never an edit, and it records who. An adjustment that could
-- rewrite history would defeat the reason this is a ledger.
--
-- Refuses an adjustment that would take a credit's balance below zero: a
-- negative balance is not a state the policy has a meaning for, and it would
-- make `credit_balances` report REDEEMED for a credit that owes money.

create or replace function public.adjust_credit(
  credit_id text,
  amount    int,
  note      text,
  actor     text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  if amount = 0 then
    raise exception 'An adjustment of zero records nothing.'
      using errcode = 'check_violation';
  end if;

  /*
   * The lock goes on the **instrument**, not on `credit_balances`.
   *
   * `for update` cannot be applied to an aggregating view — Postgres refuses it
   * outright (`0A000`) — so locking the row that the view groups over is both
   * the only option and the correct one: it is what serialises two adjustments,
   * and the balance read immediately after it is then stable for this
   * transaction. **Redemption must lock the same way** when it lands.
   */
  perform 1
    from public.customer_credits c
   where c.id = credit_id
     for update;

  if not found then
    raise exception 'No credit with the id %.', credit_id
      using errcode = 'foreign_key_violation';
  end if;

  select b."balanceInCents"
    into v_balance
    from public.credit_balances b
   where b.id = credit_id;

  if v_balance + amount < 0 then
    raise exception 'That would leave the credit at %, below zero.',
      v_balance + amount
      using errcode = 'check_violation';
  end if;

  insert into public.credit_transactions
    ("creditId", kind, "amountInCents", note, actor)
  values (credit_id, 'ADJUSTED', amount, nullif(btrim(note), ''), actor);

  return v_balance + amount;
end;
$$;

-- ── settle_order_payment ────────────────────────────────────
--
-- The 0017 body, unchanged but for the one `perform` that issues credits. It
-- runs **inside the same transaction** as the payment it follows, so an order
-- cannot be paid without its credits existing — the same reasoning that keeps
-- stock movement inside `place_order()`.
--
-- Placed after the `return false` guard, so a redelivered Stripe event does no
-- work at all rather than relying on the issuance index to absorb it twice.

create or replace function public.settle_order_payment(
  order_id  text,
  intent_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public."PaymentStatus";
begin
  select "paymentStatus"
    into v_payment
    from public."Order"
   where id = order_id
     for update;

  if not found then
    raise exception 'No order with the id %.', order_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_payment = 'PAID' then
    return false;
  end if;

  update public."Order"
     set "paymentStatus"         = 'PAID',
         "paidAt"                = now(),
         "stripePaymentIntentId" = intent_id,
         "updatedAt"             = now()
   where id = order_id;

  -- Money is real, so any Discovery Set on this order has earned its credit.
  perform public.issue_discovery_credits(order_id);

  return true;
end;
$$;

-- ── set_order_status ────────────────────────────────────────
--
-- The 0017 body plus two calls, both of which are consequences of a status
-- rather than things the desk does separately:
--
--   DELIVERED             → the sixty-day clock starts (policy 3)
--   CANCELLED / REFUNDED  → unspent credits from this order are cancelled
--                           (policy 8), beside the restock that already happens
--
-- Policy 9 — restoring a credit spent *on* a refunded order — is not here,
-- because nothing can spend one yet. It lands with redemption, in the same
-- branch.

create or replace function public.set_order_status(
  order_id text,
  next_status public."OrderStatus"
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public."Order"
     set status = next_status,
         "updatedAt" = now()
   where id = order_id;

  if not found then
    raise exception 'No order with the id %.', order_id
      using errcode = 'foreign_key_violation';
  end if;

  insert into public."OrderStatusEvent" ("orderId", status)
  values (order_id, next_status);

  if next_status = 'DELIVERED' then
    perform public.activate_discovery_credits(order_id);
  end if;

  if next_status in ('CANCELLED', 'REFUNDED') then
    perform public.restock_order(order_id);
    perform public.cancel_discovery_credits(order_id);
  end if;
end;
$$;

-- ── Backfill ────────────────────────────────────────────────
--
-- Discovery Sets sold before this file existed earn their credits now, so the
-- ledger is complete rather than starting from today. Only paid orders, and
-- only those with an account behind them.
--
-- Delivered orders are activated afterwards, with the window measured from
-- **now** rather than from a delivery date in the past: a customer cannot be
-- given a credit that expired before they were told it existed.
--
-- Both statements go through the functions above, so they inherit the same
-- guards and are safe to re-run — which they will be, on every deploy.

do $$
declare
  v_order record;
begin
  for v_order in
    select o.id, o.status
      from public."Order" o
     where o."paymentStatus" = 'PAID'
       and nullif(o."clerkUserId", '') is not null
       and o.status not in ('CANCELLED', 'REFUNDED')
  loop
    perform public.issue_discovery_credits(v_order.id);

    if v_order.status = 'DELIVERED' then
      perform public.activate_discovery_credits(v_order.id);
    end if;
  end loop;
end $$;

-- ── Privileges ──────────────────────────────────────────────
--
-- `0006_privileges.sql` runs before this file and its altered defaults grant
-- `select` on new tables to the public roles. Taken back explicitly, exactly as
-- 0015 and 0024 do, because these rows name a customer and an amount of money.

alter table public.customer_credits     enable row level security;
alter table public.credit_transactions  enable row level security;

revoke all on public.customer_credits    from public, anon, authenticated;
revoke all on public.credit_transactions from public, anon, authenticated;
revoke all on public.credit_balances     from public, anon, authenticated;

revoke all on function public.issue_discovery_credits(text)    from public, anon, authenticated;
revoke all on function public.activate_discovery_credits(text) from public, anon, authenticated;
revoke all on function public.cancel_discovery_credits(text)   from public, anon, authenticated;
revoke all on function public.expire_discovery_credits()       from public, anon, authenticated;
revoke all on function public.adjust_credit(text, int, text, text)
  from public, anon, authenticated;
