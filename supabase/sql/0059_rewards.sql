-- KHEM — the points ledger, and the switches that govern the other benefits.
--
-- Applied by `npm run db:migrate` after `0058_benefit_settings.sql`, whose
-- `"BenefitSetting"` row every function here reads.
--
-- It also re-declares six functions from earlier files, each with **one** thing
-- added:
--
--   issue_discovery_credits    0050 body + the Discovery Credit switch
--   welcome_offer              0035 body + the signup-benefit switch
--   claim_welcome              0030 body + the signup-benefit switch
--   claim_subscriber_offer     0035 body + the signup-benefit switch
--   sync_clerk_user            0024 body + award_signup_points()
--   settle_order_payment       0026 body + award_purchase_points()
--   set_order_payment_status   0050 body + award and reversal
--
-- Diff each against the file named beside it before trusting this one.
-- `0040_discount_refusal_detail.sql` re-declared `place_order()` from the wrong
-- ancestor and silently dropped promotion pricing for four migrations; that is
-- what copying from the wrong body costs, and it is why each re-declaration
-- below names its source.
--
-- ── Why a ledger and not a balance ──────────────────────────
--
-- The same reason `0026_discovery_credits.sql` gives, and it is worth repeating
-- because points are the more tempting of the two to store as a number: a
-- balance column and a transaction list are two records of one fact, and the day
-- they disagree there is no way to tell which is lying. `points_transactions` is
-- append-only and signed; `reward_balances` sums it. A correction is a new row.
--
-- ── Why the guards are unique indexes ───────────────────────
--
-- Stripe redelivers events, the desk marks an order paid twice, and a customer
-- double-submits a review. Every one of those is an ordinary occurrence, not an
-- exceptional one. A check-then-insert has a gap between the check and the
-- insert; a partial unique index with `on conflict do nothing` does not. Same
-- decision, and the same sentence, as `customer_credit_unit_idx`.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- These rows name a customer and something worth money. Same posture as
-- `"Order"`, `customer_credits` and `discounts`: RLS on, **no policy of any
-- kind**, no grant to the public roles, `execute` revoked on every function.
-- Nothing reaches them without SUPABASE_SECRET_KEY.
--
-- Identity is Clerk's, so `clerkUserId` carries no foreign key — the same
-- decision, for the same reasons, as `"Order"."clerkUserId"` in 0015 and
-- `customer_credits."clerkUserId"` in 0026.

-- ── Enums ───────────────────────────────────────────────────

-- Every movement the policy names. `REFERRAL` has no writer yet and is
-- deliberately present: a later referral feature should write rows, not migrate
-- a type that is in use.
do $$ begin
  create type public."PointsSource" as enum (
    'PURCHASE',
    'SIGNUP',
    'FIRST_PURCHASE',
    'REVIEW',
    'REFERRAL',
    'ADMIN_ADJUSTMENT',
    'REFUND_REVERSAL',
    'REDEMPTION',
    'EXPIRATION'
  );
exception when duplicate_object then null; end $$;

-- ── points_transactions ─────────────────────────────────────
--
-- Append-only. There is no update path and no delete path anywhere in this
-- file: a mistake is corrected by an `ADMIN_ADJUSTMENT` row that says so, which
-- leaves the history intact and answerable.

create table if not exists public.points_transactions (
  id              text primary key default gen_random_uuid()::text,

  "clerkUserId"   text not null,

  -- **Signed**, and never zero. Earning adds, redeeming and expiring subtract,
  -- an adjustment does either. The balance is the sum, so the sign carries the
  -- arithmetic rather than leaving a reader to infer it from `source`.
  amount          int not null check (amount <> 0),

  source          public."PointsSource" not null,

  -- The order that earned, spent or gave these back. Null for signup, review,
  -- expiry and manual adjustments.
  --
  -- `on delete set null` rather than cascade: deleting an order must never
  -- delete the ledger rows describing what a customer was given for it.
  "orderId"       text references public."Order"(id) on delete set null,

  /*
   * The non-order thing a row is about. Today that is a `REVIEW`'s product
   * slug — not the comment id, deliberately: the rule is one award per product
   * a customer reviews, so posting a second comment on the same bottle earns
   * nothing. Keyed on the slug is what makes that true in the index rather than
   * in a check somebody has to remember.
   */
  "referenceId"   text check (char_length("referenceId") <= 200),

  note            text check (char_length(note) <= 500),

  -- The admin behind an `ADMIN_ADJUSTMENT`. Null for everything the system did.
  actor           text check (char_length(actor) <= 200),

  "occurredAt"    timestamptz not null default now(),

  /*
   * When these particular points lapse. Null never expires.
   *
   * Per row rather than per customer, so a balance lapses in the order it was
   * earned instead of all at once on an anniversary. Only ever set on a positive
   * row — there is nothing to expire about a redemption.
   */
  "expiresAt"     timestamptz
);

-- ── The idempotency guards ──────────────────────────────────
--
-- Three partial unique indexes, and between them they are the whole of "no
-- duplicate points can be created".
--
-- One row per source per order. A redelivered Stripe event, a desk that marks
-- an order paid twice, a refund applied from both the payment control and the
-- fulfilment control — all of them insert nothing the second time.
create unique index if not exists points_order_source_idx
  on public.points_transactions (source, "orderId")
  where "orderId" is not null;

-- Signing up is once per account, forever.
create unique index if not exists points_signup_idx
  on public.points_transactions ("clerkUserId", source)
  where source = 'SIGNUP';

-- Reviewing is once per product per customer.
create unique index if not exists points_review_idx
  on public.points_transactions ("clerkUserId", "referenceId")
  where source = 'REVIEW' and "referenceId" is not null;

create index if not exists points_owner_idx
  on public.points_transactions ("clerkUserId", "occurredAt" desc);

-- The expiry sweep's query, and only it: positive rows that could still lapse.
create index if not exists points_expiry_idx
  on public.points_transactions ("expiresAt")
  where "expiresAt" is not null and amount > 0;

-- ── Order columns ───────────────────────────────────────────
--
-- What a redemption took off this order, in both units. The count is the fact
-- the ledger records; the money is what the customer was charged, and neither
-- can be derived from the other once the conversion rate is edited — which is
-- exactly why both are snapshotted here rather than recomputed later, the same
-- reasoning as `"OrderItem"."priceInCents"`.

alter table public."Order"
  add column if not exists "pointsRedeemed" int not null default 0
    check ("pointsRedeemed" >= 0),
  add column if not exists "pointsInCents" int not null default 0
    check ("pointsInCents" >= 0);

-- ── reward_balances ─────────────────────────────────────────
--
-- The single definition of what a customer holds, so the account panel, the
-- dashboard and the redemption guard cannot disagree about it.
--
-- Each lifetime figure counts one thing and says which. `lifetimeEarned` is
-- deliberately the *earning* sources only: a restored redemption is money coming
-- back, not money earned, and adding it here would make a refund look like a
-- reward.

create or replace view public.reward_balances as
select
  t."clerkUserId",
  coalesce(sum(t.amount), 0)::int as "balancePoints",
  coalesce(sum(t.amount) filter (
    where t.source in ('PURCHASE', 'SIGNUP', 'FIRST_PURCHASE', 'REVIEW', 'REFERRAL')
  ), 0)::int as "lifetimeEarned",
  coalesce(-sum(t.amount) filter (where t.source = 'REDEMPTION'), 0)::int
    as "lifetimeRedeemed",
  coalesce(-sum(t.amount) filter (where t.source = 'EXPIRATION'), 0)::int
    as "expiredPoints",
  coalesce(sum(t.amount) filter (where t.source = 'ADMIN_ADJUSTMENT'), 0)::int
    as "adjustedPoints",
  max(t."occurredAt") as "lastMovementAt"
from public.points_transactions t
group by t."clerkUserId";

-- ── points_settings ─────────────────────────────────────────
--
-- One reader of `"BenefitSetting"`, so no function below writes its own `select`
-- and none can be left behind when a column is added.

create or replace function public.points_settings()
returns public."BenefitSetting"
language sql
stable
security definer
set search_path = public
as $$
  select * from public."BenefitSetting" where id = 'default';
$$;

-- ── points_expiry ───────────────────────────────────────────
--
-- When points earned now would lapse. Null when the house does not expire them.

create or replace function public.points_expiry()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case
           when s."pointsExpiryMonths" is null then null
           else now() + make_interval(months => s."pointsExpiryMonths")
         end
    from public.points_settings() s;
$$;

-- ── award_purchase_points ───────────────────────────────────
--
-- Called the moment an order's money is real — from `settle_order_payment()`
-- for a card and from `set_order_payment_status()` for the desk, immediately
-- beside the `issue_discovery_credits()` call that already lives at both doors.
-- The trigger is the payment *fact*, never the method.
--
-- ── The amount points are earned on ─────────────────────────
--
-- `"totalInCents" - "shipInCents"`, and that single subtraction is the whole of
-- the policy. Because
--
--   total = subtotal + ship − promotion − offer − discount − points − credit
--
-- the difference is exactly the merchandise the customer actually paid for. It
-- satisfies three separate rules at once, which is why it is one expression and
-- not three:
--
--   · points are earned on the amount paid, not the list price;
--   · a Discovery Credit spent on the order reduces what is earned;
--   · points cannot be earned from the points portion of an order.
--
-- Delivery earns nothing. The house does not pay itself points for a courier.
--
-- Returns how many points it actually awarded, so the caller can log something
-- true.

create or replace function public.award_purchase_points(order_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s          public."BenefitSetting";
  v_order    record;
  v_eligible int;
  v_disc     int := 0;
  v_points   int := 0;
  v_awarded  int := 0;
  v_expires  timestamptz := public.points_expiry();
begin
  select * into s from public.points_settings();

  if s is null or not s."rewardsEnabled" then
    return 0;
  end if;

  select nullif(o."clerkUserId", '') as owner,
         o."totalInCents",
         o."shipInCents",
         o."subtotalInCents",
         o.status,
         o."placedAt"
    into v_order
    from public."Order" o
   where o.id = order_id;

  if not found then
    return 0;
  end if;

  -- A walk-in has no account, and points nobody can ever spend are not points.
  -- The desk sells across the counter, so this is an ordinary outcome.
  if v_order.owner is null then
    return 0;
  end if;

  -- A refunded or cancelled order does not earn. Reachable when the desk marks
  -- a cancelled order paid to close the till.
  if v_order.status in ('CANCELLED', 'REFUNDED') then
    return 0;
  end if;

  v_eligible := greatest(0, v_order."totalInCents" - v_order."shipInCents");

  /*
   * The Discovery Set exclusion, when the house has switched it off.
   *
   * Scaled rather than subtracted at list price: every reduction on this order
   * came off the basket as a whole, so a Set's *share of what was paid* is its
   * share of the merchandise. Subtracting the list price instead would let a
   * heavily discounted basket containing a Set earn nothing at all.
   */
  if not s."earnOnDiscoverySets" and v_order."subtotalInCents" > 0 then
    select coalesce(sum(i.quantity * i."priceInCents"), 0)::int
      into v_disc
      from public."OrderItem" i
      join public."Product" p on p.slug = i."productSlug"
      join public."Collection" col on col.slug = p."collectionSlug"
     where i."orderId" = order_id
       and col.kind = 'DISCOVERY';

    v_eligible := greatest(
      0,
      v_eligible - (v_disc::bigint * v_eligible / v_order."subtotalInCents")::int
    );
  end if;

  -- Floored, matching `resolve_discount()`'s rounding: the house never gives
  -- away a point it did not mean to.
  v_points := (v_eligible::bigint * s."earnPoints" / s."earnSpendInCents")::int;

  if v_points > 0 then
    insert into public.points_transactions
      ("clerkUserId", amount, source, "orderId", note, "expiresAt")
    values (
      v_order.owner, v_points, 'PURCHASE', order_id,
      'Earned on order', v_expires
    )
    on conflict (source, "orderId") where "orderId" is not null do nothing;

    if found then
      v_awarded := v_awarded + v_points;
    end if;
  end if;

  -- ── The first-purchase bonus ──────────────────────────────
  --
  -- Judged against orders placed *earlier* rather than against a count, so the
  -- answer does not change when this order is later refunded and does not
  -- depend on the order in which two settlements arrive.
  if s."firstPurchaseEnabled" then
    if not exists (
      select 1
        from public."Order" o
       where nullif(o."clerkUserId", '') = v_order.owner
         and o.id <> order_id
         and o."paymentStatus" = 'PAID'
         and o."placedAt" < v_order."placedAt"
    ) then
      insert into public.points_transactions
        ("clerkUserId", amount, source, "orderId", note, "expiresAt")
      values (
        v_order.owner, s."firstPurchasePoints", 'FIRST_PURCHASE', order_id,
        'First purchase', v_expires
      )
      on conflict (source, "orderId") where "orderId" is not null do nothing;

      if found then
        v_awarded := v_awarded + s."firstPurchasePoints";
      end if;
    end if;
  end if;

  return v_awarded;
end;
$$;

-- ── award_signup_points ─────────────────────────────────────
--
-- Called from `sync_clerk_user()` when it creates a row rather than updates one.
--
-- Gated on the **mode**, not on a boolean of its own. "Is the welcome discount
-- on?" and "does signing up earn points?" as two switches admits a state the
-- house has never wanted — both at once — and the popup has no way to say it.

create or replace function public.award_signup_points(clerk_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s public."BenefitSetting";
begin
  if nullif(clerk_id, '') is null then
    return 0;
  end if;

  select * into s from public.points_settings();

  if s is null
     or not s."rewardsEnabled"
     or s."signupBenefit" <> 'REWARD_POINTS' then
    return 0;
  end if;

  insert into public.points_transactions
    ("clerkUserId", amount, source, note, "expiresAt")
  values (
    clerk_id, s."signupPoints", 'SIGNUP',
    'Welcome to KHEM', public.points_expiry()
  )
  on conflict ("clerkUserId", source) where source = 'SIGNUP' do nothing;

  return case when found then s."signupPoints" else 0 end;
end;
$$;

-- ── award_review_points ─────────────────────────────────────
--
-- A trigger on `product_comment` rather than a call in the Server Action,
-- because a comment can also become eligible *later*: a row hidden by
-- moderation and republished has earned its points at the moment it was
-- published, and an action that fires only on insert would miss it.
--
-- Once per product per customer, enforced by `points_review_idx`. A second
-- comment on the same bottle earns nothing, which is what stops the rule being
-- farmable without anybody having to remember a check.

create or replace function public.award_review_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public."BenefitSetting";
begin
  if new.author_clerk_id is null
     or not new.is_published
     or new.rating is null then
    return new;
  end if;

  select * into s from public.points_settings();

  if s is null or not s."rewardsEnabled" or not s."reviewEnabled" then
    return new;
  end if;

  insert into public.points_transactions
    ("clerkUserId", amount, source, "referenceId", note, "expiresAt")
  values (
    new.author_clerk_id, s."reviewPoints", 'REVIEW', new.product_slug,
    'Review published', public.points_expiry()
  )
  on conflict ("clerkUserId", "referenceId")
    where source = 'REVIEW' and "referenceId" is not null
    do nothing;

  return new;
end;
$$;

drop trigger if exists product_comment_awards_points on public.product_comment;

create trigger product_comment_awards_points
  after insert or update of is_published, rating on public.product_comment
  for each row
  execute function public.award_review_points();

-- ── resolve_points_redemption ───────────────────────────────
--
-- What a redemption would be worth, and whether it is allowed at all.
--
-- One function for both the preview and the authority, exactly as
-- `resolve_discount()` is one function for both: a TypeScript re-implementation
-- of these rules would be a second definition of what a customer is owed, and it
-- would agree with the first only until somebody edited one of them.
--
-- The preview calls it without a lock and it binds nothing. `place_order()`
-- calls it inside the writing transaction, having already taken the advisory
-- lock that serialises two checkouts spending one balance.
--
-- Takes `{ clerkUserId, points, remainingInCents }` and answers
-- `{ ok, points, amountInCents, reason, reasonCode }`.

create or replace function public.resolve_points_redemption(payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s          public."BenefitSetting";
  v_owner    text := nullif(payload->>'clerkUserId', '');
  v_asked    int  := coalesce((payload->>'points')::int, 0);
  v_remain   int  := greatest(0, coalesce((payload->>'remainingInCents')::int, 0));
  v_balance  int  := 0;
  v_points   int;
  v_value    int;
  v_by_value int;
begin
  select * into s from public.points_settings();

  if s is null or not s."rewardsEnabled" then
    return jsonb_build_object(
      'ok', false, 'reasonCode', 'DISABLED',
      'reason', 'KHEM Rewards is not running at the moment.');
  end if;

  if v_owner is null then
    return jsonb_build_object(
      'ok', false, 'reasonCode', 'NOT_SIGNED_IN',
      'reason', 'KHEM Points belong to an account. Sign in to redeem them.');
  end if;

  if v_asked <= 0 then
    return jsonb_build_object(
      'ok', false, 'reasonCode', 'INVALID',
      'reason', 'Choose how many points to redeem.');
  end if;

  select coalesce(b."balancePoints", 0)
    into v_balance
    from public.reward_balances b
   where b."clerkUserId" = v_owner;

  if v_balance < s."minRedeemPoints" then
    return jsonb_build_object(
      'ok', false, 'reasonCode', 'BELOW_MINIMUM',
      'reason', format('Redemption starts at %s KHEM Points.', s."minRedeemPoints"));
  end if;

  if v_asked > v_balance then
    return jsonb_build_object(
      'ok', false, 'reasonCode', 'INSUFFICIENT',
      'reason', format('You hold %s KHEM Points.', v_balance));
  end if;

  if v_remain <= 0 then
    return jsonb_build_object(
      'ok', false, 'reasonCode', 'NOTHING_TO_REDUCE',
      'reason', 'There is nothing left on this order for points to reduce.');
  end if;

  /*
   * The cap, computed as a number of **points** rather than as a ceiling on the
   * value. Capping the value alone would consume the points a customer asked
   * for and hand back less than they are worth; this way a balance larger than
   * the order simply spends less of itself.
   */
  v_by_value := (v_remain::bigint * s."redeemPoints" / s."redeemValueInCents")::int;

  v_points := least(v_asked, v_balance, v_by_value);

  if s."maxPointsPerOrder" is not null then
    v_points := least(v_points, s."maxPointsPerOrder");
  end if;

  if v_points < s."minRedeemPoints" then
    return jsonb_build_object(
      'ok', false, 'reasonCode', 'BELOW_MINIMUM',
      'reason', format('Redemption starts at %s KHEM Points.', s."minRedeemPoints"));
  end if;

  v_value := (v_points::bigint * s."redeemValueInCents" / s."redeemPoints")::int;

  if v_value <= 0 then
    return jsonb_build_object(
      'ok', false, 'reasonCode', 'INVALID',
      'reason', 'That many points are not worth anything yet.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'points', v_points,
    'amountInCents', v_value
  );
end;
$$;

-- ── reverse_purchase_points ─────────────────────────────────
--
-- A refund undoes both halves at once: the points this order **earned** are
-- clawed back, and the points it **spent** are given back.
--
-- One row, whose amount is the net of the two, because `points_order_source_idx`
-- permits exactly one `REFUND_REVERSAL` per order — which is also what makes
-- this idempotent under a refund applied from both the payment control and the
-- fulfilment control.
--
-- A net of zero writes nothing, and that is correct arithmetic rather than a
-- missed case: a customer who earned 100 on an order and spent 100 on it is
-- owed neither when it is refunded.
--
-- The result may take a balance below zero — somebody who earned points and
-- spent them elsewhere before refunding. That is the one case the policy allows
-- a negative balance for: an explicit correction, recorded as one.

create or replace function public.reverse_purchase_points(order_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner  text;
  v_earned int := 0;
  v_spent  int := 0;
  v_net    int;
begin
  select nullif(o."clerkUserId", '') into v_owner
    from public."Order" o
   where o.id = order_id;

  if v_owner is null then
    return 0;
  end if;

  -- Already reversed — a redelivered webhook, or CANCELLED followed by
  -- REFUNDED on the same order.
  if exists (
    select 1 from public.points_transactions t
     where t."orderId" = order_id
       and t.source = 'REFUND_REVERSAL'
  ) then
    return 0;
  end if;

  select coalesce(sum(t.amount) filter (
           where t.source in ('PURCHASE', 'FIRST_PURCHASE')), 0)::int,
         coalesce(-sum(t.amount) filter (where t.source = 'REDEMPTION'), 0)::int
    into v_earned, v_spent
    from public.points_transactions t
   where t."orderId" = order_id;

  v_net := v_spent - v_earned;

  if v_net = 0 then
    return 0;
  end if;

  insert into public.points_transactions
    ("clerkUserId", amount, source, "orderId", note, "expiresAt")
  values (
    v_owner, v_net, 'REFUND_REVERSAL', order_id,
    'Order refunded',
    -- Restored points inherit a fresh window rather than the one they were
    -- earned under: the original lot's row still stands beside this one, and
    -- dating this to the past would expire it the moment it was written.
    case when v_net > 0 then public.points_expiry() else null end
  )
  on conflict (source, "orderId") where "orderId" is not null do nothing;

  return case when found then 1 else 0 end;
end;
$$;

-- ── expire_points ───────────────────────────────────────────
--
-- The nightly sweep, behind `/api/cron/expire-credits` — the route that already
-- exists to close a window nothing else in the flow of the site would notice.
--
-- ── Oldest points are spent first, without a lot table ──────
--
-- A customer's rows are lots, and a redemption consumes them in the order they
-- were earned. Rather than track which lot paid for which order — a second
-- ledger, kept in step with the first — the arithmetic derives it:
--
--   lapsed   = everything positive whose window has closed
--   consumed = everything negative, redemptions and earlier expiries alike
--
-- What is still expirable is `lapsed − consumed`, floored at zero and capped at
-- the balance. Spending therefore eats the oldest lots first by construction,
-- and a lot already expired cannot be expired twice because its own `EXPIRATION`
-- row is part of `consumed`.
--
-- Idempotent for the same reason: after this writes, `consumed` has grown by
-- exactly the amount written, so a second run computes zero.

create or replace function public.expire_points()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     record;
  v_expired int := 0;
begin
  for v_row in
    select t."clerkUserId",
           coalesce(sum(t.amount), 0)::int as balance,
           coalesce(sum(t.amount) filter (
             where t.amount > 0
               and t."expiresAt" is not null
               and t."expiresAt" <= now()), 0)::int as lapsed,
           coalesce(-sum(t.amount) filter (where t.amount < 0), 0)::int as consumed
      from public.points_transactions t
     group by t."clerkUserId"
    having coalesce(sum(t.amount), 0) > 0
  loop
    declare
      v_amount int := least(v_row.balance, greatest(0, v_row.lapsed - v_row.consumed));
    begin
      if v_amount > 0 then
        insert into public.points_transactions
          ("clerkUserId", amount, source, note)
        values (v_row."clerkUserId", -v_amount, 'EXPIRATION', 'Points window closed');

        v_expired := v_expired + 1;
      end if;
    end;
  end loop;

  return v_expired;
end;
$$;

-- ── adjust_points ───────────────────────────────────────────
--
-- The manual lever, shaped exactly like `adjust_credit()` in 0026: always a new
-- row, never an edit, a reason required, and the administrator recorded.
--
-- ── The lock ────────────────────────────────────────────────
--
-- There is no instrument row to lock — a points balance is a customer, not an
-- object — so the serialiser is an advisory lock on the customer id, held to the
-- end of the transaction. It is what makes the balance read immediately after it
-- stable, which is the same guarantee `for update` on `customer_credits` buys
-- `adjust_credit()`. **Redemption takes the same lock**, so an adjustment and a
-- checkout cannot both read the same balance and both spend it.

create or replace function public.adjust_points(
  clerk_id text,
  amount   int,
  note     text,
  actor    text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int := 0;
begin
  if nullif(clerk_id, '') is null then
    raise exception 'An adjustment needs a customer.'
      using errcode = 'check_violation';
  end if;

  if amount = 0 then
    raise exception 'An adjustment of zero records nothing.'
      using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext('khem.points:' || clerk_id));

  select coalesce(b."balancePoints", 0)
    into v_balance
    from public.reward_balances b
   where b."clerkUserId" = clerk_id;

  if v_balance + amount < 0 then
    raise exception 'That would leave the balance at %, below zero.',
      v_balance + amount
      using errcode = 'check_violation';
  end if;

  insert into public.points_transactions
    ("clerkUserId", amount, source, note, actor, "expiresAt")
  values (
    clerk_id, amount, 'ADMIN_ADJUSTMENT', nullif(btrim(note), ''), actor,
    case when amount > 0 then public.points_expiry() else null end
  );

  return v_balance + amount;
end;
$$;

-- ── issue_discovery_credits ─────────────────────────────────
--
-- The **0050 body**, with one guard added at the top: the Discovery Credit
-- switch. Everything else is verbatim — one credit per unit at that line's
-- price, idempotent through `customer_credit_unit_idx`, and the delivered-order
-- activation 0050 added.
--
-- The switch stops **issuance**. It does not touch redemption, and no function
-- in this file refuses a credit somebody already holds: a credit is a promise
-- the house has already made, and withdrawing it because a switch moved would be
-- the same harm as deleting it.

create or replace function public.issue_discovery_credits(order_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created int := 0;
  v_owner   text;
  v_status  public."OrderStatus";
  v_on      boolean;
begin
  select s."discoveryCreditEnabled" into v_on from public.points_settings() s;

  -- Absent row or switched off: no new credit is created. Existing ones are
  -- untouched, and the customer-facing messaging disappears in the storefront
  -- rather than here.
  if not coalesce(v_on, true) then
    return 0;
  end if;

  select nullif(o."clerkUserId", ''), o.status
    into v_owner, v_status
    from public."Order" o
   where o.id = order_id;

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
    insert into public.credit_transactions ("creditId", kind, "amountInCents", note)
    select i.id, 'EARNED', i."amountInCents", 'Discovery Set purchase'
    from issued i
    returning 1
  )
  select count(*)::int into v_created from logged;

  if v_status = 'DELIVERED' then
    perform public.activate_discovery_credits(order_id);
  end if;

  return v_created;
end;
$$;

-- ── welcome_offer ───────────────────────────────────────────
--
-- The **0035 body**, with the signup-benefit mode added to the window test.
--
-- Gating here rather than in the popup is what makes "no stale 20% messaging
-- anywhere" structural: this function is what the root layout reads on every
-- page and what the dashboard echoes, and a component cannot print a percentage
-- it is never given.
--
-- Keeps its `execute` grant to `anon` — the exception 0035 documents at length,
-- and the reason is unchanged: it returns two public integers to a prerendered
-- layout, and the alternative was a secret-key client in the render path of
-- every static page.

create or replace function public.welcome_offer()
returns table (kind public."DiscountKind", value int)
language sql
stable
security definer
set search_path = public
as $$
  select d.kind, d.value
    from public.discounts d
   where d."isWelcome"
     and d."isActive"
     and (d."startsAt" is null or d."startsAt" <= now())
     and (d."endsAt"   is null or d."endsAt"   >  now())
     and exists (
       select 1 from public."BenefitSetting" s
        where s.id = 'default' and s."signupBenefit" = 'WELCOME_DISCOUNT'
     );
$$;

-- ── claim_subscriber_offer ──────────────────────────────────
--
-- The **0035 body**, with the same gate. A mode other than `WELCOME_DISCOUNT`
-- issues no grant and returns no code, so the popup's success panel and the
-- subscribe confirmation email both fall to the branch they already have for a
-- house running no campaign.
--
-- Grants already written are deliberately not withdrawn. They are real
-- entitlements, they appear in a customer's account, and taking one back because
-- a switch moved is the wrong half to undo — the argument `release_welcome()`
-- makes about an undelivered letter, applied to a setting.

create or replace function public.claim_subscriber_offer(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email    text := lower(btrim(nullif(payload->>'email', '')));
  v_clerk    text := nullif(payload->>'clerkUserId', '');
  v_discount record;
  v_expires  timestamptz;
  v_issued   boolean := false;
  v_code     text;
  v_mode     public."SignupBenefit";
begin
  if v_email is null then
    return jsonb_build_object('code', null, 'expiresAt', null, 'issued', false);
  end if;

  select s."signupBenefit" into v_mode from public.points_settings() s;

  if coalesce(v_mode, 'WELCOME_DISCOUNT') <> 'WELCOME_DISCOUNT' then
    return jsonb_build_object('code', null, 'expiresAt', null, 'issued', false);
  end if;

  select * into v_discount
    from public.discounts
   where "isWelcome"
     and "isActive"
     and ("startsAt" is null or "startsAt" <= now())
     and ("endsAt" is null or "endsAt" > now());

  if not found then
    return jsonb_build_object('code', null, 'expiresAt', null, 'issued', false);
  end if;

  v_expires := least(
    now() + interval '60 days',
    coalesce(v_discount."endsAt", now() + interval '60 days')
  );

  insert into public.discount_grants
    ("discountId", email, "clerkUserId", "expiresAt")
  values (v_discount.id, v_email, v_clerk, v_expires)
  on conflict ("discountId", email) do nothing;

  v_issued := found;

  select g."expiresAt" into v_expires
    from public.discount_grants g
   where g."discountId" = v_discount.id
     and g.email = v_email
     and g."usedAt" is null;

  if found then
    v_code := v_discount.code;
  else
    v_expires := null;
  end if;

  return jsonb_build_object(
    'code', v_code,
    'expiresAt', v_expires,
    'issued', v_issued
  );
end;
$$;

-- ── claim_welcome ───────────────────────────────────────────
--
-- The **0030 body**, with the same gate around the voucher half only.
--
-- The *claim* still happens in every mode: `"welcomedAt"` is what stops a second
-- letter being sent, and skipping the stamp would mean a house that switched the
-- discount off started welcoming everybody twice. Only the grant and the code
-- are withheld — and `claim_welcome()`'s own header already calls a null code
-- "a letter with no voucher block, not a failure".

create or replace function public.claim_welcome(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clerk_id text := nullif(payload->>'clerkId', '');
  v_user     record;
  v_discount record;
  v_expires  timestamptz;
  v_code     text;
  v_mode     public."SignupBenefit";
begin
  if v_clerk_id is null then
    return jsonb_build_object('claimed', false);
  end if;

  update public."User"
     set "welcomedAt" = now(),
         "updatedAt"  = now()
   where "clerkId" = v_clerk_id
     and "welcomedAt" is null
     and "deletedAt" is null
  returning email, "firstName" into v_user;

  if not found then
    return jsonb_build_object('claimed', false);
  end if;

  select s."signupBenefit" into v_mode from public.points_settings() s;

  if coalesce(v_mode, 'WELCOME_DISCOUNT') = 'WELCOME_DISCOUNT' then
    select * into v_discount
      from public.discounts
     where "isWelcome"
       and "isActive"
       and ("startsAt" is null or "startsAt" <= now())
       and ("endsAt" is null or "endsAt" > now());

    if found then
      v_expires := least(
        now() + interval '60 days',
        coalesce(v_discount."endsAt", now() + interval '60 days')
      );

      insert into public.discount_grants
        ("discountId", email, "clerkUserId", "expiresAt")
      values (v_discount.id, lower(v_user.email), v_clerk_id, v_expires)
      on conflict ("discountId", email) do nothing;

      if exists (
        select 1
          from public.discount_grants g
         where g."discountId" = v_discount.id
           and g.email = lower(v_user.email)
           and g."usedAt" is null
      ) then
        v_code := v_discount.code;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'claimed', true,
    'email', v_user.email,
    'firstName', v_user."firstName",
    'code', v_code,
    'expiresAt', v_expires
  );
end;
$$;

-- ── sync_clerk_user ─────────────────────────────────────────
--
-- The **0024 body**, with one call added in the branch that creates a row.
--
-- Inside the insert branch rather than after it, so a returning customer whose
-- profile is re-synced on every sign-in cannot earn a second signup bonus. The
-- unique index would refuse it anyway; this means the attempt is never made.

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
      case when v_opt then now() else null end
    )
    returning id into v_id;

    -- A new account. Awards nothing unless the house is running Rewards *and*
    -- has chosen points as the signup benefit.
    perform public.award_signup_points(v_clerk);

    return v_id;
  end if;

  update public."User"
     set email              = v_email,
         "firstName"        = nullif(payload->>'firstName', ''),
         "lastName"         = nullif(payload->>'lastName', ''),
         phone              = nullif(payload->>'phone', ''),
         "marketingOptIn"   = v_opt,
         "marketingOptInAt" = case
                                when v_opt is distinct from v_prev then now()
                                else "marketingOptInAt"
                              end,
         "deletedAt"        = null,
         "updatedAt"        = now()
   where id = v_id;

  return v_id;
end;
$$;

-- ── settle_order_payment ────────────────────────────────────
--
-- The **0026 body**, plus one `perform`. It runs inside the same transaction as
-- the payment it follows, so an order cannot be paid without its points
-- existing — the reasoning that keeps stock movement inside `place_order()`.
--
-- After the `return false` guard, so a redelivered Stripe event does no work at
-- all rather than relying on the ledger's index to absorb it twice.

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

  -- And the order has earned its points, on what was actually paid.
  perform public.award_purchase_points(order_id);

  return true;
end;
$$;

-- ── set_order_payment_status ────────────────────────────────
--
-- The **0050 body**, with points added to both branches that move money: PAID
-- earns, REFUNDED reverses. The credit calls either side of them are 0050's and
-- are unchanged.

create or replace function public.set_order_payment_status(
  order_id    text,
  next_status public."PaymentStatus"
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public."PaymentStatus";
begin
  select "paymentStatus"
    into v_current
    from public."Order"
   where id = order_id
     for update;

  if not found then
    raise exception 'No order with the id %.', order_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_current = next_status then
    return false;
  end if;

  if v_current = 'PAID' and next_status <> 'REFUNDED' then
    raise exception
      'Order % has been paid. Refund it to reverse the payment — it cannot be marked % again.',
      order_id, lower(next_status::text)
      using errcode = 'check_violation';
  end if;

  if next_status = 'PAID' then
    update public."Order"
       set "paymentStatus" = 'PAID',
           "paidAt"        = coalesce("paidAt", now()),
           "updatedAt"     = now()
     where id = order_id;

    perform public.issue_discovery_credits(order_id);
    perform public.award_purchase_points(order_id);

    return true;
  end if;

  if next_status = 'REFUNDED' then
    update public."Order"
       set "paymentStatus" = 'REFUNDED',
           "updatedAt"     = now()
     where id = order_id;

    perform public.cancel_discovery_credits(order_id);
    perform public.reverse_credit_redemption(order_id);
    perform public.reverse_purchase_points(order_id);

    return true;
  end if;

  update public."Order"
     set "paymentStatus" = next_status,
         "updatedAt"     = now()
   where id = order_id;

  return true;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────
--
-- `0006_privileges.sql` runs before this file and its altered defaults grant
-- `select` on new tables to the public roles. Taken back explicitly, exactly as
-- 0015, 0024, 0026 and 0028 do, because these rows name a customer and something
-- worth money.
--
-- The `revoke`s on the re-declared functions are restated because
-- `create or replace` restores the default `execute` grant to `public` — and
-- `welcome_offer()`'s deliberate grant to `anon` has to be restored with them,
-- for the reason 0035 gives.

alter table public.points_transactions enable row level security;

revoke all on public.points_transactions from public, anon, authenticated;
revoke all on public.reward_balances    from public, anon, authenticated;

revoke all on function public.points_settings()                      from public, anon, authenticated;
revoke all on function public.points_expiry()                        from public, anon, authenticated;
revoke all on function public.award_purchase_points(text)            from public, anon, authenticated;
revoke all on function public.award_signup_points(text)              from public, anon, authenticated;
revoke all on function public.award_review_points()                  from public, anon, authenticated;
revoke all on function public.resolve_points_redemption(jsonb)       from public, anon, authenticated;
revoke all on function public.reverse_purchase_points(text)          from public, anon, authenticated;
revoke all on function public.expire_points()                        from public, anon, authenticated;
revoke all on function public.adjust_points(text, int, text, text)   from public, anon, authenticated;
revoke all on function public.issue_discovery_credits(text)          from public, anon, authenticated;
revoke all on function public.claim_subscriber_offer(jsonb)          from public, anon, authenticated;
revoke all on function public.claim_welcome(jsonb)                   from public, anon, authenticated;
revoke all on function public.sync_clerk_user(jsonb)                 from public, anon, authenticated;
revoke all on function public.settle_order_payment(text, text)       from public, anon, authenticated;
revoke all on function public.set_order_payment_status(text, public."PaymentStatus")
  from public, anon, authenticated;

revoke all  on function public.welcome_offer() from public;
grant execute on function public.welcome_offer() to anon, authenticated;
