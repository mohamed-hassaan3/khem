# Checkout Voucher & Credit Experience (Priority 2)

## Goal

Deliver **Priority 2** of `src/docs/customer-experience.md` §5–6: a voucher a
customer can validate and apply **before** paying, with a clear reason when it is
refused, a visible saving when it is accepted, a way to remove it, a list of their
own eligible vouchers to choose from, and an order summary where every adjustment —
discount, credit, delivery — is stated and updates immediately.

## Skills read

- `AGENTS.md` §1 (operating rules), §2 (workflow), §3 (design system), §6 (stack),
  §8 (`/checkout` is Force Dynamic), §11–12.
- `src/docs/customer-experience.md` §5 (checkout vouchers), §6 (checkout credit),
  §19 Priority 2, §20 (server-authoritative money, no client calculation).
- `supabase/AGENTS.md` §12 as quoted inside `0028_discounts.sql`: never calculate
  final order prices on the client.

## Existing code inspected

**Already built — this phase extends it, it does not replace it**

- `src/components/checkout/DiscountStep.tsx` — a code field. No Apply, no feedback,
  no applied state. Its header currently argues *against* a live check; see the
  decisions below, because this phase changes that position and the comment must
  change with it.
- `src/components/checkout/CreditStep.tsx` — credit selector with a per-credit
  estimate, a forfeit warning, and a "Do not use a credit" row (which is already
  the "remove" affordance §6 asks for).
- `src/components/checkout/OrderReview.tsx` — subtotal, delivery, credit line,
  total. **No discount line at all.**
- `src/components/checkout/CheckoutView.tsx` — holds `discountCode` and `creditId`
  state, computes `creditAppliedInCents`, renders both steps and the review.
- `src/app/[locale]/checkout/page.tsx` — `force-dynamic`, reads `getViewer()` and
  `spendableCreditsForUser()`, passes credits down as suggestions.
- `src/actions/checkout.ts` + `src/schemas/checkout.ts` — the write path. The
  browser posts ids, quantities and a code *string*; every figure is derived
  server-side. `LIMIT` and `isRateLimited` already guard it.
- `src/lib/cart.ts` — the one implementation of subtotal, delivery and total.

**The database, which already decides all of this**

- `supabase/sql/0028_discounts.sql` — `resolve_discount(payload)` is the whole of
  the validation and the only place an amount is computed: campaign window, both
  caps counted from `discount_redemptions`, the grant gate, eligible-line subtotal
  via `discount_eligible_subtotal(order_id, discount_id)`, then the amount. It
  returns `{ ok, discountId, code, amountInCents, reason }` rather than raising —
  and its header already anticipates this phase: *"a future 'check this code'
  endpoint could show it without attempting an order."*
- `place_order()` (0028 body) — resolves the discount, writes
  `discount_redemptions`, consumes the grant, then refuses a credit if a discount
  resolved, and writes `totalInCents = subtotal + ship − discount − credit`.
- `supabase/sql/0026`/`0027` — credit ledger and redemption; credit is whole-consumed,
  fragrance-only, never combined with a discount.
- `src/services/vouchers.ts` (Priority 1) — the customer's own grants, already
  status-ranked, ready to be offered at checkout.

## Decisions and assumptions

1. **Validate through the same SQL function, never a second implementation.**
   `resolve_discount()` gains the ability to describe the bag as an `items` array
   (`{ slug, quantity }`) *as well as* an `orderId`. One function keeps deciding
   everything; `place_order()` keeps passing `orderId` and is not touched. A
   TypeScript re-implementation of the caps, the window, the grant gate and the
   eligible-line rule is exactly the drift `0028` was written to prevent.
2. **The preview takes no lock.** `resolve_discount()` currently takes
   `for update` on the discount row, which is what makes the caps real inside the
   order transaction. A preview must not hold a write lock on a popular code
   every time somebody clicks Apply, so the new payload carries a `lock` flag:
   `place_order()` passes true (unchanged behaviour), the preview passes false.
3. **This changes DiscountStep's stated position, so its header changes too.**
   That comment currently says a live check "would tell a prober which codes
   exist, one guess at a time". The concern is real and is answered rather than
   ignored: the preview is a rate-limited Server Action (reusing
   `clientKey`/`isRateLimited`), it requires a non-empty bag, and it returns the
   same customer-safe sentences `resolve_discount()` already writes — never a
   count, never a hint about a code the customer did not type. Leaving the old
   comment in place while shipping the opposite would be worse than either
   decision.
4. **The preview is advisory; the order row is the truth.** `place_order()` still
   re-resolves the code under a lock against the order it is writing. If the two
   ever disagree, the customer is charged what the order says — which is why the
   applied state is cleared whenever the bag, the email, or the credit selection
   changes, and why the confirmation keeps reading the order back.
5. **Grant-gated codes are matched by email.** `resolve_discount()`'s grant gate
   and `place_order()`'s grant consumption both key on the order's
   `customerEmail`, not on the Clerk id. So the preview passes the email currently
   in the form, and changing that email after applying drops the applied state and
   requires re-applying. See the open question — there is a UX trap here worth
   your call.
6. **"View My Available Vouchers" reuses `vouchersForUser()`.** The checkout page
   is already `force-dynamic` and already reads the session, so the AVAILABLE
   vouchers are fetched there and passed down. A guest sees no picker, because a
   grant belongs to an account. Only code, benefit, minimum and expiry cross into
   the bundle — never the grant id, never another customer's anything.
7. **Credit rules are already centralised and are not being re-opened.** The
   customer chooses one credit explicitly, it is consumed whole, it never combines
   with a discount, and delivery is never covered. That is `0026`–`0028` and the
   existing copy. Priority 2's credit work is therefore presentational: the
   summary must state the credit line (it does) and the discount line (it does
   not), and both must move the total the moment they change.
8. **No new currency maths anywhere.** Amounts continue to come back in piastres
   and render through `<Price>` / `useFormatPrice`.

## Files likely to change

**New**
- `supabase/sql/0029_discount_preview.sql` — re-declares `resolve_discount()` with
  the `items` and `lock` payload keys. No table change, no policy change, no grant.
- `src/services/discounts.ts` — `previewDiscountForCart()`, server-only, secret key.
- `src/actions/discounts.ts` — `previewDiscount(input)`: rate-limited, resolves the
  cart ids to slugs/quantities server-side, calls the service, returns a preview.
- `src/types/discount.ts` — `DiscountPreview` added to the existing vocabulary.
- `src/schemas/checkout.ts` — a small `discountPreviewSchema` beside the order one.
- `src/components/checkout/VoucherPicker.tsx` — the customer's own vouchers,
  each with "Use this code".

**Modified**
- `src/components/checkout/DiscountStep.tsx` — Apply / applied / Remove / reason,
  and a rewritten header.
- `src/components/checkout/OrderReview.tsx` — a discount row above the credit row.
- `src/components/checkout/CheckoutView.tsx` — `appliedDiscount` state, the
  invalidation rules from decision 4, wiring for the picker.
- `src/app/[locale]/checkout/page.tsx` — fetch the customer's AVAILABLE vouchers.
- `src/lib/i18n/dictionaries/en.ts` + `ar.ts` — apply/remove/applied/saved/reason
  copy under `checkout.discount`, plus `checkout.review.discount`.

## Implementation requirements

**SQL (`0029`)**
- `resolve_discount()` accepts `items` (array of `{slug, quantity}`) as an
  alternative to `orderId`; when `items` is present the eligible subtotal is
  computed from those lines against `discounts`, `discount_products` and
  `discount_collections` using the **same** ALL / PRODUCTS / COLLECTIONS rule.
- Prices come from `"Product"` rows, never from the payload. A payload line
  carrying a price is ignored, not honoured.
- `lock` defaults to true so `place_order()`'s existing call is unchanged in every
  respect.
- Same return shape, same reason sentences. No new refusal wording invented here.
- `security definer`, `set search_path = public`, `execute` revoked from the public
  roles — matching every function in `0028`.

**Preview action**
- Input: the cart lines (`productId` + `quantity`), the code, the email, and the
  locale. Zod-validated with the same shapes the order schema uses.
- Rate-limited per client, refused on an empty bag, and it never reports anything
  about a code the caller did not type.
- Returns `{ ok: true, code, amountInCents }` or `{ ok: false, reason }`, where
  `reason` is the sentence `resolve_discount()` produced.
- Writes nothing. No redemption row, no grant consumption.

**Checkout UI**
- Field + **Apply**; while in flight the button is busy and the field is locked.
- Applied state: `✓ CODE applied`, the saving as a formatted amount, and
  **Remove** — which clears the code and the state in one action.
- Refusal: the server's sentence shown beneath the field, `aria-live="polite"`,
  never replaced by a generic "something went wrong" when a real reason exists.
- The applied state is dropped, and the customer told to re-apply, when the bag
  changes, the email changes, or a credit is selected.
- Order summary rows, in order: Subtotal → Discount (−) → KHEM Credit (−) →
  Delivery → Total. Every row moves in the same render as the state that caused it.
- Voucher picker: a disclosure listing the signed-in customer's AVAILABLE
  vouchers, each showing code, benefit, minimum and expiry, with an action that
  fills the field and applies in one step.
- KHEM styling throughout: gold hairlines, Cinzel micro-labels, 300–500ms
  `ease-luxury-bezier`, no bounce.

## Security requirements

- The client sends a **code string** and cart ids. It never sends, and the server
  never reads, a price, a discount amount, a subtotal or a total.
- The preview's answer is not a permission and is never persisted; `place_order()`
  re-resolves under a lock inside the order transaction.
- Identity for the grant gate comes from the form's email and, where present, the
  session — the same values the order will carry, never a separate claim.
- Rate limiting on the preview action; empty-bag refusal; no enumeration signal
  beyond the sentence for the exact code typed.
- No new table, no RLS change, no grant to the public roles; every read stays
  behind the secret key.
- No voucher or credit identifier is written to a query string or a log line.

## Acceptance criteria

- [ ] A valid code applied at checkout shows the code, the saving, and a Remove
      control, and the summary's Discount row and Total change immediately.
- [ ] An invalid, expired, not-yet-active, fully-redeemed, already-used,
      wrong-bag or below-minimum code each produce their own sentence — never a
      generic error.
- [ ] Remove clears the code and restores the original total.
- [ ] A signed-in customer can open their voucher list, pick one, and have it
      applied without typing.
- [ ] A guest sees no voucher list and can still type a code.
- [ ] Selecting a credit disables the discount field and vice versa; the database
      still refuses the combination if both somehow arrive.
- [ ] Placing the order charges exactly what the summary showed, and the
      confirmation reads the order back.
- [ ] The applied state does not survive a bag or email change.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` clean; `ar.ts` compiles.

## Checks to run

```bash
npm run db:migrate     # applies 0029; re-runnable, one transaction
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run db:migrate`, then `npm run dev`.
2. In `/admin/discounts`, create `TEST10` — 10%, active, no minimum, scope ALL.
3. Add a fragrance to the bag, go to `/checkout`, type `TEST10`, press Apply →
   the saving appears, the Discount row appears, the Total drops by it.
4. Press Remove → the row disappears and the Total returns.
5. Type a code that does not exist → "That code is not recognised."
6. Set a minimum above the bag's subtotal → apply → the minimum sentence.
7. Set `endsAt` in the past → apply → the expiry sentence.
8. Restrict the code to a collection nothing in the bag belongs to → apply →
   "That code does not apply to anything in your bag."
9. Sign in as an account holding a granted voucher (from the Priority 1 flow),
   open the voucher list at checkout, pick it → applied without typing.
10. Apply a code, then change the email field → the applied state clears.
11. Apply a code, then select a Discovery Credit → the discount is dropped and the
    field explains why.
12. Place the order (cash) → the confirmation total equals the summary total, and
    `/admin/orders/<number>` shows the same discount amount and a redemption row.
13. Repeat 3–5 under `/ar/checkout`; confirm Arabic copy and mirrored layout.
14. At 320px, confirm the applied state and summary rows do not overflow.

## Open questions for the user

1. **The granted-email trap.** A grant is addressed to an email address, and both
   the gate and the consumption key on the order's `customerEmail`. A customer
   signed in as `a@x.com` who types `b@y.com` at checkout is refused with "That
   code is not available on this order", which is true but unhelpful. Options:
   (a) leave it — the reason is honest and the picker prefills the right address;
   (b) have the picker warn when the form's email differs from the granted one;
   (c) widen the SQL gate to accept a matching `clerkUserId` as well as the email.
   (c) is a real rule change and I would not make it without you saying so.
   My recommendation is (b), which is presentation only.
2. **Preview rate limit.** I propose reusing the checkout's shape — 8 attempts per
   10 minutes per client — so a customer retyping a code is never locked out.
   Tighter is possible if you would rather bias against enumeration.
