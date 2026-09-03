# Buy Now — a direct purchase, not a second trip through the bag

## Goal

**Buy Now goes straight to checkout with one item and leaves the bag alone.**

Today it adds the item to the cart on the way past, which is both the reported
bug and a wrong model of what the button means.

## Skills read

- `node_modules/next/dist/docs/` — `useSearchParams` in a client component under
  a `force-dynamic` route; `router.push` with a query string.

Not read: `clerk` (this touches no auth boundary — `/checkout` is already open to
guests), `supabase` (no schema change), `ai-sdk` (nothing calls a model).

## Existing code inspected

- `src/components/ecommerce/BuyNowButton.tsx` — the button, and the bug.
- `src/components/ecommerce/ProductPurchase.tsx:259`,
  `src/components/ecommerce/StickyPurchaseBar.tsx:133` — its two call sites.
- `src/providers/cart-provider.tsx:90` — `addLine()`.
- `src/components/checkout/CheckoutView.tsx` — `lines` → `resolved` → pricing,
  the discount signature, the two submit payloads, `goToConfirmation()`.
- `src/app/[locale]/checkout/page.tsx` — force-dynamic, fetches the whole
  catalog because `localStorage` is unreadable on the server.
- `src/schemas/checkout.ts` — the `items` schema both server entry points parse.

## The bug, exactly

`BuyNowButton` calls `addLine(productId, quantity, inventory)` before navigating.
`addLine()` **increments** an existing line rather than replacing it
(`cart-provider.tsx:100-109`, and correctly so — a fragrance already in the bag
should not open a second line for the same SKU).

So: add one Onyx Night to the bag, then press Buy Now on the same page, and the
bag holds two. Nothing is duplicated at the database level and no double charge
is possible — the quantity is simply wrong, and it is wrong in the customer's
favour by exactly the amount they had already chosen.

Its docblock states the old intent plainly ("The line still goes through the bag
— one cart, one source of truth"). That is the decision being reversed here, so
the comment is rewritten rather than left contradicting the code.

## Decisions

1. **Buy Now stops writing to the cart entirely.** Not "replace the line instead
   of incrementing" — that would silently discard a quantity the customer chose
   on another page, which is a worse bug than the one being fixed.
2. **The item travels in the URL**: `/checkout?buy=<productId>&qty=<n>`. The
   alternative — a second client store for "the thing being bought now" — adds a
   state that can go stale, survive a refresh it should not survive, and
   disagree with the page the customer is looking at. A query parameter is
   already the shape of "this navigation is about this product".
3. **Nothing about trust changes.** The server never priced from the client's
   numbers: `checkoutSchema` re-validates every item and `place_order()` reprices
   under a lock against `"Product"`. A line carried in a URL is exactly as
   trusted as one carried from `localStorage` — which is to say, not at all.
   `qty` is clamped client-side to the product's inventory anyway, so a
   hand-typed `?qty=999` shows the customer the number the server would enforce
   rather than a total it is about to refuse.
4. **A direct purchase does not clear the bag.** `goToConfirmation()` calls
   `clear()`, which is right for a cart order and wrong for this one: the
   customer bought one bottle directly and their bag is untouched by that.
5. **An unresolvable `?buy=` falls back to the cart**, rather than 404ing or
   showing an empty checkout. An archived product, a mistyped id, or a stale
   shared link then behaves as if the parameter were absent.
6. The two call sites keep passing `quantity` and `inventory`; only what the
   button *does* with them changes.

## Files likely to change

- `src/components/ecommerce/BuyNowButton.tsx` — navigate with the parameters
  instead of writing to the cart; rewrite the docblock.
- `src/components/checkout/CheckoutView.tsx` — resolve a direct line when the
  parameters are present, and use it everywhere `lines` is used today:
  `resolved`, `discountSignature`, the `previewDiscount` payload, the
  `placeOrder` payload, and the `clear()` decision.
- `src/lib/cart.ts` (or beside the schema) — one shared helper that parses and
  clamps the two parameters, so the button that writes them and the page that
  reads them cannot disagree about their spelling.

No schema change, no migration, no server action signature change.

## Implementation requirements

1. Zero `any`. The direct line resolves to the same
   `{ product, quantity }[]` shape `resolved` already produces, so every
   downstream calculation — `cartPricing`, the credit cap, the discount preview,
   the total — is untouched.
2. `qty` parses as a positive integer, defaults to 1, and is clamped to the
   product's `inventory` and to `MAX_QUANTITY_PER_LINE`.
3. `buy` is matched against the catalog projection the page already fetches. No
   extra query, no new endpoint.
4. The empty state (`resolved.length === 0`) must not fire for a direct purchase
   whose product resolved; it must still fire when it did not.
5. `clear()` runs only for a cart purchase. A direct purchase leaves the bag as
   it found it.
6. The cart drawer, `/cart`, and `AddToBagButton` are untouched — Add to Bag
   keeps its exact current behaviour.
7. No visual change to either button, and none to the checkout layout.

## Security requirements

- The parameters are untrusted input and are parsed, not asserted: unknown id →
  fall back to the cart; non-numeric or out-of-range `qty` → clamp.
- Nothing about price, discount eligibility or stock is taken from the URL. The
  server re-derives all three, as it does today.
- No new server entry point, so no new surface to authorise.

## Acceptance criteria

1. Item already in the bag → Buy Now → checkout shows **that item at the
   quantity chosen on the product page**, and the bag still holds exactly what
   it held before.
2. Empty bag → Buy Now → checkout shows the one item.
3. Bag holds three other products → Buy Now on a fourth → checkout shows **only
   the fourth**.
4. Completing a direct purchase leaves the bag intact; completing a cart
   purchase still empties it.
5. `/checkout` with no parameters behaves exactly as it does today.
6. `/checkout?buy=does-not-exist` renders the cart's contents, not an error.
7. `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.

## Checks to run

```
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`. Open `/perfume/onyx-night`.
2. Add to Bag with quantity 2. Confirm the bag icon shows 2.
3. Set the stepper to 1 and press **Buy Now**. Checkout must show Onyx Night ×1.
4. Go back to `/cart`: it must still hold Onyx Night ×2 — unchanged.
5. Add two other products to the bag. On a third product, press Buy Now:
   checkout shows only that third product.
6. Complete a direct purchase (or cancel at the payment step) and confirm the
   bag still holds what it held.
7. Repeat 3 from the sticky purchase bar on a long product page.
8. Visit `/checkout?buy=nonsense&qty=4` with items in the bag: the bag's
   contents render.
9. Visit `/checkout?buy=onyx-night&qty=999`: quantity is capped at stock.
10. `/ar/perfume/onyx-night` → Buy Now lands on `/ar/checkout` with the item.
