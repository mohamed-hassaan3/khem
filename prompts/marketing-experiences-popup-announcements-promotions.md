# Customer marketing experiences — offer popup, announcement bar, promotional pricing

## Goal

Implement `src/docs/customer-marketing-experiences.md` in full: three **separate**
systems — (A) a premium subscribe/earn-offer popup, (B) a global announcement bar
with static / marquee / carousel modes, (C) product & collection promotional
pricing — with admin management, EN/AR + RTL, responsive UI, and server-side
pricing.

## Skills / docs read

- `AGENTS.md`, `supabase/AGENTS.md`
- `src/docs/customer-experience.md` (§ vouchers, credits, welcome offer)
- `src/docs/customer-marketing-experiences.md` (the specification)
- No AI SDK involvement; the hook-suggested `ai-sdk` / `chat-sdk` skills are not
  relevant to this task.

## Existing code inspected

- `supabase/sql/0001_catalog.sql` (Product/Collection, RLS conventions),
  `0003_directory.sql` (`BoutiqueSetting`), `0006_privileges.sql`,
  `0024_customers.sql`, `0025_newsletter.sql` (`subscribe_newsletter`),
  `0026`–`0027` (credits), `0028_discounts.sql` (discount engine, `place_order`,
  `resolve_discount`, `discount_eligible_subtotal`), `0029_discount_preview.sql`,
  `0030_welcome.sql` (`discounts."isWelcome"`, `claim_welcome`).
- `src/services/products.ts`, `src/schemas/db/catalog.ts`, `src/types/catalog.ts`
- `src/services/orders.ts` (`resolveCartToLines`), `src/actions/checkout.ts`
- `src/services/{discounts,newsletter,welcome,settings}.ts`
- `src/services/admin/*`, `src/actions/admin/*`, `src/lib/admin/{auth,revalidate}.ts`
- `src/components/admin/{fields,AdminTable,AdminShell,DiscountForm}.tsx`
- `src/components/ecommerce/*` (ProductCard, MerchCard, DiscoverySetCard,
  ArrivalShowcase, ProductPurchase, StickyPurchaseBar, Cart*, CollectionGrid/View,
  Price)
- `src/app/[locale]/layout.tsx`, `src/components/Nav.tsx`, `src/app/globals.css`
- `src/lib/i18n/*`, `src/providers/*`, `src/lib/{storage,consent,cart,currency}.ts`

## Decisions / assumptions

1. **Three systems stay separate.** Promotions are a *new* table set
   (`promotions`, `promotion_products`, `promotion_collections`). They are a
   **price**, not a code. The existing `discounts` engine (welcome / invitation /
   campaign codes) is untouched apart from where the two must interact.
2. **Pricing priority (documented rule).**
   1. Promotional price replaces the list price for a line. Exactly **one**
      promotion applies per product: product-targeted beats collection-targeted,
      then higher `priority`, then the larger reduction, then newest.
      Promotions never stack with each other.
   2. A discount **code** then applies to the promoted subtotal — but a line
      under a promotion is excluded from the code's eligible subtotal unless the
      promotion is explicitly flagged `stacksWithCodes`.
   3. Discovery Credit stays mutually exclusive with a code (existing rule) and
      applies to whatever remains.
   4. Delivery is never discounted (existing rule).
3. **Announcement rotation mode is a house setting**, not per announcement, and
   lives with the popup configuration on a new `"MarketingSetting"` singleton.
   `sortOrder` doubles as the announcement priority — two fields meaning "which
   comes first" would drift.
4. **The popup's percentage is the live welcome offer's** (`discounts."isWelcome"`),
   read server-side. Subscribing through it issues the same `discount_grants`
   entitlement the account welcome issues, so there is no second discount system.
5. Announcement bar is **not dismissible** and its height is a CSS variable, so
   it cannot cause layout shift and every existing `pt-20` page offset survives.

## Files likely to change

New SQL: `supabase/sql/0035_marketing.sql`.
New TS: `src/types/marketing.ts`, `src/schemas/{marketing.ts,db/marketing.ts}`,
`src/services/{marketing.ts,admin/marketing.ts}`,
`src/actions/{marketing.ts,admin/marketing.ts}`, `src/lib/pricing.ts`,
`src/components/marketing/*`, `src/components/ecommerce/SalePrice.tsx`,
`src/app/[locale]/admin/{announcements,promotions}/**`.
Modified: catalog types/schemas/services, price-rendering components, cart and
checkout arithmetic, `layout.tsx`, `Nav.tsx`, `globals.css`, `AdminShell.tsx`,
`revalidate.ts`, both dictionaries.

## Security requirements

- No price is computed in the browser. `place_order()` prices every line from
  the promotion view inside the order transaction.
- Promotions/announcements are readable by `anon` **only while live**; writes are
  service-role only, behind `requireAdmin()` in every Server Action.
- `SUPABASE_SECRET_KEY` never reaches the client; the popup action is rate limited.

## Acceptance criteria

- `npx tsc --noEmit` clean; `npm run lint` clean.
- Promotional price shows on cards, PDP, sticky bar, cart, drawer, checkout,
  search, and is what `place_order()` charges.
- Announcement bar renders live rows only, in the configured mode, honours
  `prefers-reduced-motion`, and is RTL-correct.
- Popup appears after the configured delay/scroll, once, respects dismissal.
- Admin can create/edit/schedule/activate announcements and promotions.

## Checks to run

`npx tsc --noEmit`, `npm run lint`, `npm run build`.
