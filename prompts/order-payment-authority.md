# Order payment authority, delivery gating, and admin confirmation

Implements `prompts/order-payment-delivery-safety.md`. Written after reading
`AGENTS.md` and auditing the shipped order/payment/credit implementation.

## Goal

One authoritative path for an order's payment state, so that the desk marking a
cash order PAID does exactly what a Stripe webhook does — stamps `paidAt`,
issues the Discovery Credit, and reverses it on a refund. Then gate DELIVERED
behind PAID in the database, and put a confirmation in front of every order
state change on the desk.

## Skills read

- `.agents/skills/supabase` — `security definer`, `for update` locking, the
  privilege clawback that `0015`/`0026`/`0028` all end with.
- `.agents/skills/clerk` — `requireAdmin()` is the actor; identity stays Clerk's.
- `ai-sdk` does not apply.

## Existing code inspected

- `src/actions/admin/orders.ts` — `updateOrderStatus()` (reads the row
  server-side, checks `canTransition`, calls `set_order_status`, then mails) and
  **`updatePaymentStatus()`, which is the bug**: a bare
  `supabase.from("Order").update({ paymentStatus })`. It calls no function, so
  `paidAt` is never set and `issue_discovery_credits()` is never reached.
- `src/app/api/webhooks/stripe/route.ts` — the only caller of
  `settle_order_payment()`, and therefore the only path that has ever issued a
  credit.
- `supabase/sql/0026_discovery_credits.sql` — `issue_discovery_credits()`
  (`on conflict do nothing` on `customer_credit_unit_idx`),
  `activate_discovery_credits()` (only stamps credits with a null
  `deliveredAt`), `cancel_discovery_credits()` (balance > 0 only),
  `settle_order_payment()` — the current body, which issues credits — and the
  backfill `DO` block that re-issues for every PAID order on **every migrate**.
- `supabase/sql/0027_credit_redemption.sql` — `reverse_credit_redemption()`,
  idempotent through its `not exists` guard on the `REFUNDED` row.
- `supabase/sql/0028_discounts.sql` — the current `set_order_status()` body.
  **This is the version to copy from**; 0026's and 0027's are older and dropping
  back to either silently loses the discount reversal.
- `src/schemas/orders.ts` — `TRANSITIONS`, `canTransition()`,
  `updatePaymentStatusSchema`, `paymentStatusValues`.
- `src/components/admin/OrderStatusControl.tsx` — arms `CANCELLED`/`REFUNDED`
  with a second click; every other status and **every** payment button fires on
  the first click.
- `src/types/order.ts` — `AdminOrderDetail` already carries `paymentStatus`,
  `paymentMethod` and `paidAt`, so the action can gate without a second read.

## What the audit found (verified against the live database)

Order `KHEM-2026-1080` — `initiation-set`, 69000, CASH, PAID, DELIVERED, with a
`clerkUserId` — has no credit. `customer_credits` and `credit_transactions` are
empty across the whole database. A dry run of `issue_discovery_credits()` +
`activate_discovery_credits()` on that order inside a rolled-back transaction
produced exactly one AVAILABLE credit of 69000. The ledger is correct; it is
never invoked for cash. `paidAt` being null on a PAID row is the fingerprint.

Second defect: that order reached DELIVERED *before* it was marked PAID. Even
with issuance fixed, `activate_discovery_credits()` had already run against an
empty set, so the credit would be born `PENDING_DELIVERY` and stay there.

## Decisions and assumptions

- **Issuance activates on the spot when the order is already DELIVERED.** Fixing
  this inside `issue_discovery_credits()` rather than in each caller is what
  keeps cash and card on one path — both get the fix, neither restates it.
- **`set_order_payment_status()` is the only writer of `paymentStatus` from the
  desk.** `settle_order_payment()` keeps its own body for the card path: it
  additionally records `stripePaymentIntentId` and returns the boolean the
  webhook's idempotency depends on. The shared part is `issue_discovery_credits()`,
  which both call — the same relationship `set_order_status()` already has with
  `restock_order()`.
- **PAID is one-way from the desk.** Your decision: once an order is PAID, the
  admin cannot casually move it back to UNPAID or FAILED. `REFUNDED` is the one
  controlled reversal, and it is the only state PAID may become. The rule is
  enforced in the function, so it holds whether or not the UI offers the button.
- **REFUNDED touches credits only**, not stock or discounts: payment state and
  fulfilment state are independent controls today, and `set_order_status(REFUNDED)`
  is what returns units to the shelf. Marking payment REFUNDED calls
  `cancel_discovery_credits()` and `reverse_credit_redemption()`, both idempotent,
  so doing both actions in either order is safe.
- **The DELIVERED gate is `paymentStatus = 'PAID'`, for every payment method.**
  A card order is PAID by webhook before anyone can deliver it, so the rule costs
  the card path nothing and is one rule rather than two.
- **Orders already DELIVERED while unpaid keep their state.** The guard is on the
  transition, not on the row; nothing existing is rewritten.

## Files to change

| File | Change |
| :--- | :--- |
| `supabase/sql/0050_payment_authority.sql` | **new** — `issue_discovery_credits()` re-declared with delivery-aware activation; `set_order_payment_status()`; `set_order_status()` re-declared from its 0028 body plus the DELIVERED gate; privilege clawback |
| `src/actions/admin/orders.ts` | `updatePaymentStatus()` → RPC; `updateOrderStatus()` gains the DELIVERED-needs-PAID refusal |
| `src/components/admin/OrderStatusControl.tsx` | confirmation panel for every status and payment change |
| `src/schemas/orders.ts` | `requiresPayment()` helper so client and server state the rule once |

## Implementation requirements

### `supabase/sql/0050_payment_authority.sql`

1. `issue_discovery_credits(order_id text)` — the 0026 body, plus: after the
   insert, if the order's `status = 'DELIVERED'`, `perform
   activate_discovery_credits(order_id)`. Still returns the count created. Still
   idempotent — activation only touches credits with a null `deliveredAt`.

2. `set_order_payment_status(order_id text, next_status public."PaymentStatus")
   returns boolean` — `security definer`, `set search_path = public`.
   - `select "paymentStatus", status ... for update`; raise
     `foreign_key_violation` if the order is gone, matching `set_order_status()`.
   - Return `false` unchanged if `paymentStatus` is already `next_status`.
   - `PAID`: set `paymentStatus`, `paidAt = coalesce("paidAt", now())`,
     `updatedAt`; then `perform issue_discovery_credits(order_id)`.
   - `REFUNDED`: set `paymentStatus`, keep `paidAt` (the money did land); then
     `cancel_discovery_credits()` and `reverse_credit_redemption()`.
   - `UNPAID` / `FAILED` **from `PAID`**: raise, `check_violation`, with a
     sentence for the desk — a paid order is reversed by refunding it, not by
     un-ticking it. From any other state the two are ordinary corrections and
     just set `paymentStatus`.
   - Return `true`.

3. `set_order_status(order_id, next_status)` — **the 0028 body verbatim**, plus,
   before the update:

   ```
   if next_status = 'DELIVERED' then
     select "paymentStatus" into v_payment from public."Order" where id = order_id for update;
     if v_payment is distinct from 'PAID' then
       raise exception 'Order % cannot be delivered before it is paid.', order_id
         using errcode = 'check_violation';
     end if;
   end if;
   ```

   The message is written for the desk, the way `place_order()`'s stock messages
   are, because the action surfaces it.

4. `revoke all on function ... from public, anon, authenticated` for all three,
   as every prior migration ends.

5. **No backfill in this file.** 0026's existing `DO` block already re-issues on
   every migrate; adding a second would be two repairs for one problem.

### `src/actions/admin/orders.ts`

- `updatePaymentStatus()` — replace the table write with
  `supabase.rpc("set_order_payment_status", { order_id, next_status })`. Keep
  `requireAdmin()` first, keep the schema parse, keep the log line's shape
  (actor, order number, new state — no customer data). The order number now
  needs a read: use `getAdminOrderById()` before the call, as
  `updateOrderStatus()` does, which also gives the current state for the
  "Nothing to change." early return.
- `updateOrderStatus()` — after the `canTransition` check, refuse
  `DELIVERED` when `order.paymentStatus !== "PAID"` with: *"This order has not
  been paid. Mark the payment received before confirming delivery."* The database
  raise stays as the backstop; map `23514` on this path to the same sentence in
  `placementFailure`-style handling rather than the generic message.
- Credits changing means `/admin/credits` and the customer's `/account/vouchers`
  are stale, but every `/admin` screen is `force-dynamic` and the account pages
  are per-request — no new `revalidatePath` is needed. Say so in a comment
  rather than leaving the absence unexplained.

### `src/components/admin/OrderStatusControl.tsx`

Replace the current arm-on-`RESTOCKING` behaviour with one confirmation panel
serving both control groups. On a click, the button arms and a panel appears
below the group stating, in one sentence each:

- **what changes** — "Fulfilment: Shipped → Delivered."
- **what it triggers** — the customer email for `SHIPPED`/`DELIVERED`/`CANCELLED`/
  `REFUNDED`; the restock for `CANCELLED`/`REFUNDED`; the Discovery Credit
  becoming spendable on `DELIVERED`; the credit being issued on payment `PAID`
  and cancelled on `REFUNDED`. Marking PAID also says plainly that it cannot be
  undone except by refunding.
- **that it is the customer's record** for `DELIVERED`: "This states the customer
  received their order."

Panel: `border border-gold/30 bg-surface/60 px-5 py-4`, heading
`font-heading text-[9px] uppercase tracking-[0.2em] text-ground-accent`, body
`text-[12px] leading-relaxed text-ground-muted`, and two buttons — Confirm
(gold border) and Cancel (ghost) — in the existing button idiom: `rounded-none`,
`tracking-[0.2em]`, `duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]`. No spring,
no bounce; the panel fades and rises 4px. Escape and Cancel disarm. Nothing
changes while `isPending`.

A `DELIVERED` button on an unpaid order renders disabled with the title
explaining why, alongside the existing unreachable-transition titles — the desk
should see the rule before it clicks, and still be refused if it forces the
button.

## Security requirements

- `requireAdmin()` remains the first statement of both actions.
- `set_order_payment_status()` is `security definer`, `search_path` pinned, and
  revoked from `public`, `anon`, `authenticated` — it moves money-shaped state.
- No amount, eligibility or customer id crosses from the client: the actions take
  an order id and a state, and the database decides the rest.
- The DELIVERED rule is enforced in the function, so bypassing the UI or the
  action still fails.
- Logs keep to actor, order number, state. No customer name, email or note.

## Acceptance criteria

1. Cash: create UNPAID → mark PAID → `paidAt` set, one credit with one `EARNED`
   row → mark DELIVERED → credit `AVAILABLE`, `expiresAt` 60 days out.
2. Marking PAID twice creates no second credit and no second transaction.
3. Payment recorded on an order that is **already** DELIVERED yields an
   `AVAILABLE` credit immediately, with no further action.
4. `set_order_status(order, 'DELIVERED')` on an UNPAID order raises, called
   directly against the database.
5. The desk sees a refusal, not an error toast, for the same attempt.
6. Payment REFUNDED cancels an unspent credit and leaves a spent one alone;
   running it twice writes nothing further.
7. PAID → UNPAID and PAID → FAILED are refused, in the database and on the desk;
   UNPAID → FAILED and FAILED → UNPAID still work.
8. Card: webhook still settles, `paidAt` recorded, credit issued, and
   `settle_order_payment()` still returns `true` exactly once.
9. Every status and payment button requires a second, intentional click, and the
   panel names the consequence before it happens.
10. `npm run db:migrate` twice is clean and idempotent; `npm run db:verify` passes.

## Checks to run

- `npx tsc --noEmit`, `npm run lint`
- `npm run db:migrate` twice, `npm run db:verify`
- `npm run build`
- A scripted end-to-end against the live database covering criteria 1–8, using a
  throwaway order and cleaning up after itself.

## Manual test steps

Handed over at delivery, as exact clicks: the cash order round trip on
`/admin/orders/[orderNumber]`, the blocked delivery, and the customer's view at
`/account/vouchers`.

## Backfill — already done, not to be repeated

`0026_discovery_credits.sql` ends with a backfill that re-issues and activates
credits for every paid order with an account behind it, and it runs on every
`npm run db:migrate`. The user has already run it, and the 690 EGP credit for
`KHEM-2026-1080` exists. Nothing in this work re-runs a migration in order to
create credits; `db:migrate` is run here only to apply `0050`, and its effect on
the ledger is a no-op because the backfill is idempotent.
