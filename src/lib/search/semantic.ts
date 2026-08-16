/**
 * The semantic half of the engine — query embedding and vector similarity.
 *
 * SERVER ONLY — `import "server-only"` below is the guard. This module reads
 * `AI_GATEWAY_API_KEY` and must never reach a Client Component.
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
 * Ranking used to live here too, as a brute-force loop over a generated index.
 * It is now `order by embedding <=> query_embedding` against an HNSW index
 * inside `hybrid_search_products()`. Embedding the *query* stayed: it is the one
 * part that cannot happen in Postgres.
 */

import "server-only";

import { embed } from "ai";

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  EMBED_TIMEOUT_MS,
} from "./config";
import { fold } from "./text";

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
