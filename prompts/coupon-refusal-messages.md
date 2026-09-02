# Coupon Refusal Messages — Specific, Bilingual, Consistent

Source brief: `src/docs/imporve-coupon-message.md`.

## Goal

When a customer enters a discount code that cannot be applied, tell them **the actual
reason**, with the specifics that let them act on it — the minimum order required, the
collection or products the code is limited to — in English and Arabic, and with the same
wording whether the refusal arrives at the code field or at the payment button.

Never call a code "not recognised" when it is a real code that simply does not apply to
the bag as it stands.

## Skills read

- `AGENTS.md` (this repo's single source of truth) — §1 rules, §2 workflow, §3 design
  tokens, §6 stack, §9 schema discipline (SQL changes go in a migration, never a direct
  mutation).
- `.agents/skills/supabase` conventions as already practised in `supabase/sql/` —
  additive, idempotent, `security definer`, privileges revoked from public roles.
- No Vercel Workflow / AI SDK involvement. The hook that suggested them matched on
  lexical noise; nothing in this task calls a model or a queue.

## Existing code inspected

| File | What it establishes |
| :-- | :-- |
| `supabase/sql/0028_discounts.sql` | The engine. `resolve_discount()` is the single definition of whether a code applies and what it is worth. `place_order()` (line ~570) resolves under a lock and `raise exception '%'` with the English `reason` (line ~580). |
| `supabase/sql/0029_discount_preview.sql` | Re-declares `resolve_discount()` to accept an `items` bag and a `lock` flag, and adds `reasonCode` beside every refusal sentence. Also `discount_cart_subtotal()` and `discount_eligible_cart_subtotal()`. |
| `src/types/discount.ts` | `DiscountRefusalCode` union (12 codes) and the `DiscountPreview` result type. |
| `src/schemas/db/discount-preview.ts` | `toDiscountPreview()` — parses the RPC reply; an unknown `reasonCode` degrades to `UNKNOWN` carrying the English sentence rather than dropping the reply. |
| `src/services/discounts.ts` | `previewDiscountForCart()` — hands the bag to the RPC with `lock: false`, no local re-implementation of any rule. |
| `src/actions/discounts.ts` | `previewDiscount` — throttled 8 / 10 min, requires a resolvable bag, takes the email from the form and the Clerk id from the session. |
| `src/components/checkout/DiscountStep.tsx` | Renders the refusal: translated sentence by `reasonCode`, server English as the `UNKNOWN` fallback. Also `blockedByCredit` (the discount ⊕ Discovery Credit conflict). |
| `src/components/checkout/CheckoutView.tsx` | Holds `discountCode` / `applied` / `discountRefusal`; stamps the applied estimate with a `discountSignature` so it goes stale when the bag, email or credit moves. |
| `src/actions/checkout.ts` | `placementFailure(message)` (line 146) string-matches the raise text; `error.message` is passed at line 307. `formError: "discountRejected"` + English `detail`. |
| `src/components/ecommerce/CartSummary.tsx` | Documents *why* there is no coupon field in the bag. Unchanged by this work — see Decisions. |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | `checkout.discount.reason` — the 12 translated sentences, keyed by `DiscountRefusalCode`. |
| `src/lib/i18n/interpolate.ts`, `src/lib/i18n/rtl.ts`, `src/components/ecommerce/Price.tsx`, `src/providers/currency-provider.tsx` | `{placeholder}` interpolation, `ltrIsland()` for Latin-by-design text, `useFormatPrice()` for money in the visitor's currency. |

## Decisions and assumptions

1. **Checkout only. No coupon field is added to the Cart.** Confirmed with the user.
   `CartSummary`'s header argument stands; "consistent in Cart and Checkout" is satisfied
   by one engine and one entry point, not by two fields. The *other* place a refusal can
   surface — the payment button, via `place_order()` — is brought onto the same
   translated vocabulary by this work (item 4 below), which is where the real
   inconsistency actually was.
2. **Detail is exposed for public codes only.** Confirmed with the user. When
   `discounts."requiresGrant"` is true the refusal keeps today's neutral wording and
   carries no `detail`, so an invitation-only campaign's minimum, collections or products
   are never named to somebody holding a leaked string.
3. **Nothing new is computed in TypeScript.** Every figure and name in a message comes
   from `resolve_discount()`. The client's only job is to pick a sentence and format the
   money in the visitor's currency.
4. **A pre-migration database must keep working.** `detail` is optional everywhere; when
   it is absent the existing generic sentence is shown. Deploying the code before running
   `npm run db:migrate` degrades, it does not break.
5. **Collection names are localised, product names are not.** `Collection.name_ar` exists;
   `Product.name` is a proper noun kept in Latin script on `/ar` per
   `supabase/sql/0008_i18n_content.sql`. So the payload carries `name` and `nameAr` per
   entry and the client resolves with the English fallback, exactly as `resolveText()`
   does elsewhere.
6. **At most three names, then a count.** A refusal that lists nine collections is not a
   message. Three plus "and N more".
7. **No new refusal codes.** The twelve existing ones already name every state the brief
   lists; the discount ⊕ credit conflict is a client-side state (`blockedByCredit`) and
   the SQL raise at `0028` line ~667, both of which already exist and are only reworded.

## Files likely to change

**New**

- `supabase/sql/0040_discount_refusal_detail.sql` — re-declares `resolve_discount()`
  (the `0029` body plus a `detail` object on refusals, and `using hint` on the
  `place_order()` raise), and nothing else. No table, column, policy or grant.
- `src/lib/discount-message.ts` — the one pure function that turns a refusal into a
  sentence. Client-safe, no `server-only`, no imports from `src/services/`.

**Edited**

- `src/types/discount.ts` — `DiscountRefusalDetail`, and `detail?` on the refusal arm.
- `src/schemas/db/discount-preview.ts` — parse `detail`, tolerantly.
- `src/lib/i18n/dictionaries/en.ts`, `src/lib/i18n/dictionaries/ar.ts` — the detailed
  sentences and the list-joining copy.
- `src/components/checkout/DiscountStep.tsx` — call the helper instead of indexing
  `copy.reason` inline.
- `src/actions/checkout.ts` — read `error.hint` beside `error.message` so the
  payment-button refusal carries a `reasonCode` the client can translate.
- `src/types/checkout.ts` (or wherever `CheckoutResult` lives) — carry that code.
- `src/components/checkout/CheckoutView.tsx` — render the translated sentence for a
  `discountRejected` failure that carries a code, English `detail` otherwise.

## Implementation requirements

### 1. SQL — `supabase/sql/0040_discount_refusal_detail.sql`

Re-declare `public.resolve_discount(payload jsonb)` from the `0029` body. **Change only
what is listed here**; every other statement is copied verbatim, because two divergent
copies of the eligibility rules is the exact failure `0028`'s header was written to
prevent. Head the file with a comment saying so.

Add a local `v_public boolean := not v_d."requiresGrant";` after the discount row is
read, and attach `detail` to these refusals only when `v_public` is true:

- **`BELOW_MINIMUM`** → `jsonb_build_object('minimumInCents', v_d."minimumOrderInCents")`.
- **`NOTHING_ELIGIBLE`** → when `v_d."appliesTo" = 'COLLECTIONS'`:
  ```
  { "scope": "COLLECTIONS",
    "names":   [{ "name": <Collection.name>, "nameAr": <Collection.name_ar> }, … up to 3],
    "more":    <count beyond the three, 0 when none> }
  ```
  ordered by `Collection."sortOrder"` then `name`, joined through `discount_collections`.
  When `v_d."appliesTo" = 'PRODUCTS'`, the same shape with `"scope": "PRODUCTS"`, names
  from `"Product".name` (`nameAr` omitted — the column does not exist), archived products
  excluded, ordered by `name`. When `appliesTo = 'ALL'` there is no detail.

Refusals other than those two carry no `detail`. Do not add `detail` to the `ok: true`
branch.

Then, in the **same file**, re-declare `place_order()`'s discount raise so the reason code
travels with the sentence. Copy the `0028` body and change **only** line ~580 to:

```sql
raise exception '%', coalesce(v_discount->>'reason', 'That code cannot be used.')
  using hint = 'DISCOUNT:' || coalesce(v_discount->>'reasonCode', 'UNKNOWN');
```

If re-declaring the whole of `place_order()` in this file is judged too large a copy to
keep honest, the acceptable alternative is to leave `place_order()` alone and have
`src/actions/checkout.ts` keep its English `detail` for the button path — say so
explicitly in the file header and drop items 4's client half. **Prefer the `hint`.**

Close with the same `revoke all … from public, anon, authenticated` block `0029` ends
with, for every function the file re-declares.

### 2. Types — `src/types/discount.ts`

```ts
export interface DiscountRefusalName {
  name: string;
  /** Null on a product, and on a collection with no Arabic name. */
  nameAr?: string | null;
}

export interface DiscountRefusalDetail {
  /** Piastres. Present on BELOW_MINIMUM for a public code. */
  minimumInCents?: number;
  /** Present on NOTHING_ELIGIBLE for a restricted public code. */
  scope?: "PRODUCTS" | "COLLECTIONS";
  names?: readonly DiscountRefusalName[];
  /** Eligible sets beyond the three named. */
  more?: number;
}
```

Add `detail?: DiscountRefusalDetail` to the `ok: false` arm of `DiscountPreview`, with a
doc comment stating that its absence is normal — a grant-gated code, a refusal that has
no specifics, or a database that has not run `0040`.

### 3. Schema — `src/schemas/db/discount-preview.ts`

Parse `detail` with a permissive object schema (`.optional()`, unknown keys stripped,
`names` capped at 3 by `.slice(0, 3)` after parse rather than by a failing `.max()`).
A `detail` that fails to parse must **not** invalidate the reply: drop it and keep the
`reasonCode` and sentence. Extend the module header to say so.

### 4. Server action — `src/actions/checkout.ts`

At the `place_order` failure site (line ~306) read `error.hint`. When it starts with
`DISCOUNT:`, return
`{ ok: false, formError: "discountRejected", reasonCode: <the rest>, detail: error.message }`.
Narrow `reasonCode` through the same enum the preview uses; anything unrecognised is
dropped and the English `detail` alone is shown, which is today's behaviour.

Leave `placementFailure`'s string matching in place for the stock, archived and credit
cases — those are out of scope and their header's argument still holds.

### 5. The message helper — `src/lib/discount-message.ts`

One exported function, no JSX, no side effects:

```ts
export function discountRefusalMessage(
  refusal: Extract<DiscountPreview, { ok: false }>,
  copy: Dictionary["checkout"]["discount"],
  locale: Locale,
  formatPrice: (cents: number) => string,
): string
```

Rules, in order:

1. `reasonCode === "UNKNOWN"` → `refusal.reason` (the server's English sentence).
2. `BELOW_MINIMUM` with `detail.minimumInCents` → `copy.reasonDetail.BELOW_MINIMUM`
   interpolated with `{amount: formatPrice(minimumInCents)}`.
3. `NOTHING_ELIGIBLE` with `detail.scope` and at least one name → the
   one-name / many-names variant for that scope, interpolated with `{names}` (and
   `{count}` for the `more` suffix). Resolve each name as
   `locale === "ar" ? (nameAr?.trim() || name) : name`; join with
   `new Intl.ListFormat(locale, { style: "long", type: "conjunction" })`; append
   `copy.reasonDetail.andMore` when `more > 0`.
4. Anything else → `copy.reason[refusal.reasonCode]`.

Header comment: this function exists so the *selection* of a sentence is testable and has
one home, and it decides nothing about eligibility — every fact it renders arrived from
`resolve_discount()`.

### 6. Copy — both dictionaries

Keep the existing `reason` map as the fallback layer and rewrite it to the brief's tone
(short, elegant, and never "invalid" for a code that is merely inapplicable). English:

```
NO_CODE:          "Enter a code first."
NOT_RECOGNISED:   "This code is not valid."
INACTIVE:         "This code is no longer active."
NOT_STARTED:      "This code is not available yet."
EXPIRED:          "This code has expired."
BELOW_MINIMUM:    "This code needs a larger order."
NOT_GRANTED:      "This code is not available on this account."
ALREADY_USED:     "You have already used this code."
FULLY_REDEEMED:   "This code has reached its limit."
CUSTOMER_LIMIT:   "You have already used this code."
NOTHING_ELIGIBLE: "This code does not apply to anything in your bag."
ZERO_AMOUNT:      "This code takes nothing off this order."
```

Add beside it:

```
reasonDetail: {
  BELOW_MINIMUM: "This code applies to orders of {amount} or more.",
  COLLECTIONS_ONE:  "This code is valid only for the {names} collection.",
  COLLECTIONS_MANY: "This code is valid only for selected collections: {names}.",
  PRODUCTS_ONE:     "This code is valid only for {names} — it is not in your bag.",
  PRODUCTS_MANY:    "This code is valid only for selected fragrances: {names}.",
  andMore: " and {count} more",
}
```

Arabic: full, idiomatic translations of all of the above — not transliterations, and not
English left in place. `{amount}` is already Western-digit formatted by
`src/lib/format.ts`. Where a resolved name is Latin script inside Arabic prose, the
component wraps the rendered sentence's Latin run — see item 7.

### 7. `DiscountStep.tsx`

Replace the inline `refusalText` ternary with `discountRefusalMessage(...)`, taking
`formatPrice` from `useFormatPrice()`. Keep the single `aria-live="polite"` region, the
`text-danger` / `text-warning` split, and the stale notice exactly as they are.

For the Arabic tree, give the refusal paragraph `dir="auto"` rather than `ltrIsland` —
the sentence is Arabic prose that may contain a Latin name, which is precisely the case
`src/lib/i18n/rtl.ts` says `dir="auto"` is for.

Reword `blockedByCredit` in both dictionaries so the conflict is stated plainly, per the
brief's last bullet: what cannot be combined, and what to do about it. Keep it to two
short sentences.

### 8. `CheckoutView.tsx`

When a submission fails with `formError: "discountRejected"` and a recognised
`reasonCode`, show the translated sentence (through the same helper, with an empty
`detail`) instead of the English `detail`. With no code, behave exactly as today.

## Security requirements

- No new privilege. `0040` revokes execute from `public`, `anon`, `authenticated` on every
  function it re-declares, matching `0028`/`0029`.
- **No detail on a grant-gated code, ever.** The `v_public` guard is the single place this
  is enforced; do not add a second check in TypeScript that could drift from it.
- The preview's throttle (8 / 10 min, own scope) and its mandatory resolvable bag are
  unchanged. The new detail adds no oracle the caller did not already have: it describes
  only the code the caller typed and already holds.
- No price, minimum or name is ever read from the browser. Every figure originates in a
  row read inside `resolve_discount()`.
- Nothing here is persisted and no grant or redemption is consumed.

## Acceptance criteria

- A real code limited to one collection, with nothing eligible in the bag, reads
  "This code is valid only for the KHEM Noir collection." — never "not recognised".
- A code below its minimum names the minimum in the visitor's display currency.
- A grant-gated code refuses with the neutral sentence and names no minimum, collection
  or product.
- Every one of the twelve refusal codes renders a translated sentence on `/ar`, with no
  English leaking except through the deliberate `UNKNOWN` fallback.
- A refusal at the payment button reads the same as the refusal at the field.
- Running the app against a database that has not applied `0040` shows the current
  generic sentences with no error and no blank message.
- `resolve_discount()` remains the only definition of eligibility; no TypeScript module
  re-derives a minimum, a scope or an amount.
- Zero `any`. `npm run lint` clean. No layout shift or new animation in `DiscountStep`.

## Checks to run

```
npm run lint
npx tsc --noEmit
npm run db:migrate      # applies 0040
npm run db:verify
npm run build
```

## Manual test steps

Assumes admin access at `/admin/discounts` and at least one product in a known collection.

1. **Below minimum** — create a public code (`requiresGrant` off) with a minimum above
   your bag's subtotal. At `/checkout`, apply it → the message names the minimum in the
   active currency. Switch the currency switcher → the figure re-formats.
2. **Collection-limited** — create a public code with `appliesTo = COLLECTIONS` scoped to
   one collection, and put a product from a *different* collection in the bag. Apply →
   the collection is named. Add an eligible product → it applies and shows the saving.
3. **Three or more collections** — scope a code to four collections, bag nothing eligible.
   Apply → three names plus "and 1 more".
4. **Product-limited** — same with `appliesTo = PRODUCTS`.
5. **Grant-gated** — apply the welcome code from an address holding no grant → the neutral
   "not available on this account" sentence, with no minimum and no names anywhere in the
   response (check the Network tab payload, not just the screen).
6. **Expired / not started / inactive** — flip `endsAt`, `startsAt`, `isActive` in turn and
   confirm each reads distinctly.
7. **Caps** — set `totalUseLimit` to its current usage → "reached its limit"; set
   `perCustomerLimit: 1` and redeem once → "You have already used this code."
8. **Unknown code** — type `NONSENSE123` → "This code is not valid."
9. **Conflict** — select a Discovery Credit → the field disables and states the conflict.
10. **Button parity** — apply a valid code, then in another tab exhaust its total limit,
    then place the order → the failure beneath the button reads the same sentence, in the
    active language.
11. **Arabic** — repeat 1, 2, 5 and 8 on `/ar/checkout`: every sentence is Arabic, amounts
    are Western digits, and a Latin collection name does not scramble the line's
    direction.
12. **Pre-migration** — on a database without `0040` (or with the detail branches
    temporarily unreachable), repeat 1 and 2 → generic sentences, no crash.
