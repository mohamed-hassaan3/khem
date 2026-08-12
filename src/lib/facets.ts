/**
 * Merchandising facets — the filter chips on `/collections`.
 *
 * `/collections` is the one screen that holds the entire catalog, so it needs a
 * vocabulary the collection tab bar cannot express: "new arrivals" cuts across
 * Signature and Noir, "gift sets" is a whole kind rather than a chapter of the
 * perfume library.
 *
 * A facet is derived, never stored twice. Three inputs feed it — the
 * `NEW_ARRIVAL` / `LIMITED_EDITION` tags, the `isBestseller` column that
 * already existed, and the parent collection's kind — and this module is the
 * only place they are combined. Adding a facet is an edit here and a label in
 * the two dictionaries; nothing in the grid changes.
 */

import type { ProductCardData } from "@/src/types/catalog";

export type ProductFacet =
  | "new-arrivals"
  | "best-sellers"
  | "limited"
  | "gift-sets"
  | "discovery-sets"
  | "body-care"
  | "home-fragrance";

/**
 * Chip order, left to right: merchandising first (what a visitor is most likely
 * to be hunting), then the categories that have their own route.
 */
export const FACET_ORDER: readonly ProductFacet[] = [
  "new-arrivals",
  "best-sellers",
  "limited",
  "gift-sets",
  "discovery-sets",
  "body-care",
  "home-fragrance",
];

/** The query parameter the chips write to, so a filtered view is linkable. */
export const FACET_PARAM = "facet";

/** Every facet a product belongs to. */
export function productFacets(product: ProductCardData): ProductFacet[] {
  const facets: ProductFacet[] = [];

  if (product.tags.includes("NEW_ARRIVAL")) facets.push("new-arrivals");
  if (product.isBestseller) facets.push("best-sellers");
  if (product.tags.includes("LIMITED_EDITION")) facets.push("limited");

  /*
   * Exhaustive against `CollectionKind`: a sixth kind fails to compile here
   * rather than quietly landing in the grid with no chip that can reach it.
   */
  switch (product.collectionKind) {
    case "GIFT":
      facets.push("gift-sets");
      break;
    case "DISCOVERY":
      facets.push("discovery-sets");
      break;
    case "BODY":
      facets.push("body-care");
      break;
    case "HOME":
      facets.push("home-fragrance");
      break;
    case "FRAGRANCE":
      break;
    default: {
      const unreachable: never = product.collectionKind;
      return unreachable;
    }
  }

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
