import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";

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
 * The "Our Collections" column.
 *
 * Every collection now lives under `/collections/[slug]` — body care, home
 * fragrance and the sets used to hold routes of their own, and folding them in
 * removed the second URL for the same goods. New Arrival opens the column and
 * keeps its own route: `/new-arrival` is an editorial showroom with the full
 * story and note pyramid of each release, which the catalogue grid has nowhere
 * to put. Its `?facet=` twin is the in-page cut of the same products.
 *
 * Signature, Gemstone and Noir sit one level down, under `fragrances`. The
 * column listed six siblings, of which three were the perfume library proper
 * and three were something else — a showroom, a skin range, a home range — and
 * the flat list gave a reader no way to see that. The group is a disclosure in
 * the nav, not a page: there is nothing at "Fragrances" to navigate to that the
 * three collections do not already say better.
 *
 * The Footer flattens the group back out. Its column is a sitemap, where a
 * heading that is not a link is noise.
 */
export const collections: ReadonlyArray<CollectionEntry> = [
  { kind: "link", key: "newArrival", path: "/new-arrival" },
  {
    kind: "group",
    key: "fragrances",
    children: [
      { key: "signature", path: "/collections/signature" },
      { key: "gemstone", path: "/collections/gemstone" },
      { key: "noir", path: "/collections/noir" },
    ],
  },
  { kind: "link", key: "bodyCare", path: "/collections/body-care" },
  { kind: "link", key: "homeFragrance", path: "/collections/home-fragrance" },
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
 * The "Quick Access" column.
 *
 * Four destinations, all of them pages. Discovery and gift sets are collections
 * with rows of their own, but they are ways of buying rather than chapters of
 * the fragrance library, so they read better here than beside Signature and
 * Noir. Best sellers cross every collection at once and so cannot be a row at
 * all — it is assembled in `/collections/[slug]` from the catalogue
 * (`MERCH_PAGE_FACETS` in `src/lib/facets.ts`). Either way a menu link lands on
 * a page with a hero and a name, never on the catalogue with a filter silently
 * applied.
 *
 * Key Ingredients is the odd one out: an editorial page, not a way of buying.
 * It replaced Limited Editions here, which `/collections/limited-edition` still
 * serves for anyone arriving by link — the page was not withdrawn, only the
 * menu row. Someone reading about oud is one click from the perfumes built on
 * it, which is a shorter path into the catalogue than a second facet cut.
 */
export const quickAccess: ReadonlyArray<{
  key: QuickAccessKey;
  path: string;
}> = [
  { key: "discoverySets", path: "/collections/discovery" },
  { key: "giftSets", path: "/collections/gift-set" },
  { key: "bestSellers", path: "/collections/best-sellers" },
  { key: "keyIngredients", path: "/ingredients" },
];

export const world: ReadonlyArray<{ key: WorldKey; path: string }> = [
  { key: "heritage", path: "/heritage" },
  { key: "craftsmanship", path: "/craftsmanship" },
  { key: "ingredients", path: "/ingredients" },
  { key: "journal", path: "/journal" },
  { key: "about", path: "/about" },
];
