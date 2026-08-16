/**
 * Catalog search — the hybrid query layer.
 *
 * Like `src/services/products.ts`, this is the seam between the UI and the data
 * store: the route handler and the results page call these functions and know
 * nothing about how a match is found. Today that is a lexical pass fused with a
 * brute-force vector comparison over a generated index; tomorrow it is one
 * `hybrid_search_products()` RPC against Postgres. Neither the panel nor the
 * page changes.
 *
 * SERVER ONLY — it pulls in the embedding index and, through `semantic.ts`, the
 * gateway credentials. (Add `import "server-only"` once that package is
 * installed; the same note sits on `src/services/products.ts`.)
 *
 * ## Why hybrid rather than pure vector search
 *
 * Embeddings are good at "smoky, for a winter night" and bad at "Sunlit Citrine".
 * Asked for an exact product name, a vector search will happily rank a *similar*
 * fragrance first, because similarity is all it measures. Lexical matching is
 * the mirror image: precise about names and notes, blind to intent. Fusing the
 * two rankings keeps exact matches on top while letting conceptual queries reach
 * products that share no words with them.
 */

import embeddingIndex from "@/src/data/embeddings.generated.json";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  LEXICAL_WEIGHT,
  RESULTS_LIMIT,
  SEMANTIC_WEIGHT,
} from "@/src/lib/search/config";
import { reciprocalRankFusion } from "@/src/lib/search/fuse";
import { rankLexical } from "@/src/lib/search/lexical";
import { embedQuery, rankSemantic } from "@/src/lib/search/semantic";
import { fold, isSearchable, normalizeQuery, queryTerms } from "@/src/lib/search/text";
import {
  getCatalogProductCards,
  getFragranceCollections,
} from "@/src/services/products";
import type { Collection, ProductCardData } from "@/src/types/catalog";
import type { EmbeddingIndex, SearchMode } from "@/src/types/search";

export interface SearchResult {
  products: ProductCardData[];
  /** Which passes contributed — recorded for observability, never displayed. */
  mode: SearchMode;
}

/**
 * The generated index, validated once per process.
 *
 * A vector is only comparable to a query vector produced by the same model, at
 * the same width, from the same kind of document. When any of those three drift
 * the honest move is to disown the whole file: ranking against vectors that
 * describe text which no longer exists produces confidently wrong results, which
 * is worse than no semantic pass at all.
 */
let validatedIndex: EmbeddingIndex | null | undefined;

function loadIndex(): EmbeddingIndex | null {
  if (validatedIndex !== undefined) return validatedIndex;

  const index = embeddingIndex as EmbeddingIndex;
  const entryCount = Object.keys(index.items ?? {}).length;

  if (entryCount === 0) {
    // Not an error: the committed placeholder is empty until `npm run embed`
    // has been run with gateway credentials.
    validatedIndex = null;
    return null;
  }

  const matches =
    index.model === EMBEDDING_MODEL &&
    index.dimensions === EMBEDDING_DIMENSIONS &&
    index.version === EMBEDDING_VERSION;

  if (!matches) {
    console.warn(
      `[search] Embedding index is stale (model ${index.model}@${index.dimensions} v${index.version}, ` +
        `expected ${EMBEDDING_MODEL}@${EMBEDDING_DIMENSIONS} v${EMBEDDING_VERSION}). ` +
        `Run \`npm run embed\`. Falling back to lexical search.`,
    );
    validatedIndex = null;
    return null;
  }

  validatedIndex = index;
  return index;
}

/**
 * Free-text catalog search, ordered by relevance.
 *
 * Every kind is searchable — a body oil is a legitimate result — and each card
 * links through `productHref()`, so a non-fragrance lands on its category page
 * rather than a `/perfume/…` URL that would 404.
 *
 * → const { embedding } = await embed({ model: EMBEDDING_MODEL, value: query })
 *   supabase.rpc('hybrid_search_products', {
 *     query_text: query,
 *     query_embedding: embedding,
 *     match_limit: limit,
 *     rrf_k: RRF_K,
 *     full_text_weight: LEXICAL_WEIGHT,
 *     semantic_weight: SEMANTIC_WEIGHT,
 *   })
 *   — the fusion below moves into SQL; this body becomes that single call.
 *   See `supabase/sql/product-search.sql` for the function it calls.
 */
export async function searchCatalog(
  query: string,
  options: { limit?: number } = {},
): Promise<SearchResult> {
  const normalized = normalizeQuery(query);
  const limit = options.limit ?? RESULTS_LIMIT;

  // Short-circuit before touching the metered provider.
  if (!isSearchable(normalized)) return { products: [], mode: "lexical" };

  const index = loadIndex();

  /*
   * Both passes run together. The lexical ranking is the floor and needs
   * nothing; the embedding call is the enhancement and may fail. Awaiting them
   * in sequence would add the provider's latency to every search for no reason.
   */
  const [products, queryVector] = await Promise.all([
    getCatalogProductCards(),
    index === null ? Promise.resolve(null) : embedQuery(normalized),
  ]);

  const lexical = rankLexical(products, queryTerms(normalized));

  if (queryVector === null || index === null) {
    return {
      products: lexical.slice(0, limit).map((entry) => entry.product),
      mode: "lexical",
    };
  }

  const semantic = rankSemantic(queryVector, index);

  const fused = reciprocalRankFusion([
    { weight: LEXICAL_WEIGHT, ids: lexical.map((entry) => entry.product.id) },
    { weight: SEMANTIC_WEIGHT, ids: semantic.map((entry) => entry.id) },
  ]);

  const byId = new Map(products.map((product) => [product.id, product]));

  return {
    products: fused
      .slice(0, limit)
      .map((entry) => byId.get(entry.id))
      .filter((product): product is ProductCardData => product !== undefined),
    mode: "hybrid",
  };
}

/**
 * Fragrance collections matching a query, for the panel's Collections column.
 *
 * Lexical only, and deliberately so: there are three of them, and a vector call
 * to rank three rows would cost more than it could possibly be worth.
 *
 * → supabase.from('Collection').select('*').eq('kind', 'FRAGRANCE')
 *     .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
 */
export async function searchCollections(query: string): Promise<Collection[]> {
  const normalized = normalizeQuery(query);
  if (!isSearchable(normalized)) return [];

  const terms = queryTerms(normalized);
  const collections = await getFragranceCollections();

  return collections.filter((collection) => {
    const haystack = fold(`${collection.name} ${collection.description}`);
    return terms.every((term) => haystack.includes(term));
  });
}
