import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { productTypesForKind } from "@/src/lib/product-types";
import type {
  NavGroupEntry,
  NavLinkEntry,
  NavigationTree,
} from "@/src/types/navigation";

/**
 * Navigation structure — the **fallback** tree, and the static pages a stored
 * menu row may point at.
 *
 * ## What changed
 *
 * These three tables used to *be* the menu: hand-written `{ key, path }` pairs
 * that only a deploy could change, which is why a collection created in the
 * dashboard had a page but could not be linked to from anywhere. The menu is
 * now `"NavLink"` (`supabase/sql/0048_navigation.sql`), read by
 * `src/services/navigation.ts`.
 *
 * This file did not become dead. It is the floor under that read: with no rows,
 * an unparseable row, or the database unreachable, `getNavigationTree()` returns
 * {@link fallbackNavigation} and the header renders exactly what it rendered
 * before the table existed — the same posture `resolveSectionOrder()` takes for
 * the home page. A menu is on every screen of the site; it is not allowed to
 * depend on a query succeeding.
 *
 * It is also where a `PAGE` row's address comes from. A stored row names a
 * category, a collection, or one of {@link NAV_PAGE_KEYS} — and the last of
 * those are pages that exist because the code routes them, so the code is what
 * says where they are. Labels for them stay in the dictionaries, so a missing
 * Arabic string is still a compile error rather than an English word leaking
 * into the Arabic tree.
 *
 * Paths are locale-agnostic; `<LocaleLink>` prefixes them at render time.
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


/*
 * ── Static pages ────────────────────────────────────────────
 *
 * The destinations that are not rows in any table: the catalogue overview, the
 * merchandising page, the New Arrival showroom, the five scent profiles, and
 * the five editorial pages. Each exists because a route file exists, so its
 * address is a fact about this repository and belongs here rather than in a
 * column an editor could mistype.
 *
 * The keys are exactly `nav_link_known_page` in
 * `supabase/sql/0048_navigation.sql`. A stored row naming anything else is
 * refused by the database; one naming a key this table forgot is dropped by
 * `resolveNavigation()` rather than rendered with no address.
 */

/** Which dictionary section a page's copy is written in. */
type NavPageSource =
  | { in: "collectionItems"; key: CollectionKey }
  | { in: "quickAccessItems"; key: QuickAccessKey }
  | { in: "worldItems"; key: WorldKey };

export interface NavPage {
  path: string;
  copy: NavPageSource;
}

export const NAV_PAGES = {
  allProducts: {
    path: "/collections",
    copy: { in: "collectionItems", key: "allProducts" },
  },
  bestSellers: {
    path: "/collections/best-sellers",
    copy: { in: "quickAccessItems", key: "bestSellers" },
  },
  newArrival: {
    path: "/new-arrival",
    copy: { in: "quickAccessItems", key: "newArrival" },
  },
  oriental: {
    path: "/collections/oriental",
    copy: { in: "collectionItems", key: "oriental" },
  },
  floral: {
    path: "/collections/floral",
    copy: { in: "collectionItems", key: "floral" },
  },
  fresh: {
    path: "/collections/fresh",
    copy: { in: "collectionItems", key: "fresh" },
  },
  woody: {
    path: "/collections/woody",
    copy: { in: "collectionItems", key: "woody" },
  },
  gourmand: {
    path: "/collections/gourmand",
    copy: { in: "collectionItems", key: "gourmand" },
  },
  heritage: { path: "/heritage", copy: { in: "worldItems", key: "heritage" } },
  craftsmanship: {
    path: "/craftsmanship",
    copy: { in: "worldItems", key: "craftsmanship" },
  },
  ingredients: {
    path: "/ingredients",
    copy: { in: "worldItems", key: "ingredients" },
  },
  journal: { path: "/journal", copy: { in: "worldItems", key: "journal" } },
  about: { path: "/about", copy: { in: "worldItems", key: "about" } },
} as const satisfies Record<string, NavPage>;

export type NavPageKey = keyof typeof NAV_PAGES;

export const NAV_PAGE_KEYS = Object.keys(NAV_PAGES) as NavPageKey[];

/** Narrow an untrusted `pageKey` off a stored row. */
export function parseNavPageKey(value: string | null): NavPageKey | null {
  if (value === null) return null;
  return NAV_PAGE_KEYS.find((key) => key === value) ?? null;
}

/**
 * A static page's label and description, in the reader's language.
 *
 * Three dictionary shapes, because the three columns were written with
 * different needs: a collections row prints a description under its label, a
 * Quick Access row is a bare string, and a World row is an object with one
 * field. Flattening them here means neither surface has to know.
 */
export function navPageCopy(
  dict: Dictionary,
  key: NavPageKey,
): { label: string; desc: string | null } {
  const { copy } = NAV_PAGES[key];

  switch (copy.in) {
    case "collectionItems": {
      const entry = dict.nav.collectionItems[copy.key];
      return { label: entry.label, desc: entry.desc };
    }
    case "quickAccessItems":
      return { label: dict.nav.quickAccessItems[copy.key], desc: null };
    case "worldItems":
      return { label: dict.nav.worldItems[copy.key].label, desc: null };
  }
}

/*
 * ── The fallback tree ───────────────────────────────────────
 *
 * The three tables above, resolved against the dictionary into the same shape
 * `"NavLink"` resolves into. Returned whenever the stored menu cannot be read,
 * so the failure mode of the navigation query is "yesterday's menu", not "no
 * menu".
 */

/**
 * Whether a fallback path names a shelf.
 *
 * The stored tree answers this from `targetType`; here there is no row to ask,
 * so it is read off the address — everything under `/collections/` except the
 * overview itself and the code-owned pages that share the space.
 */
function isShelfPath(path: string): boolean {
  if (!path.startsWith("/collections/")) return false;

  const slug = path.slice("/collections/".length);
  return !NON_SHELF_SLUGS.includes(slug);
}

const NON_SHELF_SLUGS: readonly string[] = [
  "best-sellers",
  "oriental",
  "floral",
  "fresh",
  "woody",
  "gourmand",
];

function fallbackLink(
  dict: Dictionary,
  key: CollectionKey,
  path: string,
): NavLinkEntry {
  const entry = dict.nav.collectionItems[key];
  return {
    kind: "link",
    id: `fallback-${key}`,
    label: entry.label,
    desc: entry.desc,
    href: path,
    isShelf: isShelfPath(path),
  };
}

export function fallbackNavigation(dict: Dictionary): NavigationTree {
  return {
    collections: collections.map((entry): NavGroupEntry | NavLinkEntry =>
      entry.kind === "group"
        ? {
            kind: "group",
            id: `fallback-${entry.key}`,
            label: dict.nav.collectionGroups[entry.key],
            children: entry.children.map((child) =>
              fallbackLink(dict, child.key, child.path),
            ),
          }
        : fallbackLink(dict, entry.key, entry.path),
    ),
    quickAccess: quickAccess.map((item) => ({
      kind: "link",
      id: `fallback-${item.key}`,
      label: dict.nav.quickAccessItems[item.key],
      desc: null,
      href: item.path,
      isShelf: isShelfPath(item.path),
    })),
    world: world.map((item) => ({
      kind: "link",
      id: `fallback-${item.key}`,
      label: dict.nav.worldItems[item.key].label,
      desc: null,
      href: item.path,
      isShelf: false,
    })),
  };
}
