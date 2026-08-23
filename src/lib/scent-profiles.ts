/**
 * The five scent profiles — `/collections/oriental|floral|fresh|woody|gourmand`.
 *
 * A profile is an **olfactive family, addressed as a page**. It is the way a
 * customer asks for a fragrance ("something woody") rather than the way the
 * house files its raw materials, and it is the second disclosure in the Nav's
 * collections column.
 *
 * ## Why the set lives in code
 *
 * The same reason `MERCH_PAGE_FACETS` does (`src/lib/facets.ts`): these pages
 * exist because this file routes them and `src/constants/navigation-pages.ts`
 * links them. `"ScentProfile"` (`supabase/sql/0020_scent_profile.sql`) stores
 * how a page introduces itself and which families it spans — a sixth row there
 * would be a page with no route, so the check constraint on that table names
 * exactly the slugs below.
 *
 * ## Why membership is not here, and not there either
 *
 * A profile's products are *derived*: the families below meet
 * `"Ingredient".families`, and `"IngredientUsage"` carries a real foreign key
 * from a material to the perfumes built on it. Nothing stores a product ↔
 * profile list, because the schema already answers that question — see
 * `getProductCardsByScentProfile()` in `src/services/products.ts`.
 */

import type { IngredientFamily } from "@/src/types/content";

/** The valid slugs, in the order the Nav and the profile pages print them. */
export const SCENT_PROFILE_SLUGS = [
  "oriental",
  "floral",
  "fresh",
  "woody",
  "gourmand",
] as const;

export type ScentProfileSlug = (typeof SCENT_PROFILE_SLUGS)[number];

/**
 * Narrow an untrusted `/collections/[slug]` segment to a profile.
 *
 * Called only after the seeded collections and the merchandising pages have
 * been tried, so a real slug can never be shadowed by one of these.
 */
export function parseScentProfileSlug(slug: string): ScentProfileSlug | null {
  return SCENT_PROFILE_SLUGS.find((profile) => profile === slug) ?? null;
}

/**
 * The olfactive families each profile spans — the floor under the stored row.
 *
 * Seven families are catalogued and five profiles are offered: four map one to
 * one, and `fresh` gathers the three the perfumer distinguishes but the visitor
 * does not. Nothing is left unreachable, and every family appears exactly once —
 * a material can therefore land in at most one profile, which is what keeps
 * {@link productScentProfiles} from printing the same page twice under a
 * product.
 *
 * Typed against {@link IngredientFamily}, so renaming a family — as
 * `supabase/sql/0019_gourmand_family.sql` renamed Fruity — is a compile error
 * here rather than a page that silently lists nothing.
 */
export const SCENT_PROFILE_FAMILIES: Record<
  ScentProfileSlug,
  readonly IngredientFamily[]
> = {
  oriental: ["Oriental Aromas"],
  floral: ["Floral"],
  fresh: ["Fresh / Citrus", "Aquatic Aromas", "Herbal"],
  woody: ["Woody Aromas"],
  gourmand: ["Gourmand"],
};

/**
 * The hero photographs of last resort.
 *
 * `"ScentProfile"` is seeded with exactly these five URLs and is where they now
 * live, editable without a deploy. They stay here as the floor under
 * {@link getScentProfile}: with no row, an unparseable row, or the database
 * unreachable, the page renders rather than fails. The host is already in
 * `next.config.ts`.
 */
export const SCENT_PROFILE_BANNERS: Record<ScentProfileSlug, string> = {
  oriental:
    "https://images.unsplash.com/photo-1667070796007-185faecdf8a1?w=1800&h=900&fit=crop&auto=format",
  floral:
    "https://images.unsplash.com/photo-1631189944771-466264f05965?w=1800&h=900&fit=crop&auto=format",
  fresh:
    "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1800&h=900&fit=crop&auto=format",
  woody:
    "https://images.unsplash.com/photo-1425913397330-cf8af2ff40a1?w=1800&h=900&fit=crop&auto=format",
  gourmand:
    "https://images.unsplash.com/photo-1471943311424-646960669fbc?w=1800&h=900&fit=crop&auto=format",
};

/** How many profiles a product detail page is willing to claim. */
const MAX_PRODUCT_PROFILES = 2;

/**
 * The profile, or two, a fragrance belongs to — for the PDP's "Scent Profile"
 * line.
 *
 * Read from the materials the perfume is actually built on (the same
 * `getIngredientsForProduct()` payload the Key Ingredients section renders), not
 * from the note pyramid, which names accords rather than sourced materials.
 *
 * **Two at most, and often one.** A perfume of any complexity touches four or
 * five families, and a row of five chips says nothing — it describes the
 * catalogue rather than the bottle. The two most-represented families win,
 * counted by how many of the perfume's materials belong to each, with
 * {@link SCENT_PROFILE_SLUGS} order breaking a tie so the answer is stable
 * across renders. A trailing profile carried by a single material is dropped
 * when a stronger one exists: one cedar note does not make a fragrance woody.
 */
export function productScentProfiles(
  ingredientFamilies: ReadonlyArray<readonly IngredientFamily[]>,
): ScentProfileSlug[] {
  const weight = new Map<ScentProfileSlug, number>();

  for (const families of ingredientFamilies) {
    // A material counts once per profile however many of that profile's
    // families it carries — an ingredient that is both aquatic and herbal is
    // one piece of evidence for "fresh", not two.
    const matched = new Set<ScentProfileSlug>();

    for (const family of families) {
      const profile = SCENT_PROFILE_SLUGS.find((slug) =>
        SCENT_PROFILE_FAMILIES[slug].includes(family),
      );
      if (profile) matched.add(profile);
    }

    for (const profile of matched) {
      weight.set(profile, (weight.get(profile) ?? 0) + 1);
    }
  }

  const ranked = SCENT_PROFILE_SLUGS.filter((slug) => (weight.get(slug) ?? 0) > 0)
    // A stable sort on a filtered copy of the canonical order: equal weights
    // keep that order, so the line does not reshuffle between renders.
    .sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0))
    .slice(0, MAX_PRODUCT_PROFILES);

  if (ranked.length < 2) return ranked;

  const [first, second] = ranked;
  const isPassing = (weight.get(second) ?? 0) > 1 || (weight.get(first) ?? 0) === 1;

  return isPassing ? ranked : [first];
}
