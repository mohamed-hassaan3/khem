/**
 * Where KHEM delivers, and how the checkout learns where somebody is.
 *
 * The house ships within Egypt. That has always been true of the fulfilment
 * side — the delivery fee in `src/lib/cart.ts` is quoted in Egyptian pounds for
 * Egyptian addresses, and the emails promise Cairo in two working days — but
 * until now the country field was free text, so an order to Lyon was accepted
 * and then discovered by a person reading a picking slip.
 *
 * ## Detection is the same contract the currency already uses
 *
 * `x-vercel-ip-country`, read in `src/proxy.ts` and mapped by
 * `resolveCurrencyForCountry()`. No second geolocation source, no new
 * dependency, and no client API: a browser prompt for location on a checkout
 * screen is both slower and more alarming than the header we already have.
 *
 * ## The header decides refusals, never approvals on its own
 *
 * Off Vercel — a self-hosted preview, a proxy in front, `curl` — the header is
 * whatever the sender says it is. So it is used two ways only:
 *
 *  - **Present and not `EG`** → refuse. Spoofing this to *deny yourself*
 *    checkout is not an attack.
 *  - **Absent** → do not refuse, and let {@link isEgypt} judge the typed value.
 *    A missing header is the normal state of `npm run dev`, and a checkout that
 *    refuses every local order would be a checkout nobody could test.
 *
 * Both halves run again on the server in `src/actions/checkout.ts`. What the
 * form does with them is a courtesy.
 */

import type { Locale } from "@/src/lib/i18n/config";

/** ISO-3166 alpha-2 for the one country the house delivers to. */
export const SHIPPING_COUNTRY = "EG";

/**
 * What a shopper in Egypt would otherwise have to type every time, per locale.
 *
 * Stored rather than derived so the value written to `"Order"."shipCountry"` is
 * stable and legible on a picking slip, whichever language the order was placed
 * in.
 */
export const SHIPPING_COUNTRY_NAME: Record<Locale, string> = {
  en: "Egypt",
  ar: "مصر",
};

/**
 * Every spelling of Egypt an honest form can produce.
 *
 * Deliberately small. This is not a country parser — it is the guard on one
 * field whose value the form itself supplies in all but the no-header case, and
 * a generous fuzzy match would be a way to smuggle "Egyptian Community, Berlin"
 * past it.
 */
const EGYPT_NAMES = new Set([
  "eg",
  "egy",
  "egypt",
  "arab republic of egypt",
  "مصر",
  "جمهورية مصر العربية",
]);

/** True when a typed country names Egypt. Case and padding are forgiven. */
export function isEgypt(value: string): boolean {
  return EGYPT_NAMES.has(value.trim().toLowerCase());
}

/**
 * Normalise the geolocation header into an alpha-2 code, or nothing.
 *
 * Nothing is a first-class answer: it means "not running behind Vercel's edge",
 * and every caller must treat it as *unknown*, never as *elsewhere*.
 */
export function detectedCountryCode(header: string | null): string | null {
  if (typeof header !== "string") return null;

  const code = header.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/**
 * A country code as a person reads it — "FR" → "France", "فرنسا" in Arabic.
 *
 * `Intl.DisplayNames` rather than a table: shipping to one country does not
 * mean we can *name* only one, and the visitor being turned away deserves to
 * see where we think they are in their own language. Falls back to the code
 * itself on the runtimes and inputs where the API declines to answer.
 */
export function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
