/**
 * Presentation formatters.
 *
 * Money is stored in the smallest currency unit (AGENTS.md §9) and dates are
 * stored as ISO-8601 strings; both are converted to display strings here and
 * nowhere else, so a currency or locale change is a one-file edit.
 */

const CURRENCY = "USD";
const LOCALE = "en-US";

/**
 * Formats a price held in cents.
 *
 * Whole amounts drop the decimals (29500 → "$295") to match the editorial
 * price treatment; non-whole amounts keep them (29550 → "$295.50").
 */
export function formatPrice(priceInCents: number): string {
  const hasFraction = priceInCents % 100 !== 0;

  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(priceInCents / 100);
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

/** Volume label for a product, e.g. 100 → "100 ML". */
export function formatVolume(volumeMl: number): string {
  return `${volumeMl} ML`;
}
