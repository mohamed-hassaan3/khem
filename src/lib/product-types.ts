/**
 * The product types — `/collections/body-mist` and `/collections/room-spray`.
 *
 * A product type is **what an object is**, as opposed to the range it is sold
 * under. Body Care and Home Fragrance are ranges; a Body Mist and a Room Spray
 * are the kinds of thing inside them. The Nav prints the range as a disclosure
 * and the types beneath it — see `src/constants/navigation-pages.ts`.
 *
 * ## Why the set lives in code
 *
 * The same reason `SCENT_PROFILE_SLUGS` and `MERCH_PAGE_FACETS` do: these pages
 * exist because this file routes them and the Nav links them. The enum in
 * `supabase/sql/0041_product_type.sql` names exactly the values below, so a
 * type that reached the database without reaching this file would be a page
 * with no route, and one that reached this file without the database would be a
 * page with no products. The enum and this table are the two halves of one
 * decision, and adding a third type means editing both — deliberately.
 *
 * ## Why membership is not derived
 *
 * Unlike a scent profile, which the schema can already answer through
 * `Ingredient` → `IngredientUsage`, nothing in the catalogue implies that a
 * given product is a mist rather than a cream. It is a fact about the object
 * that only a human knows, so it is stored — as `"Product"."productType"`, a
 * typed column, not as the display string in `format`.
 */

import type { CollectionKind } from "@/src/types/catalog";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";

/** The stored enum, mirroring `public."ProductType"`. */
export type ProductType = "BODY_MIST" | "ROOM_SPRAY";

/** The URL segment a type is addressed by, under `/collections/`. */
export type ProductTypeSlug = "body-mist" | "room-spray";

/**
 * One product type: its stored value, its page, and the range it belongs to.
 *
 * `parentKind` is what lets the Nav build its disclosures from this table
 * rather than from a second hand-kept list, and it is the same fact the
 * database trigger enforces — a `BODY_MIST` in a `HOME` collection is rejected
 * there, so these two can never quietly disagree.
 */
export interface ProductTypeEntry {
  slug: ProductTypeSlug;
  value: ProductType;
  parentKind: Extract<CollectionKind, "BODY" | "HOME">;
  /**
   * The range this type is sold under. The page inherits its banner from that
   * collection rather than carrying an image of its own — one photograph per
   * range, and a new type needs no new asset.
   */
  parentSlug: string;
  /** The dictionary key its page copy is written under. */
  copyKey: keyof Dictionary["collections"]["productTypes"];
  /** The dictionary key the Nav and Footer print its row under. */
  navKey: keyof Dictionary["nav"]["collectionItems"];
}

/** Every type the house sells, in the order the Nav prints them. */
export const PRODUCT_TYPES: readonly ProductTypeEntry[] = [
  {
    slug: "body-mist",
    value: "BODY_MIST",
    parentKind: "BODY",
    parentSlug: "body-care",
    copyKey: "bodyMist",
    navKey: "bodyMist",
  },
  {
    slug: "room-spray",
    value: "ROOM_SPRAY",
    parentKind: "HOME",
    parentSlug: "home-fragrance",
    copyKey: "roomSpray",
    navKey: "roomSpray",
  },
];

/** The slugs alone — `generateStaticParams()` wants a flat list. */
export const PRODUCT_TYPE_SLUGS: readonly ProductTypeSlug[] = PRODUCT_TYPES.map(
  (entry) => entry.slug,
);

/**
 * Narrow an untrusted `/collections/[slug]` segment to a product type.
 *
 * Called only after the seeded collections, the merchandising pages and the
 * scent profiles have been tried, so a real collection slug can never be
 * shadowed by one of these.
 */
export function parseProductTypeSlug(slug: string): ProductTypeEntry | null {
  return PRODUCT_TYPES.find((entry) => entry.slug === slug) ?? null;
}

/** The types belonging to one range, for the Nav's disclosures. */
export function productTypesForKind(
  kind: CollectionKind,
): readonly ProductTypeEntry[] {
  return PRODUCT_TYPES.filter((entry) => entry.parentKind === kind);
}
