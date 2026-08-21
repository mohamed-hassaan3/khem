# Merchandising collection pages, and a visible filter state

Follows `prompts/collections-consolidation-facets-nav.md`, which is shipped. Four changes.

## Goal

1. `/collections` — the chip row scrolls horizontally at **every** width (undo the desktop wrap added last round).
2. `/collections/[slug]` — remove the collection tab bar. No filter and no navigation row on a collection page at all; `/collections` is the only screen that filters.
3. **Best Sellers** and **Limited Edition** become pages under `/collections/[slug]`, so every Nav and Footer link leads to a collection page like any other, rather than to a pre-filtered `/collections?facet=…`.
4. `/collections` names the active filter and sort above the grid, in plain type, with a way to clear them.

## Skills read

`AGENTS.md` (§1, §3 tokens, §8 routing matrix, §9 schema). No `clerk` / `supabase` / `ai-sdk` surface in this task — no data model changes, no new queries. The auto-suggested `ai-gateway` / `auth` skills were not read for the same reason.

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `src/components/ecommerce/CollectionGrid.tsx` | Client. Chip row (`md:flex-wrap md:overflow-x-visible`), sort `<select>`, `?facet=` read from `window` and written with `history.replaceState`, `tabs` slot. |
| `src/components/ecommerce/CollectionView.tsx` | Hero, breadcrumb, count line, description; builds `<CollectionTab>` links from `collections`; picks `countLabel` vs `countLabelAll` on `collection === null`. |
| `src/app/[locale]/collections/[slug]/page.tsx` | `getCollectionBySlug` → `<CategoryView>` for non-fragrance kinds, `<CollectionView>` for fragrance; `generateStaticParams` over `getCollections("en")`. |
| `src/lib/facets.ts` | `CollectionFacet` / `MerchandisingFacet` union, `FACET_ORDER`, `productFacets()`, `parseFacet()`, `facetHref()`. |
| `src/constants/navigation-pages.ts` | `quickAccess` points Best Sellers / Limited Editions at `facetHref(...)` — the only two `facetHref` callers in the app. |
| `src/types/catalog.ts` | `Collection` carries `id, name, slug, description, bannerUrl, bannerAlt, cardUrl, cardAlt, isFeatured, kind`. `CollectionView` reads only five of those. |
| `src/app/[locale]/page.tsx:152` | The "Explore Collections" hero button — already points at `/collections`, unchanged. |

## Decisions and assumptions

- **D1 — The two merchandising pages are synthetic, not seeded.** A product points at exactly one collection (`"Product"."collectionSlug"`, `0001_catalog.sql`), so "best sellers" cannot be a `Collection` row without taking those products out of Noir and Signature. The pages are assembled in the route from the catalogue plus dictionary copy, and the membership rule stays the one that already exists — `productFacets()`.
- **D2 — `CollectionView` takes a display header, not a `Collection`.** It reads `slug, name, description, bannerUrl, bannerAlt` and nothing else, so its prop narrows to a `CollectionHeader` of exactly those five fields. A real `Collection` satisfies it structurally, and a synthetic page needs no invented `kind`, `id` or card crop. This is what keeps the merchandising pages from being a second page component.
- **D3 — Facet value `limited` is renamed `limited-edition`,** so the `?facet=` value, the dictionary key and the new page's slug are one spelling. Every merchandising facet then has a page at `/collections/<facet>` except `new-arrivals`, which keeps the richer `/new-arrival` showroom it already had.
- **D4 — Nav and Footer point at the pages, not the facets.** `quickAccess` becomes `/collections/best-sellers` and `/collections/limited-edition`. `facetHref()` loses its last caller and is deleted; `?facet=` stays exactly what it is — the URL the chips on `/collections` write.
- **D5 — Hero imagery for the two pages is a pair of constants,** alongside the existing `ALL_HERO_IMAGE` in `CollectionView`. There is no row to read a banner from, and inventing an admin surface for two pages is out of scope. Both are Unsplash URLs already loading elsewhere in the app, so `next.config.ts` needs no new remote pattern. **Flag:** swap them for real photography when it exists — one edit, one constant each.
- **D6 — Both pages count "pieces", not "fragrances".** Best sellers and limited editions cross body care and the sets, exactly as `/collections` does, so they take `countLabelAll`. `CollectionView` gets an explicit prop for this rather than inferring it from `collection === null`.
- **D7 — The state line lives on `/collections` only.** It reports the filter *and* the sort because both are now invisible state a visitor can arrive with or set, and one Clear resets both. It is deliberately plain type above the grid, not a second row of controls — the chips are the controls.

## Files likely to change

- `src/lib/facets.ts` — rename `limited` → `limited-edition`; add `MERCH_PAGE_FACETS` (the cuts with a page of their own) and drop `facetHref()`.
- `src/components/ecommerce/CollectionGrid.tsx` — chip row scrolls at all widths; `tabs` prop removed; active filter/sort line added.
- `src/components/ecommerce/CollectionView.tsx` — `CollectionHeader` prop; tab bar and `collections` prop removed; `countsEverything` prop.
- `src/app/[locale]/collections/[slug]/page.tsx` — resolve a merchandising slug when no collection matches; add both to `generateStaticParams`; metadata from the dictionary.
- `src/app/[locale]/collections/page.tsx` — pass `countsEverything`.
- `src/constants/navigation-pages.ts`, `src/app/sitemap.ts`, `src/lib/i18n/dictionaries/{en,ar}.ts`.

## Implementation requirements

### 1. Chip row scrolls at every width

Drop `md:flex-wrap md:overflow-x-visible`. The row keeps `flex … gap-2.5 overflow-x-auto`, `max-w-350`, `px-6 md:px-20`, `border-b border-border bg-surface`, and every chip keeps `shrink-0 whitespace-nowrap`. Nothing else about the row changes.

### 2. No tab bar on a collection page

Remove the `tabs` prop from `<CollectionGrid>` and the `<CollectionTab>` component and `collections` prop from `<CollectionView>`. `[slug]/page.tsx` stops calling `getCollections()` for the render (it still needs it in `generateStaticParams`). A collection page is then hero → description bar → grid.

### 3. Best Sellers and Limited Edition as pages

- `src/lib/facets.ts` gains:
  ```ts
  /** The merchandising cuts that have a page of their own at /collections/<facet>. */
  export const MERCH_PAGE_FACETS = ["best-sellers", "limited-edition"] as const;
  export type MerchPageFacet = (typeof MERCH_PAGE_FACETS)[number];
  export function parseMerchPageFacet(slug: string): MerchPageFacet | null
  ```
- `[slug]/page.tsx`: when `getCollectionBySlug()` returns `null`, try `parseMerchPageFacet(slug)` before `notFound()`. On a hit, fetch `getCatalogProductCards(locale)` and keep the products whose `productFacets()` include the facet, then render `<CollectionView>` with a header built from the dictionary and the banner constant. Real collections are resolved first, so a seeded slug always wins.
- `generateStaticParams` adds `MERCH_PAGE_FACETS` to every locale. Keep `revalidate = 600`.
- Metadata comes from `dict.collections.merchPages[facet].meta`, same shape as the category pages'.
- Dictionary, both locales:
  ```ts
  collections.merchPages: {
    "best-sellers": { name, description, bannerAlt, meta: { title, description, ogTitle, ogDescription } },
    "limited-edition": { … },
  }
  ```
  The English `name` values are **Best Sellers** and **Limited Edition**, matching the chip labels; Arabic reuses the translations already in `collections.facets`.
- `navigation-pages.ts`: `quickAccess` Best Sellers → `/collections/best-sellers`, Limited Editions → `/collections/limited-edition`. The Footer follows automatically — it reads the same table.
- `sitemap.ts`: both paths, in both locales, priority `0.8` beside the collections.
- The empty state matters here more than elsewhere: a house with nothing flagged `LIMITED_EDITION` must render the hero and `dict.collections.empty`, not a 404 — the page exists whether or not the cut is currently stocked.

### 4. Active filter and sort, above the grid

Rendered inside `<CollectionGrid>`, above the product grid, only when `showFacets` is on and either the facet is set or the sort is not `featured`:

- Plain type, no chrome: `text-[11px] tracking-wide text-ivory/40`, `mx-auto max-w-350`, `mb-10`. *(Implemented without the planned `text-gold/70` on the values: the labels are interpolated templates — `Filtered by {name}`, `التصفية: {name}` — and splitting one at the placeholder to colour half of it is a fragile trick to play on translated copy. The line reads as one quiet sentence, which is what "simple font" asked for; **Clear** carries the gold on hover.)*
- Reads, in English: `Filtered by Noir · Sorted by Price: Low to High`, with the parts omitted when they do not apply, joined by a `·` separator that is a decorative `<span aria-hidden>`.
- A **Clear** button ends the line: resets the facet to `null` *and* the sort to `featured`, and removes `?facet=` from the URL. Same underline-on-hover treatment the old Clear control had.
- Dictionary: `collections.activeState = { filteredBy: "Filtered by {name}", sortedBy: "Sorted by {name}", clear: "Clear" }` in both locales, interpolated with `interpolate()`.
- Sort labels come from `dict.collections.sortOptions`, the same strings the `<select>` prints.

## Security requirements

Unchanged from the previous round: `[slug]` is matched against seeded slugs and then against a two-member literal list, and anything else 404s; `?facet=` is narrowed by `parseFacet()`; no new queries, no new client fetching, no `service_role` use. The merchandising pages read the same RLS-scoped `getCatalogProductCards()` the overview reads.

## Acceptance criteria

1. `/collections` chip row scrolls horizontally at 375 px **and** at 1440 px; no chip wraps to a second line.
2. `/collections/signature` (and every other collection page) shows no tab bar and no chips — hero, description, grid only.
3. `/collections/best-sellers` and `/collections/limited-edition` render as collection pages with the right hero, count and products; both prerender in both locales.
4. Nav Quick Access and the Footer link to those two paths; no link in the app points at `/collections?facet=…` any more.
5. On `/collections`, choosing a chip or a sort prints the state line; Clear resets both and empties the query string.
6. Arriving at `/collections?facet=limited-edition` prints `Filtered by Limited Edition` and narrows the grid; `?facet=limited` (the old value) is unknown input and shows the full catalogue.
7. `npx tsc --noEmit`, `npm run lint`, `npm run build` clean; every dictionary key present in `en` and `ar`.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
grep -rIn "facetHref" src            # expect no output
```

## Manual test steps

1. `npm run build && PORT=3005 npm run start`.
2. `/collections` at 1440 px and at 375 px — the chip row scrolls in both; swipe/drag to the last chip.
3. Click **Noir**, then set sort to Price: Low to High — the line above the grid reads both; press **Clear** and confirm the URL loses `?facet=` and the grid returns to 28 pieces in featured order.
4. Open `/collections/signature` — no tab bar, no chips, no sort.
5. Open `/collections/best-sellers` and `/collections/limited-edition` — hero, count, and the same products the matching chip produces on `/collections`.
6. Open the Nav mega-menu and the footer — Best Sellers and Limited Editions land on those pages, on both `/` and `/ar`.
7. `/collections/best-seller` (singular) and `/collections/limited` 404.


---

## Verification record (post-implementation)

Production build, headless Chrome over CDP.

| Check | Result |
| :--- | :--- |
| Chip row | one line, horizontally scrollable, 11 chips — at 1440 px **and** 375 px |
| `/collections/signature` | no chips, no sort, no tab bar |
| `/collections/best-sellers` | `Best Sellers`, 5 pieces, own `<title>`; `/collections/limited-edition` → `Limited Edition`, 6 pieces — the same counts the matching chips produce |
| Prerender | 18 paths under `/collections/[slug]` = 9 slugs × 2 locales |
| State line | chip → `Filtered by Noir`; + sort → `Filtered by Noir · Sorted by Price: Low to High`; **Clear** → line gone, 28 cards, sort back to Featured, query string empty |
| Renamed facet | `?facet=limited-edition` filters to 6 and names itself; `?facet=limited` (old value) shows the full catalogue |
| Rejected slugs | `/collections/limited` and `/collections/best-seller` render the not-found page |
| Nav / Footer | identical hrefs in both locales; **no** `?facet=` link anywhere in the app; `facetHref()` deleted |
| Sitemap | both merchandising pages, both locales |
| Horizontal overflow @375 px | `scrollWidth` = 375 on `/collections`, both merchandising pages, `/collections/discovery`, and the Arabic tree |
| `npx tsc --noEmit`, `npm run lint`, `npm run build` | clean |
