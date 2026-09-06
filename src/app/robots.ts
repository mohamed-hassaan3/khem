import type { MetadataRoute } from "next";

import { SITE_URL } from "@/src/lib/i18n/metadata";

/**
 * `/robots.txt`.
 *
 * At the root of `app/` for the same reason `sitemap.ts` is, and reachable for
 * the same reason: `src/proxy.ts` excludes `.txt` from its matcher, so the
 * request is never rewritten into the `/en/*` tree.
 *
 * ## Why `/search` is *not* disallowed
 *
 * It looks like the obvious candidate — thin, infinite, visitor-generated URLs.
 * But `robots.txt` governs **crawling**, not indexing, and the two interact in
 * a way that trips people up: a disallowed URL can still be indexed from
 * external links, as a bare URL with no description, and because the crawler
 * was never allowed to fetch the page it never sees the `noindex` that would
 * have kept it out. Blocking here would defeat the very tag meant to do the job.
 *
 * `/search` already sends `noindex, follow` from its `generateMetadata`, and
 * the empty state links to `/search?q=…` internally, so crawlers will find
 * those URLs. Letting them fetch and read the `noindex` is what actually keeps
 * them out of the index — and `follow` still passes the link value on to the
 * products.
 *
 * The paths below get the opposite treatment because they carry no `noindex`
 * and nothing worth crawling: `robots.txt` is the only signal available for
 * them, and none of them are linked in a way that would strand a bare URL in
 * the index.
 */

const DISALLOWED = [
  "/api/",
  "/account",
  "/ar/account",
  // The dashboard. Every page beneath it also sends `noindex, nofollow` from
  // its layout metadata — a crawler that ignores this file still gets told.
  "/admin",
  "/ar/admin",
  "/cart",
  "/ar/cart",
  "/sign-in",
  "/ar/sign-in",
  "/sign-up",
  "/ar/sign-up",
  /*
   * ⚠️ TEMPORARY — the pre-launch cover. Delete with the feature.
   *
   * One entry, not two: the route lives outside `app/[locale]/`, so there is no
   * `/ar/prelaunch` to disallow.
   *
   * This blocks the *address*, not the cover. When the flag is on, a crawler
   * asking for `/` is served the cover's HTML at `/` — a rewrite, not a redirect
   * — and that response carries the home page's own title, description and
   * canonical. What this line prevents is `/prelaunch` being crawled as a second
   * URL for the same document, which is the duplicate-content problem §20 names.
   */
  "/prelaunch",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /*
       * Both locale trees are listed explicitly. `robots.txt` matches on the
       * literal URL path, and the Arabic tree is a real prefixed path — a rule
       * for `/cart` says nothing about `/ar/cart`, which would leave the Arabic
       * half of the site open while the English half was closed.
       */
      disallow: DISALLOWED,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    // Yandex-only; harmless elsewhere, and it names the canonical origin.
    host: SITE_URL,
  };
}
