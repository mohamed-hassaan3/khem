/**
 * Embedder — `npm run embed` (and `-- --check`, `-- --reembed`).
 *
 * Fills `embedding` for every row where it is null, in both tables that carry
 * one: `"Product"` and `"Article"`. Those vectors are what
 * `hybrid_search_products()`, `related_products()` and `related_articles()`
 * rank against; until this has run, all three degrade to their full-text and
 * editorial orderings.
 *
 * ## What gets embedded
 *
 * `search_document` — a generated column on each table, so the string that gets
 * embedded is composed by Postgres, not here. That is deliberate: for products
 * the full-text index reads the same column, and the two halves of a hybrid
 * search must describe the same text or their rankings are about different
 * documents. It also removes the drift risk of the old arrangement, where a
 * TypeScript function and a SQL expression each built their own version of the
 * document and nothing checked that they agreed.
 *
 * ## Staleness
 *
 * A trigger nulls `embedding` whenever `search_document` changes, so editing a
 * product or an article marks it for re-embedding automatically. `--check`
 * reports how many rows are waiting, across both tables, and exits non-zero if
 * any are — the CI guard against an edit that shipped without a re-run.
 *
 * ## Cost and credentials
 *
 * Batched, and only ever over rows with no vector, so a re-run after adding one
 * article embeds one article. Needs `AI_GATEWAY_API_KEY` for the embeddings and
 * `SUPABASE_DB_URL` for the write, which is why this
 * is a script and not something a request can trigger.
 */

import { embedMany } from "ai";
import type { Client } from "pg";

import {
  DOCUMENT_EMBEDDING_OPTIONS,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
} from "../src/lib/search/config";
/*
 * Shared with `src/actions/admin/catalog.ts` and `src/actions/admin/journal.ts`,
 * which embed the single row an editor just saved. The credential check and the
 * literal format live in one place so the batch path here and the one-row paths
 * there cannot drift.
 */
import {
  embeddingModel,
  hasEmbeddingCredentials,
  toVectorLiteral,
} from "../src/lib/search/embed";
import { redactUrl, connectionString, withClient } from "./db";

/** Rows per provider call. Large enough to be cheap, small enough to retry. */
const BATCH_SIZE = 32;

interface PendingRow {
  slug: string;
  document: string;
}

interface EmbedTarget {
  /** Table name. Interpolated into SQL — every value is a literal below, never input. */
  table: string;
  /** The row's unique key column (a literal below, never input). */
  key: string;
  /** SQL expression for the text that is embedded (a literal below, never input). */
  document: string;
  /** Plural noun, for the log lines an operator reads. */
  plural: string;
  /**
   * Which rows are *meant* to carry a vector. An archived product and an
   * unpublished draft are invisible to the functions that rank, so embedding
   * them would spend embedding credit on rows nobody can reach — and, worse,
   * `--check` would fail forever on a draft the editor has not finished.
   */
  scope: string;
}

const TARGETS: readonly EmbedTarget[] = [
  {
    table: "Product",
    key: "slug",
    document: "search_document",
    plural: "products",
    scope: `"isArchived" = false and "deletedAt" is null`,
  },
  {
    table: "Article",
    key: "slug",
    document: "search_document",
    plural: "articles",
    scope: `"isPublished"`,
  },
  {
    /*
     * The bilingual notes glossary (0075). Embedded as "Black Oud · العود
     * الأسود", so a note is close to a query in either language. The AI search
     * redesign compares a query with the notes of each result to say *why* it
     * matched — only ever notes the product really contains.
     */
    table: "fragrance_notes",
    key: "name_en",
    document: `name_en || coalesce(' · ' || name_ar, '')`,
    plural: "notes",
    scope: "true",
  },
];

/**
 * The free AI Gateway tier allows five embedding requests a minute for the
 * whole team. Batches are spaced so a full run never trips it.
 */
const MIN_MS_BETWEEN_CALLS = 13_000;
let lastCallAt = 0;

async function paced<T>(call: () => Promise<T>): Promise<T> {
  const wait = lastCallAt + MIN_MS_BETWEEN_CALLS - Date.now();
  if (lastCallAt > 0 && wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  try {
    return await call();
  } finally {
    lastCallAt = Date.now();
  }
}

/**
 * A note that appears on a product but not yet in the glossary is added,
 * unnamed in Arabic, so it is embedded and listed by `--check` for naming.
 */
async function syncNoteGlossary(client: Client): Promise<number> {
  const { rowCount } = await client.query(
    `insert into public.fragrance_notes (name_en)
     select distinct n
       from public."Product" p,
            unnest(p."topNotes" || p."heartNotes" || p."baseNotes") as n
      where p."isArchived" = false and p."deletedAt" is null
        and n is not null and btrim(n) <> ''
     on conflict (name_en) do nothing`,
  );
  return rowCount ?? 0;
}

/** Rows still waiting for a vector, oldest-stable-order first. */
async function pendingFor(
  client: Client,
  target: EmbedTarget,
): Promise<PendingRow[]> {
  const { rows } = await client.query<PendingRow>(
    `select ${target.key} as slug, ${target.document} as document
       from public."${target.table}"
      where embedding is null
        and ${target.scope}
      order by ${target.key}`,
  );

  return rows;
}

async function totalFor(
  client: Client,
  target: EmbedTarget,
): Promise<number> {
  const { rows } = await client.query<{ total: string }>(
    `select count(*)::text as total
       from public."${target.table}"
      where ${target.scope}`,
  );

  return Number(rows[0].total);
}

/**
 * Embed one table's backlog.
 *
 * Product writes persist since `0073_product_embedding_invalidation.sql`, which
 * replaced a BEFORE UPDATE trigger that nulled every vector as it was written.
 */
async function embedTarget(
  client: Client,
  target: EmbedTarget,
  pending: PendingRow[],
): Promise<void> {
  for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
    const batch = pending.slice(offset, offset + BATCH_SIZE);

    const { embeddings } = await paced(() => embedMany({
      model: embeddingModel(),
      values: batch.map((row) => row.document),
      maxRetries: 2,
      providerOptions: DOCUMENT_EMBEDDING_OPTIONS,
    }));

    if (embeddings.length !== batch.length) {
      throw new Error(
        `Provider returned ${embeddings.length} vectors for ${batch.length} documents.`,
      );
    }

    for (const [index, embedding] of embeddings.entries()) {
      if (embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Model returned ${embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}. ` +
            "Bump EMBEDDING_VERSION and the vector(N) column together.",
        );
      }

      await client.query(
        `update public."${target.table}"
            set embedding = $1::extensions.vector
          where ${target.key} = $2`,
        [toVectorLiteral(embedding), batch[index].slug],
      );
    }

    console.log(
      `  ${target.plural}: embedded ` +
        `${Math.min(offset + batch.length, pending.length)}/${pending.length}`,
    );
  }
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check");
  const reembed = process.argv.includes("--reembed");

  await withClient(async (client) => {
    console.log(
      `${redactUrl(connectionString())} ` +
        `(${EMBEDDING_MODEL}, ${EMBEDDING_DIMENSIONS}d, v${EMBEDDING_VERSION})`,
    );

    /*
     * `--reembed`: after a model change, every stored vector is in the old
     * model's space and ranks as noise against the new model's queries. Null
     * the in-scope rows so the normal pass below refills them all. Refused
     * without credentials, so it can never leave the catalog vector-less by
     * accident; an interrupted run just leaves rows null, which degrade to
     * lexical and are picked up by the next `npm run embed`.
     */
    if (reembed && !checkOnly) {
      if (!hasEmbeddingCredentials()) {
        throw new Error("--reembed needs AI_GATEWAY_API_KEY; nothing was cleared.");
      }
      for (const target of TARGETS) {
        const { rowCount } = await client.query(
          `update public."${target.table}" set embedding = null
            where embedding is not null and ${target.scope}`,
        );
        console.log(`  cleared ${rowCount ?? 0} ${target.plural} vector(s) for re-embedding`);
      }
    }

    if (!checkOnly) {
      const added = await syncNoteGlossary(client);
      if (added > 0) console.log(`  added ${added} new note(s) to the glossary`);
    }

    const { rows: unnamed } = await client.query<{ name_en: string }>(
      `select name_en from public.fragrance_notes where name_ar is null order by name_en`,
    );
    if (unnamed.length > 0) {
      console.log(`  ${unnamed.length} note(s) have no Arabic name: ${unnamed.map((r) => r.name_en).join(", ")}`);
    }

    const backlog = await Promise.all(
      TARGETS.map(async (target) => ({
        target,
        pending: await pendingFor(client, target),
        total: await totalFor(client, target),
      })),
    );

    for (const { target, pending, total } of backlog) {
      console.log(
        `  ${pending.length} of ${total} ${target.plural} need an embedding`,
      );
    }

    const outstanding = backlog.reduce(
      (sum, entry) => sum + entry.pending.length,
      0,
    );

    if (checkOnly) {
      if (outstanding > 0) {
        console.error(`\n${outstanding} row(s) have no vector. Run \`npm run embed\`.`);
        process.exitCode = 1;
      } else if (unnamed.length > 0) {
        console.error(`\nEverything is embedded, but ${unnamed.length} note(s) need an Arabic name in fragrance_notes.`);
        process.exitCode = 1;
      } else {
        console.log("Everything is embedded.");
      }
      return;
    }

    if (outstanding === 0) return;

    if (!hasEmbeddingCredentials()) {
      throw new Error(
        "No AI_GATEWAY_API_KEY. Set it in .env.local (locally) or /srv/khem/shared/.env.production (VPS).",
      );
    }

    for (const { target, pending } of backlog) {
      if (pending.length === 0) continue;
      await embedTarget(client, target, pending);
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
