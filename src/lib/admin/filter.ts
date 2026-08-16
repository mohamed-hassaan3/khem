/**
 * Searching the dashboard's lists.
 *
 * ## Why the filtering happens in memory rather than in the query
 *
 * The tempting version is `.or("name.ilike.*q*,slug.ilike.*q*")` in the service.
 * It is also the version with a hole in it: PostgREST's `or` takes a
 * *comma-separated filter expression as a string*, so a search term containing
 * a comma, a parenthesis, or a dot is not escaped — it is parsed, and the
 * visitor's keystrokes become filter syntax. There is no parameter binding to
 * reach for, and hand-rolling an escaper for someone else's grammar is how
 * injection bugs get written.
 *
 * The lists here are already fetched whole (the dashboard is `force-dynamic`
 * and renders every row), so filtering them in TypeScript costs one pass over
 * an array that is already in hand, and the term never touches a query at all.
 *
 * This is a deliberate trade with a known ceiling: at some thousands of
 * products, loading every row to filter a few stops being sensible, and the
 * answer then is a `text_search` RPC — a real function with real parameters —
 * rather than string-built filters.
 */

/** Normalise for comparison: case and surrounding space are not the search. */
function fold(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Read `?q=` from a Next `searchParams` bag.
 *
 * A repeated parameter (`?q=a&q=b`) arrives as an array; the first wins rather
 * than the pair being joined into a term nobody typed.
 */
export function searchTerm(
  params: Record<string, string | string[] | undefined>,
): string {
  const raw = params.q;
  const value = Array.isArray(raw) ? raw[0] : raw;
  // Capped so a pathological term cannot turn every row comparison into a long
  // string scan. Nothing legitimate is this long.
  return typeof value === "string" ? value.slice(0, 120) : "";
}

/**
 * Does a row match the term?
 *
 * Substring, across every field the caller considers searchable — an editor
 * looking for a product types part of its name, its slug, or its SKU, and
 * should not have to know which of those the box searches. An empty term
 * matches everything, so a list with no query is the full list.
 */
export function matchesTerm(term: string, fields: readonly (string | null)[]): boolean {
  const needle = fold(term);
  if (needle.length === 0) return true;

  return fields.some(
    (field) => typeof field === "string" && fold(field).includes(needle),
  );
}
