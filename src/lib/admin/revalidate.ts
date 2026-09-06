/**
 * What to re-render after an admin write.
 *
 * Every public route that quotes the catalog is cached — `/perfume/[slug]` and
 * `/collections/[slug]` at an hour, the editorial pages at a day — which is
 * exactly why the dashboard needs this file. Without it, an editor fixes a
 * price, reloads the storefront, sees the old one, and concludes the save
 * failed.
 *
 * Those windows used to be five and ten minutes, and were lengthened because at
 * this site's traffic they turned nearly every page view into a regeneration
 * (`prompts/vercel-usage-reduction.md`). That makes this file load-bearing in a
 * way it was not before: it is now the *only* thing standing between a save and
 * a day-stale page, so a surface missing from a list here is a defect, not a
 * few minutes of lag.
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
import { productHref } from "@/src/lib/routes";
import type { CollectionKind, ProductTag } from "@/src/types/catalog";

/**
 * Locale-agnostic app paths every catalog write touches.
 *
 * The home page carries featured collections, bestsellers and the latest
 * articles, so it is on every list.
 */
const HOME = "/";

/**
 * The bag renders the catalog too.
 *
 * `/cart` resolves the ids in the visitor's browser against a catalog
 * projection it fetches on the server, so a price edit is as visible there as
 * on a card. It is on the product list because its ISR window is an hour: short
 * enough not to matter when the window was five minutes, long enough to matter
 * now. Two entries, not a page per product — the projection is the whole
 * catalog.
 */
const CART = "/cart";

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

/**
 * After the delivery fee or the free-delivery minimum changes.
 *
 * The same `layout` argument, and for the same reason: the terms are read once
 * in the `[locale]` layout and handed to every priced surface through
 * `<DeliveryProvider>` (`src/app/[locale]/layout.tsx`), so there is no single
 * path that holds them. A per-page list would also be wrong — the trust badge
 * quoting the minimum is on every product page, and enumerating those here would
 * be a second, staler copy of `revalidateProduct()`.
 *
 * The checkout is not in the list because it does not need to be: it is
 * `force-dynamic`, and `src/actions/checkout.ts` re-reads the row on every order
 * regardless of what any cache holds.
 */
export function revalidateDelivery(): void {
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
  revalidateAllLocales(CART);
  revalidateAllLocales("/collections");
  revalidateAllLocales(`/collections/${input.collectionSlug}`);
  revalidateAllLocales(`/collections/${input.categorySlug}`);

  /*
   * The product's own page, whichever of the three it is.
   *
   * This used to revalidate `/perfume/[slug]` and only when the kind was
   * FRAGRANCE, which left `/ritual/[slug]` and `/set/[slug]` — body care, home
   * fragrance, discovery and gift sets — riding on their ISR window alone.
   * `productHref()` is the same function the links are built from, so the page
   * an editor clicks through to is by construction the page that was
   * revalidated.
   */
  revalidateAllLocales(
    productHref({ slug: input.slug, collectionKind: input.collectionKind }),
  );

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
 * for a day.
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
 * `/stockists` is ISR at a day, which is far longer than an editor
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
 * After an offer is created, edited, activated or deleted.
 *
 * `revalidatePromotions()`'s reasoning, for the same reason: an offer changes
 * what a **basket** costs, and the basket is quoted in the bag, the drawer and
 * the checkout review, while its label is printed on collection pages and cards.
 * Deriving the affected paths from the offer's four selections would miss the
 * products it stops applying to — the case `revalidateMerchPages()` warns about
 * — so the whole locale tree goes.
 *
 * Deliberate bluntness, and cheap for the same reason: an offer is an
 * occasional, deliberate act by the desk, not a per-row edit.
 */
export function revalidateOffers(): void {
  revalidateWholeTree();
}

/**
 * After the Rewards settings or the Discovery Credit switch are saved.
 *
 * The whole tree, and this one is the least optional of the three. These
 * switches decide what the storefront **says**, not only what it charges:
 *
 *   · the signup popup lives in the root layout, on every page;
 *   · the Discovery banner, the set detail page, the comparison table and the
 *     "Unlock Your Credit" step each print a promise conditioned on the switch;
 *   · the bag and the checkout show a points balance that must not survive the
 *     programme being switched off.
 *
 * A stale page here is not a stale price — it is the house promising something
 * it has withdrawn, which is precisely what the specification forbids. AGENTS.md
 * §8 is explicit that a surface quoting stored data and missing from this file
 * is a defect rather than a few minutes of lag.
 */
export function revalidateBenefits(): void {
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
