/**
 * Display currency — the table, the conversion, and the detection map.
 *
 * ## What this is not
 *
 * KHEM has exactly one price per product, stored in USD cents
 * (`src/data/products.ts`, AGENTS.md §9), and exactly one settlement currency.
 * Nothing here creates a second price. A non-USD figure on the site is a
 * *converted display* of the same USD amount, which is why the settlement note
 * beside it says so, and why the checkout Server Action — when it lands — must
 * price the order from `priceInCents` and never from what the visitor was
 * shown.
 *
 * ## Why a static table rather than a rate feed
 *
 * A feed brings a key, a cache, a failure path, and the possibility of the
 * server and the client disagreeing about a price mid-render. A checked-in
 * table has none of that and is exactly as accurate as this feature needs to
 * be: the figures are rounded to a coarse unit before they are shown, so a few
 * points of drift never reaches the screen. AED and SAR are pegged to the
 * dollar and effectively permanent; the three floating rates carry
 * {@link RATES_REVIEWED} and are indicative.
 *
 * ## Imports nothing from React or Next
 *
 * Same constraint `src/lib/i18n/config.ts` documents, for the same reason: this
 * module is read in the proxy (Node runtime), in Server Components, and in
 * Client Components alike.
 */

export const CURRENCIES = ["USD", "EGP", "EUR", "GBP", "AED", "SAR"] as const;

export type Currency = (typeof CURRENCIES)[number];

/** The stored currency, the settlement currency, and the fallback. */
export const BASE_CURRENCY: Currency = "USD";

/**
 * When the floating rates below were last checked. Bump it when you edit them.
 *
 * This is a maintenance marker, not a runtime value — nothing reads it. Its job
 * is to make a stale table visible in a diff.
 */
export const RATES_REVIEWED = "2026-08-14";

interface CurrencyConfig {
  /**
   * Units of this currency per 1 USD.
   *
   * AED and SAR are central-bank pegs (3.6725 and 3.75) and do not move. EGP,
   * EUR, and GBP float — they are indicative, and the rounding below is coarse
   * enough that ordinary drift never changes the displayed figure.
   */
  rate: number;
  /**
   * The unit a converted amount snaps to, in this currency's *minor* units.
   *
   * A luxury price is a considered number. `EGP 14,307.50` is an exchange-rate
   * artefact; `EGP 14,300` is a price. 500 minor units is "nearest 5", 5000 is
   * "nearest 50".
   */
  roundToMinor: number;
  /**
   * Decimals to print. `"auto"` drops them for whole amounts and keeps them
   * otherwise — the existing USD treatment (29500 → "$295", 29550 → "$295.50").
   * Converted currencies always land on a whole unit, so they print none.
   */
  fractionDigits: 0 | 2 | "auto";
}

export const CURRENCY_CONFIG: Record<Currency, CurrencyConfig> = {
  USD: { rate: 1, roundToMinor: 1, fractionDigits: "auto" },
  EGP: { rate: 48.5, roundToMinor: 5000, fractionDigits: 0 },
  EUR: { rate: 0.92, roundToMinor: 500, fractionDigits: 0 },
  GBP: { rate: 0.78, roundToMinor: 500, fractionDigits: 0 },
  AED: { rate: 3.6725, roundToMinor: 500, fractionDigits: 0 },
  SAR: { rate: 3.75, roundToMinor: 500, fractionDigits: 0 },
};

/**
 * Country → currency, for the six markets KHEM prices in.
 *
 * Everything absent from this map resolves to USD. That is the *default*, not
 * an error: a visitor in a country KHEM does not price in is shown the currency
 * their card will actually be charged in.
 */
const COUNTRY_CURRENCY: Record<string, Currency> = {
  EG: "EGP",
  GB: "GBP",
  AE: "AED",
  SA: "SAR",

  // The eurozone. Non-euro EU members (PL, SE, CZ, DK, HU, RO, BG) are
  // deliberately absent — they fall through to USD rather than being shown a
  // currency they do not spend.
  AT: "EUR",
  BE: "EUR",
  HR: "EUR",
  CY: "EUR",
  EE: "EUR",
  FI: "EUR",
  FR: "EUR",
  DE: "EUR",
  GR: "EUR",
  IE: "EUR",
  IT: "EUR",
  LV: "EUR",
  LT: "EUR",
  LU: "EUR",
  MT: "EUR",
  NL: "EUR",
  PT: "EUR",
  SK: "EUR",
  SI: "EUR",
  ES: "EUR",
};

/** The cookie the proxy writes and the client reads. `khem.*.v1` per `storage.ts`. */
export const CURRENCY_COOKIE = "khem.currency.v1";

/** One year — the ceiling the published cookie policy states. */
export const CURRENCY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isCurrency(value: unknown): value is Currency {
  return (
    typeof value === "string" && (CURRENCIES as readonly string[]).includes(value)
  );
}

/**
 * Resolve a currency from an ISO-3166 alpha-2 country code.
 *
 * The code is untrusted input — it arrives as a request header the proxy cannot
 * vouch for — so it is only ever used as a **key into the fixed map above**. It
 * is never interpolated, never used to build a URL, and anything unrecognised
 * (including `null`, an empty string, or a crafted value) resolves to the base
 * currency rather than throwing.
 */
export function resolveCurrencyForCountry(
  country: string | null | undefined,
): Currency {
  if (typeof country !== "string") return BASE_CURRENCY;

  const code = country.trim().toUpperCase();
  if (code.length !== 2) return BASE_CURRENCY;

  return COUNTRY_CURRENCY[code] ?? BASE_CURRENCY;
}

/**
 * Convert a USD amount in cents to the target currency's minor units.
 *
 * Rounding is applied *after* conversion, to {@link CurrencyConfig.roundToMinor}.
 * Two edge cases the naive version gets wrong:
 *
 * - **Zero must stay zero.** Free shipping is a real `0` and has to convert to
 *   `0`, not to one rounding unit.
 * - **A small non-zero amount must not round away to nothing.** With a 5000
 *   rounding unit, anything under EGP 25 would otherwise vanish into "free".
 *   The result is clamped to a single rounding unit instead, preserving the
 *   sign of the input.
 */
export function convertFromUsdCents(
  priceInCents: number,
  currency: Currency,
): number {
  if (!Number.isFinite(priceInCents)) return 0;

  const { rate, roundToMinor } = CURRENCY_CONFIG[currency];

  const converted = priceInCents * rate;
  const rounded = Math.round(converted / roundToMinor) * roundToMinor;

  if (rounded === 0 && priceInCents !== 0) {
    return priceInCents > 0 ? roundToMinor : -roundToMinor;
  }

  return rounded;
}
