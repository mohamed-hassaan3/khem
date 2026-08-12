# New Arrivals, Gift Sets & Catalog-Wide Filtering on `/collections`

## Goal

Three connected pieces of work:

1. **`/collections` becomes the one place that holds every product.** Today it lists
   fragrances only. It gains a merchandising **facet filter** row — All, New Arrivals,
   Best Sellers, Limited Editions, Gift Sets, Body Care, Home Fragrance, Discovery Sets —
   on top of the existing collection tab bar, so a visitor can reach any product in the
   catalog from one screen without hunting the nav.
2. **`/new-arrival`** (currently an empty file) becomes a *showroom* page: a dedicated,
   cinematic presentation of the fragrances flagged as new — two of them, added to the
   catalog as part of this work.
3. **`/gift-set`** (currently an empty file) presents **three** gift sets, added to the
   catalog as part of this work, with the set-card treatment `/discovery` already uses.

Both new routes are linked from the Nav mega-menu, the mobile drawer, and the Footer,
which currently point "New Arrivals" and "Gift Sets" at `/collections` and `/discovery`.

## Skills read

- `AGENTS.md` §1 (agent rules), §2 (workflow), §3 (design tokens), §6 (stack), §8 (routing
  matrix), §9 (Prisma schema), §12 (checklist).
- No `.agents/skills/*` skill applies: this task touches no Clerk, Supabase, or AI SDK
  surface. (The session hook suggested `ai-sdk` / `chat-sdk` on a lexical match — a false
  positive, no AI code is involved.)
- Next.js App Router conventions as already practised in this repo (`generateStaticParams`,
  `revalidate`, Server Components by default, `'use client'` only for state).

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `src/types/catalog.ts` | `CollectionKind = FRAGRANCE \| BODY \| HOME \| DISCOVERY`, `Product`, `ProductCardData` projection. |
| `src/data/products.ts` | The only hardcoded catalog. 6 collections, 15 products. Documents that **every Unsplash id must already be vetted** — invented ids 404 through `next/image`. |
| `src/services/products.ts` | The query seam. Every UI read goes through a function here; each carries the Supabase query it will become. |
| `src/lib/routes.ts` | `productHref()` — exhaustive `switch` on `CollectionKind`; a new kind is a compile error here, by design. |
| `src/components/ecommerce/CollectionView.tsx` | Server body shared by `/collections` and `/collections/[slug]`: hero, breadcrumb, description, tab bar, grid. |
| `src/components/ecommerce/CollectionGrid.tsx` | Client: sort state + wishlist overlay over server-rendered card nodes. Sort is client-side deliberately, to keep the route on ISR. |
| `src/components/ecommerce/ProductCard.tsx` | Server card. Currently hardcodes `href={`/perfume/${slug}`}`. |
| `src/components/ecommerce/CategoryHero.tsx` | Shared hero for `/body-care`, `/room-fragrance`, `/discovery`. |
| `src/components/ecommerce/DiscoverySetCard.tsx` | Client set card: badge, `includes` list, add-to-cart, wishlist. Kind-agnostic. |
| `src/components/ecommerce/MerchGrid.tsx` | Precedent for a client-side, data-derived filter bar that hides itself when there is nothing to filter. |
| `src/components/ecommerce/FeatureTriptych.tsx` | Three-up icon/step band used by `/body-care` and `/discovery`. |
| `src/app/[locale]/{body-care,room-fragrance,discovery}/page.tsx` | The category-page template: `revalidate = 3600`, `generateStaticParams`, `generateMetadata` via `localeMetadata`, `notFound()` when the collection is missing. |
| `src/components/Nav.tsx`, `src/components/Footer.tsx`, `src/constants/navigation-pages.ts` | Nav structure is routes-only; labels are dictionary lookups keyed by `key`, so an untranslated entry is a compile error. |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | `ar` must mirror `en` exactly — `Dictionary` is derived from `en`. |

## Decisions & assumptions

1. **`/collections` widens to the whole catalog.** The current fragrance-only scope is
   documented in `services/products.ts` ("listing them beside Signature and Noir would
   offer two URLs for the same goods"). The user has explicitly asked for all products in
   one place, so that rationale is superseded for the *overview* only. The **collection tab
   bar stays fragrance-only** (Signature / Noir / Gemstone → the existing
   `/collections/[slug]` routes); the non-fragrance goods are reachable through the new
   facet row, and their dedicated routes (`/body-care`, `/room-fragrance`, `/discovery`,
   `/gift-set`) remain the canonical URLs. `/collections/[slug]` is untouched and stays
   fragrance-scoped, so no second URL for a body mist is created.
2. **One card design in that grid.** Non-fragrance goods render as `<ProductCard>` too,
   with `productHref()` supplying the link, so a gift set card in the overview links to
   `/gift-set` where it can be bought. Reusing `<MerchCard>` / `<DiscoverySetCard>` there
   would put a second wishlist heart under `<CollectionGrid>`'s overlay heart.
3. **Facets are a URL param, not local state.** `?facet=best-sellers` is read on the
   *client* with `useSearchParams`, so the route stays prerendered/ISR (the same reason
   sort is client-side) while Nav and Footer can deep-link "Best Sellers" and "Limited
   Editions". The component reading it is wrapped in `<Suspense>`, as Next requires for
   `useSearchParams` on a statically rendered page.
4. **Facet source of truth.** `isBestseller` already exists (AGENTS.md §9) and stays the
   source for Best Sellers; category facets derive from `collectionKind`. Only the two
   genuinely new flags need storage, so `Product` gains
   `tags: ProductTag[]` with `ProductTag = "NEW_ARRIVAL" | "LIMITED_EDITION"` — a
   `String[]` column exactly like `topNotes`, becoming a Postgres enum array. One helper,
   `productFacets()`, is the only place these three inputs are combined.
5. **Gift sets are a new `CollectionKind`, `GIFT`.** They are not discovery vials and must
   not route to `/discovery`; adding the member makes `routes.ts` fail to compile until
   `/gift-set` is wired, which is the intended safety net documented there.
6. **New products are real catalog rows**, not page-local fixtures — that is what puts the
   two arrivals on `/collections`, gives them `/perfume/[slug]` detail pages for free, and
   lets both new pages' cards go through cart and wishlist.
7. **Imagery: existing vetted Unsplash ids only.** `src/data/products.ts` states plainly
   that an invented photo slug 404s. The repo already carries 31 distinct vetted ids;
   the new products and the gift-set banner reuse ids from that pool, picking ones not
   already used as another product's primary image where possible. Flagged for the user:
   photography can be swapped for bespoke shots later by editing `src/data/products.ts`
   alone.
8. **Copy is English + Arabic in the dictionaries**, never inline — the two trees are type-locked.

## Files likely to change

**Types / data / services**
- `src/types/catalog.ts` — add `GIFT` to `CollectionKind`; add `ProductTag`; add `tags` to
  `Product` and to the `ProductCardData` pick.
- `src/lib/routes.ts` — `CATEGORY_PATH.GIFT = "/gift-set"`.
- `src/lib/facets.ts` *(new)* — `ProductFacet` union, `productFacets(card)`,
  `FACET_ORDER`, and the `?facet=` param name. One module both the grid and the nav read.
- `src/data/products.ts` — `tags: []` on all 15 existing products; `LIMITED_EDITION` on the
  Noir fragrances and `The Noir Initiation`; a `gift-set` collection (`kind: "GIFT"`);
  **2 new fragrances** tagged `NEW_ARRIVAL`; **3 new gift-set products** with
  `includes`, `format`, `badge`.
- `src/services/products.ts` — `getCatalogProductCards()` (every kind, for the overview)
  and `getNewArrivalProductCards()`; both carry their future Supabase query in the doc
  comment, as every function there does.

**Components**
- `src/components/ecommerce/ProductCard.tsx` — link via `productHref()`; when a product has
  no note pyramid, show its `format` line in place of the note pills so a set or a body
  oil does not render an empty row.
- `src/components/ecommerce/CollectionGrid.tsx` — optional `facets` prop; facet chip row;
  `?facet=` read/write; filtering applied before sorting; empty state per facet.
- `src/components/ecommerce/CollectionView.tsx` — pass facets for the overview only; a
  neutral count label when the list is not fragrances-only; `<Suspense>` boundary.
- `src/components/ecommerce/ArrivalShowcase.tsx` *(new)* — the `/new-arrival` editorial panel.
- `src/components/ecommerce/NewArrivalHero.tsx` *(new)* — the showroom hero.

**Routes**
- `src/app/[locale]/collections/page.tsx` — `getCatalogProductCards()`.
- `src/app/[locale]/new-arrival/page.tsx` *(empty → implemented)*.
- `src/app/[locale]/gift-set/page.tsx` *(empty → implemented)*.

**Navigation & copy**
- `src/constants/navigation-pages.ts` — `newArrival` → `/new-arrival`, `giftSet` → `/gift-set`.
- `src/components/Nav.tsx` — quick-access links repointed to the real destinations.
- `src/components/Footer.tsx` — "New Arrivals" → `/new-arrival`, "Best Sellers" → the facet URL.
- `src/lib/i18n/dictionaries/en.ts` + `ar.ts` — new `newArrival` and `giftSet` sections,
  `collections.facets.*`, `collections.countLabelAll`, two new `nav.collectionItems` entries.

## Implementation requirements

### 1. Facet model (`src/lib/facets.ts`)

```ts
export type ProductFacet =
  | "new-arrivals" | "best-sellers" | "limited"
  | "gift-sets" | "discovery-sets" | "body-care" | "home-fragrance";
```

- `productFacets(card: ProductCardData): ProductFacet[]` — `NEW_ARRIVAL` tag →
  `new-arrivals`; `isBestseller` → `best-sellers`; `LIMITED_EDITION` tag → `limited`;
  `collectionKind` `GIFT`/`DISCOVERY`/`BODY`/`HOME` → its category facet. A `switch` on
  the kind, exhaustive, so a sixth kind fails to compile.
- `FACET_ORDER` fixes the chip order; the grid renders only facets that match at least one
  product in hand, so an emptied facet cannot leave a dead chip (the `<MerchGrid>` rule).
- `FACET_PARAM = "facet"`, plus `facetHref(facet)` returning `/collections?facet=…` for Nav
  and Footer.

### 2. `/collections` filtering

- `CollectionGrid` gains `facets?: { key: ProductFacet; label: string }[]` and each
  `CollectionGridItem` gains `facets: ProductFacet[]`.
- Active facet = `useSearchParams().get("facet")`, validated against `FACET_ORDER`
  (an unknown value falls back to "All" rather than an empty grid). Chips call
  `router.replace(href, { scroll: false })` — replace, not push, so the Back button leaves
  the page rather than walking the filter history.
- Filter → then sort. Both memoised.
- Chip visuals: the existing tab idiom — `font-heading text-[11px] tracking-[0.2em]`,
  active `border-gold text-gold`, inactive `text-ivory/40 hover:text-ivory/70`,
  `transition-colors duration-300 ease-out`, horizontal scroll on narrow screens, a
  labelled `<nav aria-label>` with `aria-pressed` on each chip.
- The row sits **below** the collection tab bar, visually separated by `bg-surface` (the
  `<MerchGrid>` filter bar treatment) so the two rows never read as one bar.
- Facets render on the overview only (`collection === null`).
- Count label: `collections.countLabelAll` ("{count} Pieces") on the overview,
  the existing "{count} Fragrances" on a collection page.

### 3. `/new-arrival` — the showroom

Sections, top to bottom:

1. **Hero** (`NewArrivalHero`): full-bleed vetted Unsplash photograph, `brightness-25
   saturate-60`, a `bg-linear-to-t from-background` scrim, centred stack — eyebrow
   ("Just Arrived · 2026"), display title in two lines with the second in gold, a
   `gold-line`, one paragraph, and a small "Two new fragrances" counter. `priority` +
   `sizes="100vw"` on the image; `h-[78vh] min-h-140`.
2. **Showcase** (`ArrivalShowcase`, one per product, alternating side): a 12-column grid at
   `lg`, image occupying 7 and copy 5, sides swapping on the second entry via a prop.
   Image is `aspect-4/5`, inside a thin gold hairline frame offset by ~14px, with the
   `img-zoom` hover already used by the cards. Copy column: an index numeral
   (`01 — 02`) in gold `font-heading`, the name at `text-4xl md:text-5xl`, subtitle,
   story paragraph, a three-column note pyramid (Top / Heart / Base, one line each), the
   price + volume row, and a `btn-luxury` "Discover the Fragrance" linking to
   `/perfume/[slug]`. Wrapped in `<Reveal>` with a small stagger.
3. **Closing band**: gold-bordered strip with the "explore the full library" line and a
   ghost button to `/collections?facet=new-arrivals`.

Rules: Server Component throughout (no state), `py-24 md:py-32` rhythm, ivory/gold tokens
only, no spring/bounce, product copy wrapped in `ltrIsland(locale)` like every other
data-sourced string, `notFound()` if the query returns no arrivals.

### 4. `/gift-set`

Follows the `/discovery` template exactly — that is the point, it is the same class of page:

1. `<CategoryHero>` fed from the `gift-set` collection's banner, with `note` carrying the
   complimentary-wrapping line.
2. A three-up `<DiscoverySetCard>` grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`,
   `gap-px bg-border`), each in a `<Reveal delay={(i % 3) * 0.1}>`, empty state from the
   dictionary.
3. `<FeatureTriptych>` — "The KHEM Gift Ritual": lacquered presentation box, hand-written
   card, gift receipt / delivery timing. Lucide icons at `strokeWidth={1.25}`.

`revalidate = 3600`, `generateStaticParams` over `LOCALES`, `generateMetadata` via
`localeMetadata`, `notFound()` when the collection is absent — identical to its siblings.

### 5. Catalog additions

**Two new fragrances** (full `Product` rows: pyramid three deep per tier with the signature
note first, `story`, three images with one `isPrimary`, honest `sku`/`inventory`/`volumeMl`
matching the collection's bottle format, `tags: ["NEW_ARRIVAL"]`) — one in **Signature**
(warm, resinous, the season's headline) and one in **Noir**
(`tags: ["NEW_ARRIVAL", "LIMITED_EDITION"]`), so both the new-arrivals and the limited
facets have real members and the two showcase panels contrast.

**Three gift sets** in the new `gift-set` collection: `concentration: null`,
`format` (e.g. "2 × 50 ML + Candle"), a populated `includes` list, a `badge`
("Most Loved" / "Limited" / "Bespoke"), empty note tiers, honest total `volumeMl`, prices
between the discovery sets and a full flacon.

## Security requirements

- No new network calls, no user input, no secrets. Images stay on `images.unsplash.com`,
  the only host allowed by `next.config.ts`.
- `?facet=` is untrusted input: validate against the known union before use and never
  interpolate it into markup — an unrecognised value renders the unfiltered grid.
- No `dangerouslySetInnerHTML`; all copy comes from typed dictionaries or the catalog.
- `src/services/products.ts` stays the only data seam, so the future RLS/Postgres swap
  keeps its single point of change.

## Acceptance criteria

- [ ] `/en/collections` and `/ar/collections` list **every** product (fragrances, body care,
      home fragrance, discovery sets, gift sets) with a working facet row; the collection
      tab bar is unchanged and `/collections/[slug]` still shows one fragrance collection.
- [ ] Selecting a facet updates the URL, survives a page reload, and deep links from Nav
      and Footer land on the right filtered view.
- [ ] Every card in the overview links somewhere real: fragrances to `/perfume/[slug]`,
      everything else to its category page. No 404s, no empty note rows.
- [ ] `/en/new-arrival` and `/ar/new-arrival` render the showroom with the two new
      fragrances, correct prices, and working links to their detail pages.
- [ ] `/en/gift-set` and `/ar/gift-set` render three gift sets; add-to-cart increments the
      bag badge and the wishlist heart persists across a reload.
- [ ] Both new pages mirror correctly under `dir="rtl"`: logical properties only, no
      literal `left`/`right`, product names kept in LTR islands.
- [ ] Arabic dictionary mirrors English exactly — `tsc` proves it.
- [ ] Zero `any`, zero TypeScript errors, zero new ESLint warnings.
- [ ] No layout shift on load; images carry `sizes`, heroes carry `priority`.
- [ ] Both routes are prerendered for both locales in the build output (not `ƒ` dynamic).

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build     # confirm ● / ○ (prerendered) for /[locale]/new-arrival and /[locale]/gift-set
```

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/en/collections`.
   - Count the cards: the full catalog, not just fragrances.
   - Click each facet chip — grid narrows, URL gains `?facet=…`, page does **not** jump to
     the top; reload holds the filter; "All" clears it.
   - Combine a facet with each sort option; ordering applies within the filtered set.
   - Open a gift-set card → lands on `/en/gift-set`. Open a fragrance card → its PDP.
2. `http://localhost:3000/en/new-arrival`
   - Hero fills the viewport, both showcase panels alternate sides at ≥1024px and stack
     cleanly at 375px; "Discover the Fragrance" opens the right PDP.
   - The closing band's button lands on `/en/collections?facet=new-arrivals`.
3. `http://localhost:3000/en/gift-set`
   - Three sets, each listing its contents and badge. Add one to the bag → the nav badge
     increments; heart it → reload → still filled.
4. Repeat 1–3 on `/ar/...`: layout mirrors, chips scroll from the right, no clipped text,
   product names read left-to-right inside Arabic copy.
5. Nav: open the Collections mega-menu → "New Arrivals", "Best Sellers", "Gift Sets",
   "Limited Editions" each land somewhere meaningful. Same for the mobile drawer at 375px
   and the Footer links.
6. Widths 375 / 768 / 1024 / 1440 / 1920 on all three pages — no horizontal scrollbar.
7. Keyboard: tab through the facet chips (visible gold focus ring, `aria-pressed`
   reflects state), then through the showcase links.
