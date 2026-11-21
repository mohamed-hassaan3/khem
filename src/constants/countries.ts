/**
 * The countries the country field names, besides Egypt.
 *
 * ## Why a short list
 *
 * KHEM delivers within Egypt and nowhere else (`SHIPPING_COUNTRY` in
 * `src/lib/shipping.ts`). The field is not there to choose a destination. It is
 * there so that somebody the edge has placed in the wrong country — a VPN, a
 * corporate proxy, a carrier homed abroad — can see where we think they are
 * and switch back to Egypt. That needs the countries such a visitor is likely
 * to be placed in, not all two hundred and fifty: a boutique's list rather
 * than a form library's. Everywhere else is "Another country"
 * ({@link OTHER_COUNTRY}).
 *
 * Chosen for who is likely to be behind the request:
 *
 * - **Gulf** (AE, SA, KW, QA, BH, OM): the largest Egyptian diaspora and the
 *   region's strongest luxury-fragrance market.
 * - **Levant and Maghreb** (JO, LB, MA): Arabic-speaking neighbours with a
 *   perfumery culture of their own.
 * - **Europe** (GB, FR, DE, IT, NL, CH, ES): the fragrance capitals, and the
 *   usual VPN exits (NL, DE, GB).
 * - **North America** (US, CA): diaspora, and the most common VPN exit.
 * - **TR**: a common carrier and VPN route, and a regional luxury market.
 *
 * Codes only, never names. `Intl.DisplayNames` names them in the reader's
 * language, so Arabic costs nothing here. The order below does not matter
 * either: the field sorts by name in the reader's language.
 *
 * This list is the house's to edit. Adding a country is one line; removing one
 * leaves saved addresses in it valid (`src/schemas/address.ts` checks the
 * shape of a code, not membership here), and the address book still shows
 * them by name.
 */
export const FEATURED_COUNTRIES: readonly string[] = [
  "AE", "SA", "KW", "QA", "BH", "OM",
  "JO", "LB", "MA",
  "GB", "FR", "DE", "IT", "NL", "CH", "ES",
  "US", "CA",
  "TR",
];

/**
 * "Another country": the checkout's answer for a detected country not on the
 * list above.
 *
 * A sentinel, not a country. It is not an ISO code (too long to be one), so it
 * can never collide with a real one. It never reaches a database: the checkout
 * cannot be submitted with anything but Egypt, and the address-book schema
 * refuses it by name.
 */
export const OTHER_COUNTRY = "OTHER";
