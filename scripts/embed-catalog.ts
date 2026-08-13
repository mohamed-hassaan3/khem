/**
 * Offline catalog embedder — `npm run embed` (and `npm run embed -- --check`).
 *
 * Embeddings are generated here, committed to the repository, and read at
 * request time. Three reasons it works this way rather than embedding on
 * demand:
 *
 *  - `npm run build` and CI never need gateway credentials, and a build can
 *    never silently spend money.
 *  - The catalog changes when a merchandiser edits it, not when a visitor
 *    searches. Re-embedding on every request would pay for the same vectors
 *    thousands of times.
 *  - It mirrors the destination: in Postgres these vectors are a stored column
 *    filled by a background job, not something computed inside the query.
 *
 * `--check` re-hashes every product's document and exits non-zero if any has
 * drifted from the vector on file. That is the guard against the one silent
 * failure mode this design has — catalog text edited without a re-run, leaving
 * vectors that describe a product that no longer exists.
 *
 * → Becomes a Supabase Edge Function on `pg_cron`, embedding rows whose
 *   `embedding` a trigger set to NULL. See `supabase/README.md`.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { embedMany } from "ai";

import { COLLECTIONS, PRODUCTS } from "../src/data/products";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
} from "../src/lib/search/config";
import { productEmbeddingSource } from "../src/lib/search/text";
import type { EmbeddingIndex } from "../src/types/search";

const OUTPUT_PATH = path.join(process.cwd(), "src/data/embeddings.generated.json");

/**
 * Stored precision.
 *
 * Six decimals roughly halves the file against full float64 output and moves
 * cosine similarities by less than 1e-6 — far below anything that could reorder
 * two results.
 */
const PRECISION = 1e6;

function hashDocument(document: string): string {
  return createHash("sha256").update(document).digest("hex").slice(0, 16);
}

/** Every product's embedding document, keyed by id. */
function buildDocuments(): Map<string, string> {
  const collectionNames = new Map(
    COLLECTIONS.map((collection) => [collection.slug, collection.name]),
  );

  return new Map(
    PRODUCTS.map((product) => [
      product.id,
      productEmbeddingSource(
        product,
        collectionNames.get(product.collectionSlug) ?? "KHEM",
      ),
    ]),
  );
}

/**
 * Read the committed index from disk rather than importing it — an import would
 * be cached by the module graph and, in `--check`, is exactly the file we may
 * have just rewritten.
 */
async function readIndex(): Promise<EmbeddingIndex | null> {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, "utf8")) as EmbeddingIndex;
  } catch {
    return null;
  }
}

/** Report drift between the committed vectors and the current catalog text. */
async function check(documents: Map<string, string>): Promise<never> {
  const index = await readIndex();

  if (index === null || Object.keys(index.items).length === 0) {
    console.error(
      "✗ No embeddings on file. Run `npm run embed` with AI_GATEWAY_API_KEY set.\n" +
        "  (Search still works — it falls back to lexical matching.)",
    );
    process.exit(1);
  }

  const problems: string[] = [];

  if (
    index.model !== EMBEDDING_MODEL ||
    index.dimensions !== EMBEDDING_DIMENSIONS ||
    index.version !== EMBEDDING_VERSION
  ) {
    problems.push(
      `index built with ${index.model}@${index.dimensions} v${index.version}, ` +
        `config expects ${EMBEDDING_MODEL}@${EMBEDDING_DIMENSIONS} v${EMBEDDING_VERSION}`,
    );
  }

  for (const [id, document] of documents) {
    const entry = index.items[id];
    if (!entry) {
      problems.push(`${id}: no vector`);
    } else if (entry.sourceHash !== hashDocument(document)) {
      problems.push(`${id}: catalog text changed since it was embedded`);
    }
  }

  for (const id of Object.keys(index.items)) {
    if (!documents.has(id)) problems.push(`${id}: vector for a product that no longer exists`);
  }

  if (problems.length > 0) {
    console.error(`✗ Embedding index is stale:\n  ${problems.join("\n  ")}\n`);
    console.error("  Run `npm run embed` to regenerate.");
    process.exit(1);
  }

  console.log(`✓ ${documents.size} products, all embeddings current.`);
  process.exit(0);
}

async function generate(documents: Map<string, string>): Promise<void> {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    console.error(
      "✗ No AI Gateway credentials.\n" +
        "  Set AI_GATEWAY_API_KEY in .env.local, or run `vercel env pull` for an OIDC token.",
    );
    process.exit(1);
  }

  const ids = [...documents.keys()];
  console.log(`Embedding ${ids.length} products with ${EMBEDDING_MODEL}…`);

  const { embeddings, usage } = await embedMany({
    model: EMBEDDING_MODEL,
    values: ids.map((id) => documents.get(id) ?? ""),
    providerOptions: { openai: { dimensions: EMBEDDING_DIMENSIONS } },
  });

  const items: EmbeddingIndex["items"] = {};

  ids.forEach((id, position) => {
    const vector = embeddings[position];
    if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Model returned ${vector?.length ?? 0} dimensions for ${id}, expected ${EMBEDDING_DIMENSIONS}.`,
      );
    }

    items[id] = {
      sourceHash: hashDocument(documents.get(id) ?? ""),
      vector: vector.map((value) => Math.round(value * PRECISION) / PRECISION),
    };
  });

  const index: EmbeddingIndex = {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    version: EMBEDDING_VERSION,
    generatedAt: new Date().toISOString(),
    items,
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(index, null, 0)}\n`, "utf8");

  console.log(
    `✓ Wrote ${ids.length} vectors to src/data/embeddings.generated.json ` +
      `(${usage.tokens} tokens). Commit this file.`,
  );
}

/*
 * Wrapped rather than top-level `await`: `tsx` transforms this to CommonJS on
 * Node 20, where a top-level await is a hard error.
 */
async function main(): Promise<void> {
  const documents = buildDocuments();

  if (process.argv.includes("--check")) await check(documents);
  else await generate(documents);
}

main().catch((error: unknown) => {
  console.error("✗ Embedding failed.\n", error);
  process.exit(1);
});
