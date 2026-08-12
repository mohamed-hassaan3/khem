# Prompt — Transform `/collections` into a localized Next.js App Router route, add the GEMSTONE collection

## Goal

Rewrite `src/app/[locale]/collections/page.tsx` — currently a `react-router-dom` SPA component pasted into the App Router tree — as a production-grade Next.js 16 **Server Component**, matching the idiom already established by `src/app/[locale]/journal/page.tsx` and `src/app/[locale]/page.tsx`.

Three things ship together, because they are the same page:

1. **The transform** — theme tokens instead of raw hexes, `--font-heading` instead of inline `'Cinzel', serif`, `next/image`, `<LocaleLink>`, `<Reveal>`, responsive layout, real metadata, ISR.
2. **A third collection — GEMSTONE — with three products.** The catalog becomes `SIGNATURE · NOIR · GEMSTONE`.
3. **Full EN/AR support** — dictionary-driven chrome, RTL-correct, LTR islands around English catalog records.

Plus: every hand-rolled `<svg>` is replaced with a `lucide-react` icon.

---

## Skills read

- `AGENTS.md` — §1 core rules, §2.2 visual language, §3 tokens, §6 stack, §7 structure, §8 routing matrix, §9 schema, §12 checklist.
- No `.agents/skills/*` skill applies: this route has no Clerk auth, no Supabase call, no AI SDK usage. The session hook suggested `ai-sdk` and `vercel-services` on a lexical match against the word "collections" — neither is relevant to a catalog listing page, and neither is invoked.
- Next.js patterns verified against the installed `next@16.2.12` and the existing routes, not from memory.

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/app/[locale]/collections/page.tsx` | 172 lines, untracked. Imports `react-router-dom` (**not installed** — the route cannot build). `useEffect`/`useRef`/`useState` with no `'use client'`. Hardcodes its own 8-product `ALL_PRODUCTS` array. All styling is inline `style` objects with raw hexes. Raw `<img>`. Hand-rolled `IntersectionObserver`. Inline `<svg>` heart. Desktop-only padding (`0 80px`). |
| `src/app/[locale]/journal/page.tsx` | The reference idiom for a listing route: `generateMetadata` → `localeMetadata()`, `Promise.all([params, …services])`, `isLocale()` narrowing, `ltrIsland()`, `readingArrow()`, `<Reveal>`, server page + one client component for the interactive filter. |
| `src/components/journal/JournalGrid.tsx` | Precedent for **client-side** filtering: driving it from `?category=` would opt the route out of ISR. Same reasoning applies to sorting here. |
| `src/components/ecommerce/ProductCard.tsx` | Async Server Component taking the narrow `ProductCardData` projection. Renders image, `product.collectionLabel`, name, subtitle, note pills, price, volume. Already localized and already wraps catalog text in `ltrIsland()`. |
| `src/components/home/CollectionCard.tsx` | Server Component; `tone` prop (`standard` \| `dark`) already documented as "so a third collection can pick a treatment without editing this component" — exactly the case now arriving. |
| `src/services/products.ts` | Query seam. Has `getFeaturedCollections`, `getFeaturedProducts`, `getProductBySlug`, `getFeaturedProduct`. Each carries the Supabase query it will become. No "list by collection" function exists yet. |
| `src/data/products.ts` | Seed data. **2 collections, 4 products** — the SPA page listed 8. |
| `src/types/catalog.ts` | `Collection`, `Product`, `ProductCardData` mirror the Prisma models in AGENTS.md §9. No change needed. |
| `src/lib/i18n/*` | `localizePath`, `localeAlternates`, `isLocale`; `localeMetadata()`; `getDictionary()`; `interpolate()`; `ltrIsland()` / `readingArrow()`. |
| `src/lib/format.ts` | `formatPrice` (cents → `$295`), `formatVolume` (`100 ML`). |
| `src/constants/navigation-pages.ts` | `collections` array: `signature`, `noir`, `discovery`, `bodyCare`, `roomFragrance`, keyed into `Dictionary["nav"]["collectionItems"]`. |
| `src/app/globals.css` | `@theme` tokens, `.eyebrow`, `.gold-line`, `.btn-luxury`, `.note-pill`, `.img-zoom`; the RTL tracking reset and the `[lang="ar"]` optical-size compensation, both scoped to skip `[dir="ltr"]` islands. |
| `next.config.ts` | `images.remotePatterns` already allows `images.unsplash.com` — no config change. |
| `package.json` | `next 16.2.12`, `react 19.2.4`, `motion 13`, `lucide-react ^1.30.0`. No `react-router-dom`, no `clsx`. |

### Defects in the current file

1. `react-router-dom` import — not installed; the route fails to build.
2. `useEffect`/`useRef`/`useState` without `'use client'` — invalid in a Server Component.
3. Catalog data hardcoded in the page, bypassing `src/services/products.ts` and contradicting AGENTS.md §6 ("UI must display stored data only").
4. Raw `<img>` for the hero and every card — no optimization, no `sizes`, no LCP `priority`, plus an `@next/next/no-img-element` lint error.
5. Every color is an inline hex/rgba instead of a theme token; `fontFamily: "'Cinzel', serif"` bypasses the `--font-heading` variable that `next/font` sets, so the Arabic tree would render Cinzel (which has no Arabic glyphs).
6. Not responsive — `padding: '0 80px'`, `gridTemplateColumns: 'repeat(3, 1fr)'`, no breakpoints.
7. Hand-rolled `IntersectionObserver` duplicates `<Reveal>` and never unobserves individual targets.
8. `onMouseEnter`/`onMouseLeave` handlers doing style mutation where CSS `:hover` (and the existing `.img-zoom`) suffices.
9. Hardcoded English (`"Home"`, `"SORT BY"`, `"Fragrances"`, `"Noir · Limited"`) and a hardcoded `/` breadcrumb separator that reads backwards in RTL.
10. `{p.size} / 100ML` prints "50ml / 100ML" — a real display bug.
11. Inline `<svg>` heart instead of a Lucide icon.
12. No `metadata`, no canonical, no `hreflang`, no `revalidate`.
13. `<select>` with `appearance: none` and no chevron affordance, and no accessible label — only a floating `SORT BY` span.

---

## Decisions and assumptions

1. **Two routes, not one.** The SPA read `useParams().collection` off a single component. In the App Router that is `/collections` (overview, all fragrances) plus `/collections/[slug]` (one collection). `CollectionCard` and `Nav.tsx` already link to `/collections/<slug>`, so the dynamic route is what makes those links resolve. AGENTS.md §8 names the path `/collection/[slug]`; the **existing links win** — `/collections/[slug]` — because changing them is a separate, larger edit. Flagged for you.
2. **Shared body, thin routes.** Both routes render one `<CollectionView>` server component; the two `page.tsx` files only resolve params, metadata, and data.
3. **Caching**: `/collections` → `revalidate = 3600` (static-leaning, matches the ISR-1h editorial routes). `/collections/[slug]` → `revalidate = 600`, per the §8 "ISR 10m" row for a collection page. `generateStaticParams` prerenders every collection slug.
4. **Sorting stays client-side**, on the `JournalGrid` precedent: a `?sort=` search param would opt the route out of ISR.
5. **Cards are rendered on the server and *reordered* on the client.** `ProductCard` is an async Server Component; duplicating its markup inside a client component would fork the card design. Instead the page renders each card and passes `{ id, priceInCents, card: ReactNode }` into the client grid, which sorts the array and renders the nodes. No catalog logic, no service import, and no card markup crosses the client boundary.
6. **Wishlist is local `useState` only** — exactly the SPA's behaviour. There is no `Wishlist` service, no Clerk session, and no `/wishlist` route yet. The button is fully accessible (`aria-pressed`, localized `aria-label`) so wiring it to a Server Action later is a one-function change. Documented in-file as a placeholder.
7. **GEMSTONE is `isFeatured: false`.** The home grid is `md:grid-cols-2` under the heading "Two Worlds of Scent" (`home.collections.heading`); a third featured card would leave a ragged row and contradict its own heading. Gemstone therefore appears on `/collections`, in the tab bar, and in the Nav mega-menu, but not in the home preview. Say the word and I will instead promote it and rewrite that heading in both locales.
8. **The four products the SPA listed but the seed data lacks are ported.** `isis-rose`, `anubis-ombre`, `lotus-blanc`, `horus-gold` exist in the page's `ALL_PRODUCTS` but not in `src/data/products.ts`. They are part of the design being transformed, so they move into the seed data (with `isBestseller: false`, so the home page's bestseller grid is untouched). Catalog after this change: **11 products across 3 collections.**
9. **Note pyramids** follow the file's existing convention — the three display notes assigned top → heart → base in order, with the same "replace with the perfumer's real pyramid" caveat.
10. **Prices are in cents** (`priceInCents`), never the SPA's bare `295`. All display goes through `formatPrice`.
11. **Volume**: the SPA's `size` field is dropped; `volumeMl` is the schema field and `formatVolume` the renderer. This fixes defect #10.
12. **Only new Unsplash URLs already present in the repo are used** — inventing a photo slug would 404 through `next/image`.
13. **Catalog text stays English in both locales**, per the note at the top of `dictionaries/en.ts`. Collection names, product names, descriptions, and notes are wrapped in `ltrIsland()`; page chrome is translated.
14. **No new dependencies.**

---

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/data/products.ts` | **+1 collection** (`gemstone`), **+7 products** (4 ported from the SPA, 3 new gemstone). |
| `src/services/products.ts` | **+3 functions**: `getCollections()`, `getCollectionBySlug(slug)`, `getProductCardsByCollection(slug?)`. Each with its future Supabase query in a comment, matching the file's convention. |
| `src/app/[locale]/collections/page.tsx` | Full rewrite → Server Component, overview of all fragrances. |
| `src/app/[locale]/collections/[slug]/page.tsx` | **New** — dynamic collection route + `generateStaticParams` + `notFound()`. |
| `src/components/ecommerce/CollectionView.tsx` | **New** — shared server-rendered page body (hero, breadcrumb, description bar, tabs, grid). |
| `src/components/ecommerce/CollectionGrid.tsx` | **New** — `"use client"`. Sort control + wishlist buttons; reorders server-rendered card nodes. |
| `src/lib/i18n/dictionaries/en.ts` | **+`collections` block**, **+`nav.collectionItems.gemstone`**. |
| `src/lib/i18n/dictionaries/ar.ts` | Same keys, translated (a missing key is a compile error). |
| `src/constants/navigation-pages.ts` | **+`{ key: "gemstone", path: "/collections/gemstone" }`** after `noir`. |

Not touched: `src/types/catalog.ts`, `ProductCard.tsx`, `CollectionCard.tsx`, `globals.css`, `next.config.ts`, `src/app/[locale]/page.tsx`.

---

## Implementation requirements

### 1. Data — `src/data/products.ts`

**New collection**, appended after `noir`:

```ts
{
  id: "gemstone",
  name: "Gemstone",
  slug: "gemstone",
  description:
    "Mineral light made wearable. Three fragrances cut from the stones the Egyptians buried with their kings — lapis, carnelian, turquoise.",
  bannerUrl: "https://images.unsplash.com/photo-1738664926482-1a986adb3e6c?w=900&h=1200&fit=crop&auto=format",
  bannerAlt: "A faceted flacon throwing coloured light across dark stone",
  isFeatured: false,
}
```

**Three gemstone products** (`EXTRAIT_DE_PARFUM`, `volumeMl: 100`, SKU pattern `KHEM-GEM-XXX-100`):

| slug | name | subtitle | top / heart / base | price | inventory | image |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `lapis-eternel` | Lapis Éternel | The blue of the burial mask | Blue Iris / Violet Leaf / Ambergris | `39000` | 10 | `photo-1709662369957-0cbf9f8452fc` |
| `carnelian-ember` | Carnelian Ember | Warm stone, warmer skin | Pink Pepper / Red Amber / Cedarwood | `36000` | 14 | `photo-1747696766706-5485b39bf358` |
| `turquoise-nefer` | Turquoise Néfer | Mined from the Sinai | Neroli / Sea Salt / White Musk | `34000` | 16 | `photo-1718728593303-94ec0352cf3d` |

All three: `isBestseller: false`, `collectionSlug: "gemstone"`, one `isPrimary` image at `w=600&h=800&fit=crop&auto=format`, with a written `alt`. `story: null` except `lapis-eternel`, which gets a two-sentence editorial story in the register of `kyphi-noir`.

**Four ported products**, copy preserved verbatim from the SPA array:

| slug | name | collection | top / heart / base | price |
| :--- | :--- | :--- | :--- | :--- |
| `isis-rose` | Isis Rose | signature | Rose Absolute / Neroli / Sandalwood | `31000` |
| `anubis-ombre` | Anubis Ombre | noir | Dark Oud / Labdanum / Smoke | `46000` |
| `lotus-blanc` | Lotus Blanc | signature | White Lotus / Aquatic Musk / Cedar | `27500` |
| `horus-gold` | Horus Gold | signature | Saffron / Gold Accord / Amber Resin | `34500` |

Each keeps its SPA image URL, gets its SPA `desc` as `description`, a `subtitle`, a real `sku`, an `inventory`, `isBestseller: false`, `story: null`.

### 2. Services — `src/services/products.ts`

```ts
export async function getCollections(): Promise<Collection[]>
// → supabase.from('Collection').select('*').order('name')

export async function getCollectionBySlug(slug: string): Promise<Collection | null>
// → supabase.from('Collection').select('*').eq('slug', slug).maybeSingle()
//    Returns null, never throws — the route renders notFound().

export async function getProductCardsByCollection(collectionSlug?: string): Promise<ProductCardData[]>
// → …select(<explicit column list>).eq('isArchived', false).is('deletedAt', null)
//    with an optional .eq('collectionSlug', …)
```

`getProductCardsByCollection` reuses the module's existing `toCardData` / `resolvePrimaryImage` helpers and the `collectionNameBySlug` map. No new types.

### 3. `CollectionView` — server component

Props: `{ locale: Locale; collection: Collection | null; products: ProductCardData[]; collections: Collection[] }`. `collection === null` means "all fragrances".

**Hero** — `relative min-h-[420px] h-[60vh]`, `flex items-end`, `overflow-hidden`:
- `next/image` `fill`, `priority`, `sizes="100vw"`, `quality={85}`. Source: `collection.bannerUrl`, or `photo-1738664926458-d8ca7f56549f` (the SPA's "all" hero) when null. Grading: `brightness-[0.3] saturate-[0.6]` for `noir`, `brightness-[0.45] saturate-[0.6]` otherwise — the same split the SPA made, expressed as tokens.
- Gradient scrim: `bg-linear-to-t from-background via-background/40 to-transparent`.
- **Breadcrumb**: `<LocaleLink href="/">` (dict) → lucide `<ChevronRight className="rtl:rotate-180" size={12} strokeWidth={1.25} aria-hidden />` → current page as `<span aria-current="page">`. Replaces the literal `/`, which points the wrong way in Arabic.
- Eyebrow: `interpolate(dict.collections.countLabel, { count })`.
- `<h1 className="font-heading text-4xl sm:text-6xl md:text-7xl font-normal text-ivory">`, wrapped in `{...island}` when it prints a data-sourced collection name.
- Padding `px-6 pb-14 md:px-20 md:pb-18`.

**Description + sort bar** — `border-b border-border`, `px-6 py-10 md:px-20`, `mx-auto max-w-350`, `flex flex-col gap-6 md:flex-row md:items-center md:justify-between`. Description text (`text-[13px] leading-loose text-ivory/40 max-w-lg`) from `collection.description` (in an LTR island) or `dict.collections.all.description`. The sort control is a slot filled by the client grid.

**Tab bar** — always rendered (the SPA hid it on collection pages, which stranded the visitor). `All` + one tab per collection, from `collections`, so a fourth collection needs no edit here. `<LocaleLink>` to `/collections` and `/collections/<slug>`, styling copied from `JournalGrid`'s tabs: `border-b-2 py-5 font-heading text-[11px] tracking-[0.2em]`, active = `border-gold text-gold`, inactive = `border-transparent text-ivory/40 hover:text-ivory/70`. Active tab carries `aria-current="page"`. Horizontally scrollable (`overflow-x-auto`, `whitespace-nowrap`).

**Grid** — `px-6 py-16 md:px-20 md:pb-36`, `mx-auto max-w-350`, `<Reveal>` wrapper, `grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3`. Each `<ProductCard sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />`. Empty state: centered `dict.collections.empty`.

### 4. `CollectionGrid` — `"use client"`

```ts
export interface CollectionGridItem {
  id: string;
  name: string;          // for the wishlist aria-label
  priceInCents: number;  // the sort key
  card: React.ReactNode; // server-rendered <ProductCard>
}
```

- `useState<SortKey>("featured")`; `"featured"` preserves the incoming order, `"price-asc"` / `"price-desc"` sort a **copy** (never mutate the prop array).
- Sort control: `<label className="sr-only">` + `<select>` on a `relative` wrapper with a lucide `<ChevronDown size={14} strokeWidth={1.25} className="pointer-events-none absolute … text-gold/60" />`, positioned with `end-3` so it flips in RTL. Select styling: `bg-white/4 border border-white/10 text-ivory font-heading text-[11px] tracking-[0.1em] px-4 py-2.5 pe-9 appearance-none cursor-pointer focus-visible:outline-none focus-visible:border-gold`. Option labels from `dict.collections.sortOptions`.
- Wishlist button, one per card, `absolute top-5 end-5 z-2` (logical inset so it mirrors in RTL): `size-9 grid place-items-center bg-background/70 border border-white/10 hover:border-gold transition-colors`, holding a lucide `<Heart size={14} strokeWidth={1.25} />` with `fill="currentColor"` + `text-gold` when saved, `text-ivory/50` when not. `type="button"`, `aria-pressed`, `aria-label` = `interpolate(dict.collections.wishlistAdd | wishlistRemove, { name })`. Sits in a `relative` wrapper **around** the card node, so the card stays a server component.
- Reads `useDictionary()` / `useLocale()`. Imports no service and no data module.

### 5. Dictionaries

New `collections` block in `en.ts` (and the Arabic mirror in `ar.ts`):

```
collections: {
  meta: { title, description, ogTitle, ogDescription },
  all: { name: "All Fragrances", description: "The complete KHEM library. Every fragrance is a chapter in an ancient story." },
  home: "Home",
  countLabel: "{count} Fragrances",
  sortBy: "Sort By",
  sortOptions: { featured: "Featured", priceAsc: "Price: Low to High", priceDesc: "Price: High to Low" },
  tabAll: "All",
  wishlistAdd: "Add {name} to wishlist",
  wishlistRemove: "Remove {name} from wishlist",
  empty: "New fragrances are being prepared. Please return shortly.",
}
```

Plus `nav.collectionItems.gemstone: { label: "Gemstone Collection", desc: "Mineral light made wearable" }` in both files. Arabic copy is written as Arabic, not transliterated English; `countLabel` keeps the `{count}` placeholder.

### 6. Icons

`lucide-react` only — `Heart`, `ChevronDown`, `ChevronRight`. All at `strokeWidth={1.25}` per AGENTS.md §6, all decorative instances `aria-hidden`. Zero hand-authored `<svg>` in the new code.

---

## Security requirements

1. `[slug]` and `[locale]` are untrusted input. `isLocale()` narrows the locale; the slug is only ever compared against seeded collection slugs — an unknown value takes `notFound()`, never a lookup echoed into the page.
2. No route param is interpolated into an `href` without passing through `localizePath()`, which already rejects protocol-relative and off-origin paths.
3. No `dangerouslySetInnerHTML`, no `eval`, no user-supplied HTML.
4. The service layer stays server-only — `CollectionGrid` imports neither `src/services/*` nor `src/data/*`.
5. Remote images stay on the `images.unsplash.com` allowlist already in `next.config.ts`.
6. Wishlist state is in-memory and per-session; nothing is persisted, so no PII crosses a boundary in this change.

---

## Acceptance criteria

- [ ] `/collections`, `/collections/signature`, `/collections/noir`, `/collections/gemstone` all render, in both `en` (unprefixed) and `ar` (`/ar/...`).
- [ ] `/collections/does-not-exist` renders the 404 page.
- [ ] `/collections` lists 11 products; signature 5, noir 3, gemstone 3.
- [ ] Sorting by price ascending / descending reorders the grid; "Featured" restores the original order.
- [ ] The wishlist heart fills gold on click and clears on a second click; `aria-pressed` tracks it.
- [ ] Zero `react-router-dom` imports, zero inline `style` props, zero raw hex colors, zero `<img>`, zero hand-written `<svg>` in the new code.
- [ ] Every font comes from `--font-heading` / `--font-body`; the Arabic tree renders Amiri + IBM Plex Sans Arabic, not Cinzel.
- [ ] Arabic: page mirrors correctly — breadcrumb chevron, wishlist button inset, select chevron, tab scroll all follow `dir`. English catalog copy sits in `dir="ltr"` islands and keeps its tracking.
- [ ] No horizontal overflow at 375px; grid is 1 → 2 → 3 columns.
- [ ] `generateMetadata` emits a canonical plus `en` / `ar` / `x-default` alternates and a complete OpenGraph block via `localeMetadata()`.
- [ ] `generateStaticParams` prerenders every locale × collection pair.
- [ ] The home page, Nav, and Footer are visually unchanged, except that the Collections mega-menu gains a Gemstone entry.
- [ ] Strict TypeScript, no `any`, no non-null assertions.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

`npm run build` is the meaningful one: it exercises `generateStaticParams`, both locale trees, and the server/client boundary.

## Manual test steps

1. `npm run dev`
2. `http://localhost:3000/collections` — 11 cards, hero, breadcrumb, tab bar with **All · Signature · Noir · Gemstone**, "All" active.
3. Change **Sort By** to *Price: Low to High* → Lotus Blanc ($275) first. To *High to Low* → Anubis Ombre ($460) first. Back to *Featured* → seed order.
4. Click the heart on two cards → both fill gold. Click one again → it clears. Tab to a heart and press Enter → same result; confirm the focus ring is visible.
5. Click the **Gemstone** tab → `/collections/gemstone`, 3 cards, gemstone hero and description, Gemstone tab active.
6. Click **Noir** → hero is visibly darker than Signature's (the `tone` split).
7. Click a card → `/perfume/<slug>` (that route does not exist yet → 404; the link target is what matters here).
8. `http://localhost:3000/ar/collections` — Arabic chrome (breadcrumb, count, "فرز حسب", tabs), layout mirrored, chevron pointing left, wishlist button top-**left**. Product names and notes stay English and stay left-to-right inside their blocks.
9. Switch language with the switcher from `/ar/collections/gemstone` → lands on `/collections/gemstone`, same collection.
10. DevTools responsive: 375px (1 column, no horizontal scrollbar), 768px (2), 1440px (3).
11. View source on `/ar/collections` → `<html lang="ar" dir="rtl">`, `<link rel="canonical" href="/ar/collections">`, `hreflang` for `en`, `ar`, `x-default`, and `og:locale` `ar_EG`.
12. Nav → Collections mega-menu shows the Gemstone entry and it routes correctly.
