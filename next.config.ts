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

/**
 * Where visitor photographs live.
 *
 * Comment attachments are served from the project's own Supabase Storage
 * bucket (`supabase/sql/0018_comment_rating_images.sql`), whose host is
 * project-specific and therefore read from the environment rather than
 * hard-coded. The `pathname` is pinned to that one public bucket: this entry
 * must not become a licence for `next/image` to proxy anything else the
 * project happens to store.
 *
 * Returns an empty list when the variable is absent, so a checkout without
 * Supabase credentials still builds — the same bargain `isSupabaseConfigured()`
 * strikes at runtime. This cannot import from `src/`: the config is evaluated
 * before the module graph exists.
 */
function commentImagePattern() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (url.length === 0) return [];

  try {
    return [
      {
        protocol: "https" as const,
        hostname: new URL(url).hostname,
        pathname: "/storage/v1/object/public/comment-images/**",
      },
    ];
  } catch {
    // A malformed URL is a deployment problem, not a build-breaking one.
    return [];
  }
}

const nextConfig: NextConfig = {
  /**
   * Files the bundler cannot see being read, but that a function needs anyway.
   *
   * `src/lib/email/logo.ts` reads `public/email/khem-logo.png` at send time and
   * attaches it inline, so the mark renders before the reader has allowed
   * remote images. The path is built with `path.join(process.cwd(), …)`, which
   * no static analysis can follow, so without this entry the file is left out
   * of the deployed function and every email quietly falls back to a remote URL.
   *
   * `public/` being served over HTTP is a separate mechanism entirely and does
   * not make the file readable from a lambda's filesystem.
   */
  outputFileTracingIncludes: {
    "/api/**": ["./public/email/khem-logo.png"],
    "/[locale]/**": ["./public/email/khem-logo.png"],
  },

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
    /*
     * AVIF first, WebP as the fallback.
     *
     * The default is WebP only. This site is photography — bottles, botanicals,
     * editorial spreads — and AVIF is typically 20–30% smaller than WebP at
     * matched quality on exactly that kind of image. The optimizer negotiates
     * on `Accept`, so a browser without AVIF support is served the WebP it
     * would have been served before; nothing is lost for older clients.
     *
     * The cost is encode time on a cache miss, paid once per size per image and
     * then held in the image cache — which is the right trade for a catalogue
     * whose photographs change rarely and are requested constantly.
     */
    formats: ["image/avif", "image/webp"],

    /*
     * Hold an optimized image for a month, not four hours.
     *
     * Next's default `minimumCacheTTL` is 14400s. Past it the next request
     * re-optimizes an image that has not changed, and every re-optimization is
     * a billed transformation — which is the whole of why this project was at
     * 3.8K of its 5K allowance with a catalogue of a few hundred photographs.
     *
     * The documented cost is that there is no way to invalidate the optimizer's
     * cache, so a replaced photograph needs a new URL. That is already how both
     * upstreams work: Cloudinary versions its delivery URLs and the Supabase
     * comment bucket stores one object per upload. Nothing here overwrites an
     * image in place.
     */
    minimumCacheTTL: 2678400,

    /*
     * The widths the optimizer is allowed to produce.
     *
     * Every distinct width is a separate transformation of the same source, so
     * the length of these two lists is a direct multiplier on the bill.
     *
     * `deviceSizes` drops Next's 2048 and 3840. They are only ever selected by
     * a full-width image on a high-DPR desktop, and the cost of losing them is
     * that such a screen is served 1920 rather than 2048/3840 — a difference
     * measured on the widest hero at the closest inspection. Restore them here
     * if the heroes ever look soft on a retina display; nothing else needs to
     * change.
     *
     * `imageSizes` drops 32 and 48 because nothing can ask for them: the
     * narrowest `sizes` prop in the codebase is `56px` (the account menu
     * avatar), which resolves to 64 at 1x and upward from there.
     */
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 384],

    /*
     * One quality, stated rather than inherited.
     *
     * Next 16 requires this allowlist and defaults it to `[75]`, which means the
     * `quality={85}` props this codebase used to carry were never served — they
     * were an intention the optimizer refused. Adding 85 here would have made
     * them real and doubled the transformations for every image that carried
     * one, so the props were removed instead and 75 is written down as the
     * decision it always was in practice.
     */
    qualities: [75],

    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      ...commentImagePattern(),
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
