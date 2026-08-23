# Scent Profiles — nav restructure, sticky filter bar, and five profile pages

## Goal

Four connected changes, all downstream of one idea: **an olfactive family is a
way into the catalogue, and it deserves pages rather than an editorial detour.**

1. **Nav — Quick Access gains the two "everything" entry points.** `New Arrival`
   moves out of the Our Collections column into **Quick Access, as its first
   row**, and a new **All Products** row is added pointing at `/collections`.
2. **Nav — Key Ingredients leaves Quick Access** and comes back into the Our
   Collections column, *below* the `Fragrances` group, renamed **Scent
   Profiles** — a second chevron disclosure whose five children are **Oriental,
   Floral, Fresh, Woody, Gourmand**, each linking to
   `/collections/<profile-slug>`.
3. **`/collections` — the facet chip row sticks to the top of the viewport on
   scroll**, under the fixed header.
4. **Five new scent-profile pages** at `/collections/oriental|floral|fresh|woody|gourmand`:
   hero banner, profile name, a short evocative description, and the products
   built on materials of that olfactive family — **derived through the existing
   `Ingredient` → `IngredientUsage` → `Product` relation**, not stored twice.

## Skills read

None of the three approved skills (`clerk`, `supabase`, `ai-sdk`) carry
material for this task beyond what the repo already establishes — the work is
routing, nav constants, one Supabase migration, and a query in the existing
service layer, all with in-repo precedents cited below. The Supabase patterns
followed are the ones already written in `supabase/sql/0002_content.sql`,
`supabase/sql/0012_merch_page.sql`, and `src/services/content.ts`. The
auto-suggested `ai-sdk` / `chat-sdk` skills are not relevant: no AI surface is
touched.

## Existing code inspected

- `src/components/Nav.tsx` — `<CollectionsList>` already renders a
  discriminated `CollectionEntry` union with a `kind: "group"` disclosure, one
  open group at a time. A second group needs **no component change**.
- `src/constants/navigation-pages.ts` — `collections`, `collectionLinks`
  (flattened), `quickAccess`, `world`; keys are typed against the dictionary,
  so every table edit is a compile error until translated.
- `src/components/Footer.tsx` — renders `collectionLinks` + `quickAccess`, so
  the nav edit propagates to the footer sitemap automatically.
- `src/app/[locale]/collections/[slug]/page.tsx` — resolves a seeded
  `Collection` first, then falls through to `renderMerchPage()`, then `notFound()`.
  Carries `generateStaticParams` over `getCollections()` + `MERCH_PAGE_FACETS`.
- `src/lib/facets.ts` — `MERCH_PAGE_FACETS` / `parseMerchPageFacet()`: the
  precedent for "a code-owned closed set of slugs that are pages but cannot be
  `Collection` rows".
- `src/components/ecommerce/CollectionView.tsx` — `CollectionHeader` is
  deliberately structural (slug/name/description/bannerUrl/bannerAlt), so a page
  assembled in code renders as a collection page. **The profile pages need no
  new view component.**
- `src/components/ecommerce/CollectionGrid.tsx` — the chip `<nav aria-label=…>`
  block to be made sticky.
- `supabase/sql/0002_content.sql` — `"IngredientFamily"` (closed vocabulary,
  `sortOrder`), `"Ingredient".families text[]` guarded by the
  `assert_ingredient_families()` before-insert/update trigger, and
  `"IngredientUsage"(ingredientId, productSlug)` — a real FK to `"Product".slug`.
- `supabase/sql/0012_merch_page.sql` — the "stored presentation, derived
  membership, closed slug check constraint, `_ar` sibling columns, seed with
  `do nothing`" pattern this migration copies.
- `supabase/sql/0019_gourmand_family.sql` + `src/types/content.ts` — the seven
  live families: `Woody Aromas`, `Floral`, `Fresh / Citrus`, `Gourmand`,
  `Oriental Aromas`, `Aquatic Aromas`, `Herbal`.
- `src/schemas/db/catalog.ts` — `MERCH_PAGE_COLUMNS` / `toMerchPage()` and
  `resolveText()`; the shape `toScentProfile()` mirrors.
- `src/app/sitemap.ts`, `src/lib/i18n/dictionaries/{en,ar}.ts`.

## Decisions and assumptions

1. **Key Ingredients disappears from Quick Access entirely**, replaced by the
   Scent Profiles group. `/ingredients` is not withdrawn — it stays in *World of
   KHEM* (`world`, key `ingredients`) and in the sitemap, so the editorial page
   keeps a menu row; only the shopping column stops pointing at it.
2. **The five profiles are a code-owned closed set**, `src/lib/scent-profiles.ts`,
   exactly as `MERCH_PAGE_FACETS` is. The database stores how a profile
   *presents* itself (name, description, hero) and *which olfactive families it
   spans*; it never stores membership. Rationale is the `MerchPage` one: a
   product points at one collection, and a family cut runs across all of them.
3. **Profile → family mapping** (seeded into `"ScentProfile".families`, and
   duplicated as the code-level fallback):
   - `oriental` → `Oriental Aromas`
   - `floral` → `Floral`
   - `fresh` → `Fresh / Citrus`, `Aquatic Aromas`, `Herbal`
   - `woody` → `Woody Aromas`
   - `gourmand` → `Gourmand`
   `Herbal` and `Aquatic Aromas` fold into Fresh rather than going unreachable;
   the five names the brief gives are the vocabulary a customer thinks in, and
   the seven are the perfumer's.
4. **Membership is a two-step query, not an RPC**: ingredients overlapping the
   profile's families → their `usedIn.productSlug` set → product cards by slug.
   Keeps everything inside PostgREST and the existing service layer.
5. **A profile page with no products renders its hero and the grid's empty
   state**, never a 404 — the same rule `renderMerchPage()` already states: a
   menu link must not break because of a catalogue decision.
6. **`countsEverything` is `true`** on profile pages: an ingredient can be used
   in a body oil or a candle, so the count says "pieces", not "fragrances".
7. **The footer will list the five profiles** in its Collections column,
   because it flattens `collectionLinks`. That is the intended behaviour of that
   file ("a footer sitemap has nothing to disclose") and is left alone.
8. **The stored row wins whole or not at all** (the `MerchPage` rule): with the
   table empty, unparseable, or the database unreachable, the page renders from
   the dictionary + a `SCENT_PROFILE_BANNERS` constant.
9. **Sticky applies to the chip row only**, and only where the chip row is
   rendered (`/collections`, `showFacets`). The description/sort bar above it
   scrolls away normally.
10. No admin dashboard editor for `"ScentProfile"` in this pass — out of the
    stated scope. The table is seeded and editable in Supabase.

## Files likely to change

**New**
- `supabase/sql/0020_scent_profile.sql`
- `src/lib/scent-profiles.ts`

**Edited**
- `src/constants/navigation-pages.ts`
- `src/lib/i18n/dictionaries/en.ts`, `src/lib/i18n/dictionaries/ar.ts`
- `src/types/catalog.ts` (add `ScentProfile`)
- `src/schemas/db/catalog.ts` (`SCENT_PROFILE_COLUMNS`, `toScentProfile()`)
- `src/services/products.ts` (`getScentProfile()`, `getProductCardsByScentProfile()`)
- `src/app/[locale]/collections/[slug]/page.tsx`
- `src/components/ecommerce/CollectionGrid.tsx`
- `src/app/sitemap.ts`

`src/components/Nav.tsx` and `src/components/Footer.tsx` should need **no
edits** — verify that at the end; if either needs one, say why in the summary.

## Implementation requirements

### 1. `supabase/sql/0020_scent_profile.sql`

Idempotent, header comment in the voice of `0012_merch_page.sql`, explaining:
what the table is, why it is not a `Collection`, why the slug set is closed, and
why `families` is a `text[]` validated by a trigger rather than a junction table
(the `0002_content.sql` reasoning).

```
create table if not exists public."ScentProfile" (
  slug            text primary key
    constraint scent_profile_known_slug
    check (slug in ('oriental','floral','fresh','woody','gourmand')),
  name            text not null,
  description     text not null,
  "bannerUrl"     text not null,
  "bannerAlt"     text not null,
  families        text[] not null default '{}',
  name_ar         text,
  description_ar  text,
  "bannerAlt_ar"  text,
  "sortOrder"     int not null default 0,
  "updatedAt"     timestamptz not null default now()
);
```

- A `before insert or update` trigger reusing
  `public.assert_ingredient_families()` — the function is generic over
  `new.families`, so **reuse it, do not write a second copy**; confirm the
  signature works for this table (it reads only `new.families`), and if it does
  not, add a sibling function and say so.
- Seed the five rows with `on conflict (slug) do nothing`, in the brief's order
  (`sortOrder` 0–4): Oriental, Floral, Fresh, Woody, Gourmand — with English and
  Arabic name/description/bannerAlt, and an `images.unsplash.com` hero
  (`?w=1800&h=900&fit=crop&auto=format`, the size every other banner uses; host
  is already in `next.config.ts`).
- Grants: match whatever `0006_privileges.sql` does for the other read-only
  content tables (`select` to the anon/public role). Read that file first and
  follow it exactly; if it grants by loop over `information_schema`, nothing new
  is needed — state which.

Copy for the descriptions must be **evocative, not taxonomic** — the brief asks
for "a short story of feelings". Two to three sentences, KHEM's editorial
register (see the `MerchPage` seed copy for the target voice).

### 2. `src/lib/scent-profiles.ts`

Mirrors `src/lib/facets.ts` in shape and in comment density:

```ts
export const SCENT_PROFILE_SLUGS = ["oriental","floral","fresh","woody","gourmand"] as const;
export type ScentProfileSlug = (typeof SCENT_PROFILE_SLUGS)[number];
export function parseScentProfileSlug(slug: string): ScentProfileSlug | null;
/** The olfactive families each profile spans — the fallback when no row exists. */
export const SCENT_PROFILE_FAMILIES: Record<ScentProfileSlug, readonly IngredientFamily[]>;
/** Hero of last resort, exactly the URLs the migration seeds. */
export const SCENT_PROFILE_BANNERS: Record<ScentProfileSlug, string>;
```

Type `SCENT_PROFILE_FAMILIES` against `IngredientFamily` from
`src/types/content.ts` so a family rename is a compile error here. Watch for
import cycles — `src/types/content.ts` imports nothing from `lib/`, so this is
safe; do not import from `src/lib/facets.ts`.

### 3. Types + schema mapper

- `src/types/catalog.ts`: `ScentProfile` = `slug`, `name`, `description`,
  `bannerUrl`, `bannerAlt`, `families: string[]`, `sortOrder`. Document why
  `slug` is `string` here and the union lives in `lib/` — the same cycle note
  `MerchPage` already carries.
- `src/schemas/db/catalog.ts`: `SCENT_PROFILE_COLUMNS` and `toScentProfile(row, locale)`
  built exactly like `MERCH_PAGE_COLUMNS` / `toMerchPage()`, with `_ar` columns
  `.nullable().default(null)` and `resolveText()` on the three translatable fields.

### 4. Services (`src/services/products.ts`)

```ts
export async function getScentProfile(locale: Locale, slug: ScentProfileSlug): Promise<ScentProfile | null>
export async function getProductCardsByScentProfile(locale: Locale, families: readonly string[]): Promise<ProductCardData[]>
```

- `getScentProfile` mirrors `getMerchPage()` — single row, log-and-return-`null`
  on error, never throw.
- `getProductCardsByScentProfile`:
  1. `from("Ingredient").select("usedIn:IngredientUsage(productSlug)").overlaps("families", families)`
     — verify the embedded-relation alias matches the one
     `src/schemas/db/content.ts` already uses for `usedIn`; reuse that spelling.
  2. Collect a de-duplicated slug list. Empty ⇒ return `[]` without a second
     round trip.
  3. `getCatalogProductCards(locale)` filtered by that set, **or** a
     `PRODUCT_CARD_COLUMNS` select with `.in("slug", slugs)` — pick whichever
     matches the existing helpers in the file (`getProductCardsByCollection` is
     the reference) and keep catalogue order stable.
- Both log through the file's existing failure logger; no new error surface.

### 5. Route (`src/app/[locale]/collections/[slug]/page.tsx`)

- `generateStaticParams`: add `...SCENT_PROFILE_SLUGS` alongside `MERCH_PAGE_FACETS`.
- Resolution order stays **collection → merch page → scent profile → `notFound()`**,
  so no seeded slug can ever be shadowed. Add a `renderScentProfile(locale, slug)`
  beside `renderMerchPage`, with a doc comment stating the derivation rule and
  the "empty renders the hero, never a 404" decision.
- `generateMetadata`: the same fallthrough — after the merch-page branch, try
  the profile, using the stored row's `name`/`description` when present and the
  dictionary's `meta` block otherwise, through `localeMetadata({ path: "/collections/<slug>" })`.
- Render through `<CollectionView collection={header} products={…} countsEverything />`
  where `header` is the stored row, or the dictionary fallback, whole.

### 6. Nav constants (`src/constants/navigation-pages.ts`)

```ts
export const collections = [
  { kind: "group", key: "fragrances", children: [signature, gemstone, noir] },
  { kind: "group", key: "scentProfiles", children: [
      { key: "oriental",  path: "/collections/oriental"  },
      { key: "floral",    path: "/collections/floral"    },
      { key: "fresh",     path: "/collections/fresh"     },
      { key: "woody",     path: "/collections/woody"     },
      { key: "gourmand",  path: "/collections/gourmand"  },
  ]},
  { kind: "link", key: "bodyCare",       path: "/collections/body-care" },
  { kind: "link", key: "homeFragrance",  path: "/collections/home-fragrance" },
];

export const quickAccess = [
  { key: "newArrival",    path: "/new-arrival"            },
  { key: "allProducts",   path: "/collections"            },
  { key: "discoverySets", path: "/collections/discovery"  },
  { key: "giftSets",      path: "/collections/gift-set"   },
  { key: "bestSellers",   path: "/collections/best-sellers" },
];
```

Update the file's doc comments to describe the new shape and *why* — the column
is now the library (fragrance chapters, then the olfactive cuts, then the two
non-perfume ranges) while Quick Access is the ways *in* (newest, everything, the
sets, the popular). Do not leave a comment describing the old order.

### 7. Dictionaries (both `en.ts` and `ar.ts`)

- `nav.collectionItems`: **remove** `newArrival`; **add** `oriental`, `floral`,
  `fresh`, `woody`, `gourmand`, each `{ label, desc }` — one short evocative line
  each, matching the existing entries' length and register.
- `nav.collectionGroups`: add `scentProfiles: "Scent Profiles"` (+ Arabic).
- `nav.quickAccessItems`: **remove** `keyIngredients`; **add** `newArrival` and
  `allProducts`, in the printed order above.
- `collections.scentProfiles[slug]`: `{ name, description, bannerAlt, meta: { title, description, ogTitle, ogDescription } }`
  — the fallback copy, keyed like `collections.merchPages`. The Arabic tree must
  be complete; `Dictionary` is typed from `en.ts`, so a missing key fails typecheck.
- Nothing else in `dict.nav` changes.

### 8. Sticky filter bar (`src/components/ecommerce/CollectionGrid.tsx`)

Make the existing chip `<nav>` sticky under the fixed 80px header:

- add `sticky top-20` and a stacking context **below** the nav — the header is
  `z-1000`, its scrim `z-998`, the drawers `z-1001`; use `z-30`.
- the bar must stay legible over the grid scrolling beneath it: keep
  `border-b border-border`, and replace the flat `bg-surface` with the header's
  own treatment —
  `bg-[color-mix(in_srgb,var(--color-surface)_96%,transparent)] backdrop-blur-xl`.
- no layout shift, no transition on `position`, nothing added to the DOM.
- Update the component's doc comment: one short paragraph saying the row sticks
  because the catalogue is long and a filter you have to scroll back up to reach
  is a filter that gets used once.

### 9. Sitemap

Add the five profile paths to the dynamic loop that already emits
`MERCH_PAGE_FACETS` (priority `0.7` — below `/collections` at `0.9`, level with
the collections themselves; match whatever that loop assigns and follow it).

## Security requirements

- The `[slug]` segment is untrusted input: it is narrowed by
  `parseScentProfileSlug()` against a literal tuple before any query, and an
  unknown value 404s. No slug is ever interpolated into a query string.
- `families` passed to `.overlaps()` comes from the parsed/typed profile, never
  from the request.
- No new API route, no server action, no auth surface; all reads go through
  `getSupabasePublic()` (anon key, RLS-governed) exactly like the neighbouring
  services. Do not reach for the service-role client.
- Zod parses every row at the boundary (`toScentProfile`), and a parse failure
  degrades to the dictionary fallback rather than throwing into the page.

## Acceptance criteria

- [ ] Desktop mega menu and mobile drawer both show: **Our Collections** =
      Fragrances ▾ (3), Scent Profiles ▾ (5), Body Care, Home Fragrances; and
      **Quick Access** = New Arrival, All Products, Discovery Sets, Gift Sets,
      Best Sellers. Key Ingredients is gone from Quick Access.
- [ ] Both groups open/close independently of one another on both surfaces,
      collapse on navigation, and are `inert` while collapsed (unchanged behaviour).
- [ ] All Products lands on `/collections`; New Arrival on `/new-arrival`.
- [ ] `/collections/oriental|floral|fresh|woody|gourmand` each render a hero
      banner, the profile name, the short description, and a grid of the products
      whose catalogued ingredients belong to that profile's families.
- [ ] The count line reads in "pieces", and the breadcrumb reads Home › <Profile>.
- [ ] A profile with no matching products renders the hero + the grid empty state.
- [ ] An unknown `/collections/<slug>` still 404s; every seeded collection and
      both merchandising pages render exactly as before.
- [ ] On `/collections`, the chip row pins below the header while the grid
      scrolls under it, at every breakpoint, in both LTR and RTL, with no jump at
      the moment it sticks and no chip clipped.
- [ ] Arabic tree: every new label, description and meta block is translated;
      `/ar/collections/woody` renders RTL with Arabic copy.
- [ ] Footer's Collections column lists the five profiles; the sitemap emits all
      ten new URLs (5 × 2 locales) with `hreflang` alternates.
- [ ] `npm run lint` clean, `npx tsc --noEmit` clean, `npm run build` succeeds
      and prerenders the new `[slug]` params.

## Checks to run

```bash
npm run db:migrate      # applies 0020_scent_profile.sql
npm run db:verify       # if it enumerates tables, confirm ScentProfile is seen
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run db:migrate`, then in Supabase confirm
   `select slug, families, "sortOrder" from public."ScentProfile" order by "sortOrder";`
   returns five rows with the mapping in decision 3.
2. Confirm the trigger bites:
   `update public."ScentProfile" set families = '{Nonsense}' where slug = 'woody';`
   must raise `unknown olfactive family: Nonsense`. Roll back / re-set afterwards.
3. `npm run dev`. On `/` open the **Collections** mega menu — check both
   chevron groups, and that Quick Access reads New Arrival, All Products,
   Discovery Sets, Gift Sets, Best Sellers.
4. Narrow to <1024px, open the hamburger drawer, repeat step 3 inside it, and
   confirm a profile link closes the drawer and navigates.
5. Visit each of the five profile URLs. Cross-check one against the data:
   pick a product on `/collections/woody`, open its PDP, and confirm its
   "Key Ingredients" section lists a material whose family is `Woody Aromas`.
6. On `/collections`, scroll past the description bar — the chip row should pin
   under the header; press a chip while pinned and confirm the grid narrows and
   the URL gains `?facet=`. Repeat on a phone width and on `/ar/collections`.
7. Visit `/collections/not-a-real-thing` → 404. Visit `/collections/noir` and
   `/collections/best-sellers` → unchanged.
8. `curl -s localhost:3000/sitemap.xml | grep -c collections/woody` → `2`.
