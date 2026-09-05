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
  getCategories,
  getCategoryBySlug,
  getCollectionBySlug,
  getCollections,
  getMerchPage,
  getProductCardsByCategory,
  getProductCardsByCollection,
  getProductCardsByScentProfile,
  getScentProfile,
} from "@/src/services/products";
import type { Category } from "@/src/types/catalog";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";

/**
 * ISR, 1 hour — a backstop, not the freshness mechanism.
 *
 * `src/lib/admin/revalidate.ts` re-renders this page on the write that changes
 * it — a product, a collection, a category or a promotion — so the window only
 * has to catch what no admin action announces.
 *
 * The window was ten minutes. At this site's traffic a page is requested far less often
 * than that, so nearly every request landed past the window and paid for a
 * regeneration: ISR writes tracked page views one-for-one and ran over the
 * Vercel allowance. A short window only pays for itself under traffic dense
 * enough to amortise it. See `prompts/vercel-usage-reduction.md`.
 */
export const revalidate = 3600;

/**
 * Prerender every locale × collection pair. Without it the `[slug]` segment
 * would force the route into dynamic rendering.
 *
 * `getCollections()` rather than `getFragranceCollections()`: body care, home
 * fragrance, discovery sets and gift sets are served from here now too — their
 * former routes redirect in — so all seven need prerendering. The
 * merchandising page and the five scent profiles are code-owned lists and are
 * appended from there.
 */
export async function generateStaticParams() {
  // Slugs only; they are identical in both trees, so the locale is
  // immaterial here and the default keeps the query cache warm.
  const [categories, collections] = await Promise.all([
    getCategories("en"),
    getCollections("en"),
  ]);

  /*
   * Categories and collections both, because both are pages here now
   * (`0045_category.sql`): `/collections/body-care` is the category and
   * `/collections/body-mist` a collection beneath it. A slug can never be both
   * — `0047_reserved_slugs.sql` forbids it — so the two lists cannot collide.
   *
   * The product-type slugs that used to be appended are gone: `body-mist` and
   * `room-spray` are real collection rows since `0046`, so they arrive in the
   * list above.
   */
  const slugs = [
    ...categories.map((category) => category.slug),
    ...collections.map((collection) => collection.slug),
    ...MERCH_PAGE_FACETS,
    ...SCENT_PROFILE_SLUGS,
  ];

  return LOCALES.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

/**
 * The hero photograph of last resort.
 *
 * `"MerchPage"` (`supabase/sql/0012_merch_page.sql`) is where this now lives,
 * editable from the dashboard, and it is seeded with exactly this URL. It stays
 * here as the floor under {@link getMerchPage}: with no row, an unparseable
 * row, or the database unreachable, the page renders what it rendered before
 * the table existed rather than failing. The host is already in
 * `next.config.ts`.
 */
const MERCH_PAGE_BANNERS: Record<MerchPageFacet, string> = {
  "best-sellers":
    "https://images.unsplash.com/photo-1738664926458-d8ca7f56549f?w=1800&h=900&fit=crop&auto=format",
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
  row: Pick<Category, "kind">,
): Dictionary["bodyCare"]["meta"] | null {
  switch (row.kind) {
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
      const unreachable: never = row.kind;
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

  /*
   * The category is tried first, exactly as the page is: `/collections/body-care`
   * is a category and `/collections/body-mist` a collection, and the two
   * namespaces cannot overlap (`0047_reserved_slugs.sql`), so the order is about
   * one read finding an answer rather than about precedence.
   */
  const [dict, category, collection] = await Promise.all([
    getDictionary(activeLocale),
    getCategoryBySlug(activeLocale, slug),
    getCollectionBySlug(activeLocale, slug),
  ]);

  if (category) {
    const path = `/collections/${category.slug}`;

    /*
     * The four range pages were written before they shared a route, each with
     * its own `meta` block, and those blocks are better SEO copy than a row's
     * `name` and `description`. They belong to the *category* now — it is the
     * page that kept the address they were written for.
     */
    const meta = categoryMeta(dict, category);

    return meta
      ? localeMetadata({
          locale: activeLocale,
          path,
          title: meta.title,
          description: meta.description,
          ogTitle: meta.ogTitle,
          ogDescription: meta.ogDescription,
        })
      : localeMetadata({
          locale: activeLocale,
          path,
          title: category.name,
          description: category.description,
          ogTitle: `${category.name} | KHEM`,
          ogDescription: category.description,
        });
  }

  if (!collection) {
    // No row, but the slug may still be the merchandising page, which carries
    // its copy in the dictionary rather than in the database.
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

    /*
     * There is no fourth step any more. `body-mist` and `room-spray` were
     * resolved here, from `"Product"."productType"` and a hand-written routing
     * table; `0046_range_collections.sql` made them collection rows, so they are
     * answered by the read above along with every other collection — and their
     * copy is a row an editor can rewrite rather than a dictionary entry a
     * deploy can. The column and its trigger are untouched; only the routing
     * moved.
     */

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

  /*
   * A collection's metadata is its own row, whatever it sells. The `kind`
   * switch that used to sit here belonged to the four range pages, and those
   * are categories now — see the branch above. `body-mist` carries the wording
   * that used to live in `collections.productTypes` in the dictionary, moved
   * onto the row by `0046_range_collections.sql`, so it is editable rather than
   * deployed.
   */
  const path = `/collections/${collection.slug}`;

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
 * `<CategoryView>` for why that is a branch and not a flag); the merchandising
 * cut is assembled here from the catalogue, because it cannot be a row — see
 * `MERCH_PAGE_FACETS` in `src/lib/facets.ts`; and the five scent profiles are
 * assembled from the ingredient tables, for the reason
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

  /*
   * The segment is untrusted input: it is matched against stored category and
   * collection slugs, then against two closed literal lists, and anything else
   * 404s.
   *
   * A category is resolved first. `/collections/body-care` is the shelf and
   * `/collections/body-mist` one range on it, and both are pages; the database
   * forbids a slug being both (`0047_reserved_slugs.sql`), so this order costs
   * nothing and reads in the order the hierarchy does.
   */
  const category = await getCategoryBySlug(activeLocale, slug);

  if (category) {
    /*
     * Every product beneath the category, reached through its collections.
     * This is what keeps `/collections/body-care` showing the same four mists
     * it showed when it was a collection of its own — the products moved down
     * one level and the page reaches through, so no indexed URL lost its
     * contents in the restructure.
     */
    const products = await getProductCardsByCategory(activeLocale, category.slug);

    return category.kind === "FRAGRANCE" ? (
      <CollectionView
        locale={activeLocale}
        collection={category}
        products={products}
        // A category spans its whole shelf, so its count is of everything on it.
        countsEverything
      />
    ) : (
      <CategoryView
        locale={activeLocale}
        collection={category}
        products={products}
      />
    );
  }

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
 * Best sellers, as a collection page.
 *
 * The whole catalogue narrowed by `productFacets()` — the same rule the chips on
 * `/collections` apply, so the page and the chip can never disagree about what
 * a best seller is.
 *
 * An empty result renders the hero and the grid's empty state rather than a 404:
 * the page exists whether or not anything is currently selling, and a link in
 * the menu must never lead to a missing page because of a merchandising
 * decision.
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
      // The cut draws from body care and the sets as well as the perfumes.
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
 * The last of the four resolution steps — an unknown segment 404s from here.
 */
async function renderScentProfile(locale: Locale, slug: string) {
  const profileSlug = parseScentProfileSlug(slug);
  // The last resolution step: an unknown segment 404s from here.
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

