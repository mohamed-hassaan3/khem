import type { Metadata } from "next";

import { OG_LOCALE, localeAlternates, localizePath, type Locale } from "./config";

/**
 * The canonical origin — the custom domain, never the `*.vercel.app` deployment
 * URL.
 *
 * Everything absolute is built from it: `metadataBase`, every canonical, every
 * `hreflang` alternate, and every OpenGraph `url`. Pointing it at a deployment
 * URL would tell crawlers the deployment is canonical and split the site's
 * ranking signals across two origins.
 */
export const SITE_URL = "https://khemperfumes.com";

const OG_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "KHEM Perfumes",
};

/**
 * Page metadata for a localized route.
 *
 * Next merges `metadata` field-by-field, not deeply: a page that declares its
 * own `openGraph` *replaces* the layout's whole block rather than extending it.
 * Left to each page, that silently drops `og:locale`, `og:image`, `og:url`,
 * `og:type`, and `og:site_name` — and `og:locale` is exactly the signal that
 * tells crawlers the two trees are different languages rather than duplicates.
 *
 * So every page builds its OpenGraph block here, complete, instead of
 * hand-rolling a partial one.
 *
 * `image` and `article` exist for the journal, which is the one part of the
 * site where a page has a picture and a publication date of its own. They are
 * options on this function rather than a second `openGraph` block on the
 * article page, for exactly the reason above: a partial block would drop
 * `og:locale` and cost the Arabic tree its pairing.
 */
export function localeMetadata({
  locale,
  path,
  title,
  description,
  ogTitle,
  ogDescription,
  image,
  article,
}: {
  locale: Locale;
  /** Locale-agnostic app path, e.g. `/journal`. */
  path: string;
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  /**
   * Page-specific share image. Falls back to the house card. No `width`/
   * `height`: the article banners are remote and their dimensions are not known
   * here, and a declared size that is wrong is worse than none.
   */
  image?: { url: string; alt: string };
  /** Present on an editorial page; switches `og:type` to `article`. */
  article?: { publishedTime: string; section?: string };
}): Metadata {
  return {
    title,
    description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      ...(article
        ? {
            type: "article",
            publishedTime: article.publishedTime,
            ...(article.section ? { section: article.section } : {}),
          }
        : { type: "website" }),
      locale: OG_LOCALE[locale],
      url: `${SITE_URL}${localizePath(locale, path)}`,
      siteName: "KHEM Perfumes",
      title: ogTitle ?? title,
      description: ogDescription ?? description,
      images: [image ? { url: image.url, alt: image.alt } : OG_IMAGE],
    },
  };
}
