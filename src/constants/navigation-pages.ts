import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { productTypesForKind } from "@/src/lib/product-types";

/**
 * Navigation structure — routes only, no display copy.
 *
 * Labels and descriptions live in the dictionaries and are looked up by `key`,
 * so adding a nav entry without translating it is a compile error rather than
 * an English string leaking into the Arabic tree.
 *
 * Paths are locale-agnostic; `<LocaleLink>` prefixes them at render time.
 *
 * The Nav and the Footer both render these three tables, which is what makes
 * "the footer navigates the same as the nav" structural rather than a copied
 * list that drifts on the next edit.
 */

export type CollectionKey = keyof Dictionary["nav"]["collectionItems"];
export type CollectionGroupKey = keyof Dictionary["nav"]["collectionGroups"];
export type QuickAccessKey = keyof Dictionary["nav"]["quickAccessItems"];
export type WorldKey = keyof Dictionary["nav"]["worldItems"];

/** A destination in the collections column. */
export interface CollectionLink {
  key: CollectionKey;
  path: string;
}

/**
 * One row of the collections column: either a destination, or a named group of
 * destinations that the nav prints behind a chevron.
 *
 * A discriminated union rather than an optional `children`, so a renderer that
 * forgets to handle a group fails typecheck instead of printing a row with no
 * href. The Footer flattens groups away entirely — see its `collectionLinks`.
 */
export type CollectionEntry =
  | ({ kind: "link" } & CollectionLink)
  | {
      kind: "group";
      key: CollectionGroupKey;
      children: ReadonlyArray<CollectionLink>;
    };

/**
 * The "Our Collections" column — the library, in three links and two disclosures.
 *
 * Every collection lives under `/collections/[slug]`; body care, home fragrance
 * and the sets used to hold routes of their own, and folding them in removed the
 * second URL for the same goods.
 *
 * The column is *the shelf*. All Products opens it — a column of chapters needs
 * a row that means "all of it", and `/collections` is the one screen every
 * product is reachable from, so it belongs at the top of the shelf rather than
 * among the ways in. Signature, Gemstone and Noir sit under `fragrances`; the
 * five olfactive cuts sit under `scentProfiles`; the two non-perfume ranges
 * close it. What stays out is what a shopper reaches for rather than browses —
 * New Arrival and the sets — which live in Quick Access below.
 *
 * Both groups are disclosures, not pages: there is nothing at "Fragrances" or at
 * "Scent Profiles" to navigate to that the rows underneath do not say better.
 * The Footer flattens both back out — its column is a sitemap, where a heading
 * that is not a link is noise.
 *
 * Scent profiles are pages, not `?facet=` cuts, and each one is a real
 * destination: a hero, a name, a short piece of writing, and the products built
 * on materials of that family. Membership is derived through
 * `"Ingredient"` → `"IngredientUsage"`; see `src/lib/scent-profiles.ts`.
 */
/**
 * The two non-fragrance ranges, and the three dictionary keys each one needs.
 *
 * Written here rather than in `src/lib/product-types.ts` because these are
 * *navigation* facts — which heading the disclosure prints and which row means
 * "the whole range" — and that file is about the catalogue. It knows the types;
 * this knows how the menu says them.
 */
const RANGES = {
  BODY: {
    slug: "body-care",
    groupKey: "bodyCare",
    allKey: "bodyCare",
  },
  HOME: {
    slug: "home-fragrance",
    groupKey: "homeFragrance",
    allKey: "homeFragrance",
  },
} as const satisfies Record<
  "BODY" | "HOME",
  { slug: string; groupKey: CollectionGroupKey; allKey: CollectionKey }
>;

export const collections: ReadonlyArray<CollectionEntry> = [
  { kind: "link", key: "allProducts", path: "/collections" },
  {
    kind: "group",
    key: "fragrances",
    children: [
      { key: "signature", path: "/collections/signature" },
      { key: "gemstone", path: "/collections/gemstone" },
      { key: "noir", path: "/collections/noir" },
    ],
  },
  {
    kind: "group",
    key: "scentProfiles",
    children: [
      { key: "oriental", path: "/collections/oriental" },
      { key: "floral", path: "/collections/floral" },
      { key: "fresh", path: "/collections/fresh" },
      { key: "woody", path: "/collections/woody" },
      { key: "gourmand", path: "/collections/gourmand" },
    ],
  },
  /*
   * The two ranges, as disclosures rather than as links.
   *
   * Each holds goods of more than one kind — a Body Mist today, a Body Cream
   * later — and those kinds are now addressable, because `"Product"` carries a
   * typed `"productType"` (`supabase/sql/0041_product_type.sql`). The children
   * are generated from `PRODUCT_TYPES` rather than written out here, so adding
   * a type is one row in `src/lib/product-types.ts` plus its copy, and this
   * table follows on its own.
   *
   * The range keeps its own page as the first child. `fragrances` and
   * `scentProfiles` are disclosures with nothing behind the heading, but
   * `/collections/body-care` is a real editorial page and dropping it from the
   * menu would strand it — so it is printed as "All Body Care" beneath its own
   * heading, the way `allProducts` opens the column above.
   */
  ...(["BODY", "HOME"] as const).map((kind) => {
    const range = RANGES[kind];

    return {
      kind: "group" as const,
      key: range.groupKey,
      children: [
        { key: range.allKey, path: `/collections/${range.slug}` },
        ...productTypesForKind(kind).map((type) => ({
          key: type.navKey,
          path: `/collections/${type.slug}`,
        })),
      ],
    };
  }),
];

/**
 * The collections column with its groups flattened, in printed order.
 *
 * The Footer's sitemap and the search index want the destinations, not the
 * shape the menu gives them. Derived rather than kept as a second table, so the
 * two surfaces cannot come to disagree about which collections exist.
 */
export const collectionLinks: ReadonlyArray<CollectionLink> = collections.flatMap(
  (entry) => (entry.kind === "group" ? entry.children : [entry]),
);

/**
 * The "Quick Access" column — the ways in, in the order they are printed.
 *
 * New Arrival opens it: the newest work is what a returning visitor came for,
 * and `/new-arrival` is an editorial showroom with the full story and note
 * pyramid of each release, which the catalogue grid has nowhere to put. All
 * Products used to sit beneath it and is now the first row of the collections
 * column above, where the shelf it stands for belongs.
 *
 * Then the two set categories, which are ways of buying rather than chapters of
 * the library, and Best Sellers, which crosses every collection at once and so
 * could never be a row in the column above — it is assembled in
 * `/collections/[slug]` from the catalogue (`MERCH_PAGE_FACETS` in
 * `src/lib/facets.ts`). Either way a menu link lands on a page with a hero and a
 * name, never on the catalogue with a filter silently applied.
 *
 * Key Ingredients is no longer here: the olfactive cuts it stood in for are now
 * pages of their own under Scent Profiles above. `/ingredients` was not
 * withdrawn — it keeps its row in `world` below, which is where an editorial
 * page belongs. Limited Editions is gone for the opposite reason: the cut
 * itself was withdrawn from the catalogue, so there is no page left to link to.
 */
export const quickAccess: ReadonlyArray<{
  key: QuickAccessKey;
  path: string;
}> = [
  { key: "newArrival", path: "/new-arrival" },
  { key: "discoverySets", path: "/collections/discovery" },
  { key: "giftSets", path: "/collections/gift-set" },
  { key: "bestSellers", path: "/collections/best-sellers" },
];

export const world: ReadonlyArray<{ key: WorldKey; path: string }> = [
  { key: "heritage", path: "/heritage" },
  { key: "craftsmanship", path: "/craftsmanship" },
  { key: "ingredients", path: "/ingredients" },
  { key: "journal", path: "/journal" },
  { key: "about", path: "/about" },
];
