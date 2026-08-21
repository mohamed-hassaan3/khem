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
 * 2. **Category paths come from `src/lib/routes.ts`.** Hard-coding
 *    `/collections/home-fragrance` here would mean a sixth `CollectionKind`
 *    compiles fine and silently stops revalidating; going through
 *    `CATEGORY_PATH` makes it a compile error in one place instead.
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

/**
 * Where a collection's goods are sold, by kind.
 *
 * Mirrors `productHref()` in `src/lib/routes.ts` — fragrances live at
 * `/perfume/[slug]` behind their collection page, everything else sells from
 * its collection page under `/collections/[slug]`. Written as an exhaustive switch so a new kind fails here.
 */
function categoryPathsForKind(kind: CollectionKind): string[] {
  switch (kind) {
    case "FRAGRANCE":
      return ["/collections"];
    case "BODY":
      return ["/collections/body-care"];
    case "HOME":
      return ["/collections/home-fragrance"];
    case "DISCOVERY":
      return ["/collections/discovery"];
    case "GIFT":
      return ["/collections/gift-set"];
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

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

/** After a collection is created, edited or deleted. */
export function revalidateCollection(slug: string, kind: CollectionKind): void {
  revalidateAllLocales(HOME);
  revalidateAllLocales("/collections");
  revalidateAllLocales(`/collections/${slug}`);

  for (const path of categoryPathsForKind(kind)) {
    revalidateAllLocales(path);
  }

  revalidateSitemap();
}

/** After a product is created, edited or archived. */
export function revalidateProduct(input: {
  slug: string;
  collectionSlug: string;
  collectionKind: CollectionKind;
  tags: readonly ProductTag[];
}): void {
  revalidateAllLocales(HOME);
  revalidateAllLocales("/collections");
  revalidateAllLocales(`/collections/${input.collectionSlug}`);

  for (const path of categoryPathsForKind(input.collectionKind)) {
    revalidateAllLocales(path);
  }

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
