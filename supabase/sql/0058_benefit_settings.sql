-- KHEM — the one row that says what the house currently offers.
--
-- Applied by `npm run db:migrate` after `0057_campaign_dispatch_lease.sql`, and
-- before `0059_rewards.sql`, `0060_offers.sql` and `0061_benefit_resolution.sql`,
-- all three of which read it.
--
-- ── Why a new singleton and not `"MarketingSetting"` ────────
--
-- `"MarketingSetting"` is campaign chrome — the announcement bar's cadence, the
-- popup's delay, the popup's photograph. Its own header says so, and says why it
-- is deliberately not `"BoutiqueSetting"`: those rows change on a different
-- rhythm and folding them together means the contact page re-renders because
-- somebody edited a popup delay.
--
-- The same argument separates this file from that one. Nothing here is chrome.
-- Every column decides money: whether a Discovery Set earns a credit, what a
-- pound is worth in points, what a point is worth in pounds, and which benefits
-- may be taken together. A switch that decides what the house owes does not
-- belong in the table that decides how fast a marquee scrolls.
--
-- One row rather than two, though. A second singleton for Rewards and a third
-- for the signup benefit would be three rows that all answer "what does the
-- house currently offer", and the day they disagree there is no way to tell
-- which is lying — the argument `0026` makes about a balance column beside a
-- ledger, applied to configuration.
--
-- ── The defaults are today's behaviour ──────────────────────
--
-- Applying this file changes nothing that is live:
--
--   discoveryCreditEnabled = true            — credits are issued today
--   rewardsEnabled         = false           — there are no points today
--   signupBenefit          = WELCOME_DISCOUNT — the welcome offer runs today
--   every stacking switch  = false           — nothing stacks today
--
-- A migration that quietly started or stopped paying customers would be a
-- migration nobody could safely apply.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Public **read**, like `"MarketingSetting"` and for the same reason: the
-- storefront prints these numbers. The popup says what signing up is worth, the
-- Discovery banner says whether a Set earns a credit, and the account panel says
-- what a point converts to. None of it names a person, and all of it is already
-- visible to anybody who reads the page.
--
-- Every **write** is service-role, which bypasses RLS. There is no insert,
-- update or delete policy here and none should be added.

-- ── Enums ───────────────────────────────────────────────────

/*
 * What a new subscriber or a new account is offered.
 *
 * Three states rather than two switches. "Is the welcome discount on?" and "does
 * signing up earn points?" as separate booleans admits a fourth state — both at
 * once — that the house has never wanted and that the popup has no way to say.
 * One column, three members, and the popup renders exactly one branch.
 */
do $$ begin
  create type public."SignupBenefit" as enum (
    -- The `discounts."isWelcome"` campaign, as it runs today.
    'WELCOME_DISCOUNT',
    -- KHEM Points instead. No grant is issued; `signupPoints` is awarded.
    'REWARD_POINTS',
    -- Nothing is promised. The popup still invites people to the list.
    'NONE'
  );
exception when duplicate_object then null; end $$;

-- ── BenefitSetting ──────────────────────────────────────────

create table if not exists public."BenefitSetting" (
  id text primary key default 'default' check (id = 'default'),

  -- ── Discovery Credit ──
  --
  -- The permanent switch. No dates, no targeting, no audience: the credit is a
  -- conversion mechanism the house either runs or does not, and a campaign
  -- shape would invite it to be scheduled, which is not what it is.
  --
  -- OFF stops **issuance** and every customer-facing mention. It does not
  -- refuse a credit somebody already holds: refusing to honour a credit a
  -- customer was promised is the same harm as deleting one, a step removed, and
  -- the policy this implements says explicitly that existing credits must be
  -- handled safely.
  "discoveryCreditEnabled"   boolean not null default true,

  -- ── Rewards, globally ──
  "rewardsEnabled"           boolean not null default false,

  -- ── Earning: the purchase rule ──
  --
  -- Two columns rather than a single ratio, so "Spend 100 EGP → Earn 10 Points"
  -- reads back exactly as the desk typed it. A stored ratio of 0.1 would have to
  -- be un-multiplied to render the sentence, and would round differently
  -- depending on who did the un-multiplying.
  "earnSpendInCents"         int not null default 10000 check ("earnSpendInCents" > 0),
  "earnPoints"               int not null default 10    check ("earnPoints" > 0),

  -- Whether a Discovery Set is itself points-eligible. On by default: a Set is
  -- a purchase like any other. Off is for a house that considers the credit
  -- reward enough.
  "earnOnDiscoverySets"      boolean not null default true,

  -- ── Earning: the one-off rules ──
  --
  -- Signup is governed by `signupBenefit` rather than by a boolean of its own —
  -- see the enum's comment. This is only the amount.
  "signupPoints"             int not null default 100 check ("signupPoints" > 0),

  "firstPurchaseEnabled"     boolean not null default false,
  "firstPurchasePoints"      int not null default 200 check ("firstPurchasePoints" > 0),

  "reviewEnabled"            boolean not null default false,
  "reviewPoints"             int not null default 50  check ("reviewPoints" > 0),

  "signupBenefit"            public."SignupBenefit" not null default 'WELCOME_DISCOUNT',

  -- ── Redemption ──
  --
  -- The pair is the conversion: `redeemPoints` points are worth
  -- `redeemValueInCents` piastres. 100 → 5000 is 50 EGP, roughly 5% of a
  -- purchase earning at the default rate.
  "redeemPoints"             int not null default 100  check ("redeemPoints" > 0),
  "redeemValueInCents"       int not null default 5000 check ("redeemValueInCents" > 0),

  -- The floor. A customer cannot redeem three points for one and a half
  -- piastres, which would be a rounding exercise rather than a reward.
  "minRedeemPoints"          int not null default 100 check ("minRedeemPoints" > 0),

  -- Null is unlimited. A cap here is how a house stops a large balance paying
  -- for an entire order.
  "maxPointsPerOrder"        int check ("maxPointsPerOrder" is null or "maxPointsPerOrder" > 0),

  -- Null never expires. Counted from the transaction that earned the points, so
  -- a balance lapses in the order it was earned rather than all at once.
  "pointsExpiryMonths"       int check ("pointsExpiryMonths" is null or "pointsExpiryMonths" between 1 and 120),

  -- ── Stacking ──
  --
  -- All false, which is the policy: one promotional mechanism per order.
  -- Turning any of these on is a deliberate act with a visible switch behind it,
  -- exactly as `promotions."stacksWithCodes"` already is.
  --
  -- Earning is not stacking and is not governed here: a qualifying order earns
  -- points on what was actually paid even when a coupon, promotion or offer
  -- reduced it. Only *spending* two benefits together is what these refuse.
  "pointsStackWithCodes"      boolean not null default false,
  "pointsStackWithPromotions" boolean not null default false,
  "pointsStackWithOffers"     boolean not null default false,
  "pointsStackWithCredit"     boolean not null default false,

  "updatedAt"                timestamptz not null default now(),

  -- A redemption rate that cannot be reached is a rate that reads as an offer
  -- and behaves as a refusal. Checked here rather than in the form, because the
  -- form is one door.
  constraint benefit_minimum_reachable
    check ("minRedeemPoints" >= "redeemPoints")
);

-- The row must exist for anything to read a setting; the defaults above are a
-- complete, working configuration, so this is a setup rather than a stub. Same
-- reasoning as `"MarketingSetting"`.
insert into public."BenefitSetting" (id) values ('default')
on conflict (id) do nothing;

-- ── Row Level Security ──────────────────────────────────────

alter table public."BenefitSetting" enable row level security;

drop policy if exists "Benefit settings are readable" on public."BenefitSetting";
create policy "Benefit settings are readable"
  on public."BenefitSetting" for select
  to anon, authenticated
  using (true);

-- ── Privileges ──────────────────────────────────────────────
--
-- Written out although `0006_privileges.sql` already grants `select` on tables
-- created afterwards: a grant that exists only by side effect is a grant nobody
-- reviewing this file can see. Insert, update and delete are deliberately
-- absent — every write is service-role.

grant select on public."BenefitSetting" to anon, authenticated;
