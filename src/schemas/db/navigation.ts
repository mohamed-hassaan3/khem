/**
 * `"NavLink"` rows, parsed and resolved into the tree the two surfaces render.
 *
 * Parsed, not asserted — the same contract as `src/schemas/db/catalog.ts`. A row
 * that does not fit is *dropped*, not thrown on: one malformed menu entry must
 * cost that entry and nothing else, because this query runs on every page of the
 * site.
 *
 * The resolution rules, in one place:
 *
 *   * A row's address is derived from what it points at — a category slug, a
 *     collection slug, or a static page's path. There is no stored `href`.
 *   * A label is the row's override if it has one, else the target's own name,
 *     else the dictionary entry for a static page. So a collection created in
 *     the dashboard is linkable and bilingual without anyone typing a word.
 *   * A row whose target has vanished is dropped. The foreign keys make that
 *     nearly unreachable — deleting a collection cascades its menu rows away —
 *     but "nearly" is not a thing to render a dead link on.
 */

import { z } from "zod";

import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import type { Locale } from "@/src/lib/i18n/config";
import { resolveText } from "@/src/lib/i18n/resolve";
import { navPageCopy, NAV_PAGES, parseNavPageKey } from "@/src/constants/navigation-pages";
import type {
  NavColumnKey,
  NavEntry,
  NavLinkEntry,
  NavigationTree,
} from "@/src/types/navigation";

const navColumnSchema = z.enum(["COLLECTIONS", "QUICK_ACCESS", "WORLD"]);
const navTargetSchema = z.enum(["CATEGORY", "COLLECTION", "PAGE", "GROUP"]);

export const navLinkRowSchema = z.object({
  id: z.string(),
  column_key: navColumnSchema,
  parentId: z.string().nullable().default(null),
  targetType: navTargetSchema,
  categorySlug: z.string().nullable().default(null),
  collectionSlug: z.string().nullable().default(null),
  pageKey: z.string().nullable().default(null),
  groupKey: z.string().nullable().default(null),
  label: z.string().nullable().default(null),
  label_ar: z.string().nullable().default(null),
  desc: z.string().nullable().default(null),
  desc_ar: z.string().nullable().default(null),
  showInNav: z.boolean().default(true),
  showInFooter: z.boolean().default(true),
  isEnabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export type NavLinkRow = z.infer<typeof navLinkRowSchema>;

export const NAV_LINK_COLUMNS =
  'id, column_key, "parentId", "targetType", "categorySlug", "collectionSlug", ' +
  '"pageKey", "groupKey", label, label_ar, "desc", desc_ar, "showInNav", ' +
  '"showInFooter", "isEnabled", "sortOrder"';

/** The names a link may borrow, keyed by slug. */
export interface NavTargets {
  categories: ReadonlyMap<string, { name: string; slug: string }>;
  collections: ReadonlyMap<string, { name: string; slug: string }>;
  /**
   * The collections standing under each category, in their curated order.
   *
   * This is what makes a category entry in the menu *live*: it prints the
   * collections beneath it as they are, rather than as somebody remembered to
   * list them. See {@link autoChildren}.
   */
  collectionsByCategory: ReadonlyMap<
    string,
    readonly { name: string; slug: string }[]
  >;
}

const COLUMN_KEYS: Record<z.infer<typeof navColumnSchema>, NavColumnKey> = {
  COLLECTIONS: "collections",
  QUICK_ACCESS: "quickAccess",
  WORLD: "world",
};

/**
 * One row as a destination, or `null` if it is not one.
 *
 * `null` for a `GROUP` — which is a heading, resolved by the caller — and for a
 * row whose target is gone or whose `pageKey` names a page this build does not
 * route.
 */
function toLink(
  row: NavLinkRow,
  locale: Locale,
  dict: Dictionary,
  targets: NavTargets,
): NavLinkEntry | null {
  const override = resolveOverride(row.label, row.label_ar, locale);
  const desc = resolveOverride(row.desc, row.desc_ar, locale);

  switch (row.targetType) {
    case "CATEGORY": {
      if (row.categorySlug === null) return null;
      const target = targets.categories.get(row.categorySlug);
      if (!target) return null;

      return {
        kind: "link",
        id: row.id,
        label: override ?? target.name,
        desc,
        href: `/collections/${target.slug}`,
        isShelf: true,
      };
    }

    case "COLLECTION": {
      if (row.collectionSlug === null) return null;
      const target = targets.collections.get(row.collectionSlug);
      if (!target) return null;

      return {
        kind: "link",
        id: row.id,
        label: override ?? target.name,
        desc,
        href: `/collections/${target.slug}`,
        isShelf: true,
      };
    }

    case "PAGE": {
      const key = parseNavPageKey(row.pageKey);
      if (key === null) return null;

      const copy = navPageCopy(dict, key);

      return {
        kind: "link",
        id: row.id,
        label: override ?? copy.label,
        desc: desc ?? copy.desc,
        href: NAV_PAGES[key].path,
        // A merchandising cut and a scent profile live under `/collections/` too,
        // and neither is a shelf: no product *belongs* to one.
        isShelf: false,
      };
    }

    case "GROUP":
      return null;
  }
}

/** An override, in the reader's language, or `null` when there is none. */
function resolveOverride(
  value: string | null,
  value_ar: string | null,
  locale: Locale,
): string | null {
  if (value === null) return value_ar !== null && locale === "ar" ? value_ar : null;
  return resolveText(value, value_ar, locale);
}

/**
 * The collections a category entry prints without being told to.
 *
 * **The rule the brief asks for**: create a collection, assign it a category,
 * and it appears under that category in the menu and the footer. No second act,
 * no menu row to remember, nothing to keep in step — because there is no second
 * list to fall out of step with. A category disclosure asks the database what
 * stands on that shelf, every render.
 *
 * `taken` is what stops a collection being printed twice. An explicit row wins:
 * the menu says "Signature Collection" where the catalogue says "Signature",
 * and an editor who wrote that wording, ordered that row, or switched it off
 * for one surface must not have it silently duplicated underneath by the
 * automatic pass. So explicit rows come first, in their order, and the
 * automatic ones fill in behind them.
 *
 * A collection whose explicit row is switched *off* is therefore hidden rather
 * than re-added: `taken` is built from every child row of the group, not only
 * the visible ones. Hiding one entry cannot mean the machinery puts it back.
 */
function autoChildren(
  categorySlug: string,
  taken: ReadonlySet<string>,
  targets: NavTargets,
  parentId: string,
): NavLinkEntry[] {
  const collections = targets.collectionsByCategory.get(categorySlug) ?? [];

  return collections
    .filter((collection) => !taken.has(collection.slug))
    .map((collection) => ({
      kind: "link" as const,
      /*
       * A synthetic id, because there is no row. Prefixed with the parent so
       * two categories that both auto-print the same collection — impossible
       * today, since a collection has one category, but not a thing to leave to
       * chance in a React `key`.
       */
      id: `${parentId}:auto:${collection.slug}`,
      label: collection.name,
      /*
       * No description. A collection created in the dashboard is a name and a
       * place; inventing a sentence for it, or truncating its editorial copy
       * into the menu, would both be worse than the clean two-line row the
       * mega-menu already draws for an entry without one.
       */
      desc: null,
      href: `/collections/${collection.slug}`,
      isShelf: true,
    }));
}

/**
 * The stored rows as a tree, for one surface.
 *
 * `surface` decides which of the two visibility flags is read: the Footer is a
 * sitemap and the Nav is a menu, and an entry may belong to one without the
 * other. It is also why the Footer flattens groups — a heading that is not a
 * link is noise in a sitemap — which happens at the Footer, not here, so both
 * surfaces resolve from one shape.
 */
export function resolveNavigation(
  rows: readonly unknown[] | null,
  locale: Locale,
  dict: Dictionary,
  targets: NavTargets,
  surface: "nav" | "footer",
): NavigationTree | null {
  if (rows === null) return null;

  const parsed: NavLinkRow[] = [];
  for (const row of rows) {
    const result = navLinkRowSchema.safeParse(row);
    if (result.success) parsed.push(result.data);
  }

  if (parsed.length === 0) return null;

  const visible = parsed.filter(
    (row) =>
      row.isEnabled && (surface === "nav" ? row.showInNav : row.showInFooter),
  );

  const byParent = new Map<string, NavLinkRow[]>();
  for (const row of visible) {
    if (row.parentId === null) continue;
    const siblings = byParent.get(row.parentId) ?? [];
    siblings.push(row);
    byParent.set(row.parentId, siblings);
  }

  const ordered = (list: readonly NavLinkRow[]) =>
    [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

  const tree: NavigationTree = { collections: [], quickAccess: [], world: [] };

  for (const row of ordered(visible.filter((r) => r.parentId === null))) {
    const column = COLUMN_KEYS[row.column_key];

    if (row.targetType === "GROUP") {
      // Only the collections column prints disclosures; a group anywhere else
      // is a shape the two other columns cannot render, so it is skipped rather
      // than flattened into rows nobody ordered.
      if (column !== "collections") continue;

      const label = groupLabel(row, dict, locale);
      if (label === null) continue;

      /*
       * No automatic children here, and that is the difference between the two
       * kinds of disclosure: a `GROUP` is a heading over a hand-made list —
       * "Scent Profiles" names five code-owned pages — where a `CATEGORY` is a
       * heading over a shelf the database knows the contents of.
       */
      const children = ordered(byParent.get(row.id) ?? [])
        .map((child) => toLink(child, locale, dict, targets))
        .filter((child): child is NavLinkEntry => child !== null);

      // A disclosure with nothing behind it is a chevron that opens onto
      // nothing. Dropped rather than printed.
      if (children.length === 0) continue;

      tree.collections.push({ kind: "group", id: row.id, label, children });
      continue;
    }

    const link = toLink(row, locale, dict, targets);
    if (link === null) continue;

    if (column === "collections") {
      const childRows = byParent.get(row.id) ?? [];

      const explicit = ordered(childRows)
        .map((child) => toLink(child, locale, dict, targets))
        .filter((child): child is NavLinkEntry => child !== null);

      /*
       * A category entry is a disclosure over its own shelf.
       *
       * Its heading is the category's name — translated, because it comes from
       * the row — and beneath it come the entries an editor placed by hand,
       * then every remaining collection assigned to that category. Create
       * "Body Cream" under Body Care and it is in the menu on the next render;
       * create "Candles" under Home Fragrances and the same.
       *
       * Every child row is claimed, visible or not, so hiding one entry does
       * not hand its collection back to the automatic pass.
       */
      if (row.targetType === "CATEGORY" && row.categorySlug !== null) {
        const taken = new Set(
          childRows
            .map((child) => child.collectionSlug)
            .filter((slug): slug is string => slug !== null),
        );

        const children = [
          ...explicit,
          ...autoChildren(row.categorySlug, taken, targets, row.id),
        ];

        // With nothing on the shelf and nothing placed by hand, the category is
        // still a page — so it prints as a plain link rather than as a chevron
        // that opens onto nothing.
        tree.collections.push(
          children.length === 0
            ? link
            : { kind: "group", id: row.id, label: link.label, children },
        );
        continue;
      }

      // Any other destination that has rows beneath it is printed as a
      // disclosure whose first child is itself.
      tree.collections.push(
        explicit.length === 0
          ? link
          : {
              kind: "group",
              id: row.id,
              label: link.label,
              children: [link, ...explicit],
            },
      );
      continue;
    }

    tree[column].push(link);
  }

  const empty =
    tree.collections.length === 0 &&
    tree.quickAccess.length === 0 &&
    tree.world.length === 0;

  return empty ? null : tree;
}

/**
 * A disclosure's heading.
 *
 * An override if the row carries one; otherwise the dictionary entry named by
 * `groupKey`. `null` when neither exists, which drops the group — a heading
 * with no words is not something to render.
 */
function groupLabel(
  row: NavLinkRow,
  dict: Dictionary,
  locale: Locale,
): string | null {
  const override = resolveOverride(row.label, row.label_ar, locale);
  if (override !== null) return override;

  if (row.groupKey === null) return null;

  const groups = dict.nav.collectionGroups;
  return row.groupKey in groups
    ? groups[row.groupKey as keyof typeof groups]
    : null;
}

/** Every entry of the tree, flattened — what the Footer's sitemap prints. */
export function flattenNavigation(
  entries: readonly NavEntry[],
): NavLinkEntry[] {
  return entries.flatMap((entry) =>
    entry.kind === "group" ? entry.children : [entry],
  );
}
