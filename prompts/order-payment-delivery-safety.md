# Fix Order Payment, Delivery Confirmation & Discovery Credit Logic

Read `AGENTS.md` and the existing order/payment/discovery-credit implementation before changing anything. 

Then implement and verify the following.

## 1. Fix cash payment and Discovery Credit issuance

The current admin cash-payment flow must not directly update `Order.paymentStatus`.

Create one authoritative payment-status flow (database function/RPC if appropriate) that:

* Sets `paidAt` when an order becomes `PAID`.
* Issues Discovery Set credit when payment becomes `PAID`, where applicable.
* Cancels/reverses Discovery Set credit correctly when payment becomes `REFUNDED`, according to the existing credit rules.
* Is idempotent: repeating the same action must not create duplicate credits or transactions.
* If the order is already `DELIVERED` when payment is recorded, the Discovery credit must immediately become active/available instead of remaining pending delivery.
* If payment happens first and delivery happens later, delivery must activate the existing eligible credit.

The Stripe/card payment path should continue to work automatically. Do not create separate conflicting logic for cash and card payments.

## 2. Delivery must require payment

An order must **not be allowed to become `DELIVERED` unless payment is `PAID`**.

For cash/COD orders:

* The admin must mark the order as `PAID` before it can be marked `DELIVERED`.
* If an admin attempts to set `DELIVERED` while payment is not `PAID`, block the action and clearly explain why.

For card/Visa/Stripe orders:

* Payment should continue to become `PAID` automatically through the payment flow/webhook.
* The admin should not need to manually mark a successfully paid card order as paid.

## 3. Add a safety confirmation before important order updates

Currently an admin can accidentally update an order, which may trigger customer-facing consequences.

When an admin changes an order status or performs an important order update, add a clear confirmation step before saving.

The confirmation must:

* Clearly show the important change being made.
* Require intentional confirmation before the update is executed.
* Be especially clear for customer-impacting states such as `DELIVERED`.
* Warn that changing the order may trigger related actions, notifications, inventory changes, or Discovery credit changes where applicable.
* Make accidental clicks difficult without making normal admin work unnecessarily annoying.

For example, before marking an order `DELIVERED`, show a confirmation explaining that this confirms the customer received the order and may trigger related fulfillment/credit logic.

## 4. Protect the workflow at the database level

Do not rely only on the frontend.

The database/server logic must also prevent invalid state transitions such as:

`UNPAID → DELIVERED`

The authoritative backend logic should enforce the business rules even if someone bypasses the admin UI.

## 5. Verify all important scenarios

Test and report the result for:

### Cash / COD

1. Order created → unpaid.
2. Admin marks it `PAID`.
3. `paidAt` is recorded.
4. Eligible Discovery credit is issued.
5. Admin marks it `DELIVERED`.
6. Credit becomes active/available.

### Delivered before payment attempt

1. Attempt to mark an unpaid order `DELIVERED`.
2. UI must block/warn.
3. Backend/database must also reject the invalid transition.

### Existing ordering edge case

1. Order is already `DELIVERED`.
2. Payment is recorded afterwards.
3. Eligible Discovery credit must immediately become active.

### Refund

1. Paid eligible order receives a credit.
2. Payment becomes `REFUNDED`.
3. Credit handling follows the existing cancellation/reversal rules correctly.

### Card / Visa / Stripe

1. Successful payment automatically becomes `PAID`.
2. `paidAt` is recorded.
3. Discovery credit logic still works.
4. Admin delivery flow remains safe.

## Important constraints

* Do not break existing Stripe/webhook behavior.
* Do not duplicate payment logic between admin and Stripe flows.
* Keep one authoritative source of truth for payment state transitions.
* Ensure all credit operations are idempotent.
* Do not silently modify existing orders without documenting it.
* Audit existing database migrations/functions before adding new ones.
* Run typecheck and lint.
* Verify using real UI flows where possible.
* Report exactly which files, migrations, functions, and flows changed.

Do not execute destructive repairs or backfills on existing production-like data without explicitly telling me first.
