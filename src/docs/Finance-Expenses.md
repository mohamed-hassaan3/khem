Add a new **Finance & Expenses** system that integrates with the existing **Sales & Profit** ledger.

The goal is to make KHEM able to clearly answer:

> How much did we sell?
> How much did the products cost us?
> How much did we spend running the business?
> How much did we actually make?
> Did we reach our monthly target?

### 1. Do NOT rebuild Sales & Profit

Keep the existing Sales & Profit / Items Sold ledger as the source for:

* Sales
* Discounts
* Actual paid revenue
* Product cost / COGS
* Gross profit

The new Finance system should consume those numbers.

---

# 2. New Admin Section: Finance

Create:

**Admin → Finance**

with these sections:

### Dashboard

The main financial overview.

### Expenses

Manage all business expenses.

### Targets

Set monthly revenue/profit targets.

### Reports

Detailed monthly/daily/custom-period analysis.

---

# 3. Expenses

Create an expense ledger where admin can add:

* Expense name
* Category
* Amount
* Date
* Recurring / One-time
* Notes
* Optional supplier/vendor
* Optional attachment/reference
* Status

### Default categories

Create these categories:

**Operations**

* Rent
* Electricity
* Water
* Internet
* Phone
* Facility / Maintenance
* Cleaning
* Security
* Other Operations

**People**

* Salaries
* Freelancers
* Commissions
* Other Staff Costs

**Business**

* Taxes
* Licenses
* Insurance
* Accounting
* Legal
* Bank / Payment Fees
* Software / Subscriptions

**Marketing**

* Advertising
* Influencers
* Photography / Video
* Events
* Printing
* Other Marketing

**Production / Packaging**

* Packaging
* Bottles
* Boxes
* Labels
* Accessories
* Raw Materials
* Other Production

**Other**

* Miscellaneous

Make categories admin-manageable in the future, but ship with the above defaults.

---

# 4. Recurring expenses

This is important.

Admin should be able to mark an expense as:

**One-time**
or
**Recurring**

For recurring expenses allow:

* Monthly
* Yearly

Example:

Rent = 40,000 EGP/month
Internet = 1,000 EGP/month
Salary = 15,000 EGP/month

The system should generate the expected expense for each applicable period without creating duplicate records.

Do not silently change historical expenses if the recurring amount changes later.

---

# 5. Expense vs Product Cost

Keep these completely separate.

### COGS / Product Cost

Already comes from Sales & Profit:

> Cost of the products actually sold.

### Operating Expenses

Come from Finance:

> Rent, electricity, salaries, taxes, marketing, etc.

Example:

Sales Revenue = 200,000
Product Cost = 80,000

**Gross Profit = 120,000**

Then:

Rent = 30,000
Salaries = 25,000
Electricity = 5,000
Marketing = 10,000
Taxes = 5,000

Total Operating Expenses = 75,000

**Net Profit = 45,000**

This distinction is critical.

---

# 6. Financial Dashboard

Create a premium, clean KHEM dashboard showing:

### Revenue

Actual merchandise revenue from Sales & Profit.

### COGS

Product costs from Sales & Profit.

### Gross Profit

`Revenue - COGS`

### Operating Expenses

Total expenses from Finance.

### Net Profit

`Gross Profit - Operating Expenses`

### Net Margin

`Net Profit / Revenue × 100`

If revenue is zero, handle safely.

---

# 7. Monthly Target System

Create a **Targets** section.

Admin can define:

### Revenue Target

Example:

September → 300,000 EGP

### Gross Profit Target

Example:

September → 180,000 EGP

### Net Profit Target

Example:

September → 100,000 EGP

Make these independent and optional.

The system should show:

**Target**
**Actual**
**Remaining**
**Achievement %**

Example:

Net Profit Target: 100,000
Actual: 72,000
Remaining: 28,000
Achievement: 72%

---

# 8. Daily Target / Required Pace

This is important for management.

If the monthly target is 300,000 EGP and there are 30 days:

**Average Daily Target = 10,000 EGP**

Show:

* Monthly target
* Days elapsed
* Days remaining
* Actual revenue
* Required average per remaining day

Example:

Target = 300,000
Actual = 120,000
Remaining = 180,000
Days remaining = 12

Required daily revenue:

**15,000 EGP/day**

This should update automatically based on the selected date.

---

# 9. Charts

Create charts that can switch between:

**Daily**
**Monthly**
**Custom date range**

### Revenue vs Target

Show actual revenue against target.

### Gross Profit

Show gross profit over time.

### Net Profit

Show net profit over time.

### Expenses

Show total expenses over time.

### Expense Breakdown

Show where money is going:

Rent / Salaries / Marketing / Utilities / Taxes / etc.

### Revenue vs Expenses vs Net Profit

A clear management chart showing the relationship between:

Revenue → Expenses → Net Profit.

Do not make the dashboard visually crowded.

KHEM style:
**Ivory / Sand / Charcoal / Gold**
with elegant minimal charts.

---

# 10. Custom Date Range

Reports must support:

* Today
* Yesterday
* This week
* This month
* Previous month
* This year
* Custom date range

All calculations must respect the selected period.

---

# 11. Monthly comparison

Allow:

**September vs August**
**2026 vs 2025**

Show:

* Revenue change %
* Gross profit change %
* Expenses change %
* Net profit change %

Example:

Revenue:
+18.4%

Expenses:
+6.2%

Net Profit:
+31.7%

---

# 12. Expense table

Admin should see:

| Date | Expense | Category | Amount | Recurring | Status |
| ---- | ------- | -------- | -----: | --------- | ------ |

Filters:

* Date
* Category
* Recurring
* One-time
* Status

Allow:

* Add
* Edit
* Delete/void
* Search

Historical records should remain auditable.

Prefer void/archive over destructive deletion when appropriate.

---

# 13. Financial calculation

Use this hierarchy:

**Gross Sales / Original Value**
→ discounts
→ **Actual Revenue**
→ COGS
→ **Gross Profit**
→ Operating Expenses
→ **Net Profit**

Do NOT subtract operating expenses from gross sales directly.

Formula:

`Gross Profit = Actual Revenue - COGS`

`Operating Expenses = sum(expense ledger)`

`Net Profit = Gross Profit - Operating Expenses`

`Gross Margin = Gross Profit / Actual Revenue`

`Net Margin = Net Profit / Actual Revenue`

---

# 14. Important: payment/shipping treatment

Audit the existing order architecture before implementing this.

Keep these concepts separate where possible:

* Merchandise revenue
* Shipping charged to customer
* Shipping cost
* Payment processing fees

Do not accidentally count shipping/customer fees as product revenue.

If the current system does not have enough information for true net profit, show **Gross Profit** and **Operating Expenses** accurately and leave future cost categories ready for expansion rather than inventing numbers.

---

# 15. Accounting audit trail

Every expense should have:

* Created by
* Created date
* Updated by
* Updated date
* Amount
* Category
* Date
* Status

Do not allow historical reports to change because an expense category/name was renamed later.

Use snapshots/references where appropriate.

---

# 16. Database strategy

Before coding:

**AUDIT FIRST.**

Inspect:

* existing Sales & Profit ledger
* Orders / OrderItems
* product cost / COGS
* refunds
* existing admin permissions
* currency handling
* date handling
* online/offline orders

Then propose the schema.

Likely new entities:

### `expenses`

The actual expense records.

### `expense_categories`

Manageable expense categories.

### `expense_recurring_rules`

Rules for recurring expenses.

### `financial_targets`

Monthly targets.

Use the project's existing naming and migration conventions.

Do not duplicate existing tables or calculations.

---

# 17. Historical integrity

Historical financial data must not change unexpectedly.

Example:

September rent = 40,000.

If October rent becomes 45,000:

September must remain:

40,000

October:

45,000

Likewise, changing a product's selling price or cost must NOT change historical Sales & Profit records.

---

# 18. Sales integration

The Finance Dashboard must automatically read the existing Sales & Profit ledger.

Do NOT manually enter sales into Finance.

Sales should flow:

**Orders → Sales Ledger → Financial Dashboard**

Expenses flow:

**Expense Ledger → Financial Dashboard**

Then:

**Sales + Expenses → Financial Result**

---

# 19. Example final dashboard

For September:

**Revenue**
300,000 EGP

**COGS**
110,000 EGP

**Gross Profit**
190,000 EGP

**Operating Expenses**
75,000 EGP

**Net Profit**
115,000 EGP

**Net Margin**
38.3%

**Net Profit Target**
100,000 EGP

**Achievement**
115%

Then show:

* Revenue vs target
* Net profit vs target
* Daily performance
* Expense breakdown
* Monthly comparison

---

# 20. Important business principle

This system is NOT intended to become a complicated accounting/ERP platform.

The purpose is a simple KHEM management tool that lets me understand:

**What we sold → What it cost → What we spent → What we earned → Whether we reached our target.**

Keep the UX extremely clear and premium.

---

# 21. Verification

Before implementation, provide a short audit and schema proposal.

After implementation verify:

* Existing Sales & Profit still works.
* Existing Orders/Bills are untouched.
* Existing Promotions/Coupons/Rewards/Discovery Credit remain untouched.
* Online and Offline sales are included.
* Expense creation works.
* Recurring expenses work without duplication.
* Monthly targets work.
* Daily required pace is correct.
* Custom date ranges work.
* Gross Profit is correct.
* Net Profit is correct.
* Refunds are handled correctly.
* Historical prices/costs remain unchanged.
* No duplicate financial records.

Run:

`npm run lint`

`npx tsc --noEmit`

`npm run build`

`npm run db:migrate`

`npm run db:verify`

Also create functional checks for the calculations.

**Do not start coding until you audit the existing Sales & Profit implementation and explain how Finance will connect to it without creating duplicate logic.**
