import type { MetadataRoute } from "next";

import { MERCH_PAGE_FACETS } from "@/src/lib/facets";
import { SCENT_PROFILE_SLUGS } from "@/src/lib/scent-profiles";
import { LOCALES, localizePath, type Locale } from "@/src/lib/i18n/config";
import { SITE_URL } from "@/src/lib/i18n/metadata";
import { getJournalArticles } from "@/src/services/content";
import { getLegalDocuments } from "@/src/services/legal";
import {
  getCategories,
  getCollections,
  getProductSlugs,
  getRitualProductSlugs,
  getSetProductSlugs,
} from "@/src/services/products";

/**
 * `/sitemap.xml` — every indexable URL, in both languages.
 *
 * Lives at the root of `app/`, not inside `[locale]/`: a metadata file
 * convention is only recognised there, and `src/proxy.ts` already excludes
 * `.xml` from its matcher, so the request is never rewritten into the `/en/*`
 * tree.
 *
 * ## Both languages, cross-linked
 *
 * Each route appears **twice** — once as `/path` (English) and once as
 * `/ar/path` — and each entry carries the full `alternates.languages` map
 * including itself. That self-referential, bidirectional shape is what
 * `hreflang` requires: an Arabic URL that names the English one without the
 * English URL naming it back is ignored, and a language version missing from
 * the sitemap is a language version Google may never pair with its sibling.
 *
 * The map is built from `localizePath()`, the same function the pages
 * themselves use for `alternates`, so the sitemap and the `<link rel="alternate">`
 * tags cannot disagree.
 *
 * ## What is deliberately absent
 *
 * `/cart`, `/account/*`, `/sign-in`, `/sign-up`, and `/search`.
 * The first five are personal or transactional surfaces with nothing to index;
 * `/search` already renders `noindex` (see `app/[locale]/search/page.tsx`) and
 * a URL that declares itself unindexable has no business in a sitemap.
 *
 * ## `lastModified` and `priority`
 *
 * `lastModified` is set **only where the data actually carries a date** — the
 * legal documents and the journal. The catalog has no `updatedAt` column yet
 * (see the note in `src/types/catalog.ts`), and stamping `new Date()` on it
 * would tell crawlers every product changed on every deploy, which is how a
 * site teaches Google to stop trusting its `lastmod` entirely. Omitting it is
 * honest and costs nothing.
 *
 * When the catalog moves to Postgres, `Product.updatedAt` and
 * `Collection.updatedAt` already exist in the schema (AGENTS.md §9) — pass them
 * through here and delete this paragraph.
 *
 * `priority` is relative *within* the site and is ignored outright by Google;
 * it is set because other engines still read it, not because it moves rankings.
 */

/** Absolute URL for a locale-agnostic app path. */
function absolute(locale: Locale, path: string): string {
  return `${SITE_URL}${localizePath(locale, path)}`;
}

/** The `hreflang` map for a path — identical on every locale's entry. */
function alternates(path: string) {
  return {
    languages: {
      en: absolute("en", path),
      ar: absolute("ar", path),
      "x-default": absolute("en", path),
    },
  };
}

/** One sitemap entry per locale for a single app path. */
function localizedEntries(
  path: string,
  options: { priority: number; lastModified?: string | Date },
): MetadataRoute.Sitemap {
  return LOCALES.map((locale) => ({
    url: absolute(locale, path),
    priority: options.priority,
    ...(options.lastModified ? { lastModified: options.lastModified } : {}),
    alternates: alternates(path),
  }));
}

/**
 * Static routes and their relative weight.
 *
 * Ordered as they are weighted: the shopfront first, the editorial world
 * second, the legal shelf last.
 */
const STATIC_ROUTES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },

  // Shop
  { path: "/collections", priority: 0.9 },
  /*
   * The four category pages are no longer listed here: they are collections
   * under `/collections/[slug]` now, and come from the dynamic loop below with
   * the fragrance collections.
   */
  { path: "/new-arrival", priority: 0.8 },

  // World of KHEM
  { path: "/heritage", priority: 0.6 },
  { path: "/craftsmanship", priority: 0.6 },
  { path: "/journal", priority: 0.6 },
  { path: "/ingredients", priority: 0.6 },
  { path: "/about", priority: 0.6 },
  { path: "/stockists", priority: 0.6 },
  { path: "/contact", priority: 0.5 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [
    categories,
    collections,
    productSlugs,
    ritualSlugs,
    setSlugs,
    legalDocuments,
    articles,
  ] = await Promise.all([
      // URLs only — every slug is identical in both trees (localizing one
      // would fork the URL space), so the default locale is the right and
      // cheapest argument here.
      getCategories("en"),
      getCollections("en"),
      getProductSlugs(),
      getRitualProductSlugs(),
      getSetProductSlugs(),
      getLegalDocuments("en"),
      getJournalArticles(),
    ]);

  /*
   * The journal index is only as fresh as its newest article — the one date on
   * an editorial listing that is genuinely knowable.
   */
  const latestArticleDate = articles
    .map((article) => article.publishedAt)
    .sort()
    .at(-1);

  return [
    ...STATIC_ROUTES.flatMap(({ path, priority }) =>
      localizedEntries(path, {
        priority,
        lastModified:
          path === "/journal" && latestArticleDate ? latestArticleDate : undefined,
      }),
    ),

    /*
     * Every category — the five shelves. `/collections/body-care` and its three
     * siblings are these pages: they kept the addresses they had while they
     * were collections (`0046_range_collections.sql`), which is what keeps the
     * four legacy 308s in `next.config.ts` landing somewhere real.
     */
    ...categories.flatMap((category) =>
      localizedEntries(`/collections/${category.slug}`, { priority: 0.8 }),
    ),

    // Every collection. A slug is never both a category and a collection —
    // `0047_reserved_slugs.sql` forbids it — so the two loops cannot emit the
    // same URL twice.
    ...collections.flatMap((collection) =>
      localizedEntries(`/collections/${collection.slug}`, { priority: 0.8 }),
    ),

    // The two merchandising pages share that URL space without being rows —
    // see `MERCH_PAGE_FACETS` in `src/lib/facets.ts`.
    ...MERCH_PAGE_FACETS.flatMap((facet) =>
      localizedEntries(`/collections/${facet}`, { priority: 0.8 }),
    ),

    // And the five scent profiles, which share it on the same terms: pages the
    // code owns, assembled from the ingredient tables rather than seeded as
    // rows. See `src/lib/scent-profiles.ts`.
    ...SCENT_PROFILE_SLUGS.flatMap((profile) =>
      localizedEntries(`/collections/${profile}`, { priority: 0.8 }),
    ),

    // Product detail pages — the deepest and most valuable URLs on the site.
    // `getProductSlugs()` is fragrance-only, exactly like `generateStaticParams`,
    // so nothing here can 404.
    ...productSlugs.flatMap((slug) =>
      localizedEntries(`/perfume/${slug}`, { priority: 0.9 }),
    ),

    // Body care and home fragrance, which have detail pages of their own since
    // `0013_product_image_caption.sql`. Scoped by the same query
    // `generateStaticParams` uses, so nothing here can 404 either — and a shade
    // below the fragrances, which are what the house is searched for.
    ...ritualSlugs.flatMap((slug) =>
      localizedEntries(`/ritual/${slug}`, { priority: 0.7 }),
    ),

    // Discovery and gift sets, which gained detail pages with `/set/[slug]`.
    // Scoped by the same query `generateStaticParams` uses, so nothing here can
    // 404. Priority matches the ritual goods: a set is a real product and a
    // genuine entry point — a discovery box is how a lot of people meet the
    // house — but the fragrances are still what it is searched for.
    ...setSlugs.flatMap((slug) =>
      localizedEntries(`/set/${slug}`, { priority: 0.7 }),
    ),

    // Journal articles. `getJournalArticles()` reads through the publishable
    // key, so an unpublished draft is not in this list — the RLS policy on
    // `"Article"` decides what is indexable, exactly as it decides what is
    // readable.
    ...articles.flatMap((article) =>
      localizedEntries(`/journal/${article.slug}`, {
        priority: 0.5,
        lastModified: article.publishedAt,
      }),
    ),

    ...legalDocuments.flatMap((document) =>
      localizedEntries(`/${document.slug}`, {
        priority: 0.3,
        lastModified: document.updatedAt,
      }),
    ),
  ];
}
