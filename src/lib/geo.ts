/**
 * Where a request came from, as far as the server is told.
 *
 * KHEM runs behind nginx on the VPS (`deploy/nginx/khemperfumes.conf`), and
 * nginx is the **only** thing allowed to set this header: it overwrites
 * whatever a client sent with its own value — a GeoIP2 country code when the
 * MaxMind database is installed, an empty string when it is not. A client can
 * therefore never choose the value that reaches this file.
 *
 * The country is a *suggestion* everywhere it is used: it picks the first
 * display currency (`src/proxy.ts`) and the checkout's starting country
 * (`src/app/[locale]/checkout/page.tsx`). It never authorises anything —
 * `checkoutSchema` judges the submitted country, not this one.
 *
 * `null` means *unknown*, never *elsewhere*. With no GeoIP database installed
 * it is always `null`, and the client falls back to the device timezone
 * (`detectCurrencyFromBrowser()` in `src/providers/currency-provider.tsx`).
 *
 * Replaced `x-vercel-ip-country` when the site moved off Vercel.
 */

import { detectedCountryCode } from "@/src/lib/shipping";

/** Set by nginx from GeoIP2; never trusted from the client. */
export const VISITOR_COUNTRY_HEADER = "x-khem-country";

/** ISO-3166 alpha-2 upper-case, or `null` when absent, empty or malformed. */
export function visitorCountry(headers: Pick<Headers, "get">): string | null {
  return detectedCountryCode(headers.get(VISITOR_COUNTRY_HEADER));
}
