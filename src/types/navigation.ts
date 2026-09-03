/**
 * The Nav and the Footer, resolved.
 *
 * These are what the two surfaces render: labels already in the reader's
 * language, addresses already derived. Neither component knows whether a row
 * came from `"NavLink"` or from the fallback table in
 * `src/constants/navigation-pages.ts`, which is what lets the menu survive an
 * empty or unreachable database looking exactly as it did before.
 *
 * There is no `href` on the stored row — see `supabase/sql/0048_navigation.sql`.
 * A link names a category, a collection or a known page, and the address is
 * derived here. Nothing in the CMS can type a URL, so nothing in the CMS can
 * type a wrong one.
 */

/** The three columns the Nav prints and the Footer flattens. */
export type NavColumnKey = "collections" | "quickAccess" | "world";

/** A destination. */
export interface NavLinkEntry {
  kind: "link";
  /** The `"NavLink"` row id, or a stable synthetic one in the fallback tree. */
  id: string;
  label: string;
  /**
   * The line printed under the label in the mega-menu.
   *
   * `null` where the row has none — a collection created in the dashboard is a
   * label and an address, and the menu prints exactly that rather than
   * inventing a sentence or truncating the collection's editorial copy.
   */
  desc: string | null;
  /** Locale-agnostic; `<LocaleLink>` prefixes it at render time. */
  href: string;
  /**
   * Whether this entry points at a **shelf** — a category or a collection —
   * rather than at an editorial or merchandising page.
   *
   * Carried because one consumer needs the distinction and cannot recover it
   * from the address: the search overlay offers "collections to search within",
   * and Heritage or Best Sellers are not that. Resolved from `targetType` for a
   * stored row; inferred from the address in the fallback tree, where there is
   * no row to ask.
   */
  isShelf: boolean;
}

/**
 * A disclosure: a heading and the rows behind it.
 *
 * A group is not a destination. "Scent Profiles" names five pages and is not
 * itself one, and a category group prints its own page as its first child
 * ("All Body Care") rather than making the heading clickable — the heading is
 * the control that opens the group.
 */
export interface NavGroupEntry {
  kind: "group";
  id: string;
  label: string;
  children: NavLinkEntry[];
}

export type NavEntry = NavLinkEntry | NavGroupEntry;

/** Everything the two surfaces need, in printed order. */
export interface NavigationTree {
  collections: NavEntry[];
  quickAccess: NavLinkEntry[];
  world: NavLinkEntry[];
}
