# Collections consolidation — category routes, unified facets, nav & footer

## Goal

Make `/collections` the single shopfront surface:

1. Fix the Nav bar overflowing on `/discovery` at phone widths (bag + account icons pushed off-screen).
2. Rename every user-facing "Room Fragrance(s)" to **"Home Fragrances"**, including the URL and the database slug (`room-fragrance` → `home-fragrance`).
3. Remove the **Sort By** control from `/collections/[slug]`; keep it on `/collections` only.
4. Replace the collection chip filter on `/collections` with **one unified facet row** of ten chips, written to `?facet=`.
5. Fold `/body-care`, `/discovery`, `/gift-set`, `/room-fragrance` into `/collections/[slug]`, keeping each category's editorial sections, and redirect the old paths.
6. Restructure the Nav mega-menu / drawer columns and mirror them in the Footer.

## Skills read

- `AGENTS.md` (§1 operational rules, §3 design tokens, §6 stack, §8 routing matrix, §9 schema).
- No `clerk` / `supabase` / `ai-sdk` skill content is needed beyond existing project patterns: this task adds one plain SQL migration in the established `supabase/sql/NNNN_*.sql` style and touches no auth or AI surface.
- Auto-suggested `ai-sdk` / `vercel-services` skills were **not** read — this task has no AI SDK or multi-service surface.

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `src/app/[locale]/collections/page.tsx` | Overview: `getCollections()` + `getCatalogProductCards()` → `<CollectionView collection={null}>`, ISR 3600. |
| `src/app/[locale]/collections/[slug]/page.tsx` | Fragrance-only: `getFragranceCollectionBySlug()`, ISR 600, `generateStaticParams` over locale × collection. |
| `src/app/[locale]/{body-care,discovery,gift-set,room-fragrance}/page.tsx` | The four category pages, ISR 3600, each `getCollectionBySlug()` + `getProductCardsByKind()`. |
| `src/components/ecommerce/CollectionView.tsx` | Hero + breadcrumb + `<CollectionGrid>`; chips on the overview, `<CollectionTab>` links on `[slug]`. |
| `src/components/ecommerce/CollectionGrid.tsx` | Client. Sort bar, collection chips, `?collection=` + `?facet=` read from `window` (never `useSearchParams`, to keep the grid in the prerendered HTML), writes via `history.replaceState`. |
| `src/lib/facets.ts` | `ProductFacet`, `FACET_ORDER`, `FACET_PARAM`, `productFacets()`, `parseFacet()`, `facetHref()`. |
| `src/components/ecommerce/{CategoryHero,FeatureTriptych,MerchGrid,DiscoverySetCard,DiscoveryComparison}.tsx` | The category-page building blocks to be reused verbatim. |
| `src/components/Nav.tsx`, `src/components/Footer.tsx`, `src/constants/navigation-pages.ts` | Nav columns and their route table. |
| `src/lib/routes.ts` (`CATEGORY_PATH`, `productHref`), `src/lib/admin/revalidate.ts`, `src/app/sitemap.ts`, `src/components/search/SearchOverlay.tsx`, `src/components/admin/CollectionForm.tsx` | Every other place a category path is spelled. |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | `nav.collectionItems`, `nav.quickAccessItems`, `footer.links`, `collections.*`, `bodyCare/roomFragrance/discovery/giftSet` sections. |
| `supabase/sql/0001_catalog.sql` | `"Product"."collectionSlug"` → `"Collection"(slug)` **on update cascade** — a slug rename cascades. Latest migration is `0010_collection_card_image.sql`. |
| `supabase/seed/catalog.json` | 7 collections; the HOME one is `id/slug: room-fragrance`, `name: "Home Fragrance"`, with 4 `*-room-spray` products. |

## Decisions and assumptions

- **D1 — Facet vocabulary.** `ProductFacet` grows from 3 to 10 members, in exactly this declared order (`FACET_ORDER`), which is also the chip order:
  `new-arrivals, signature, gemstone, noir, body-care, home-fragrance, discovery, gift-set, best-sellers, limited`.
  The seven middle values are *collection-derived* (matched on `collectionSlug`); the three cuts stay derived from `tags` / `isBestseller`. `productFacets()` remains the single place the two are combined.
- **D2 — `?collection=` is retired.** With collection chips gone, the second parameter would be a filter with no control. `COLLECTION_PARAM` and its state are deleted from `<CollectionGrid>`; an incoming `?collection=` is simply ignored.
- **D3 — The chip row is the facet row.** Chips write `?facet=` through `history.replaceState`, exactly as the collection chips wrote `?collection=` today. The "active cut + Clear" line is **removed** — with a visible chip row the cut is no longer unexplained, and the chip's `aria-pressed` plus an "All" chip now carry that job. Chips that would filter to nothing are still dropped (today's `available` rule, now computed over `item.facets`).
- **D4 — Category pages keep their editorial sections**, keyed by `collection.kind`, per the answered question. `/collections/[slug]` becomes a router over kind:
  - `FRAGRANCE` → `<CollectionView>` (unchanged shape, no sort).
  - `BODY` → `CategoryHero` + `FeatureTriptych` (ritual triptych) + `MerchGrid`.
  - `HOME` → `CategoryHero` + `MerchGrid showFilters`.
  - `DISCOVERY` → `CategoryHero` + set grid + `FeatureTriptych variant="steps"` + `DiscoveryComparison`.
  - `GIFT` → `CategoryHero` + set grid + `FeatureTriptych` (gift triptych).
- **D5 — Old routes are kept as permanent redirects.** *Revised during implementation:* the plan put `permanentRedirect()` inside each `page.tsx`, on the reasoning that the `[locale]` segment already resolves the prefix. Measured, that answers **200** with a document that redirects after it loads — the routes are prerendered, so the redirect never reaches the response status, and a crawler reads a page rather than a move. The redirects moved to `next.config.ts`'s `redirects()`, which runs before rendering and answers **308**; both locales are listed explicitly, generated from `LOCALES`. The four `page.tsx` files are deleted.
- **D6 — `/new-arrival` stays a route.** The Nav/Footer "New Arrival" entry points at `/new-arrival` (the editorial showroom with story + note pyramid panels), *not* at `?facet=new-arrivals`; the chip on `/collections` is the in-page cut of the same goods. **Flag for the user at approval** — if they want the nav entry to point at the facet instead, it is a one-line change in `navigation-pages.ts`.
- **D7 — Slug rename is data + code.** New migration `supabase/sql/0011_home_fragrance_slug.sql` renames the collection's `id` and `slug` to `home-fragrance` (products cascade); `supabase/seed/catalog.json` is updated to match so a fresh seed and a migrated database agree. Product slugs (`amber-room-spray`) are **not** renamed — they are per-product names, not the category, and renaming them would break `localStorage` cart/wishlist lines for returning visitors (the reason ids are slugs at all, per `0001_catalog.sql`'s header).
- **D8 — The dictionary key `roomFragrance` is renamed to `homeFragrance`** in both dictionaries, so no surface can print the old word by accident. `nav.collectionItems.roomFragrance` → `homeFragrance` likewise; `Dictionary` is derived from `en.ts`, so any missed reference is a compile error.
- **D9 — Nav bar overflow.** *Resolved by measurement, not by guess.* Driving a headless Chrome at 375 px against a production build: `/collections/discovery` reported `innerWidth` 511 against a 375 px screen, while `/`, `/collections`, `/heritage` and the other category pages reported 375. The single source was `<DiscoveryComparison>`'s table — `min-w-140` (560 px) inside a **static** `overflow-x-auto` container, which still propagates its content's layout overflow up the containing-block chain. A mobile browser widens the layout viewport to cover that, and `<nav>` (`fixed inset-x-0`) widens with it, which is what put the bag and account icons off-screen. `relative` on the scroll container makes it the containing block and the overflow stops at the scrollbar: 375 px on every page afterwards.

  Two things were tried and **reverted** rather than shipped, because measurement said they did nothing: `overflow-x: clip` on `html` (fixed elements escape the root's overflow entirely) and wrapping the search panel and nav drawer in fixed clipping frames (they are already contained — removing the frames left `scrollWidth` unchanged at 375 px).

  Kept as defensive hardening, not as the fix: `min-w-0` on the Nav's two `flex-1` rails, `shrink-0` on the icons, and a gap that steps up with the viewport. Verified: at 320 px the bar measures 320 px with every control inside it.

## Files likely to change

**Facets & grid**
- `src/lib/facets.ts` — ten-member union, collection-derived matching, `facetHref()` unchanged.
- `src/components/ecommerce/CollectionGrid.tsx` — facet chips replace collection chips; `?collection=` removed; new `showSort?: boolean` prop; active-cut line removed.
- `src/components/ecommerce/CollectionView.tsx` — pass `facets` instead of `collections` to the grid; `showSort={collection === null}`.

**Routes**
- `src/app/[locale]/collections/[slug]/page.tsx` — resolve by `getCollectionBySlug()` (all kinds), `generateStaticParams` over `getCollections()`, branch on `kind`.
- New `src/components/ecommerce/CategoryView.tsx` — the non-fragrance branch, so `page.tsx` stays thin (AGENTS.md §1.5).
- `src/app/[locale]/{body-care,discovery,gift-set,room-fragrance}/page.tsx` — `permanentRedirect()` to `/collections/<slug>`.
- Delete the empty leftover dirs `src/app/[locale]/{signature,noir,gemstone,home-fragrance}`.

**Rename**
- `supabase/sql/0011_home_fragrance_slug.sql` (new), `supabase/seed/catalog.json`.
- `src/lib/routes.ts` (`CATEGORY_PATH` now points into `/collections/*`), `src/lib/admin/revalidate.ts`, `src/app/sitemap.ts`, `src/components/admin/CollectionForm.tsx`, `src/components/search/SearchOverlay.tsx`, `src/components/ecommerce/{MerchGrid,CategoryHero}.tsx` (dictionary key + comments), `src/services/products.ts` (comments only).

**Nav / Footer**
- `src/constants/navigation-pages.ts` — `collections` becomes `[newArrival, signature, gemstone, noir, bodyCare, homeFragrance]` pointing at `/new-arrival` and `/collections/<slug>`; a new `quickAccess` table `[discovery, giftSet, bestSellers, limited]`.
- `src/components/Nav.tsx`, `src/components/Footer.tsx`.
- `src/lib/i18n/dictionaries/{en,ar}.ts`.

## Implementation requirements

### 1. Nav overflow (`/discovery`, ≤ 375 px)

- Reproduce before fixing: `npm run dev`, load `/discovery` at 375 × 812, and measure `document.documentElement.scrollWidth` vs `clientWidth`, then walk the DOM for the widest offender.
- Remove the overflow at its source (do not paper over it with `overflow-x: hidden` on `body` — that hides the symptom and breaks `position: sticky` descendants).
- Independently harden `<Nav>`: both `flex-1` rails get `min-w-0`, the logo link and icon buttons `shrink-0`, and the icon gap steps up (`gap-3.5 sm:gap-5 sm:gap-7`) so the bag and account icons stay inside the viewport at 320 px with the cart badge showing a two-digit count.
- Verify the same at 320/375/414 px on `/`, `/collections`, `/collections/discovery`, `/perfume/<slug>`, and on the Arabic tree (`/ar/...`), since the rails are logical-direction.

### 2. "Home Fragrances" rename

- Migration `0011_home_fragrance_slug.sql`, idempotent like every file before it:
  ```sql
  update public."Collection"
     set slug = 'home-fragrance', id = 'home-fragrance'
   where slug = 'room-fragrance';
  ```
  `"Product"."collectionSlug"` cascades. Include a header comment stating why the rename is data and not display-only, and re-run safety.
- `supabase/seed/catalog.json`: collection `id`/`slug` → `home-fragrance`, `name` → `"Home Fragrances"` (and the Arabic name column if the row carries one); the 4 products' `collectionSlug` → `home-fragrance`.
- Dictionary key `roomFragrance` → `homeFragrance` in `en.ts` and `ar.ts` (both the `nav.collectionItems` entry and the top-level page section), English label `"Home Fragrances"`, Arabic label kept/updated to the equivalent already used for the collection name.
- Grep afterwards: `grep -rIn "room-fragrance\|roomFragrance\|Room Fragrance" src supabase/seed` must return nothing outside `prompts/`.

### 3. Sort control

- `<CollectionGrid>` gains `showSort?: boolean` (default `true`). When `false`, the description bar renders the description alone and keeps its `border-b`, padding and `max-w-350` — the bar must not collapse or change height class on `[slug]`.
- `<CollectionView>` passes `showSort={collection === null}`.
- The sort `useState` stays mounted either way; only the control is conditional (keeps the `key` on the grid stable).

### 4. Unified facet row on `/collections`

- `ProductFacet` = the ten values of D1. `FACET_ORDER` declares the chip order.
- `productFacets(product)` returns them in `FACET_ORDER` order: the collection facet whose value equals `product.collectionSlug` (when it is one of the seven), plus `new-arrivals` / `best-sellers` / `limited` as the tags and `isBestseller` dictate.
- Chips: reuse the existing `<FilterChip>` (bordered pill, `aria-pressed`, `dir="auto"`), preceded by an **All** chip (`dict.collections.tabAll`). The row keeps `border-b border-border bg-surface`, `max-w-350`, `overflow-x-auto`, `gap-2.5`.
- Only one facet is active at a time; selecting writes `?facet=<value>`, All clears the parameter.
- Chips with no matching product are dropped (`available`, computed from `items[].facets`).
- The row is a scroll strip on a phone and **wraps** from `md` up (`md:flex-wrap md:overflow-x-visible`). Eleven chips do not fit a desktop line, and a row running off the edge of a 1440 px screen reads as clipped rather than as swipeable. *(Added during implementation, from the screenshot.)*
- Labels come from `dict.collections.facets`, which grows to ten keys — keys **are** the `?facet=` values, per the existing comment. English copy exactly as the user wrote it: `New Arrival, Signature, Gemstone, Noir, Body Care, Home Fragrances, Discovery Sets, Gift Sets, Best Sellers, Limited Edition`. Arabic values must be filled in `ar.ts` (reuse the collection names already translated there).
- The `nav aria-label` becomes `dict.collections.filterLabel` ("Filter the catalogue"); retire `filterByCollection` and `clearFilter`.
- The mount/`popstate` effect keeps reading from `window.location.search` — **do not** introduce `useSearchParams`; the header comment on that file explains why and must be updated rather than deleted.
- The grid `key` becomes `` `${facet ?? "all"}-${sort}` `` so the `.khem-fade` still replays on every change.

### 5. Category routes folded into `/collections/[slug]`

- `[slug]/page.tsx`: `generateStaticParams` over `getCollections("en")` × `LOCALES`; resolve with `getCollectionBySlug(locale, slug)`; `notFound()` when absent. Keep `export const revalidate = 600`.
- `FRAGRANCE` → today's `<CollectionView>`, whose tab bar now lists **all seven** collections (they all live under `/collections/[slug]` now), still with `scroll={false}`.
- Everything else → new `<CategoryView>` (Server Component) taking `{ locale, collection, products }` and switching on `collection.kind` to compose the sections listed in D4. Copy comes from the existing dictionary sections, selected by a `kind → dictionary section` map so a missing translation is a compile error.
- Products: `getProductCardsByKind(locale, collection.kind)` for the four category kinds, `getProductCardsByCollection(locale, slug)` for fragrance collections.
- `<CategoryHero>`'s doc comment updates to name the new route.
- Old routes: `/body-care`, `/discovery`, `/gift-set`, `/room-fragrance` each become
  ```tsx
  export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    permanentRedirect(localizePath(isLocale(locale) ? locale : "en", "/collections/<slug>"));
  }
  ```
  with a comment explaining the merge, plus `export function generateStaticParams()` over `LOCALES` so both trees prerender the redirect.
- `src/lib/routes.ts`: `CATEGORY_PATH` values become `/collections/body-care`, `/collections/home-fragrance`, `/collections/discovery`, `/collections/gift-set`. `productHref()` and `hasDetailPage()` keep their current shape.
- `src/lib/admin/revalidate.ts`: `categoryPathsForKind()` returns the new paths (it must go on deriving them, exhaustively, from `CollectionKind`).
- `src/app/sitemap.ts`: drop the four static category entries — they now come from the dynamic collection loop, which must switch from `getFragranceCollections()` to `getCollections()`. Keep `/new-arrival` and `/collections`.
- `SearchOverlay`'s collections list points at `/collections/<slug>` for all five entries.
- `CollectionForm`'s kind labels name the new paths.

### 6. Nav and Footer

- `navigation-pages.ts`:
  ```ts
  collections = [newArrival → /new-arrival, signature, gemstone, noir, bodyCare, homeFragrance → /collections/<slug>]
  quickAccess = [discovery → /collections/discovery, giftSet → /collections/gift-set,
                 bestSellers → facetHref("best-sellers"), limited → facetHref("limited")]
  ```
  `quickAccess` is typed against the dictionary the same way `collections` is, so the Nav's inline array literal goes away and the Footer reads the same table (this is what makes "the footer navigates the same as the nav" structural rather than a copied list).
- `Nav.tsx`: New Arrival is the first entry of the **Our Collections** column in both the desktop mega-menu and the drawer; Discovery Sets moves into **Quick Access** in both. The mega-menu's "Featured" tile keeps pointing at `/new-arrival`. Update the long comment above `quickAccess` — it currently explains an arrangement that will no longer exist.
- `Footer.tsx`: the Collections column renders `collections` then `quickAccess` from the shared tables; the ad-hoc `newArrivals` / `giftSets` / `bestSellers` entries and their `footer.links` keys are removed (keep the keys only if still referenced elsewhere — otherwise delete them from both dictionaries).
- Descriptions: `nav.collectionItems` needs `newArrival` (label + desc) and loses nothing else; `quickAccessItems` needs `discoverySets` and keeps `bestSellers` / `giftSets` / `limitedEditions`, dropping `newArrivals`.

## Security requirements

- The `[slug]` segment and `?facet=` remain untrusted input: `slug` is only ever matched against seeded rows (`getCollectionBySlug` → `notFound()`), and `parseFacet()` narrows the query value against `FACET_ORDER`, returning `null` for anything unknown, so a hand-typed URL shows the full catalog rather than an empty grid or a thrown render.
- No new client-side data fetching, no `service_role` usage; reads keep going through `getSupabasePublic()` under RLS.
- The migration is a data-only `update` on one row, transactional under `db:migrate`, with no policy or privilege change.
- Redirects are to fixed internal app paths built by `localizePath()` — never from user input — so no open redirect is introduced.

## Acceptance criteria

1. `/discovery` (redirected to `/collections/discovery`) at 320–414 px: `scrollWidth === clientWidth`, and the search / wishlist / bag / account icons are all fully visible, LTR and RTL.
2. No occurrence of `room-fragrance`, `roomFragrance` or "Room Fragrance" anywhere in `src/` or `supabase/seed/`; the collection reads **Home Fragrances** in Nav, Footer, search, chips, hero and admin.
3. `/collections/signature` shows no Sort By control; `/collections` still does, and it still reorders by price.
4. `/collections` shows exactly one chip row: All + up to ten facets in the order New Arrival, Signature, Gemstone, Noir, Body Care, Home Fragrances, Discovery Sets, Gift Sets, Best Sellers, Limited Edition. Clicking a chip narrows the grid and puts `?facet=<value>` in the address bar without a page load; reloading that URL lands on the same narrowed view; Back restores the previous one.
5. `/collections/body-care`, `/collections/home-fragrance`, `/collections/discovery`, `/collections/gift-set` render the full category page (hero, triptych/steps, correct card type, and the comparison table on discovery). `/collections/discovery` and `/collections/gift-set` sell straight from the card as before.
6. `/body-care`, `/discovery`, `/gift-set`, `/room-fragrance` — and their `/ar/*` twins — 308 to the matching `/collections/*` URL.
7. Nav mega-menu and drawer: Our Collections = New Arrival (first), Signature, Gemstone, Noir, Body Care, Home Fragrances. Quick Access = Discovery Sets, Gift Sets, Best Sellers, Limited Editions. The Footer's Collections column lists the same ten destinations with the same hrefs.
8. A cart or wishlist line for a body/home/set product still links to a live page (`productHref()` → `/collections/<slug>`), and `/perfume/amber-room-spray` still 404s.
9. `npx tsc --noEmit` and `npm run lint` clean; zero `any`; every dictionary key resolved in both `en` and `ar`.
10. `npm run build` prerenders both locales for all seven `/collections/[slug]` pages.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run db:migrate     # applies 0011
npm run db:seed        # optional; only if reseeding a local database
npm run build
grep -rIn "room-fragrance\|roomFragrance\|Room Fragrance" src supabase/seed   # expect no output
```

## Manual test steps

1. `npm run db:migrate` then `npm run dev`.
2. **Nav overflow** — open `/collections/discovery` in a 375 px viewport; confirm the page does not scroll sideways and all header icons are visible. Add 10+ items to the bag and re-check with the two-digit badge. Repeat at `/ar/collections/discovery`.
3. **Facets** — open `/collections`; click through every chip and confirm the URL, the count line and the grid agree; press All to clear; reload on `/collections?facet=limited`; hit Back.
4. **Bad input** — `/collections?facet=nonsense` shows the full catalog with All active; `/collections/nope` 404s.
5. **Sort** — `/collections` sort by price ascending, then open `/collections/noir` and confirm no Sort By control is present.
6. **Category pages** — visit each of `/collections/{body-care,home-fragrance,discovery,gift-set}`; confirm hero copy, triptych, format filter on Home Fragrances, contents lists and Add to Bag on discovery/gift, and the comparison table on discovery.
7. **Redirects** — request `/room-fragrance`, `/body-care`, `/discovery`, `/gift-set` and their `/ar/` twins; confirm each lands on the `/collections/*` URL.
8. **Nav & Footer** — open the Collections mega-menu, the mobile drawer and the footer; confirm the two lists match item for item and every link resolves (no 404s), on both locales.
9. **Admin** — edit a Home Fragrances product's price in `/admin`, then reload `/collections/home-fragrance` and confirm the new price (revalidation path is correct).


---

## Verification record (post-implementation)

Driven against `npm run build` + `npm run start`, headless Chrome over CDP at the stated viewports.

| Check | Result |
| :--- | :--- |
| Horizontal overflow @375 px — `/`, `/collections`, `/collections/discovery`, `/ar/collections/discovery`, `/collections/{gift-set,body-care,home-fragrance}` | `scrollWidth` = `clientWidth` = 375 on every one (discovery was 511 before) |
| Header @320 px on `/collections/discovery` | bar measures 320 px; every link and button inside the viewport |
| Chip row on `/collections` | `All, New Arrival, Signature, Gemstone, Noir, Body Care, Home Fragrances, Discovery Sets, Gift Sets, Best Sellers, Limited Edition` — the requested order |
| Chip filtering | all 28 → signature 6, gemstone 6, noir 2, body-care 4, home-fragrance 4, discovery 3, gift-set 3, new-arrivals 2, best-sellers 5, limited 6 |
| Chip writes URL | clicking Noir → `?facet=noir`, 2 cards; All → no parameter, 28 cards |
| Deep link / bad input | `?facet=limited` opens narrowed with the chip active; `?facet=bogus` shows the full catalogue with All active |
| Sort control | present on `/collections`, absent on `/collections/signature` |
| Tab bar on `/collections/signature` | All + all seven collections |
| Redirects | `/body-care`, `/discovery`, `/gift-set`, `/room-fragrance` and their `/ar/*` twins → **308** to the matching `/collections/*` |
| Old slug | `/collections/room-fragrance` renders the not-found page; `/collections/home-fragrance` renders Home Fragrances |
| Nav vs Footer | identical ten shop hrefs, in the same order, on both locales |
| Sitemap | all seven collections × both locales; no category paths left |
| Category pages | discovery renders the comparison table and contents lists; gift sets render theirs; home fragrance renders the format filter |
| `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run db:migrate`, `npm run db:verify` | all clean (38/38 database checks) |

**Known, pre-existing, out of scope:** every unknown URL in this app answers **200** with the not-found UI rather than a 404 status — `/perfume/nope` and `/journal/nope` behave the same way, so it predates this work.
