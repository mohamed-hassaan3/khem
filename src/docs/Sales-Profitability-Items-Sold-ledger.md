Implement a new **Sales & Profitability / Items Sold ledger** for the KHEM admin.

### 1. Goal

I want a reliable historical record of **everything actually sold**, at item level, so later I can clearly see:

* What products/items were sold
* Quantity sold
* Original selling price
* Discount amount
* Promotion/coupon/Rewards/Discovery Credit impact
* Whether the item was free
* Amount the customer actually paid for the item
* Our product cost
* Gross profit
* Profit margin

This is for future sales analysis, migration, accounting, and understanding **how much KHEM spent vs. how much KHEM actually earned**.

**IMPORTANT:** Do NOT replace or redesign the existing Orders/Bills system. Build this alongside it and reuse the existing order data/calculation logic.

---

## 2. First AUDIT the existing order system

Before writing migrations/code, inspect:

* `Order`
* `OrderItem`
* `place_order()`
* current order totals
* shipping
* taxes if applicable
* Promotions
* Coupon Codes
* Rewards/Points
* Discovery Credit
* refunds/cancellations
* online/offline order handling
* existing product price fields
* any existing product cost/COGS fields
* existing admin order/bill UI

Understand exactly where the final paid amount is calculated.

**Do not create duplicate order-pricing logic.**

The new ledger must use the same authoritative calculation used by the existing checkout/order system.

---

# 3. Historical Sales Ledger

Create a dedicated immutable/snapshot-style table, e.g.

`order_item_sales_ledger`

(or use a better name if the existing schema has a strong naming convention).

Each sold item should record at minimum:

### Order reference

* `id`
* `order_id`
* `order_item_id`
* `created_at`

### Product snapshot

* `product_id`
* product name snapshot
* SKU/reference snapshot if available
* collection/category snapshot if useful

Do NOT rely only on the current Product table for historical reporting.

If the product name or price changes later, the historical sale must remain accurate.

### Quantity

* `quantity`

### Price snapshot

Store monetary values in the same integer currency-unit convention already used by the project.

* `original_unit_price`
* `original_line_total`

### Discount

* `discount_amount`
* `discount_percentage` if useful
* discount source/type:

  * promotion
  * coupon
  * rewards
  * discovery_credit
  * offer/bundle
  * other
* reference/id if the existing architecture provides one

### Actual customer payment

* `paid_amount`

For a normal item:

`original price - applicable discount = actual paid amount`

For a free Buy X Get Y item:

`paid_amount = 0`

Add:

* `is_free`

### Cost / profitability

* `unit_cost`
* `total_cost`
* `gross_profit`

Formula:

`gross_profit = paid_amount - total_cost`

And:

`gross_margin_percentage = gross_profit / paid_amount * 100`

Handle zero-paid/free items safely so there is no divide-by-zero problem.

---

# 4. VERY IMPORTANT: Snapshot historical values

Do NOT calculate historical reports using today's Product price.

Example:

Today:

Product price = 1,800 EGP
Customer receives 10% discount
Customer pays = 1,620 EGP

The ledger must permanently store:

* Original = 1,800
* Discount = 180
* Paid = 1,620

If the product becomes 2,000 EGP next year, the old order must STILL report 1,800 / 180 / 1,620.

Same principle for product cost.

If possible, snapshot the cost at the time of sale:

`unit_cost_at_sale`

This is critical for future profitability reporting.

---

# 5. Cost management

Audit whether Products already have a cost/COGS field.

If one exists, reuse it.

If it does NOT exist, add a simple admin-controlled:

**Product Cost**

This is NOT the customer selling price.

Example:

Selling price: 1,800 EGP
Product cost: 650 EGP

The ledger snapshots 650 EGP when sold.

Do not invent complicated inventory accounting.

For now, we need a reliable **COGS/product cost snapshot**.

---

# 6. Discounts and free products

The ledger must correctly represent every existing benefit mechanism.

Examples:

### Coupon

Original = 1,470
Coupon = 10%
Paid = 1,323

Ledger:

`original = 1470`
`discount = 147`
`paid = 1323`

### Promotion

If promotion changes the product price:

Original = 1,800
Promotion price = 1,440

Ledger:

`original = 1800`
`discount = 360`
`paid = 1440`

### Buy 2 Get 1

If products are:

890 + 1,470 + 2,200

and the lowest eligible item is free:

* 890 → paid 0 → free
* 1,470 → paid 1,470
* 2,200 → paid 2,200

The ledger must clearly show the 890 item as:

`is_free = true`
`paid_amount = 0`

Do NOT automatically make the most expensive product free.

### Discovery Credit

If:

Product = 1,470
Discovery Credit = 400

The order may show:

Original = 1,470
Discount/Credit = 400
Paid = 1,070

Do not confuse Discovery Credit with a normal product promotion.

### Rewards Points

If points are redeemed, make sure the ledger can identify the reduction separately from normal product discounts.

Do not create a second pricing engine.

---

# 7. Orders with multiple items

Every `OrderItem` must have its own ledger row.

Example:

Order total = 4,000

with 3 products:

| Product | Original | Discount |  Paid |
| ------- | -------: | -------: | ----: |
| A       |    1,000 |      100 |   900 |
| B       |    1,500 |        0 | 1,500 |
| C       |    1,500 |    1,500 |     0 |

The ledger must preserve all three rows.

This is important because later I want to know exactly **which products generated revenue and which products were given free/discounted**.

---

# 8. Refunds and cancellations

Audit the existing refund/order-status architecture.

Do NOT duplicate the existing refund system.

The sales reporting must distinguish between:

* sold
* paid
* refunded
* cancelled

If an order/item is refunded, reporting must not continue to count the refunded amount as earned revenue.

Prefer recording/referring to the existing refund information rather than creating a competing refund engine.

If the existing architecture supports partial refunds, make the reporting work correctly for them.

---

# 9. Online + Offline

This ledger must support BOTH:

* Online orders
* Offline/admin-created orders

Do not implement it only for storefront checkout.

Add an order/source field if the existing schema does not already provide one:

* `online`
* `offline`

Use the project's existing convention if one already exists.

---

# 10. Admin: Sales & Analytics

Add a new admin section:

**Sales & Analytics**

Do NOT hide this inside Orders.

### Overview

Show:

* Total Orders
* Items Sold
* Gross Sales / Original Value
* Total Discounts
* Actual Revenue
* Total Product Cost
* Gross Profit
* Gross Margin %

Example:

**Original Sales Value:** 100,000 EGP
**Discounts:** -12,000 EGP
**Actual Revenue:** 88,000 EGP
**Product Cost:** 45,000 EGP
**Gross Profit:** 43,000 EGP
**Margin:** 48.9%

Be very clear that:

**Actual Revenue ≠ Profit**

Profit is after product cost.

---

# 11. Admin: Items Sold table

Create a detailed table called:

**Items Sold**

Columns:

* Date
* Order
* Product
* SKU
* Qty
* Original Price
* Discount
* Paid
* Cost
* Profit
* Status

Optional useful indicator:

* Free
* Promotion
* Coupon
* Rewards
* Discovery Credit

Example:

| Date  | Product   | Qty | Original | Discount |  Paid |  Cost | Profit |
| ----- | --------- | --: | -------: | -------: | ----: | ----: | -----: |
| Sep 6 | KHEM Noir |   1 |    3,200 |      640 | 2,560 | 1,100 |  1,460 |
| Sep 6 | Signature |   1 |    1,800 |    1,800 |     0 |   600 |   -600 |

The free product should be visually obvious.

---

# 12. Filters

The Items Sold page should support:

* Date range
* Product
* Collection
* SKU
* Online / Offline
* Promotion
* Coupon
* Rewards
* Discovery Credit
* Free items
* Paid items
* Refunded
* Cancelled

Also provide search by:

* product
* order number

---

# 13. Order drill-down

Clicking an order should open the existing order/bill details.

Do NOT create a second bill system.

The Sales Ledger is an analytical layer connected to the existing order.

---

# 14. Product performance

Add a simple summary view that can answer:

**Which products actually make money?**

For each product:

* Units sold
* Original sales value
* Discounts
* Actual revenue
* Product cost
* Gross profit
* Margin %

Example:

**KHEM Noir**

* 35 sold
* 112,000 original value
* 8,500 discounts
* 103,500 actual revenue
* 38,500 cost
* 65,000 gross profit

This will help identify our strongest products.

---

# 15. Date reporting

Allow:

* Today
* This week
* This month
* This year
* Custom range

Do not use the current product price for historical periods.

Reports must use the ledger snapshots.

---

# 16. Migration strategy

Before migration:

1. Audit the existing database.
2. Confirm all existing OrderItems contain enough information to reconstruct historical sales.
3. Confirm how historical product cost should be handled.

Create a migration for the new ledger.

For existing orders:

* Backfill ledger rows where reliable data exists.
* Do NOT fabricate historical cost if no historical cost exists.
* If historical cost cannot be determined, keep it `NULL` and make the admin UI show **Cost unavailable** rather than inventing a number.

For new orders:

* Ledger rows must be created automatically as part of the authoritative order-placement flow.
* It must happen transactionally with the order.
* Never create a ledger row for an order that ultimately fails.

---

# 17. Idempotency

This is critical.

The same order must NEVER create duplicate sales-ledger rows.

Use an appropriate unique constraint, likely based on:

`order_item_id`

or the correct existing identifier if an OrderItem can be recreated.

The order flow must be safe if retried.

---

# 18. Do NOT break existing systems

This feature must NOT break:

* Orders
* Bills
* Checkout
* Promotions
* Coupon Codes
* Rewards
* Discovery Credit
* Buy X Get Y
* Refunds
* Online orders
* Offline orders
* Existing admin order management

Do not duplicate pricing calculations.

Do not modify the existing customer-facing checkout unless absolutely necessary.

---

# 19. Important accounting terminology

Use clear labels in the UI:

**Original Sales Value**
= value before discounts

**Discounts**
= value given away through promotions/coupons/etc.

**Actual Revenue**
= amount customer actually paid for merchandise

**Product Cost / COGS**
= our cost for the products sold

**Gross Profit**
= Actual Revenue − Product Cost

**Gross Margin**
= Gross Profit ÷ Actual Revenue × 100

Do NOT call Actual Revenue “Profit.”

Also keep shipping separate from merchandise revenue unless the existing accounting model explicitly treats it differently.

---

# 20. Future-ready, but DON'T overbuild

Architecture should allow future reporting for:

* payment fees
* shipping cost
* packaging cost
* marketing cost
* net profit

But **do not implement a full accounting system now**.

For this phase, focus on:

**Products sold → discounts → actual paid → product cost → gross profit.**

---

# 21. Verification

After implementation, verify:

### Normal sale

1,800 product → customer pays 1,800.

### Coupon

1,800 → 10% coupon → 1,620 paid.

### Promotion

Promotion price correctly reaches checkout and ledger.

### Buy 2 Get 1

890 + 1,470 + 2,200 → 890 free → 3,670 paid.

### Discovery Credit

1,470 → 400 credit → 1,070 paid.

### Rewards

Verify redeemed points reduce the correct amount and the ledger does not confuse points with product discounts.

### Refund

Verify refunded revenue is not incorrectly counted as earned revenue.

### Offline order

Verify offline/admin-created sale appears in Items Sold.

### Historical price

Change a product price after an order and verify the old ledger row does NOT change.

### Idempotency

Retry the same order operation and verify no duplicate ledger row.

### Build checks

Run:

* `npm run lint`
* `npx tsc --noEmit`
* `npm run build`
* `npm run db:migrate`
* `npm run db:verify`

Also add functional SQL checks for the major pricing/discount scenarios above.

---

## Final requirement

Before coding, give me a short audit of the existing schema and tell me:

1. Which existing tables/functions you will reuse.
2. Which new table(s)/fields you propose.
3. How you will calculate/snapshot Original / Discount / Paid / Cost / Profit.
4. How existing orders will be backfilled.
5. How online and offline orders will enter the ledger.

Then implement it.

**Do not start by blindly creating tables. Audit first, reuse existing architecture, and keep the current order system as the source of truth.**
