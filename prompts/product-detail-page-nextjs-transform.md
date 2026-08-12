# Prompt — Transform `product-details` into the localized `/perfume/[slug]` PDP

## Goal

Rewrite `src/app/[locale]/product-details/page.tsx` — a `react-router-dom` SPA component pasted into the App Router tree — as the production Product Detail Page at **`/perfume/[slug]`**, matching the idiom already established by `src/app/[locale]/collections/[slug]/page.tsx`.

Two things ship together:

1. **The transform** — theme tokens instead of raw hexes, `--font-heading` instead of inline `'Cinzel', serif`, `next/image`, `<LocaleLink>`, `<Reveal>`, Lucide icons, responsive layout, real metadata, ISR (5m).
2. **Full EN/AR support** — dictionary-driven chrome, RTL-correct, LTR islands around English catalog records.

The route is what makes every existing `<ProductCard>` link resolve: `ProductCard.tsx` already points at `/perfume/${slug}`, and that target currently 404s.

**Composition rule for this task:** many small components, none doing two jobs. No file in this change should exceed ~150 lines. The page is a composition root that delegates; each section is its own component; exactly two client components exist and they hold only the state they own.

---

## Skills read

- `AGENTS.md` — §1 core rules, §2.2 visual language, §3 tokens, §5 prompt contract, §6 stack, §7 structure, §8 routing matrix, §9 schema, §12 checklist.
- No `.agents/skills/*` skill applies: this route has no Clerk auth, no Supabase call, no AI SDK usage. The session hooks suggested `ai-sdk`, `vercel-services`, `nextjs`, and `v0-dev` on lexical matches against "product"/"next" — none is relevant to a catalog detail page, and none is invoked.
- Next.js patterns verified against the installed `next@16.2.12` and the existing routes, not from memory.

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/app/[locale]/product-details/page.tsx` | 345 lines, untracked. Imports `react-router-dom` and `../context/CartContext` — **neither exists**; the route cannot build. Hardcodes a 4-product `PRODUCTS` map with its own sizes, stories, and ingredients. All styling is inline `style` objects with raw hexes. Raw `<img>`. Hand-rolled `IntersectionObserver`. Inline `<svg>` heart. Desktop-only padding (`24px 80px`, `1fr 1fr` with no breakpoints). |
| `src/app/[locale]/collections/[slug]/page.tsx` | The reference idiom for a dynamic route: `revalidate`, `generateStaticParams` over `LOCALES × slugs`, `generateMetadata` → `localeMetadata()`, `isLocale()` narrowing, `Promise.all`, `notFound()` on an unknown slug, metadata falling back rather than echoing the segment. |
| `src/components/ecommerce/CollectionView.tsx` | Breadcrumb pattern: `<LocaleLink>` + `<ChevronRight className="rtl:rotate-180">` + `<span aria-current="page">`, wrapped in `ltrIsland()` when it prints a data-sourced name. `max-w-350`, `px-6 md:px-20`. |
| `src/components/ecommerce/CollectionGrid.tsx` | The client-boundary precedent: server-rendered `<ProductCard>` nodes handed over as `ReactNode`, `useDictionary()` for copy, in-memory wishlist `useState` documented as a placeholder for a future Server Action, `aria-pressed` + `interpolate()`'d `aria-label`, logical `end-5` insets. |
| `src/components/ecommerce/ProductCard.tsx` | Async Server Component over `ProductCardData`. Renders `interpolate(dict.product.collectionLabel, …)`, name/subtitle in an LTR island, then **every** note as a pill, then `formatPrice` / `formatVolume`. The note list is `[...topNotes, ...heartNotes, ...baseNotes]` — today one per tier. |
| `src/services/products.ts` | Query seam. Has `getFeaturedCollections`, `getCollections`, `getCollectionBySlug`, `getProductCardsByCollection`, `getFeaturedProducts`, `getProductBySlug`, `getFeaturedProduct`, plus private `toCardData` / `resolvePrimaryImage`. Each carries the Supabase query it will become. No slug list and no "related" query exist yet. |
| `src/services/content.ts` | Same seam for editorial data. Has `getIngredients` / `getIngredientDetails`. No per-product ingredient lookup yet. |
| `src/data/products.ts` | Seed data: **3 collections, 11 products**. Every product has `volumeMl: 100`, one `sku`, one `inventory`, **one note per tier**, and 1–2 images (only `kyphi-noir` has 2). |
| `src/data/content.ts` | `INGREDIENTS` — 8 records, each with `latinName`, `origin`, `families`, `rarity`, `facts[]`, `image`, and **`usedIn: { name, slug }[]` keyed by product slug**. This is the join the PDP's "Key Ingredients" section needs; nothing has to be invented. |
| `src/types/catalog.ts` | `Product`, `Collection`, `ProductImage`, `ProductCardData`, documented as a 1:1 mirror of AGENTS.md §9. Already carries `volumeMl` — no type change is needed for this task. |
| `src/types/content.ts` | `Ingredient`, `IngredientUsage` — the latter's doc comment already says "Product slug — resolves to `/perfume/[slug]`". |
| `src/lib/i18n/*` | `localizePath`, `localeAlternates`, `isLocale`, `LOCALES`; `localeMetadata()`; `getDictionary()`; `interpolate()`; `ltrIsland()`. |
| `src/lib/format.ts` | `formatPrice` (cents → `$295`), `formatVolume` (`100 ML`). |
| `src/components/Nav.tsx` | `fixed inset-x-0 top-0 z-1000 … h-20` — **80px tall and fixed**, so a page whose first element is not a full-bleed hero must clear it itself. |
| `src/app/globals.css` | `@theme` tokens, `.eyebrow`, `.gold-line`, `.btn-luxury` / `.btn-luxury-fill`, `.note-pill`, `.img-zoom`; the RTL tracking reset and the `[lang="ar"]` optical-size compensation, both scoped to skip `[dir="ltr"]` islands. |
| `next.config.ts` | `images.remotePatterns` already allows `images.unsplash.com` — no config change. |
| `package.json` | `next 16.2.12`, `react 19.2.4`, `motion 13`, `lucide-react ^1.30.0`. No `react-router-dom`, no cart library, no `clsx`. |

### Verified before deciding

- `grep` for `.sku`, `.inventory`, `concentration` across `src/**/*.{ts,tsx}` returns **zero UI reads** (one unrelated prose match in `content.ts`). The PDP will be the first surface to render `concentration` and `inventory`.
- There is no `CartContext`, no `providers/cart-provider.tsx`, no `hooks/useCart.ts`, no `/cart` route, and no cart service.

### Defects in the current file

1. `react-router-dom` import — not installed; the route fails to build.
2. `../context/CartContext` import — does not exist anywhere in the repo.
3. `useState` / `useEffect` / `useRef` with no `'use client'` — invalid in a Server Component.
4. Catalog data hardcoded in the page, bypassing `src/services/products.ts` and contradicting AGENTS.md §6 ("UI must display stored data only"). Its 4 products duplicate — and disagree with — the 11 in `src/data/products.ts`.
5. **A three-size selector with per-size prices that no schema field backs.** `Product` stores one `volumeMl` and one `priceInCents`; the SPA's `sizes: [50, 100, 200]` array is invented data (AGENTS.md §1.4).
6. Raw `<img>` everywhere — no optimization, no `sizes`, no LCP `priority`, plus an `@next/next/no-img-element` lint error.
7. Every color is an inline hex/rgba; `fontFamily: "'Cinzel', serif"` bypasses the `--font-heading` variable, so the Arabic tree would render Cinzel, which has no Arabic glyphs.
8. Not responsive — `gridTemplateColumns: '1fr 1fr'`, `padding: '24px 80px'`, no breakpoints. Unusable below ~1024px.
9. Hand-rolled `IntersectionObserver` duplicates `<Reveal>` and never unobserves individual targets.
10. `onMouseEnter`/`onMouseLeave` style mutation where CSS `:hover` suffices.
11. Hardcoded English throughout, plus a literal `/` breadcrumb separator that reads backwards in RTL.
12. Inline `<svg>` heart instead of a Lucide icon.
13. `useEffect(… , [id])` resets size and image but omits `product` from the dependency list.
14. `quantity` is selected but never passed to `addItem` — the quantity control is decorative.
15. Silent fallback to `kyphi-noir` for any unknown `id`: `/perfume/anything` would render Kyphi Noir at HTTP 200. An unknown slug must 404.
16. Hardcoded "Eau de Parfum" under the price — wrong for all 11 products, every one of which is `EXTRAIT_DE_PARFUM`.
17. No `metadata`, no canonical, no `hreflang`, no `revalidate`.
18. Related-products list is `Object.values(PRODUCTS).slice(0, 3)` — not collection-aware.
19. `paddingTop: '80px'` hardcodes the Nav height as a magic number.

---

## Decisions and assumptions

1. **Route is `/perfume/[slug]`**, per AGENTS.md §8 and because `ProductCard` already links there. `src/app/[locale]/product-details/` is **deleted** — it is untracked, unreachable, and unbuildable.
2. **There is no size selector.** Volume is a property of the collection, not a choice: **Signature and Noir bottle at 100 ML, Gemstone at 50 ML.** One bottle, one price, one SKU — exactly what `Product` already stores. The SPA's 50/100/200 ladder is dropped as invented data, and the PDP renders `formatVolume(product.volumeMl)` as a **spec** beside the price. No `ProductVariant` model, no change to `src/types/catalog.ts`, no change to AGENTS.md §9.
3. **The Gemstone products move to `volumeMl: 50`** (`lapis-eternel`, `carnelian-ember`, `turquoise-nefer`), with their SKU suffix corrected from `-100` to `-050`. **Prices are not touched** — the stored price is the price of that bottle. The volume-per-collection rule is written into the `COLLECTIONS` comment block so a future collection declares its format instead of guessing.
4. **"Add to Cart" is a local placeholder**, exactly as the wishlist button already is in `CollectionGrid.tsx`: it holds the "✓ Added" confirmation for 2.5s and nothing leaves the component. Documented in-file as the seam for a future `addToCart` Server Action, which is what fixes defect #14 for real. No cart provider, no Nav badge, no `localStorage` — all of that is its own task.
5. **The wishlist button is local `useState`**, same precedent, same accessibility contract (`aria-pressed`, `interpolate()`'d `aria-label`).
6. **Note pyramids are enriched to three per tier**, and `ProductCard` is capped to **the first note of each tier** — `[topNotes[0], heartNotes[0], baseNotes[0]]`. Because every existing seed note stays at index 0 of its tier, every card across `/collections` and the home grid renders exactly the pills it renders today. The PDP gets the full nine-note pyramid it was designed for.
7. **Key Ingredients are derived, not invented.** `INGREDIENTS[].usedIn[].slug` already links materials to products; the section filters on it. The row shows `name`, `latinName`, `origin`, and `facts[0]` — the short provenance line, which is what the SPA's freeform `desc` was. `description` is a full paragraph and is not truncated. Products with no matching material render **no section at all**, not an empty one.
8. **Related fragrances are collection-aware**: same collection, self excluded, limit 3, topped up from the rest of the catalog when a collection has fewer than 4 products (gemstone and noir both do). Rendered with the existing `<ProductCard>` — the card design is not forked.
9. **Gallery images**: each product needs more than one. Every product keeps its existing primary untouched and gains two gallery images drawn **only from Unsplash slugs already present in this repo** — inventing a photo slug would 404 through `next/image`. Each gets a written `alt`.
10. **Stock is displayed from stored data**: `inventory === 0` disables the button and reads "Sold Out"; `< 6` shows a low-stock line. No seeded product is at zero today, so that branch is defensive — stated in a comment rather than forced by editing a product's stock to make it demonstrable.
11. **Catalog text stays English in both locales**, per the note at the top of `dictionaries/en.ts`. Product names, subtitles, stories, notes, and ingredient copy sit in `ltrIsland()`; page chrome is translated.
12. **Concentration gets a dictionary map** (`EXTRAIT_DE_PARFUM` → "Extrait de Parfum" / "إكستريه دو بارفان"). The stored enum is never printed raw — that is a display concern, and it fixes defect #16.
13. **`revalidate = 300`** (ISR 5m), per the §8 routing matrix. `generateStaticParams` prerenders 2 locales × 11 slugs = 22 pages.
14. **The Nav offset is `pt-20`**, matching the measured `h-20` fixed Nav, not the SPA's `80px` string.
15. **No new dependencies.**

---

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/app/[locale]/product-details/page.tsx` | **Deleted** (with its directory). |
| `src/app/[locale]/perfume/[slug]/page.tsx` | **New** — thin route: params, metadata, `generateStaticParams`, data, composition. |
| `src/components/ecommerce/ProductBreadcrumb.tsx` | **New** — server. Home / Collections / Collection / Product. |
| `src/components/ecommerce/ProductGallery.tsx` | **New** — `"use client"`. Active image + thumbnails. |
| `src/components/ecommerce/ProductPurchase.tsx` | **New** — `"use client"`. Price, spec line, quantity, add-to-cart, wishlist, stock line. |
| `src/components/ecommerce/QuantityStepper.tsx` | **New** — `"use client"`. Controlled −/+ stepper. |
| `src/components/ecommerce/ProductStory.tsx` | **New** — server. Paragraph-split editorial story. |
| `src/components/ecommerce/ProductPyramid.tsx` | **New** — server. Three-column note pyramid. |
| `src/components/ecommerce/ProductIngredients.tsx` | **New** — server. Materials derived from `usedIn`. |
| `src/components/ecommerce/RelatedProducts.tsx` | **New** — server. Three `<ProductCard>`s. |
| `src/components/ecommerce/ProductCard.tsx` | **One-line change** — cap the pills at one note per tier. |
| `src/data/products.ts` | Gemstone → 50 ML + `-050` SKUs; 3 notes per tier; 3 images each; stories for the 9 products lacking one. |
| `src/services/products.ts` | **+2 functions**: `getProductSlugs()`, `getRelatedProductCards()`. |
| `src/services/content.ts` | **+1 function**: `getIngredientsForProduct(productSlug)`. |
| `src/lib/i18n/dictionaries/en.ts` | Extend the existing `product` block. |
| `src/lib/i18n/dictionaries/ar.ts` | Same keys, translated (a missing key is a compile error). |

Not touched: `src/types/catalog.ts`, `AGENTS.md`, `globals.css`, `next.config.ts`, `Nav.tsx`, `Footer.tsx`, `CollectionView.tsx`, `CollectionGrid.tsx`, the home page.

---

## Implementation requirements

### 1. Data — `src/data/products.ts`

**Volume per collection.** Add a comment above `COLLECTIONS` stating the rule — Signature 100 ML, Noir 100 ML, Gemstone 50 ML — and that a new collection declares its bottle format there. Then change the three Gemstone products:

| slug | `volumeMl` | `sku` |
| :--- | :--- | :--- |
| `lapis-eternel` | `100` → **`50`** | `KHEM-GEM-LAP-100` → **`KHEM-GEM-LAP-050`** |
| `carnelian-ember` | `100` → **`50`** | `KHEM-GEM-CAR-100` → **`KHEM-GEM-CAR-050`** |
| `turquoise-nefer` | `100` → **`50`** | `KHEM-GEM-TUR-100` → **`KHEM-GEM-TUR-050`** |

`priceInCents` and `inventory` are unchanged for all 11 products. Signature and Noir are unchanged entirely.

**Note pyramids.** Three per tier. Index 0 of each tier is today's value, unchanged — this is what keeps the cards identical:

| slug | Top | Heart | Base |
| :--- | :--- | :--- | :--- |
| `kyphi-noir` | Frankincense · Smoked Incense · Black Pepper | Black Oud · Labdanum · Dark Rose | Amber · Myrrh · Sandalwood |
| `ra-soleil` | Solar Musk · Bergamot · Aldehydes | Saffron · Neroli · Jasmine Sambac | White Amber · Sandalwood · Vanilla Absolue |
| `nile-absolue` | Papyrus · Aquatic Accord · Violet Leaf | Vetiver · Lotus Flower · Iris | Dark Musk · Driftwood · Ambergris |
| `obsidian-elixir` | Black Iris · Incense Smoke · Bergamot | Patchouli · Dark Rose · Cistus | Burnt Wood · Benzoin · Dark Musk |
| `isis-rose` | Rose Absolute · Pink Pepper · Bergamot | Neroli · Jasmine · Orris | Sandalwood · White Musk · Benzoin |
| `anubis-ombre` | Dark Oud · Black Pepper · Saffron | Labdanum · Leather · Dark Rose | Smoke · Vetiver · Tonka Bean |
| `lotus-blanc` | White Lotus · Bergamot · Green Accord | Aquatic Musk · Water Lily · Jasmine | Cedar · White Musk · Ambrette |
| `horus-gold` | Saffron · Bergamot · Cardamom | Gold Accord · Jasmine Sambac · Orris | Amber Resin · Sandalwood · Tonka Bean |
| `lapis-eternel` | Blue Iris · Bergamot · Juniper | Violet Leaf · Orris · Jasmine | Ambergris · Cashmere Wood · White Musk |
| `carnelian-ember` | Pink Pepper · Blood Orange · Cinnamon | Red Amber · Rose · Immortelle | Cedarwood · Benzoin · Tonka Bean |
| `turquoise-nefer` | Neroli · Bergamot · Green Mandarin | Sea Salt · Orange Blossom · Jasmine | White Musk · Driftwood · Ambrette |

The existing file-header note about placeholder pyramids stays, updated to say the tiers are now three-deep but still not the perfumer's real formula.

**Gallery.** Every product ends with three images: its existing primary (`w=600&h=800`, untouched) plus two at `w=900&h=1100&fit=crop&auto=format`, `isPrimary: false`, `sortOrder` 1 and 2, each with a written `alt`. Draw only from slugs already in this repo:

```
1676950933747-5f886cadf014   1778058505814-6d247ccb600c   1738664926458-d8ca7f56549f
1760860992203-85ca32536788   1643797517714-a273548abc3c   1738664926482-1a986adb3e6c
1709662369957-0cbf9f8452fc   1747696766706-5485b39bf358   1718728593303-94ec0352cf3d
```

Never repeat a product's own primary within its gallery.

**Stories.** `kyphi-noir` and `lapis-eternel` already have one. Give the other nine a two-paragraph editorial story in the same register, `\n\n`-separated (the PDP splits on it). `story: null` must still render nothing — keep the section conditional.

### 2. Services

`src/services/products.ts` — two additions, each with the Supabase query it will become, matching the file's convention:

```ts
export async function getProductSlugs(): Promise<string[]>
// → supabase.from('Product').select('slug').eq('isArchived', false).is('deletedAt', null)

export async function getRelatedProductCards(slug: string, limit = 3): Promise<ProductCardData[]>
// → same-collection query excluding `slug`, topped up from the catalog when short
```

`getRelatedProductCards` reuses the module's existing `toCardData` / `resolvePrimaryImage` helpers and the `collectionNameBySlug` map. No new types. Existing functions are not modified.

`src/services/content.ts` — one addition:

```ts
export async function getIngredientsForProduct(productSlug: string): Promise<Ingredient[]>
// → supabase.from('Ingredient').select('*, usedIn:IngredientUsage!inner(slug)').eq('usedIn.slug', productSlug)
```

### 3. Route — `src/app/[locale]/perfume/[slug]/page.tsx`

Thin. Params, metadata, static params, data, composition — no markup beyond the section skeleton.

```ts
export const revalidate = 300;                       // ISR 5m — AGENTS.md §8

export async function generateStaticParams()          // LOCALES × getProductSlugs()
export async function generateMetadata({ params })    // localeMetadata(); unknown slug falls
                                                      // back to the collections meta rather
                                                      // than echoing the segment into the page
export default async function PerfumePage({ params })
```

- `const { locale, slug } = await params;` — `isLocale(locale) ? locale : "en"`.
- `getProductBySlug(slug)` → `notFound()` when null. This is defect #15's fix; there is no fallback product.
- `Promise.all` the dictionary, collection, related cards, and ingredients once the product is known.
- Root: `<div className="min-h-screen bg-background pt-20 text-ivory">` — `pt-20` clears the fixed `h-20` Nav.

Composition, in order: `<ProductBreadcrumb>` → main two-column `<section>` (`<ProductGallery>` | info column) → `<RelatedProducts>`. The info column holds `<ProductPurchase>`, `<ProductStory>`, `<ProductPyramid>`, `<ProductIngredients>`, each wrapped in `<Reveal>`.

### 4. Components

Every one of these is small, single-purpose, and typed with an exported props interface. Server by default; `"use client"` only on the two that own state.

**`ProductBreadcrumb.tsx`** (server) — `Home → Collections → {collection} → {product}`, `<LocaleLink>` for the first three, `<span aria-current="page">` for the last. Lucide `<ChevronRight size={12} strokeWidth={1.25} aria-hidden className="rtl:rotate-180" />` between. Collection and product names get `{...ltrIsland(locale)}`. Bar: `border-b border-border px-6 py-6 md:px-20`, inner `mx-auto max-w-350`, `flex flex-wrap items-center gap-2`, text `text-[11px] tracking-wide text-ivory/35`, current `text-gold/70`. Wrapped in a `<nav aria-label>`.

**`ProductGallery.tsx`** (`"use client"`) — props `{ images: ProductImage[]; productName: string }`.
- State: `activeIndex`, nothing else.
- Frame: `relative aspect-4/5 w-full overflow-hidden bg-card lg:sticky lg:top-20 lg:aspect-auto lg:h-[calc(100vh-5rem)]`, `flex flex-col`.
- Images stacked absolutely, cross-faded on `opacity` with `duration-700 ease-out` — opacity only, so there is no layout shift. First image `priority`, `sizes="(min-width: 1024px) 50vw, 100vw"`, `quality={85}`, `className="object-cover brightness-90"`.
- Thumbnail rail: `flex gap-px bg-background p-px`, each a `<button type="button">` with `aria-label={interpolate(dict.product.gallery.thumbnail, { index, total })}`, `aria-current` on the active one, `h-20 flex-1 overflow-hidden`, active `outline outline-2 -outline-offset-2 outline-gold`, inactive `outline-transparent`, plus `focus-visible:outline-gold`. Rail is hidden when there is only one image.
- Reads `useDictionary()`. Imports no service.

**`ProductPurchase.tsx`** (`"use client"`) — props `{ product: Pick<Product, "id" | "name" | "subtitle" | "concentration" | "volumeMl" | "priceInCents" | "inventory">; collectionName: string; locale: Locale }`.
- State: `quantity`, `wishlisted`, `justAdded`. **No size state** — there is one bottle.
- Eyebrow `interpolate(dict.product.collectionLabel, { name: collectionName })`; `<h1 className="font-heading text-4xl font-normal text-ivory sm:text-5xl lg:text-6xl">`; subtitle `text-[15px] italic tracking-wide text-gold/70`; `<div className="gold-line" />`. Name and subtitle in an LTR island.
- Price + spec row, `flex flex-wrap items-baseline gap-4`: `formatPrice(product.priceInCents)` in `font-heading text-3xl text-gold`, then a `text-xs tracking-[0.1em] text-ivory/35` spec reading `formatVolume(product.volumeMl)` and `dict.product.concentrations[product.concentration]` separated by a `·`. This is where the SPA's size buttons used to be — the bottle format is stated, not chosen.
- `<QuantityStepper>` below its own `text-[10px] uppercase tracking-[0.25em] text-ivory/40` label, clamped to `min(product.inventory, 10)`.
- Actions row: the add-to-cart button (`btn-luxury btn-luxury-fill flex-1 justify-center`, `disabled` and reading `dict.product.soldOut` at zero stock, `dict.product.added` for 2.5s after a click) and the wishlist button (`size-13 border`, Lucide `<Heart size={16} strokeWidth={1.25}>`, `fill-current text-gold` when saved, `aria-pressed`, `interpolate()`'d `aria-label`).
- The confirmation timeout is cleared on unmount, and re-clicking restarts it rather than stacking timers.
- Stock line under the actions, `aria-live="polite"`: `interpolate(dict.product.lowStock, { count })` when `0 < inventory < 6`, `dict.product.soldOut` at 0, otherwise `dict.product.inStock`.
- Trust badges: three `{ title, desc }` pairs from `dict.product.trust`, `grid grid-cols-1 gap-6 border-t border-border pt-7 sm:grid-cols-3`.
- Header comment states plainly that cart and wishlist state are in-memory placeholders and names the Server Actions that will replace them.

**`QuantityStepper.tsx`** (`"use client"`) — props `{ value: number; min?: number; max: number; onChange: (next: number) => void; decreaseLabel: string; increaseLabel: string }`. Two `<button type="button">`s with Lucide `<Minus />` / `<Plus />` (`size={14} strokeWidth={1.25}`), value between them in `font-heading`. Bordered `border border-white/10 w-fit`, each control `size-11 grid place-items-center`, disabled at the bounds. Labels are passed in, so this component holds no dictionary dependency and stays reusable. Value is rendered in a `<span aria-live="polite">`.

**`ProductStory.tsx`** (server) — props `{ story: string; heading: string; island: LtrIsland }`. Splits on `\n\n`, renders `text-sm leading-loose text-ivory/55`. The page renders nothing when `story` is null; this component never receives null.

**`ProductPyramid.tsx`** (server) — props `{ tiers: { label: string; notes: string[] }[]; heading: string; island: LtrIsland }`. `grid grid-cols-1 gap-6 sm:grid-cols-3`; each column `border border-border bg-surface p-7`, a `font-heading text-[10px] uppercase tracking-[0.2em] text-gold/60` label, then notes as `flex items-center gap-2.5 text-xs text-ivory/70` rows with a `size-1 rounded-full bg-gold` marker. Taking prepared tiers rather than the whole product keeps the dictionary lookup in the page and this component purely presentational.

**`ProductIngredients.tsx`** (server) — props `{ ingredients: Ingredient[]; locale }`. Renders nothing when the array is empty. `flex flex-col gap-px`; each row `bg-surface p-6 transition-colors duration-300 hover:bg-card`, `flex flex-col gap-2 sm:flex-row sm:gap-6`. Left block (`sm:w-40 sm:shrink-0`): `name` in `font-heading text-[13px] text-ivory`, `latinName` in `text-[10px] italic text-ivory/30`, `interpolate(dict.product.ingredientOrigin, { origin })` in `text-[10px] tracking-wide text-gold/60`. Right: `facts[0]` in `text-xs leading-relaxed text-ivory/40`. Whole row is a `<LocaleLink href="/ingredients">`. All ingredient copy in an LTR island.

**`RelatedProducts.tsx`** (server) — props `{ products: ProductCardData[]; locale }`. Renders nothing when empty. `border-t border-border px-6 py-24 md:px-20 md:py-32`, centered `<Reveal>` header (`eyebrow` + `font-heading text-3xl sm:text-4xl`), then `grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3` of `<ProductCard sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />`.

**`ProductCard.tsx`** — the pill list changes from every note to one per tier:

```ts
// One note per tier keeps the card readable now that pyramids are three deep;
// the full nine-note pyramid is the PDP's job.
const notes = [product.topNotes[0], product.heartNotes[0], product.baseNotes[0]].filter(Boolean);
```

### 5. Dictionaries

Extend the existing `product` block in `en.ts` (and mirror it in `ar.ts`, translated into real Arabic, placeholders preserved):

```
product: {
  collectionLabel: "{name} Collection",        // existing, unchanged
  home: "Home",
  collections: "Collections",
  quantity: "Quantity",
  decreaseQuantity: "Decrease quantity",
  increaseQuantity: "Increase quantity",
  addToCart: "Add to Cart",
  added: "Added to Cart",
  soldOut: "Sold Out",
  inStock: "In stock — ships within 48 hours",
  lowStock: "Only {count} remaining",
  wishlistAdd: "Add {name} to wishlist",
  wishlistRemove: "Remove {name} from wishlist",
  storyHeading: "The Story",
  pyramidHeading: "Fragrance Pyramid",
  topNotes: "Top Notes",
  heartNotes: "Heart Notes",
  baseNotes: "Base Notes",
  ingredientsHeading: "Key Ingredients",
  ingredientOrigin: "From {origin}",
  gallery: { thumbnail: "View image {index} of {total}" },
  concentrations: {
    PARFUM: "Parfum",
    EXTRAIT_DE_PARFUM: "Extrait de Parfum",
    EAU_DE_PARFUM: "Eau de Parfum",
    ATTAR_OIL: "Attar Oil",
  },
  trust: {
    delivery: { title: "Complimentary Delivery", desc: "On all orders over $200" },
    packaging: { title: "Luxury Packaging", desc: "Gift-ready presentation" },
    returns:   { title: "30-Day Returns",     desc: "Unworn, sealed items" },
  },
  related: { eyebrow: "You May Also Love", heading: "Explore the Collection" },
}
```

`concentrations` is keyed by the `Concentration` union so an added enum member fails typecheck instead of printing a raw `SCREAMING_SNAKE` string.

### 6. Icons

`lucide-react` only — `ChevronRight`, `Heart`, `Minus`, `Plus`. All `strokeWidth={1.25}` per AGENTS.md §6, decorative instances `aria-hidden`. Zero hand-authored `<svg>`.

### 7. Visual & responsive contract

- **Type**: `--font-heading` for h1/h2/h3, the price, the quantity value, ingredient names, note-tier labels. `--font-body` everywhere else. Never an inline `fontFamily`.
- **Color**: tokens only — `bg-background`, `bg-surface`, `bg-card`, `text-ivory`, `text-gold`, `border-border`. No hex, no `rgba()`, no inline `style` prop anywhere in the change.
- **Layout**: main section `grid grid-cols-1 lg:grid-cols-2`. Gallery is the first column on `lg+` and sticky; on mobile it stacks on top at `aspect-4/5`. Info column `px-6 py-14 sm:px-8 lg:px-14 lg:py-20 xl:px-20`, max width `max-w-2xl` so the story column never runs to an unreadable measure on a wide screen.
- **Rhythm**: `mb-10` between purchase blocks, `mb-16` between the story / pyramid / ingredients sections, `py-24 md:py-32` for the related section — AGENTS.md §2.2 generous vertical whitespace.
- **Motion**: `<Reveal>` only, which is already tween-on-`--ease-luxury-bezier`. Hover transitions `duration-300 ease-out`; the gallery cross-fade `duration-700`. Zero spring, zero bounce, zero layout-shifting animation.
- **Breakpoints**: usable at 375 / 768 / 1024 / 1440 with no horizontal overflow.
- **RTL**: logical properties throughout (`ps-`/`pe-`, `start-`/`end-`, `gap`), `rtl:rotate-180` on the breadcrumb chevron. The stepper's −/+ order follows the writing direction naturally via flex.
- **Focus**: every interactive element has a visible `focus-visible:` state in gold. No `outline: none` without a replacement.

---

## Security requirements

1. `[locale]` and `[slug]` are untrusted input. `isLocale()` narrows the locale; the slug is only ever matched against seeded product slugs, and an unknown value takes `notFound()` — never a silent fallback render (defect #15) and never echoed into the page or its metadata.
2. No route param reaches an `href` without passing through `localizePath()` via `<LocaleLink>`, which already rejects protocol-relative and off-origin paths.
3. No `dangerouslySetInnerHTML`, no `eval`, no user-supplied HTML. The story is split on `\n\n` and rendered as text nodes.
4. The service layer stays server-only: `ProductGallery`, `ProductPurchase`, and `QuantityStepper` import neither `src/services/*` nor `src/data/*`, and receive only the narrow projections they render.
5. Remote images stay on the `images.unsplash.com` allowlist already in `next.config.ts`.
6. Cart and wishlist state are in-memory and per-session; nothing is persisted and no PII crosses a boundary in this change.
7. The price is read from stored data and formatted through `formatPrice`; no total is computed in, or trusted from, the client — that becomes the Server Action's job.

---

## Acceptance criteria

- [ ] `/perfume/kyphi-noir` renders, and so does every one of the 11 slugs, in both `en` (unprefixed) and `ar` (`/ar/...`).
- [ ] `/perfume/does-not-exist` renders the 404 page — it does **not** render Kyphi Noir.
- [ ] `src/app/[locale]/product-details/` no longer exists.
- [ ] Clicking any card on `/collections` or the home grid lands on that product's PDP.
- [ ] **There is no size selector.** Signature and Noir PDPs read `100 ML`; the three Gemstone PDPs read `50 ML`; every PDP reads `Extrait de Parfum`, never a hardcoded "Eau de Parfum".
- [ ] `/collections/gemstone` cards read `50 ML`, and their prices are unchanged from before this task.
- [ ] The quantity stepper clamps at 1 and at the product's stock ceiling.
- [ ] "Add to Cart" shows the confirmation for 2.5s and reverts; rapid clicks do not stack timers or leave it stuck.
- [ ] The wishlist heart fills gold on click, clears on a second click, and `aria-pressed` tracks it.
- [ ] Thumbnails cross-fade the main image with no layout shift; the active thumbnail is outlined and `aria-current`.
- [ ] The pyramid shows three notes per tier; ingredient rows appear only for products with a matching material.
- [ ] Related fragrances show up to 3, never the product itself, preferring its own collection.
- [ ] **Collection and home grids are visually unchanged** — same three note pills, same prices, same price sort order as before this change (the only diff is the Gemstone volume label).
- [ ] Zero `react-router-dom` imports, zero inline `style` props, zero raw hex colors, zero `<img>`, zero hand-written `<svg>` in the new code.
- [ ] Every font comes from `--font-heading` / `--font-body`; the Arabic tree renders Amiri + IBM Plex Sans Arabic, not Cinzel.
- [ ] Arabic mirrors correctly — breadcrumb chevron, stepper, wishlist button, trust grid. English catalog copy sits in `dir="ltr"` islands and keeps its tracking.
- [ ] No horizontal overflow at 375px; the gallery stacks above the info column below `lg`.
- [ ] `generateMetadata` emits a canonical plus `en` / `ar` / `x-default` alternates and a complete OpenGraph block via `localeMetadata()`.
- [ ] `generateStaticParams` prerenders 22 pages (2 locales × 11 slugs).
- [ ] Strict TypeScript, no `any`, no non-null assertions; no new file exceeds ~150 lines.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

`npm run build` is the meaningful one: it exercises `generateStaticParams`, both locale trees, and the server/client boundary.

## Manual test steps

1. `npm run dev`
2. `http://localhost:3000/collections` → click **Kyphi Noir** → lands on `/perfume/kyphi-noir`.
3. Confirm: breadcrumb `Home → Collections → Signature → Kyphi Noir`, gallery with three thumbnails, price `$295`, spec line `100 ML · Extrait de Parfum`, and **no size buttons anywhere**.
4. Click the second and third thumbnails → the main image cross-fades, the page does not jump, the active thumbnail is outlined.
5. Press **+** to 3, then **−** back to 1; confirm **−** is disabled at 1 and **+** stops at the stock ceiling.
6. Click **Add to Cart** → "✓ Added to Cart" for ~2.5s, then reverts. Click it three times quickly → it still reverts cleanly once.
7. Click the heart → fills gold. Click again → clears. Tab to it and press Enter → same, with a visible gold focus ring.
8. `http://localhost:3000/perfume/lapis-eternel` → spec line reads **`50 ML · Extrait de Parfum`**; price is `$390`, unchanged.
9. Scroll down: story paragraphs, a three-column pyramid with three notes each, key ingredients (Oud and Frankincense both appear for Kyphi Noir), then three related fragrances — none of them the product itself.
10. Click a related card → its PDP loads with its own gallery, price, and pyramid.
11. `http://localhost:3000/perfume/does-not-exist` → the KHEM 404 page, not a product.
12. `http://localhost:3000/ar/perfume/kyphi-noir` → Arabic chrome (breadcrumb, "الكمية", "أضف إلى السلة", pyramid labels, trust badges), layout mirrored, breadcrumb chevron pointing left, wishlist button on the left of the actions row. Product name, notes, and ingredient copy stay English and stay left-to-right.
13. Switch language from `/ar/perfume/kyphi-noir` with the switcher → lands on `/perfume/kyphi-noir`, same product.
14. DevTools responsive: 375px (gallery stacked above info, no horizontal scrollbar), 768px (same, roomier), 1440px (two columns, gallery sticky while the right column scrolls past it).
15. View source on `/ar/perfume/kyphi-noir` → `<html lang="ar" dir="rtl">`, `<link rel="canonical" href="/ar/perfume/kyphi-noir">`, `hreflang` for `en` / `ar` / `x-default`, `og:locale` `ar_EG`.
16. Re-check `/collections` and `/` → note pills, prices, and the price sort order are exactly as they were before this change; only the Gemstone cards' volume label differs (`50 ML`).
