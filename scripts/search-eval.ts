/**
 * Search evaluation — `npm run search:eval`.
 *
 * Chooses `SIMILARITY_FLOOR` (src/lib/search/config.ts) from evidence rather
 * than a guess. Runs a labelled set of English and Arabic queries through the
 * real `hybrid_search_products()` at several floors and reports, per floor:
 *
 *   - recall@6: the share of answerable queries whose top six contain at least
 *     one expected product;
 *   - noise: how many nonsense queries return anything at all (must be 0).
 *
 * Expected products are derived from the catalogue's own notes (a query about
 * oud expects the products whose notes mention oud), so the labels move with
 * the catalogue instead of going stale. Read-only: SELECTs and the search
 * function, nothing else.
 */

import { embedMany } from "ai";

import {
  EMBEDDING_MODEL,
  QUERY_EMBEDDING_OPTIONS,
  RRF_K,
  LEXICAL_WEIGHT,
  SEMANTIC_WEIGHT,
} from "../src/lib/search/config";
import { hasEmbeddingCredentials, toVectorLiteral } from "../src/lib/search/embed";
import { withClient } from "./db";

interface Case {
  query: string;
  locale: "en" | "ar";
  /** Note words (English, case-insensitive substrings) an expected product carries. */
  notes: string[];
}

const NOTE_CASES: Case[] = [
  { query: "oud", locale: "en", notes: ["oud"] },
  { query: "عود", locale: "ar", notes: ["oud"] },
  { query: "العود", locale: "ar", notes: ["oud"] },
  { query: "amber", locale: "en", notes: ["amber"] },
  { query: "عنبر", locale: "ar", notes: ["amber"] },
  { query: "rose", locale: "en", notes: ["rose"] },
  { query: "ورد", locale: "ar", notes: ["rose"] },
  { query: "jasmine", locale: "en", notes: ["jasmine"] },
  { query: "ياسمين", locale: "ar", notes: ["jasmine"] },
  { query: "incense", locale: "en", notes: ["incense", "frankincense"] },
  { query: "بخور", locale: "ar", notes: ["incense", "frankincense"] },
  { query: "vetiver", locale: "en", notes: ["vetiver"] },
  { query: "musk", locale: "en", notes: ["musk"] },
  { query: "مسك", locale: "ar", notes: ["musk"] },
  { query: "bergamot", locale: "en", notes: ["bergamot"] },
  { query: "iris", locale: "en", notes: ["iris", "orris"] },
  { query: "سوسن", locale: "ar", notes: ["iris", "orris"] },
  { query: "ambre", locale: "en", notes: ["amber"] },
];

const MOOD_CASES: Case[] = [
  { query: "warm smoky evening", locale: "en", notes: ["incense", "smoke", "oud", "amber", "burnt", "labdanum"] },
  { query: "عطر دافئ للمساء", locale: "ar", notes: ["incense", "smoke", "oud", "amber", "burnt", "labdanum"] },
  { query: "fresh summer day", locale: "en", notes: ["bergamot", "neroli", "sea salt", "aquatic", "mandarin", "citrus", "orange"] },
  { query: "منعش ليوم صيفي", locale: "ar", notes: ["bergamot", "neroli", "sea salt", "aquatic", "mandarin", "citrus", "orange"] },
  { query: "soft clean powdery", locale: "en", notes: ["iris", "orris", "white musk", "aldehydes", "violet"] },
  { query: "something green and fresh", locale: "en", notes: ["galbanum", "fig leaf", "green", "violet leaf"] },
  { query: "dark resinous and mysterious", locale: "en", notes: ["benzoin", "myrrh", "labdanum", "incense", "cistus", "resin"] },
  { query: "a warm scent for winter nights", locale: "en", notes: ["amber", "tonka", "benzoin", "cinnamon", "oud"] },
];

const NONSENSE: Case[] = [
  { query: "zzqx", locale: "en", notes: [] },
  { query: "qwrtplk", locale: "en", notes: [] },
  { query: "ققق", locale: "ar", notes: [] },
  { query: "xjv blorp", locale: "en", notes: [] },
];

const FLOORS = [0.16, 0.18, 0.2, 0.22, 0.24, 0.26, 0.28, 0.3];
const TOP = 6;

async function main(): Promise<void> {
  if (!hasEmbeddingCredentials()) throw new Error("No AI_GATEWAY_API_KEY.");

  const cases = [...NOTE_CASES, ...MOOD_CASES, ...NONSENSE];

  await withClient(async (client) => {
    const { rows: products } = await client.query<{ slug: string; notes: string }>(
      `select slug, lower(array_to_string("topNotes" || "heartNotes" || "baseNotes", ' | ')) as notes
         from public."Product" where "isArchived" = false and "deletedAt" is null`,
    );

    const expectedFor = (c: Case): Set<string> =>
      new Set(products.filter((p) => c.notes.some((n) => p.notes.includes(n))).map((p) => p.slug));

    // One batched request for every query (the free tier allows 5 requests a
    // minute), reused across all floors.
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
      values: cases.map((c) => c.query),
      providerOptions: QUERY_EMBEDDING_OPTIONS,
      maxRetries: 0,
    });
    const vectors = new Map<string, string>(
      cases.map((c, i) => [c.query, toVectorLiteral(embeddings[i])]),
    );

    const results: string[] = [];
    console.log(`floor   recall@${TOP} (notes)   recall@${TOP} (moods)   nonsense returning anything`);

    for (const floor of FLOORS) {
      let noteHits = 0;
      let moodHits = 0;
      let noise = 0;
      const misses: string[] = [];

      for (const c of cases) {
        const { rows } = await client.query<{ slug: string }>(
          `select slug from public.hybrid_search_products($1, $2::extensions.vector, $3, $4, $5, $6, $7, $8)`,
          [c.query, vectors.get(c.query), TOP, RRF_K, LEXICAL_WEIGHT, SEMANTIC_WEIGHT, floor, c.locale],
        );
        const got = rows.map((r) => r.slug);

        if (c.notes.length === 0) {
          if (got.length > 0) noise += 1;
          continue;
        }

        const expected = expectedFor(c);
        const hit = got.some((slug) => expected.has(slug));
        if (NOTE_CASES.includes(c)) noteHits += hit ? 1 : 0;
        else moodHits += hit ? 1 : 0;
        if (!hit) misses.push(`${c.query} (${c.locale})`);
      }

      const line =
        `${floor.toFixed(2)}    ${String(noteHits).padStart(2)}/${NOTE_CASES.length}` +
        `                ${String(moodHits).padStart(2)}/${MOOD_CASES.length}` +
        `                   ${noise}/${NONSENSE.length}`;
      console.log(line + (misses.length ? `     misses: ${misses.join(", ")}` : ""));
      results.push(line);
    }
  });
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
