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

/**
 * The Clerk frontend API host, decoded from the publishable key.
 *
 * Clerk encodes it into the key itself — `pk_test_<base64 of host>$` — so this
 * derives the right origin for whichever instance a deployment is pointed at
 * instead of hard-coding one. That matters because the host differs between
 * environments (`*.clerk.accounts.dev` on a development instance, the custom
 * domain on a production one), and a CSP naming the wrong one does not degrade
 * — it breaks sign-in completely.
 *
 * Returns an empty list rather than throwing when the key is absent or
 * malformed, on the same terms as `commentImagePattern()` below: a checkout
 * without credentials must still build.
 */
function clerkOrigins(): string[] {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  if (key.length === 0) return [];

  try {
    const encoded = key.replace(/^pk_(test|live)_/, "");
    const host = Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");

    // A decoded value that is not a hostname means the key was not a Clerk key.
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return [];

    // Clerk serves its script from the frontend API host and talks to it over
    // XHR; both need naming. The wildcard covers the account portal Clerk
    // redirects to on a development instance.
    return [`https://${host}`, "https://*.clerk.accounts.dev"];
  } catch {
    return [];
  }
}

/** The Supabase origin — Storage images and the Data API both live on it. */
function supabaseOrigin(): string[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (url.length === 0) return [];

  try {
    return [`https://${new URL(url).hostname}`];
  } catch {
    return [];
  }
}

/**
 * The Content Security Policy, assembled from the origins this repository
 * actually talks to rather than from a template.
 *
 * ## Enforcing, after measurement
 *
 * This shipped as `Content-Security-Policy-Report-Only` first, deliberately,
 * and was promoted to enforcing only once a real browser had been driven across
 * the site and reported nothing. What was actually measured, with a
 * `securitypolicyviolation` listener whose sensitivity was proved by injecting
 * a deliberate violation first (a script from `cdn.jsdelivr.net`, correctly
 * reported as `script-src-elem`):
 *
 *   · 14 routes — home, collections, all three product detail routes, journal,
 *     heritage, search, cart, checkout, sign-in, account, contact, stockists —
 *     each loaded, settled to network idle, and scrolled. **Zero violations.**
 *   · `https://js.stripe.com/v3/` loaded and allowed to build its own
 *     infrastructure: the controller-with-preconnect frame, the outer-logger
 *     frame and the m-outer fraud-detection frame. **Zero violations.**
 *   · A `fetch()` to `https://api.stripe.com`. Allowed.
 *   · Every external origin appearing in the delivered HTML of those 14 routes,
 *     enumerated and reconciled against the directives below.
 *
 * ⚠ **One path could not be exercised here and should be smoke-tested on the
 * first preview deploy that has live Stripe keys:** mounting a real Payment
 * Element and completing a 3-D Secure challenge. This machine has no
 * publishable key, so Elements refuses to initialise and the card-input iframe
 * and the `hooks.stripe.com` challenge frame never render. Both origins are in
 * `frame-src` below and match what Stripe.js was observed to use, so this is a
 * confirmation step rather than an expected failure.
 *
 * If checkout ever misbehaves in a way that smells like a blocked resource,
 * reverting is one word: rename the header key back to
 * `Content-Security-Policy-Report-Only`. Diagnose, fix the directive, re-promote.
 *
 * ## `'unsafe-inline'` in `script-src`
 *
 * Required today by the inline `sessionStorage` probe in
 * `app/[locale]/layout.tsx` — which must run before first paint, so it cannot
 * become an external file — and by the JSON-LD blocks. Removing it means
 * threading a nonce through both, which is a change to rendering rather than to
 * this file, and is the natural next hardening step once the policy enforces.
 *
 * `style-src` keeps `'unsafe-inline'` for longer: React inlines style
 * attributes and Motion animates through them.
 */
function contentSecurityPolicy(): string {
  const clerk = clerkOrigins();
  const supabase = supabaseOrigin();

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...clerk,
      "https://js.stripe.com",
      // Clerk's bot protection, when the instance has it enabled.
      "https://challenges.cloudflare.com",
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://res.cloudinary.com",
      "https://images.unsplash.com",
      "https://img.clerk.com",
      ...clerk,
      ...supabase,
    ],
    // The pre-launch cover's film, and any Cloudinary-hosted video.
    "media-src": ["'self'", "https://res.cloudinary.com", ...supabase],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...clerk, ...supabase, "https://api.stripe.com"],
    // Stripe Elements and Clerk's challenge both render in iframes.
    "frame-src": [
      "https://js.stripe.com",
      "https://hooks.stripe.com",
      "https://challenges.cloudflare.com",
      ...clerk,
    ],
    "worker-src": ["'self'", "blob:"],
    // Nothing here may be framed — the clickjacking half of the policy, and the
    // modern spelling of the X-Frame-Options header set beside it.
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    // Forms post to this origin only. Clerk's flows are XHR, not form posts.
    "form-action": ["'self'"],
    "object-src": ["'none'"],
    "upgrade-insecure-requests": [],
  };

  return Object.entries(directives)
    .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}

const nextConfig: NextConfig = {
  /**
   * Browser-side hardening.
   *
   * None of these existed before the pre-launch security audit
   * (`src/docs/SECURITY-AUDIT-STAGE-1.md`, finding F3). Applied to every route
   * — the API routes included, since a JSON response benefits from `nosniff`
   * exactly as much as a document does.
   *
   * HSTS is **not** set here. Vercel already issues it for the apex domain and
   * its certificates, and a `max-age` written into application code is one that
   * outlives the reason it was chosen; getting it wrong locks visitors out of
   * the domain for the length of the directive. It belongs to the platform.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // Enforcing. See the reasoning above `contentSecurityPolicy()` for
            // what was measured before this was promoted, and for the one-word
            // revert if a blocked resource is ever suspected.
            key: "Content-Security-Policy",
            value: contentSecurityPolicy(),
          },
          // Stops a browser second-guessing a declared media type — the
          // defence that matters most for the visitor-uploaded comment images
          // served out of Supabase Storage.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send the full URL within KHEM, only the origin when leaving it, and
          // nothing at all when downgrading to HTTP. Keeps order numbers and
          // account paths out of third-party referrer logs.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The site asks for none of these. Saying so stops an embedded frame
          // asking on its behalf.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          // Belt to `frame-ancestors`' braces, for older browsers.
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },

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
