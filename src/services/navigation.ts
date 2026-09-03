import "server-only";

/**
 * The menu, read once per request.
 *
 * `"NavLink"` (`supabase/sql/0048_navigation.sql`) holds which entries the Nav
 * and the Footer print and what each one points at; the names come from the
 * category and collection rows the entries reference, so a collection created
 * in the dashboard is linkable and bilingual the moment it exists.
 *
 * ## It cannot fail
 *
 * Three reads (links, categories, collections) and every one of them may return
 * nothing — an empty table, a stale PostgREST schema cache, an unreachable
 * database. All three cases land on {@link fallbackNavigation}, which is the
 * tree in `src/constants/navigation-pages.ts` that used to *be* the menu. So the
 * worst case for the header is that it shows the menu this repository shipped,
 * not that it shows no menu at all. That is the same bargain
 * `resolveSectionOrder()` strikes for the home page, and it matters more here:
 * the header is on every screen.
 */

import { getSupabasePublic } from "@/src/lib/supabase";
import { fallbackNavigation } from "@/src/constants/navigation-pages";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import {
  NAV_LINK_COLUMNS,
  resolveNavigation,
  type NavTargets,
} from "@/src/schemas/db/navigation";
import { CATEGORY_COLUMNS, COLLECTION_COLUMNS, parseList, toCategory, toCollection } from "@/src/schemas/db/catalog";
import type { NavigationTree } from "@/src/types/navigation";

function logFailure(label: string, message: string): void {
  console.error(`[navigation] ${label} failed: ${message}`);
}

/**
 * The tree for one surface.
 *
 * `surface` selects between the two visibility flags a row carries. The Nav and
 * the Footer both call this, and both fall back to the same shipped tree, which
 * is what keeps "the footer navigates the same as the nav" true whichever way
 * the read goes.
 */
export async function getNavigationTree(
  locale: Locale,
  surface: "nav" | "footer",
): Promise<NavigationTree> {
  const dict = await getDictionary(locale);
  const supabase = getSupabasePublic();
  if (!supabase) return fallbackNavigation(dict);

  const [links, targets] = await Promise.all([
    supabase.from("NavLink").select(NAV_LINK_COLUMNS).order("sortOrder"),
    readTargets(locale),
  ]);

  if (links.error) {
    logFailure("getNavigationTree", links.error.message);
    return fallbackNavigation(dict);
  }

  return (
    resolveNavigation(links.data, locale, dict, targets, surface) ??
    fallbackNavigation(dict)
  );
}

/**
 * The names a menu row may borrow.
 *
 * Read as two whole lists rather than as an embed on `"NavLink"`, because the
 * two foreign keys are mutually exclusive: an embed would be two left joins of
 * which one is always null, and the lists are a dozen rows each and already
 * cached by the same request.
 *
 * Disabled categories are absent, which is what withdraws their menu entries
 * without anyone having to remember to unlink them.
 */
async function readTargets(locale: Locale): Promise<NavTargets> {
  const supabase = getSupabasePublic();
  const empty: NavTargets = {
    categories: new Map(),
    collections: new Map(),
    collectionsByCategory: new Map(),
  };
  if (!supabase) return empty;

  const [categories, collections] = await Promise.all([
    supabase.from("Category").select(CATEGORY_COLUMNS).eq("isEnabled", true),
    // Ordered, because this list is printed and not merely looked up: a category
    // entry in the menu prints the collections beneath it in the order the
    // catalogue curates, which is editorial rather than alphabetical.
    supabase.from("Collection").select(COLLECTION_COLUMNS).order("sortOrder"),
  ]);

  if (categories.error) logFailure("readTargets categories", categories.error.message);
  if (collections.error) logFailure("readTargets collections", collections.error.message);

  const categoryRows = parseList(categories.data, (row) =>
    toCategory(row, locale),
  );
  const collectionRows = parseList(collections.data, (row) =>
    toCollection(row, locale),
  );

  const enabled = new Set(categoryRows.map((row) => row.slug));

  /*
   * The shelf, grouped.
   *
   * Built here rather than queried per category: the whole list is a dozen rows
   * and already in hand, so grouping it in memory turns what would be one query
   * per menu disclosure into none.
   *
   * A collection whose category is switched off is dropped with it. That is the
   * same withdrawal the category's own page and chip get — switching a shelf off
   * has to take everything standing on it, or the menu would keep offering the
   * ranges while the shelf they belong to had gone.
   */
  const collectionsByCategory = new Map<
    string,
    { name: string; slug: string }[]
  >();

  for (const row of collectionRows) {
    if (!enabled.has(row.categorySlug)) continue;

    const siblings = collectionsByCategory.get(row.categorySlug) ?? [];
    siblings.push({ name: row.name, slug: row.slug });
    collectionsByCategory.set(row.categorySlug, siblings);
  }

  return {
    categories: new Map(
      categoryRows.map((row) => [row.slug, { name: row.name, slug: row.slug }]),
    ),
    collections: new Map(
      collectionRows.map((row) => [row.slug, { name: row.name, slug: row.slug }]),
    ),
    collectionsByCategory,
  };
}
