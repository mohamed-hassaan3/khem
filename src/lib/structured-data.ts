/**
 * Schema.org structured data for KHEM.
 *
 * One module builds every JSON-LD graph on the site, so the entity KHEM
 * presents to a search engine is assembled in a single place rather than
 * re-described, slightly differently, on each route. That consistency is the
 * whole mechanism: a crawler decides that `/perfume/eva`, `/journal/…` and the
 * home page belong to one brand because they keep naming the same `@id`, not
 * because the word "KHEM" appears on all three.
 *
 * ## Rules this module keeps
 *
 * 1. **Nothing is invented.** Every value comes from a stored row, a shipped
 *    constant, or the request. Schema.org rewards accuracy and penalises
 *    fabrication — an `aggregateRating` nobody earned, an `Offer` at a price
 *    the page does not show, a `sameAs` pointing at a profile the house does
 *    not run. Where a fact is unavailable the property is **omitted**, never
 *    guessed: an absent property is neutral, a wrong one is a manual action.
 * 2. **It describes only what the visitor can see.** The structured data on a
 *    product page states the price, availability and description that page
 *    renders. If those disagree, the markup is wrong by definition.
 * 3. **Stable `@id`s.** `Organization` and `WebSite` are declared once, at the
 *    root, and referenced by `@id` everywhere else. That is what lets a crawler
 *    resolve "the brand of this perfume" to "the organisation behind this site"
 *    instead of inferring two unrelated entities with the same name.
 * 4. **Every graph is serialised by `jsonLdHtml()`** — see `src/lib/json-ld.ts`.
 *    `JSON.stringify` alone does not escape `<` and would let stored text break
 *    out of the `<script>` element.
 *
 * ## Why `@graph` rather than several script tags
 *
 * A single `application/ld+json` block holding a `@graph` array lets the
 * entities cross-reference each other by `@id` within one document, which is
 * how `BreadcrumbList` → `WebPage` → `Product` → `Brand` becomes one connected
 * description instead of four disconnected ones.
 */

import "server-only";

import { SITE_URL } from "./i18n/metadata";
import { localizePath, type Locale } from "./i18n/config";

/**
 * Stable identifiers for the two entities that exist site-wide.
 *
 * Fragment `@id`s on the site's own origin, which is the convention Google
 * documents: the identifier is a URL that resolves to the page describing the
 * thing, disambiguated by fragment.
 */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** The house, as one sentence. Mirrors the brand line the site itself uses. */
const ORGANIZATION_DESCRIPTION =
  "KHEM is a luxury Egyptian fragrance house — Essence of Heritage — composing " +
  "perfumes that draw on five millennia of Egyptian perfumery.";

export interface SocialLink {
  url: string;
}

/**
 * `Organization` and `WebSite`, for the root layout.
 *
 * Emitted on every page. That is deliberate and is not duplicate content: the
 * `@id`s are identical everywhere, so a crawler merges the statements into one
 * entity rather than counting them twice, and any page can then be the one it
 * happens to crawl first.
 *
 * `sameAs` is passed in from `"SocialProfile"` rather than hard-coded, because
 * §19.5.7 of the audit brief is explicit that social profiles must not be
 * invented — the house's real accounts are rows, and if a row is removed the
 * claim disappears with it.
 */
export function organizationGraph(socials: readonly SocialLink[]) {
  const sameAs = socials.map((s) => s.url).filter((url) => url.length > 0);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "KHEM Perfumes",
        alternateName: "KHEM",
        url: `${SITE_URL}/`,
        description: ORGANIZATION_DESCRIPTION,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/opengraph-image.png`,
        },
        // Only when the house actually publishes the profile.
        ...(sameAs.length > 0 ? { sameAs } : {}),
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: `${SITE_URL}/`,
        name: "KHEM Perfumes",
        description: ORGANIZATION_DESCRIPTION,
        publisher: { "@id": ORGANIZATION_ID },
        /*
         * The site search, declared so a search engine may offer it directly.
         *
         * Points at the real `/search` route with the real query parameter —
         * `src/app/[locale]/search/page.tsx` reads `q`. A `SearchAction` naming
         * a parameter the site does not honour is worse than none: it produces
         * a search box that returns an empty page.
         */
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

/** One crumb: a label and the app path it points at. */
export interface Crumb {
  name: string;
  /** Locale-agnostic app path, e.g. `/collections/signature`. */
  path: string;
}

/**
 * `BreadcrumbList`, built from the trail a page already renders.
 *
 * Takes the crumbs the page displays rather than deriving them from the URL, so
 * the markup and the visible trail cannot drift — Google requires that a
 * breadcrumb reflect what the reader can see.
 */
function breadcrumbList(locale: Locale, crumbs: readonly Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${SITE_URL}${localizePath(locale, crumb.path)}`,
    })),
  };
}

/** What `productGraph` needs. A subset of `Product`, named rather than imported
 *  wholesale so it is obvious which fields reach the markup. */
export interface ProductForMarkup {
  name: string;
  slug: string;
  description: string;
  sku: string;
  priceInCents: number;
  /** Online stock. Drives `availability`, nothing else. */
  inventory: number;
  images: readonly { url: string; alt: string }[];
  volumeMl: number | null;
}

/**
 * `Product` + `Offer` + `Brand`, plus the breadcrumb trail above it.
 *
 * ## On price and currency
 *
 * `priceInCents` is Egyptian **piastres** — the minor unit of the currency the
 * catalogue is stored and settled in (`src/lib/currency.ts`). Schema.org's
 * `price` is a major-unit decimal, so it is divided by 100 here and the
 * currency is stated as `EGP`.
 *
 * ⚠ The six display currencies the storefront can render are a presentation
 * transform and must never reach this function. A converted figure in
 * structured data would be a price the checkout will not honour — the exact
 * mismatch between markup and page that Google issues manual actions for, and
 * a consumer-protection problem before it is an SEO one.
 *
 * ## On availability
 *
 * Read from the online inventory counter, the same number the page uses to
 * decide whether to disable its add-to-cart button. `priceValidUntil` is
 * deliberately omitted: the house does not publish an expiry for its prices,
 * and inventing one would make every product look like a lapsed offer the day
 * it passed.
 *
 * ## On ratings
 *
 * No `aggregateRating` or `review` is emitted, even though the site has a
 * comments feature. Those comments are not a moderated review corpus with
 * verified ratings, and fabricating star markup from them is precisely the
 * "fake reviews / fake ratings" the brief forbids. If a genuine review system
 * with verified purchases lands later, this is where it attaches.
 */
export function productGraph({
  locale,
  product,
  crumbs,
  route = "perfume",
}: {
  locale: Locale;
  product: ProductForMarkup;
  /** The visible trail, ending at this product. */
  crumbs: readonly Crumb[];
  /**
   * Which detail route this product lives on.
   *
   * Three routes sell products — `/perfume/[slug]` for fragrances,
   * `/ritual/[slug]` for body and home goods, `/set/[slug]` for discovery and
   * gift boxes — and the `url` here has to be the page's own canonical, since
   * that is what ties the `Offer` to an address a buyer can reach. Defaults to
   * the fragrance route, which is the majority of the catalogue.
   */
  route?: "perfume" | "ritual" | "set";
}) {
  const url = `${SITE_URL}${localizePath(locale, `/${route}/${product.slug}`)}`;
  const images = product.images.map((image) => image.url).filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name: product.name,
        description: product.description,
        sku: product.sku,
        url,
        ...(images.length > 0 ? { image: images } : {}),
        brand: { "@id": ORGANIZATION_ID },
        // Only when the object is genuinely measured in millilitres — a gift
        // box or a decorative piece is not.
        ...(product.volumeMl !== null
          ? {
              size: `${product.volumeMl} ml`,
              additionalProperty: {
                "@type": "PropertyValue",
                name: "Volume",
                value: product.volumeMl,
                unitCode: "MLT",
              },
            }
          : {}),
        offers: {
          "@type": "Offer",
          url,
          priceCurrency: "EGP",
          price: (product.priceInCents / 100).toFixed(2),
          availability:
            product.inventory > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@id": ORGANIZATION_ID },
        },
      },
      breadcrumbList(locale, crumbs),
    ],
  };
}

/**
 * `CollectionPage` + `BreadcrumbList` for a collection or category listing.
 *
 * `CollectionPage` rather than `ItemList`: the page *is* a described collection
 * with a name and an editorial description, and the products on it are already
 * described in full on their own pages. Restating each product here would
 * duplicate those entities under different `@id`s, which is the "duplicate or
 * conflicting entities" the brief warns about.
 */
export function collectionGraph({
  locale,
  name,
  description,
  path,
  crumbs,
}: {
  locale: Locale;
  name: string;
  description: string;
  path: string;
  crumbs: readonly Crumb[];
}) {
  const url = `${SITE_URL}${localizePath(locale, path)}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name,
        description,
        isPartOf: { "@id": WEBSITE_ID },
        publisher: { "@id": ORGANIZATION_ID },
      },
      breadcrumbList(locale, crumbs),
    ],
  };
}
