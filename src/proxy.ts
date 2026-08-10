import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { DEFAULT_LOCALE, LOCALES } from "./lib/i18n/config";

/**
 * Locale routing with `as-needed` prefixing.
 *
 * Every route lives under `app/[locale]/`, but English must keep the
 * unprefixed URLs the site already ships (`/heritage`, not `/en/heritage`).
 * So a request without a locale prefix is **rewritten** — not redirected — into
 * the internal `/en/*` tree. The visitor's address bar never changes, existing
 * links and indexed URLs keep working, and the prerendered `/en/*` output is
 * still what gets served.
 *
 * Arabic is prefixed (`/ar/heritage`) and passes straight through, since it
 * already matches the `[locale]` segment.
 *
 * There is deliberately no `Accept-Language` detection: auto-redirecting on
 * browser language fragments the CDN cache, overrides visitors who followed a
 * deliberately English link, and confuses crawlers. Locale changes only via the
 * language switcher.
 *
 * `middleware.ts` is deprecated in Next 16; this is the `proxy.ts` convention.
 */

/** Locales that appear in the URL — the default locale never does. */
const PREFIXED_LOCALES = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE);

export function proxy(request: NextRequest) {
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

export const config = {
  // Mirrors the matcher shape in AGENTS.md §10.1 so Clerk's middleware can be
  // layered in later without re-deriving the exclusions.
  matcher: [
    "/((?!_next|api|[^?]*\\.(?:html?|css|js(?!on)|json|png|jpg|jpeg|gif|webp|svg|ttf|woff2?|ico|csv|txt|xml|webmanifest)).*)",
  ],
};
