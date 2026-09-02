# Inventory: Online/Offline Channels, Movement Ledger, and the Test-Data Reset

Source brief: `src/docs/Product-Landing-Page-Navigation-Inventory-Updates.md` §5 and §6.
Decisions: `src/docs/Confirmed-Four-Workstreams-Is-the-Right-Approach.md` §2 and §3.

The largest and riskiest of the four. Independent of the other three, but its two
halves are **strictly ordered**: channels and ledger first, reset second.

> ## ⛔ Destructive-operation gate
>
> Part 2 (the customer/test-data reset) targets the **production** Supabase
> project `ttekisapxjforpawnnla`. No `DELETE`, no `TRUNCATE` and no destructive
> migration may run until:
>
> 1. the live schema and every foreign-key relationship have been inspected
>    directly against the production database — not inferred from
>    `supabase/sql/` and not from this document;
> 2. a backup has been created or an existing one confirmed restorable;
> 3. a written statement of exactly which tables and row counts will be deleted
>    has been given to the user;
> 4. **the user has explicitly approved that statement.**
>
> Part 1 may proceed without this gate. Part 2 may not. If the two are being done
> in one sitting, stop and ask between them.

---

## Goal

Give the house one place to control stock across two independent channels, with
a complete audit trail of every movement; then reset test data and seed opening
quantities.

## Skills read

- `AGENTS.md` §6 (layers), §9 (schema), §12
- `.agents/skills/supabase` — migrations, service-role usage, RLS
- No AI SDK or Vercel platform surface is involved.

## Existing code inspected

| Concern | Where |
| :-- | :-- |
| The single stock column | `supabase/sql/0001_catalog.sql:116` — `inventory int not null default 0 check (inventory >= 0)` |
| Order channel enum | `supabase/sql/0015_orders.sql:60` — `OrderChannel` = `ONLINE` \| `OFFLINE` |
| Sale path | `place_order()` — **latest definition `supabase/sql/0040_discount_refusal_detail.sql:392-420`** |
| Restock path | `set_order_status()` — latest in `supabase/sql/0028_discounts.sql`; restocks on cancel |
| Manual correction | `src/actions/admin/inventory.ts` — absolute set, not a delta |
| Admin screen | `src/app/[locale]/admin/inventory/page.tsx`, `src/components/admin/InventoryEditor.tsx`, `StockChip.tsx` |
| Shared threshold | `src/lib/inventory.ts` — `LOW_STOCK_THRESHOLD = 3`, `stockState()` |
| Rows for the screen | `src/services/admin/analytics.ts` → `listInventoryRows()` |

---

# Part 1 — Channels and ledger

## Confirmed behaviour

Independent channels. Example: Online 5, Offline 55. **When Online reaches 0 the
storefront shows Sold Out even though Offline has units.** Online never draws
from Offline automatically. Online orders decrement Online only; offline sales
are entered by hand and decrement Offline only. A **stock transfer** action moves
units between channels, writing *two* ledger rows with reason "transfer".

## The hard part, stated plainly

`place_order()` has been redefined **in full, eight times** — 0015, 0016, 0017,
0027, 0028, 0035, 0040 each re-emit the entire function body. Every copy contains
the same block:

```sql
if v_product.inventory < v_qty then
  raise exception '% has only % in stock.', v_product.name, v_product.inventory;
...
set inventory = inventory - v_qty,
```

Splitting the column means re-emitting `place_order()` **and**
`set_order_status()` once more, complete, in a new migration — which is the
established pattern in this repository, not a workaround. Start from the 0040
body, not from an older one. The channel on the order must decide which column
moves.

## Implementation requirements

1. **Migration** (`supabase/sql/0041_inventory_channels.sql`):
   - Add `inventoryOnline` and `inventoryOffline` to `Product`, both
     `int not null default 0 check (>= 0)`.
   - Backfill: put the existing `inventory` into one channel and state which in
     a comment. Do **not** drop `inventory` in this migration — keep it as a
     generated or trigger-maintained total, or keep it in place and retire it in
     a later migration once nothing reads it. A destructive column drop here
     would break every unmigrated read path at once.
   - Create `InventoryMovement`: product slug (FK, `on update cascade` like
     `IngredientUsage` does), channel, action, quantity delta, previous
     quantity, new quantity, reason, actor, optional order id, `createdAt`.
     Index by product and by `createdAt`.
   - Re-emit `place_order()` from the 0040 body: decrement
     `inventoryOnline` for an `ONLINE` order and `inventoryOffline` for an
     `OFFLINE` one, and insert the movement row **inside the same transaction**.
     An order and the stock it consumes are one event — the file headers say so
     and that invariant must survive.
   - Re-emit `set_order_status()`: cancel restores to the channel the order drew
     from, and writes a movement.
   - Add `record_offline_sale()` and `transfer_stock()`, both movement-writing
     and both locking the product row the way `place_order()` does.
2. **Server actions** in `src/actions/admin/inventory.ts`: offline sale, stock
   receipt, channel transfer, and the existing absolute correction — which must
   now write a movement of action `ADJUSTMENT` carrying the computed delta. Keep
   it absolute: the header explains that a delta double-applies on a stale page.
   `requireAdmin()` first, Zod before the query, every time.
3. **Storefront**: `stockState()` must read the **online** figure. Audit every
   caller — a PDP that reads the total would sell stock the warehouse holds for
   the counter.
4. **Admin**: two columns and a movement history per product. Ordering stays
   out-of-stock, then low, then the rest.

## Security requirements

- Every new action goes through `requireAdmin()`; none is reachable from the
  storefront.
- All movement functions run under the same lock discipline as `place_order()`,
  or two concurrent sales can both read the pre-sale figure.
- Nothing interpolated into SQL. Bound parameters only.
- `check (>= 0)` on both columns is the last line of defence; the functions must
  raise a readable error before it fires.

## Acceptance criteria (Part 1)

- [ ] Online 0 + Offline 55 renders **Sold Out** on the storefront
- [ ] An online order decrements Online only; an admin offline order decrements Offline only
- [ ] Cancelling an order restores to the channel it drew from
- [ ] Transfer of 10 Offline→Online moves both figures and writes exactly two movements
- [ ] Every movement records product, channel, action, delta, previous, new, reason, timestamp, and order where applicable
- [ ] No stock change anywhere overwrites a quantity without a movement row
- [ ] `place_order()` still enforces its discount, credit and archived-product rules — diff the re-emitted body against 0040 line by line

---

# Part 2 — Test-data reset (GATED)

Do not begin until Part 1 is merged and verified, and the gate at the top of this
file has been satisfied.

## Protected — must survive

> ### ⚠️ CORRECTED ADMIN IDENTITY
>
> The reset brief named `mmhassaan3@gmail.com`. That is **wrong** and using it
> would be dangerous: the dashboard allowlist is `ADMIN_EMAILS` in the
> environment, and it contains **`khem.official@outlook.com`** — confirmed by
> the user as the actual protected administrator. `src/lib/admin/auth.ts`
> compares a Clerk-verified address against that list and nothing else, so
> protecting the email in the brief would have preserved an account with no
> dashboard access while deleting the one that has it.
>
> **Protect `khem.official@outlook.com`.** Re-read `ADMIN_EMAILS` at the moment
> of the reset rather than trusting this line, and abort if the two disagree.

Administrator account `khem.official@outlook.com` and its access; all products,
product data, images and media; collections and categories; CMS and editorial
content; essential production configuration.

## Candidate tables for deletion — **to be verified, not trusted**

`Order`, `OrderItem`, `OrderStatusEvent`, order feedback (0022), `Comment` and
its rating images (0005/0018), `Customer` (0024), `NewsletterSubscriber` (0025),
`DiscoveryCredit` and redemptions (0026/0027), campaign audiences and dispatch
(0033/0034/0036), admin and customer notifications (0031/0032), and any
`User` row that is not the administrator.

This list is a **starting point derived from migration files**. Before writing a
single statement, enumerate the live schema and its foreign keys directly and
reconcile the two. Cascade order matters, and a table added on the platform
without a migration would not appear above.

## Requirements

1. Inspect live schema and FK graph. Produce the delete order from the graph,
   not from intuition.
2. Identify the admin row explicitly by the email(s) in `ADMIN_EMAILS` and
   exclude it by primary key, not by a `WHERE ... <> 'email'` clause that a null
   would slip past. Verify the resolved row exists **before** deleting anything;
   an allowlisted address with no matching row means the lookup is wrong, not
   that there is no admin.
3. Confirm a restorable backup.
4. Present table-by-table row counts to the user and **wait**.
5. Only then execute, inside one transaction.
6. Re-verify counts, admin access, and that the catalog is untouched.

## Opening inventory, after the reset

| | Offline | Online |
| :-- | --: | --: |
| Every product | 55 | 5 |
| Gift Sets | 10 | 5 |
| Discovery Sets | 10 | 5 |

Write these as **movement rows**, not as bare column writes, so the audit trail
starts clean and the opening balance is itself explicable. Guard against
double-application if the seeding is re-run.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run db:verify
npm run build
```

## Manual test steps

1. Admin → Inventory: both channels visible, correct opening figures
2. Record an offline sale of 3 → Offline drops 3, Online unchanged, one movement
3. Add 20 received stock → Offline rises, movement recorded
4. Transfer 10 Offline→Online → both move, two movements
5. Place a storefront order → Online drops, Offline unchanged
6. Cancel it → Online restored, movement recorded
7. Set a product's Online to 0 → PDP and card both read Sold Out while Offline holds units
8. Open the movement history → every action above appears with before/after

## Notes carried from the content audit

- `MarketingSetting` is **not** covered by `scripts/db-dump.ts`. Do not assume
  the seed export captures every production-managed table, and do not overwrite
  live `MarketingSetting` data with schema defaults during any reset or reseed.
  Extending the dumper is a separate follow-up and is not part of this workstream
  unless the reset turns out to need it.
- Run `npm run db:dump` before any content-affecting step and review the diff;
  the export has been observed drifting behind live dashboard edits.

---

> ## ✅ PART 1 — VERIFIED / COMPLETE
>
> Signed off by the user after a signed-in UI audit on 2 Sept 2026. Channels,
> ledger, admin screens, storefront behaviour and the seed round-trip are all
> verified. **No further inventory code changes are required.** Part 2 below
> remains gated.

# Implementation record — Part 1 only

Part 2 (the customer/test-data reset) has **not been started**. Its gate at the
top of this file is untouched and still binding.

`npx tsc --noEmit` and `npm run lint` clean.

## Migration — `supabase/sql/0042_inventory_channels.sql`

| Piece | Detail |
| :-- | :-- |
| `"InventoryAction"` enum | SALE, RESTOCK, RECEIPT, ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT |
| Counters | `"inventoryOnline"`, `"inventoryOffline"` — `int not null default 0 check (>= 0)` |
| Backfill | existing `inventory` → **online**, guarded against re-runs |
| `"inventory"` | kept, and now maintained by trigger as online + offline |
| `"InventoryMovement"` | product, channel, action, signed quantity, previous, new, reason, actor, orderId, createdAt |
| Arithmetic guard | `check ("previousQuantity" + quantity = "newQuantity")` |
| `move_stock()` | the single mutation path: locks the row, checks, updates, writes the ledger row |
| Desk functions | `record_offline_sale()`, `receive_stock()`, `transfer_stock()`, `set_channel_stock()` |
| `place_order()` | re-emitted from the 0040 body |
| `restock_order()` | re-emitted from the 0015 body, channel-aware and ledger-writing |

### Decisions taken while building

- **`"OrderChannel"` is reused, not twinned.** A second enum with the same two
  values would be a second answer to one question. An order's channel *is* the
  counter it draws from.
- **`set_order_status()` was not re-emitted.** It already delegates restocking to
  `restock_order()`, so only that function needed changing — a much smaller
  surface than this prompt anticipated.
- **The error message is a contract.** `move_stock()` raises the same
  `'% has only % in stock.'` the previous body raised, *without* naming the
  channel, because `src/actions/checkout.ts:169` and
  `src/actions/admin/orders.ts:76` both test for the substring `"in stock"`.
  Writing "in online stock" would have broken the substring and turned every
  shortfall into an unexplained error.
- **`"inventory"` survives as a trigger-maintained total.** Dropping it would
  have broken every reader in the same deploy. It is now derived — writing to it
  directly has no effect — and can be retired once nothing reads it.
- **Transfer debits the giving side first**, so a shortfall aborts before
  anything has moved.
- **`set_channel_stock()` stays absolute** (the header's reasoning still holds:
  a delta double-applies on a stale page) but computes and records the delta, so
  the ledger explains the jump.

### Verified by diff

The re-emitted `place_order()` was diffed line by line against the 0040 body.
The **only** changes are: `inventory` dropped from the row select, the inline
shortfall check removed, and the decrement replaced by one `move_stock()` call.
The discount resolution and its `DISCOUNT:` hint, the Discovery Credit rules
including the credit-plus-discount refusal, the eligible-line count and the
totals arithmetic are byte-for-byte unchanged.

## Application

- **Storefront reads online, in one edit.** `PRODUCT_COLUMNS` and
  `PRODUCT_CARD_COLUMNS` in `src/schemas/db/catalog.ts` now select
  `inventory:inventoryOnline`. That was chosen over editing the twenty
  components that read `product.inventory` — every card, the sticky bar, the
  cart ceiling and every sold-out test became online-aware without touching a
  component, and there is no call site left to forget.
- **Admin reads both**, by name: `ADMIN_PRODUCT_COLUMNS` carries
  `inventoryOnline` and `inventoryOffline` alongside the total.
- `src/actions/admin/inventory.ts`: `adjustInventory` (now channel-aware),
  `recordOfflineSale`, `receiveStock`, `transferStock` — each `requireAdmin()`
  then Zod then RPC.
- `src/schemas/orders.ts`: `offlineSaleSchema`, `receiveStockSchema`,
  `transferStockSchema` (with a `.refine()` refusing a same-channel transfer).
- `InventoryEditor` renders one field per counter.
- The inventory table gained Online and Offline columns and a **Stock history**
  link per row; its ordering and its low/out filters now rank by the **online**
  counter, since that is the state a visitor sees.
- New read-only route `/admin/inventory/[slug]` — the full movement list, newest
  first, each row showing the signed change and before → after.

## Applied and verified

`supabase/sql/0042_inventory_channels.sql` was applied to production
`ttekisapxjforpawnnla` by the user.

### Schema and backfill

| Check | Result |
| :-- | :-- |
| Products | 28 |
| `inventory = online + offline` mismatches | **0** — the trigger holds |
| Negative counters | 0 |
| Offline non-zero before opening balances | 0 — backfill went to online, as designed |
| `"InventoryMovement"` rows at start | 0 |

### Desk operations, on `amber-body-mist`

| Step | Result |
| :-- | :-- |
| `receive_stock` OFFLINE +20 | online 29, offline 20 |
| `record_offline_sale` 3 | online 29, offline 17 — online untouched |
| `transfer_stock` OFFLINE→ONLINE 10 | online 39, offline 7 — **two** ledger rows |
| Ledger arithmetic on every row | `previous + quantity = new` holds |
| Counters after restore | 29 / 0, exactly as found |

Guards, all refusing with readable messages:

- same-channel transfer → *"A transfer needs two different channels."*
- oversell → *"Amber has only 7 in stock."* — **contains the `"in stock"` substring**, so the TypeScript error mapping still works
- negative counted figure → refused

### Order paths

| Step | online | offline |
| :-- | --: | --: |
| staged | 29 | 5 |
| ONLINE order ×2 | **27** | 5 |
| OFFLINE order ×1 | 27 | **4** |
| cancel the online order | **29** | 4 |
| cancel the offline order | 29 | **5** |

Ledger: `ONLINE SALE −2 (29→27)`, `OFFLINE SALE −1 (5→4)`,
`ONLINE RESTOCK +2 (27→29)`, `OFFLINE RESTOCK +1 (4→5)`. Each order drew from
its own counter and each cancellation returned units to the counter they came
from.

### Storefront

With `amber-body-mist` staged at **online 0, offline 20**, `/ritual/amber-body-mist`
rendered "Sold Out" with the add-to-cart button, Buy Now, and both quantity
steppers `disabled` — while twenty units sat on the shelf. That is the rule the
brief asked for, and it is the case the old single column could not express.

Smoke test after the projection change: `/`, `/collections`,
`/collections/body-mist`, `/perfume/[slug]`, `/ritual/[slug]`, `/set/[slug]`,
`/cart`, `/ar`, `/ar/perfume/[slug]` all 200, no `inventoryOnline` errors in the
dev log.

### Not visually verified

`/admin/inventory` and `/admin/inventory/[slug]` return **307** — the proxy
redirects an anonymous request to sign-in. The routes resolve and are protected,
and both compile, but the rendered tables and the movement history have not been
seen in a browser. Check them while signed in as an admin.

## Dumper extended again — same stated exception

`db-dump.ts` exported only `inventory`, which 0042 turned into a
trigger-maintained total. Seeding from that export would have set every new
product to online = offline = 0, the trigger would have recomputed the total as
0, and **a fresh environment would have come up with the entire catalogue
silently sold out**. The counters are now dumped and seeded; `inventory` is
still exported because it is readable, but the seeder writes the two counters
and lets the trigger derive the total. Verified: the export carries
`inventoryOnline` / `inventoryOffline` on all 28 products.

## Left behind, for Part 2

Two cancelled verification orders exist in production: **KHEM-2026-1072** and
**KHEM-2026-1073**. Their stock was returned by the cancellation, so no counter
is wrong. They are exactly the kind of row Part 2's reset removes; they were not
deleted here because deletion is behind that gate.
