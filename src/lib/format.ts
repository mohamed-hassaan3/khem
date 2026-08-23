/**
 * Presentation formatters.
 *
 * Money is stored in the smallest currency unit (AGENTS.md §9) and dates are
 * stored as ISO-8601 strings; both are converted to display strings here and
 * nowhere else, so a currency or locale change is a one-file edit.
 *
 * Money now has two currencies, and the distinction matters: it is *stored* in
 * Egyptian piastres and *displayed* in whichever of `src/lib/currency.ts`'s six
 * the visitor resolved to. Only this file crosses between them. Everything
 * upstream — the catalog, the cart maths, the order totals — stays in piastres,
 * so a display currency can never become a pricing input.
 */

import {
  BASE_CURRENCY,
  CURRENCY_CONFIG,
  convertFromBaseMinorUnits,
  type Currency,
} from "@/src/lib/currency";
import type { Locale } from "@/src/lib/i18n/config";
import type { Concentration, Product } from "@/src/types/catalog";

const LOCALE = "en-US";

/**
 * Formats a price held in Egyptian piastres, in the visitor's display currency.
 *
 * Whole EGP amounts drop the decimals (147000 → "EGP 1,470") to match the
 * editorial price treatment; non-whole amounts keep them. Converted currencies
 * are rounded to the nearest half unit before they arrive here, so they always
 * print two decimals ("$30.50").
 *
 * Number formatting stays `en-US` on both locale trees. Prices describe
 * English-only catalog records — the same reasoning that keeps
 * `formatArticleDate` locale-free — so the Arabic tree changes the currency
 * symbol without switching to Arabic-Indic digits mid-page.
 *
 * The `currency` parameter defaults to the base so a Server Component rendering
 * before hydration, and any call site not yet reached by the currency provider,
 * both produce the stored price rather than a wrong one.
 */
export function formatPrice(
  priceInCents: number,
  currency: Currency = BASE_CURRENCY,
): string {
  const amountInMinorUnits = convertFromBaseMinorUnits(priceInCents, currency);
  const { fractionDigits } = CURRENCY_CONFIG[currency];

  const digits =
    fractionDigits === "auto"
      ? amountInMinorUnits % 100 !== 0
        ? 2
        : 0
      : fractionDigits;

  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amountInMinorUnits / 100);
}

/**
 * Formats an ISO-8601 date as "December 2024".
 *
 * `timeZone: "UTC"` is required: without it a date-only string is parsed as UTC
 * midnight and then rendered in the local zone, which shifts the month backwards
 * for anyone west of Greenwich.
 */
export function formatArticleDate(isoDate: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}

/**
 * Formats an ISO-8601 date as "August 9, 2026", for legal revision dates.
 *
 * Distinct from `formatArticleDate` because a policy needs the exact day, not
 * just the month. `timeZone: "UTC"` for the same reason it is set there: a
 * date-only string parsed as UTC midnight would otherwise render as the
 * previous day for anyone west of Greenwich — and would differ between the
 * server render and the client hydration.
 */
export function formatLegalDate(isoDate: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}

/**
 * Formats the moment a consent decision was recorded, e.g. "14 August 2026".
 *
 * The only formatter here that takes a locale, and deliberately so: prices and
 * catalog dates describe English-only records (see `src/lib/i18n/rtl.ts`),
 * whereas this date sits inside fully translated chrome and would look wrong in
 * Latin numerals on an Arabic page.
 *
 * No `timeZone` override, unlike the ISO-date formatters above: this is a real
 * epoch timestamp rendered client-side only — the banner never appears before
 * hydration — so the visitor's own zone is both correct and safe.
 */
export function formatConsentDate(epochMs: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(epochMs));
}

/**
 * Formats the moment a product comment was posted, e.g. "16 August 2026".
 *
 * Locale-aware for the same reason `formatConsentDate` is: a comment sits
 * inside fully translated chrome, unlike the English-only catalog records.
 *
 * `timeZone: "UTC"` is not about date-only strings here — these are real
 * `timestamptz` values — but about agreement. The stored thread is rendered on
 * the server and a freshly posted comment on the client; pinning the zone is
 * what stops the same comment showing two different days across that seam.
 */
export function formatCommentDate(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}

/** Volume label for a product, e.g. 100 → "100 ML". */
export function formatVolume(volumeMl: number): string {
  return `${volumeMl} ML`;
}

/**
 * The format token printed beside a product's price.
 *
 * A fragrance states its concentration, in *translated* dictionary copy. Body
 * care, home fragrance, and discovery sets have no concentration, so they carry
 * a stored `format` string ("Room Spray", "6 × 3 ML Vials") instead — English
 * in both trees, like every other catalog record.
 *
 * One function so the two never drift apart across the card, the cart line, and
 * the buy block.
 */
export function formatProductType(
  product: Pick<Product, "concentration" | "format">,
  concentrationLabels: Record<Concentration, string>,
): string {
  if (product.format !== null) return product.format;
  if (product.concentration !== null) {
    return concentrationLabels[product.concentration];
  }
  return "";
}

/**
 * A star average, to one decimal — "4.3", and "٤٫٣" on the Arabic tree.
 *
 * Locale-aware, unlike {@link formatPrice}: a rating is not a catalog record
 * written in English, it is a number the page is speaking, and it sits in the
 * same paragraph as {@link formatCommentDate}, which already switches digits.
 */
export function formatRating(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** A plain count in the visitor's digits — how many ratings, which photograph. */
export function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : LOCALE).format(value);
}
