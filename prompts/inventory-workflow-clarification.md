Yes. Since you **did not send the previous clarification**, use **only this one**. It combines everything clearly and avoids assuming that the existing Product Stock field is disconnected.

Save it as:

`prompts/inventory-workflow-clarification.md`

````md
# Inventory Workflow Clarification — Read Before Continuing

There has been a possible misunderstanding about the inventory architecture.

Originally, the project had a single/general product stock system, mainly intended for Online sales.

Now I need KHEM to support two separate inventory channels:

- Online stock
- Offline stock

Before continuing with the inventory reset or making further destructive changes, audit the current implementation and make sure the final architecture is clear.

---

## 1. Audit the Existing Product Stock System First

In:

`/admin/products/[slug]`

there is an existing **Stock** input.

I noticed that changing this value does change the product's existing stock.

Therefore, do NOT assume this field is disconnected or remove it blindly.

I need you to trace exactly what it currently does.

Please determine:

1. Which database field/table does the existing Product Stock input update?
2. Which parts of the application read this value?
3. Does the storefront use it for availability?
4. Does checkout/order processing use it?
5. Does it currently represent the old Online/general stock system?
6. Does it update the new Online inventory counter?
7. Does it have any relationship with Offline inventory?
8. Are there currently duplicate sources of truth for stock?

Do not remove or migrate anything until this data flow is fully understood.

---

# 2. Required Final Inventory Model

The final system must support two separate stock channels for every product:

```text
PRODUCT
   │
   ├── ONLINE STOCK
   │
   └── OFFLINE STOCK
````

The architecture must avoid conflicting values such as:

```text
Product Stock: 20
Online Stock: 29
Offline Stock: 55
```

if these values are independent.

There must be a clear source of truth and a safe migration path from the old single-stock system to the new Online/Offline model.

---

# 3. Storefront Uses Online Stock Only

The website sells from Online inventory.

Example:

```text
Online: 0
Offline: 20
```

The storefront must show the product as unavailable/sold out online.

Offline stock must not make a product available for Online purchase.

Example:

```text
Online: 10
Offline: 0
```

The storefront can sell the 10 Online units.

Please verify this behaviour.

---

# 4. Orders Must Drive Inventory

The Admin Orders system includes creating a new order/record with a channel:

* Online
* Offline

This is important and should be connected directly to inventory.

## Online Order

When an Online order affects stock:

```text
Online Order
      ↓
Online stock decreases
      ↓
Inventory History records Sale
```

Example:

```text
Online stock: 29
Order quantity: 2

29 → 27
```

History:

```text
Channel: Online
Action: Sale
Change: -2
Reason: Order KHEM-XXXX
```

## Offline Order

When creating an Offline order:

```text
Offline Order
      ↓
Offline stock decreases
      ↓
Inventory History records Sale
```

Example:

```text
Offline stock: 55
Order quantity: 3

55 → 52
```

History:

```text
Channel: Offline
Action: Sale
Change: -3
Reason: Order KHEM-XXXX
```

My goal is that daily physical/boutique sales can be recorded as Offline orders.

I should not need to manually change a stock number simply to record a normal sale.

---

# 5. Cancellation and Stock Return

If an order is cancelled, stock must return to the same channel it originally came from.

Example:

```text
Online Order

Online: 29 → 27

Order cancelled

Online: 27 → 29
```

Likewise:

```text
Offline Order

Offline: 55 → 52

Order cancelled

Offline: 52 → 55
```

Stock must never accidentally return to the wrong channel.

---

# 6. Inventory Actions

Directly changing a stock quantity must not be the normal way to record sales.

The inventory system must clearly distinguish the following movement types.

## A. Sale

Normally created through an Order.

```text
Action: Sale
Change: -3
```

## B. Restock / Add Stock

Used when new inventory arrives.

Example:

```text
Channel: Offline
Quantity: +20
Reason: New shipment
```

History:

```text
Action: Restock
Change: +20
```

## C. Transfer

Used when inventory moves between channels.

Example:

```text
Offline → Online
Quantity: 10
```

Result:

```text
Offline: 55 → 45
Online: 29 → 39
```

The ledger must clearly record the transfer.

## D. Stock Adjustment / Physical Count Correction

Used only when correcting a discrepancy.

Example:

```text
System quantity: 55
Physical count: 53
```

History:

```text
Action: Adjustment
Change: -2
Before → After: 55 → 53
Reason: Physical stock count
```

A normal sale must never appear simply as:

```text
Counted correction
```

---

# 7. Inventory Admin UI

The main Inventory page should show the current stock clearly:

```text
PRODUCT

Online: X
Offline: X
```

It should provide clear inventory management actions where appropriate.

The system must make it obvious whether an action is:

* Sale
* Restock
* Transfer
* Adjustment

The admin should not accidentally change stock without understanding what kind of movement is being recorded.

---

# 8. Inventory History / Ledger

Every stock movement must be recorded.

The history should clearly show:

* Date and time
* Product
* Channel
* Action
* Quantity change
* Before → After
* Reason
* Related Order or Reference
* Performed By

Action types must remain distinct:

* Sale
* Returned to Stock
* Restock
* Transfer
* Adjustment / Counted Correction

The History should also support useful filters:

* Channel
* Movement type
* Product
* Date range
* Search by product name, order number, or reference where supported

Filters should work together and include a Clear/Reset filters action.

Default history should show all movements, newest first.

---

# 9. Product Admin Stock UI

After auditing the existing Stock field in:

`/admin/products/[slug]`

update the UI so it cannot confuse the administrator.

I do not want an unclear field such as:

```text
Stock: 20
```

without knowing whether it means:

* Online stock
* Offline stock
* Total stock
* Legacy stock

First determine what the existing field currently controls.

Then propose the safest final solution.

A possible final UI could be:

```text
INVENTORY

Online: 29
Offline: 55

[ Manage Inventory ]
```

However, do not implement this blindly.

The existing stock system may still be required by the storefront or other logic, so audit it first and migrate safely if necessary.

---

# 10. Required Audit Report

Before making destructive changes, report clearly:

## Current Architecture

Explain:

* What the original Product Stock field does
* Which database field/table it updates
* What parts of the application use it
* How Online inventory is currently stored
* How Offline inventory is currently stored
* Whether the storefront reads the correct Online stock
* Whether duplicate sources of truth currently exist

## Proposed Final Architecture

Show the complete data flow:

```text
PRODUCT
   ↓
ONLINE / OFFLINE INVENTORY
   ↓
ORDERS / RESTOCK / TRANSFER / ADJUSTMENT
   ↓
INVENTORY HISTORY / LEDGER
```

Clearly explain how the old single-stock system will safely transition to the new Online + Offline model.

---

# 11. Production Safety

Do NOT:

* Delete stock data
* Remove the existing Product Stock field
* Remove database columns
* Migrate or overwrite stock quantities blindly
* Delete test/customer/order data
* Run destructive reset operations

until:

1. The existing stock system is fully traced.
2. The Online and Offline architecture is confirmed.
3. Any duplicate source of truth is resolved safely.
4. The migration plan is presented.
5. I explicitly approve destructive operations.

The purpose of this clarification is to prevent breaking the existing Online inventory system while expanding KHEM to support both Online and Offline inventory.

---

# 12. Verification Required

After implementing the corrected architecture, verify at minimum:

1. Changing stock through the proper inventory workflow affects the correct channel.
2. Online orders decrease Online stock only.
3. Offline orders decrease Offline stock only.
4. Cancelled orders return stock to the original channel.
5. Restocking creates a Restock movement.
6. Transfers correctly decrease one channel and increase the other.
7. Adjustments are clearly different from Sales.
8. The storefront uses Online stock for availability.
9. Product Admin does not show misleading or duplicate stock information.
10. Every movement appears correctly in Inventory History.
11. History filters work correctly together.
12. TypeScript and ESLint pass.

Do not commit yet. Present the audit findings and implementation results for review before proceeding with the destructive reset.

---

# AUDIT REPORT

Performed against production `ttekisapxjforpawnnla` after `0042` was applied.
No destructive operation was run. No stock data was deleted. No column was
removed.

## 1. What the `/admin/products/[slug]` Stock field does

Traced end to end:

```
ProductForm.tsx  "Stock" input
      ↓  payload.inventory
src/schemas/admin.ts  productFields.inventory
      ↓
src/actions/admin/catalog.ts  updateProduct() → .update({ ...rest })
      ↓
"Product"."inventory"
```

**Before 0042** it was the single, general stock column. It was authoritative:
the storefront read it for availability, `place_order()` checked and decremented
it, and `restock_order()` returned units to it. Your observation was correct.

**After 0042 it silently stopped working**, and this audit is what caught it.
`0042` added a `sync_inventory_total` trigger that recomputes
`"inventory" = "inventoryOnline" + "inventoryOffline"` on every write, so a form
save writes a value the database immediately discards.

Measured on `opal-body-mist`:

| | inventory | online | offline |
| :-- | --: | --: | --: |
| before | 29 | 29 | 0 |
| after writing `inventory = 999` | **29** | 29 | 0 |

No error was returned, and **no ledger row was written**. The field reported
success and changed nothing. That is a regression introduced by 0042, not a
pre-existing condition, and it is fixed below.

### Answers to the eight questions

1. **Which field?** `"Product"."inventory"`.
2. **Who reads it?** Before 0042: the storefront projections, the cart ceiling,
   every sold-out test, `place_order()`, `restock_order()`, the admin table.
   After 0042: only readers that have not been migrated — and all of them have.
3. **Storefront availability?** It did. It no longer does: the catalog
   projections alias `"inventoryOnline"` to `inventory`, so the storefront reads
   the online counter.
4. **Checkout/orders?** It did. `place_order()` now moves the counter named by
   the order's channel.
5. **Was it the old online/general stock?** Yes — one number for both the
   website and the desk, which is the problem this workstream exists to fix.
6. **Does it update the new online counter?** **No.** It updates nothing.
7. **Relationship with offline?** None, and it never had one.
8. **Duplicate sources of truth?** **Yes, until this fix** — an editable field on
   the product form and two counters on the inventory screen, disagreeing
   silently. Now there is one source: the counters. `"inventory"` is a derived
   total, and no UI writes to it.

## 2. Final architecture

```
PRODUCT
  ├── "inventoryOnline"   ← the only thing the storefront may sell
  └── "inventoryOffline"  ← the counter's
        │
        │   "inventory" = online + offline, maintained by trigger, read-only,
        │   kept so unmigrated readers see a truthful total. Retire later.
        ↓
ORDERS (channel-driven)          move_stock()          DESK OPERATIONS
  ONLINE order  → online −n         ── the only ──     Restock   (receive_stock)
  OFFLINE order → offline −n         mutation path     Transfer  (transfer_stock)
  cancelled     → same channel +n                      Adjustment(set_channel_stock)
        ↓
"InventoryMovement" — every change, in the same transaction as the change
```

**Migration path taken:** the existing figure was backfilled into **online**,
because that is what the website had been selling against; offline opened at
zero and is filled by the approved opening-balance step. Nothing was
overwritten, and the backfill is guarded against re-runs.

## 3. Corrections made after this clarification

| Issue | Fix |
| :-- | :-- |
| Product form's Stock field wrote to a trigger-owned column | Removed from `productFields`; the form now shows **Online / Offline read-only** with links to Manage inventory and Stock history |
| New products had a required Stock field that would not have worked | Replaced with a line explaining that stock is added from Inventory, so the first arrival is a recorded movement rather than a number appearing from nowhere |
| Action names did not match the house vocabulary | Centralised in `INVENTORY_ACTION_LABEL`. `RECEIPT` reads **"Restock"** (a delivery arriving) and `RESTOCK` reads **"Returned to stock"** (a cancelled order) — two different events the desk names differently |
| History had no filters and was per-product only | New `/admin/inventory/history`: channel, movement type, product, date range, free-text search, and **Clear filters**. Filters combine rather than replace one another |

## 4. Verification

| § 12 requirement | Result |
| :-- | :-- |
| 1. Proper workflow affects the correct channel | ✅ receive +20 offline, sale −3 offline, transfer 10 → online 39 / offline 7 |
| 2. Online orders decrease online only | ✅ 29 → 27, offline unchanged at 5 |
| 3. Offline orders decrease offline only | ✅ 5 → 4, online unchanged at 27 |
| 4. Cancellation returns to the original channel | ✅ both orders restored their own counter |
| 5. Restock creates a Restock movement | ✅ `RECEIPT +20`, shown as "Restock" |
| 6. Transfer moves both channels | ✅ two rows, `TRANSFER_OUT −10` and `TRANSFER_IN +10` |
| 7. Adjustments distinct from sales | ✅ separate action and label; sales now come from orders |
| 8. Storefront uses online for availability | ✅ online 0 / offline 20 renders "Sold Out" with add-to-cart, Buy Now and both steppers `disabled` |
| 9. Product admin not misleading | ✅ read-only Online / Offline, no writable Stock field |
| 10. Every movement appears in history | ✅ 16 rows, all six action types present |
| 11. Filters work together | ✅ channel ∩ action ∩ product narrows correctly; out-of-range dates return 0; newest first |
| 12. TypeScript and ESLint | ✅ both clean |

**Not verified visually:** every `/admin/*` route returns 307 to an anonymous
request, so the rendered tables, the read-only product panel and the history
filters have not been seen in a browser. They compile and their routes resolve.
Check them signed in as an admin.

## 5. Still outstanding

- Two cancelled verification orders remain in production: **KHEM-2026-1072**,
  **KHEM-2026-1073**. Stock was returned by the cancellation.
- The destructive reset (§6 of the original brief) has **not** been started and
  remains behind its approval gate.
- `"Product"."inventory"` still exists as a derived total. Retiring it is a
  later migration, once nothing reads it.
