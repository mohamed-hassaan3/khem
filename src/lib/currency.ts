/**
 * Display currency — the table, the conversion, and the detection map.
 *
 * ## What this is not
 *
 * KHEM has exactly one price per product, stored in Egyptian piastres
 * (`src/data/products.ts`), and exactly one settlement currency. Nothing here
 * creates a second price. A non-EGP figure on the site is a *converted display*
 * of the same EGP amount, which is why the settlement note beside it says so,
 * and why the checkout Server Action — when it lands — must price the order
 * from `priceInCents` and never from what the visitor was shown.
 *
 * ## Two defaults, deliberately different
 *
 * {@link BASE_CURRENCY} is EGP: what prices are stored and settled in, and what
 * the prerendered HTML says. {@link FALLBACK_DISPLAY_CURRENCY} is USD: what a
 * visitor from a country this file does not price in is *shown*. Collapsing the
 * two would mean answering a shopper in Tokyo with piastres because the house
 * is Egyptian, which helps nobody.
 *
 * The home market gets the best case for free: Egypt resolves to EGP, the
 * server already rendered EGP, and there is no post-hydration swap at all.
 *
 * ## Why a static table rather than a rate feed
 *
 * A feed brings a key, a cache, a failure path, and the possibility of the
 * server and the client disagreeing about a price mid-render. A checked-in
 * table has none of that and is exactly as accurate as this feature needs to
 * be. AED and SAR are pegged to the dollar, so their rates move only with the
 * pound; every rate here carries {@link RATES_REVIEWED} and is indicative.
 *
 * ## Imports nothing from React or Next
 *
 * Same constraint `src/lib/i18n/config.ts` documents, for the same reason: this
 * module is read in the proxy (Node runtime), in Server Components, and in
 * Client Components alike.
 */

export const CURRENCIES = ["USD", "EGP", "EUR", "GBP", "AED", "SAR"] as const;

export type Currency = (typeof CURRENCIES)[number];

/** The stored currency, the settlement currency, and what the server renders. */
export const BASE_CURRENCY: Currency = "EGP";

/**
 * What a visitor from an unpriced country is shown.
 *
 * Distinct from {@link BASE_CURRENCY} on purpose — see the module header.
 */
export const FALLBACK_DISPLAY_CURRENCY: Currency = "USD";

/**
 * When the rates below were last checked. Bump it when you edit them.
 *
 * This is a maintenance marker, not a runtime value — nothing reads it. Its job
 * is to make a stale table visible in a diff.
 */
export const RATES_REVIEWED = "2026-08-15";

interface CurrencyConfig {
  /**
   * Units of this currency per 1 EGP.
   *
   * All five converted rates are indicative. AED and SAR are pegged to the
   * dollar rather than to the pound, so they move only as the pound moves
   * against it — they are not fixed here the way they would be in a
   * dollar-based table.
   */
  rate: number;
  /**
   * The unit a converted amount snaps to, in this currency's *minor* units.
   *
   * EGP snaps to nothing: it is the stored figure and must display exactly what
   * the catalog says. The converted currencies snap to the nearest half unit —
   * coarse enough to read as a price rather than an exchange-rate artefact
   * ($30.50, not $30.31), fine enough to stay honest at these amounts, where a
   * 5-unit step would be a 16% error on an 840 EGP bottle.
   */
  roundToMinor: number;
  /**
   * Decimals to print. `"auto"` drops them for whole amounts and keeps them
   * otherwise — the EGP treatment (147000 → "EGP 1,470"). The converted
   * currencies land on a half unit, so they always print two.
   */
  fractionDigits: 0 | 2 | "auto";
}

export const CURRENCY_CONFIG: Record<Currency, CurrencyConfig> = {
  EGP: { rate: 1, roundToMinor: 1, fractionDigits: "auto" },
  USD: { rate: 0.02062, roundToMinor: 50, fractionDigits: 2 },
  EUR: { rate: 0.01897, roundToMinor: 50, fractionDigits: 2 },
  GBP: { rate: 0.01608, roundToMinor: 50, fractionDigits: 2 },
  AED: { rate: 0.07572, roundToMinor: 50, fractionDigits: 2 },
  SAR: { rate: 0.07732, roundToMinor: 50, fractionDigits: 2 },
};

/**
 * Country → currency, for the six markets KHEM prices in.
 *
 * Everything absent from this map resolves to {@link FALLBACK_DISPLAY_CURRENCY}.
 * That is the *default*, not an error: a visitor in a country KHEM does not
 * price in is shown dollars, the currency any international shopper can read a
 * price in, rather than the piastres the order is settled in.
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
 * (including `null`, an empty string, or a crafted value) resolves to the
 * fallback display currency rather than throwing.
 */
export function resolveCurrencyForCountry(
  country: string | null | undefined,
): Currency {
  if (typeof country !== "string") return FALLBACK_DISPLAY_CURRENCY;

  const code = country.trim().toUpperCase();
  if (code.length !== 2) return FALLBACK_DISPLAY_CURRENCY;

  return COUNTRY_CURRENCY[code] ?? FALLBACK_DISPLAY_CURRENCY;
}

/**
 * Convert an EGP amount in piastres to the target currency's minor units.
 *
 * Rounding is applied *after* conversion, to {@link CurrencyConfig.roundToMinor}.
 * Two edge cases the naive version gets wrong:
 *
 * - **Zero must stay zero.** Free shipping is a real `0` and has to convert to
 *   `0`, not to one rounding unit.
 * - **A small non-zero amount must not round away to nothing.** With a 50
 *   rounding unit, anything under a quarter of a dollar would otherwise vanish
 *   into "free". The result is clamped to a single rounding unit instead,
 *   preserving the sign of the input.
 */
export function convertFromBaseMinorUnits(
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
