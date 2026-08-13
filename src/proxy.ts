import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  DEFAULT_LOCALE,
  LOCALES,
  localizePath,
  stripLocale,
} from "./lib/i18n/config";
import { ACCOUNT_PATHS, AUTH_PATHS } from "./lib/routes";

/**
 * Locale routing with `as-needed` prefixing, wrapped in Clerk's auth gate.
 *
 * Two jobs in one file, in a fixed order: **protect, then rewrite.**
 *
 * ## Locale rewriting
 *
 * Every route lives under `app/[locale]/`, but English must keep the
 * unprefixed URLs the site already ships (`/heritage`, not `/en/heritage`).
 * So a request without a locale prefix is **rewritten** — not redirected —
 * into the internal `/en/*` tree. The visitor's address bar never changes,
 * existing links and indexed URLs keep working, and the prerendered `/en/*`
 * output is still what gets served.
 *
 * Arabic is prefixed (`/ar/heritage`) and passes straight through, since it
 * already matches the `[locale]` segment.
 *
 * There is deliberately no `Accept-Language` detection: auto-redirecting on
 * browser language fragments the CDN cache, overrides visitors who followed a
 * deliberately English link, and confuses crawlers. Locale changes only via
 * the language switcher.
 *
 * ## Authentication
 *
 * `clerkMiddleware()` wraps the rewrite so the session is available to the
 * routes beneath it, and it sends an unauthenticated visitor away from the
 * account tree early — but **it is not the security boundary.**
 *
 * Clerk v7 deprecates `createRouteMatcher` and middleware-based auth, because
 * a matcher pattern can diverge from how Next actually routes a request and
 * leave a protected page reachable. That reasoning is taken seriously here:
 * the authoritative check is resource-based, in
 * `app/[locale]/account/layout.tsx` and in every panel beneath it, each of
 * which calls `getViewer()` and redirects on its own behalf. Deleting the
 * block below would cost a redirect, not a protection.
 *
 * What the early redirect buys is real, though: `[locale]/loading.tsx` means
 * the response starts streaming before the layout resolves, so without it an
 * anonymous request to `/account` is served a full ~100KB page shell and only
 * then told to go elsewhere. The check is written against `stripLocale`
 * rather than a glob so the two URL shapes (`/account` and `/ar/account`)
 * cannot fall out of step — the divergence hazard the deprecation is about.
 *
 * `middleware.ts` is deprecated in Next 16; this is the `proxy.ts` convention,
 * and it is also the file Clerk's Next 16 setup expects.
 */

/** Locales that appear in the URL — the default locale never does. */
const PREFIXED_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

/** The locale rewrite, unchanged in behaviour from before Clerk landed. */
function localeRewrite(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const prefixed = PREFIXED_LOCALES.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (prefixed) return NextResponse.next();

  // Same-origin rewrite only: the destination is built from the request's own
  // URL, so a crafted path can never point the rewrite off-origin.
  const url = request.nextUrl.clone();
  url.pathname = `/${DEFAULT_LOCALE}${pathname === "/" ? "" : pathname}`;

  return NextResponse.rewrite(url);
}

export default clerkMiddleware(async (auth, request) => {
  // The public pathname, split into the locale it addresses and the path
  // beneath — the same function the sidebar uses to mark its active link, so
  // both agree on what "/ar/account/orders" means.
  const { locale, path } = stripLocale(request.nextUrl.pathname);

  const isAccountPath =
    path === ACCOUNT_PATHS.overview ||
    path.startsWith(`${ACCOUNT_PATHS.overview}/`);

  if (isAccountPath) {
    const { userId } = await auth();

    if (userId === null) {
      // Built from the request's own origin and a locale that came out of
      // `stripLocale`, so the destination is same-origin by construction and
      // no crafted path can steer it off-site.
      const signInUrl = new URL(
        localizePath(locale, AUTH_PATHS.signIn),
        request.url,
      );

      return NextResponse.redirect(signInUrl);
    }
  }

  return localeRewrite(request);
});

export const config = {
  // Mirrors the matcher shape in AGENTS.md §10.1. Static assets and `_next`
  // are excluded so neither the auth check nor the rewrite runs for them.
  matcher: [
    "/((?!_next|api|[^?]*\\.(?:html?|css|js(?!on)|json|png|jpg|jpeg|gif|webp|svg|ttf|woff2?|ico|csv|txt|xml|webmanifest)).*)",
  ],
};
