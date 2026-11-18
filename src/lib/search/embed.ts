/**
 * Embedding a single document, for callers that have exactly one.
 *
 * `scripts/embed-catalog.ts` embeds the whole backlog in batches; the admin
 * dashboard embeds the one product it just saved. Both must produce vectors the
 * *same* model made from the same kind of text, or a freshly authored product
 * would be ranked against a different space than the rest of the catalog — so
 * the model call, the credential check, and pgvector's literal format live here
 * and the script imports them rather than keeping a second copy.
 *
 * ⚠ No `import "server-only"` here, deliberately, and for the same reason
 * `config.ts` has no imports at all: the offline script runs under plain Node
 * via `tsx`, where that module throws on import. Nothing in this file is a
 * secret — `AI_GATEWAY_API_KEY` is read from the environment at call time — but only
 * server modules and scripts may import it, and a Client Component that reaches
 * it will fail at runtime rather than leak anything.
 */

import { embed } from "ai";

import {
  DOCUMENT_EMBEDDING_OPTIONS,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from "./config";

/**
 * Whether the AI Gateway can be called at all.
 *
 * `AI_GATEWAY_API_KEY` — from `.env.local` locally, from
 * `/srv/khem/shared/.env.production` on the VPS. Only the explicit key: the
 * short-lived `VERCEL_OIDC_TOKEN` exists only inside a Vercel deployment, and
 * KHEM no longer runs on one. Absent, every caller degrades to lexical search
 * rather than failing.
 */
export function hasEmbeddingCredentials(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY);
}

/**
 * The one embedding model every path uses — the batch script, the one-row admin
 * saves, and the query side in `semantic.ts`. Stored vectors are only
 * comparable to query vectors from this exact model, so it is named here once.
 * A `provider/model` string is routed through the AI Gateway by the `ai` SDK.
 */
export function embeddingModel(): string {
  return EMBEDDING_MODEL;
}

/** pgvector's text input form: `[0.1,0.2,…]`. */
export function toVectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(",")}]`;
}

/**
 * The vector for one document, or `null`.
 *
 * Returns rather than throws on every failure — no credentials, provider error,
 * unexpected width — because the only caller is a write path that has already
 * saved the row. A missing vector degrades that product's search to lexical,
 * which is precisely the state of every product on a database where `npm run
 * embed` has not run yet; an exception here would instead lose the editor their
 * work after the fact.
 *
 * A wrong width is treated as a failure rather than stored: the column is
 * `vector(1536)` and a mismatched vector would be rejected by Postgres anyway,
 * with a far less legible message.
 */
export async function embedDocument(
  document: string,
): Promise<number[] | null> {
  if (document.trim().length === 0) return null;
  if (!hasEmbeddingCredentials()) {
    console.warn("[search] No AI_GATEWAY_API_KEY; embedding skipped.");
    return null;
  }

  try {
    const { embedding } = await embed({
      model: embeddingModel(),
      value: document,
      maxRetries: 2,
      providerOptions: DOCUMENT_EMBEDDING_OPTIONS,
    });

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      console.error(
        `[search] Model returned ${embedding.length} dimensions, expected ` +
          `${EMBEDDING_DIMENSIONS}. Bump EMBEDDING_VERSION and the vector(N) column together.`,
      );
      return null;
    }

    return embedding;
  } catch (cause) {
    console.error(
      `[search] Embedding failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
    );
    return null;
  }
}
