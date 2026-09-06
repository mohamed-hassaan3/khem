# KHEM Loyalty, Rewards & Offers

## Goal

Implement `src/docs/KHEM-Loyalty-Rewards-Offers.md` in full, without duplicating
the marketing machinery the repository already has:

- **A — KHEM Points**: a ledger-backed rewards programme, entirely configured
  from the dashboard (earning rate, redemption rate, per-rule toggles, limits,
  expiry, manual adjustment).
- **B — Offers & Bundles**: a general Buy-X-Get-Y engine whose first campaign is
  Buy 2 Get 1, with the lowest-priced eligible item as the free one.
- **C — Discovery Credit**: the existing credit system, reused untouched, plus a
  permanent ON/OFF switch and messaging conditioned on it.

Explicitly out of scope, per §28 of the specification: VIP tiers, Silver/Gold/
Platinum, collector levels, tier-based benefits. The schema stays extensible for
them; nothing is built.

## Skills read

- `.agents/skills/supabase` — schema, migrations, service-role usage, PostgREST
  schema-cache reload. Governs every SQL file below.
- `.agents/skills/clerk` — identity for points ownership and the account panel.
- `node_modules/next/dist/docs/` — Server Actions, server/client boundaries,
  `revalidatePath`.
- `.agents/skills/ai-sdk` — **not applicable**. No model call is involved in this
  feature. (A prompt hook suggested `ai-sdk`/`chat-sdk` on a lexical match with
  the word "rewards"; it is a false positive and is recorded here rather than
  silently ignored.)

## Existing code inspected

### Database (`supabase/sql/`, applied in filename order by `npm run db:migrate`)

| File | What it establishes that this work must respect |
| --- | --- |
| `0015_orders.sql` | `"Order"`, `"OrderItem"`, `place_order()`, `restock_order()`, `set_order_status()`. The founding rule: an order and its consequences are one transaction. |
| `0016_checkout.sql` | `settle_order_payment()` (card), `expire_unpaid_orders()`. |
| `0017_order_events.sql` | `"OrderStatusEvent"`. |
| `0018_comment_rating_images.sql`, `0005_comments.sql` | `product_comment` — `author_clerk_id`, `rating`, `is_published`. This *is* the review infrastructure §5.D asks about. |
| `0024_customers.sql` | `"User"`, `sync_clerk_user()`, `customer_directory`, `customer_profile()`. |
| `0026_discovery_credits.sql` | `customer_credits`, `credit_transactions`, `credit_balances`, `issue_discovery_credits()`, `activate_/cancel_/expire_discovery_credits()`, `adjust_credit()`. **The ledger pattern every new ledger in this work copies.** |
| `0027_credit_redemption.sql` | `"Order"."creditId"`/`"creditAppliedInCents"`, redemption inside `place_order()`, `reverse_credit_redemption()`. |
| `0028_discounts.sql` | `discounts`, `discount_products`, `discount_collections`, `discount_grants`, `discount_redemptions`, `discount_eligible_subtotal()`, `resolve_discount()`, `reverse_discount_redemption()`. |
| `0029_discount_preview.sql` | `discount_cart_subtotal()`, `discount_eligible_cart_subtotal()`, the bag-shaped `resolve_discount()`. The preview pattern the offer preview copies. |
| `0030_welcome.sql` | `claim_welcome()`, `release_welcome()`, `discounts."isWelcome"`. |
| `0035_marketing.sql` | `"MarketingSetting"`, `promotions`, `active_product_promotions`, `"OrderItem"."promotionId"`/`"listPriceInCents"`, `promotions."stacksWithCodes"`. |
| `0040_discount_refusal_detail.sql` | `resolve_discount()` with `reasonCode`; `place_order()` raising `hint = 'DISCOUNT:<code>'`. |
| `0042_inventory_channels.sql` | `move_stock()`, and the current `place_order()` line loop. |
| `0050_payment_authority.sql` | `issue_discovery_credits()` (current body), `set_order_payment_status()` — the desk's payment half. PAID is one-way. |
| `0051_retire_pending.sql` | **The live `place_order()` and `set_order_status()`.** Any new body must be diffed against this file, not against an earlier one. |
| `0054_stripe_webhook_events.sql` | `record_stripe_event()` — webhook idempotency. |

### Application

- `src/actions/checkout.ts` — the storefront order path; forwards `creditId` and
  `discountCode` unexamined, because every question about them is answered under
  a row lock inside `place_order()`.
- `src/actions/discounts.ts`, `src/services/discounts.ts` — the throttled
  preview pattern that binds nothing.
- `src/services/credits.ts`, `src/services/admin/credits.ts`,
  `src/actions/admin/credits.ts`, `src/types/credit.ts`,
  `src/schemas/db/credits.ts`.
- `src/actions/admin/{discounts,promotions,settings,shared}.ts` and their
  services — the admin write pattern (`requireAdmin()`, Zod, RPC, revalidate).
- `src/components/admin/AdminShell.tsx` — the five-group sidebar; Marketing today
  is Promotions, Discounts, Credits, Campaigns, Newsletter, Announcements.
- `src/components/checkout/{CheckoutView,DiscountStep,CreditStep,OrderReview,VoucherPicker}.tsx`.
- `src/components/ecommerce/{CategoryView,CategoryHero,DiscoveryComparison,FeatureTriptych,DiscoverySetCard,CartView,CartSummary}.tsx`.
- `src/app/[locale]/set/[slug]/page.tsx`, `src/app/[locale]/collections/[slug]/page.tsx`.
- `src/app/[locale]/account/vouchers/page.tsx` and `src/components/account/{CreditCard,CreditLedger,CreditSummary,PrivilegeBanner}.tsx`.
- `src/app/[locale]/admin/{credits,customers/[id],discounts,promotions,settings}/page.tsx`.
- `src/lib/admin/revalidate.ts` — the on-demand invalidation map. AGENTS.md §8 is
  explicit that a new public surface quoting stored data **must** be added here.
- `src/lib/i18n/dictionaries/{en,ar}.ts` — `dict.discovery.note` is already the
  exact sentence §18 asks for.
- `src/app/api/cron/expire-credits/route.ts`, `vercel.json` — four crons; the
  Hobby plan allows one run per day each, so no fifth entry is added.

## Findings from the audit

### F1 — Promotions no longer price orders (pre-existing regression, in scope)

`0035_marketing.sql` taught `place_order()` to read a line's unit price from
`active_product_promotions` and to stamp `"OrderItem"."promotionId"` and
`"listPriceInCents"`. `0040_discount_refusal_detail.sql` then re-declared
`place_order()` **from the 0028 body** — its own header says so — and silently
dropped that. `0042` and `0051` copied 0040's body forward. Verified: the string
`active_product_promotions` appears in `0035` and nowhere else in `supabase/sql/`.

Consequences today:

1. A running promotion does not reduce what a customer is charged. It is shown
   on product cards (the view is read by the storefront) and ignored at the till.
2. `"OrderItem"."promotionId"` is never written, so the non-stacking exclusion in
   `discount_eligible_subtotal()` — the mechanism `promotions."stacksWithCodes"`
   exists to drive — can never fire.

This is squarely inside §9 (stacking) and §6 (points from the amount *actually
paid*): points computed against an order whose promotion was never applied would
be computed against the wrong number. **Restoring promotion pricing is therefore
part of this work**, in the new `place_order()` body, copied from 0035 with the
0042 `move_stock()` loop intact.

### F2 — `place_order()` is re-declared by seven files

`0015 → 0016 → 0017 → 0027 → 0028 → 0035 → 0040 → 0042 → 0051`, each copying the
previous body. F1 is what that costs. This work adds two more benefits to the
same function, so it declares `place_order()` **once**, in the last new file, and
states in its header that it is the 0051 body plus promotion pricing (F1), the
offer block and the points block — with every earlier concern present.

### F3 — The review rule already has its infrastructure

§5.D allows for reviews not existing. They do: `product_comment` carries
`author_clerk_id`, `rating` and `is_published`. The rule can be built for real.

### F4 — Discovery Credit messaging is in four places, not two

§18 names the banner and the details section. The audit finds the sentence or its
paraphrase in four customer-facing surfaces, all of which must obey the switch:

1. `CategoryView` `DISCOVERY` branch → `<CategoryHero note={copy.note}>` — the
   banner. `note` is already an optional prop, so removing it reflows cleanly.
2. `<FeatureTriptych variant="steps">` → the "Unlock Your Credit" third step.
3. `<DiscoveryComparison>` → the "Applies to Full Size" row.
4. `/set/[slug]` → **no such sentence exists today**; §18 requires it.

## Decisions and assumptions

**D1 — Points are a ledger, never a balance column.** `points_transactions` is
append-only and signed; the balance is a view over it. This is `0026`'s pattern
and §7's requirement, stated identically.

**D2 — Idempotency is a unique index, not a prior check.** A check-then-insert
has a gap; `on conflict do nothing` does not. One partial unique index per
source, listed in the schema section below. §25 asks for this and `0026`'s
issuance guard is the precedent.

**D3 — Points are earned on the payment fact, at both doors.** Awarding is
`perform`ed from `settle_order_payment()` (card) and `set_order_payment_status()`
(desk), immediately beside the existing `issue_discovery_credits()` call. Those
are the two places where money becomes real, and putting the award anywhere else
would mean one rail earns and the other does not.

**D4 — The eligible paid amount is `"totalInCents" - "shipInCents"`.** Because
`totalInCents = subtotal + ship − promotion − offer − discount − credit −
pointsValue`, that single subtraction is exactly "the merchandise the customer
actually paid for", and it satisfies §6, §21 and §7's "points cannot be earned
from the points portion" in one expression rather than four. Delivery earns
nothing, which is deliberate: the house does not pay itself points for a courier.

**D5 — One settings row for benefits.** A new singleton `"BenefitSetting"`
(`id = 'default'`) holds the Discovery Credit switch, every Rewards knob, and the
stacking matrix. `"MarketingSetting"` is campaign chrome read on every storefront
render (its own header says so); a switch that decides what money the house owes
does not belong in it, and two singletons that both mean "what benefits does the
house offer" would drift. Defaults ship the system **off** for Rewards
(`rewardsEnabled = false`) and **on** for Discovery Credit
(`discoveryCreditEnabled = true`), so applying the migration changes nothing that
is live today.

**D6 — When Discovery Credit is OFF, issuance and messaging stop; credits already
held stay spendable.** §17 requires that existing valid credits are "handled
safely" and "NOT silently deleted"; refusing to honour a credit a customer was
promised would be the same harm as deleting it, one step removed. So
`issue_discovery_credits()` returns 0 while the switch is off, every customer-
facing mention disappears, and the redemption path is untouched. Stated here
because it is the one reading of §17 that the text leaves open.

**D7 — Benefit resolution is an explicit ladder with a default of one mechanism.**
§9 forbids uncontrolled stacking. `place_order()` gains a named
`── Benefit resolution ──` section that applies, in this order:

| # | Benefit | Kind | Chosen by | Level |
| --- | --- | --- | --- | --- |
| 1 | Promotion | discount | automatic, best per line | line price |
| 2 | Offer | benefit | automatic, best single offer | order |
| 3 | Coupon code | discount | customer types it | order |
| 4 | Points | reward | customer redeems | order |
| 5 | Discovery Credit | credit | customer picks one | order |

Every adjacency is refused unless a named switch permits it:
`promotions."stacksWithCodes"` (exists), `offers."stacksWithCodes"`,
`offers."stacksWithCredit"`, and on `"BenefitSetting"` —
`pointsStackWithCodes`, `pointsStackWithPromotions`, `pointsStackWithOffers`,
`pointsStackWithCredit`. The existing credit-versus-discount refusal in
`place_order()` is preserved verbatim; nothing already refused becomes allowed.
The five words §9 asks be kept distinct — discount, reward, credit, promotion,
benefit — are the vocabulary of `src/types/benefits.ts` and of these column
names, not loose prose.

**D8 — Earning survives a discount; it does not survive a refund.** A qualifying
order earns on its paid amount even when a coupon, promotion or offer was used
(§9). A refund or cancellation writes a `REFUND_REVERSAL` row negating what that
order earned, and restores points the order spent (§7, §25).

**D9 — Points redemption is capped so it can never pay for delivery**, exactly as
the credit is: applied against merchandise after every discount, `least()`-capped,
and the order total can never fall below `"shipInCents"`.

**D10 — The offer's free item is a line-level reduction, not a zero-priced line.**
The offer's value is recorded on the order as `"offerDiscountInCents"` and the
line keeps its real price. A free line priced at zero would corrupt
`"ProductSales"`, the analytics views, and every average-order figure the desk
reads. The chosen unit is recorded on `offer_redemptions` for the audit trail.

**D11 — No fifth cron.** Points expiry is added to
`/api/cron/expire-credits`, which already runs nightly and is already the
"close a window that nothing else notices" route. Vercel Hobby permits one run
per day per cron, and a fifth entry would compete for the same allowance.

**D12 — Nothing new is exposed to the public roles.** Every new table gets RLS
on, no policy, no grant, and `execute` revoked on every new function — the
posture `0015`, `0026` and `0028` all state. These rows name a customer and an
amount of money.

**Assumption A1** — "Eligible activities" for the purchase rule means every paid
order, including one containing only a Discovery Set, unless the admin turns the
rule off. §21 says points are earned on a Discovery Set "only if configured as
points-eligible", so `"BenefitSetting"."earnOnDiscoverySets"` is that switch,
defaulting to **on**.

**Assumption A2** — Referral (§5.E) is not built. The ledger's `source` enum
carries `REFERRAL` so a later feature writes rows rather than migrating the
table, which is precisely what §5.E asks for.

**Assumption A3** — Points expire on a rolling window from the transaction that
earned them (`expiresAt` per row), null when `pointsExpiryMonths` is null. Oldest
spendable points are consumed first, so a redemption never burns points that had
longer to live.

## Files likely to change

### New SQL (`supabase/sql/`)

| File | Contents |
| --- | --- |
| `0058_benefit_settings.sql` | `"BenefitSetting"` singleton + its seeded row + privileges. |
| `0059_rewards.sql` | `"PointsSource"` enum, `points_transactions`, `reward_balances` view, `award_purchase_points()`, `award_signup_points()`, `award_review_points()` + its trigger, `reverse_purchase_points()`, `expire_points()`, `adjust_points()`, `resolve_points_redemption()`; `sync_clerk_user()`, `settle_order_payment()` and `set_order_payment_status()` re-declared with one added call each. |
| `0060_offers.sql` | `"OfferRewardKind"`, `"OfferScope"`, `"OfferSelection"`, `"OfferAudience"` enums; `offers`, `offer_trigger_products`, `offer_trigger_collections`, `offer_reward_products`, `offer_reward_collections`, `offer_redemptions`; `"Order"."offerId"`/`"offerDiscountInCents"`; `resolve_offer()` (order-shaped and bag-shaped); `reverse_offer_redemption()`. |
| `0061_benefit_resolution.sql` | **The single re-declaration of `place_order()`** — the 0051 body plus promotion pricing (F1), the offer block, the points block, and the stacking ladder (D7). Plus `set_order_status()` with points and offer reversal added beside the existing credit and discount reversals. |

### New application files

- `src/types/rewards.ts`, `src/types/offer.ts`, `src/types/benefits.ts`
- `src/schemas/db/{rewards,offers,benefit-settings}.ts`
- `src/schemas/{rewards,offers}.ts` (Zod, admin write shapes)
- `src/services/{rewards,offers}.ts`, `src/services/admin/{rewards,offers,benefits}.ts`
- `src/actions/{rewards}.ts`, `src/actions/admin/{rewards,offers,benefits}.ts`
- `src/app/[locale]/admin/rewards/page.tsx`, `src/app/[locale]/admin/offers/{page,new,[id]}/page.tsx`
- `src/components/admin/{RewardSettingsForm,RewardRulesForm,PointsAdjustDialog,PointsLedgerTable,OfferForm,OfferTable,DiscoveryCreditToggle}.tsx`
- `src/components/account/{RewardSummary,RewardLedger}.tsx`
- `src/components/checkout/PointsStep.tsx`
- `src/components/ecommerce/OfferBanner.tsx`

### Modified

- `src/actions/checkout.ts` — forward `pointsToRedeem` unexamined, as it forwards
  `creditId`; extend `placementFailure()` with points and offer refusals.
- `src/schemas/checkout.ts`, `src/types/checkout.ts` — `pointsToRedeem`.
- `src/components/checkout/{CheckoutView,OrderReview}.tsx` — the points step and
  the offer line in the summary.
- `src/components/ecommerce/{CartView,CartSummary,CategoryView,DiscoveryComparison}.tsx`
- `src/app/[locale]/set/[slug]/page.tsx` — the §18 sentence.
- `src/app/[locale]/account/vouchers/page.tsx` — the Rewards panel above vouchers.
- `src/app/[locale]/admin/credits/page.tsx` — the Discovery Credit ON/OFF switch.
- `src/app/[locale]/admin/customers/[id]/page.tsx` — §22's customer view.
- `src/components/admin/AdminShell.tsx` — Marketing gains Rewards and Offers.
- `src/lib/admin/revalidate.ts` — `revalidateBenefits()`, `revalidateOffers()`.
- `src/lib/i18n/dictionaries/{en,ar}.ts` — every new string, both languages.
- `src/app/api/cron/expire-credits/route.ts` — also call `expire_points()`.
- `src/services/orders.ts`, `src/types/order.ts` — the new order columns.

## Implementation requirements

### 1. `"BenefitSetting"` (0058)

Singleton, `id = 'default'`, seeded on migrate. Columns, with defaults that
preserve today's behaviour:

- `discoveryCreditEnabled` bool **true**
- `rewardsEnabled` bool **false**
- Earning: `earnSpendInCents` int default 10000, `earnPoints` int default 10,
  both `> 0` — §5.A's "do not hard-code"; the ratio is two columns so
  "100 EGP → 10 points" reads back exactly as the admin typed it.
- `earnOnDiscoverySets` bool true (A1)
- `signupEnabled` bool false / `signupPoints` int default 100
- `firstPurchaseEnabled` bool false / `firstPurchasePoints` int default 200
- `reviewEnabled` bool false / `reviewPoints` int default 50
- Redemption: `redeemPoints` int default 100, `redeemValueInCents` int default
  5000, `minRedeemPoints` int default 100, `maxPointsPerOrder` int null
- `pointsExpiryMonths` int null
- Stacking: `pointsStackWithCodes`, `pointsStackWithPromotions`,
  `pointsStackWithOffers`, `pointsStackWithCredit` — all bool, all **false**
- `updatedAt`

### 2. Points ledger (0059)

`"PointsSource"` enum, exactly §7's list: `PURCHASE`, `SIGNUP`,
`FIRST_PURCHASE`, `REVIEW`, `REFERRAL`, `ADMIN_ADJUSTMENT`, `REFUND_REVERSAL`,
`REDEMPTION`, `EXPIRATION`.

`points_transactions`: `id`, `clerkUserId` (not null, no FK — Clerk owns
identity, the `"Order"."clerkUserId"` precedent), `amount` int **signed and
non-zero**, `source`, `orderId` (FK, `on delete set null`), `referenceId` text
(the comment id for `REVIEW`), `note`, `actor`, `occurredAt`, `expiresAt`.

Idempotency indexes (D2) — the whole of §25's "no duplicate points":

```
unique (source, "orderId")            where "orderId" is not null
unique ("clerkUserId", source)        where source = 'SIGNUP'
unique ("clerkUserId", "referenceId") where source = 'REVIEW'
```

`reward_balances` view, per `clerkUserId`: `balancePoints` (sum),
`lifetimeEarned` (sum of positives excluding `REDEMPTION` reversal noise),
`lifetimeRedeemed`, `expiredPoints`, and `valueInCents` derived from the current
redemption rate. §22's admin figures come from this view; nothing recomputes them.

Functions:

- `award_purchase_points(order_id)` — reads `"BenefitSetting"`; returns 0 when
  `rewardsEnabled` is false. Eligible amount is `"totalInCents" - "shipInCents"`
  (D4); when `earnOnDiscoverySets` is false, the Discovery lines' paid share is
  subtracted first. Points are `floor(eligible * earnPoints / earnSpendInCents)`
  — floored, matching `resolve_discount()`'s rounding, so the house never awards
  a point it did not mean to. Writes one `PURCHASE` row, plus one
  `FIRST_PURCHASE` row when that rule is on and no earlier paid order exists for
  this customer. `on conflict do nothing` on both.
- `award_signup_points(clerk_id)` — called from the insert branch of
  `sync_clerk_user()`.
- `award_review_points(comment_id)` — `after insert or update on
  product_comment`, when the row is published, has a rating and an
  `author_clerk_id`; `referenceId` is the comment id.
- `reverse_purchase_points(order_id)` — negates this order's `PURCHASE` and
  `FIRST_PURCHASE` rows as one `REFUND_REVERSAL`, and restores its `REDEMPTION`.
  Guarded by the same `not exists` shape as `reverse_credit_redemption()`.
- `expire_points()` — writes closing `EXPIRATION` rows for lapsed positive
  balances, oldest first; idempotent by construction.
- `adjust_points(clerk_id, amount, note, actor)` — refuses zero, refuses a result
  below zero, records the actor, always a new row (§7, §25).
- `resolve_points_redemption(payload)` — the preview and the authority, in one
  function, `resolve_discount()`'s shape: `{ ok, points, amountInCents, reason,
  reasonCode }`. Called without a lock for the preview and **with** a
  `for update` over the customer's rows inside `place_order()`.

### 3. Offers (0060)

`offers` columns: `name`, `description`, `label`, `label_ar`, `isActive`,
`startsAt`, `endsAt` (`endsAt > startsAt` check), `triggerQuantity` (`>= 1`),
`triggerScope`, `rewardQuantity` (`>= 1`), `rewardKind`
(`FREE_ITEM` | `PERCENTAGE`), `rewardValue` (percent, 1–100, required for
`PERCENTAGE`), `rewardScope`, `rewardSelection` (`LOWEST_PRICED` default |
`HIGHEST_PRICED`), `audience` (`EVERYONE` | `NEW_CUSTOMERS` |
`EXISTING_CUSTOMERS` | `SUBSCRIBERS` | `GRANTED`), `requiresGrant`,
`requiresDiscountCode` text null (§13's "customers with a specific coupon"),
`totalUseLimit`, `perCustomerLimit`, `stacksWithCodes` false,
`stacksWithCredit` false, `priority`, timestamps.

Four junction tables, foreign-keyed like `discount_products` — a target that
cannot name a product which does not exist.

`offer_redemptions` mirrors `discount_redemptions` exactly, including
`orderId` unique and `releasedAt` rather than a delete, plus
`rewardProductSlug` and `rewardUnitPriceInCents` for the audit trail (D10).

`resolve_offer()` in two shapes, as `resolve_discount()` is: order-shaped (reads
`"OrderItem"`, takes the caps under a lock) and bag-shaped (reads slugs and
quantities, no lock, for the cart preview). Both:

1. Expand every eligible line into units, priced at the line's **post-promotion**
   unit price.
2. Require at least `triggerQuantity` eligible units.
3. Grant `floor(eligibleUnits / triggerQuantity) * rewardQuantity` reward units,
   never more than `eligibleUnits − triggerUnitsConsumed`.
4. Sort by unit price ascending for `LOWEST_PRICED` and take from the front —
   §12's protection against two cheap bottles buying an expensive one, and §15's
   worked example (890 + 1,470 + 2,200 → the 890 is free) is a fixture.
5. For `PERCENTAGE`, apply the rate to those same selected units.
6. Return `{ ok, offerId, label, amountInCents, rewardSlug, reasonCode }`.

When two offers apply, the higher `priority` wins and the larger reduction breaks
the tie — `active_product_promotions`'s rule, stated the same way.

### 4. `place_order()` (0061)

One re-declaration. Header states plainly that it is the **0051 body** plus:

- **F1's restoration.** The line loop reads its unit price from
  `active_product_promotions` after the `for update` on the product, stamps
  `"OrderItem"."promotionId"` and `"listPriceInCents"`, and keeps the 0042
  `move_stock()` call verbatim. The `found` check and the `v_promo_id := null`
  reset from 0035 are copied exactly — without them a second bottle is priced at
  the first one's campaign.
- **The offer block**, after the loop and before the discount block: the
  automatic benefit is resolved before the customer-supplied one.
- **The discount block**, unchanged from 0051 including the `hint` raise.
- **The points block**, after the discount and before the credit.
- **The credit block**, unchanged from 0051, including its existing refusal of a
  promotional discount.
- **The stacking ladder (D7)**, as explicit `raise exception` guards with
  `hint = 'BENEFIT:<code>'` so `src/actions/checkout.ts` can translate the
  refusal the way it already translates `DISCOUNT:`.

Final totals:

```
"totalInCents" = subtotal + ship − offer − discount − points − credit
```

with each customer-supplied reduction `least()`-capped against what remains of
merchandise, so the total can never fall below `"shipInCents"` and never below
zero (D9).

`set_order_status()` re-declared with `reverse_purchase_points()` and
`reverse_offer_redemption()` added beside the four calls already there. The
existing calls **must all survive** — dropping back to an earlier body is exactly
how F1 happened, and the header says so.

### 5. Admin

- **Marketing → Rewards** (`/admin/rewards`): §24's sections, in order — Status,
  Earning ("Spend 100 EGP → Earn 10 Points" rendered live from the two fields),
  Redemption ("100 Points → 50 EGP"), Rules (one toggle each), Limits, Expiry,
  Stacking. Below them, customer balances with search, manual add/remove, and the
  full ledger.
- **Marketing → Offers** (`/admin/offers`): list, new, edit. Basic / Trigger /
  Reward / Eligibility / Limits / Dates, matching §12–§14 heading for heading.
- **Marketing → Credits** (existing route): a `DiscoveryCreditToggle` at the top
  of the page, above the list, with a sentence saying what OFF does and does not
  do (D6).
- **Customers → detail**: §22's three panels — Rewards (current, lifetime earned,
  lifetime redeemed, expired, ledger), Discovery Credit (available, earned, used,
  remaining, ledger), Marketing benefits (coupons, promotions, offers).
- `AdminShell`: Marketing becomes Promotions, Offers, Discounts, Rewards,
  Credits, Campaigns, Newsletter, Announcements. Order within a group is how
  often the desk reaches for it, which is the rule that file already states.

### 6. Storefront

- **Rewards panel** on `/account/vouchers`, above the vouchers, rendered only
  when `rewardsEnabled`. §10's four lines exactly: "Your KHEM Rewards", the
  point count, the EGP value, and how far to the next reward. Ivory/charcoal/gold,
  Cinzel headings, no badges, no progress-bar gamification.
- **`PointsStep`** at checkout between `DiscountStep` and `CreditStep`: balance,
  an amount to redeem, the live EGP value, and the server's refusal sentence when
  there is one. Hidden entirely when Rewards is off or the balance is below
  `minRedeemPoints`.
- **Offer line** in `CartSummary` and `OrderReview`, labelled with the offer's
  customer-facing `label`.
- **Discovery Credit messaging**, all four surfaces from F4, all conditioned on
  `discoveryCreditEnabled`. `/set/[slug]` gains the sentence in its purchase
  section. When off, `note` is simply not passed, the triptych renders two steps,
  and the comparison drops a row — no empty containers, no orphaned spacing.

### 7. Caching

`revalidateBenefits()` and `revalidateOffers()` in `src/lib/admin/revalidate.ts`,
covering `/`, `/cart`, `/collections`, every category and set path, and
`/account/vouchers` — both locales, per that file's first rule. AGENTS.md §8 is
explicit that a surface quoting stored data and absent from this file is a defect
rather than a few minutes of lag. Every new admin action calls one of them.

## Security requirements

1. **No new grant.** RLS on, no policy, no grant to `public`/`anon`/
   `authenticated`, `execute` revoked on every new function — restated after every
   `create or replace`, because that restores the default grant (D12).
2. **The client names an id, never an amount.** `pointsToRedeem` is a count the
   server prices; the offer is chosen server-side and never named by the browser.
   No figure from a request reaches any arithmetic.
3. **Identity from the session.** Points ownership is compared against
   `payload->>'clerkUserId'`, filled from `getUserId()` — never a form field.
   The account panel and every service read take `clerkUserId` from `auth()`.
4. **Locks, not checks.** Redemption reads the balance under `for update` on the
   customer's rows inside the writing transaction, as `place_order()` already does
   for a credit. Previews take no lock and bind nothing.
5. **Admin writes behind `requireAdmin()`**, Zod-validated, service key only.
6. **The cron addition keeps the constant-time bearer check** already in the
   route.
7. **No PII in logs.** Order number, point counts, and provider errors only —
   the rule `src/actions/checkout.ts` states.
8. **PostgREST cache.** `npm run db:migrate` signals the reload; four new tables
   make this load-bearing, and `supabase/README.md`'s warning is why a green
   migration and a broken page are otherwise indistinguishable.

## Acceptance criteria

Taken from §30, plus what the audit added.

**Rewards** — admin can enable/disable, configure earning and redemption rates,
toggle each rule; customers see their balance and redeem it; points are computed
from the eligible paid amount (§6's 1,470 → 10% coupon → 1,323 → 132 points is a
fixture); refunds and cancellations reverse both earning and redemption; the same
order can never earn twice under webhook redelivery; admin can adjust manually;
every movement is a ledger row with a source.

**Offers** — Buy 2 Get 1 works; the lowest-priced eligible item is the free one
(§15's 890/1,470/2,200 → pays 3,670 is a fixture); product and collection
eligibility, customer eligibility, dates and activation, and all four limits
work; an offer does not stack with a code or a credit unless switched on.

**Discovery Credit** — the existing system is reused, not rebuilt; the ON/OFF
switch is permanent and needs no dates or targeting; the banner and the details
section both carry *"Each discovery purchase may be applied to full-size
orders."* when ON and nothing when OFF; the layout reflows; existing credits are
honoured; redemption is recorded; no duplicate credit can be created.

**Overall** — existing coupons, promotions, newsletter, credits, checkout, order
calculations and admin controls all still work; F1 is fixed, so a running
promotion reduces what is charged and `"OrderItem"."promotionId"` is written
again; balances are auditable from their ledgers; every order-related write is
idempotent; lint, type-check and build pass.

## Checks to run

```
npm run lint
npx tsc --noEmit
npm run build
npm run db:migrate     # applies 0058–0061 and signals the PostgREST reload
npm run db:verify
```

There is no test runner in this repository — no `vitest`, no `playwright`, and no
`*.test.ts` anywhere outside `node_modules`. "Relevant tests" is therefore the
four commands above plus the manual journey below; adding a test framework is not
in this specification's scope and will not be smuggled in with it.

## Manual test steps

**Setup** — `npm run db:migrate`, confirm it prints *"PostgREST schema cache
reload signalled"*, then `npm run dev`.

**0. Nothing changed yet.** Before touching a switch: place a cash order as a
guest. It behaves exactly as today — Rewards is off by default, no points row is
written, and the totals are unchanged.

**1. F1 — promotions price orders again.** Admin → Promotions, run a 20% campaign
over one collection. Add one of its bottles to the bag and check out. The order
is charged the promoted price, and `"OrderItem"` carries `promotionId` and
`listPriceInCents`. Add a non-stacking coupon: it applies only to the untouched
lines.

**2. Rewards on.** Admin → Marketing → Rewards. Enable, set "Spend 100 EGP → 10
Points", "100 Points → 50 EGP", minimum 100, and enable Signup and First
Purchase.

**3. Signup.** Register a new account. `/account/vouchers` shows "Your KHEM
Rewards — 100 KHEM Points, 50 EGP available".

**4. Purchase with a coupon (§6).** Buy the 1,470 EGP fragrance with a 10%
coupon. Pay 1,323. Once the order is PAID, the balance rises by **132**, not 147.
The ledger shows one `PURCHASE` row and one `FIRST_PURCHASE` row.

**5. No double award.** Admin → Orders, mark the same order PAID again (or replay
the Stripe event). The balance does not move; no second row appears.

**6. Redemption.** New bag, checkout, redeem 200 points → 100 EGP off. The total
falls by exactly 100, delivery is still charged, and a `REDEMPTION` row appears.
Try to also apply a coupon: refused, in the reading language, unless
`pointsStackWithCodes` is on.

**7. Refund.** Refund the order from step 4. A `REFUND_REVERSAL` row negates its
earning; the points spent in step 6 come back when that order is refunded too.
Refund it a second time: nothing further is written.

**8. Buy 2 Get 1 (§15).** Admin → Marketing → Offers → new: trigger 2 from the
Signature collection, reward 1 free, lowest-priced. Bag the 890, 1,470 and 2,200
bottles. The cart and the checkout both show the offer and a −890 line; the total
is 3,670 plus delivery. Reverse the rule to `HIGHEST_PRICED` and confirm the 2,200
goes free instead — then set it back.

**9. Offer limits and audience.** Set "once per customer"; a second order is
placed without the offer. Set audience to New Customers; an existing customer
does not receive it.

**10. Discovery Credit ON.** Admin → Marketing → Credits: the switch is on.
`/collections/discovery-sets` shows *"Each discovery purchase may be applied to
full-size orders."* under the banner description; `/set/<slug>` shows the same
sentence; the "Unlock Your Credit" step and the "Applies to Full Size" comparison
row are present. Buy a Set, mark it PAID and DELIVERED, then spend the credit on
a full-size fragrance — the credit is consumed whole and recorded, and step 4's
rule applies: points are earned on 1,070, not 1,470 (§21).

**11. Discovery Credit OFF.** Switch it off. All four surfaces lose the message
and reflow with no gap, in both `en` and `ar`. A new Discovery Set purchase
creates **no** credit. The credit earned in step 10, if unspent, is still listed
in `/account/vouchers` and can still be redeemed (D6). Switch back on: a fresh
purchase earns again.

**12. Admin customer view (§22).** Admin → Customers → the test account. Rewards
shows current, lifetime earned, lifetime redeemed, expired and the full ledger;
Discovery Credit shows available, earned, used, remaining and its ledger; the
marketing panel lists the coupon, promotion and offer used above.

**13. Manual adjustment.** Add 500 points with a reason, then remove 300. Both
appear as `ADMIN_ADJUSTMENT` rows naming the admin. Try to remove more than the
balance: refused.

**14. Expiry.** Set expiry to 1 month, hand-date a ledger row into the past, and
call `/api/cron/expire-credits` with the `CRON_SECRET` bearer. An `EXPIRATION`
row closes it and the balance falls. Call it again: nothing further is written,
and Discovery Credit expiry still runs in the same request.

**15. Arabic.** Walk `/ar` through steps 3, 6, 8 and 10. Every new string is
translated, and the RTL layout holds.

---

# Addendum — the signup benefit and the welcome popup

Added after approval, at the user's request. Everything above stands unchanged
except where this section says otherwise.

## What the audit found

The popup's percentage is **already not hard-coded**.
`src/components/marketing/OfferPopup.tsx` builds its offer line from
`getWelcomeOffer()` → `welcome_offer()` → the `discounts."isWelcome"` row
(`0030_welcome.sql`, `0035_marketing.sql`), and falls back to
`dict.offerPopup.plainOffer` when no campaign is running. The 20% is data.

What is missing is a **choice**: the house can run a welcome discount or not,
but it cannot say "offer Rewards points instead", and there is no single switch
that withdraws the signup promise from every surface at once.

Six surfaces speak for the signup benefit today:

| # | Surface | Where |
| --- | --- | --- |
| 1 | The popup's offer line | `OfferPopup.tsx` ← `getWelcomeOffer()` |
| 2 | The popup's success panel (prints the granted code) | `OfferPopup.tsx` ← `claim_subscriber_offer()` |
| 3 | The subscribe confirmation email's voucher block | `src/lib/email/templates.ts` |
| 4 | The account welcome email's voucher block | `src/lib/email/welcome-templates.ts` ← `claim_welcome()` |
| 5 | The Clerk webhook that sends (4) | `src/app/api/webhooks/clerk/route.ts` |
| 6 | The dashboard's echo of the live offer | `/admin/announcements` |

## The control

`"BenefitSetting"."signupBenefit"`, a new enum `"SignupBenefit"` with three
members. It **replaces** `signupEnabled` from the approved plan — two switches
that can disagree about whether signup earns points is exactly the drift this
codebase keeps refusing, so the mode is the only fact.

| Mode | Welcome grant | Signup points | Popup line |
| --- | --- | --- | --- |
| `WELCOME_DISCOUNT` *(default)* | issued, as today | none | the live welcome offer |
| `REWARD_POINTS` | **none** | `signupPoints` awarded | the configured points message |
| `NONE` | **none** | none | no promotional line at all |

`WELCOME_DISCOUNT` is the default so applying the migration changes nothing.

## Where it is enforced

**In SQL, at the three functions that already own these decisions** — so no
caller can forget, and a surface added later inherits the gate:

- `welcome_offer()` returns **zero rows** unless the mode is
  `WELCOME_DISCOUNT`. Surfaces 1 and 6 go quiet with no change of their own.
- `claim_subscriber_offer()` issues no grant and returns `code = null` unless
  the mode is `WELCOME_DISCOUNT`. Surfaces 2 and 3 already render nothing for a
  null code.
- `claim_welcome()` likewise. Surfaces 4 and 5 already handle a null code — its
  own header calls it "a letter with no voucher block, not a failure".
- `sync_clerk_user()` calls `award_signup_points()`, which itself returns 0
  unless the mode is `REWARD_POINTS` **and** `rewardsEnabled` is true.

Gating in SQL rather than in the components is what makes "no stale 20% OFF
messaging anywhere" a structural fact rather than six things to remember. A
component cannot print a percentage it is never given.

## What the popup receives

`getWelcomeOffer()` is superseded by `getSignupBenefit()`, returning a
discriminated union so the component cannot render the wrong branch:

```ts
export type SignupBenefit =
  | { mode: "WELCOME_DISCOUNT"; offer: WelcomeOfferSummary | null }
  | { mode: "REWARD_POINTS"; points: number }
  | { mode: "NONE" };
```

`OfferPopup` takes `benefit: SignupBenefit` in place of `offer`. Its offer line
becomes: the existing percentage/amount/plain sentences under
`WELCOME_DISCOUNT`; a new `dict.offerPopup.pointsOffer` under `REWARD_POINTS`;
and **nothing rendered at all** under `NONE` — no element, no gap, the panel's
`gap-5` closing over it exactly as the Discovery banner reflows.

The popup itself still appears under `NONE` when `offerPopupEnabled` is on: it
is the newsletter invitation, and withdrawing the *promise* is not the same act
as withdrawing the *list*. The two switches stay separate because they are two
decisions.

## Admin

The three-state control lives on **Marketing → Rewards**, in a `Signup benefit`
section above Earning, as three radio choices with a sentence each saying what
the visitor will be told. Beside `REWARD_POINTS` sits the `signupPoints` field.
`/admin/announcements` keeps its read-only echo of the live welcome offer and
gains a line naming the current mode, so an editor wondering why the popup stopped
promising 20% is told where the switch is rather than left to search.

## Added acceptance criteria

- Switching to `REWARD_POINTS` changes the popup line to the points message,
  stops new welcome grants, and starts awarding `signupPoints` on registration.
- Switching to `NONE` removes the offer line from the popup with no gap, stops
  grants, and awards nothing.
- Under either non-default mode, no welcome code appears in the popup's success
  panel, the subscribe confirmation email, or the account welcome email.
- Grants already issued remain valid and redeemable — the same reading as D6 for
  Discovery Credit, for the same reason.
- Switching back to `WELCOME_DISCOUNT` restores today's behaviour exactly.

## Added manual test steps

**16. Signup benefit — points.** Admin → Marketing → Rewards → Signup benefit →
KHEM Rewards, 100 points. In a fresh browser profile, trigger the popup: the line
reads the points message, not a percentage. Subscribe: the success panel shows no
code and the confirmation email carries no voucher block. Register an account: the
welcome email has no voucher block, and `/account/vouchers` shows 100 points.

**17. Signup benefit — off.** Switch to Off. The popup still appears and still
subscribes, but carries **no** offer line and no empty space where it was.
Registering awards nothing and grants nothing.

**18. No stale messaging.** With the mode off, grep the running site: no "20%"
appears in the popup, the subscribe email, the welcome email, or
`/admin/announcements`' live-offer line. A grant issued before the switch is
still listed in `/account/vouchers` and still works at checkout.

**19. Back to the discount.** Switch to 20% First Purchase. Step 3's original
behaviour returns unchanged.
