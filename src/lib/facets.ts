/**
 * Merchandising cuts across the catalog — the `?facet=` view of `/collections`.
 *
 * These are the cuts that the collection filter cannot express: "best sellers"
 * and "limited editions" run across Signature, Noir, and Gemstone alike rather
 * than being a chapter of any one of them.
 *
 * ## URL-only, entered from the Nav and the Footer
 *
 * `/collections` renders exactly one filter row, and it is the collection filter
 * (see `<CollectionGrid>`). A facet is applied by *arriving* with the parameter
 * set — the Nav quick-access column and the Footer are the only places that
 * offer one — and the page names the active cut with a Clear control rather than
 * printing a second row of chips beside the first.
 *
 * A facet is derived, never stored twice: the `NEW_ARRIVAL` / `LIMITED_EDITION`
 * tags and the `isBestseller` column that already existed are combined here and
 * nowhere else. Adding a cut is an edit here and a label in the two dictionaries;
 * nothing in the grid changes.
 *
 * The four category cuts this module used to carry — gift sets, discovery sets,
 * body care, home fragrance — are gone: each is a collection, and the collection
 * filter now addresses it directly. Keeping both would have been two names for
 * one thing.
 */

import type { ProductCardData } from "@/src/types/catalog";

export type ProductFacet = "new-arrivals" | "best-sellers" | "limited";

/**
 * The valid values, and the order their labels are declared in. `parseFacet()`
 * narrows untrusted input against this list.
 */
export const FACET_ORDER: readonly ProductFacet[] = [
  "new-arrivals",
  "best-sellers",
  "limited",
];

/** The query parameter the cut is carried in, so a filtered view is linkable. */
export const FACET_PARAM = "facet";

/** Every facet a product belongs to. */
export function productFacets(product: ProductCardData): ProductFacet[] {
  const facets: ProductFacet[] = [];

  if (product.tags.includes("NEW_ARRIVAL")) facets.push("new-arrivals");
  if (product.isBestseller) facets.push("best-sellers");
  if (product.tags.includes("LIMITED_EDITION")) facets.push("limited");

  return facets;
}

/** Narrow an untrusted `?facet=` value; anything unknown means "no filter". */
export function parseFacet(value: string | null | undefined): ProductFacet | null {
  if (!value) return null;
  return FACET_ORDER.find((facet) => facet === value) ?? null;
}

/**
 * A linkable filtered view of the catalog, as a locale-agnostic app path —
 * `<LocaleLink>` prefixes it. Used by the Nav quick-access column and the
 * Footer, which is the whole reason the filter lives in the URL.
 */
export function facetHref(facet: ProductFacet): string {
  return `/collections?${FACET_PARAM}=${facet}`;
}
