/**
 * The semantic half of the engine — query embedding and vector similarity.
 *
 * SERVER ONLY. This module reads `AI_GATEWAY_API_KEY` and must never be
 * imported from a Client Component. (When the `server-only` package is
 * installed, add `import "server-only"` at the top; the same note sits on
 * `src/services/products.ts`.)
 *
 * Two rules govern everything here:
 *
 * 1. **It fails soft, always.** No key, no network, a provider error, a
 *    timeout — every path returns `null` and the caller falls back to the
 *    lexical ranking. A visitor must never see a search break because an AI
 *    provider had a bad minute.
 *
 * 2. **Every cache miss costs money.** The LRU below, the rate limit in the
 *    route handler, and the query-length cap in `text.ts` are all the same
 *    concern: this is a public endpoint in front of a metered API.
 *
 * → In Postgres, `rankSemantic()` disappears entirely: the brute-force loop
 *   becomes `order by embedding <=> query_embedding limit n` against an HNSW
 *   index. `embedQuery()` survives unchanged — the query still has to be
 *   embedded somewhere, and it will still be here.
 */

import { cosineSimilarity, embed } from "ai";

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  EMBED_TIMEOUT_MS,
  SIMILARITY_FLOOR,
} from "./config";
import { fold } from "./text";
import type { EmbeddingIndex } from "@/src/types/search";

/**
 * Query-embedding cache, keyed by model + version + folded query.
 *
 * Search traffic is extremely repetitive — the same handful of terms, plus every
 * prefix a visitor types on the way to them. A `Map` preserves insertion order,
 * so evicting the oldest key is a `keys().next()` away.
 *
 * Per-instance and lost on redeploy, which is fine for a cache and stated here
 * so nobody mistakes it for shared state. It becomes Vercel KV if the miss rate
 * ever justifies the round trip.
 */
const CACHE_LIMIT = 200;
const cache = new Map<string, number[]>();

/**
 * Whether the gateway can be reached at all.
 *
 * Two credentials are valid and the SDK picks up whichever is present: a
 * long-lived `AI_GATEWAY_API_KEY` (how local development authenticates, from
 * `.env.local`) or the short-lived OIDC token Vercel injects into a deployment,
 * which rotates on its own and is the preferred production path — run
 * `vercel env pull` to use it locally too.
 *
 * Checking for *either* matters: keying this on the API key alone would silently
 * disable semantic search on every OIDC-authenticated deployment, and the
 * fallback is quiet by design, so nobody would notice.
 */
function hasGatewayCredentials(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN);
}

/** Whether the "provider unavailable" warning has already been logged. */
let hasWarned = false;

function warnOnce(message: string, error?: unknown): void {
  if (hasWarned) return;
  hasWarned = true;
  // One line per process, not one per keystroke.
  console.warn(`[search] ${message} Falling back to lexical search.`, error ?? "");
}

/**
 * Embed a search query, or return `null` when the semantic layer is unavailable.
 *
 * The abort signal is a product decision as much as a technical one: the lexical
 * results are already in hand by the time this is awaited, so waiting longer
 * than {@link EMBED_TIMEOUT_MS} would trade a working search for a slow one.
 */
export async function embedQuery(query: string): Promise<number[] | null> {
  if (!hasGatewayCredentials()) {
    warnOnce("No AI Gateway credentials (AI_GATEWAY_API_KEY or OIDC token).");
    return null;
  }

  const key = `${EMBEDDING_VERSION}:${EMBEDDING_MODEL}:${fold(query)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const { embedding } = await embed({
      model: EMBEDDING_MODEL,
      value: query,
      abortSignal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
      // A retry storm behind a 2.5s deadline just burns the budget.
      maxRetries: 1,
      providerOptions: { openai: { dimensions: EMBEDDING_DIMENSIONS } },
    });

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      warnOnce(
        `Embedding model returned ${embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}.`,
      );
      return null;
    }

    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, embedding);

    return embedding;
  } catch (error) {
    warnOnce("Query embedding failed.", error);
    return null;
  }
}

/**
 * Rank product ids by cosine similarity to the query vector, best first.
 *
 * The floor is what makes "no results" reachable: nearest-neighbour search
 * always returns a neighbour, so without it every query would match every
 * product to some degree.
 *
 * Brute force over the whole index — correct and microseconds-fast at catalog
 * scale, and precisely the loop the HNSW index replaces once the vectors live
 * in Postgres.
 */
export function rankSemantic(
  queryVector: readonly number[],
  index: EmbeddingIndex,
): { id: string; similarity: number }[] {
  const ranked: { id: string; similarity: number }[] = [];

  for (const [id, entry] of Object.entries(index.items)) {
    // A vector of the wrong width is a stale entry, not a comparison.
    if (entry.vector.length !== queryVector.length) continue;

    const similarity = cosineSimilarity([...queryVector], entry.vector);
    if (similarity >= SIMILARITY_FLOOR) ranked.push({ id, similarity });
  }

  return ranked.sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id));
}
