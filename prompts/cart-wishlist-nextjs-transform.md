# Prompt — Transform `cart` and `wishlist` into localized App Router pages

## Goal

Rewrite `src/app/[locale]/cart/page.tsx` and `src/app/[locale]/wishlist/page.tsx` — two `react-router-dom` SPA components pasted into the App Router tree — as production routes, matching the idiom established by `src/app/[locale]/perfume/[slug]/page.tsx`.

Both files currently **break the build**: they import `react-router-dom` (not a dependency) and `../context/CartContext` (does not exist). Neither route renders today.

Four things ship together:

1. **The transform** — theme tokens instead of raw hexes, `--font-heading` instead of inline `'Cinzel', serif`, `next/image`, `<LocaleLink>`, `<Reveal>`, responsive layout, real metadata.
2. **Lucide everywhere** — every hand-rolled `<svg>` and every Unicode glyph used as an icon (`✕`, `✓`, `−`, `+`, the bullet dots) becomes a Lucide React component. See §Iconography.
3. **Real cart & wishlist state** — a persisted client store, wired to the existing `ProductPurchase` buttons, which today set local state and drop it on the floor. Without this the two pages can only ever render their empty states.
4. **Full EN/AR support** — dictionary-driven chrome, RTL-correct, LTR islands around English catalog records.

**Data rule for this task:** neither page may hold a hardcoded product. The current wishlist page ships a `WISHLIST_ITEMS` array with its own names, prices, and Unsplash URLs — three fragrances at prices that do not match `src/data/products.ts`. Every field rendered by either page comes from `src/services/products.ts`. The store persists **identity only** (`productId`, `quantity`); names, prices, images, and volumes are resolved server-side from the catalog on every render. A price change in the data layer must move the cart total with no cache to bust and nothing to re-sync.

**Composition rule:** many small components, none doing two jobs. No file in this change exceeds ~150 lines. Each page is a composition root that delegates.

---

## Skills read

- `AGENTS.md` — §1 core rules, §2.2 visual language, §3 tokens, §5 prompt contract, §6 stack (Lucide, `strokeWidth={1.25}`), §7 structure, §8 routing matrix, §9 schema, §11 component standards, §12 checklist.
- No `.agents/skills/*` skill applies: these routes have no Clerk auth (Clerk is not installed), no Supabase call, no AI SDK usage. Session hooks suggested `ai-sdk`, `ai-gateway`, `nextjs`, `next-cache-components`, and `react-best-practices` on lexical/path matches — none is relevant to a client-state cart page, and none is invoked.
- Next.js patterns verified against the installed `next@16.2.12` and the existing routes, not from memory.

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/app/[locale]/cart/page.tsx` | Untransformed SPA source. `useCart()` from a missing context; inline hex styles; `<Link to>`; hand-rolled cart `<svg>`; `−`/`+` text buttons; bullet-dot `<span>`s; promo-code field; `1fr 400px` desktop-only grid. |
| `src/app/[locale]/wishlist/page.tsx` | Untransformed SPA source. Hardcoded `WISHLIST_ITEMS`; `useState` list; hand-rolled heart `<svg>`; `✕` remove button; `✓ Added to Cart` text; fixed `repeat(3, 1fr)` grid; "50ML / 100ML" label contradicting the one-volume-per-product rule. |
| `src/app/[locale]/perfume/[slug]/page.tsx` | The reference transform: `revalidate`, `generateStaticParams` over `LOCALES`, `generateMetadata` via `localeMetadata`, `isLocale` narrowing, `Promise.all` for services, `ltrIsland`, delegation to section components. |
| `src/components/ecommerce/ProductPurchase.tsx` | Client. Holds `quantity`, `wishlisted`, `justAdded` in local state with two `TODO` comments where the real writes belong. Uses Lucide `Heart` correctly — but still prints a literal `✓` before `dict.product.added`. Its markup otherwise stays; the handlers change. |
| `src/components/ecommerce/QuantityStepper.tsx` | Existing client stepper — `value`, `min`, `max`, `onChange`, `decreaseLabel`, `increaseLabel`. **Already Lucide** (`Minus`/`Plus`, `size={14}`, `strokeWidth={1.25}`, `aria-hidden`), already `aria-live` on the value. Reused verbatim by the cart line; do not fork it. |
| `src/components/ecommerce/ProductCard.tsx` | Async Server Component over `ProductCardData`; links `/perfume/${slug}`; `img-zoom` hover; `ltrIsland` around English fields. The wishlist card is its sibling, not its replacement. |
| `src/services/products.ts` | `getProductCardsByCollection()` with no argument already returns the whole catalog as `ProductCardData`. Every function carries the Supabase query it will become. |
| `src/types/catalog.ts` | `ProductCardData` is a deliberate narrow `Pick` of `Product` + `collectionName` + `primaryImage`. |
| `src/lib/format.ts` | `formatPrice` (cents → `$295`), `formatVolume` (`100 ML`). Money never formatted anywhere else. |
| `src/lib/i18n/rtl.ts`, `config.ts`, `metadata.ts`, `get-dictionary.ts` | `ltrIsland`, `readingArrow`, `LOCALES`/`isLocale`, `localeMetadata`, `getDictionary`. |
| `src/providers/i18n-provider.tsx` | The shape a client provider follows here: `"use client"`, `useMemo` value, context `null` default, hook that throws outside the provider. Mounted once in the `[locale]` layout. |
| `src/app/[locale]/layout.tsx` | Wraps `<Nav /> {children} <Footer />` in `<I18nProvider>`. The new providers mount here. |
| `src/components/Nav.tsx` | Lucide `Heart`, `Search`, `UserRound`, `X` behind thin local icon wrappers; has a `/wishlist` link. **No cart link exists anywhere in the site chrome.** |
| `src/lib/i18n/dictionaries/en.ts` | Defines the `Dictionary` type; `ar.ts` is checked against it, so a new key is a compile error until translated. Existing `product.*` keys cover add-to-cart, sold-out, and wishlist labels. |
| `next.config.ts` | `images.unsplash.com` and `res.cloudinary.com` are the only allowed remote hosts. |

---

## Decisions & assumptions

1. **State lives in a client store persisted to `localStorage`, keyed by product id.**
   There is no `Cart` table in AGENTS.md §9 and no Clerk session. The store holds `{ productId, quantity }[]` for the cart and `productId[]` for the wishlist — exactly the columns `OrderItem` and `WishlistItem` will hold. When Clerk and Supabase land, each mutation becomes a Server Action call and the components are unchanged.

2. **The server sends the catalog; the client intersects it with the stored ids.**
   `localStorage` is unreadable during SSR, so the page cannot fetch "the products in your cart". Instead each page calls `getProductCardsByCollection()` (whole catalog, a dozen records) and hands the projection to the client island, which resolves its stored ids against it. Consequences, all wanted: prices and names are always live, a removed product silently drops out of the cart instead of rendering a ghost line, and no product data is ever written to `localStorage`.

3. **`ProductCardData` gains `inventory` and `concentration`.**
   The cart needs `inventory` to cap the stepper and `concentration` to print "Eau de Parfum · 100 ML". Both are existing `Product` columns; adding them to the `Pick` and to `toCardData` keeps the projection honest and keeps the documented `.select(...)` column lists accurate.

4. **Both routes are static shells with client islands, not `force-dynamic`.**
   AGENTS.md §8 lists `/cart` and `/wishlist` as Force Dynamic / Protected. That classification assumes a server-held cart and a Clerk session; today the shell contains no per-visitor data at all, so a dynamic render would buy nothing and cost a function invocation per view. Both get `generateStaticParams` over `LOCALES` and `revalidate = 300` (matching the PDP, since they render live catalog prices). **When Clerk lands, `/wishlist` becomes protected and both revert to the matrix.** A comment in each page records this.

5. **No promo-code field.** The current design ships one. There is no `Discount` model and no endpoint — a field that silently does nothing is worse than its absence (AGENTS.md §1.4). It returns with the discount schema.

6. **Checkout CTA is disabled, not a dead link.** `/checkout` does not exist; linking to it sends the primary conversion CTA to the 404 page. The button renders disabled with a short "opening soon" line beneath it. *Tell me if you would rather it link to `/checkout` and 404 for now.*

7. **`ProductPurchase` is wired in the same change.** Out of the literal two-file scope, but a cart page that nothing can add to is not a delivered feature. Its markup and props are untouched apart from the `✓` fix; the two `TODO` handlers become store calls, and `wishlisted` becomes derived state rather than local state.

8. **A cart entry point is added to `Nav`.** There is currently no way to reach `/cart` from the site chrome. A Lucide `ShoppingBag` with a live item-count badge joins the wishlist and account icons, mirroring their existing wrapper markup exactly.

9. **Shipping stays at the numbers already published on the site.** `product.trust.delivery.desc` reads "On all orders over $200", so: free at or above `20000` cents, otherwise `2500`. Both live in one `src/lib/cart.ts` constant block, in cents, alongside the totals math.

10. **Catalog records stay English in both trees**, per the dictionary's stated scope — every product name, subtitle, and note is wrapped in `ltrIsland(locale)`.

11. **The old "50ML / 100ML" wishlist label is dropped.** Bottle format is a property of the collection (`src/data/products.ts`); a product has one volume. The card prints `formatVolume(product.volumeMl)`.

---

## Files likely to change

**New — state**
- `src/lib/cart.ts` — `SHIPPING_*` constants, `cartSubtotalInCents`, `shippingInCents`, `cartTotalInCents`, `amountToFreeShipping`. Pure, no React, reusable by the future checkout Server Action.
- `src/lib/storage.ts` — tiny typed `localStorage` read/write helpers with versioned keys (`khem.cart.v1`, `khem.wishlist.v1`), `try/catch` around every access (Safari private mode throws), and a `storage`-event subscribe helper for cross-tab sync.
- `src/providers/cart-provider.tsx` — `CartProvider` + `useCart()`: `lines`, `count`, `addLine(productId, quantity)`, `setQuantity`, `removeLine`, `isHydrated`.
- `src/providers/wishlist-provider.tsx` — `WishlistProvider` + `useWishlist()`: `ids`, `has(id)`, `toggle(id)`, `remove(id)`, `isHydrated`.

**New — components**
- `src/components/ecommerce/CartView.tsx` — client island; resolves lines against the catalog, renders lines + summary or the empty state.
- `src/components/ecommerce/CartLine.tsx` — one line: image, name, format, line total, `QuantityStepper`, remove.
- `src/components/ecommerce/CartSummary.tsx` — subtotal, shipping, free-shipping nudge, total, CTAs, trust list.
- `src/components/ecommerce/WishlistView.tsx` — client island; grid or empty state.
- `src/components/ecommerce/WishlistCard.tsx` — card with remove affordance and an add-to-cart button.
- `src/components/ecommerce/EmptyState.tsx` — shared Lucide icon + heading + body + CTA block, used by both pages.
- `src/components/ecommerce/PageHeader.tsx` — the eyebrow + `h1` + meta-line bar both pages open on (only if no equivalent already exists; check `collections/page.tsx` first and reuse rather than duplicate).

**Rewritten**
- `src/app/[locale]/cart/page.tsx`
- `src/app/[locale]/wishlist/page.tsx`

**Edited**
- `src/types/catalog.ts` — `ProductCardData` gains `inventory`, `concentration`.
- `src/services/products.ts` — `toCardData` carries the two new fields; update the documented `.select(...)` column lists to match.
- `src/app/[locale]/layout.tsx` — mount `<CartProvider>` and `<WishlistProvider>` inside `<I18nProvider>`.
- `src/components/ecommerce/ProductPurchase.tsx` — handlers call the stores; `✓` → Lucide `Check`.
- `src/components/Nav.tsx` — `ShoppingBag` icon + count badge.
- `src/lib/i18n/dictionaries/en.ts` and `ar.ts` — new `cart` and `wishlist` sections; `nav.cart`; `nav.cartCount`.

---

## Iconography — Lucide only

**Rule:** after this change, no file touched here contains a hand-written `<svg>`, a `<path>`, or a Unicode/emoji glyph standing in for an icon. Every icon is a Lucide React component at `strokeWidth={1.25}` with `aria-hidden="true"`, sized in `px` via `size={…}`, colored by a token class — matching `ProductPurchase` and `QuantityStepper`. Decorative shapes that are genuinely shapes (a 4px dot, a hairline rule) stay CSS, not icons.

| Current | Where | Becomes |
| :--- | :--- | :--- |
| Inline `<svg>` shopping-cart path | cart empty state | `<ShoppingBag size={64} strokeWidth={0.8} />`, `text-gold/30` |
| Inline `<svg>` heart path | wishlist empty state | `<Heart size={64} strokeWidth={0.8} />`, `text-gold/30` |
| `✕` text button | wishlist card remove | `<X size={14} />` |
| `✓ Added to Cart` | wishlist card + `ProductPurchase` | `<Check size={14} />` beside the label, as a flex row |
| `−` / `+` text buttons | cart quantity | Delete — use `<QuantityStepper>`, which is already `Minus`/`Plus` |
| Bullet `<span>` dots | cart trust list | `<Check size={12} />` in `text-gold` — the list states guarantees, so a check reads truer than a dot |
| — | cart summary "free shipping" state | `<Truck size={12} />` beside the Complimentary label |
| — | Nav cart entry | `<ShoppingBag width={17} height={17} />`, matching the sizing of the existing Nav icon wrappers |

Import Lucide components individually (`import { ShoppingBag, X } from "lucide-react"`) — never the barrel default. Icons that appear inside a button whose only content is the icon require an `aria-label` on the button; icons beside text are always `aria-hidden`.

The `readingArrow()` helper in `src/lib/i18n/rtl.ts` stays a text glyph and is not in scope — it is typographic ornament inside a text link, not an icon. Do not introduce it on these pages.

---

## Implementation requirements

### State layer

- Providers are `"use client"`, follow the `i18n-provider.tsx` shape exactly (context defaults to `null`, hook throws with a named message outside the provider, value memoized).
- **Hydration:** the first client render must match the server HTML, so state initializes empty and `localStorage` is read in a `useEffect`. Until `isHydrated` is true, consumers render a neutral placeholder — never the empty state (which would flash "Your Cart is Empty" for every returning visitor) and never a count badge.
- Every write goes through one reducer-style updater so persistence happens in exactly one place.
- Quantity is clamped to `1..min(inventory, 10)` on write, matching `MAX_PER_ORDER` in `ProductPurchase`. Setting quantity to 0 removes the line.
- Adding a product already in the cart increments, it does not duplicate.
- Stored values are untrusted input — `localStorage` is user-writable. Parse defensively: reject anything that is not an array, drop entries whose `productId` is not a string or whose `quantity` is not a positive integer, and cap the list length. A malformed blob resets to empty rather than throwing.
- Cross-tab: subscribe to `storage` so two open tabs agree.

### Pages

- Server Components. `isLocale` narrowing, `generateStaticParams` over `LOCALES`, `generateMetadata` via `localeMetadata`, `revalidate = 300`, `Promise.all` for `getDictionary` + catalog.
- `pt-20` to clear the fixed Nav (both open on a bar, not a hero).
- Metadata: `robots: { index: false, follow: true }` on both — a cart and a wishlist are session surfaces with no indexable content.
- Each page passes `locale`, `dict` slice, and the catalog projection to its island. Islands receive plain serializable props only.

### Visual interpretation

Preserve the existing design's structure and restraint; the transform is a re-expression in tokens, not a redesign.

- **Colors:** `bg-background`, `bg-surface`, `bg-card`, `text-ivory`, `text-gold`, `border-border`. Zero raw hex. The summary panel's `#111` becomes `bg-surface`.
- **Type:** `font-heading` for headings, prices, quantities, and CTA text; `font-body` elsewhere. Page `h1` at `text-3xl sm:text-4xl lg:text-5xl`, `font-normal`.
- **Eyebrow:** the existing `.eyebrow` utility, unchanged.
- **Divider:** `gold-line` where the current design uses a `1px` gold rule.
- **Buttons:** `btn-luxury btn-luxury-fill` for primary, the bordered ghost treatment for secondary. Icon buttons are `size-9`/`size-13` grids with `border-white/12` → `border-gold` on hover and `focus-visible`, matching the wishlist button in `ProductPurchase`.
- **Images:** `next/image` with `fill`, `object-cover brightness-75`, correct `sizes` per breakpoint, inside an `aspect-3/4` wrapper. Wishlist cards reuse the `img-zoom` hover from `ProductCard`.
- **Motion:** `<Reveal>` on section entrances only. No layout animation on quantity change — a cart that reflows while you click `+` reads as cheap. Hover/focus transitions are `duration-300 ease-out` via CSS, never Motion.

### Layout & responsiveness

- **Cart:** single column below `lg`, summary stacked beneath the lines. At `lg` and up, `grid-cols-[1fr_380px]` with the summary `sticky top-20`, borders on the inner edge. Padding scales `px-6 sm:px-8 lg:px-14 xl:px-20`, `py-12 lg:py-16`.
- **Cart line:** `grid-cols-[88px_1fr]` on mobile, `grid-cols-[120px_1fr]` from `sm`. Name and line total on one row with the total aligned to the inline end; stepper and remove on the row beneath, wrapping rather than overflowing at 320px.
- **Wishlist:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, `gap-px` on a `bg-border` surface so the hairline seams survive the wrap (the current fixed 3-column grid overflows on mobile).
- **Empty states:** centered, `min-h-[60vh]`, Lucide icon per §Iconography.
- Verified at 320, 375, 768, 1024, 1440, 1920.

### RTL / i18n

- Every visible string comes from the dictionary. No literal in JSX.
- Logical properties throughout — `ps-*`/`pe-*`, `ms-*`/`me-*`, `text-start`/`text-end`, `border-s`/`border-e`. No `left`/`right`, no `ml-`/`mr-`.
- The stepper's `Minus`/`Plus` keep their visual order in both directions (`flex-row` is already direction-aware; do not add `flex-row-reverse`).
- Icons that encode direction are mirrored or swapped by locale, never CSS-flipped mid-glyph. None of the icons listed above is directional, so nothing needs it in this pass — do not introduce one that does.
- Prices stay `en-US`-formatted via `formatPrice` in both locales, wrapped so the `$` sits correctly in RTL.
- Product names, subtitles, notes: `{...ltrIsland(locale)}`.
- Arabic keys are real translations, not English echoes.

### Accessibility

- Remove buttons carry `aria-label` interpolated with the product name, not a bare "Remove".
- Cart count badge is `aria-hidden`; the link's `aria-label` carries the interpolated count.
- Quantity and total changes announce via one `aria-live="polite"` region per page, not per line.
- Wishlist toggle in `ProductPurchase` keeps `aria-pressed`.
- All interactive elements reach `focus-visible:border-gold focus-visible:outline-none`; nothing relies on hover alone.

### TypeScript

- Zero `any`. Store shapes are explicit exported interfaces. `useCart`/`useWishlist` return types are named.
- No Zod schema is introduced: nothing here crosses a network boundary. The `localStorage` parse is a hand-written type guard in `storage.ts` — the one place untrusted input enters — documented as the point where a Zod schema goes when validation lands elsewhere in the app.

---

## Security requirements

- `localStorage` contents are attacker-controllable in the visitor's own browser. Validate on read (see above), never `JSON.parse` straight into state, and never render a stored string as a name, URL, or price — stored ids are only ever *looked up* in the server-supplied catalog, and an id with no match is dropped.
- No product id is ever interpolated into an image `src` or an `href` without first resolving to a real catalog record.
- Neither page exposes a service function to the client bundle; islands receive data as props. `src/services/*` stays out of every `"use client"` module's import graph.
- No PII is written to storage — ids and quantities only.
- Both routes are `noindex`.

---

## Acceptance criteria

1. `npx tsc --noEmit` and `npm run lint` pass clean; `npm run build` succeeds.
2. Neither page imports `react-router-dom`; the phrase does not appear in either file.
3. Neither page contains a raw hex color, an inline `style` object, or a hardcoded product record.
4. No file touched in this change contains a `<svg>` or `<path>` tag, or a `✕`/`✓`/`−`/`+`/`•` glyph used as an icon. Every icon is Lucide.
5. `WISHLIST_ITEMS` is gone; every rendered product field traces to `src/services/products.ts`.
6. Add-to-cart on a PDP moves the Nav badge and appears on `/cart` with the correct name, image, price, and volume.
7. The wishlist heart on a PDP is reflected on `/wishlist`, and revisiting the PDP shows the heart already filled.
8. Both pages survive a reload with their contents intact, and a second tab agrees.
9. Empty states appear only when genuinely empty — no flash of "empty" on reload with items present.
10. Quantity cannot exceed `min(inventory, 10)` or drop below 1; stepping to 0 removes the line.
11. Subtotal, shipping, and total are correct at $0, below $200, exactly $200, and above; the free-shipping nudge shows the right remaining amount.
12. `/ar/cart` and `/ar/wishlist` are fully Arabic, mirror correctly, and show no clipped or reversed punctuation; product names read left-to-right within the RTL page.
13. No hydration warning in the console on either route, either locale.
14. Lighthouse ≥ 95 Performance / 100 Accessibility / 100 SEO on both routes.
15. No file added or rewritten in this change exceeds ~150 lines.

---

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build

# icon audit — all three must return nothing across the touched files
rg '<svg|<path' src/app/\[locale\]/cart src/app/\[locale\]/wishlist src/components/ecommerce
rg '✕|✓|•' src/app/\[locale\]/cart src/app/\[locale\]/wishlist src/components/ecommerce
rg 'react-router-dom' src/
```

---

## Manual test steps

1. `npm run dev`.
2. Visit `/perfume/kyphi-noir`. Set quantity to 2, click **Add to Cart** — the confirmation shows a Lucide check, not a text glyph. The Nav bag badge reads `2`.
3. Click the heart. It fills.
4. Go to `/cart`. One line: Kyphi Noir, its real catalog price × 2, its real volume, its primary image. Subtotal correct, shipping **Complimentary** with the truck icon, total = subtotal.
5. Step the quantity down to 1. Line total, subtotal, and badge all update. The free-shipping nudge appears if the subtotal drops below $200, naming the exact remaining amount.
6. Step down again from 1 — the line is removed and the empty state appears with its `ShoppingBag` icon and CTA to `/collections`.
7. Add two different fragrances, one from `/collections` via a PDP. Reload — both survive, no flash of the empty state.
8. Open a second tab on `/cart`, remove a line in the first, confirm the second follows.
9. Go to `/wishlist`. The hearted fragrance is there. **Add to Cart** from the card confirms inline and increments the badge. The `X` button removes it; emptying the list shows the `Heart` empty state.
10. Repeat 2–9 under `/ar/…`. Confirm the layout mirrors, all chrome is Arabic, product names stay left-to-right, prices render correctly, and no icon points the wrong way.
11. Narrow to 320px on both routes: nothing overflows horizontally, the cart line wraps rather than clips, the wishlist is one column.
12. Tab through both pages: every control takes a visible gold focus ring, in a sensible order. Every icon-only button announces a real label in the accessibility inspector.
13. In DevTools, set `localStorage['khem.cart.v1'] = '{"junk":true}'` and reload `/cart`. The page renders the empty state — no crash, no error boundary.
14. `npm run build && npm start`, then re-check `/cart` and `/ar/wishlist` in production mode for hydration warnings.
