/**
 * Catalog embedder — `npm run embed` (and `npm run embed -- --check`).
 *
 * Fills `"Product".embedding` for every row where it is null, using the model
 * in `src/lib/search/config.ts`. Those vectors are what
 * `hybrid_search_products()` and `related_products()` rank against; until this
 * has run, both degrade to their full-text and editorial orderings.
 *
 * ## What gets embedded
 *
 * `"Product".search_document` — a generated column, so the string that gets
 * embedded is composed by Postgres, not here. That is deliberate: the full-text
 * index reads the same column, and the two halves of a hybrid search must
 * describe the same text or their rankings are about different documents. It
 * also removes the drift risk of the old arrangement, where a TypeScript
 * function and a SQL expression each built their own version of the document
 * and nothing checked that they agreed.
 *
 * ## Staleness
 *
 * A trigger nulls `embedding` whenever `search_document` changes, so editing a
 * product marks it for re-embedding automatically. `--check` reports how many
 * rows are waiting and exits non-zero if any are — the CI guard against a
 * catalog edit that shipped without a re-run.
 *
 * ## Cost and credentials
 *
 * Batched, and only ever over rows with no vector, so a re-run after adding one
 * product embeds one product. Needs `AI_GATEWAY_API_KEY` (or Vercel's OIDC
 * token) for the gateway and `SUPABASE_DB_URL` for the write, which is why this
 * is a script and not something a request can trigger.
 */

import { embedMany } from "ai";

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
} from "../src/lib/search/config";
import { redactUrl, connectionString, withClient } from "./db";

/** Rows per gateway call. Large enough to be cheap, small enough to retry. */
const BATCH_SIZE = 32;

interface PendingRow {
  slug: string;
  document: string;
}

function hasGatewayCredentials(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN);
}

/** pgvector's text input form: `[0.1,0.2,…]`. */
function toVectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(",")}]`;
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check");

  await withClient(async (client) => {
    const { rows: pending } = await client.query<PendingRow>(
      `select slug, search_document as document
         from public."Product"
        where embedding is null
          and "isArchived" = false
          and "deletedAt" is null
        order by slug`,
    );

    const { rows: totals } = await client.query<{ total: string }>(
      `select count(*)::text as total from public."Product"`,
    );
    const total = Number(totals[0].total);

    console.log(
      `${redactUrl(connectionString())}: ${pending.length} of ${total} products ` +
        `need an embedding (${EMBEDDING_MODEL}, ${EMBEDDING_DIMENSIONS}d, v${EMBEDDING_VERSION})`,
    );

    if (checkOnly) {
      if (pending.length > 0) {
        console.error(
          `\n${pending.length} product(s) have no vector. Run \`npm run embed\`.`,
        );
        process.exitCode = 1;
      } else {
        console.log("Every product is embedded.");
      }
      return;
    }

    if (pending.length === 0) return;

    if (!hasGatewayCredentials()) {
      throw new Error(
        "No AI Gateway credentials. Set AI_GATEWAY_API_KEY in .env.local, or run `vercel env pull`.",
      );
    }

    for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
      const batch = pending.slice(offset, offset + BATCH_SIZE);

      const { embeddings } = await embedMany({
        model: EMBEDDING_MODEL,
        values: batch.map((row) => row.document),
        maxRetries: 2,
        providerOptions: { openai: { dimensions: EMBEDDING_DIMENSIONS } },
      });

      if (embeddings.length !== batch.length) {
        throw new Error(
          `Gateway returned ${embeddings.length} vectors for ${batch.length} documents.`,
        );
      }

      for (const [index, embedding] of embeddings.entries()) {
        if (embedding.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Model returned ${embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}. ` +
              "Bump EMBEDDING_VERSION and the vector(N) column together.",
          );
        }

        /*
         * The update writes `embedding` only, and the invalidation trigger
         * fires on `search_document` changing — which this cannot change — so
         * writing a vector does not immediately null it again.
         */
        await client.query(
          `update public."Product"
              set embedding = $1::extensions.vector
            where slug = $2`,
          [toVectorLiteral(embedding), batch[index].slug],
        );
      }

      console.log(`  embedded ${Math.min(offset + batch.length, pending.length)}/${pending.length}`);
    }

    console.log("Embeddings written.");
  });
}

main().catch((cause: unknown) => {
  console.error(
    `Embedding failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
