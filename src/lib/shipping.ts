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
 * The visitor-country header (`src/lib/geo.ts`, set only by nginx), read in
 * `src/proxy.ts` and mapped by `resolveCurrencyForCountry()`. No second geolocation source, no new
 * dependency, and no client API: a browser prompt for location on a checkout
 * screen is both slower and more alarming than the header we already have.
 *
 * ## The header suggests; the chosen country decides
 *
 * Detection picks the country for the visitor, and where that is not Egypt the
 * checkout closes itself and says why. What it does **not** do is overrule
 * them: the field offers Egypt first, a short list of the countries a
 * misplaced visitor is likely to be placed in, and "Another country" for the
 * rest (`src/constants/countries.ts`). Choosing Egypt reopens the order.
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

import { FEATURED_COUNTRIES, OTHER_COUNTRY } from "@/src/constants/countries";
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
 * Nothing is a first-class answer: it means "no GeoIP answer for this request",
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

/** What a country field shows: Egypt on its own, then everywhere else. */
export interface CountryChoices {
  /** Egypt, in the house spelling for the locale. Always first, never sorted. */
  pinned: CountryOption;
  /**
   * The featured countries, sorted by name in the reader's language, then
   * "Another country" last when it was asked for. A `keep` value that is not
   * featured sits at the top, so a saved address never shows a blank field.
   */
  others: CountryOption[];
}

/**
 * The country field's options, named and ordered for the reader.
 *
 * Sorted with `Intl.Collator` rather than by code or by English name: an
 * Arabic reader scanning for الأردن should find it where Arabic order puts it,
 * not where "Jordan" would have fallen.
 *
 * - `otherLabel`: include "Another country" ({@link OTHER_COUNTRY}) with this
 *   label. The checkout passes it; the address book does not, because an
 *   address it cannot deliver to is of no use to anybody.
 * - `keep`: a value already held — a saved address in a country no longer
 *   featured, or legacy text typed before the field was a chooser. It is
 *   offered as it is, so editing that address does not quietly change its
 *   country.
 *
 * Called from Client Components only, so the names and the ordering come from
 * the browser's one ICU implementation and cannot disagree with a server
 * render.
 */
export function countryOptions(
  locale: Locale,
  { otherLabel, keep }: { otherLabel?: string; keep?: string } = {},
): CountryChoices {
  const collator = new Intl.Collator(locale);

  const others = FEATURED_COUNTRIES.map((code) => ({
    code,
    name: countryLabel(code, locale),
  })).sort((a, b) => collator.compare(a.name, b.name));

  const held = keep?.trim() ?? "";
  if (
    held !== "" &&
    held !== SHIPPING_COUNTRY &&
    held !== OTHER_COUNTRY &&
    !FEATURED_COUNTRIES.includes(held)
  ) {
    // A two-letter value is a code and gets a name; anything else predates
    // the chooser and is shown exactly as it was written.
    others.unshift({
      code: held,
      name: /^[A-Z]{2}$/.test(held) ? countryLabel(held, locale) : held,
    });
  }

  if (otherLabel !== undefined) {
    others.push({ code: OTHER_COUNTRY, name: otherLabel });
  }

  return {
    pinned: { code: SHIPPING_COUNTRY, name: SHIPPING_COUNTRY_NAME[locale] },
    others,
  };
}

/**
 * Where the checkout's country field starts, from the detected country.
 *
 * - **Egypt or a featured country**: that country, reported as detected, so
 *   the field says where the choice came from.
 * - **Any other well-formed country** (Brazil, Kosovo's `XK`): "Another
 *   country", also reported as detected. It is true that we placed them
 *   outside Egypt, and the checkout says so and offers the way back. Nothing
 *   pretends they are in Egypt.
 * - **No answer**: no header, or a code that names no country — `T1` from a
 *   Tor exit, `XX` from traffic the edge could not place. Egypt, *not*
 *   reported as detected. Unknown means unknown, never elsewhere: the checkout
 *   is open and the dropdown is right there if that is wrong.
 *
 * Every value returned is one the field has an option for, so a native
 * `<select>` never shows an empty box.
 */
export function selectableCountry(code: string | null): {
  code: string;
  detected: boolean;
} {
  if (code === null || !isRealCountry(code)) {
    return { code: SHIPPING_COUNTRY, detected: false };
  }

  if (code === SHIPPING_COUNTRY || FEATURED_COUNTRIES.includes(code)) {
    return { code, detected: true };
  }

  return { code: OTHER_COUNTRY, detected: true };
}

/**
 * Whether a well-formed code names a country.
 *
 * Asked of `Intl.DisplayNames` with `fallback: "none"`, which answers
 * `undefined` (or throws) for a code it cannot name: the user-assigned ranges
 * GeoIP databases use for "not a country" (`XX`, `AP`, `A1`). `XK` is named by
 * every current ICU, so a visitor from Kosovo is treated as detected. Should a
 * runtime decline the API, the code counts as unknown, which fails towards an
 * open checkout.
 *
 * ICU *does* name a few codes that are not countries — `ZZ` is literally
 * "Unknown Region" — so those are refused by name first.
 */
const NOT_COUNTRIES = new Set(["ZZ", "EU", "EZ", "UN", "QO"]);

function isRealCountry(code: string): boolean {
  if (NOT_COUNTRIES.has(code)) return false;

  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region", fallback: "none" }).of(
        code,
      ) !== undefined
    );
  } catch {
    return false;
  }
}
