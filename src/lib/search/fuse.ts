/**
 * Reciprocal Rank Fusion.
 *
 * The lexical pass produces scores in the hundreds; the semantic pass produces
 * cosine similarities between 0 and 1. Normalising those onto a common scale
 * means inventing a conversion nobody can defend, and it drifts the moment a
 * field weight changes. RRF sidesteps it by discarding the magnitudes and fusing
 * the *ranks*:
 *
 *     score(d) = Σ over rankings  weight / (K + rank(d))
 *
 * A document ranked highly by both passes beats one ranked highly by either, and
 * `K` (60, from the original paper and Supabase's hybrid-search guide) damps the
 * long tail so position 40 versus 41 barely matters.
 *
 * Pure, dependency-free, and deliberately the same algorithm the Postgres
 * `hybrid_search_products()` function runs — relevance should not visibly change
 * on migration day.
 */

import { RRF_K } from "./config";

export interface RankedList {
  /** Relative pull of this ranking in the fusion. */
  weight: number;
  /** Ids, best first. Position in this array *is* the rank. */
  ids: readonly string[];
}

/**
 * Fuse any number of rankings into one, best first.
 *
 * Ties break on id so the output is stable across renders and across processes
 * — two servers must not disagree about result order.
 */
export function reciprocalRankFusion(
  lists: readonly RankedList[],
): { id: string; score: number }[] {
  const scores = new Map<string, number>();

  for (const list of lists) {
    list.ids.forEach((id, index) => {
      // Rank is 1-based: the top result must not divide by K alone.
      const contribution = list.weight / (RRF_K + index + 1);
      scores.set(id, (scores.get(id) ?? 0) + contribution);
    });
  }

  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
