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
 * how a page introduces itself — a sixth row there
 * would be a page with no route, so the check constraint on that table names
 * exactly the slugs below.
 *
 * ## Membership has its own relation
 *
 * Products are assigned explicitly through `ScentProfileProduct`.
 */

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
