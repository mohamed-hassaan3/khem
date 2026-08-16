/**
 * Query normalization and the document builder both halves of the engine share.
 *
 * Nothing here reaches the network or the catalog — it is pure string work, so
 * the offline embedding script, the route handler, and the Server Components can
 * all import it.
 */

import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, SEARCH_PARAM } from "./config";

/**
 * Case- and diacritic-insensitive comparison form.
 *
 * Applied to *both* sides of every comparison — "Ambré" must be found by
 * "ambre", which is what anyone without a French keyboard will type. Arabic
 * harakat fold away by the same rule, though the catalog itself is English (see
 * the note on `productEmbeddingSource`).
 */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Trim, collapse internal whitespace, and cap the length.
 *
 * The cap is a security boundary, not a nicety: this string is sent to a
 * third-party embedding provider, and an uncapped one turns the search endpoint
 * into a free embedding API.
 */
export function normalizeQuery(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

/** True once a query is an intent rather than a keystroke. */
export function isSearchable(query: string): boolean {
  return query.length >= MIN_QUERY_LENGTH;
}

/** The folded, non-empty terms of a query. */
export function queryTerms(query: string): string[] {
  return fold(query).split(" ").filter(Boolean);
}

/**
 * A linkable search, as a locale-agnostic app path — `<LocaleLink>` and
 * `localizePath()` add the prefix.
 */
export function searchHref(query: string): string {
  return `/search?${SEARCH_PARAM}=${encodeURIComponent(normalizeQuery(query))}`;
}
