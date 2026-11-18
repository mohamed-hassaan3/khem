/**
 * Search tuning constants — the one place both halves of the engine agree.
 *
 * Every value here has a twin on the other side of the migration: the model and
 * dimensions become the `vector(N)` column and the embedding job, the weights
 * and `RRF_K` become arguments to `hybrid_search_products()` in Postgres. Keep
 * them here so a relevance change is a diff in one file rather than a hunt
 * through the service, the script, and the SQL.
 *
 * Deliberately import-free: the offline embedding script (plain Node via `tsx`),
 * the route handler, and the Server Components all read it.
 */

/**
 * Embedding model, addressed through the Vercel AI Gateway as `provider/model`
 * and authenticated with `AI_GATEWAY_API_KEY` — which works from the VPS; the
 * gateway is a hosted API and needs no Vercel deployment.
 *
 * `cohere/embed-v4.0` since Nov 2026 (v2), replacing `openai/text-embedding-3-
 * small` (v1). Two reasons: it is on the gateway's free tier and the OpenAI
 * model is not, and it is multilingual — an Arabic query now lands near this
 * catalog's English text, which `text-embedding-3-small` did poorly. Verified
 * through the gateway before switching: 1536-d vectors for documents, English
 * queries and Arabic queries, with `outputDimension` demonstrably honoured.
 *
 * Changing the model is this constant, the two `*_EMBEDDING_OPTIONS` below,
 * {@link EMBEDDING_DIMENSIONS} if the width moves, a bump of
 * {@link EMBEDDING_VERSION}, and `npm run embed -- --reembed` — stored vectors
 * from another model live in a different space and rank as noise.
 */
export const EMBEDDING_MODEL = "cohere/embed-v4.0";

/** Vector width. Becomes the `vector(N)` column type. */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Bump whenever {@link EMBEDDING_MODEL}, {@link EMBEDDING_DIMENSIONS}, or
 * the `search_document` column in `supabase/sql/0004_search.sql` changes.
 *
 * Stored vectors are only comparable to a query vector produced by the same
 * model from the same kind of document. The version is written into the
 * generated index and checked on load, so a stale file degrades the search to
 * lexical instead of silently ranking against vectors that describe text which
 * no longer exists.
 */
export const EMBEDDING_VERSION = 2;

/**
 * Cohere embeds a stored document and a search query differently, and ranks
 * best when each side says which it is. Every write path (the batch script, the
 * one-row admin saves) uses the document options; the visitor's query uses the
 * query options. `outputDimension` pins the width to the `vector(1536)` column
 * rather than trusting the model default.
 */
export const DOCUMENT_EMBEDDING_OPTIONS = {
  cohere: { inputType: "search_document", outputDimension: EMBEDDING_DIMENSIONS },
} as const;

export const QUERY_EMBEDDING_OPTIONS = {
  cohere: { inputType: "search_query", outputDimension: EMBEDDING_DIMENSIONS },
} as const;

/** The query parameter, so a search is linkable and shareable. */
export const SEARCH_PARAM = "q";

/**
 * Query-string key carrying the locale to the suggestions endpoint.
 *
 * The panel is a Client Component with no route params of its own, and the
 * endpoint sits outside the `[locale]` tree — so the locale travels as an
 * explicit parameter rather than being inferred from a header or a referrer.
 * It is narrowed with `isLocale()` on arrival; an unknown value degrades to
 * English rather than erroring.
 */
export const LOCALE_PARAM = "locale";

/** Below this, a query is a keystroke rather than an intent. */
export const MIN_QUERY_LENGTH = 2;

/**
 * Hard cap on query length.
 *
 * Not cosmetic: the query is sent to a third-party embedding provider, so the
 * cap is what stops this endpoint being used as somebody's free embedding API.
 */
export const MAX_QUERY_LENGTH = 120;

/**
 * Cosine similarity below which a vector "match" is noise.
 *
 * Embeddings always return a nearest neighbour — without a floor, every query
 * matches every product to some degree and "no results" becomes unreachable.
 */
export const SIMILARITY_FLOOR = 0.28;

/**
 * Reciprocal Rank Fusion damping. 60 is the value from the original RRF paper
 * and the one Supabase's hybrid-search guide uses; keeping it means relevance
 * does not shift when the fusion moves into SQL.
 */
export const RRF_K = 60;

/** Relative pull of each ranking in the fusion. Equal weight by default. */
export const LEXICAL_WEIGHT = 1;
export const SEMANTIC_WEIGHT = 1;

/**
 * Ceiling on the query-embedding call.
 *
 * The lexical pass has already produced results by the time this fires; waiting
 * longer than this for the enhancement would make the panel feel broken.
 */
export const EMBED_TIMEOUT_MS = 2_500;

/** Suggestions in the overlay panel. */
export const SUGGESTION_LIMIT = 6;

/** Collection suggestions in the overlay panel. */
export const COLLECTION_SUGGESTION_LIMIT = 3;

/** Upper bound on the results page. */
export const RESULTS_LIMIT = 48;
