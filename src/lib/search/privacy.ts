/**
 * What search tracking refuses to record.
 *
 * Pure functions, no imports — the search page calls them, and the unit check
 * in `scripts/search-privacy.test.ts` runs them under plain Node.
 *
 * Tracking (`src/services/search-log.ts`) stores no identity at all, but the
 * query itself is visitor-typed text: a shopper who pastes an email address or
 * a phone number into the search box has put personal data into it. Such
 * queries are not stored — the search still runs, it just is not counted.
 */

/** Something shaped like an email address anywhere in the query. */
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/u;

/**
 * Seven or more digits in a row, once spaces, dashes, dots and parentheses are
 * ignored — phone numbers (Egyptian mobiles are 11 digits), card and national
 * ID numbers, and order numbers (`KHEM-2026-8921` compacts to 8 digits — it
 * points at one customer's order). Arabic-Indic and Eastern Arabic-Indic digits count too: `\p{Nd}`
 * is any decimal digit. Short numbers ("100 ml", "1001 nights") stay.
 */
const LONG_NUMBER = /\p{Nd}{7,}/u;

export function looksPersonal(query: string): boolean {
  if (EMAIL.test(query)) return true;
  const compact = query.replace(/[\s\-.()+]/g, "");
  return LONG_NUMBER.test(compact);
}

/**
 * Crawlers, link previews, uptime monitors and scripted clients. Checked in
 * memory only; the user agent is never stored.
 */
const AUTOMATED =
  /bot|crawl|spider|slurp|preview|headless|monitor|curl|wget|python|http-client|httpclient|axios|node-fetch|go-http|java\//i;

export function isAutomatedAgent(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return AUTOMATED.test(userAgent);
}
