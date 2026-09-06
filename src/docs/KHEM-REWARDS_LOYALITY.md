# KHEM Loyalty, Rewards & Offers

## Feature Specification & Implementation Plan

## 1. Objective

Build a flexible customer loyalty and promotional system for KHEM that allows the admin to fully control:

1. KHEM Points / Rewards
2. Buy X Get Y offers, including Buy 2 Get 1
3. Discovery Set → Full-Size Purchase Credit
4. Existing Promotions and Coupon Codes integration
5. Customer eligibility, limits, dates, and activation/deactivation

The system must be configurable from the admin dashboard without requiring code changes for normal marketing decisions.

### Important brand direction

KHEM is positioned as a premium/luxury fragrance brand.

The loyalty system should feel like:

> **"The more you belong to KHEM, the more you unlock."**

It should NOT make KHEM feel like a discount-driven brand.

---

# 2. Existing Marketing System

KHEM already has:

* Newsletter
* Promotions
* Coupon Codes
* Customer/subscriber targeting
* Invitation-based offers
* Collection/product eligibility
* Discount controls

Do NOT replace or duplicate the existing system.

The new features should integrate with the existing promotion architecture where appropriate.

The admin should have a clear Marketing structure such as:

* Newsletter
* Promotions
* Coupon Codes
* Rewards
* Offers & Bundles
* Discovery Credit

The exact navigation can follow the existing KHEM admin design system.

---

# 3. FEATURE A — KHEM Rewards / Points

## 3.1 Concept

Customers earn KHEM Points through eligible activities and can later redeem those points for an order discount.

Example:

> Spend 1,000 EGP → earn 100 KHEM Points

The system must NOT hard-code the earning rate.

Admin must be able to change the earning rules.

---

# 4. Rewards Admin Controls

Create a dedicated **Rewards** admin section.

## Global controls

Admin can:

* Enable / Disable KHEM Rewards
* Define points earning rate
* Define points redemption rate
* Define minimum points required for redemption
* Enable / disable individual earning rules
* Configure expiration
* View customer balances
* Manually add points
* Manually remove points
* View complete points transaction history

---

# 5. Points Earning Rules

Initial supported rules:

### A. Purchase

Admin configures:

* EGP spent
* Points earned

Example default:

> Every 100 EGP spent = 10 KHEM Points

The value must be configurable.

Examples:

* 100 EGP → 5 points
* 100 EGP → 10 points
* 100 EGP → 15 points
* 100 EGP → 20 points

Do not hard-code these values.

---

### B. Account Signup

Optional bonus.

Example:

> Create a KHEM account → +100 Points

Admin can:

* Enable / disable
* Set points amount

---

### C. First Purchase

Optional bonus.

Example:

> Complete your first purchase → +200 Points

Admin can:

* Enable / disable
* Set points amount

This must only be awarded once per customer.

---

### D. Product Review

Optional future-ready rule.

Example:

> Submit an eligible product review → +50 Points

Admin can enable/disable this.

If review infrastructure does not currently exist, prepare the rewards architecture without breaking the existing application.

---

### E. Referral

Do not necessarily build the customer-facing referral system in this version unless the existing architecture supports it.

However, the points ledger should be designed so another earning source can be added later.

---

# 6. Points Calculation

Purchase points should be calculated from the **eligible amount actually paid**, not the original product price.

Example:

Product:

> 1,470 EGP

Customer receives:

> 10% coupon

Customer pays:

> 1,323 EGP

If the earning rule is:

> 10 points per 100 EGP

Points should be calculated from the eligible paid amount:

> 1,323 EGP → approximately 132 Points

Do NOT award points based on the original 1,470 EGP.

---

# 7. Important Points Rules

Points must not become exploitable.

Define clearly:

* Points are earned only after a successful/qualifying order.
* Cancelled orders should not generate permanent points.
* Refunded orders must reverse the points earned from the refunded amount.
* Points cannot be earned from the points portion of an order.
* Points should not be awarded twice because of retries/webhooks/order updates.
* Points transaction creation must be idempotent.
* Admin manual adjustments must create ledger records.
* Every points transaction should have a reason/source.

Recommended ledger sources:

* `purchase`
* `signup`
* `first_purchase`
* `review`
* `referral`
* `admin_adjustment`
* `refund_reversal`
* `redemption`
* `expiration`

Do not simply store one mutable "points" number without a transaction ledger.

---

# 8. Points Redemption

Admin controls the conversion.

Recommended initial default:

> 100 KHEM Points = 50 EGP reward

This represents approximately 5% value.

But this must remain configurable.

Admin should be able to define:

* Points required
* EGP value
* Minimum redemption amount
* Maximum points usable per order
* Whether points can be used with coupons
* Whether points can be used during promotions

---

# 9. Promotion Stacking

This is critical.

KHEM now has:

* Coupon codes
* Promotions
* Buy X Get Y
* Points
* Discovery credit

Do not allow uncontrolled stacking.

Create a clear discount/benefit resolution system.

Recommended default:

> **One promotional discount mechanism per order.**

For example, the customer should not automatically combine:

> 20% coupon + Buy 2 Get 1 + 500 points + Discovery Credit

unless explicitly permitted by admin.

However:

> Earning points

can happen after a qualifying purchase even when a promotion/coupon was used, based on the configured eligible paid amount.

The system should have an explicit concept of:

* discount
* reward
* credit
* promotion
* benefit

so these are not accidentally treated as the same thing.

---

# 10. Customer Rewards UI

Customers should clearly see their KHEM balance.

Preferred presentation:

> **Your KHEM Rewards**
>
> 340 KHEM Points
>
> **170 EGP available**
>
> 60 points away from your next reward.

Avoid making the UI feel like a generic supermarket loyalty program.

Keep it elegant, minimal, and consistent with KHEM's ivory / charcoal / gold luxury design system.

---

# 11. FEATURE B — Offers & Bundles

Do NOT hard-code "Buy 2 Get 1" as the only offer type.

Build a flexible **Offers & Bundles** system.

The first use case is:

> Buy 2 → Get 1 Free

But the architecture should support future offers such as:

* Buy 2 Get 1
* Buy 3 Get 1
* Buy X Get Y
* Buy 2 → receive percentage discount
* Buy from Collection A → receive item from Collection B
* Gift with purchase

---

# 12. Offer Admin Controls

Admin can create an offer with:

### Basic

* Offer name
* Internal description
* Customer-facing title
* Start date
* End date
* Active / inactive

### Trigger

Example:

> Buy 2 eligible products

Admin controls:

* Required quantity
* Eligible products
* Eligible collections

### Reward

Example:

> Get 1 free

Admin controls:

* Reward quantity
* Reward type
* Eligible reward products/collections
* Lowest-priced-item rule

For Buy 2 Get 1, recommended default:

> The lowest-priced eligible item becomes free.

This prevents customers from purchasing two low-priced products and receiving a significantly more expensive product for free.

---

# 13. Offer Eligibility

Admin should control who can use an offer:

* Everyone
* New customers
* Existing customers
* Newsletter subscribers
* Specific customer segment
* Invitation-only
* Customers with a specific coupon
* Other existing eligibility mechanisms

---

# 14. Offer Limits

Admin controls:

* Once per customer
* Once per order
* Unlimited
* Maximum redemptions
* Maximum redemptions per customer

---

# 15. Buy 2 Get 1 Example

Example:

Signature products:

* Product A = 890 EGP
* Product B = 1,470 EGP
* Product C = 2,200 EGP

Customer buys all three.

If the offer is:

> Buy 2 Get 1 Free

The free item should follow the configured rule.

Recommended:

> Lowest-priced eligible item is free.

Therefore:

> 890 EGP item = free

Customer pays:

> 1,470 + 2,200 = 3,670 EGP

Do not make the most expensive product automatically free.

---

# 16. FEATURE C — Discovery Set → Full-Size Purchase Credit

KHEM already has an existing feature:

> Customer buys a Discovery Set → the Discovery Set amount can be deducted from a future full-size purchase.

This feature is different from KHEM Points.

It should remain a **permanent conversion mechanism** designed to encourage customers to move from discovery to full-size fragrance.

---

# 17. Discovery Credit Admin Control

Add a very simple permanent setting:

### Discovery Credit

**[ ON / OFF ]**

This is intentionally simple.

The feature is permanent and does not need campaign/date/customer targeting in this version.

When ON:

> Eligible Discovery Set purchases create a credit that can be applied to an eligible future full-size order.

When OFF:

* New Discovery purchases do not create/use this benefit according to the intended business rule.
* All customer-facing messaging for this benefit must disappear.
* Existing valid credits should be handled safely according to the existing credit policy and must NOT be silently deleted.

Do not redesign the existing customer credit system unnecessarily.

---

# 18. Discovery Credit Messaging

When Discovery Credit is ON, add the following exact sentence to the **Discovery page banner**:

> **Each discovery purchase may be applied to full-size orders.**

Also add the same messaging to the **Discovery product/details section**.

The message must be controlled by the Discovery Credit ON/OFF setting.

### When ON

Show:

> Each discovery purchase may be applied to full-size orders.

### When OFF

The sentence must NOT appear anywhere in the customer-facing Discovery UI.

Do not leave empty spacing or broken layout after removing the message.

The UI should naturally reflow.

---

# 19. Discovery Credit Eligibility

Respect the existing KHEM Discovery Set credit implementation.

Do not create a second credit system if one already exists.

Use the existing customer credit / credit transaction architecture where possible.

The system should clearly distinguish:

* Discovery Credit
* KHEM Points
* Coupon discount
* Promotion discount

They are different benefit types.

---

# 20. Discovery Credit Redemption

When a customer later purchases an eligible full-size product:

Example:

Discovery Set:

> 400 EGP

Customer later purchases:

> 1,470 EGP perfume

Eligible credit:

> -400 EGP

Final eligible amount:

> 1,070 EGP

The credit should be consumed through a proper transaction record.

Do not simply modify the customer's balance without recording the transaction.

---

# 21. Interaction Between Discovery Credit and Points

Recommended default:

Customer buys Discovery Set:

* Discovery Credit is created
* Points are earned only if the Discovery Set is configured as points-eligible

When customer uses Discovery Credit on a full-size order:

* Points should be calculated from the final eligible amount actually paid.

Example:

Full-size:

> 1,470 EGP

Discovery Credit:

> -400 EGP

Paid:

> 1,070 EGP

If the earning rate is 10 points / 100 EGP:

> Points are calculated from 1,070 EGP, not 1,470 EGP.

Make this behavior explicit in the rewards engine.

---

# 22. Admin Dashboard — Customer View

Admin should be able to search a customer and see:

### Rewards

* Current points
* Lifetime points earned
* Lifetime points redeemed
* Expired points
* Points transaction history

### Discovery Credit

* Available credit
* Credit earned
* Credit used
* Credit remaining
* Credit transaction history

### Marketing benefits

Show active/used benefits where useful:

* Coupons
* Promotions
* Rewards
* Discovery Credit
* Offers

This will make customer support much easier.

---

# 23. Audit / Transaction History

All financial-value benefits must have a ledger.

At minimum:

### Points Ledger

* Customer
* Amount
* Type/source
* Reference order
* Description/reason
* Created date
* Expiration date if applicable

### Discovery Credit Ledger

* Customer
* Amount
* Type
* Reference order
* Created date
* Used date
* Remaining balance
* Expiration if applicable

Never rely only on the current balance.

The transaction history is the source of truth for auditing.

---

# 24. Admin UX Principles

The admin must make marketing configuration understandable without technical knowledge.

Avoid complicated forms.

Use sections:

### Status

`Enabled / Disabled`

### Earning

`Spend 100 EGP → Earn 10 Points`

### Redemption

`100 Points → 50 EGP`

### Rules

Toggle each rule independently.

### Eligibility

Existing KHEM targeting mechanisms.

### Limits

Clear usage limits.

### Dates

Only where relevant.

Use helpful examples beside settings.

---

# 25. Important Safety / Business Rules

Do not allow:

* Negative customer balances unless explicitly caused by a correction
* Duplicate points from the same order
* Duplicate Discovery Credit from the same Discovery purchase
* Credits to be reused after redemption
* Points to survive a full refund without reversal
* Promotion stacking accidentally
* Free-item calculation to select an unintended expensive product
* Disabled features to continue appearing in customer UI

All order-related rewards must be idempotent.

---

# 26. Marketing Philosophy

The implementation should support different KHEM marketing phases.

### Acquisition

Example:

> Sign up and receive 20% off your first order.

This can continue using the existing coupon/promotion system.

### Retention

Example:

> Join KHEM Rewards and earn points with every purchase.

### Discovery → Conversion

Example:

> Explore the fragrances first. Apply your Discovery purchase toward a full-size order.

### Basket Growth

Example:

> Choose 3 fragrances. Pay for 2.

These are different marketing goals and should remain independently controllable.

---

# 27. Recommended Customer Journey

### First visit

Customer sees:

> Discover KHEM

↓

### Signup

Customer receives existing welcome incentive, e.g.:

> 20% off first order

↓

### First purchase

Customer receives:

> KHEM Points

↓

### Customer explores

Customer buys Discovery Set.

↓

### Discovery conversion

Customer receives:

> Discovery Credit toward a full-size purchase.

↓

### Next purchase

Customer uses:

> Discovery Credit

and earns:

> KHEM Points based on eligible paid amount.

↓

### Future campaign

KHEM can activate:

> Buy 2 Get 1

or another Offer.

This creates a continuous customer relationship instead of relying only on coupons.

---

# 28. Do Not Implement VIP Levels

Do NOT implement:

* VIP tiers
* Silver / Gold / Platinum
* Collector levels
* Tier-based benefits

The architecture should remain extensible enough to support this in the future, but it is explicitly outside the current scope.

---

# 29. Implementation Requirements

Before writing code:

1. Inspect the existing promotion system.
2. Inspect the existing coupon system.
3. Inspect the existing customer credit / Discovery Set implementation.
4. Inspect the existing order/refund logic.
5. Inspect current admin architecture.
6. Identify existing tables/functions that can be reused.
7. Do NOT create duplicate tables or duplicate business logic if an existing system already provides the required functionality.

Then propose the database/schema changes before implementing them.

Preserve existing functionality.

Do not break:

* Existing coupons
* Existing promotions
* Existing newsletter
* Existing customer credits
* Existing checkout
* Existing order calculations
* Existing admin controls

---

# 30. Definition of Done

The feature is complete only when:

### Rewards

* Admin can enable/disable Rewards.
* Admin can configure earning rate.
* Admin can configure redemption rate.
* Admin can enable/disable earning rules.
* Customers can see their points.
* Customers can redeem points.
* Points are correctly calculated from eligible paid amounts.
* Refunds/cancellations correctly reverse points.
* No duplicate points can be created.
* Admin can manually adjust points.
* Full points ledger exists.

### Offers

* Admin can create Buy X Get Y offers.
* Buy 2 Get 1 works.
* Lowest-priced eligible item rule works.
* Product/collection eligibility works.
* Customer eligibility works.
* Date/activation controls work.
* Usage limits work.
* Offers do not accidentally stack with other benefits.

### Discovery Credit

* Existing Discovery Credit system is preserved/reused.
* Admin has a permanent ON/OFF switch.
* Discovery banner displays:
  "Each discovery purchase may be applied to full-size orders."
  when ON.
* Discovery details display the same sentence when ON.
* Both disappear when OFF.
* Layout remains clean when OFF.
* Existing credits are handled safely.
* Credit redemption is properly recorded.
* No duplicate credits can be created.

### Overall

* Existing marketing functionality remains intact.
* Checkout remains correct.
* Customer balances are auditable.
* Database operations are idempotent.
* Lint passes.
* Type-check passes.
* Build passes.
* Test the full customer journey from signup → purchase → reward → discovery credit → second purchase.
