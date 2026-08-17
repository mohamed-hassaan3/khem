/**
 * Catalog search — the hybrid query layer.
 *
 * Like `src/services/products.ts`, this is the seam between the UI and the data
 * store: the route handler and the results page call these functions and know
 * nothing about how a match is found. That is now a single
 * `hybrid_search_products()` call against Postgres — full-text ranking and
 * pgvector nearest-neighbour search, fused by Reciprocal Rank Fusion, inside
 * one query. Neither the panel nor the page changed when it moved.
 *
 * SERVER ONLY — it reaches the database and, through `semantic.ts`, the gateway
 * credentials.
 *
 * ## Why hybrid rather than pure vector search
 *
 * Embeddings are good at "smoky, for a winter night" and bad at "Sunlit Citrine".
 * Asked for an exact product name, a vector search will happily rank a *similar*
 * fragrance first, because similarity is all it measures. Lexical matching is
 * the mirror image: precise about names and notes, blind to intent. Fusing the
 * two rankings keeps exact matches on top while letting conceptual queries reach
 * products that share no words with them.
 *
 * ## What happens when a piece is missing
 *
 * The engine has three parts and degrades one at a time rather than failing:
 *
 *   no gateway credentials / provider error → `query_embedding` is null, the
 *     semantic CTE contributes nothing, and Postgres returns the full-text
 *     ranking alone (`mode: "lexical"`).
 *   no embeddings written yet → same, from the other side: every stored vector
 *     is null until `npm run embed` runs.
 *   the RPC itself fails → {@link fallbackSearch} ranks the card list in
 *     memory with `rankLexical`. Slower and blunter, still a working search.
 */

import "server-only";

import type { Locale } from "@/src/lib/i18n/config";
import { getSupabasePublic } from "@/src/lib/supabase";
import {
  LEXICAL_WEIGHT,
  RESULTS_LIMIT,
  RRF_K,
  SEMANTIC_WEIGHT,
  SIMILARITY_FLOOR,
} from "@/src/lib/search/config";
import { rankLexical } from "@/src/lib/search/lexical";
import { embedQuery } from "@/src/lib/search/semantic";
import { fold, isSearchable, normalizeQuery, queryTerms } from "@/src/lib/search/text";
import { PRODUCT_CARD_COLUMNS, parseList, toProductCard } from "@/src/schemas/db/catalog";
import {
  getCatalogProductCards,
  getFragranceCollections,
} from "@/src/services/products";
import type { Collection, ProductCardData } from "@/src/types/catalog";
import type { SearchMode } from "@/src/types/search";

export interface SearchResult {
  products: ProductCardData[];
  /** Which passes contributed — recorded for observability, never displayed. */
  mode: SearchMode;
}

/**
 * In-memory lexical ranking over the whole catalog.
 *
 * The safety net for an RPC failure, and the reason `src/lib/search/lexical.ts`
 * still exists after the ranking moved into SQL: a search that returns
 * something sensible while the database function is broken is worth the fifty
 * lines it costs.
 */
async function fallbackSearch(
  locale: Locale,
  normalized: string,
  limit: number,
): Promise<SearchResult> {
  const products = await getCatalogProductCards(locale);
  const ranked = rankLexical(products, queryTerms(normalized));

  return {
    products: ranked.slice(0, limit).map((entry) => entry.product),
    mode: "lexical",
  };
}

/**
 * Free-text catalog search, ordered by relevance.
 *
 * Every kind is searchable — a body oil is a legitimate result — and each card
 * links through `productHref()`, so a non-fragrance lands on its category page
 * rather than a `/perfume/…` URL that would 404.
 *
 * The query text is a bound RPC argument, never interpolated: inside the
 * function it reaches `websearch_to_tsquery`, which parses it as a search
 * expression and not as SQL.
 */
export async function searchCatalog(
  locale: Locale,
  query: string,
  options: { limit?: number } = {},
): Promise<SearchResult> {
  const normalized = normalizeQuery(query);
  const limit = options.limit ?? RESULTS_LIMIT;

  // Short-circuit before touching the metered provider.
  if (!isSearchable(normalized)) return { products: [], mode: "lexical" };

  const supabase = getSupabasePublic();
  if (!supabase) return { products: [], mode: "lexical" };

  /*
   * The embedding is the enhancement, not the floor: `embedQuery()` returns
   * `null` on a missing key, a provider error, or a timeout, and the RPC still
   * returns the full-text ranking. Nothing here waits on the provider twice.
   */
  const queryVector = await embedQuery(normalized);

  const { data, error } = await supabase
    .rpc("hybrid_search_products", {
      query_text: normalized,
      /*
       * pgvector's text input form. `JSON.stringify` of a number array is
       * exactly `[0.1,0.2,…]`, which is what the `vector` type parses; handing
       * PostgREST the raw array would send a JSON array and fail the cast.
       */
      query_embedding: queryVector ? JSON.stringify(queryVector) : null,
      match_limit: limit,
      rrf_k: RRF_K,
      full_text_weight: LEXICAL_WEIGHT,
      semantic_weight: SEMANTIC_WEIGHT,
      similarity_floor: SIMILARITY_FLOOR,
      /*
       * Selects which generated tsvector and which text-search configuration
       * the full-text CTE reads — `search_vector_ar` under `simple` on `/ar`.
       * The semantic pass is unaffected: the stored embeddings are built from
       * the English `search_document`, a limit `0008_i18n_content.sql` states
       * rather than hides.
       */
      search_locale: locale,
    })
    // The function returns `setof "Product"`; without a projection the response
    // would carry every column, the 1536-float embedding included.
    .select(PRODUCT_CARD_COLUMNS);

  if (error) {
    console.error(`[search] hybrid_search_products failed: ${error.message}`);
    return fallbackSearch(locale, normalized, limit);
  }

  const products = parseList(data as unknown[] | null, (row) =>
    toProductCard(row, locale),
  );

  /*
   * An empty full-text result is not the same as no match. `websearch_to_tsquery`
   * ANDs its terms and stems them, so "smoky for a winter night" finds nothing
   * unless one document happens to contain every word — precisely the query the
   * semantic pass exists for. When that pass is unavailable and Postgres came
   * back empty, the in-memory ranker still folds accents and matches partial
   * terms, which is a better answer than an empty page.
   */
  if (products.length === 0 && !queryVector) {
    return fallbackSearch(locale, normalized, limit);
  }

  return {
    products,
    mode: queryVector ? "hybrid" : "lexical",
  };
}

/**
 * Fragrance collections matching a query, for the panel's Collections column.
 *
 * Lexical only, and deliberately so: there are three of them, and a vector call
 * to rank three rows would cost more than it could possibly be worth.
 *
 * Filtered in memory rather than with `.or('name.ilike…')`: PostgREST's filter
 * grammar is comma- and parenthesis-delimited, so splicing a visitor's query
 * into it is a small injection surface for no gain over folding three rows.
 */
export async function searchCollections(
  locale: Locale,
  query: string,
): Promise<Collection[]> {
  const normalized = normalizeQuery(query);
  if (!isSearchable(normalized)) return [];

  const terms = queryTerms(normalized);
  const collections = await getFragranceCollections(locale);

  return collections.filter((collection) => {
    const haystack = fold(`${collection.name} ${collection.description}`);
    return terms.every((term) => haystack.includes(term));
  });
}
