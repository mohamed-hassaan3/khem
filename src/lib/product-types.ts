/**
 * The product types — what an object *is*.
 *
 * A product type is **what an object is**, as opposed to the shelf it is sold
 * from. A Body Mist and a Room Spray are kinds of thing; Body Care and Home
 * Fragrances are the categories they are sold under.
 *
 * ## This file no longer routes anything
 *
 * It used to. `/collections/body-mist` and `/collections/room-spray` were
 * assembled by `/collections/[slug]` from `PRODUCT_TYPES` and a query on this
 * column, because a product points at exactly one collection and making Body
 * Mist a collection would have emptied Body Care.
 *
 * `0045_category.sql` removed that constraint by giving Body Care a level of its
 * own, and `0046_range_collections.sql` turned Body Mist and Room Spray into
 * real `"Collection"` rows beneath it. Those two pages are now rows an editor
 * can rename, rewrite and photograph — and "Body Cream" is a row rather than an
 * `alter type` migration plus four code edits.
 *
 * What is left here is the column's vocabulary: the values, and which range each
 * belongs to. `"Product"."productType"` and its trigger are untouched, because
 * "this object is a mist" is still a true and useful fact that nothing else in
 * the schema records.
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

/**
 * The stored enum, mirroring `public."ProductType"` after
 * `0052_product_type_and_volume.sql`.
 *
 * Seven values doing one job — naming what an object *is*. The first five are
 * what the house sells beside its fragrances, added when the catalogue grew to
 * hold objects that are not measured in millilitres at all; the last two are the
 * original pair, which additionally name a range and are the only two with a
 * page of their own. See {@link PRODUCT_TYPES} for why that list is shorter than
 * this one.
 */
export const PRODUCT_TYPE_VALUES = [
  "PERFUME",
  "GIFT",
  "BOX",
  "ANTIQUE",
  "DECORATIVE",
  "BODY_MIST",
  "ROOM_SPRAY",
] as const;

export type ProductType = (typeof PRODUCT_TYPE_VALUES)[number];

/** The two that name a range, and so answer to a collection kind. */
export type RangeProductType = Extract<ProductType, "BODY_MIST" | "ROOM_SPRAY">;

/**
 * What the dashboard calls each value.
 *
 * English only, like every other admin string. Nothing on the storefront prints
 * a product type — a card states its concentration or its format line, which is
 * a different question — so there is no dictionary entry to keep in step.
 */
export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  PERFUME: "Perfume",
  GIFT: "Gift",
  BOX: "Box",
  ANTIQUE: "Antique",
  DECORATIVE: "Decorative item",
  BODY_MIST: "Body Mist",
  ROOM_SPRAY: "Room Spray",
};

/**
 * The types measured in millilitres, and so required to state a volume.
 *
 * The TypeScript twin of the rule `product_type_matches_kind()` enforces since
 * `0052_product_type_and_volume.sql`. The database is the authority; this exists
 * so the form can hide a field rather than let an editor discover the constraint
 * by tripping over it.
 */
const VOLUME_BEARING_TYPES: readonly ProductType[] = [
  "PERFUME",
  "BODY_MIST",
  "ROOM_SPRAY",
];

/**
 * Whether a product of this type must state a volume.
 *
 * `null` — a product saved before the column was offered, or one whose type an
 * editor has not chosen — keeps the original rule. Every row in the catalogue
 * predates the type and carries a volume, so treating "not stated" as
 * "measured" is what stops the whole catalogue becoming invalid on the way in.
 */
export function typeTakesVolume(type: ProductType | null): boolean {
  return type === null || VOLUME_BEARING_TYPES.includes(type);
}

/**
 * Whether a product of this type has a fragrance pyramid and a concentration.
 *
 * An antique has no top note. The three note lists and the concentration select
 * are hidden together because they answer the same question — what does this
 * smell of — and a type that has no answer to it should not be asked four
 * times.
 */
export function typeIsScented(type: ProductType | null): boolean {
  return type === null || type === "PERFUME" || VOLUME_BEARING_TYPES.includes(type);
}

/** Whether this type is a set, and so lists what it contains. */
export function typeHasContents(type: ProductType | null): boolean {
  return type === null || type === "GIFT" || type === "BOX";
}

/**
 * The slug of the collection this type is sold from.
 *
 * No longer a route this file owns — it is a `"Collection"` row's slug since
 * `0046_range_collections.sql` — but kept as the link between the column's
 * vocabulary and the shelf, which is what `parentSlug` below points at.
 */
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
  value: RangeProductType;
  parentKind: Extract<CollectionKind, "BODY" | "HOME">;
  /**
   * The **category** this type is sold under — `body-care`, `home-fragrance`.
   *
   * It named a collection before the restructure, because the range *was* one.
   * The value is unchanged: `0045` seeded each category at the slug its range
   * collection used to hold, precisely so nothing that pointed at it had to
   * move.
   */
  parentSlug: string;
  /** The dictionary key its page copy is written under. */
  copyKey: keyof Dictionary["collections"]["productTypes"];
  /** The dictionary key the Nav and Footer print its row under. */
  navKey: keyof Dictionary["nav"]["collectionItems"];
}

/**
 * The types that name a **range**, in the order the Nav prints them.
 *
 * Deliberately shorter than {@link PRODUCT_TYPE_VALUES}. An entry here means the
 * type has a `"Collection"` row, a page, a Nav disclosure and copy in both
 * dictionaries; `PERFUME`, `GIFT`, `BOX`, `ANTIQUE` and `DECORATIVE` have none
 * of those, because they describe an object rather than a shelf it is sold from.
 * Adding a value to the enum therefore does not oblige anybody to add a row
 * here, and the two lists are not out of step when they differ.
 */
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

/*
 * `PRODUCT_TYPE_SLUGS` and `parseProductTypeSlug()` were here, and are gone with
 * the routing they served: `/collections/[slug]` resolves these two addresses
 * from `"Collection"` now, so a narrowing function for them would be a second
 * answer to a question the database already answers.
 */

/** The types belonging to one range, for the Nav fallback's disclosures. */
export function productTypesForKind(
  kind: CollectionKind,
): readonly ProductTypeEntry[] {
  return PRODUCT_TYPES.filter((entry) => entry.parentKind === kind);
}
