# Nav double-click, ingredient links, ingredient filter removal, All Products relocation, merch bag control

## Goal

Five independent corrections, all in the storefront shell and the ingredient /
merchandise surfaces:

1. The desktop **Collections** (and **World of KHEM**) mega-menu buttons need two
   clicks to open after any in-menu navigation. Open on the first click.
2. On `/ingredients`, the "Found in" links inside an expanded ingredient card
   404 whenever the product is a home-fragrance or body-care item.
3. Remove the olfactive-family filter bar from `/ingredients`, and state exactly
   what in the database/schema is related to it (and what must stay).
4. Move **All Products** out of the Quick Access column into the **Our
   Collections** column, as its first row, above the *Fragrances* group.
5. Give the home-fragrance and body-care cards the corner shopping-bag control
   the perfume cards already have.

## Skills read

None of the three approved skills (`clerk`, `supabase`, `ai-sdk`) govern this
work: no auth surface, no new migration (see §3 below — the change is a widened
`select`, not a schema change), no AI. `AGENTS.md` read in full; the Vercel
plugin's auto-suggested `ai-sdk` / `vercel-services` skills are not relevant to
a nav/UI/query task and are not loaded.

## Existing code inspected

- `src/components/Nav.tsx` — `handleMenuToggle`, `activeMenu`, `CollectionsList`
- `src/constants/navigation-pages.ts` — `collections`, `collectionLinks`, `quickAccess`
- `src/components/Footer.tsx` — renders `collectionLinks` + `quickAccess`
- `src/lib/i18n/dictionaries/en.ts`, `ar.ts` — `nav.collectionItems`,
  `nav.quickAccessItems`, `ingredientsExplorer`
- `src/app/[locale]/ingredients/page.tsx`
- `src/components/ingredients/IngredientExplorer.tsx`
- `src/services/content.ts` — `getIngredients`, `getIngredientDetails`,
  `getIngredientFamilies`, `ALL_FILTER`
- `src/schemas/db/content.ts` — `INGREDIENT_COLUMNS`, `toIngredient`
- `src/types/content.ts` — `Ingredient`, `IngredientUsage`
- `src/lib/routes.ts` — `productHref`, `hasDetailPage`
- `src/components/ecommerce/MerchCard.tsx`, `MerchGrid.tsx`, `CategoryView.tsx`,
  `ProductCard.tsx`, `AddToBagButton.tsx`, `ProductFlag.tsx`
- `supabase/sql/0002_content.sql` — `IngredientFamily`, `Ingredient`,
  `IngredientUsage` (FK `productSlug → Product.slug`), the family-validating
  trigger; `0019_gourmand_family.sql`, `0020_scent_profile.sql`

## Diagnosis and decisions

### 1. The two-click menu

`activeMenu` is derived (`menuPath === pathname ? menuOpen : null`), but
`handleMenuToggle` toggles off the **raw** `menuOpen`. The desktop
`<CollectionsList>` passes no `onNavigate`, so after clicking a link inside the
mega menu `menuOpen` is still `"collections"` while `menuPath` is the previous
path — the menu renders closed, and the first click toggles the stale value back
to `null`. Fix: toggle against the derived `activeMenu`, not `menuOpen`.
One-line change; it fixes both mega menus at once.

### 2. `/ingredients` "Found in" 404s

`IngredientExplorer` hardcodes `href={`/perfume/${perfume.slug}`}`, but body-care
and home-fragrance products live at `/ritual/[slug]` and the sets have no detail
page at all (`src/lib/routes.ts`). Decision: carry the product's
`collectionKind` on `IngredientUsage` and render with `productHref()`, the one
place a catalog record becomes a link.

`"IngredientUsage"."productSlug"` is a real FK to `"Product".slug`, so the kind
comes from the existing embed with no extra round trip:

```
usedIn:IngredientUsage(name, productSlug, sortOrder, product:Product(collection:Collection(kind)))
```

No migration — this is a widened `select` against tables and grants that already
exist. If the embed is absent or unparseable the usage falls back to
`"FRAGRANCE"`, i.e. exactly today's behaviour, so a query change can never blank
the list.

### 3. Ingredient filter — what is related in the database

Removing the bar is a **UI + one dead service function**. The database side must
stay, and the prompt is explicit about why:

- `public."IngredientFamily"` (`0002_content.sql`, `label_ar` added in
  `0008_i18n_content.sql`, rows edited by `0019_gourmand_family.sql`) — **keep**.
  It is the closed vocabulary enforced on `"Ingredient".families` by the
  `assert_ingredient_families()` trigger, and it is the taxonomy the five scent
  profile pages are built on (`0020_scent_profile.sql`,
  `src/lib/scent-profiles.ts`).
- `"Ingredient".families` — **keep**. Still rendered as badges on every
  ingredient card, and still the join key for `getProductCardsByScentProfile()`.
- `src/services/content.ts#getIngredientFamilies()` — **delete**; the filter bar
  was its only caller.
- `ALL_FILTER` / `toFilterOptions()` in the same file — **keep**; the journal
  category bar still uses them.
- `nav`-level dictionary keys are untouched; `ingredientsExplorer.filterByFamily`
  (en + ar) — **delete**, its only consumer is the bar.

So: no migration, no schema file edit, no type change to `IngredientFamily`.

### 4. All Products

`collections` in `navigation-pages.ts` gains `{ kind: "link", key: "allProducts",
path: "/collections" }` as its first entry, and `quickAccess` loses its
`allProducts` row. `CollectionKey` is `keyof Dictionary["nav"]["collectionItems"]`,
so `allProducts` must be added there (label + desc, en + ar) and removed from
`quickAccessItems` — otherwise it typechecks as a missing/orphan key. The Footer
derives both columns from these tables, so it follows with no edit.

### 5. Bag control on merch cards

`<MerchCard>` is already a Client Component with a `relative` root, so
`<AddToBagButton>` drops straight in as a sibling of the image link — same
component the perfume cards use, so the two controls cannot drift. It sits at
`end-5 top-5`; `<ProductFlag>` sits at `start-5 top-5`, so they do not collide.
The existing full-width add button stays: it is the card's primary buy control
and reports its own "Added" state.

## Files likely to change

- `src/components/Nav.tsx`
- `src/constants/navigation-pages.ts`
- `src/lib/i18n/dictionaries/en.ts`, `src/lib/i18n/dictionaries/ar.ts`
- `src/app/[locale]/ingredients/page.tsx`
- `src/components/ingredients/IngredientExplorer.tsx`
- `src/services/content.ts`
- `src/schemas/db/content.ts`
- `src/types/content.ts`
- `src/components/ecommerce/MerchCard.tsx`

## Implementation requirements

1. **Nav** — `handleMenuToggle` closes only when the menu is the *rendered* open
   one: `setMenuOpen(activeMenu === menu ? null : menu)`. Keep `setMenuPath`.
   Add a short comment naming the stale-state trap so it is not reintroduced.
2. **Ingredient links** — widen `INGREDIENT_COLUMNS`; parse the nested embed
   with the same union-of-object-or-array tolerance `catalog.ts` uses for
   PostgREST embeds; extend `IngredientUsage` with `collectionKind:
   CollectionKind`; render `productHref(usage)` in `IngredientExplorer`. Do not
   import `src/services/*` into the client component.
3. **Filter removal** — delete the sticky filter bar, `activeFamily`,
   `matchesFamily`, `handleFamilyChange`, the `families` prop and the deep-link
   "widen the filter" branch (a deep link now always resolves). The
   `?ingredient=` deep link, scroll-into-view, row-reordering and expand/collapse
   behaviour must all survive unchanged, now driven by the full record list.
   Drop `getIngredientFamilies()` and the `filterByFamily` dictionary keys.
   The family badges on the cards stay.
4. **All Products** — as decided above; label "All Products" / "كل المنتجات",
   desc in the register of the neighbouring entries. Verify the Footer prints it
   exactly once.
5. **Merch bag** — `<AddToBagButton productId={product.id} name={product.name}
   inventory={product.inventory} />` inside `<MerchCard>`'s root, after the flag.

Comment density, tone and JSDoc style must match the surrounding files; update
the doc comments that currently describe removed behaviour (the
`IngredientExplorer` header, the `navigation-pages.ts` `quickAccess` /
`collections` headers, `0002_content.sql`'s "filter bar" wording is a historical
migration and stays untouched).

## Security requirements

- No new table, policy or grant; reads stay on the publishable key so RLS applies.
- The widened embed selects one column (`kind`) through existing FKs; archived or
  RLS-hidden products degrade to the fragrance fallback rather than leaking a row.
- The `?ingredient=` value stays untrusted and matched against known slugs.
- No `any`; every parsed row still goes through Zod.

## Acceptance criteria

- One click opens either mega menu, from any page, including immediately after
  navigating from inside a mega menu.
- Every "Found in" link on `/ingredients` resolves: fragrances to `/perfume/…`,
  body care and home fragrance to `/ritual/…`, sets to their category page.
- `/ingredients` shows no filter bar; all ingredients render; deep links still
  open and centre their card.
- "All Products" is the first row of Our Collections in both the desktop mega
  menu and the mobile drawer, above Fragrances, and no longer in Quick Access,
  in both locales.
- Body-care and home-fragrance cards show the corner bag control; clicking it
  adds one unit and opens the cart drawer without navigating.
- `npx tsc --noEmit` and `next lint` clean.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` if the two above pass quickly

## Manual test steps

1. `npm run dev`, open `/en`. Click **Collections** → opens. Click a link inside
   it → navigate. Click **Collections** again → it must open on that click.
   Repeat for **World of KHEM** and for `/ar`.
2. `/en/collections/signature` → same one-click test (the reported page).
3. `/en/ingredients`: no filter bar. Expand an ingredient used in a candle or a
   body oil; every "Found in" link opens a real page, none 404.
4. `/en/ingredients?ingredient=oud` → that card is open and centred on load.
5. Mega menu and mobile drawer (≤1024px): **All Products** first under Our
   Collections, absent from Quick Access; footer lists it once.
6. `/en/collections/home-fragrance` and `/en/collections/body-care`: bag icon top
   corner of each card; click adds one line and opens the cart drawer, page does
   not navigate; check RTL mirroring on `/ar`.
