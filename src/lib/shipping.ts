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
 * ## The header suggests; the chosen country decides
 *
 * Detection picks the country for the visitor, and where that is not Egypt the
 * checkout closes itself and says why. What it does **not** do is overrule
 * them: the field is a dropdown of every country, and choosing Egypt reopens
 * the order.
 *
 * That is deliberate, and it is the only workable reading of a header that is
 * routinely wrong about people who are standing in Cairo — a VPN, a corporate
 * proxy, a mobile carrier homed abroad, an IP block reassigned last month. A
 * gate that a misplaced customer cannot talk their way past is a gate that
 * loses real orders to protect against a fictional one; the parcel is going to
 * whatever address is typed below regardless, and *that* is what fulfilment
 * reads.
 *
 * So the authority is {@link isEgypt} over the submitted country, enforced by
 * `checkoutSchema` on the server where a form cannot reach it. The header only
 * decides what the field starts as.
 */

import { COUNTRY_CODES } from "@/src/constants/countries";
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

/**
 * The country as it should be written down — the value that reaches
 * `"Order"."shipCountry"` and the picking slip.
 *
 * Egypt gets the house spelling for the locale rather than the CLDR one, so an
 * Arabic order records "مصر" and an English one "Egypt". Everywhere else is
 * whatever `Intl` calls it in that language, which is more than good enough for
 * a country the house does not ship to.
 */
export function countryLabel(code: string, locale: Locale): string {
  return code === SHIPPING_COUNTRY
    ? SHIPPING_COUNTRY_NAME[locale]
    : countryName(code, locale);
}

export interface CountryOption {
  code: string;
  name: string;
}

/**
 * Every country, named in the reader's language, in that language's order.
 *
 * Sorted with `Intl.Collator` rather than by code or by English name: an
 * Arabic-speaking visitor scanning for مصر should find it where Arabic
 * alphabetical order puts it, not where "Egypt" would have fallen.
 *
 * Called from a Client Component, and only ever in the browser — the checkout
 * form does not render until the cart has hydrated — so both the names and the
 * ordering come from one ICU implementation and cannot disagree with a server
 * render.
 */
export function countryOptions(locale: Locale): CountryOption[] {
  const collator = new Intl.Collator(locale);

  return COUNTRY_CODES.map((code) => ({
    code,
    name: countryLabel(code, locale),
  })).sort((a, b) => collator.compare(a.name, b.name));
}

/**
 * The detected country, but only if the dropdown actually holds it.
 *
 * Vercel's header is not always an ISO country: Tor exits arrive as `T1`, and
 * unresolvable traffic as `XX`. Selecting a value no `<option>` carries leaves
 * a native `<select>` showing an empty box — the one state the field must never
 * be in, since it is pre-answered by design.
 *
 * An unknown code therefore falls back to {@link SHIPPING_COUNTRY} and is
 * reported as *not detected*, so the field neither claims to know where the
 * visitor is nor blocks them: Egypt is selected, the checkout is open, and the
 * dropdown is right there if that is wrong.
 */
export function selectableCountry(code: string | null): {
  code: string;
  detected: boolean;
} {
  if (code !== null && COUNTRY_CODES.includes(code)) {
    return { code, detected: true };
  }

  return { code: SHIPPING_COUNTRY, detected: false };
}
