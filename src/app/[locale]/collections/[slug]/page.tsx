import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CategoryView from "@/src/components/ecommerce/CategoryView";
import CollectionView, {
  type CollectionHeader,
} from "@/src/components/ecommerce/CollectionView";
import {
  MERCH_PAGE_FACETS,
  parseMerchPageFacet,
  productFacets,
  type MerchPageFacet,
} from "@/src/lib/facets";
import { LOCALES, isLocale, type Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import {
  getCatalogProductCards,
  getCollectionBySlug,
  getCollections,
  getProductCardsByCollection,
} from "@/src/services/products";
import type { Collection } from "@/src/types/catalog";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";

/** ISR, 10 minutes — AGENTS.md §8 routing matrix. */
export const revalidate = 600;

/**
 * Prerender every locale × collection pair. Without it the `[slug]` segment
 * would force the route into dynamic rendering.
 *
 * `getCollections()` rather than `getFragranceCollections()`: body care, home
 * fragrance, discovery sets and gift sets are served from here now too — their
 * former routes redirect in — so all seven need prerendering.
 */
export async function generateStaticParams() {
  // Slugs only; they are identical in both trees, so the locale is
  // immaterial here and the default keeps the query cache warm.
  const collections = await getCollections("en");

  const slugs = [
    ...collections.map((collection) => collection.slug),
    ...MERCH_PAGE_FACETS,
  ];

  return LOCALES.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

/**
 * The hero photographs for the two merchandising pages.
 *
 * They have no `Collection` row and therefore no `bannerUrl` column to read, so
 * the choice lives in code. Both are already loading elsewhere in the app, so
 * `next.config.ts` needs no new remote pattern — and replacing either with real
 * photography is one line here.
 */
const MERCH_PAGE_BANNERS: Record<MerchPageFacet, string> = {
  "best-sellers":
    "https://images.unsplash.com/photo-1738664926458-d8ca7f56549f?w=1800&h=900&fit=crop&auto=format",
  "limited-edition":
    "https://images.unsplash.com/photo-1709662217788-6a8a1b31562a?w=1800&h=900&fit=crop&auto=format",
};

type RouteParams = { locale: string; slug: string };

/**
 * The dictionary section that carries a category's editorial copy, by kind.
 *
 * The four category pages were written before they shared a route, each with
 * its own `meta` block; those blocks are better SEO copy than a collection row's
 * `name` and `description`, so the merge keeps them and picks between them here.
 * `FRAGRANCE` has no section — a fragrance collection's metadata is its own row.
 */
function categoryMeta(
  dict: Dictionary,
  collection: Collection,
): Dictionary["bodyCare"]["meta"] | null {
  switch (collection.kind) {
    case "BODY":
      return dict.bodyCare.meta;
    case "HOME":
      return dict.homeFragrance.meta;
    case "DISCOVERY":
      return dict.discovery.meta;
    case "GIFT":
      return dict.giftSet.meta;
    case "FRAGRANCE":
      return null;
    default: {
      const unreachable: never = collection.kind;
      return unreachable;
    }
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [dict, collection] = await Promise.all([
    getDictionary(activeLocale),
    getCollectionBySlug(activeLocale, slug),
  ]);

  if (!collection) {
    // No row, but the slug may still be one of the merchandising pages, which
    // carry their copy in the dictionary rather than in the database.
    const facet = parseMerchPageFacet(slug);

    if (facet) {
      const { meta } = dict.collections.merchPages[facet];

      return localeMetadata({
        locale: activeLocale,
        path: `/collections/${facet}`,
        title: meta.title,
        description: meta.description,
        ogTitle: meta.ogTitle,
        ogDescription: meta.ogDescription,
      });
    }

    // A genuinely unknown slug renders the 404 below; its metadata falls back
    // to the overview's rather than echoing the requested segment back into
    // the page.
    return localeMetadata({
      locale: activeLocale,
      path: "/collections",
      title: dict.collections.meta.title,
      description: dict.collections.meta.description,
    });
  }

  const path = `/collections/${collection.slug}`;
  const meta = categoryMeta(dict, collection);

  if (meta) {
    return localeMetadata({
      locale: activeLocale,
      path,
      title: meta.title,
      description: meta.description,
      ogTitle: meta.ogTitle,
      ogDescription: meta.ogDescription,
    });
  }

  return localeMetadata({
    locale: activeLocale,
    path,
    title: collection.name,
    description: collection.description,
    ogTitle: `${collection.name} | KHEM`,
    ogDescription: collection.description,
  });
}

/**
 * One collection.
 *
 * Three page shapes behind one URL space. A fragrance collection is a chapter of
 * the perfume library and renders the library's layout; the four category
 * collections keep the editorial pages they had as standalone routes (see
 * `<CategoryView>` for why that is a branch and not a flag); and the two
 * merchandising cuts are assembled here from the catalogue, because they cannot
 * be rows — see `MERCH_PAGE_FACETS` in `src/lib/facets.ts`.
 *
 * Seeded collections are resolved first, so no row can ever be shadowed by a
 * merchandising slug.
 */
export default async function CollectionPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // The segment is untrusted input: it is matched against seeded slugs, then
  // against a two-member literal list, and anything else 404s.
  const collection = await getCollectionBySlug(activeLocale, slug);

  if (!collection) {
    return renderMerchPage(activeLocale, slug);
  }

  const products = await getProductCardsByCollection(
    activeLocale,
    collection.slug,
  );

  if (collection.kind !== "FRAGRANCE") {
    return (
      <CategoryView
        locale={activeLocale}
        collection={collection}
        products={products}
      />
    );
  }

  return (
    <CollectionView
      locale={activeLocale}
      collection={collection}
      products={products}
    />
  );
}

/**
 * Best sellers and limited editions, as a collection page.
 *
 * The whole catalogue narrowed by `productFacets()` — the same rule the chips on
 * `/collections` apply, so the page and the chip can never disagree about what
 * a best seller is.
 *
 * An empty result renders the hero and the grid's empty state rather than a 404:
 * the page exists whether or not the house currently has anything in a numbered
 * run, and a link in the menu must never lead to a missing page because of a
 * merchandising decision.
 */
async function renderMerchPage(locale: Locale, slug: string) {
  const facet = parseMerchPageFacet(slug);
  if (!facet) notFound();

  const [dict, catalog] = await Promise.all([
    getDictionary(locale),
    getCatalogProductCards(locale),
  ]);

  const copy = dict.collections.merchPages[facet];

  const header: CollectionHeader = {
    slug: facet,
    name: copy.name,
    description: copy.description,
    bannerUrl: MERCH_PAGE_BANNERS[facet],
    bannerAlt: copy.bannerAlt,
  };

  return (
    <CollectionView
      locale={locale}
      collection={header}
      products={catalog.filter((product) =>
        productFacets(product).includes(facet),
      )}
      // Both cuts draw from body care and the sets as well as the perfumes.
      countsEverything
    />
  );
}
