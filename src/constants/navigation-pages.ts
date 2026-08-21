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
export type QuickAccessKey = keyof Dictionary["nav"]["quickAccessItems"];
export type WorldKey = keyof Dictionary["nav"]["worldItems"];

/**
 * The "Our Collections" column.
 *
 * Every collection now lives under `/collections/[slug]` — body care, home
 * fragrance and the sets used to hold routes of their own, and folding them in
 * removed the second URL for the same goods. New Arrival opens the column and
 * keeps its own route: `/new-arrival` is an editorial showroom with the full
 * story and note pyramid of each release, which the catalogue grid has nowhere
 * to put. Its `?facet=` twin is the in-page cut of the same products.
 */
export const collections: ReadonlyArray<{
  key: CollectionKey;
  path: string;
}> = [
  { key: "newArrival", path: "/new-arrival" },
  { key: "signature", path: "/collections/signature" },
  { key: "gemstone", path: "/collections/gemstone" },
  { key: "noir", path: "/collections/noir" },
  { key: "bodyCare", path: "/collections/body-care" },
  { key: "homeFragrance", path: "/collections/home-fragrance" },
];

/**
 * The "Quick Access" column.
 *
 * Four destinations, all of them pages. Discovery and gift sets are collections
 * with rows of their own, but they are ways of buying rather than chapters of
 * the fragrance library, so they read better here than beside Signature and
 * Noir. Best sellers and limited editions cross every collection at once and so
 * cannot be rows at all — they are assembled in `/collections/[slug]` from the
 * catalogue (`MERCH_PAGE_FACETS` in `src/lib/facets.ts`). Either way a menu link
 * lands on a page with a hero and a name, never on the catalogue with a filter
 * silently applied.
 */
export const quickAccess: ReadonlyArray<{
  key: QuickAccessKey;
  path: string;
}> = [
  { key: "discoverySets", path: "/collections/discovery" },
  { key: "giftSets", path: "/collections/gift-set" },
  { key: "bestSellers", path: "/collections/best-sellers" },
  { key: "limitedEditions", path: "/collections/limited-edition" },
];

export const world: ReadonlyArray<{ key: WorldKey; path: string }> = [
  { key: "heritage", path: "/heritage" },
  { key: "craftsmanship", path: "/craftsmanship" },
  { key: "ingredients", path: "/ingredients" },
  { key: "journal", path: "/journal" },
  { key: "about", path: "/about" },
];
