/**
 * What to re-render after an admin write.
 *
 * Every public route that quotes the catalog is cached — `/perfume/[slug]` at
 * 300s, `/collections/[slug]` at 600s, `/journal` at 3600s — which is exactly
 * why the dashboard needs this file. Without it, an editor fixes a price,
 * reloads the storefront, sees the old one, and concludes the save failed.
 *
 * One module owns the map so no action invents its own list and forgets the
 * home page. Two rules it keeps:
 *
 * 1. **Both locales, always.** `/perfume/x` and `/ar/perfume/x` are separate
 *    cache entries of the same row. Revalidating one leaves the other stale,
 *    and the one an editor is least likely to check is the one that stays wrong.
 * 2. **A category path is its slug.** It used to be a switch on
 *    `CollectionKind` naming four literal URLs, which was correct only while
 *    those four ranges were the only categories. Since `0045_category.sql` a
 *    category is a row an editor creates, so the path is derived from the slug
 *    the write already carries — a fifth category revalidates without an edit
 *    here, and a renamed one cannot be missed.
 */

import "server-only";

import { revalidatePath } from "next/cache";

import { MERCH_PAGE_FACETS, type MerchPageFacet } from "@/src/lib/facets";
import { LOCALES } from "@/src/lib/i18n/config";
import type { CollectionKind, ProductTag } from "@/src/types/catalog";

/**
 * Locale-agnostic app paths every catalog write touches.
 *
 * The home page carries featured collections, bestsellers and the latest
 * articles, so it is on every list.
 */
const HOME = "/";

/** Revalidate one app path in every locale it exists under. */
function revalidateAllLocales(path: string): void {
  for (const locale of LOCALES) {
    // `/` is `/en` internally, not `/en/`, so the join is written out rather
    // than concatenated blindly.
    revalidatePath(path === HOME ? `/${locale}` : `/${locale}${path}`);
  }
}

/**
 * The sitemap enumerates fragrance slugs and published articles, so creating,
 * publishing or archiving anything changes it. It is not under `[locale]`.
 */
function revalidateSitemap(): void {
  revalidatePath("/sitemap.xml");
}

/**
 * The two merchandising pages, both locales.
 *
 * On **every** product write, not only when a flag was set: the case that needs
 * it most is a flag being *removed*, where the product must disappear from a
 * page the write no longer mentions. Revalidating a path that was never
 * rendered is a no-op, so the unconditional call costs nothing.
 */
function revalidateMerchPages(): void {
  for (const facet of MERCH_PAGE_FACETS) {
    revalidateAllLocales(`/collections/${facet}`);
  }
}

/** After the copy or the hero of one merchandising page is edited. */
export function revalidateMerchPage(slug: MerchPageFacet): void {
  revalidateAllLocales(`/collections/${slug}`);
}

/**
 * After a collection is created, edited or deleted.
 *
 * Its own page and its category's, because a category page lists every product
 * beneath it — an edit here changes both, and only one of them is the URL the
 * editor was looking at.
 */
export function revalidateCollection(slug: string, categorySlug: string): void {
  revalidateAllLocales(HOME);
  revalidateAllLocales("/collections");
  revalidateAllLocales(`/collections/${slug}`);
  revalidateAllLocales(`/collections/${categorySlug}`);

  revalidateSitemap();
}

/**
 * After a category is created, edited or deleted.
 *
 * The menu too: a category is a destination the Nav and the Footer can point
 * at, and switching one off withdraws its entries from both surfaces — which
 * they only notice when the layout that reads them is re-rendered.
 */
export function revalidateCategory(slug: string): void {
  revalidateAllLocales(HOME);
  revalidateAllLocales("/collections");
  revalidateAllLocales(`/collections/${slug}`);

  revalidateSitemap();
}

/**
 * After the menu itself is edited.
 *
 * The Nav and the Footer are rendered by the `[locale]` layout, which every
 * page inherits — so there is no one path to revalidate and `layout` is passed
 * to say so. Without it a reordered menu would take an ISR window to appear,
 * and the editor would conclude the save failed.
 */
export function revalidateNavigation(): void {
  for (const locale of LOCALES) {
    revalidatePath(`/${locale}`, "layout");
  }
}

/** After a product is created, edited or archived. */
export function revalidateProduct(input: {
  slug: string;
  collectionSlug: string;
  /** The collection's category — its page lists this product too. */
  categorySlug: string;
  collectionKind: CollectionKind;
  tags: readonly ProductTag[];
}): void {
  revalidateAllLocales(HOME);
  revalidateAllLocales("/collections");
  revalidateAllLocales(`/collections/${input.collectionSlug}`);
  revalidateAllLocales(`/collections/${input.categorySlug}`);

  // A detail page exists for fragrances only; revalidating a path that was
  // never rendered is a no-op, but naming the condition keeps the intent clear.
  if (input.collectionKind === "FRAGRANCE") {
    revalidateAllLocales(`/perfume/${input.slug}`);
  }

  if (input.tags.includes("NEW_ARRIVAL")) {
    revalidateAllLocales("/new-arrival");
  }

  revalidateMerchPages();

  revalidateSitemap();
}

/**
 * After an article is created, edited, published or unpublished.
 *
 * The slug is optional only so an older call site cannot silently do nothing;
 * every caller in the dashboard passes one, because an editor who fixes a
 * sentence checks the article, not the index — and `/journal/[slug]` is cached
 * for an hour.
 */
export function revalidateArticle(slug?: string): void {
  revalidateAllLocales(HOME);
  revalidateAllLocales("/journal");

  if (slug) {
    revalidateAllLocales(`/journal/${slug}`);
  }

  revalidateSitemap();
}

/**
 * After a stockist is created, edited, published or removed.
 *
 * `/stockists` is ISR at one hour, which is exactly long enough for an editor
 * to add a boutique, reload the public page, see nothing, and conclude the save
 * failed. The home page is not on this list: nothing on it quotes the
 * directory.
 */
export function revalidateStockists(): void {
  revalidateAllLocales("/stockists");
}

/**
 * After a house setting, contact channel or social profile is changed.
 *
 * Three surfaces, and each is on the list for a specific reason:
 *
 *  - **the home page** carries the featured fragrance, which is the one
 *    merchandising decision stored in `"BoutiqueSetting"`;
 *  - **`/contact`** renders the channels and the social profiles, and is ISR at
 *    an hour;
 *  - **`/stockists`** quotes `wholesaleEmail` for partnership enquiries.
 *
 * The email signatures that also read `"SocialProfile"` are composed per send,
 * so they need nothing here — they are already reading the current row.
 */
export function revalidateSettings(): void {
  revalidateAllLocales(HOME);
  revalidateAllLocales("/contact");
  revalidateAllLocales("/stockists");
}

/**
 * After a heritage timeline entry changes.
 *
 * `/heritage` only — the timeline appears nowhere else, and both locales are
 * separate cache entries of rows that now differ by language.
 */
export function revalidateHeritage(): void {
  revalidateAllLocales("/heritage");
}

/**
 * After a craft pillar changes.
 *
 * The **home page**, not `/craftsmanship`: the pillars are the home page's
 * four-item summary. `/craftsmanship` renders `"CraftStep"`, which is a
 * different table and gets its own call when its editor lands.
 */
export function revalidateCraftPillars(): void {
  revalidateAllLocales(HOME);
}

/**
 * After the landing-page hero is saved.
 *
 * The home page only, both locales. The hero is the first screen of `/` and
 * appears nowhere else — unlike the announcement bar, which the root layout puts
 * on every page and which therefore needs the whole tree.
 */
export function revalidateHero(): void {
  revalidateAllLocales(HOME);
}

/**
 * After a brand value changes. `/heritage`, beside the timeline.
 */
export function revalidateBrandValues(): void {
  revalidateAllLocales("/heritage");
}

/** After a mission statement changes. `/about` is the only page that reads them. */
export function revalidateAbout(): void {
  revalidateAllLocales("/about");
}

/**
 * After a craft step, stat or quote changes.
 *
 * `/craftsmanship` only — the craft **pillars** are the home page's summary and
 * live in `revalidateCraftPillars()`. The two are different tables and different
 * pages, which is exactly the confusion worth naming here.
 */
export function revalidateCraftsmanship(): void {
  revalidateAllLocales("/craftsmanship");
}

/**
 * After a material is created, edited, removed, or re-linked to a perfume.
 *
 * Three surfaces, and the third is the one easy to forget: a material is
 * printed on the detail page of every product it is used in, so changing its
 * name or its photograph makes those pages stale too.
 *
 * Both `/perfume/[slug]` and `/ritual/[slug]` are revalidated for each slug
 * without checking which kind of product it is. Revalidating a path that was
 * never rendered is a no-op, and the alternative — looking up each collection's
 * kind — is a query per product to save nothing.
 */
export function revalidateIngredients(productSlugs: readonly string[] = []): void {
  revalidateAllLocales(HOME);
  revalidateAllLocales("/ingredients");

  for (const slug of new Set(productSlugs)) {
    revalidateAllLocales(`/perfume/${slug}`);
    revalidateAllLocales(`/ritual/${slug}`);
  }
}

/**
 * After an announcement, the announcement-bar settings, or the offer popup
 * changes.
 *
 * **Every page, both locales.** The bar and the popup are rendered by the root
 * layout, so unlike a product edit there is no subset of routes that could be
 * stale — a campaign line added to the header is added to all thirty pages at
 * once, and revalidating only the home page would leave the bar missing
 * everywhere a visitor actually browses.
 *
 * `revalidatePath(path, "layout")` is what makes that one call rather than
 * thirty: it invalidates the layout and everything nested under it.
 */
export function revalidateMarketing(): void {
  revalidateWholeTree();
}

/**
 * Every route under the locale layout, both trees.
 *
 * The one blunt instrument in this file, and the two callers below say why they
 * need it. `revalidatePath(path, "layout")` invalidates the layout and
 * everything nested under it, so this is two calls rather than sixty.
 */
function revalidateWholeTree(): void {
  for (const locale of LOCALES) {
    revalidatePath(`/${locale}`, "layout");
  }
}

/**
 * After a promotion is created, edited, activated or deleted.
 *
 * A campaign changes a **price**, and a price is quoted on more surfaces than
 * any other field in the catalog: every grid, every detail page, the bag, the
 * drawer and the checkout review. Rather than deriving the affected paths from
 * the promotion's selections — which would miss the products it stops repricing,
 * exactly the case `revalidateMerchPages()` warns about — this invalidates the
 * whole locale tree.
 *
 * That is deliberate bluntness. A promotion is an occasional, deliberate act by
 * the desk, not a per-row edit, so the cost is a handful of re-renders on a day
 * somebody starts a sale — against the alternative of one grid quietly showing
 * last week's prices.
 */
export function revalidatePromotions(): void {
  revalidateWholeTree();
}

/**
 * After the home page's own structure changes — a band reordered, switched off,
 * or given different media.
 *
 * Only `/`: nothing else on the site renders `"LandingSection"`.
 */
export function revalidateHome(): void {
  revalidateAllLocales(HOME);
}
