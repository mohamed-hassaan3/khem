/**
 * Every country the checkout will let somebody name.
 *
 * ISO-3166-1 alpha-2, current assignments only. Deliberately a **static list of
 * codes and not of names**: the names are produced by `Intl.DisplayNames` in
 * `src/lib/shipping.ts`, so the dropdown speaks Arabic on `/ar/checkout`
 * without a second translation file to keep in step, and adding a locale later
 * costs nothing here.
 *
 * ## Why the codes are written down rather than enumerated
 *
 * There is no `Intl.supportedValuesOf("region")`, and deriving the list by
 * walking AA–ZZ through `Intl.DisplayNames` would make it depend on whichever
 * ICU version is doing the walking — a different list in Node than in Safari.
 * A checkout whose country dropdown changes shape with the browser is not a
 * checkout anybody can support.
 *
 * Withdrawn and exceptional reservations are excluded on purpose — `SU`, `YU`,
 * `AN` and the rest name states that no longer exist, `EU`/`UN`/`QO` are not
 * countries, and `UK` is not the ISO code for the United Kingdom (`GB` is).
 * `XK` is kept: Kosovo has no ISO assignment, but it is what Vercel's
 * geolocation returns for that traffic, and a code the edge can send must be a
 * code the form can show.
 *
 * The house delivers to exactly one of these — see `SHIPPING_COUNTRY` in
 * `src/lib/shipping.ts`. The rest are here so that somebody the edge has placed
 * in the wrong country can say where they actually are.
 */
export const COUNTRY_CODES: readonly string[] = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT",
  "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI",
  "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY",
  "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM",
  "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK",
  "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL",
  "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR",
  "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN",
  "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS",
  "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW",
  "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP",
  "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM",
  "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM",
  "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF",
  "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW",
  "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "XK", "YE", "YT", "ZA", "ZM", "ZW",
];

