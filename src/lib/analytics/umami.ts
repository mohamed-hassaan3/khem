/**
 * Umami — visitor analytics, self-hosted on the house's own VPS.
 *
 * Everything the storefront knows about Umami lives in this file: where the
 * tracker is served from, which paths may never be reported, and the one typed
 * way to send a custom event. The component that loads the script
 * (`components/analytics/UmamiAnalytics.tsx`) and the admin rail's dashboard
 * link both read from here.
 *
 * ## First-party, so the CSP does not change
 *
 * The tracker is served from `khemperfumes.com/hk.js` and posts to
 * `khemperfumes.com/api/hk`; nginx forwards both to the Umami container on
 * loopback (`deploy/nginx/khemperfumes.conf`). The browser never talks to a
 * third-party origin, so `script-src` and `connect-src` stay `'self'`. If a
 * request to `analytics.khemperfumes.com` ever shows up in a CSP report, the
 * proxy is broken — fix nginx, do not widen the policy.
 *
 * ## Not consent-gated
 *
 * Umami is cookieless: the v3.5.0 tracker never writes a cookie, localStorage,
 * sessionStorage or IndexedDB (its one storage access is *reading*
 * `localStorage['umami.disabled']`, an opt-out switch). So it counts every
 * visit regardless of the cookie banner — see `shouldLoadUmami()`. What may be
 * reported is decided here, by path, for everyone alike.
 * Runbook: `src/docs/umami-analytics.md`.
 */

import { SITE_URL } from "@/src/lib/i18n/metadata";
import { stripLocale } from "@/src/lib/i18n/config";

/**
 * The site's ID inside Umami (Settings → Websites). Inlined at build time, so
 * changing it needs a redeploy. Absent means analytics is off: the component
 * renders nothing and `trackEvent()` is a no-op.
 */
export const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? "";

/**
 * Where the tracker is loaded from. Same-origin by default — see the module
 * comment. Overridable only so a local Umami can be pointed at in development.
 */
export const UMAMI_SCRIPT_SRC =
  process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || "/hk.js";

/** The dashboard. Linked from the admin rail; authentication stays in Umami. */
export const UMAMI_DASHBOARD_URL = "https://analytics.khemperfumes.com";

/**
 * The only hostname that records. Localhost, the VPS's bare IP and any
 * preview host load the script (when configured) but send nothing — the
 * tracker compares this against `location.hostname` itself.
 */
export const UMAMI_DOMAIN = new URL(SITE_URL).hostname;

/**
 * Name of the `window` function the tracker calls before every send
 * (`data-before-send`). Namespaced so it cannot collide with anything else.
 */
export const BEFORE_SEND_HANDLER = "khemUmamiBeforeSend";

export function isUmamiConfigured(): boolean {
  // Read at call time rather than from the constant above, so a test can set
  // it. Next inlines a `NEXT_PUBLIC_` reference wherever it appears, so in the
  // browser this is the same build-time value either way.
  return (process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? "").length > 0;
}

/**
 * Whether the tracker loads on this page view.
 *
 * Deliberately takes **no consent input**. Umami sets no cookies and writes
 * nothing to the visitor's device, so it counts every visit whatever the
 * cookie banner says (`prompts/umami-count-every-visitor.md`). The protections
 * live elsewhere: the path filter below, the tracker's query/hash stripping,
 * Do-Not-Track, and the domain lock. `scripts/umami-analytics.test.ts` pins
 * this signature — if consent ever has to matter again, that is a decision,
 * not a refactor.
 */
export function shouldLoadUmami(): boolean {
  return isUmamiConfigured();
}

/**
 * Paths that are never reported, compared after the locale prefix is removed
 * (`/ar/admin/orders/KHEM-…` is `/admin/orders/KHEM-…`).
 *
 * - `/admin` — order numbers, customer IDs and discount codes are in its URLs,
 *   and staff browsing is not visitor traffic.
 * - `/account` — a customer's own pages.
 * - `/sign-in`, `/sign-up` — Clerk flows, whose sub-paths carry flow state.
 * - `/unsubscribe` — reached only from an email link holding a token.
 *
 * Query strings and hashes are already stripped by the tracker
 * (`data-exclude-search`, `data-exclude-hash`), so tokens in a query never
 * reach this list — it is about the *path*.
 */
export const EXCLUDED_PATH_PREFIXES: readonly string[] = [
  "/admin",
  "/account",
  "/sign-in",
  "/sign-up",
  "/unsubscribe",
];

/**
 * Whether a URL the tracker is about to report is allowed out.
 *
 * Accepts an absolute URL or a same-origin path — the tracker sends the page
 * as the former and a same-origin referrer as the latter. Anything that does
 * not parse is refused: an unknown shape is not one this list has vetted.
 */
export function shouldSendPath(url: unknown): boolean {
  if (typeof url !== "string" || url.length === 0) return false;

  let pathname: string;
  try {
    pathname = new URL(url, SITE_URL).pathname;
  } catch {
    return false;
  }

  const { path } = stripLocale(pathname);

  return !EXCLUDED_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** What the tracker passes to `data-before-send`. */
export type UmamiPayload = Record<string, unknown>;

export type UmamiBeforeSend = (
  type: string,
  payload: UmamiPayload,
) => UmamiPayload | null;

/**
 * The tracker's last word before every send (`data-before-send`).
 *
 * - A page on the excluded list is dropped outright.
 * - A same-origin referrer arrives as a path. Moving from an excluded page to
 *   a public one (the admin's "View storefront" link, say) would otherwise
 *   report the admin path as where the visitor came from, so it is blanked.
 * - Anything else passes unchanged.
 */
export const beforeSend: UmamiBeforeSend = (_type, payload) => {
  if (!shouldSendPath(payload.url)) return null;

  const { referrer } = payload;
  if (
    typeof referrer === "string" &&
    referrer.startsWith("/") &&
    !shouldSendPath(referrer)
  ) {
    return { ...payload, referrer: "" };
  }

  return payload;
};

/**
 * Custom events the storefront may send. Empty today — page views are
 * automatic — and a union rather than `string` so every event is named once,
 * here, and a typo is a type error rather than a new row in the dashboard.
 *
 * Add a member before calling `trackEvent()` with it, e.g.
 * `"add-to-cart" | "begin-checkout" | "newsletter-signup"`.
 */
export type AnalyticsEvent = never;

/** Event data: Umami keeps strings to 500 chars and at most 50 properties. */
export type AnalyticsEventData = Record<string, string | number | boolean>;

interface UmamiTracker {
  track: (event: string, data?: AnalyticsEventData) => Promise<unknown> | void;
}

declare global {
  interface Window {
    umami?: UmamiTracker;
    khemUmamiBeforeSend?: UmamiBeforeSend;
  }
}

/**
 * Send a custom event. A no-op when the tracker is not loaded — which is the
 * case without consent, without configuration, and on the server — so call
 * sites never need to check any of those themselves.
 *
 * Never pass personal data: no email, name, Clerk ID or order number.
 */
export function trackEvent(
  name: AnalyticsEvent,
  data?: AnalyticsEventData,
): void {
  if (typeof window === "undefined") return;

  try {
    void window.umami?.track(name, data);
  } catch {
    // Analytics must never break the page that called it.
  }
}
