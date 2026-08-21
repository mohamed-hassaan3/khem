/**
 * The catalogue's filter vocabulary — the `?facet=` view of `/collections`.
 *
 * One row of chips, one parameter. A facet is either a **collection** (the
 * seven the house ships) or a **merchandising cut** that runs across all of
 * them (new arrivals, best sellers, limited editions). Both kinds share one
 * union because they share one control: from the visitor's side "Noir" and
 * "Best Sellers" are the same gesture, and giving them two rows and two
 * parameters was two names for one idea.
 *
 * ## Linkable, and written by the chips alone
 *
 * The chips write the parameter with `history.replaceState` (see
 * `<CollectionGrid>`), so every narrowed view has a URL to copy or return to.
 * Nothing in the app *links* to one any more — the Nav and the Footer address
 * collection pages, including the two merchandising pages below — but a
 * hand-typed or shared `?facet=` still works, and an unknown value resolves to
 * `null` and shows the whole catalogue rather than an empty grid.
 *
 * A facet is derived, never stored twice: the collection cuts read
 * `collectionSlug`, and the three merchandising cuts read the `NEW_ARRIVAL` /
 * `LIMITED_EDITION` tags and the `isBestseller` column that already existed.
 * Combining them happens here and nowhere else — adding a cut is an edit to
 * {@link FACET_ORDER} and a label in the two dictionaries; nothing in the grid
 * changes.
 */

import type { ProductCardData } from "@/src/types/catalog";

/** A collection, addressed as a filter rather than as a page. */
export type CollectionFacet =
  | "signature"
  | "gemstone"
  | "noir"
  | "body-care"
  | "home-fragrance"
  | "discovery"
  | "gift-set";

/** A cut that crosses collections — no `collectionSlug` can express it. */
export type MerchandisingFacet =
  | "new-arrivals"
  | "best-sellers"
  | "limited-edition";

export type ProductFacet = CollectionFacet | MerchandisingFacet;

/**
 * The valid values, in the order their chips are printed.
 *
 * Editorial, not alphabetical: the newest goods open the row and the two
 * merchandising cuts close it, with the collections themselves in between in
 * catalogue order. `parseFacet()` narrows untrusted input against this list, and
 * the dictionary's `collections.facets` is keyed by the same strings — one
 * spelling for the URL value, the chip label, and the match.
 */
export const FACET_ORDER: readonly ProductFacet[] = [
  "new-arrivals",
  "signature",
  "gemstone",
  "noir",
  "body-care",
  "home-fragrance",
  "discovery",
  "gift-set",
  "best-sellers",
  "limited-edition",
];

/** The query parameter the cut is carried in, so a filtered view is linkable. */
export const FACET_PARAM = "facet";

/**
 * Every facet a product belongs to, in {@link FACET_ORDER}.
 *
 * The `default` arm is the collection match: every remaining member of the union
 * *is* a collection slug, so the comparison needs no second table to fall out of
 * step with the seed.
 */
export function productFacets(product: ProductCardData): ProductFacet[] {
  return FACET_ORDER.filter((facet) => {
    switch (facet) {
      case "new-arrivals":
        return product.tags.includes("NEW_ARRIVAL");
      case "best-sellers":
        return product.isBestseller;
      case "limited-edition":
        return product.tags.includes("LIMITED_EDITION");
      default:
        return product.collectionSlug === facet;
    }
  });
}

/** Narrow an untrusted `?facet=` value; anything unknown means "no filter". */
export function parseFacet(
  value: string | null | undefined,
): ProductFacet | null {
  if (!value) return null;
  return FACET_ORDER.find((facet) => facet === value) ?? null;
}

/**
 * The merchandising cuts that also have a **page** of their own, at
 * `/collections/<facet>`.
 *
 * Best sellers and limited editions are what the Nav and the Footer link to, and
 * a link out of a menu should land somewhere that looks like a destination —
 * a hero, a name, a count — rather than on the catalogue with a filter silently
 * applied. So they are pages, assembled in `/collections/[slug]` from this list.
 *
 * They cannot be `Collection` rows: a product points at exactly one collection
 * (`"Product"."collectionSlug"`, `supabase/sql/0001_catalog.sql`), so seeding
 * "best sellers" would take those fragrances out of Signature and Noir. The
 * membership rule is `productFacets()` above, which is where it already was.
 *
 * `new-arrivals` is deliberately absent: it has `/new-arrival`, an editorial
 * showroom that prints each release's story and note pyramid in full, which is
 * more than a grid of cards.
 */
export const MERCH_PAGE_FACETS = ["best-sellers", "limited-edition"] as const;

export type MerchPageFacet = (typeof MERCH_PAGE_FACETS)[number];

/**
 * Narrow an untrusted `/collections/[slug]` segment to a merchandising page.
 *
 * Called only after the seeded collections have been tried, so a real slug can
 * never be shadowed by one of these.
 */
export function parseMerchPageFacet(slug: string): MerchPageFacet | null {
  return MERCH_PAGE_FACETS.find((facet) => facet === slug) ?? null;
}
