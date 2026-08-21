import type { NextConfig } from "next";

import { DEFAULT_LOCALE, LOCALES } from "./src/lib/i18n/config";

/**
 * The category pages that moved under `/collections/[slug]`.
 *
 * Body care, home fragrance, discovery sets and gift sets used to hold routes
 * of their own while the fragrance collections lived at `/collections/[slug]`.
 * They are collections like any other, so they were folded in there — one URL
 * per set of goods instead of two — and every link, bookmark and indexed result
 * that still points at the old path lands here.
 *
 * Home fragrance also changed slug in the same move: the collection has been
 * called Home Fragrances in the catalogue for as long as it has existed, and
 * only the URL still said "room". See `supabase/sql/0011_home_fragrance_slug.sql`.
 *
 * ## Why here and not in the route
 *
 * A `page.tsx` calling `permanentRedirect()` looks equivalent and is not: the
 * routes are prerendered, so Next answers them 200 with a document that
 * redirects after it loads. A crawler reads that as a page, not as a move.
 * `redirects()` runs before rendering and answers 308 — which is the whole
 * point of keeping the paths alive.
 *
 * Both locales are listed because the prefixing is `as-needed`: English URLs
 * carry no prefix (`src/proxy.ts` rewrites them into the `/en/*` tree), so
 * `/ar/body-care` and `/body-care` are two real paths that both need an answer.
 */
const MOVED_CATEGORY_PATHS: ReadonlyArray<readonly [string, string]> = [
  ["/body-care", "/collections/body-care"],
  ["/room-fragrance", "/collections/home-fragrance"],
  ["/discovery", "/collections/discovery"],
  ["/gift-set", "/collections/gift-set"],
];

const nextConfig: NextConfig = {
  async redirects() {
    return LOCALES.flatMap((locale) =>
      MOVED_CATEGORY_PATHS.map(([from, to]) => {
        const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;

        return {
          source: `${prefix}${from}`,
          destination: `${prefix}${to}`,
          permanent: true,
        };
      }),
    );
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        // Clerk-hosted avatars — uploaded pictures and the OAuth provider
        // images Clerk proxies. Only reached by the account identity block,
        // and only for a signed-in visitor's own avatar.
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
};

export default nextConfig;
