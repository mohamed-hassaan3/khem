# Prompt — Transform `/bodyCare`, `/room-fragrance`, `/discovery-set` into localized Next.js App Router routes

## Goal

Rewrite the three untracked `react-router-dom` SPA pages —
`src/app/[locale]/bodyCare/page.tsx`, `src/app/[locale]/room-fragrance/page.tsx`,
`src/app/[locale]/discovery-set/page.tsx` — as production-grade Next.js 16 **Server
Components**, matching the idiom already established by `src/app/[locale]/collections/page.tsx`
and `src/components/ecommerce/CollectionView.tsx`.

Four things ship together, because they are one change:

1. **The transform** — theme tokens instead of raw hexes, `--font-heading` instead of inline
   `'Cinzel', serif`, `next/image`, `<LocaleLink>`, `<Reveal>`, responsive layout, real
   metadata, ISR.
2. **A real data layer** — the three categories become **Collection records in the one
   catalog**, so the cart, the wishlist, and the totals work with no per-page special casing.
   Each category ships with the products the SPA listed (body care: 1, room fragrance: 1,
   discovery: 3) and **every surface is written to iterate**, so a second body-care product is
   a data edit and nothing else.
3. **Full EN/AR support** — dictionary-driven chrome, RTL-correct, LTR islands around the
   English catalog records.
4. **Zero hand-drawn glyphs** — every `✦ ◆ ◇ ✓ — ·` decoration and every bullet becomes a
   `lucide-react` icon at `strokeWidth={1.25}`.

---

## Skills read

- `AGENTS.md` — §1 core rules, §2.2 visual language, §3 tokens, §6 stack, §7 structure,
  §8 routing matrix, §9 schema, §12 checklist.
- No `.agents/skills/*` skill applies: these routes have no Clerk auth, no Supabase call, no
  AI SDK usage. The session hooks suggested `ai-sdk`, `vercel-services`, `vercel-storage`,
  `next-cache-components` and `react-best-practices` on lexical/path matches — none is
  relevant to three catalog pages, and none is invoked.
- Next.js patterns verified against the installed `next@16.2.12` and the existing routes, not
  from memory.

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/app/[locale]/bodyCare/page.tsx` | 104 lines, untracked. Imports `react-router-dom` (**not installed**) and `../context/CartContext` (**does not exist**) — the route cannot build. `useEffect`/`useRef`/`useState` with no `'use client'`. All styling inline with raw hexes. Raw `<img>`. Hand-rolled `IntersectionObserver`. Unused `Link` import. `✦ ◆ ◇` and `✓` as text. |
| `src/app/[locale]/room-fragrance/page.tsx` | 98 lines, same defects, plus a dead category nav (six hardcoded English buttons that filter nothing) and `{'burn' in p && …}` / `(p as any).duration` reads of fields no product has — an `any` cast and a lint error. |
| `src/app/[locale]/discovery-set/page.tsx` | 204 lines, same defects. Three sets, an `includes` list per set, a 3-step "how it works" band, and a comparison table whose rows are **hardcoded to exactly three columns** (`row.initiation`, `row.noir`, `row.complete`) — a fourth set would silently not render. |
| `src/components/ecommerce/CollectionView.tsx` | The reference composition: hero with `next/image fill priority`, breadcrumb with a mirrored lucide `ChevronRight`, server-rendered cards handed to a client grid as nodes. |
| `src/components/ecommerce/CollectionGrid.tsx` | Precedent for **client-side** filtering/sorting: a `?filter=` search param would opt the route out of ISR. |
| `src/components/ecommerce/ProductCard.tsx` | Async Server Component over `ProductCardData`. Hardcodes `href={`/perfume/${slug}`}` and prints `formatVolume(volumeMl)` plus one note per tier. |
| `src/components/ecommerce/CartView.tsx` | Resolves persisted ids against **the whole catalog projection** the server page fetched (`getProductCardsByCollection()` with no argument). An id with no match is silently dropped — which is exactly why the new goods must live in that same catalog. |
| `src/components/ecommerce/CartLine.tsx`, `WishlistCard.tsx` | Both hardcode `/perfume/${product.slug}` — they would link a room spray to a 404. |
| `src/providers/cart-provider.tsx` | `addLine(productId, quantity?, maxQuantity?)`. Stores **id + quantity only**; never a name, price, or image. |
| `src/providers/wishlist-provider.tsx` | `has(id)`, `toggle(id)`, `isHydrated`. Same identity-only contract. |
| `src/lib/cart.ts` | `quantityCeiling(inventory)`, `MAX_QUANTITY_PER_LINE = 10`. |
| `src/services/products.ts` | Query seam. `getCollections`, `getCollectionBySlug`, `getProductCardsByCollection`, `getFeaturedProducts`, `getProductBySlug`, `getProductSlugs`, `getRelatedProductCards`. Each carries the Supabase query it will become. |
| `src/data/products.ts` | 3 collections, 11 products. Documents "bottle format is a property of the collection" and the load-bearing note ordering. |
| `src/types/catalog.ts` | `Collection`, `Product`, `ProductCardData` mirror AGENTS.md §9. |
| `src/constants/navigation-pages.ts` | Already links `discovery → /discovery`, `bodyCare → /body-care`, `roomFragrance → /room-fragrance`. **None of those three URLs exists today** — all three mega-menu entries 404. |
| `src/lib/i18n/dictionaries/en.ts` | 657 lines. `nav.collectionItems` already has `discovery`, `bodyCare`, `roomFragrance` labels. `product.concentrations` is `satisfies Record<Concentration, string>`. |
| `src/lib/format.ts` | `formatPrice` (cents → `$295`), `formatVolume` (`100 ML`). |
| `src/components/animation/Reveal.tsx` | `<Reveal as delay className>`, tween on `[0.16, 1, 0.3, 1]`, reduced-motion aware. |
| `src/app/globals.css` | `@theme` tokens plus `.eyebrow`, `.gold-line`, `.btn-luxury`, `.btn-luxury-fill`, `.img-zoom`, and the RTL tracking reset scoped to skip `[dir="ltr"]` islands. |
| `next.config.ts` | `images.remotePatterns` already allows `images.unsplash.com` — no config change. |
| `package.json` | `next 16.2.12`, `react 19.2.4`, `motion 13`, `lucide-react ^1.30.0`. No `react-router-dom`. |

### Defects in the current three files

1. `react-router-dom` and `../context/CartContext` imports — neither exists; all three routes fail to build.
2. Hooks without `'use client'` — invalid in a Server Component.
3. Catalog data hardcoded in the page, bypassing `src/services/products.ts` and contradicting AGENTS.md §6 ("UI must display stored data only").
4. Raw `<img>` everywhere — no optimization, no `sizes`, no LCP `priority`, plus `@next/next/no-img-element`.
5. Inline hexes instead of theme tokens; `fontFamily: "'Cinzel', serif"` bypasses `--font-heading`, so the Arabic tree would render Cinzel, which has no Arabic glyphs.
6. Not responsive — `padding: '0 80px'`, `repeat(3, 1fr)`, no breakpoints. One product in a 3-column grid also leaves two dead columns.
7. Hand-rolled `IntersectionObserver` duplicating `<Reveal>`, never unobserving individual targets.
8. `onMouseEnter`/`onMouseLeave` style mutation where CSS `:hover` (and `.img-zoom`) suffices.
9. Hardcoded English throughout; `·` separators and `✓`/`—` glyphs that misplace in RTL.
10. `(p as any).duration` in room-fragrance — an `any` cast on a field no product carries (AGENTS.md §12: zero `any`).
11. Room-fragrance's category bar is decorative only: six buttons, no state, no filtering.
12. Discovery's comparison table is structurally locked to three sets.
13. `setTimeout` confirmations with no cleanup — a fast double click or an unmount leaves the button stuck.
14. No `metadata`, no canonical, no `hreflang`, no `revalidate`.
15. Unused `Link` import in two files.

---

## Decisions and assumptions

1. **Routes follow the Nav, not the folder names.** `/body-care`, `/room-fragrance`,
   `/discovery` — because `src/constants/navigation-pages.ts` already links there and those
   three mega-menu entries currently 404. `src/app/[locale]/bodyCare/` and
   `src/app/[locale]/discovery-set/` are **deleted**; `room-fragrance/` is rewritten in place.
   *Flagged:* AGENTS.md §8 names the route `/discovery-set`. The live links win; update §8
   separately if you disagree.
2. **One catalog, three new collections.** `Collection` gains a `kind` discriminator
   (`FRAGRANCE | BODY | HOME | DISCOVERY`) and the three categories become real `Collection`
   records holding real `Product` records. This is what makes "Add to Cart" actually work:
   `CartView` resolves persisted ids against the single catalog projection, so an id that is
   not in `PRODUCTS` vanishes from the bag on the next render. No parallel merch type, no
   second lookup in the cart, no change to `CartView` or `WishlistView`.
3. **`kind` keeps the fragrance surfaces pure.** `/collections`, its tab bar, `/perfume/[slug]`'s
   `generateStaticParams`, and the related-products rail all filter to `kind === "FRAGRANCE"`.
   A body mist must never appear in the Signature grid or claim a `/perfume/…` URL.
4. **No product detail page for the new goods.** The SPA sold them from the grid and that is
   preserved: each card carries its own Add to Cart. Consequence: `CartLine` and `WishlistCard`
   must stop hardcoding `/perfume/${slug}` — a new `productHref()` helper routes by kind
   (fragrance → `/perfume/<slug>`, everything else → its category page). Both files change by
   one import and one expression.
5. **Iterate over everything, even at n = 1.** Per your instruction: body care and room
   fragrance each hold one product today, and every surface — grid, filter bar, comparison
   table, empty state — is written against the array. Adding a second candle is a `src/data`
   edit, full stop. Each page also renders a localized empty state when its collection is
   empty, so a category never renders a blank slab.
6. **Room fragrance's filter bar becomes real and data-derived.** The tabs are the distinct
   `format` values present in that collection (`All · Room Spray` today), filtered client-side
   on the `CollectionGrid` precedent — a `?type=` search param would opt the route out of ISR.
   The six invented hardcoded categories are dropped; they filtered nothing and named goods
   that do not exist.
7. **`concentration` becomes nullable.** A room spray has no *eau de parfum* concentration.
   Merch products carry `concentration: null` and a `format` string ("Room Spray", "Dry Body
   Oil", "6 × 3 ML Vials") which the three display sites print instead. Fragrances keep
   `concentration` and `format: null`, so their format line stays *translated* dictionary copy.
8. **`volumeMl` stays a required number.** A discovery set's total volume is honest (6 × 3 ML =
   18), and `format` carries the human label. No nullability, no guard, no ripple.
9. **Discovery's comparison table is generated from the sets**, not hand-written rows — it
   renders 1, 3, or 8 sets without an edit. Its cells come from real fields
   (`format`, `collectionsCovered`, `includes` membership, `priceInCents`), never from a
   parallel hardcoded array.
10. **All seven SPA Unsplash slugs were verified to return HTTP 200** and are carried over
    verbatim, so the pages keep their intended imagery.
11. **Catalog text stays English in both locales**, per the note at the top of `dictionaries/en.ts`.
    Product names, descriptions, `includes` entries, and `format` labels are wrapped in
    `ltrIsland()`; all page chrome is translated.
12. **Prices in cents.** `145 → 14500`. All display through `formatPrice`.
13. **No new dependencies.**

---

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/types/catalog.ts` | `+CollectionKind`; `Collection.kind`; `Product.format`, `.includes`, `.badge`; `concentration` → `Concentration \| null`; `ProductCardData` picks up `description`, `format`, `includes`, `badge` + `collectionKind`. |
| `src/data/products.ts` | **+3 collections** (`body-care`, `room-fragrance`, `discovery`), **+5 products** (1 + 1 + 3). Existing 3 collections get `kind: "FRAGRANCE"`; existing 11 products get `format: null`, `includes: []`, `badge: null`. |
| `src/services/products.ts` | **+`getFragranceCollections()`**, **+`getFragranceProductCards()`**, **+`getProductCardsByKind(kind)`**; `getProductSlugs()`, `getRelatedProductCards()`, `getFeaturedProducts()` filter to `FRAGRANCE`; `toCardData` carries the new fields. |
| `src/lib/routes.ts` | **New** — `productHref(product)`, the one place a product id becomes a URL. |
| `src/app/[locale]/body-care/page.tsx` | **New** (replaces `bodyCare/`). |
| `src/app/[locale]/room-fragrance/page.tsx` | Full rewrite. |
| `src/app/[locale]/discovery/page.tsx` | **New** (replaces `discovery-set/`). |
| `src/app/[locale]/bodyCare/`, `src/app/[locale]/discovery-set/` | **Deleted.** |
| `src/components/ecommerce/CategoryHero.tsx` | **New** — the hero shared by all three routes. |
| `src/components/ecommerce/MerchGrid.tsx` | **New**, `"use client"` — optional data-derived filter bar + grid. |
| `src/components/ecommerce/MerchCard.tsx` | **New**, `"use client"` — image, copy, price, Add to Cart, wishlist heart. |
| `src/components/ecommerce/DiscoverySetCard.tsx` | **New**, `"use client"` — badge, `includes` list, Add to Cart. |
| `src/components/ecommerce/DiscoveryComparison.tsx` | **New** — server, table generated from the sets. |
| `src/components/ecommerce/FeatureTriptych.tsx` | **New** — server; the icon/title/body band used by body care ("The Ritual") and discovery ("The KHEM Promise"). |
| `src/components/ecommerce/CartLine.tsx`, `WishlistCard.tsx` | `/perfume/${slug}` → `productHref(product)`; format line falls back to `format`. |
| `src/components/ecommerce/ProductCard.tsx` | Format line falls back to `format` when `concentration` is null (the card is reused nowhere else, but the type change must not leave it lying). |
| `src/components/ecommerce/CollectionView.tsx` | Tab bar takes fragrance collections only (already receives `collections` as a prop — the caller changes, not this file). |
| `src/app/[locale]/collections/page.tsx`, `collections/[slug]/page.tsx` | Use `getFragranceCollections()` / `getFragranceProductCards()`; `[slug]` prerenders and accepts fragrance slugs only. |
| `src/lib/i18n/dictionaries/en.ts` | **+`bodyCare`, `+roomFragrance`, `+discovery`** blocks; `product.concentrations` unchanged. |
| `src/lib/i18n/dictionaries/ar.ts` | Same keys, translated (a missing key is a compile error). |

Not touched: `next.config.ts`, `globals.css`, `middleware`/`proxy.ts`, `cart-provider`, `wishlist-provider`, `src/lib/cart.ts`, `constants/navigation-pages.ts` (already correct).

---

## Implementation requirements

### 1. Types — `src/types/catalog.ts`

```ts
/** What a collection sells. Fragrance surfaces filter on this. */
export type CollectionKind = "FRAGRANCE" | "BODY" | "HOME" | "DISCOVERY";

interface Collection { …; kind: CollectionKind }

interface Product {
  …
  /** `null` for anything that is not a fragrance — see `format`. */
  concentration: Concentration | null;
  /** Human format line for non-fragrances: "Room Spray", "6 × 3 ML Vials". */
  format: string | null;
  /** Contents of a set. Empty for a single product. */
  includes: string[];
  /** Merchandising flag: "Most Popular", "Limited", "Exclusive". */
  badge: string | null;
}
```

`ProductCardData` adds `description`, `format`, `includes`, `badge` to its `Pick` list — each
with a comment saying which surface reads it — plus `collectionKind: CollectionKind` beside
the existing `collectionName`, so `productHref` needs no second query.

### 2. Data — `src/data/products.ts`

Three collections appended, each with a written `bannerAlt`:

| slug | name | kind | banner |
| :--- | :--- | :--- | :--- |
| `body-care` | Body Care | `BODY` | `photo-1779524477261-12141ccbd8d9` |
| `room-fragrance` | Home Fragrance | `HOME` | `photo-1609599176235-f93af914fde0` |
| `discovery` | Discovery Sets | `DISCOVERY` | `photo-1674620213535-9b2a2553ef40` |

Descriptions: the SPA hero paragraphs, verbatim.

Five products. All: `isBestseller: false`, `concentration: null`, one `isPrimary` image at
`?w=600&h=800&fit=crop&auto=format` with a written `alt`, `story: null`, note tiers `[]`
(these goods have no pyramid — `MerchCard` never reads them and `ProductCard` never sees them).

| id / slug | name | collection | format | volumeMl | cents | inventory | badge | image |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `kyphi-body-mist` | Kyphi Body Mist | body-care | Dry Body Oil | 100 | 14500 | 20 | — | `photo-1767360963892-3353defd6584` |
| `noir-room-spray` | Noir Room Spray | room-fragrance | Room Spray | 100 | 9500 | 24 | — | `photo-1738520420642-bc8761cc9f16` |
| `initiation-set` | The Initiation Set | discovery | 6 × 3 ML Vials | 18 | 12500 | 40 | Most Popular | `photo-1674620213535-9b2a2553ef40` |
| `noir-initiation-set` | The Noir Initiation | discovery | 2 × 10 ML Vials | 20 | 18500 | 15 | Limited | `photo-1694481901573-a970f982ac5e` |
| `complete-library-set` | The Complete Library | discovery | 12 × 3 ML Vials | 36 | 28000 | 10 | Exclusive | `photo-1605174697130-0bb0b83c92fc` |

`subtitle` from the SPA (`"Rich · Absorbing · Sacred"` → `"Rich · Absorbing · Sacred"` kept),
`description` from the SPA `desc`/`full` verbatim, `sku` following the existing pattern
(`KHEM-BOD-KYP-100`, `KHEM-HOM-NOI-100`, `KHEM-DIS-INI-018`, …). `includes` from the SPA
arrays, unchanged.

Add a header note to the file recording that note pyramids are empty for non-fragrance kinds
and that `format` replaces `concentration` there.

### 3. Routing — `src/lib/routes.ts` (new)

```ts
/** Where a product's own page lives. Non-fragrances have no PDP; they are sold
 *  from their category grid, so a cart or wishlist line links back to it. */
export function productHref(product: {
  slug: string;
  collectionSlug: string;
  collectionKind: CollectionKind;
}): string
```
`FRAGRANCE → /perfume/<slug>`; `BODY → /body-care`; `HOME → /room-fragrance`;
`DISCOVERY → /discovery`. Exhaustive `switch` with a `never` check, so a fourth kind is a
compile error here rather than a dead link in production.

### 4. Services — `src/services/products.ts`

```ts
export async function getFragranceCollections(): Promise<Collection[]>
// → …from('Collection').select('*').eq('kind','FRAGRANCE').order('name')

export async function getFragranceProductCards(): Promise<ProductCardData[]>
// → …join Collection, .eq('Collection.kind','FRAGRANCE')

export async function getProductCardsByKind(kind: CollectionKind): Promise<ProductCardData[]>
// → …join Collection, .eq('Collection.kind', kind)
```
`getProductSlugs`, `getRelatedProductCards`, `getFeaturedProducts` gain the same
`FRAGRANCE` filter, each with its updated query comment. `toCardData` carries the new fields
and resolves `collectionKind` from the same `COLLECTIONS` map it already builds for
`collectionName`. `getProductCardsByCollection()` with no argument keeps returning **every**
kind — `/cart` and `/wishlist` depend on that.

### 5. `CategoryHero` — server component

Props: `{ eyebrow, titleLead, titleAccent, description, note?, imageUrl, imageAlt, tone? }`.

- `relative flex h-[60vh] min-h-105 items-center overflow-hidden`.
- `next/image` `fill priority quality={85} sizes="100vw"`, `object-cover saturate-60
  brightness-30`.
- Scrim: `absolute inset-0 bg-linear-to-e from-background/97 via-background/70 to-background/30`
  — logical direction, so it mirrors in Arabic instead of washing out the text.
- Content: `relative z-1 w-full px-6 md:px-20`, `mx-auto max-w-350`, `max-w-2xl` text column.
- `.eyebrow` → `<h1 className="font-heading text-4xl font-normal leading-tight text-ivory
  sm:text-6xl md:text-7xl">{titleLead}<br /><span className="text-gold">{titleAccent}</span></h1>`
  → `.gold-line` → description (`text-[15px] leading-loose text-ivory/50`) → optional `note`
  (`font-heading text-[11px] tracking-[0.2em] text-gold/60`).

### 6. `FeatureTriptych` — server component

Props: `{ items: ReadonlyArray<{ icon: LucideIcon; title: string; body: string }>; variant?: "band" | "steps" }`.

- `band` (body care): `grid grid-cols-1 gap-12 md:grid-cols-3`, centered, icon at `size={20}`,
  `bg-surface`, `py-15 px-6 md:px-20`, `border-b border-border`.
- `steps` (discovery): numbered `01 / 02 / 03` above a `.gold-line`, left-aligned,
  `gap-px bg-border` cells on `bg-background`, `py-30`.
- Each cell wrapped in `<Reveal delay={index * 0.1}>`.
- Icons come from the caller as `LucideIcon` references (never as strings), all
  `strokeWidth={1.25}`, all `aria-hidden`.

### 7. `MerchGrid` — `"use client"`

```ts
export interface MerchGridProps {
  items: readonly ProductCardData[];
  locale: Locale;
  /** Show the format filter bar. Room fragrance yes, body care no. */
  showFilters?: boolean;
}
```
- Filter values are `[...new Set(items.map(i => i.format).filter(Boolean))]` — derived, never
  hardcoded — prefixed with an "All" tab. The bar is suppressed entirely when there are fewer
  than two formats, so today's single-product room-fragrance page shows no empty affordance
  but a second format brings it back automatically.
- Tab styling copies `CollectionView`'s `CollectionTab`: `border-b-2 py-5 font-heading
  text-[11px] tracking-[0.2em]`, active `border-gold text-gold`, inactive
  `border-transparent text-ivory/40 hover:text-ivory/70`, `aria-pressed` on each `<button type="button">`.
- Grid: `grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3`, each child in
  `<Reveal delay={(i % 3) * 0.1}>`.
- Empty state: centered `dict.<page>.empty` copy — never a blank grid.

### 8. `MerchCard` — `"use client"`

Props: `{ product: ProductCardData; locale: Locale }`. Reads `useDictionary()`, `useCart()`,
`useWishlist()`.

- Image: `next/image fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"`,
  `aspect-3/4`, `object-cover brightness-65 saturate-60`, inside `.img-zoom` (CSS hover — no
  `onMouseEnter` style mutation).
- Body `p-7`: `.eyebrow` = `format` · subtitle; `<h3 className="font-heading text-lg">`;
  description `text-xs leading-loose text-ivory/40`; a row with `formatPrice` in
  `font-heading text-lg text-gold` and `formatVolume` in `text-[10px] tracking-[0.1em] text-ivory/30`.
  Everything data-sourced sits inside one `{...ltrIsland(locale)}` wrapper.
- **Add to Cart**: `className="btn-luxury w-full justify-center"`, `type="button"`,
  `onClick={() => addLine(product.id, 1, product.inventory)}`, then a 2.5 s confirmed state
  showing `<Check size={14} strokeWidth={1.25} aria-hidden />` + `dict.…added`. Copy
  `ProductPurchase`'s `timeoutRef` + `useEffect` cleanup exactly — clear on re-click and on
  unmount. `disabled` + `dict.product.soldOut` when `inventory === 0`.
- **Wishlist heart**: `absolute top-5 end-5 z-2` (logical inset, mirrors in RTL),
  `size-9 grid place-items-center bg-background/70 border border-white/10 hover:border-gold`,
  lucide `<Heart size={14} strokeWidth={1.25} />`, `fill-current text-gold` when saved.
  `aria-pressed`, `aria-label` via `interpolate(dict.product.wishlistAdd|wishlistRemove, { name })`.
  State is derived from the store (`wishlist.isHydrated && wishlist.has(product.id)`), never
  local — the same product's heart on `/wishlist` must agree.

### 9. `DiscoverySetCard` — `"use client"`

Same cart/wishlist mechanics as `MerchCard`, plus:
- Badge, when `product.badge` is set: `absolute top-5 end-5 z-2 bg-gold px-3 py-1.5
  font-heading text-[9px] font-semibold tracking-[0.2em] text-background`. (The heart moves
  to `top-5 start-5` on this card so the two never collide.)
- Square image (`aspect-square`).
- `includes` list under an `.eyebrow` heading: one row per entry,
  `<Check size={12} strokeWidth={1.25} className="shrink-0 text-gold" aria-hidden />` + text.
  This replaces the SPA's 4 px CSS dot. Rendered inside a semantic `<ul>`/`<li>` with
  `list-none`, so it is announced as a list.
- Card is `flex flex-col`; description takes `flex-1` so the buttons align across a row of
  cards of unequal copy length.
- Button is `btn-luxury btn-luxury-fill`.

### 10. `DiscoveryComparison` — server component

Props: `{ sets: readonly ProductCardData[]; locale: Locale }`.

Rows are **derived**, one object per row built from the sets themselves:

| Row | Source |
| :--- | :--- |
| Vials Included | `set.format` |
| Total Volume | `formatVolume(set.volumeMl)` |
| Collector's Box | `set.includes.some(i => /box/i.test(i))` |
| Story Booklet | `set.includes.some(i => /booklet/i.test(i))` |
| Applies to Full Size | always true (the KHEM promise) |
| Price | `formatPrice(set.priceInCents)` |

Boolean cells render lucide `<Check className="text-gold" />` or `<Minus className="text-ivory/20" />`
at `size={14} strokeWidth={1.25}` with an `<span className="sr-only">` yes/no label from the
dictionary — a bare icon in a table cell is unreadable to a screen reader. This replaces the
SPA's `✓` / `—` text.

Table requirements: `<caption className="sr-only">`, `<th scope="col">` for each set,
`<th scope="row">` for each row label, header cells in `{...ltrIsland(locale)}` (set names are
English data), wrapped in `<div className="overflow-x-auto">` so it never forces the page to
scroll horizontally on mobile. `min-w-[560px]` on the table itself.

### 11. Pages

All three: `export const revalidate = 3600` (static-leaning catalog pages, matching
`/collections`), `generateStaticParams` over `LOCALES`, `generateMetadata` → `localeMetadata()`
with title/description/og from the page's dictionary block, `isLocale()` narrowing, and
`Promise.all([params, …services])`.

- **`/body-care`** — `CategoryHero` → `FeatureTriptych variant="band"` with lucide
  `Sparkles` / `Gem` / `Droplet` (replacing `✦ ◆ ◇`) → `MerchGrid showFilters={false}`.
- **`/room-fragrance`** — `CategoryHero` → `MerchGrid showFilters` → nothing else. The SPA's
  dead category bar is not reproduced; the real filter bar lives in the grid.
- **`/discovery`** — `CategoryHero` (with the `note` line: "Each discovery purchase may be
  applied to full-size orders.") → `DiscoverySetCard` grid → `FeatureTriptych variant="steps"`
  with lucide `Package` / `Clock` / `BadgePercent` → `DiscoveryComparison`.

Each page is a thin Server Component: resolve params, fetch via
`getProductCardsByKind("BODY" | "HOME" | "DISCOVERY")`, compose. No data literals in any page file.

### 12. Dictionaries

Three new top-level blocks, mirrored in `ar.ts` (Arabic written as Arabic, not transliterated;
placeholders preserved):

```
bodyCare: {
  meta: { title, description, ogTitle, ogDescription },
  eyebrow: "The Ritual", titleLead: "Body", titleAccent: "Care",
  description: <SPA hero copy>,
  ritual: { layering: {title, body}, natural: {title, body}, practice: {title, body} },
  addToCart: "Add to Cart", added: "Added",
  empty: "New rituals are being prepared. Please return shortly.",
}
roomFragrance: {
  meta: {…}, eyebrow: "Scent Your Sanctuary", titleLead: "Home", titleAccent: "Fragrance",
  description: <SPA hero copy>,
  filterAll: "All", filterLabel: "Filter by type",
  addToCart, added, empty,
}
discovery: {
  meta: {…}, eyebrow: "Begin Here", titleLead: "Discovery", titleAccent: "Sets",
  description: <SPA hero copy>, note: "Each discovery purchase may be applied to full-size orders.",
  includes: "Includes",
  promise: { eyebrow: "The KHEM Promise", heading: "Discovery to Full Size",
             steps: { choose: {title, body}, discover: {title, body}, unlock: {title, body} } },
  compare: { eyebrow: "Compare", heading: "Which Set Is Right for You?",
             caption: <sr-only table caption>,
             rows: { vials, volume, box, booklet, credit, price },
             yes: "Included", no: "Not included" },
  addToCart, added, empty,
}
```

### 13. Icons

`lucide-react` only, every instance `strokeWidth={1.25}`, every decorative instance
`aria-hidden="true"`: `Sparkles`, `Gem`, `Droplet` (body-care band), `Package`, `Clock`,
`BadgePercent` (discovery steps), `Check` (add-to-cart confirmation, includes list, comparison
yes), `Minus` (comparison no), `Heart` (wishlist), `ShoppingBag` (empty states). **Zero
hand-authored `<svg>`, zero `✦ ◆ ◇ ✓ —` text glyphs, zero CSS-dot bullets in the new code.**

---

## Security requirements

1. `[locale]` is untrusted input; `isLocale()` narrows it before it reaches a dictionary lookup
   or a metadata URL. The three routes take no other params.
2. No route param is interpolated into an `href` without passing through `localizePath()`;
   `productHref()` emits only literal path prefixes plus a seeded slug.
3. Cart and wishlist writes carry a **product id only** — no price, name, or image crosses into
   `localStorage`, so a tampered blob can never render as text or move a total. Ids that do not
   resolve against the server-fetched catalog are dropped, which the existing guards already do.
4. Quantities go through `addLine(id, 1, product.inventory)`, so the store's `quantityCeiling`
   caps them; no client-supplied number reaches the cart unclamped.
5. The service layer stays server-only — no client component imports `src/services/*` or
   `src/data/*`.
6. No `dangerouslySetInnerHTML`, no `eval`, no user-supplied HTML.
7. Remote images stay on the `images.unsplash.com` allowlist already in `next.config.ts`.

---

## Acceptance criteria

- [ ] `/body-care`, `/room-fragrance`, `/discovery` render in both `en` (unprefixed) and `ar` (`/ar/…`); the three Nav mega-menu links resolve instead of 404ing.
- [ ] `src/app/[locale]/bodyCare/` and `src/app/[locale]/discovery-set/` no longer exist.
- [ ] Add to Cart on each of the five new products puts a line in the bag, the Nav badge increments, `/cart` shows the correct name, image, price, and total, and the quantity stepper caps at the product's inventory.
- [ ] The wishlist heart on a body-care product fills gold and that product then appears on `/wishlist`, whose card links back to `/body-care` (not to a 404 `/perfume/…`).
- [ ] `/collections`, its tab bar, and the related-products rail still show **fragrances only** — 11 products, 3 collections. `/collections/body-care` 404s.
- [ ] `/perfume/kyphi-body-mist` 404s and is not prerendered.
- [ ] Adding a second product to `body-care` in `src/data/products.ts` makes it appear on `/body-care` with no component edit; adding one with a new `format` to `room-fragrance` makes the filter bar appear and filter correctly.
- [ ] The discovery comparison table renders correctly with 3 sets and would render correctly with 1 or 5 — no hardcoded column count.
- [ ] Zero `react-router-dom` imports, zero inline `style` props, zero raw hex colors, zero `<img>`, zero `any`, zero hand-written `<svg>`, zero decorative text glyphs in the new code.
- [ ] Every font comes from `--font-heading` / `--font-body`; the Arabic tree renders Amiri + IBM Plex Sans Arabic, not Cinzel.
- [ ] Arabic: hero scrim, wishlist inset, badge inset, includes checkmarks, and filter tabs all follow `dir`. English catalog copy sits in `dir="ltr"` islands.
- [ ] No horizontal overflow at 375 px on any of the three pages, including the comparison table.
- [ ] `generateMetadata` emits a canonical plus `en` / `ar` / `x-default` alternates and a complete OpenGraph block for all three routes.
- [ ] Add-to-cart confirmation clears after 2.5 s, survives a double click, and leaves no timer on unmount.
- [ ] Strict TypeScript, no `any`, no non-null assertions.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

`npm run build` is the meaningful one: it exercises `generateStaticParams` for both locale
trees, the `/perfume/[slug]` prerender list, and every server/client boundary.

## Manual test steps

1. `npm run dev`
2. `http://localhost:3000/body-care` — hero, three-icon ritual band (lucide, not `✦ ◆ ◇`), one product card. Click **Add to Cart** → button shows a check + "Added", Nav badge goes to 1, reverts after ~2.5 s.
3. Go to `/cart` — Kyphi Body Mist at $145, correct image, stepper works, subtotal correct. Click the product name → lands on `/body-care`.
4. Back on `/body-care`, click the heart → fills gold. Visit `/wishlist` → the mist is listed and its link goes to `/body-care`.
5. `http://localhost:3000/room-fragrance` — hero, one card, **no filter bar** (one format). Add to cart → bag now holds two lines.
6. `http://localhost:3000/discovery` — three set cards with gold badges (Most Popular / Limited / Exclusive), each `includes` row prefixed by a gold lucide check. Add "The Complete Library" → $280 in the bag.
7. Scroll on: three numbered promise steps, then the comparison table — Collector's Box shows a check only on The Complete Library, a dashed minus on the other two. Tab to the table and confirm a screen reader announces "Included"/"Not included".
8. `http://localhost:3000/collections` — still exactly 11 fragrances, tab bar still **All · Signature · Noir · Gemstone** with no Body Care / Home / Discovery tab.
9. `http://localhost:3000/collections/body-care` and `http://localhost:3000/perfume/noir-room-spray` → both 404.
10. `http://localhost:3000/ar/discovery` — Arabic chrome, mirrored layout, badge on the left, checkmarks on the right of their text, table scrolls inside its own container. English set names stay left-to-right.
11. Nav → Collections mega-menu → each of Discovery Set / Body Care / Room Fragrance routes correctly, in both locales.
12. DevTools responsive at 375 / 768 / 1440 px on all three pages — no horizontal scrollbar; grids go 1 → 2 → 3.
13. Temporarily add a second `room-fragrance` product with `format: "Candle"` → the filter bar appears with **All · Room Spray · Candle** and filters. Revert.
14. View source on `/ar/body-care` → `<html lang="ar" dir="rtl">`, canonical, `hreflang` for `en` / `ar` / `x-default`, `og:locale` `ar_EG`.
