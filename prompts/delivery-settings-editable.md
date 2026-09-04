# Delivery terms, editable, per channel

## Goal

Move the delivery fee and the free-delivery minimum out of hard-coded constants
and into a row the house can edit, with a separate value for **online** orders
and **offline** (walk-in) orders.

The minimum stays **EGP 1,400**. Today the code says EGP 2,000; this task brings
it to 1,400 and makes it editable, so the next change is a form field rather
than a deploy.

## Skills read

`.agents/skills/supabase` for the table, its RLS and the PostgREST cache reload.
No Clerk change (the screen already sits behind `requireAdmin()`), no AI SDK.

## Existing code inspected

- `src/lib/cart.ts:15-20` — `FREE_SHIPPING_THRESHOLD_IN_CENTS = 200_000` and
  `SHIPPING_FEE_IN_CENTS = 9_000`, with a comment already warning that the
  dictionary repeats the figure and *"Change both together."*
- `src/lib/cart.ts:44-61` — `shippingInCents`, `cartTotalInCents`,
  `amountToFreeShippingInCents`, all reading the two module constants.
- `src/actions/checkout.ts:274` — the server prices delivery with the same
  `shippingInCents()`, then hands `shipInCents` to `place_order()`. The database
  takes the figure from the payload (`0051_retire_pending.sql:123`); it does not
  compute it.
- `src/components/ecommerce/CartSummary.tsx:53-55`, `CartDrawer.tsx:207`,
  `src/components/checkout/OrderReview.tsx:80-83`,
  `src/components/checkout/CheckoutView.tsx:335` — all client components calling
  those functions.
- `src/components/admin/OrderForm.tsx:78,112,334` — the offline/online order
  desk already types a free "Delivery (EGP)" figure, defaulting to `"0"`, and has
  a `channel` select (`ONLINE` / `OFFLINE`).
- `src/lib/i18n/dictionaries/en.ts:844` — `"On all orders over EGP 2,000"`;
  `:1139` — the cart page metadata repeats it; `:1163` — `freeShippingNudge`
  already interpolates `{amount}`. `ar.ts` mirrors all three.
- `supabase/sql/0015_orders.sql:60` — `public."OrderChannel"` enum, the key this
  table is dimensioned on.
- `src/app/[locale]/admin/settings/page.tsx`, `HouseSettingsForm.tsx`,
  `src/services/admin/settings.ts`, `src/actions/admin/settings.ts`,
  `src/schemas/settings.ts` — the pattern this screen follows.
- `src/providers/currency-provider.tsx` and `src/app/[locale]/layout.tsx` — how a
  server-read value reaches the client cart.

## Decisions

1. **A table keyed on `"OrderChannel"`**, two rows, not a pair of columns on
   `"BoutiqueSetting"`. Adding a channel later is a row; and a per-channel rule
   written as `onlineFee`/`offlineFee` columns is the same fact stored twice in
   the schema's shape.
2. **`src/lib/cart.ts` stays pure.** Its functions take a `DeliveryTerms`
   argument instead of reading module constants. That is what keeps its opening
   promise — one implementation behind the quoted total and the charged total —
   true once the numbers can differ per channel.
3. **The terms reach the client through a provider**, read once on the server in
   `src/app/[locale]/layout.tsx`, the way the currency does. The alternative — a
   fetch from the cart — would render a wrong total for a frame.
4. **The offline field is prefilled, not locked.** Confirmed with the user. The
   desk negotiates delivery on a walk-in; the setting supplies the default and
   the typed figure still wins. A manual edit is never overwritten by a later
   subtotal change.
5. **The copy stops repeating the number.** `dict.product.trust.delivery.desc`
   and the cart metadata line take `{amount}` and are interpolated from the live
   terms, in both trees. This is the "change both together" comment being
   retired rather than re-honoured.
6. **`DEFAULT_DELIVERY_TERMS` remains in code** — EGP 90 and EGP 1,400 — as the
   fallback when the row cannot be read. Consistent with
   `src/services/settings.ts`, which keeps a hard-coded address for the same
   reason: a total is not something the site may decline to state.

## Assumptions

- Seeded values: **ONLINE** fee `9_000`, threshold `140_000`; **OFFLINE** the
  same. This changes the offline form's prefill from a flat `0` to a computed
  figure — flagged because it is a behaviour change at the desk, and trivially
  reversible by setting the offline fee to `0` on the new screen.
- "Minimum Order" means the free-delivery threshold, per the user's answer. No
  minimum basket floor is introduced; an order below EGP 1,400 is still
  accepted, it simply pays delivery.
- Existing orders are untouched. `"Order"."shipInCents"` is a recorded fact.

## Files likely to change

**Database**

- `supabase/sql/0053_delivery_terms.sql` — new, idempotent:
  - `create table if not exists public."DeliverySetting"` — `channel
    public."OrderChannel" primary key`, `"feeInCents" int not null default 0
    check (>= 0)`, `"freeThresholdInCents" int not null default 0 check (>= 0)`,
    `"updatedAt" timestamptz not null default now()`.
  - Seed both rows with `on conflict do nothing`, so a re-run never overwrites an
    editor's figure.
  - `enable row level security`; `grant select to anon, authenticated` with a
    read-everything policy — a delivery fee is printed on the cart page, there is
    nothing to hide. No insert/update/delete policy: writes go through the
    service role, as everywhere else.

**Read path**

- `src/schemas/db/delivery.ts` — new. `DELIVERY_SETTING_COLUMNS`, the row
  schema, `toDeliverySetting()`, and the `DeliveryTerms` type, following
  `src/schemas/db/directory.ts`.
- `src/services/delivery.ts` — new. `getDeliveryTerms(channel)` for the
  storefront, falling back to `DEFAULT_DELIVERY_TERMS` on any failure and
  logging the provider's message, exactly as `src/services/settings.ts` does.
- `src/services/admin/settings.ts` — `listDeliverySettings()`, secret key,
  explicit columns, empty projection on failure.

**Arithmetic and its consumers**

- `src/lib/cart.ts` — `DeliveryTerms` in, `DEFAULT_DELIVERY_TERMS` exported,
  `shippingInCents(subtotal, terms)`, `cartTotalInCents(subtotal, terms)`,
  `amountToFreeShippingInCents(subtotal, terms)`. Rewrite the header comment:
  the threshold is a stored figure now, and the dictionary no longer repeats it.
- `src/providers/delivery-provider.tsx` — new, `useDeliveryTerms()`.
- `src/app/[locale]/layout.tsx` — read the ONLINE terms, wrap inside
  `<CurrencyProvider>`.
- `CartSummary.tsx`, `CartDrawer.tsx`, `OrderReview.tsx`, `CheckoutView.tsx` —
  take the terms from the hook and pass them through.
- `src/actions/checkout.ts` — `await getDeliveryTerms("ONLINE")` before
  pricing. The server reads the row itself; it never trusts a figure from the
  client, which is unchanged from today.

**Admin**

- `src/schemas/settings.ts` — `updateDeliverySettingSchema`: channel enum, fee
  and threshold typed in EGP and converted to piastres once, reusing the
  `priceEgpField` pattern in `src/schemas/admin.ts` so no component multiplies
  by 100.
- `src/actions/admin/settings.ts` — `updateDeliverySetting()`, `requireAdmin()`
  first statement, update-never-insert like the `"BoutiqueSetting"` singleton, a
  reported failure when it matches no row.
- `src/lib/admin/revalidate.ts` — `revalidateDelivery()`: the cart page, the
  checkout, and the PDP surfaces that print the trust line.
- `src/components/admin/DeliverySettingsForm.tsx` — new, one card per channel,
  following `HouseSettingsForm.tsx` exactly: `useUnsavedGuard`, `payload`
  hoisted, toast on success, `AdminNotice` retained on failure.
- `src/app/[locale]/admin/settings/page.tsx` — a **Delivery** section with a
  paragraph saying plainly that these figures are what the cart quotes and what
  the checkout charges.
- `src/components/admin/OrderForm.tsx` — prefill `shipEgp` from the terms for
  the selected channel and current subtotal; a `shipTouched` flag so a typed
  figure is never recomputed over.

**Copy**

- `en.ts` / `ar.ts` — `product.trust.delivery.desc` and the cart metadata
  description take `{amount}`; delete the "EGP 2,000" literals.

## Security requirements

- `updateDeliverySetting()` opens with `requireAdmin()` and parses before it
  queries. No exception.
- The table holds no secret; `select` for `anon` is correct and deliberate, and
  the migration header should say why rather than leaving it to be questioned.
- The channel is a closed enum both sides; no free text reaches the key.
- The client's delivery figure remains advisory. `src/actions/checkout.ts`
  re-reads the terms and reprices, so a tampered client cannot buy cheap
  delivery — state this in the action's numbered comment, which already
  documents the trust boundary.

## Acceptance criteria

1. A bag under EGP 1,400 is quoted EGP 90 delivery; at or above it, complimentary
   — on the cart page, in the drawer, and on the checkout review.
2. The nudge counts down to 1,400, and the PDP trust line reads "over EGP 1,400"
   in English and its Arabic equivalent, from the setting.
3. Changing the online fee in the dashboard changes the quoted figure without a
   deploy.
4. Changing the offline fee changes what `/admin/orders/new` prefills, and typing
   over that figure still wins.
5. The order written by a checkout carries the `shipInCents` the setting implies,
   not one supplied by the browser.
6. With `SUPABASE_SECRET_KEY` unset or the row missing, the cart still quotes
   EGP 90 / EGP 1,400 and logs the failure — it does not throw and does not
   quote zero.
7. `npm run db:migrate` twice leaves the edited figures untouched.

## Checks to run

```
npm run lint
npx tsc --noEmit
npm run db:migrate     # confirm the PostgREST reload line printed
npm run db:verify
npm run build
```

The reload line matters more than usual here: this migration **creates a table**,
and `@supabase/supabase-js` reads through a cached PostgREST schema. Without the
reload the service falls back silently and the screen looks broken while the
migration looks green — AGENTS.md §9.

## Manual test steps

1. `npm run db:migrate`, then `npm run dev`.
2. Add one product to the bag so the subtotal is under EGP 1,400. Open `/cart`:
   delivery reads EGP 90 and the nudge names the remainder to EGP 1,400.
3. Raise the quantity past EGP 1,400: delivery becomes complimentary, in the
   drawer and on `/cart` alike.
4. Open a product page and read the trust block — "over EGP 1,400". Switch to
   `/ar` and confirm the Arabic line agrees.
5. Complete a cash-on-delivery checkout under the threshold. Open the order in
   `/admin/orders/<number>` and confirm the delivery line is EGP 90.
6. Go to `/admin/settings` → Delivery. Set the online fee to 120 and save.
   Reload `/cart` and confirm EGP 120.
7. Set the offline fee to 60. Open `/admin/orders/new`, choose channel OFFLINE,
   add a line under the threshold, and confirm Delivery prefills 60. Type 0 over
   it, change the quantity, and confirm it stays 0.
8. Set the online threshold back to 1400 and confirm the storefront follows.
