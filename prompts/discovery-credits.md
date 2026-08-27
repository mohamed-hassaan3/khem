# Discovery Credits — the ledger, and redemption at checkout

## Goal

Implement the KHEM Discovery Credit policy as a double-entry-style ledger:
buying a Discovery Set earns a credit worth what was paid for it, and that
credit pays for a full-size fragrance once, within sixty days of delivery.

**Split into two phases**, because the second one changes what a customer is
charged and the first one cannot:

- **Phase 6a — the ledger.** Schema, issuance, activation, expiry, cancellation,
  and the admin screens that show all of it. Purely additive: no existing
  function changes what it charges, and checkout is untouched. A credit can be
  earned, seen, and expire — it just cannot yet be spent.
- **Phase 6b — redemption.** `place_order()` accepts a credit, validates it
  inside the same transaction that writes the order, and reduces the total. The
  refund paths reverse it. This is the phase that touches money.

Shipping 6a alone is safe and useful: it makes every credit the policy describes
exist and be auditable before anything can be redeemed against it.

## The policy, as given

1. Credit = 100% of the paid Discovery Set purchase price.
2. Applies to any eligible full-size KHEM perfume.
3. Valid 60 days from Discovery Set **delivery**.
4. Cannot combine with promotional discounts or coupons.
5. No cash value; not exchangeable for cash.
6. Belongs to the purchasing customer/account; not transferable.
7. Each eligible paid Discovery Set generates its own credit.
8. Refunding the Discovery Set cancels its unused credit.
9. Refunding a full-size order restores the redeemed credit.
10. Ledger required: `customer_credits` + `credit_transactions`.
11. Never a bare editable balance.
12. Every earned / used / refunded / expired / adjusted movement gets a row.
13. The server validates every redemption.
14. The client never controls amount or eligibility.

## Decisions taken with the user

- **Voucher, not a balance.** One credit is consumed whole in one redemption.
  Against a cheaper perfume the excess is forfeited — which is what "no cash
  value" and "each set generates its own credit" mean together.
- **Redeemable only once DELIVERED.** The credit is EARNED at payment
  confirmation so the ledger row exists from the moment money moved, but it
  cannot be spent until the source order reaches DELIVERED, which is when the
  sixty days start.
- **One credit per order.**
- **Eligible = `FRAGRANCE` collection kind.** Body care, home fragrance, gift
  sets and other discovery sets do not qualify.

## Assumptions I am making explicit

- **Quantity means count.** A Discovery Set line with `quantity: 2` earns *two*
  credits, each worth one unit's price. Policy 7 says each set generates its own.
- **Cash orders earn on delivery, not on payment.** A COD Discovery Set is
  `UNPAID` until the courier returns, so "paid" is the trigger either way —
  `settle_order_payment()` for a card, the desk marking it PAID for cash. The
  hook is the payment fact, not the method.
- **A credit with no delivery never expires and never becomes spendable.** It
  sits `PENDING_DELIVERY` indefinitely. The dashboard surfaces these, because a
  Discovery Set nobody ever marks delivered is a customer quietly holding a
  credit they cannot use.
- **Snake-case table names**, as the policy names them, against the codebase's
  PascalCase convention. The precedent is `product_comment` in `0005`.

## Skills read

- `.agents/skills/supabase` — `security definer` functions, RLS/privilege
  clawback, the transactional idioms in `0015`/`0022`.
- `.agents/skills/clerk` — `clerkUserId` is the owner key; identity stays Clerk's.
- `ai-sdk` does not apply.

## Existing code inspected

- `supabase/sql/0015_orders.sql` — `place_order()` (slug-ordered `for update`
  locks, price snapshot, stock decrement, all in one transaction),
  `set_order_status()`, `restock_order()` and its `"stockReleasedAt"` guard.
- `supabase/sql/0016_checkout.sql` — `settle_order_payment()`,
  `expire_unpaid_orders()`, the `paymentMethod`/`paidAt` columns.
- `supabase/sql/0017_order_events.sql` — the current bodies of `place_order`,
  `set_order_status` and `settle_order_payment`. **These are the versions to
  copy from**, not 0015's, or the status trail and the `PENDING` lifecycle get
  silently dropped.
- `supabase/sql/0022_order_feedback.sql` — `mark_feedback_requested()`, the
  claim-once idiom the issuance guard copies.
- `supabase/sql/0024_customers.sql` — `"User"`, and the deliberate absence of a
  foreign key from `"Order"."clerkUserId"`.
- `src/actions/checkout.ts` — `placeCustomerOrder()`; prices resolved
  server-side, `shippingInCents()` from the resolved subtotal, `place_order()`
  doing the arithmetic.
- `src/app/api/checkout/intent/route.ts` — takes **only** an order id and
  charges `totalInCents` off the row. Its header spells out why the amount must
  not be nameable. **This is what makes 6b safe**: if the credit is applied when
  the order is written, Stripe automatically charges the reduced amount and no
  new trust boundary is created.
- `src/app/api/webhooks/stripe/route.ts` — the only place a card order becomes
  paid; idempotent on `settle_order_payment()`'s boolean.
- `src/app/api/cron/sweep-unpaid-orders/route.ts` — the cron shape the expiry
  job copies.
- `src/actions/admin/orders.ts` — `updateOrderStatus()` and the transition table.

## Phase 6a — the ledger

### `supabase/sql/0026_discovery_credits.sql`

**`customer_credits`** — the instrument. One row per earned credit, and every
column on it is an immutable fact about how the credit came to exist:

- `id`, `clerkUserId` (owner; soft link, no FK, same reasoning as `"Order"`),
- `sourceOrderId` → `"Order"(id)`, `sourceOrderItemId` → `"OrderItem"(id)`,
- `unitIndex int` — which unit of a multi-quantity line this credit is for,
  with `unique ("sourceOrderItemId", "unitIndex")` as the issuance guard,
- `amountInCents` — the price actually paid for that unit, snapshotted,
- `earnedAt`, `deliveredAt`, `expiresAt` (both null until delivery),
- `cancelledAt`.

**No status column, and no balance column.** Policy 11. A credit's state is
derived from its transactions — that derivation lives in the view below so
nothing computes it twice.

**`credit_transactions`** — the ledger. Append-only:

- `id`, `creditId` → `customer_credits(id) on delete cascade`,
- `kind` — enum `EARNED` / `USED` / `REFUNDED` / `EXPIRED` / `ADJUSTED`,
- `amountInCents` — **signed**: `EARNED` and `REFUNDED` positive, `USED` and
  `EXPIRED` negative, `ADJUSTED` either,
- `orderId` — the redemption order for `USED`/`REFUNDED`, else null,
- `note`, `actor` (an admin email for `ADJUSTED`, else null),
- `occurredAt`.

Append-only is the point: a correction is a new `ADJUSTED` row, never an edit.
Policy 12.

**`credit_balances`** — the view that derives state, so "is this credit
available?" has exactly one definition:

```
select c.*,
       coalesce(sum(t."amountInCents"), 0) as "balanceInCents",
       case
         when c."cancelledAt" is not null                       then 'CANCELLED'
         when coalesce(sum(t."amountInCents"), 0) <= 0          then 'REDEEMED'
         when c."deliveredAt" is null                           then 'PENDING_DELIVERY'
         when c."expiresAt" is not null and c."expiresAt" < now() then 'EXPIRED'
         else 'AVAILABLE'
       end as status
```

(`REDEEMED` covers a zero balance from either a `USED` or an `EXPIRED` row; the
two are told apart by the transactions, which is where that distinction belongs.)

**Functions**, all `security definer`, all revoked from the public roles:

- `issue_discovery_credits(order_id text) returns int` — for each `OrderItem`
  whose product's collection kind is `DISCOVERY`, insert one credit per unit at
  that line's `priceInCents`, each with an `EARNED` transaction. Idempotent via
  the unique index; returns how many it actually created. Called from
  `settle_order_payment()` and from the cash-payment path.
- `activate_discovery_credits(order_id text) returns int` — stamps `deliveredAt
  = now()` and `expiresAt = now() + interval '60 days'` on that order's credits
  that have none. Idempotent. Called from `set_order_status()` on `DELIVERED`.
- `cancel_discovery_credits(order_id text) returns int` — policy 8. For each
  unspent credit of a refunded/cancelled source order: stamp `cancelledAt` and
  write an `EXPIRED` row for the remaining balance. A credit already spent is
  **not** clawed back — the customer received the perfume, and taking it back
  would be charging them for a refund.
- `expire_discovery_credits() returns int` — the cron. Writes `EXPIRED` for the
  remaining balance of every credit past `expiresAt` with a positive balance.
- `adjust_credit(credit_id, amount, note, actor) returns text` — the manual
  lever, for the cases a policy cannot anticipate. Always a new row.

`settle_order_payment()` and `set_order_status()` are re-declared **from their
0017 bodies**, each gaining one `perform` call. Nothing else in them changes.

### TypeScript, Phase 6a

- `src/types/credit.ts`, `src/schemas/db/credits.ts` — the vocabulary and row
  parsing.
- `src/services/admin/credits.ts` — `listCredits({ status, search, page })`,
  `getCredit(id)` with its transactions, `getCreditTotals()`.
- `src/services/credits.ts` — `creditsForUser(clerkUserId)`, for the account
  portal and (in 6b) checkout.
- `src/actions/admin/credits.ts` — `adjustCredit()` only. Issuance, activation,
  expiry and cancellation are consequences of order events and must not be
  buttons.
- `/admin/credits` — list with status filter and the totals the overview needs:
  issued, available, redeemed, expired, and **pending delivery**.
  `/admin/credits/[id]` — one credit with its full transaction trail.
- `/admin` overview tiles: credits issued and credits redeemed
  (`supabase/AGENTS.md` §4).
- `/admin/customers/[id]` gains a credits panel — §6 asks for it.
- `src/app/api/cron/expire-credits/route.ts` + a `vercel.json` entry, copying
  the sweeper's shape and its secret check.

## Phase 6b — redemption

- `place_order(payload)` gains an optional `creditId`. Inside the existing
  transaction, **after** the line loop has computed the subtotal:
  1. lock the credit row `for update`;
  2. refuse unless it is `AVAILABLE` in `credit_balances`;
  3. refuse unless `clerkUserId` matches the order's — policy 6, and the
     order's id comes from a verified session, never a form field;
  4. refuse unless the order contains at least one `FRAGRANCE` line — policy 2;
  5. refuse if any discount is present — policy 4. Nothing sets one today, so
     this is a guard written now for the discounts phase, not dead code;
  6. apply `least(credit.balance, subtotal)` to the total, never below zero;
  7. write the `USED` transaction with `orderId`.

  All seven inside the same transaction as the order and the stock movement, for
  the reason `0015`'s header gives: two requests must not spend one credit.
- `"Order"` gains `creditId` and `creditAppliedInCents`, so a refund knows what
  to reverse and the order screen can print it.
- `set_order_status()` on `CANCELLED`/`REFUNDED` also calls
  `reverse_credit_redemption(order_id)` — policy 9. Restores the credit with a
  `REFUNDED` row **at its original expiry**; if that has passed, the restore is
  immediately followed by an `EXPIRED` row rather than silently handing back a
  credit that should have lapsed.
- `src/actions/checkout.ts` passes a `creditId` chosen by the customer;
  `src/app/api/checkout/intent/route.ts` is **unchanged** — it already charges
  the row.
- Checkout UI: available credits offered on the payment step, with the applied
  amount shown in `CartSummary`. The amount displayed is what the server wrote.
- `/account` shows the customer their credits and expiry dates.

## Security requirements

- Every credit function is `security definer`, revoked from `public`, `anon`,
  `authenticated`. Both tables: RLS on, no policy, no grant — they name a
  customer and an amount of money.
- `requireAdmin()` first statement of every admin action; `adjustCredit` records
  the actor.
- **The client never sends an amount, an eligibility verdict, or a customer id.**
  It sends a credit id; the server decides everything else. Policy 13 and 14.
- Redemption validated inside the order transaction under a row lock — the only
  place double-spend can be excluded.
- A credit is spendable only by the Clerk user it belongs to, checked
  server-side against the session (policy 6).
- No credit amount, customer name or email in any log line.

## Acceptance criteria

**6a**

1. `npm run db:migrate` applies `0026` cleanly and is idempotent; `db:verify` passes.
2. Paying for a Discovery Set with `quantity: 2` creates exactly two credits, each
   at that line's unit price, each with one `EARNED` row.
3. Re-delivering the same Stripe event creates no further credits.
4. Marking the order `DELIVERED` stamps `expiresAt` 60 days out; doing it twice
   changes nothing.
5. Refunding the source order cancels its unspent credits and leaves spent ones alone.
6. The cron expires a credit past `expiresAt` exactly once.
7. A non-Discovery order creates no credits.
8. Balance always equals the sum of the transactions — no path writes one without the other.
9. Checkout, order totals, stock and payments are **byte-for-byte unchanged**.

**6b**

10. A credit reduces the order total server-side; Stripe charges the reduced amount.
11. Two concurrent orders cannot spend one credit.
12. A credit belonging to another account is refused.
13. An order with no FRAGRANCE line is refused.
14. A `PENDING_DELIVERY` or expired credit is refused.
15. Refunding a redemption order restores the credit, or restores-then-expires it
    if its window has closed.
16. A tampered client payload cannot change the amount applied.

## Checks to run

- `npx tsc --noEmit`, `npm run lint`
- `npm run db:migrate` twice, `npm run db:verify`
- `npm run build`
- A scripted end-to-end against the live database for each numbered criterion,
  cleaning up after itself — as in phases 1–5.

## Manual test steps

Given per phase at delivery. 6b additionally needs a Stripe test-mode card run
to prove the charged amount matches the reduced total, which I will hand over as
exact steps rather than assume.
