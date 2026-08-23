# Nav — "Fragrances" submenu, Key Ingredients quick link, and the Gourmand family rename

## Goal

Three changes, two of them in the navigation and one in the ingredient taxonomy:

1. **Nav grouping.** `Signature Collection`, `Gemstone Collection` and `Noir Collection` stop
   being three siblings of `New Arrival` and become the children of a new **Fragrances**
   parent row that expands and collapses on a chevron. Applies to both nav surfaces — the
   desktop Collections mega-menu and the mobile drawer. The Footer keeps its present flat
   list of all six collections.
2. **Quick Access.** `Limited Editions` is replaced by **Key Ingredients**, pointing at
   `/ingredients`. The `/collections/limited-edition` page itself is untouched and stays
   reachable — only the menu row goes.
3. **Ingredients page.** The olfactive family currently named **"Fruity"** is renamed
   **"Gourmand"** — filter chip, card badges, and the record behind them.

## Skills read

None of the listed skills (`clerk`, `supabase`, `ai-sdk`) govern this work beyond the
Supabase migration conventions already established in `supabase/sql/`; the SQL below follows
the shape of the existing numbered migrations (idempotent, `if exists` guards, header
comment explaining the change). No Clerk or AI SDK surface is involved.

## Existing code inspected

- [src/components/Nav.tsx](../src/components/Nav.tsx) — mega-menu + drawer rendering of
  `collections` / `quickAccess` / `world`.
- [src/constants/navigation-pages.ts](../src/constants/navigation-pages.ts) — the three
  route tables, keyed into the dictionaries. Read by Nav **and** Footer.
- [src/components/Footer.tsx](../src/components/Footer.tsx#L35-L50) — flattens `collections`
  and `quickAccess` into one column.
- [src/lib/i18n/dictionaries/en.ts](../src/lib/i18n/dictionaries/en.ts#L60-L111) and
  [ar.ts](../src/lib/i18n/dictionaries/ar.ts#L60-L99) — `nav.collectionItems`,
  `nav.quickAccessItems`. `en.ts` is the `Dictionary` type source; `ar.ts` must satisfy it.
- [src/components/ingredients/IngredientExplorer.tsx](../src/components/ingredients/IngredientExplorer.tsx)
  — filter chips and badges render the family strings verbatim; no code-side label map.
- [src/types/content.ts](../src/types/content.ts#L44-L52) — the `IngredientFamily` union.
- [src/schemas/db/content.ts](../src/schemas/db/content.ts#L26-L34) — the mirroring
  `z.enum`; a row carrying an unknown family fails parse and is dropped.
- [supabase/sql/0002_content.sql](../supabase/sql/0002_content.sql#L33-L92) —
  `IngredientFamily` table plus the `assert_ingredient_families()` trigger that validates
  every `Ingredient.families` element against it.
- [supabase/seed/content.json](../supabase/seed/content.json) — `ingredientFamilies` rows,
  and `rose-absolute` is the single ingredient carrying `"Fruity"`.
- [src/lib/facets.ts](../src/lib/facets.ts#L121) — `MERCH_PAGE_FACETS` still routes
  `limited-edition`; unchanged.

## Decisions and assumptions

- **Confirmed with the user:** the Fragrances group appears in the nav only (both desktop
  and mobile), not in the Footer; and the parent row is a **toggle only** — a `<button>`
  that expands the three children, with nothing to navigate to of its own.
- `collections` gains an optional `children` field rather than a second parallel table, so
  the Footer can keep flattening one source and cannot drift from the nav.
- The group's own label is a new `nav.collectionGroups.fragrances` dictionary key, not a
  `collectionItems` entry — it has no `desc` and no path, so it is not the same shape.
- The group starts **collapsed** and is expanded by click. Collapsing is state on the Nav,
  reset the same way `menuOpen` already is when the path changes.
- **"Fruity" is a key, not a label.** `IngredientFamily.name` is the primary key the trigger
  validates against and the value stored in every `Ingredient.families` array, so renaming
  it is a data migration, not a copy edit. A display-only alias was rejected: it would leave
  the filter predicate, the badge, and the seed disagreeing about the family's name.
- Arabic: `Key Ingredients` gets a translation; the family name "Gourmand" is stored in
  `name` and has an optional `label_ar` column (added by `0008_i18n_content.sql`) which is
  `null` for every family today — it stays `null`, matching the other six.

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/constants/navigation-pages.ts` | `children` on collection entries; Fragrances group; `keyIngredients` replaces `limitedEditions` in `quickAccess` |
| `src/components/Nav.tsx` | Chevron disclosure in the mega-menu column and the drawer section |
| `src/components/Footer.tsx` | Flatten the new tree so the six collections still print flat |
| `src/lib/i18n/dictionaries/en.ts` | `nav.collectionGroups.fragrances`; `quickAccessItems.keyIngredients` replaces `limitedEditions` |
| `src/lib/i18n/dictionaries/ar.ts` | Same two keys, translated |
| `src/types/content.ts` | `"Fruity"` → `"Gourmand"` in the union |
| `src/schemas/db/content.ts` | `"Fruity"` → `"Gourmand"` in the `z.enum` |
| `supabase/seed/content.json` | Family row + `rose-absolute.families` |
| `supabase/sql/0019_gourmand_family.sql` | **New.** The rename migration |

## Implementation requirements

### 1. `navigation-pages.ts`

```ts
export type CollectionGroupKey = keyof Dictionary["nav"]["collectionGroups"];

export type CollectionEntry =
  | { kind: "link"; key: CollectionKey; path: string }
  | { kind: "group"; key: CollectionGroupKey; children: ReadonlyArray<{ key: CollectionKey; path: string }> };
```

Order, top to bottom: `newArrival`, the `fragrances` group (`signature`, `gemstone`,
`noir`), `bodyCare`, `homeFragrance`. Keep the file's existing doc-comment discipline —
explain *why* the three nest, and update the Quick Access comment, which currently justifies
`limitedEditions` as a cross-collection cut and would otherwise describe a row that no longer
exists.

`quickAccess` becomes `discoverySets`, `giftSets`, `bestSellers`, `keyIngredients`
(`/ingredients`).

### 2. `Nav.tsx`

- Extract the collection list into a small local component used by both the drawer section
  and the mega-menu column, parameterised by the two typography scales already in use
  (`text-sm` in the drawer, `text-[13px]` in the mega-menu) — do not fork the markup twice.
- The group row is a `<button type="button">` carrying `aria-expanded` and
  `aria-controls` pointing at the children's container `id`; the container gets
  `hidden`/`inert` semantics consistent with how the drawer already handles it, or is simply
  unmounted when collapsed.
- Chevron: `ChevronDown` from `lucide-react`, `strokeWidth={1.25}`, `width/height` 14–16,
  rotating 180° on expand — `transition-transform duration-400 ease-luxury-bezier`. No
  spring, no bounce. The chevron is `aria-hidden`.
- The children are indented one step (`ps-4`, RTL-safe logical property — never `pl-`) and
  keep the same label/desc pair the flat rows had.
- Expansion state is per-menu-surface local state on `Nav`, reset on path change the same way
  `menuOpen` / `drawerRequested` already are, so returning to a page does not find a menu
  half-open.
- Parent label styling matches a sibling collection row (`font-heading`, `tracking-widest`,
  `text-ivory`, gold on hover) so the group does not read as a different kind of thing.

### 3. `Footer.tsx`

Flatten `collections`: for a `group` entry, emit its children; the group label itself is
**not** printed. The footer's Collections column must still show the same six destinations
it shows today, in the same order.

### 4. Dictionaries

`en.ts`:
```ts
collectionGroups: { fragrances: "Fragrances" },
quickAccessItems: { …, keyIngredients: "Key Ingredients" },
```
`ar.ts`: `fragrances: "العطور"`, `keyIngredients: "المكوّنات الأساسية"`. Remove
`limitedEditions` from both. Keep `nav.collectionItems` untouched.

### 5. The Gourmand rename

`supabase/sql/0019_gourmand_family.sql`, idempotent and safe to re-run:

1. `insert into public."IngredientFamily" (name, "sortOrder") select 'Gourmand', "sortOrder" from public."IngredientFamily" where name = 'Fruity' on conflict (name) do nothing;`
   — the new row inherits the old row's position so the filter bar order does not shuffle.
2. `update public."Ingredient" set families = array_replace(families, 'Fruity', 'Gourmand') where 'Fruity' = any(families);`
   — must run **while both rows exist**, or `assert_ingredient_families()` rejects the write.
3. `delete from public."IngredientFamily" where name = 'Fruity';`

Add a header comment in the style of the surrounding migrations explaining the three-step
order and why it cannot be a single `update … set name =`.

Then: `"Fruity"` → `"Gourmand"` in `src/types/content.ts` and `src/schemas/db/content.ts`
(keeping the union's existing position/order), and in `supabase/seed/content.json` — both the
`ingredientFamilies` row and `rose-absolute.families` — so a fresh seed produces the renamed
taxonomy rather than resurrecting `Fruity`.

## Security requirements

- No new data reaches the client: the nav change is static route/label tables, and the
  ingredient rename touches an already-public, `select`-granted table.
- The migration is DDL/DML only — no RLS policy, grant, or `security definer` function is
  added or altered. `0002_content.sql`'s existing `anon`/`authenticated` select grants and
  RLS on `IngredientFamily` and `Ingredient` stay exactly as they are.
- No `any`; the `CollectionEntry` union is discriminated so an unhandled `kind` is a
  compile error.
- Nav remains a Client Component; no service-role key, no server import crosses into it.

## Acceptance criteria

- [ ] Desktop Collections mega-menu shows: New Arrival, **Fragrances ⌄**, Body Care, Home
      Fragrances — with Signature/Gemstone/Noir hidden until the chevron is clicked.
- [ ] Mobile drawer shows the same structure and behaves identically.
- [ ] The chevron rotates 180° on a linear/ease-out tween; no spring, no layout jump in the
      rows beneath.
- [ ] Expanding the group is keyboard-reachable and announces `aria-expanded`.
- [ ] Quick Access reads: Discovery Sets, Gift Sets, Best Sellers, **Key Ingredients**;
      the last navigates to `/ingredients` (`/ar/ingredients` under the Arabic locale).
- [ ] `/collections/limited-edition` still renders when visited directly.
- [ ] Footer's Collections column still lists all six collections, flat, unchanged in order.
- [ ] Both locales render every new label; no English string leaks into the Arabic tree.
- [ ] RTL: the group indent and the chevron mirror correctly under `dir="rtl"`.
- [ ] `/ingredients` filter bar reads **Gourmand** where it read Fruity, in the same
      position; selecting it still surfaces Rose Absolue, whose badge also reads Gourmand.
- [ ] No console warning, no hydration mismatch, no `any`.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/en`.
2. Click **Collections** in the header. Confirm four rows, with **Fragrances** carrying a
   chevron. Click it — Signature/Gemstone/Noir unfurl indented; the chevron rotates. Click
   again to collapse. Tab to the row and press Enter/Space: same behaviour.
3. Open one of the three children; confirm it navigates and the menu closes.
4. In the same mega-menu, confirm the Quick Access column's fourth row is **Key
   Ingredients** and lands on `/en/ingredients`.
5. Narrow the window below 1024px, open the burger drawer, and repeat steps 2–4 in the
   drawer's "Our Collections" and "Quick Access" sections.
6. Scroll to the Footer: all six collections still listed flat, no "Fragrances" heading.
7. Visit `/en/collections/limited-edition` directly — the page still renders.
8. Apply the migration (`supabase/sql/0019_gourmand_family.sql`) against the database, then
   reload `/en/ingredients`: the filter bar shows **Gourmand** in the old Fruity position.
   Click it — Rose Absolue is listed, and its badges read `Floral · Gourmand`.
9. Switch to `/ar` and repeat steps 2, 4, 5 — confirm Arabic labels, the mirrored indent,
   and a chevron that sits on the correct side.
