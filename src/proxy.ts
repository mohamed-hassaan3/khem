import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  CURRENCY_COOKIE,
  CURRENCY_COOKIE_MAX_AGE,
  isCurrency,
  resolveCurrencyForCountry,
} from "./lib/currency";
import { signInPathWithReturn } from "./lib/auth-redirect";
import { DEFAULT_LOCALE, LOCALES, stripLocale } from "./lib/i18n/config";
import { ACCOUNT_PATHS, ADMIN_PATH } from "./lib/routes";

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
 * The same applies to `/admin`, added alongside it: the authoritative check
 * there is `requireAdmin()` in `app/[locale]/admin/layout.tsx` and again at the
 * top of every Server Action under `src/actions/admin/`, which compares a
 * *verified email* against an allowlist rather than merely observing a session.
 * This file cannot do that — `auth()` here yields a session, not a user record
 * — which is precisely why it must not be mistaken for the gate.
 *
 * What the early redirect buys is real, though: `[locale]/loading.tsx` means
 * the response starts streaming before the layout resolves, so without it an
 * anonymous request to `/account` is served a full ~100KB page shell and only
 * then told to go elsewhere. The check is written against `stripLocale`
 * rather than a glob so the two URL shapes (`/account` and `/ar/account`)
 * cannot fall out of step — the divergence hazard the deprecation is about.
 *
 * ## Currency detection
 *
 * The third job, and the only one that reads the visitor's location: the
 * request's `x-vercel-ip-country` header is mapped to one of six display
 * currencies and written to a cookie the client reads after hydration.
 *
 * This does not contradict the paragraph above. Auto-redirecting on
 * `Accept-Language` is refused because it moves the visitor to a *different
 * URL* — which fragments the CDN cache, overrides a deliberate link, and gives
 * a crawler two answers for one address. A currency is none of that: it is a
 * display transform applied to the same page, at the same URL, after the
 * static HTML has already been served. Nothing about the cached document
 * changes, so there is nothing to fragment.
 *
 * The cookie is written **only when absent or invalid**, which is what makes
 * the footer switcher authoritative: once a visitor has chosen, geo never
 * overwrites them. When the header is missing — local dev, or any non-Vercel
 * host — nothing is written and the client falls back to its own timezone
 * heuristic. A country is never fabricated.
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

/**
 * Stamp the display currency onto a response, if it does not already have one.
 *
 * Every response leaving this file goes through here rather than only the two
 * "normal" paths, so a future fourth `return` cannot silently ship a visitor
 * without a currency.
 *
 * The country code is untrusted — a client can send that header to a non-Vercel
 * origin — so it is only ever a key into the fixed map in `currency.ts`, and an
 * unrecognised value resolves to USD. Nothing derived from the visitor's
 * location is stored beyond the three-letter code: no IP, no country.
 */
function withCurrencyCookie(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  // A stored choice wins over geo — that is what makes the footer switcher
  // stick. An invalid value (stale build, hand-edited cookie) is overwritten.
  const stored = request.cookies.get(CURRENCY_COOKIE)?.value;
  if (isCurrency(stored)) return response;

  const country = request.headers.get("x-vercel-ip-country");
  // No header means no geolocation available. Writing USD here would be a
  // guess dressed as a decision, and it would lock out the client fallback.
  if (country === null) return response;

  response.cookies.set(CURRENCY_COOKIE, resolveCurrencyForCountry(country), {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // The client has to read this to format prices; it carries a display
    // preference and nothing else, and must never be extended to carry more.
    httpOnly: false,
    maxAge: CURRENCY_COOKIE_MAX_AGE,
  });

  return response;
}

/**
 * ⚠️ TEMPORARY — the design review surface at `/design-preview`.
 *
 * It lives outside `app/[locale]/`, so the rewrite below would push it to
 * `/en/design-preview`, which does not exist and would be answered by the
 * `[locale]/[...rest]` catch-all as a 404.
 *
 * This grants no privilege — it only skips the locale rewrite. Delete this
 * constant, its use below, and `src/app/design-preview/` together.
 */
const DESIGN_PREVIEW_PATH = "/design-preview";

export default clerkMiddleware(async (auth, request) => {
  if (request.nextUrl.pathname === DESIGN_PREVIEW_PATH) {
    return withCurrencyCookie(request, NextResponse.next());
  }

  // The public pathname, split into the locale it addresses and the path
  // beneath — the same function the sidebar uses to mark its active link, so
  // both agree on what "/ar/account/orders" means.
  const { locale, path } = stripLocale(request.nextUrl.pathname);

  const isAccountPath =
    path === ACCOUNT_PATHS.overview ||
    path.startsWith(`${ACCOUNT_PATHS.overview}/`);

  /*
   * The dashboard, shed early for the same reason and with the same caveat: it
   * is a cost optimisation, not the boundary. The real check is
   * `requireAdmin()` in `app/[locale]/admin/layout.tsx` and at the top of every
   * action in `src/actions/admin/` — and it is a *stronger* check than anything
   * expressible here, because it compares a verified email against the
   * allowlist rather than merely asking whether somebody is signed in.
   *
   * Which is why this block redirects only the anonymous case. A signed-in
   * customer is let through to the layout, which answers with `notFound()`
   * rather than a redirect: 404 does not confirm that `/admin` exists.
   */
  const isAdminPath = path === ADMIN_PATH || path.startsWith(`${ADMIN_PATH}/`);

  if (isAccountPath || isAdminPath) {
    const { userId } = await auth();

    if (userId === null) {
      // Built from the request's own origin and a locale that came out of
      // `stripLocale`, so the destination is same-origin by construction and
      // no crafted path can steer it off-site.
      //
      // The requested path rides along as Clerk's `redirect_url`, so someone
      // who asked for `/account/orders` is returned to `/account/orders` and
      // not dropped on the portal index. It is the real pathname plus its
      // query — already same-origin, and re-checked by `signInPathWithReturn`
      // on the way in.
      const signInUrl = new URL(
        signInPathWithReturn(
          locale,
          `${request.nextUrl.pathname}${request.nextUrl.search}`,
        ),
        request.url,
      );

      return withCurrencyCookie(request, NextResponse.redirect(signInUrl));
    }
  }

  return withCurrencyCookie(request, localeRewrite(request));
});

export const config = {
  // Mirrors the matcher shape in AGENTS.md §10.1. Static assets and `_next`
  // are excluded so neither the auth check nor the rewrite runs for them.
  matcher: [
    "/((?!_next|api|[^?]*\\.(?:html?|css|js(?!on)|json|png|jpg|jpeg|gif|webp|svg|ttf|woff2?|ico|csv|txt|xml|webmanifest)).*)",
  ],
};
