# Collections page — one filter, by collection

## Goal

On `/collections`, replace the current **two** filter rows with **one**: a single
filter based on the collection itself —

`All · Signature · Noir · Gemstone · Body Care · Home Fragrance · Discovery Sets · Gift Sets`

Clicking a chip narrows the already-loaded catalog **in place** (client-side, no
navigation) and writes `?collection=<slug>` so the view stays linkable.

Remove the merchandising sub-filter chips (New Arrivals, Best Sellers, Limited
Editions) from the page. Those cuts stay reachable **from the Nav quick-access
column and the Footer only**, via the existing `?facet=` URL — arriving with
`?facet=best-sellers` still narrows the grid; it simply no longer renders a chip
row of its own.

## Skills read

- `AGENTS.md` (§1 rules, §2 workflow, §3 design tokens, §8 routing matrix, §12 checklist)
- `.agents/skills/supabase` — not needed: no schema change, no new query beyond an
  existing service function (`getCollections`).
- The `ai-sdk` / `chat-sdk` suggestions injected by the Vercel plugin hook are
  lexical false positives; this task touches no AI code.

## Existing code inspected

- `src/app/[locale]/collections/page.tsx` — overview route (ISR 3600), passes
  `getFragranceCollections()` + `getCatalogProductCards()` to `<CollectionView>`.
- `src/app/[locale]/collections/[slug]/page.tsx` — single-collection route
  (ISR 600), `generateStaticParams` over fragrance collections.
- `src/components/ecommerce/CollectionView.tsx` — Server Component shared by both
  routes: hero, breadcrumb, description, tab bar, grid. Builds `FacetOption[]`
  from `FACET_ORDER` for the overview only.
- `src/components/ecommerce/CollectionGrid.tsx` — Client Component: sort state,
  facet state read from `window.location.search` (deliberately *not*
  `useSearchParams`, to keep the grid in the prerendered HTML), wishlist overlay,
  fade-on-change grid.
- `src/lib/facets.ts` — `ProductFacet`, `FACET_ORDER`, `productFacets()`,
  `parseFacet()`, `facetHref()`.
- `src/components/Nav.tsx:107,109` and `src/components/Footer.tsx:43` — the only
  `facetHref()` callers (`best-sellers`, `limited`).
- `src/services/products.ts` — `getCollections()` (all kinds, `sortOrder`) already
  exists; `getFragranceCollections()` stays for the slug route, sitemap, search.
- `src/types/catalog.ts` — `ProductCardData` already carries `collectionSlug`,
  `isBestseller`, `tags`.
- `src/lib/i18n/dictionaries/{en,ar}.ts` — `collections.facets`, `facetAll`,
  `tabAll`, `filterLabel`.
- `src/lib/i18n/rtl.ts` — `ltrIsland()` is for by-design-Latin text; database
  prose (collection names now have Arabic columns) should take `dir="auto"`.
- `supabase/seed/catalog.json` — exactly seven collections, slugs: `signature`,
  `noir`, `gemstone`, `body-care`, `room-fragrance`, `discovery`, `gift-set`.
  Their names match the user's list one-for-one.

## Decisions / assumptions

1. **In-place filtering, confirmed by the user.** The chip row lives inside
   `<CollectionGrid>` (client) so it can show active state without a round trip;
   the URL is updated with `history.replaceState`, exactly as the facet already
   does, so ISR and the prerendered grid are preserved.
2. **The collection filter is overview-only.** `/collections/[slug]` is already a
   single collection, so it keeps its existing *link* tab bar for moving between
   collections. Passing chips there would offer a filter with one possible value.
3. **`?facet=` survives, confirmed by the user**, so the Nav and Footer links keep
   working. It is now URL-only: no chips. When a facet is active the page prints a
   single quiet line above the grid naming the cut with a **Clear** control, so a
   visitor who lands on a narrowed catalog can tell why and get out. Collection
   and facet **compose** (AND) — picking Noir on a best-sellers URL shows Noir
   best sellers.
4. **`ProductFacet` shrinks to the three merchandising cuts** —
   `new-arrivals`, `best-sellers`, `limited`. The four category facets
   (`gift-sets`, `discovery-sets`, `body-care`, `home-fragrance`) are exactly what
   the new collection filter now expresses, so keeping them would be two names for
   one thing. `productFacets()` therefore stops reading `collectionKind` and the
   `CollectionKind` exhaustiveness switch goes with it.
5. **Collection names take `dir="auto"`, not `ltrIsland()`** — per the guidance in
   `src/lib/i18n/rtl.ts`: since `0007_i18n_content.sql` these are translated
   database columns, so direction is a runtime fact about the row. Applies to the
   new chips *and* the existing tab bar labels, so the same label is not treated
   two ways on two routes. The breadcrumb/`<h1>` collection name on the slug page
   changes the same way for the same reason.
6. The hero count stays the full catalogue count (`{count} Pieces`). It is
   server-rendered above the filter and already did not react to the facet;
   making it reactive would drag the count into the client component for no gain.
7. No schema change, no new SQL, no new route.

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/lib/facets.ts` | Trim `ProductFacet` / `FACET_ORDER` to the three merchandising cuts; drop the `collectionKind` switch from `productFacets()`; rewrite the module doc to say the facet is now URL-only, entered from Nav/Footer. |
| `src/components/ecommerce/CollectionGrid.tsx` | New `collections?: CollectionOption[]` prop + `?collection=` state and chip row; `facets` prop replaced by `facetLabels` used only for the active-cut line; compose both filters in the `filtered` memo; grid `key` includes the collection. |
| `src/components/ecommerce/CollectionView.tsx` | Pass all collections as chip options on the overview; keep the link tab bar for the slug route only; stop building `FacetOption[]`; pass facet labels for the hint line; `dir="auto"` on DB names. |
| `src/app/[locale]/collections/page.tsx` | `getFragranceCollections` → `getCollections` (every kind, `sortOrder`); update the doc comment. |
| `src/app/[locale]/collections/[slug]/page.tsx` | Unchanged behaviour; only touched if the tab-bar prop shape changes. |
| `src/lib/i18n/dictionaries/en.ts` | `collections.facets` reduced to three keys; add `collections.filterByCollection` (aria-label) and `collections.clearFilter`; adjust `meta.description` wording to describe browsing by collection. |
| `src/lib/i18n/dictionaries/ar.ts` | Same keys, Arabic copy. |

## Implementation requirements

### `src/lib/facets.ts`
- `export type ProductFacet = "new-arrivals" | "best-sellers" | "limited";`
- `FACET_ORDER` holds those three, in that order (it is now only a validation
  list + label order, and `parseFacet()` keeps narrowing untrusted input to it).
- `productFacets(product)` returns tags/bestseller only; delete the
  `CollectionKind` switch and the now-unused type import.
- `facetHref()` unchanged — Nav and Footer keep compiling untouched.

### `src/components/ecommerce/CollectionGrid.tsx`
- New exported type:
  ```ts
  export interface CollectionOption { slug: string; label: string; }
  ```
- `CollectionGridItem` gains `collectionSlug: string`.
- Props: `collections?: readonly CollectionOption[]` (omitted on the slug route)
  and `facetLabels: Readonly<Record<ProductFacet, string>>`.
- Read **both** params in the existing mount/`popstate` effect
  (`collection`, `facet`); unknown collection slugs resolve to `null` by testing
  against the passed options, so a mistyped URL shows everything rather than an
  empty grid — same rule `parseFacet()` already follows.
- `selectCollection(next)` mirrors `selectFacet`: set state, then
  `history.replaceState` with `collection` set or deleted. Export a
  `COLLECTION_PARAM = "collection"` constant beside the state so the two params
  are named in one place.
- `filtered` applies collection **and** facet.
- Only offer a chip for a collection that has at least one product in `items` —
  keep the existing "no dead affordances" rule, reusing the `available` memo
  shape.
- Chip row markup: reuse the existing `<FacetChip>` styling and the
  `border-b border-border bg-surface` bar, `overflow-x-auto`, `max-w-350`,
  `px-6 py-4 md:px-20`. First chip is `dict.collections.tabAll`
  (`isActive={collection === null}`); the rest are the options in order, each
  label wrapped with `dir="auto"`.
  `aria-label` on the `<nav>` = `dict.collections.filterByCollection`.
- Active-cut line, rendered only when `facet !== null`: a flex row directly above
  the grid inside the existing grid `<section>` (or immediately after the chip
  bar), `text-[10px] uppercase tracking-[0.2em] text-ivory/35`, printing
  `facetLabels[facet]` in `text-gold/70`, followed by a `<button type="button">`
  reading `dict.collections.clearFilter` that calls `selectFacet(null)` —
  gold on hover/focus-visible, `focus-visible:outline-none` with a visible
  border/underline change, no bounce. Zero layout shift when absent.
- Grid remount key becomes `` `${collection ?? "all"}-${facet ?? "all"}-${sort}` ``
  so `.khem-fade` replays on a collection change too.
- Update the module header comment: two params, one filter row, why the facet has
  no chips.

### `src/components/ecommerce/CollectionView.tsx`
- Overview (`collection === null`): build
  `CollectionOption[]` from the `collections` prop (`{ slug, label: entry.name }`)
  and pass it; render **no** link tab bar (`tabs` becomes optional / `undefined`).
- Slug route: pass no chip options and keep today's link tab bar exactly as is,
  including `scroll={false}` and the `CollectionTab` component and its comment.
- Always pass `facetLabels={dict.collections.facets}`.
- Add `collectionSlug: product.collectionSlug` to each `CollectionGridItem`.
- Replace `ltrIsland` usage on database names with `dir="auto"`; drop the now
  unused import if nothing else needs it.
- Rewrite the stale comment block that explains "facets belong to the overview
  alone" to describe the new single filter.

### `src/app/[locale]/collections/page.tsx`
- Import and call `getCollections(activeLocale)` instead of
  `getFragranceCollections`. Update the doc comment: the filter row is now every
  collection, and a card still links to its category page via `productHref()`, so
  no second checkout URL is created.

### Dictionaries
- `en`: `facets: { "new-arrivals": "New Arrivals", "best-sellers": "Best Sellers",
  limited: "Limited Editions" }`; `filterByCollection: "Filter by collection"`;
  `clearFilter: "Clear"`. Reword `meta.description` to
  “…Browse by collection: Signature, Noir, Gemstone, body care, home fragrance,
  discovery and gift sets.”
- `ar`: the matching three facet labels (already present), plus
  `filterByCollection: "تصفية حسب المجموعة"`, `clearFilter: "إلغاء"`, and the
  reworded description. Keep both files structurally identical — `en.ts` is the
  type source.

## Security requirements

- Both query params are untrusted input: `facet` through `parseFacet()`, and
  `collection` matched against the server-supplied option list. Neither is ever
  interpolated into a query or rendered as HTML.
- No new database access, no service-role key, no new public surface. Reads stay
  on the publishable key inside the existing service functions under RLS.
- `history.replaceState` receives a `URL` built from `window.location.href`; no
  open-redirect surface, no user-controlled destination.

## Acceptance criteria

- `/collections` renders **exactly one** filter row, and it lists All + the seven
  collections; no merchandising chip row anywhere on the page.
- Clicking a chip narrows the grid without navigation, replays the fade, and
  updates the URL to `?collection=<slug>`; reloading that URL shows the same view.
- Back/forward across chip changes lands on the right view (the `popstate`
  listener covers arrivals from Nav links).
- `/collections?facet=best-sellers` (the Nav/Footer link) still narrows to best
  sellers, shows the cut’s name with a working Clear, and renders no facet chips.
  Collection + facet compose.
- A collection with no live products contributes no chip.
- `/collections/[slug]` is visually and behaviourally unchanged apart from the
  `dir="auto"` swap: link tab bar, no chips, no active-cut line.
- Arabic tree: chips mirror, the row scrolls from the right, labels take their own
  direction, and the Clear control sits on the logical end.
- Tokens only — `bg-surface`, `border-border`, `text-gold`, `text-ivory/40`,
  `font-heading`, `tracking-[0.2em]`, 300ms ease-out. No spring, no bounce.
- Zero `any`, no new ESLint warnings, both dictionaries type-check against each
  other.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build        # confirms /collections and /collections/[slug] still prerender
```

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/en/collections`.
2. Confirm one filter row: `ALL SIGNATURE NOIR GEMSTONE BODY CARE HOME FRAGRANCE
   DISCOVERY SETS GIFT SETS` — and that no New Arrivals / Best Sellers / Limited
   chips appear anywhere.
3. Click **NOIR** → grid fades to Noir products only, URL becomes
   `/en/collections?collection=noir`, page does not scroll or navigate.
4. Reload that URL → same narrowed grid. Press Back → previous view returns.
5. Click **BODY CARE** → body-care products only. Click **ALL** → full catalogue,
   `?collection=` gone from the URL.
6. Change **Sort By** to `Price: Low to High` while a collection is active →
   ordering changes, the collection stays selected.
7. Open the Nav mega-menu → **Quick Access → Best Sellers**. It lands on
   `/en/collections?facet=best-sellers`, the grid shows best sellers only, the
   line above the grid reads `BEST SELLERS · CLEAR`, and there is still only the
   collection row. Click a collection chip → both filters apply. Click **CLEAR**
   → facet drops, collection stays, `?facet=` leaves the URL.
8. Footer → **Best Sellers**: same behaviour.
9. Visit `/en/collections/noir` → unchanged: link tab bar, no chips, no cut line.
10. Repeat 2–7 on `/ar/collections` and confirm mirroring and Arabic labels.
11. Keyboard only: Tab reaches every chip, the sort select, and Clear; focus is
    visible on each; Enter/Space activates.
