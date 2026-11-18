/**
 * Search tracking — one anonymous row per committed search.
 *
 * SERVER ONLY. Called from `src/app/[locale]/search/page.tsx` inside `after()`,
 * so it runs once the results have been sent and can never slow a search down
 * or break it. Every failure is a warning, never an exception.
 *
 * What is stored, and nothing else: the query, its folded grouping key, the
 * page locale, how many products came back (≤ 48), the search mode, and the
 * time. See `supabase/sql/0074_search_events.sql` and
 * `prompts/search-tracking.md`.
 */

import "server-only";

import { z } from "zod";

import { LOCALES } from "@/src/lib/i18n/config";
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, RESULTS_LIMIT } from "@/src/lib/search/config";
import { looksPersonal } from "@/src/lib/search/privacy";
import { fold } from "@/src/lib/search/text";
import { getSupabaseAdmin } from "@/src/lib/supabase";

const searchEventSchema = z.object({
  query: z.string().min(MIN_QUERY_LENGTH).max(MAX_QUERY_LENGTH),
  locale: z.enum(LOCALES),
  resultCount: z.number().int().min(0),
  mode: z.enum(["hybrid", "lexical"]),
});

export type SearchEventInput = z.infer<typeof searchEventSchema>;

export async function recordSearch(input: SearchEventInput): Promise<void> {
  const parsed = searchEventSchema.safeParse(input);
  if (!parsed.success) return;

  const { query, locale, resultCount, mode } = parsed.data;

  // Personal-looking queries are not recorded at all.
  if (looksPersonal(query)) return;

  const queryKey = fold(query).trim();
  if (queryKey.length === 0) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    const { error } = await supabase.from("search_events").insert({
      query,
      query_key: queryKey.slice(0, MAX_QUERY_LENGTH),
      locale,
      result_count: Math.min(resultCount, RESULTS_LIMIT),
      mode,
    });

    // The message only — never the query, which is visitor-typed text.
    if (error) console.warn(`[search-log] insert failed: ${error.message}`);
  } catch (cause) {
    console.warn(
      `[search-log] insert failed: ${cause instanceof Error ? cause.message : "unknown error"}`,
    );
  }
}
