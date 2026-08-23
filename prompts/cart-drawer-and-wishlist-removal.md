# Cart Drawer, Card Bag Control & Full Wishlist Removal

## Goal

Three linked changes to the shopping surfaces:

1. **Product card** — replace the wishlist heart overlaid on `<ProductCard>` with an
   **add-to-bag** control (`ShoppingBag`, Lucide, `strokeWidth={1.25}`).
2. **Cart drawer** — clicking the bag in the Nav (and the new card control) opens a
   **slide-in panel from the logical end edge**, limited width on every viewport —
   never full-screen, on phone or desktop. Smooth, no bounce, `duration-500
   ease-luxury-bezier`.
3. **Wishlist deleted** — every route, component, provider, storage key, link,
   stat tile, and dictionary entry. There is **no wishlist table to drop**
   (verified below), so the change is code-only.

## Skills read

None applicable. The task touches no Clerk, Supabase, or AI SDK surface: the cart is
`localStorage`-backed browser state and the new route handler reads the existing
`src/services/products.ts` query layer. Project conventions come from `AGENTS.md`
(§2 design language, §3 tokens, §8 routing matrix, §11 component standards).

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `src/providers/cart-provider.tsx` | `useCart()` — `lines`, `count`, `isHydrated`, `addLine`, `setQuantity`, `removeLine`, `clear`. Module-level persistent store; mutators stable by construction. |
| `src/providers/wishlist-provider.tsx` | To be deleted. Same shape, `WISHLIST_STORAGE_KEY`. |
| `src/components/Nav.tsx` | `CartLink` (`LocaleLink` → `/cart` with a gold count badge), `WishlistIcon`, the desktop wishlist link, the mobile drawer's Boutique list, and the **mobile drawer pattern this drawer must match**: always mounted, `inert` when closed, `translate-x` with an explicit `rtl:` counterpart because transforms are not mirrored by `dir`. |
| `src/components/search/SearchOverlay.tsx` | The house modal-dialog pattern: `end`-anchored slide-in, stays mounted for the exit transition, `inert` when closed, tab trap via the `FOCUSABLE` selector, focus returned to the trigger. |
| `src/components/ecommerce/CartView.tsx` | Id→product resolution against a catalog projection, the `isHydrated` guard that prevents an empty-state flash, `cartSubtotalInCents`, and the single `aria-live` region for the whole bag. |
| `src/components/ecommerce/CartLine.tsx`, `QuantityStepper.tsx` | The row and stepper the drawer reuses in a narrower form. |
| `src/components/ecommerce/CollectionGrid.tsx` | Client filter/sort shell that overlays the heart on server-rendered `<ProductCard>` nodes. `CollectionGridItem = { id, name, priceInCents, facets, card }`. |
| `src/components/ecommerce/CollectionView.tsx:94` | Builds `items` — where `inventory` must be added. |
| `src/components/ecommerce/MerchCard.tsx`, `DiscoverySetCard.tsx`, `ProductPurchase.tsx` | Each already has its own **Add to Bag** button plus a heart. Only the heart is removed; no bag icon is added — they have one. |
| `src/app/[locale]/cart/page.tsx` | `revalidate = 300`, fetches `getProductCardsByCollection(locale)` — the projection the drawer needs too. |
| `src/app/[locale]/layout.tsx:302` | `<WishlistProvider>` wraps `<Nav>`, `children`, `<Footer>`, `<CookieConsent>`. |
| `src/app/api/search/route.ts` | The route-handler precedent for a small cached JSON endpoint. |
| `supabase/sql/*.sql` | **Verified: no `wishlist` or `wishlist_item` table exists.** The only hits are two prose comments in `0001_catalog.sql` and `0011_home_fragrance_slug.sql`. AGENTS.md §9's `Wishlist`/`WishlistItem` models were never migrated. |

## Decisions

Confirmed with the user before writing this prompt:

1. **`/cart` stays.** The drawer is the quick view; it carries **Checkout** (primary,
   → `/checkout`) and **View Bag** (secondary, → `/cart`). Footer link, `robots.ts`
   entry, mobile-nav entry, and `AuthShell`'s guest-cart link are untouched.
2. **The card's bag control adds one unit and opens the drawer.** This is why the
   open state needs a provider rather than `useState` in `Nav`.
3. **Wishlist removal is total**, including the `/account` stat tile — the grid drops
   from three tiles to two.

Assumptions, stated:

4. **The drawer resolves ids through a new cached route handler**, not through the
   layout. Fetching the catalog in `[locale]/layout.tsx` would push the whole
   projection into the RSC payload of *every* page on the site to serve a panel most
   visits never open. The handler is fetched lazily on first open and the response
   held in component state for the session.
5. **AGENTS.md §9 keeps its `Wishlist`/`WishlistItem` models** — this prompt removes
   the *application*, and the handbook's schema section is edited in the same pass to
   stay truthful (see Implementation §6).
6. The drawer is **`end`-anchored**, so it enters from the right in English and from
   the left in Arabic. "Right to left" in the request describes the English tree; a
   panel hard-pinned to `right` would collide with the RTL mobile drawer.

## Files likely to change

**New**

- `src/providers/cart-drawer-provider.tsx`
- `src/components/ecommerce/CartDrawer.tsx`
- `src/components/ecommerce/CartDrawerLine.tsx`
- `src/app/api/cart/catalog/route.ts`

**Deleted**

- `src/app/[locale]/wishlist/` (whole directory)
- `src/components/ecommerce/WishlistView.tsx`
- `src/components/ecommerce/WishlistCard.tsx`
- `src/providers/wishlist-provider.tsx`

**Modified**

- `src/app/[locale]/layout.tsx` — swap `WishlistProvider` for `CartDrawerProvider`, mount `<CartDrawer />`
- `src/components/Nav.tsx` — bag button opens the drawer; wishlist icon and link removed
- `src/components/ecommerce/CollectionGrid.tsx` — heart → bag control
- `src/components/ecommerce/CollectionView.tsx` — pass `inventory`
- `src/components/ecommerce/MerchCard.tsx`, `DiscoverySetCard.tsx`, `ProductPurchase.tsx` — hearts removed
- `src/components/Footer.tsx`, `src/components/auth/AuthShell.tsx`, `src/components/account/AccountSidebar.tsx`, `src/components/account/StatGrid.tsx`
- `src/lib/storage.ts` — drop `WISHLIST_STORAGE_KEY`
- `src/lib/i18n/dictionaries/en.ts`, `ar.ts`
- `src/app/robots.ts`, `src/app/sitemap.ts` (comment), `src/types/account.ts`, `src/types/catalog.ts`, `src/schemas/admin.ts`, `src/services/products.ts`, `src/components/admin/ProductForm.tsx`, `src/components/ecommerce/PageHeader.tsx`, `src/components/ecommerce/EmptyState.tsx`, `src/components/ecommerce/ProductFlag.tsx`, `src/components/ecommerce/CollectionView.tsx`, `src/hooks/use-is-hydrated.ts`, `src/lib/routes.ts`, `src/providers/consent-provider.tsx` — **prose comments only**
- `AGENTS.md` §9 — annotate the unbuilt wishlist models

---

## Implementation requirements

### 1. `cart-drawer-provider.tsx`

```ts
export interface CartDrawerContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}
```

- `"use client"`. `useState<boolean>` + `useCallback`-stable `open`/`close`, memoized value.
- `useCartDrawer()` throws outside the provider, matching `useCart()`.
- **Route changes close it**: `usePathname()` in an effect calling `close()`, so
  "View Bag" or a product link inside the panel does not leave it hanging over the
  new page.
- Nested **inside** `<CartProvider>` in the layout, in the slot `WishlistProvider`
  vacates. It holds UI state only and must not be folded into `cart-provider.tsx`,
  which is persisted domain state.

### 2. `GET /api/cart/catalog`

- `export const revalidate = 300;` — matches `/cart`, both serve live catalog prices.
- Reads `?locale=`, validates with `isLocale()`, falls back to `"en"`. **Never
  interpolate the raw param anywhere.**
- Returns `getProductCardsByCollection(locale)` as `{ catalog: ProductCardData[] }`.
- `try/catch`; on failure return `{ catalog: [] }` with a 500 and log server-side —
  the drawer must degrade to its error copy, never throw into the panel.
- No auth: it serves exactly the public catalog `/collections` already renders.

### 3. `<CartDrawer />` — the panel

Mounted once, in `[locale]/layout.tsx`, as a sibling of `<Nav />`.

**Structure & behaviour**

- Always in the tree; `inert` and `aria-hidden` when closed, so the exit transition
  plays and the panel leaves the tab order — the `SearchOverlay` rule.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the heading,
  `id="cart-drawer"` (the Nav button's `aria-controls`).
- Scrim: `fixed inset-0 z-1000 bg-background/70 backdrop-blur-sm`, opacity-transitioned
  `duration-500`, `pointer-events-none` when closed, click closes.
- Panel: `fixed inset-y-0 end-0 z-1001 flex flex-col`.
- **Width — the explicit requirement.** Never full-bleed:
  `w-[88vw] max-w-100 sm:w-100 lg:w-110`. On the narrowest phone a strip of the page
  behind stays visible, which is what tells the visitor this is a panel over their
  place in the catalog and not a navigation.
- Motion: `transition-transform duration-500 ease-luxury-bezier`,
  `translate-x-0` when open, `translate-x-full rtl:-translate-x-full` when closed —
  the explicit RTL counterpart, exactly as `Nav.tsx` documents.
- Surface: `border-s border-border bg-[color-mix(in_srgb,var(--color-background)_97%,transparent)] backdrop-blur-xl`, matching the mobile drawer.
- `Escape` closes. Tab is trapped inside the panel (reuse the `FOCUSABLE` selector
  from `SearchOverlay`). On open, focus moves to the close button; on close it
  returns to the Nav bag trigger.
- Body scroll is locked while open (`overflow: hidden` on `document.body`), restored
  on close and on unmount.
- Catalog fetch: on the **first** open only, `fetch('/api/cart/catalog?locale=…')`,
  held in state. `AbortController` on unmount. Three states — loading (three skeleton
  rows on `bg-card`, no spinner), error (one quiet line plus a **View Bag** link out),
  loaded.

**Contents**

- Header, `h-20 shrink-0`, `px-7`: `eyebrow` = `dict.cart.eyebrow`, heading in
  `font-heading` = `dict.cart.drawer.heading`, item count beneath in
  `text-[11px] text-ivory/40`; close `X` at the logical end, `size-11` hit area.
- Body, `flex-1 overflow-y-auto px-7`: one `<CartDrawerLine>` per resolved line.
- A line whose id resolves to nothing is **dropped silently** — the `CartView` rule.
  Nothing from `localStorage` is ever rendered as text.
- One `aria-live="polite" className="sr-only"` region for the whole panel, using the
  existing `dict.cart.updated`.
- Footer, `shrink-0 border-t border-border px-7 py-7`: subtotal row (label
  `dict.cart.subtotal`, value via `useFormatPrice()`), `dict.cart.taxNote` beneath,
  then **Checkout** (`btn-luxury btn-luxury-fill w-full justify-center` → `/checkout`)
  and **View Bag** (`btn-luxury w-full justify-center` → `/cart`). Both close the
  drawer on click.
- Hydration guard: while `!isHydrated`, render the header and a held-height body —
  never the empty state, which would flash at every returning visitor.
- Empty state: centred `ShoppingBag` in `text-gold/30`, `dict.cart.empty.heading` /
  `.body`, and `dict.cart.empty.cta` linking to `/collections`. Reuse
  `<EmptyState>` only if it fits a 400px column without modification; otherwise
  inline the block rather than adding props to a page-scale component.

### 4. `<CartDrawerLine />`

A narrower `CartLine`: 72px-wide `aspect-3/4` image, name in `font-heading text-sm`
under `ltrIsland(locale)`, volume/format in `text-[10px] text-ivory/40`, price via
`useFormatPrice()`, `<QuantityStepper>` capped at `product.inventory`, and a text
**Remove** using the existing `dict.cart.removeLabel` / `dict.cart.remove`. Separated
by `border-b border-border`, last row borderless. Do not fork `CartLine`'s two-column
page layout — a 400px panel cannot carry it.

### 5. The card control

**`CollectionGrid.tsx`**

- Drop `useWishlist` and the `Heart` import; add `useCart` and `useCartDrawer`.
- `CollectionGridItem` gains `inventory: number` (documented: caps the quantity the
  control may add, and decides the sold-out state).
- The overlay button keeps its exact geometry — `absolute end-5 top-5 z-2 grid size-9
  place-items-center border border-white/10 bg-background/70 backdrop-blur-sm`, same
  hover/focus transitions — so nothing in the grid shifts. Only the glyph and the
  action change: `<ShoppingBag size={14} strokeWidth={1.25} className="text-ivory/50" />`,
  gold on hover.
- `onClick`: `addLine(item.id, 1, item.inventory)` then `openCart()`. It sits inside a
  `relative` wrapper over a card that is itself a link — call `preventDefault()` and
  `stopPropagation()` so adding never also navigates.
- Sold out (`inventory === 0`): `disabled`, `opacity-40`, `aria-label` =
  `dict.product.soldOut` interpolated with the name.
- `aria-label` otherwise = new key `dict.collections.addToBag` (`"Add {name} to bag"`).
  No `aria-pressed` — this is an action, not a toggle.

**`CollectionView.tsx`** — add `inventory: product.inventory` to the `items` map.
`ProductCardData` already carries it (`src/types/catalog.ts:222`).

**`MerchCard`, `DiscoverySetCard`, `ProductPurchase`** — delete the heart button, the
`Heart` import, the `useWishlist` call, and the `wishlisted` derivation. Each already
has its own Add-to-Bag button; it becomes full-width where the heart shared its row
(`ProductPurchase`: drop the flex row, the button takes the full width). Update the
header comments that describe "cart and wishlist writes". `DiscoverySetCard`'s comment
about the badge and heart sharing the top corners is now wrong — rewrite it.

### 6. Wishlist removal checklist

- Delete `src/app/[locale]/wishlist/`, `WishlistView.tsx`, `WishlistCard.tsx`,
  `src/providers/wishlist-provider.tsx`.
- `src/lib/storage.ts` — remove `WISHLIST_STORAGE_KEY`. **Leave any stored
  `khem.wishlist.v1` blob alone**: writing cleanup code into every visitor's browser
  to reclaim a few hundred bytes is not worth the boot-path risk. Note that in a
  comment where the key used to live.
- `Nav.tsx` — remove `WishlistIcon`, the desktop link, the `Heart` import, and the
  `[dict.nav.wishlist, "/wishlist"]` row in the mobile drawer's Boutique list. That
  list's `Cart` entry becomes a `<button>` that calls `closeDrawer()` then `open()`.
- `Footer.tsx` — remove the wishlist link.
- `AuthShell.tsx` — remove the link **and its `|` separator span**, leaving the guest
  cart link centred alone.
- `AccountSidebar.tsx` — remove the row; delete the header comment calling wishlist
  "the exception".
- `StatGrid.tsx` — remove the tile. The grid becomes `sm:grid-cols-2`. It no longer
  reads any browser state — **make it a Server Component** by dropping `"use client"`
  if `useFormatPrice()` and `useDictionary()` permit; if either is client-only, keep
  the directive and say why in a comment.
- `src/app/robots.ts` — remove `/wishlist` and `/ar/wishlist`.
- Dictionaries (`en.ts`, `ar.ts`) — remove `nav.wishlist`, `footer.links.wishlist`,
  `collections.wishlistAdd/Remove`, `product.wishlistAdd/Remove`, the whole `wishlist`
  block, `auth.guestWishlist`, `account.nav.wishlist`, `account.stats.wishlist`,
  `account.wishlistPanel` (already dead — nothing reads it), and any now-orphaned
  `stats.saved`. Add `collections.addToBag` and `cart.drawer.{ heading, close, viewBag }`.
  **Both trees must stay structurally identical** — the dictionary type is derived
  from `en.ts`, so a key left in `ar.ts` is a type error and a key missing from it is
  an untranslated string.
- Prose comments across `sitemap.ts`, `types/account.ts`, `types/catalog.ts`,
  `schemas/admin.ts`, `services/products.ts`, `lib/routes.ts`, `lib/storage.ts`,
  `hooks/use-is-hydrated.ts`, `providers/consent-provider.tsx`,
  `admin/ProductForm.tsx`, `ecommerce/PageHeader.tsx`, `EmptyState.tsx`,
  `ProductFlag.tsx`, `CollectionView.tsx` — rewrite each so it describes what the code
  now does. `PageHeader` and `EmptyState` are no longer "shared by `/cart` and
  `/wishlist`"; they are `/cart`'s and the drawer's.
- `supabase/sql/0001_catalog.sql` and `0011_home_fragrance_slug.sql` — the two prose
  mentions become "the cart persists…". **Do not edit applied migration SQL
  statements**; comment text only, and only because these files are already applied
  and idempotent-by-inspection.
- `AGENTS.md` §9 — mark `Wishlist` and `WishlistItem` as removed from the product
  rather than deleting them silently, so the next agent does not rebuild them.
- **No database migration.** There is no wishlist table; `supabase/sql/` gains no
  file. State this explicitly when reporting completion.

## Security requirements

- The new route handler validates `locale` through `isLocale()` and passes it to the
  existing parameterised query layer. No string interpolation into SQL, ever.
- The endpoint exposes only the public catalog projection — no inventory-sensitive,
  cost, or user data beyond what `/collections` already renders server-side.
- The persisted cart remains ids and quantities only, validated by the existing
  `isStoredCart` guard. Nothing read from `localStorage` is rendered as text; every
  displayed field comes from the server projection.
- Quantity writes stay capped by `quantityCeiling(product.inventory)` — the card
  control must pass `inventory`, never an unbounded value.
- Zero `any`. `fetch` responses are narrowed by a type guard before use, not cast.

## Acceptance criteria

- [ ] No occurrence of `wishlist` / `Wishlist` remains in `src/` except the deliberate
      historical notes in `lib/storage.ts` and `AGENTS.md`. `/wishlist` 404s in both
      locales.
- [ ] Every product card in `/collections` shows a bag control; clicking it adds one
      unit, opens the drawer, and does **not** navigate to the product.
- [ ] The Nav bag opens the drawer instead of navigating to `/cart`; the count badge
      still works and still appears only after hydration.
- [ ] The drawer is never full-width: a strip of the page behind it is visible at
      375px, 768px, and 1440px.
- [ ] It enters from the right in `/collections` and from the left in
      `/ar/collections`, both `duration-500 ease-luxury-bezier`, no bounce.
- [ ] `Escape` closes it, focus returns to the bag button, Tab stays inside while
      open, and the page behind does not scroll.
- [ ] Quantity, remove, subtotal, Checkout, and View Bag all work from inside the
      drawer, and quantity is still capped by `inventory`.
- [ ] `/cart` and `/checkout` are unchanged in behaviour.
- [ ] `/account` shows two stat tiles, correctly laid out.
- [ ] `en.ts` and `ar.ts` are structurally identical; no untranslated key is rendered.
- [ ] `next build` prerenders the same routes as before, minus `/wishlist` — the
      catalog fetch must not have made any page dynamic.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
grep -ril "wishlist" src/          # expect: storage.ts only
```

## Manual test steps

1. `npm run dev`, open `/collections`.
2. Hover a product card — a gold-bordered bag button in the top-end corner, no heart.
   Click it: the drawer slides in from the right, the item is listed, the Nav badge
   reads 1, and the URL has not changed.
3. Step the quantity up past the product's stock — it stops at `inventory`. Remove the
   line — the empty state appears with the Explore Collections CTA.
4. Resize to 375px with the drawer open: it occupies ~88% of the width, with the page
   visible behind it. Repeat at 768px and 1440px — it caps at ~440px.
5. Press `Escape` — it closes, and focus is back on the Nav bag button (Tab once to
   confirm). Verify the page did not scroll while it was open.
6. Reopen it and Tab through — focus cycles inside the panel and never reaches the
   page behind.
7. Add two different products, click **View Bag** — `/cart` shows both, and the drawer
   is closed. Click **Checkout** from the drawer — `/checkout` loads with the same lines.
8. Visit `/ar/collections`, add an item — the drawer enters from the **left**, all
   copy is Arabic, and the layout mirrors cleanly.
9. Visit `/wishlist` and `/ar/wishlist` — both 404.
10. Check the Nav (desktop and the mobile drawer), the Footer, `/account`, and
    `/sign-in` — no wishlist link anywhere; `/account` shows two stat tiles.
11. Reload with items in the bag — the count badge and the drawer's lines survive,
    and no empty state flashes on the way.
