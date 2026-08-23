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
import {
  SCENT_PROFILE_BANNERS,
  SCENT_PROFILE_FAMILIES,
  SCENT_PROFILE_SLUGS,
  parseScentProfileSlug,
} from "@/src/lib/scent-profiles";
import { LOCALES, isLocale, type Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import {
  getCatalogProductCards,
  getCollectionBySlug,
  getCollections,
  getMerchPage,
  getProductCardsByCollection,
  getProductCardsByScentProfile,
  getScentProfile,
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
 * former routes redirect in — so all seven need prerendering. The two
 * merchandising pages and the five scent profiles are code-owned lists and are
 * appended from there.
 */
export async function generateStaticParams() {
  // Slugs only; they are identical in both trees, so the locale is
  // immaterial here and the default keeps the query cache warm.
  const collections = await getCollections("en");

  const slugs = [
    ...collections.map((collection) => collection.slug),
    ...MERCH_PAGE_FACETS,
    ...SCENT_PROFILE_SLUGS,
  ];

  return LOCALES.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

/**
 * The hero photographs of last resort.
 *
 * `"MerchPage"` (`supabase/sql/0012_merch_page.sql`) is where these now live,
 * editable from the dashboard, and it is seeded with exactly these two URLs.
 * They stay here as the floor under {@link getMerchPage}: with no row, an
 * unparseable row, or the database unreachable, the page renders what it
 * rendered before the table existed rather than failing. Both hosts are already
 * in `next.config.ts`.
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

    // Then the five scent profiles, whose stored row is an override of the
    // dictionary copy — so a rewritten description reaches the search result
    // as well as the page.
    const profileSlug = parseScentProfileSlug(slug);

    if (profileSlug) {
      const copy = dict.collections.scentProfiles[profileSlug];
      const stored = await getScentProfile(activeLocale, profileSlug);

      return localeMetadata({
        locale: activeLocale,
        path: `/collections/${profileSlug}`,
        title: stored?.name ?? copy.meta.title,
        description: stored?.description ?? copy.meta.description,
        ogTitle: copy.meta.ogTitle,
        ogDescription: stored?.description ?? copy.meta.ogDescription,
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
 * Four page shapes behind one URL space. A fragrance collection is a chapter of
 * the perfume library and renders the library's layout; the four category
 * collections keep the editorial pages they had as standalone routes (see
 * `<CategoryView>` for why that is a branch and not a flag); the two
 * merchandising cuts are assembled here from the catalogue, because they cannot
 * be rows — see `MERCH_PAGE_FACETS` in `src/lib/facets.ts`; and the five scent
 * profiles are assembled from the ingredient tables, for the reason
 * `src/lib/scent-profiles.ts` gives.
 *
 * Seeded collections are resolved first, so no row can ever be shadowed by a
 * merchandising or profile slug.
 */
export default async function CollectionPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // The segment is untrusted input: it is matched against seeded slugs, then
  // against two closed literal lists, and anything else 404s.
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
  if (!facet) return renderScentProfile(locale, slug);

  const [dict, catalog, stored] = await Promise.all([
    getDictionary(locale),
    getCatalogProductCards(locale),
    getMerchPage(locale, facet),
  ]);

  const copy = dict.collections.merchPages[facet];

  /*
   * The stored row wins whole, rather than field by field: a half-database,
   * half-dictionary header would put an editor's new hero above the old
   * description and give nobody a way to reason about what they are looking at.
   */
  const header: CollectionHeader = stored ?? {
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

/**
 * One scent profile, as a collection page.
 *
 * The products built on materials of this profile's olfactive families —
 * `"ScentProfile".families` meets `"Ingredient".families`, and
 * `"IngredientUsage"` names the perfumes each material is used in. Membership is
 * derived from that relation and stored nowhere, which is why recataloguing an
 * ingredient moves every page that depends on it at once. See
 * `src/lib/scent-profiles.ts`.
 *
 * The stored row wins whole or not at all, exactly as it does above: with the
 * table empty, unparseable, or unreachable, the page renders the dictionary copy
 * and the banner constant, and the families fall back to
 * {@link SCENT_PROFILE_FAMILIES} so the grid still fills.
 *
 * An empty result renders the hero and the grid's empty state rather than a 404,
 * for the reason `renderMerchPage()` gives: five menu links point here, and none
 * of them may break because nothing in the catalogue currently smells of figs.
 *
 * This is the last resolution step — an unknown slug 404s from here.
 */
async function renderScentProfile(locale: Locale, slug: string) {
  const profileSlug = parseScentProfileSlug(slug);
  if (!profileSlug) notFound();

  const [dict, stored] = await Promise.all([
    getDictionary(locale),
    getScentProfile(locale, profileSlug),
  ]);

  const copy = dict.collections.scentProfiles[profileSlug];

  const header: CollectionHeader = stored ?? {
    slug: profileSlug,
    name: copy.name,
    description: copy.description,
    bannerUrl: SCENT_PROFILE_BANNERS[profileSlug],
    bannerAlt: copy.bannerAlt,
  };

  /*
   * The families come from the row where there is one — an editor who widens
   * "fresh" to take in herbal materials must be able to do it without a deploy —
   * and from the constant otherwise. A row with an empty array is treated as
   * having none, not as missing: emptying the column is a decision.
   */
  const families = stored?.families ?? SCENT_PROFILE_FAMILIES[profileSlug];

  const products = await getProductCardsByScentProfile(locale, families);

  return (
    <CollectionView
      locale={locale}
      collection={header}
      products={products}
      // A profile crosses the fragrance boundary: a cedar candle is woody too.
      countsEverything
    />
  );
}
