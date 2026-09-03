# Categories & Collections — Audit, Restructure, and CMS-Managed Navigation

Source brief: `src/docs/CMS-Collections-Categories-Full-Audit-Restructure.md`.

## Goal

One hierarchy — **Category → Collection → Product** — that is entirely
CMS-managed, so that creating a collection in the dashboard produces a real
page, and adding it to the Nav or the Footer is a *selection*, never a typed
URL. Plus the four dashboard bugs the brief lists.

## Skills read

- `node_modules/next/dist/docs/` — App Router, `generateStaticParams`,
  `revalidatePath`, `redirects()`.
- `.agents/skills/supabase` — migration ordering, RLS, PostgREST schema-cache
  reload (`AGENTS.md` §9 warning).
- `.agents/skills/clerk` — unchanged; every write stays behind `requireAdmin()`.

Not read: `ai-sdk` (nothing here calls a model).

## Existing code inspected

- `supabase/sql/0001_catalog.sql` — `"Collection"`, `"Product"`,
  `"CollectionKind"`, `"ProductImage"`, RLS.
- `supabase/sql/0008_i18n_content.sql` — `name_ar` / `description_ar` on
  `"Collection"` and `"Product"`.
- `supabase/sql/0041_product_type.sql` — `"ProductType"` enum, the backfill from
  `format`, the `product_type_matches_kind()` trigger.
- `supabase/sql/0043_landing_sections.sql`, `0044_new_arrival_presentation.sql`.
- `src/constants/navigation-pages.ts`, `src/components/Nav.tsx`,
  `src/components/Footer.tsx`.
- `src/lib/product-types.ts`, `src/lib/facets.ts`, `src/lib/scent-profiles.ts`,
  `src/lib/landing-sections.ts`.
- `src/app/[locale]/collections/[slug]/page.tsx`,
  `src/app/[locale]/collections/page.tsx`, `src/app/[locale]/page.tsx`.
- `src/components/admin/CollectionForm.tsx`, `NewArrivalForm.tsx`,
  `AdminSearch.tsx`, `LandingSectionsEditor.tsx`, `fields.tsx`.
- `src/schemas/admin.ts`, `src/schemas/landing.ts`,
  `src/actions/admin/landing.ts`, `src/services/products.ts`,
  `src/services/admin/catalog.ts`.
- `next.config.ts` (`redirects()`), `src/lib/i18n/dictionaries/{en,ar}.ts`.

---

## AUDIT — what is actually there today

### A1. There is no Category entity

What the brief calls a **category** exists only as `public."CollectionKind"`, a
five-value enum on `"Collection"` (`FRAGRANCE`, `BODY`, `HOME`, `DISCOVERY`,
`GIFT`). It has no table, no row, no slug, no page, no editor beyond a `<select>`
in `CollectionForm.tsx`, and no i18n. A new category is an `alter type` plus code
edits — it cannot be created in the CMS at all.

### A2. Ranges are modelled as collections, so the hierarchy is flat

`body-care` and `home-fragrance` are **`Collection` rows**, not categories. Every
body product points at `collectionSlug = 'body-care'`. "Body Mist" is *not* a
collection — it is `"Product"."productType" = 'BODY_MIST'`, routed by the
code-owned table in `src/lib/product-types.ts`. So the brief's exact example
(Body Care → Body Mist, Body Cream) is today: one collection, one enum value, one
hand-written routing table, three dictionary keys, and a trigger. Adding "Body
Cream" requires an `alter type … add value` migration, an entry in
`PRODUCT_TYPES`, a Nav entry, and EN + AR copy. It is not a CMS action.

### A3. `/collections/[slug]` is a shared namespace with four resolvers

The segment is tried, in order, against: `"Collection"` rows →
`MERCH_PAGE_FACETS` (`best-sellers`) → `SCENT_PROFILE_SLUGS` (`oriental`,
`floral`, `fresh`, `woody`, `gourmand`) → `PRODUCT_TYPE_SLUGS` (`body-mist`,
`room-spray`). Three of those four are code-owned. **There is no guard stopping
an editor from creating a collection whose slug is `best-sellers` or `woody`** —
the DB row would win, and the code-owned page would silently disappear.

### A4. A new collection *does* already get a page — this part works

`getCollectionBySlug()` is the first resolver, `generateStaticParams()` enumerates
`getCollections()`, and the route is ISR at 600 s. So brief items 3 and 6 are
mostly satisfied already; what is missing is the *link* to it.

### A5. Navigation and Footer are 100% code-owned — this is the real defect

`src/constants/navigation-pages.ts` is a hand-written table of
`{ key, path }` pairs, where `key` indexes `Dictionary["nav"]["collectionItems"]`
and `path` is a **literal string** (`"/collections/signature"`). The Footer
derives from the same table. Nothing in `/admin` reads or writes it. There is no
`NavLink` table anywhere in `supabase/sql/`.

So: a collection created in the CMS is reachable, but **cannot be linked from
the Nav or the Footer without a code change plus EN and AR dictionary keys**.
That is precisely the brief's complaint, and no amount of restructuring the
catalogue fixes it on its own.

### A6. Hardcoded collection/category URLs found

| Site | What is hardcoded |
| :-- | :-- |
| `src/constants/navigation-pages.ts` | every Nav/Footer path; `RANGES` pins `body-care` / `home-fragrance` |
| `src/lib/product-types.ts` | `parentSlug: "body-care"` / `"home-fragrance"`, slugs, nav keys |
| `src/lib/facets.ts` | `CollectionFacet` is a **union of the seven shipped slugs** — a new collection is not a chip |
| `src/lib/scent-profiles.ts` | five slugs + banner map |
| `src/app/[locale]/collections/[slug]/page.tsx` | `categoryMeta()` switches on `kind` to pick dictionary copy; `MERCH_PAGE_BANNERS` fallback |
| `next.config.ts` | four legacy 308s (`/body-care`, `/room-fragrance`, `/discovery`, `/gift-set`) — **must survive** |
| `src/components/admin/CollectionForm.tsx` | kind labels quote stale routes (`/body-care`, `/discovery`, `/gift-set` no longer exist as pages) |

### A7. Relationship integrity

`Product → Collection` is a real FK onto `"Collection"(slug)` with
`on update cascade` — sound, and renaming a slug is safe. `Product → Category`
does not exist; it is reached transitively through the collection's `kind`.
No orphans are possible. No duplication found in the product↔collection edge.

### A8. Bug 1 — New Arrival never comes back

`src/app/[locale]/page.tsx:567` renders the band only when
`featuredProduct || (newArrival.showTitle && newArrival.title)`. The
"None — hide this band" option is on the **Featured product** select in
`NewArrivalForm.tsx`, not on the media switch. Once it is chosen,
`featuredProductSlug` is null, so the band renders only if a *title override* is
both switched on and non-empty — and switching Media back to Featured / Image /
Film changes nothing, because media is not in that condition. Exactly the
reported symptom. The band already has a real Show/Hide: its
`"LandingSection"."isEnabled"` row in `LandingSectionsEditor`.

### A9. Bug 2 — the banner depends on the header and the description

Same line, same condition. With no featured product, the only thing that can
make the band appear is `showTitle && title`, so an IMAGE or FILM banner with
both text switches off renders nothing at all. Media presence is not consulted.

### A10. Bug 4 — the products search

`AdminSearch` itself is sound (`ps-11 pe-10`, `max-w-md`). The overlap comes from
`src/app/[locale]/admin/products/page.tsx:60`, which passes the 41-character
placeholder `"Search by name, slug, SKU or collection"`. In a `max-w-md` field at
13 px with 44 px + 40 px of inset padding it collides with the leading icon and
runs under the clear button on tablet and mobile.

### A11. Bug 3 — Ingredients labels: ambiguous

Three candidates: the Nav/Footer "Ingredients" row (`world`), the dashboard
sidebar entry (`AdminShell.tsx:137`), and the PDP's Key Ingredients heading
(`ProductIngredients.tsx:38`). **Resolved by asking before implementing** — see
"Open question" below. No ingredient *data* is touched either way.

---

## Decisions

1. **Introduce a real `"Category"` table.** Slug, name, `name_ar`, description +
   `description_ar`, banner, sort order, `isEnabled`. `"Collection"` gains
   `"categorySlug"` — a FK onto `"Category"(slug)` with `on update cascade`,
   matching the existing slug-FK convention (`0001_catalog.sql`, deviation 2).
2. **Keep `"CollectionKind"`.** It is backfilled *from* the categories, still
   drives `product_type_matches_kind()` and `categoryMeta()`, and dropping it in
   the same change would risk the catalogue for no user-visible gain. It becomes
   a derived, deprecated column; a follow-up may retire it.
3. **`/collections/[slug]` serves categories too**, resolved **before**
   collections. `body-care` and `home-fragrance` become **category** pages at
   their existing URLs — no redirect, no SEO loss, and `next.config.ts`'s four
   308s keep landing on live pages.
4. **Product types become collections.** `body-mist` and `room-spray` are
   migrated from `"ProductType"` routing to real `"Collection"` rows under the
   Body Care / Home Fragrance categories, and the four affected products are
   repointed. This is what makes "Body Cream" a CMS action. `"Product"."productType"`
   is **kept and backfilled**, not dropped — the trigger stays, so nothing that
   reads it breaks — but `src/lib/product-types.ts` stops owning routes.
   A category page lists its collections *and* every product beneath them, so
   `/collections/body-care` still shows everything it shows today.
5. **Scent profiles and best-sellers stay code-owned.** They are cross-cutting
   cuts, and a product has exactly one collection, so they cannot be rows. They
   are protected instead — see 6.
6. **Reserved slugs are enforced in both places.** A Zod refusal in
   `src/schemas/admin.ts` and a `check` constraint listing the code-owned slugs,
   so a collection or category can never shadow a code-owned page.
7. **Navigation and Footer become data**: a `"NavLink"` table whose rows *point
   at* a category, a collection, or a known static page — never at a free-text
   URL. Labels are read from the target (`name` / `name_ar`), so a CMS-created
   collection is bilingual the moment it exists and no untranslated English can
   leak into the Arabic tree. Static-page targets keep their dictionary keys,
   from a closed enum.
8. **`navigation-pages.ts` becomes the seed and the fallback**, not the source.
   If the table is empty or unreachable, the Nav renders today's tree exactly —
   the same degradation posture as `resolveSectionOrder()`.

## Files likely to change

**New SQL** (`npm run db:migrate`, which signals the PostgREST reload):
- `supabase/sql/0045_category.sql` — `"Category"`, `"Collection"."categorySlug"`,
  backfill from `kind`, RLS, grants.
- `supabase/sql/0046_product_type_collections.sql` — Body Mist / Room Spray
  collections, product repointing, `productType` backfill kept consistent.
- `supabase/sql/0047_reserved_slugs.sql` — the check constraints.
- `supabase/sql/0048_navigation.sql` — `"NavLink"`, seeded from today's tree.

**Types / schemas / services**: `src/types/catalog.ts`,
`src/types/navigation.ts` (new), `src/schemas/admin.ts`,
`src/schemas/db/catalog.ts`, `src/schemas/navigation.ts` (new),
`src/services/products.ts`, `src/services/categories.ts` (new),
`src/services/navigation.ts` (new), `src/services/admin/catalog.ts`.

**Actions**: `src/actions/admin/catalog.ts` (categories CRUD),
`src/actions/admin/navigation.ts` (new), `src/actions/admin/landing.ts` (bug 1).

**Routes**: `src/app/[locale]/collections/[slug]/page.tsx`,
`src/app/[locale]/collections/page.tsx`, `src/app/[locale]/page.tsx` (bugs 1–2),
`src/app/[locale]/sitemap.ts`, `src/app/[locale]/admin/categories/**` (new),
`src/app/[locale]/admin/navigation/**` (new),
`src/app/[locale]/admin/products/page.tsx` (bug 4).

**Components**: `src/components/Nav.tsx`, `src/components/Footer.tsx`,
`src/components/ecommerce/CategoryView.tsx`,
`src/components/admin/CategoryForm.tsx` (new),
`src/components/admin/NavigationEditor.tsx` (new),
`src/components/admin/CollectionForm.tsx` (category select replaces kind),
`src/components/admin/NewArrivalForm.tsx`, `src/components/admin/AdminShell.tsx`.

**Constants / libs**: `src/constants/navigation-pages.ts` (demoted to seed),
`src/lib/product-types.ts` (routing removed), `src/lib/facets.ts`
(`CollectionFacet` widened from a literal union to a runtime slug),
`src/lib/i18n/dictionaries/{en,ar}.ts`.

## Implementation requirements

1. Migrations are idempotent, applied only through `npm run db:migrate`, and the
   run must print "PostgREST schema cache reload signalled" before anything is
   verified (`AGENTS.md` §9).
2. **No product loses its collection, and no URL that resolves today 404s
   after.** Every repointing is a targeted `update … where` with an explicit
   guard, never a blanket rewrite.
3. Zero `any`. Every DB read parsed with the existing Zod-at-the-edge pattern in
   `src/schemas/db/`.
4. Every read path degrades: a missing `"NavLink"` table or an unparseable row
   falls back to `navigation-pages.ts`; a missing `"Category"` row falls back to
   `kind`. A stale PostgREST cache must render the old tree, not a blank header.
5. Writes go through server actions behind `requireAdmin()`, then
   `revalidatePath()` for `/`, `/collections`, and the affected slug.
6. Dashboard UI follows the existing admin idiom exactly — `AdminShell`,
   `fields.tsx`, `FIELD_CLASS`, `rounded-none`, `font-heading text-[9px]
   uppercase tracking-[0.2em]`, `cubic-bezier(0.16,1,0.3,1)`, no bounce.
7. Storefront category pages reuse `CollectionView` / `CategoryView` typography
   and spacing; no new visual language, `py-24`/`py-32` rhythm preserved, RTL
   correct (logical properties only — `ps-*`/`pe-*`, never `pl-*`/`pr-*`).

### Bug fixes, precisely

- **Bug 1 & 2 — `src/app/[locale]/page.tsx:567`.** Replace the condition with
  one that asks whether the band has *anything to draw*: a featured product, or
  a resolved media asset (`IMAGE` + `imageUrl`, `FILM` + `videoUrl`), or a shown
  title, or a shown description. Visibility belongs to
  `"LandingSection"."isEnabled"` alone, which the page already honours through
  `shown.has("featured")`. Remove `{ value: "", label: "None — hide this band" }`
  from the Featured-product select in `NewArrivalForm.tsx`; the field becomes
  required, with the band's Show/Hide living in `LandingSectionsEditor` where the
  other nine bands' does. The media radio group keeps exactly its three values.
  `updateNewArrival` must reject an empty `featuredProductSlug` only when
  `mediaType` is `FEATURED` — an IMAGE/FILM band configured by hand is legal.
- **Bug 3 — Ingredients labels.** Scope fixed by the open question below.
  Ingredient rows, `"IngredientUsage"`, and `/ingredients` are untouched.
- **Bug 4 — `admin/products/page.tsx:60`.** Shorten the placeholder to
  `"Search products"`, and in `AdminSearch` add `text-ellipsis` handling plus a
  responsive width (`max-w-md` from `sm`, full width below) so no placeholder can
  run under either icon at any breakpoint.

## Security requirements

- Every new table gets RLS: public `select` on `"Category"` and `"NavLink"`
  (page structure, not customer data); **no** insert/update/delete policy for
  `anon`/`authenticated` — writes are service-role only, exactly as
  `0001_catalog.sql` and `0043` do.
- `revoke all … from public; grant select to anon, authenticated; grant all to
  service_role`.
- Nav targets are validated server-side against real rows before insert. Because
  a link is a *reference*, not a URL, an open-redirect through the CMS is
  structurally impossible — do not add a free-text href escape hatch.
- Slug inputs are validated with the existing `slugField` and the reserved list;
  never interpolated into SQL.

## Acceptance criteria

1. `Create Category → Create Collection under it → Add Products → Publish →
   add to Nav and Footer by selection → click → the right page opens`, with no
   URL typed anywhere in the flow.
2. Creating a collection named "Body Cream" under Body Care needs **zero** code
   changes and **zero** dictionary edits to be reachable and linked.
3. Every URL live today still resolves: the seven collection slugs,
   `/collections/best-sellers`, the five scent profiles, `/collections/body-mist`,
   `/collections/room-spray`, and the four legacy 308s in `next.config.ts`.
4. Every product still has exactly one collection, and every collection exactly
   one category. A verification query returning zero rows is part of the report.
5. A collection or category cannot be saved with a code-owned slug — refused by
   Zod with a readable message *and* by the database.
6. The New Arrival band reappears whenever it has media or copy, and its only
   visibility control is its Show/Hide row.
7. Nav and Footer render identically to today on first deploy, because the seed
   reproduces the current tree.
8. `npx tsc --noEmit` and `npm run lint` clean; no `any`; EN and AR dictionaries
   both complete.

## Checks to run

```
npm run db:migrate      # must print the PostgREST reload line
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`. Visit `/`, `/collections`, `/collections/signature`,
   `/collections/body-care`, `/collections/body-mist`,
   `/collections/best-sellers`, `/collections/woody`, `/ar/collections/body-care`.
   All 200, RTL correct.
2. `curl -I localhost:3000/body-care` → 308 to `/collections/body-care`. Repeat
   for `/room-fragrance`, `/discovery`, `/gift-set`.
3. Admin → Categories → New: "Test Category". Admin → Collections → New: "Test
   Collection", category = Test Category. Add an existing product to it.
4. Admin → Navigation: add Test Collection to the Nav under Test Category, and
   to the Footer. Save. Reload `/` — both appear, in EN and AR, with no typed URL.
   Click each; the collection page opens with its product.
5. Try saving a collection with slug `best-sellers` → refused. Try `woody` →
   refused.
6. Admin → Content → Landing → New Arrival: set Media = Image with a banner,
   switch Title and Description off, save. `/` shows the banner band. Switch the
   band off in Landing Sections → it disappears. Switch it on → it returns.
   Confirm the featured-product select has no "None" option.
7. Admin → Products: the search field on desktop, 768 px, and 375 px — no
   overlap, placeholder legible, typed text legible, clear button reachable.
8. Delete the test collection and category; confirm the Nav and Footer rows go
   with them and no orphan link 404s.

## Final audit to report after implementation

Counts of products per collection and collections per category before and after;
any collection with no category; any nav row pointing at a missing target; any
remaining hardcoded collection URL outside the seed file; and the surviving
code-owned slug list.

## Open question — answer before Bug 3 is implemented

"Remove the unnecessary Ingredients labels" has three possible targets: the
Nav/Footer **Ingredients** row, the **dashboard sidebar** Ingredients entry, or
the PDP's **Key Ingredients** heading. Ask, then implement only the named one.

## Suggested execution order

Phase 1 — bugs 1, 2, 4 (small, independent, shippable immediately).
Phase 2 — `"Category"` + category pages + admin Categories + reserved slugs.
Phase 3 — product types → collections migration.
Phase 4 — `"NavLink"` + admin Navigation + Nav/Footer read from data.
