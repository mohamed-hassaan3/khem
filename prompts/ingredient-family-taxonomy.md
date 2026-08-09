# Prompt — Ingredient Olfactive Family Taxonomy (7 canonical families)

## Goal

Reduce the `/ingredients` filter bar to exactly seven olfactive families and re-map every
ingredient record onto that closed vocabulary, so the filter chips, the card badges, and the
filter predicate all speak the same language.

Canonical order (as specified by the user, after `All`):

1. Woody Aromas
2. Floral
3. Fresh / Citrus
4. Fruity
5. Oriental Aromas
6. Aquatic Aromas
7. Herbal

## Skills read

None required — no Clerk, Supabase, or AI SDK surface is touched. This is local seed data
(`src/data/content.ts`) plus a Server Component → Client Component prop.

## Existing code inspected

- `src/data/content.ts` → `INGREDIENTS` (8 records, free-form `families` arrays: Woody, Resinous,
  Balsamic, Spicy, Warm, Leathery, Floral, Citrus, Green, Animalic, Marine, Sweet, Earthy, Smoky,
  Honeyed, Velvety, Powdery, Dark — 18 distinct labels)
- `src/services/content.ts` → `getIngredientFamilies()`, currently `toFilterOptions(flatMap(families))`
  (distinct, first-seen order)
- `src/app/ingredients/page.tsx` → Server Component, awaits both queries, passes `families` down
- `src/components/ingredients/IngredientExplorer.tsx` → filter bar + card badges + detail panel
- `src/types/content.ts` → `Ingredient.families: string[]`

## Decisions / assumptions

- **Closed vocabulary, not derived-from-data.** `getIngredientFamilies()` currently derives the list
  from the records, which cannot guarantee the requested order or the seven-item cap. It will return
  `[ALL_FILTER, ...INGREDIENT_FAMILIES]` from a new exported constant in `src/data/content.ts`, keeping
  the service the single query seam (→ later `supabase.from('IngredientFamily').select('name').order('sortOrder')`).
- The taxonomy is a **display-facing label set**; it stays a `string[]` on `Ingredient` (no enum),
  matching how `Product.topNotes` is a Prisma `String[]`. A `IngredientFamily` union type is added in
  `src/types/content.ts` and `families` is typed `IngredientFamily[]` so a typo fails typecheck.
- The old descriptor words that no longer survive as filters (Resinous, Balsamic, Leathery, Powdery,
  Animalic, …) are **dropped from `families`, not relocated** — they already read in the prose
  `description` of each record, and duplicating them as badges would re-introduce an open vocabulary.
- Each ingredient keeps 1–2 families so the card badge row stays visually quiet.

## Family assignment (derived from the reference article's definitions)

| Ingredient | Current families | New families | Rationale |
| :-- | :-- | :-- | :-- |
| Oud | Woody, Resinous | **Woody Aromas, Oriental Aromas** | warm/deep resinous heartwood — the article's "warm, exotic, sensual" resin profile |
| Frankincense | Resinous, Balsamic | **Oriental Aromas, Woody Aromas** | temple resin: warm, sacred, slightly spicy |
| Saffron | Spicy, Warm, Leathery | **Oriental Aromas** | "warm, exotic, sensual… vanilla, amber, cinnamon, resin" bracket |
| Neroli | Floral, Citrus, Green | **Floral, Fresh / Citrus** | bitter-orange blossom: honeyed floral over a bergamot-adjacent citrus |
| Ambergris | Animalic, Marine, Sweet | **Aquatic Aromas, Oriental Aromas** | marine/ozonic origin, sweet ambered depth |
| Haitian Vetiver | Earthy, Smoky, Woody | **Woody Aromas, Herbal** | distilled grass root — the article's "herbs and leaves… fresh yet masculine" |
| Rose Absolue | Floral, Honeyed, Velvety | **Floral, Fruity** | Rosa damascena's wine-like, jammy facet |
| Black Iris | Woody, Powdery, Dark | **Floral, Woody Aromas** | a bloom, read through its powdery-woody orris facet |

Coverage check: all seven filters return ≥ 1 ingredient (Fruity → Rose Absolue only;
Fresh / Citrus → Neroli only), so no chip is ever a dead end.

## Files likely to change

- `src/data/content.ts` — add `export const INGREDIENT_FAMILIES`, rewrite the 8 `families` arrays
- `src/types/content.ts` — add `IngredientFamily` union, retype `Ingredient.families`
- `src/services/content.ts` — `getIngredientFamilies()` returns the canonical ordered list
- `src/components/ingredients/IngredientExplorer.tsx` — no change expected; the filter bar already
  maps `families` and the predicate is already case-insensitive `.some()`. Verify only.

## Implementation requirements

- Zero `any`; the union type must be exported from `src/types/content.ts` and imported where used.
- `INGREDIENT_FAMILIES` typed `readonly IngredientFamily[]` (or `as const`) so order is the source of truth.
- `getIngredientFamilies()` keeps its `Promise<string[]>` signature and its `ALL_FILTER` prefix so
  `IngredientExplorer` needs no prop-shape change.
- Keep the existing doc-comment style, including the `→ supabase…` query hints.
- Do not touch journal categories, `toFilterOptions`, or the home page ingredient rail.

## Security requirements

None beyond the existing boundary: `src/services/content.ts` stays server-side only; the client
component continues to receive plain serializable props and never imports the service.

## Acceptance criteria

- Filter bar renders exactly: `All`, `Woody Aromas`, `Floral`, `Fresh / Citrus`, `Fruity`,
  `Oriental Aromas`, `Aquatic Aromas`, `Herbal` — in that order.
- Every filter yields a non-empty grid; `All` yields all 8 ingredients.
- Card badges show only labels from the canonical seven.
- Selecting an ingredient then switching to a family that excludes it closes the detail panel
  (existing `handleFamilyChange` behavior, unregressed).
- A typo in any `families` entry is a TypeScript error.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/ingredients`.
2. Confirm the sticky filter bar lists the eight chips in the exact order above.
3. Click each family chip; confirm a non-empty grid and that every visible card carries that badge.
4. With `All` active, open **Rose Absolue**, then click **Woody Aromas** — the detail panel must close.
5. Open **Oud** under **Woody Aromas**, then click **Oriental Aromas** — the panel must stay open.
6. Narrow the viewport to 375px; the filter bar must scroll horizontally without wrapping.
