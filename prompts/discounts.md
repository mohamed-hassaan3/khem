# Discounts, and the first-subscription 10% offer

## Goal

The last section of `supabase/AGENTS.md` — §11 and §12. A discount engine the
desk can run campaigns with, and the welcome offer that hangs off the newsletter
signup Phase 2 built.

**Split in two**, on the same principle as the credits work:

- **Phase 7a — the engine.** Schema, admin CRUD, and redemption at checkout.
  This is the phase that changes what a customer is charged.
- **Phase 7b — the welcome offer.** Grants issued on first subscription, the
  code in the welcome letter, and the admin view of who has one.

7b depends on 7a and is small once it exists. 7a is the risky half and gets its
own review.

## Decisions taken with the user

1. **Restricted discounts come off eligible lines only.** A 20%-off-Noir code on
   a bag holding one Noir and one Signature reduces the Noir line alone. A cheap
   qualifying item must not unlock a discount on an expensive unrestricted one.
2. **One shared code string, gated by a per-person grant.** Everyone is emailed
   `WELCOME10`. Redemption requires a grant issued to that email when they
   subscribed. Somebody who never subscribed and simply types the code is
   refused — which is what keeps a shared string from leaking into a permanent
   public discount.
3. **Two caps, both nullable**: a total use limit and a per-customer limit.
   Either unset means unlimited.
4. **The welcome grant is single use and expires 60 days after the person
   subscribed** — measured per grant, not from one global date, so a late
   subscriber still gets a full window.

## Assumptions I am making explicit

- **A percentage comes off merchandise, never delivery.** Shipping already has
  its own free-delivery threshold in `src/lib/cart.ts`; letting a code discount
  it would produce two rules fighting over the same number.
- **One discount per order.** Codes do not stack with each other, and — policy
  4 of the credit work — never with a Discovery Credit.
- **`minimumOrderInCents` is judged on the subtotal before any reduction.**
  Judging it after would let a discount disqualify itself.
- **A fixed-amount discount is capped at the eligible subtotal**, so an order
  can never go negative, exactly as a credit is capped.
- **Refunding an order releases its redemption**, returning the use to both
  caps. A refunded order that consumed somebody's welcome grant gives it back.

## Skills read

- `.agents/skills/supabase` — `security definer` functions, RLS/privilege
  clawback, the transactional idioms in `0015` and `0026`/`0027`.
- `.agents/skills/clerk` — the customer key for the per-customer cap.
- `ai-sdk` does not apply.

## Existing code inspected

- `supabase/sql/0027_credit_redemption.sql` — the current `place_order()` body,
  which this must extend rather than replace, and the credit block whose
  discount guard currently reads `payload->>'discountInCents'`. **That guard
  changes**: with a real engine the client sends a *code* and the server
  computes the amount, so the check becomes "was a discount code accepted",
  never "did the client claim an amount".
- `supabase/sql/0025_newsletter.sql` — `"NewsletterSubscriber"` and
  `subscribe_newsletter()`, which reports `isNew` / `reactivated`. That boolean
  is what gates issuing a grant, exactly as it gates the welcome letter.
- `src/actions/checkout.ts`, `src/schemas/checkout.ts` — where `creditId` was
  threaded through in 6b; `discountCode` follows the same path.
- `src/app/api/checkout/intent/route.ts` — charges `totalInCents` off the row
  and refuses to be told an amount. Unchanged again, for the same reason.
- `src/lib/cart.ts` — `cartSubtotalInCents`, `shippingInCents`,
  `cartTotalInCents`. The client's estimate must use these plus the same
  eligible-line rule the server applies.
- `src/components/checkout/CreditStep.tsx` / `OrderReview.tsx` — the shapes the
  discount field and its summary row copy.
- `src/actions/newsletter.ts` — where the grant is issued and the code reaches
  the letter.

## Phase 7a — the engine

### `supabase/sql/0028_discounts.sql`

**`discounts`**

- `id`, `code` (stored uppercased, unique), `kind` enum `PERCENTAGE` / `FIXED`,
- `value` int — a percentage 1–100, or an amount in piastres; one `check`
  per kind rather than two nullable columns,
- `isActive`, `startsAt`, `endsAt` (both nullable — an always-on code is valid),
- `totalUseLimit`, `perCustomerLimit` (both nullable = unlimited),
- `minimumOrderInCents` default 0,
- `appliesTo` enum `ALL` / `PRODUCTS` / `COLLECTIONS`,
- timestamps.

**`discount_products`** and **`discount_collections`** — the restriction sets,
each a two-column junction with a foreign key and a composite primary key.

**`discount_grants`** — decision 2. `discountId`, `email` (lowercased),
`clerkUserId` nullable, `issuedAt`, `expiresAt`, `usedAt`, `usedOrderId`.
Unique on `(discountId, email)`, which is what makes issuing idempotent and
"prevent the same user receiving it repeatedly" (§11) a constraint rather than
a check.

**`discount_redemptions`** — the usage ledger. `discountId`, `orderId` (unique —
one discount per order), `email`, `clerkUserId`, `amountInCents`, `redeemedAt`,
`releasedAt`. Both caps count rows here with `releasedAt is null`, and the
"revenue generated" figure §12 asks for is a sum over it joined to `"Order"`.

A ledger rather than a counter column on `discounts`, for the reason 0026 gives
at length: a counter and a list of uses are two records of one fact.

**Functions**

- `discount_eligible_subtotal(order_id, discount_id) returns int` — sums the
  order's lines that the restriction admits. `ALL` is every line; `PRODUCTS` and
  `COLLECTIONS` join the junctions. One place computes it, so the checkout
  estimate and the charge cannot diverge in *definition* (only in freshness).
- `resolve_discount(payload) returns jsonb` — the whole validation, returning
  `{ ok, discountId, code, amountInCents, reason }`. Refuses, each with its own
  sentence: unknown code, inactive, not started, ended, below minimum, total cap
  reached, per-customer cap reached, no eligible line, no grant (for a
  grant-gated code), grant expired, grant already used.
- `reverse_discount_redemption(order_id)` — stamps `releasedAt`, returns the use
  to both caps, and clears `usedAt` on a grant. Idempotent.

**`place_order()`** re-declared from its 0027 body, gaining a `discountCode`
block **before** the credit block, so the credit's mutual-exclusion check reads
a resolved discount rather than a claimed amount.

**`set_order_status()`** re-declared: `CANCELLED` / `REFUNDED` also calls
`reverse_discount_redemption`.

**`"Order"`** gains `discountId`, `discountCode` (snapshot — the code string as
typed, so a renamed code still prints correctly on an old order) and
`discountInCents`.

### TypeScript, 7a

- `src/types/discount.ts`, `src/schemas/db/discounts.ts`, `src/schemas/discounts.ts`
- `src/services/admin/discounts.ts` — list with usage and revenue, one detail read
- `src/actions/admin/discounts.ts` — create, update, activate/deactivate, delete
- `/admin/discounts` + `/admin/discounts/[code]` — the editor, restriction
  pickers, and the usage panel §12 asks for
- Checkout: a `discountCode` field on the schema and the form, a `DiscountStep`
  beside `CreditStep`, the summary row, and the admin order screen showing what
  came off
- `/admin/orders/[orderNumber]` prints the discount beside the credit

## Phase 7b — the welcome offer

- `supabase/sql/0029_welcome_offer.sql`: seed the `WELCOME10` row
  (`PERCENTAGE` 10, `perCustomerLimit` 1, grant-gated), add
  `requiresGrant boolean` to `discounts` if 7a has not already, and
  `issue_welcome_grant(email, clerk_user_id) returns jsonb` — idempotent on
  `(discountId, email)`, returning the code and expiry, or nothing if this email
  already had one.
- `src/actions/newsletter.ts`: on `isNew || reactivated`, issue the grant and
  pass code and expiry into the welcome letter. A subscriber who has had the
  offer before gets the letter **without** a code rather than a second grant —
  §11's "prevent the same user from repeatedly receiving the offer".
- `src/lib/email/templates.ts` + `copy.ts`: the code, its expiry and its terms,
  in both locales.
- `/admin/newsletter` gains an offer column; `/admin/discounts/[code]` lists
  grants with their state.

## Security requirements

- **The client sends a code string and nothing else.** Never a percentage, an
  amount, an eligibility verdict, or a customer id. §11 and §12 both say so, and
  6b's `checkoutSchema` already demonstrates the shape: unknown keys are
  stripped by Zod before the action sees them.
- All computation inside `place_order()`, in the transaction that writes the
  order, under the same locks. The two caps are checked against the redemption
  ledger there — a check in TypeScript would leave the gap two concurrent
  checkouts need to exceed a limit.
- `requireAdmin()` first statement of every admin action.
- Both new tables and the grants: RLS on, no policy, no grant to the public
  roles, `execute` revoked on every function. A grant row names a person's email.
- No email or discount amount in any log line.
- A discount and a Discovery Credit are mutually exclusive, enforced in SQL.

## Acceptance criteria

**7a**

1. `npm run db:migrate` applies cleanly and is idempotent; `db:verify` passes.
2. A percentage code reduces the order total server-side; Stripe charges the
   reduced amount.
3. A restricted code discounts **only** eligible lines.
4. A fixed code larger than the eligible subtotal is capped; the total never
   goes below shipping.
5. Below `minimumOrderInCents`, refused with that reason.
6. Inactive, not-yet-started and expired codes refused, each distinctly.
7. The total cap and the per-customer cap each refuse when reached.
8. Two concurrent checkouts cannot exceed a cap of one.
9. A discount and a credit together are refused.
10. Refunding releases the redemption and returns the use to both caps.
11. A tampered payload cannot change the amount applied.
12. An order with no code is byte-for-byte unchanged.

**7b**

13. Subscribing issues exactly one grant per email, however many times they subscribe.
14. The welcome letter carries the code and its expiry, in both locales.
15. `WELCOME10` typed by somebody with no grant is refused.
16. A grant is single use and expires 60 days after it was issued.
17. A refunded order restores the grant.

## Checks to run

- `npx tsc --noEmit`, `npm run lint`
- `npm run db:migrate` twice, `npm run db:verify`
- `npm run build`
- A scripted end-to-end against the live database for every numbered criterion,
  cleaning up after itself — as in phases 1–6.

## Manual test steps

Given per phase at delivery. 7a additionally wants a Stripe test-mode run to
prove the charged amount matches the discounted total, handed over as exact
steps rather than assumed.
