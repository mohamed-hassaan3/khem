/**
 * The lexical half of the engine — literal term matching over the catalog.
 *
 * This is the floor the search never drops below: it needs no API key, no
 * network, and no embeddings, so a visitor typing a product name always gets
 * that product whatever the state of the semantic layer.
 *
 * Semantics are AND across terms, OR across fields: every term must appear
 * somewhere, but they need not appear in the same field. "oud noir" therefore
 * matches a Noir fragrance with oud in its base, and "oud strawberry" matches
 * nothing.
 *
 * → In Postgres this becomes `websearch_to_tsquery` against the weighted
 *   `search_vector` generated column; the weights below are its A/B/C classes.
 */

import { fold } from "./text";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * Field weights. The spread matters more than the absolute values — only the
 * resulting *rank* is carried into the fusion.
 */
const WEIGHT = {
  namePrefix: 100,
  name: 70,
  collection: 40,
  subtitle: 30,
  notes: 25,
  typeOrBadge: 15,
  description: 8,
} as const;

/** A product folded once, so an N-term query does not refold every field. */
interface FoldedProduct {
  name: string;
  subtitle: string;
  collectionName: string;
  notes: string;
  typeOrBadge: string;
  description: string;
}

function foldProduct(product: ProductCardData): FoldedProduct {
  return {
    name: fold(product.name),
    subtitle: fold(product.subtitle ?? ""),
    collectionName: fold(product.collectionName),
    notes: fold(
      [...product.topNotes, ...product.heartNotes, ...product.baseNotes].join(" "),
    ),
    typeOrBadge: fold(
      [product.format ?? "", product.badge ?? "", product.concentration ?? ""].join(" "),
    ),
    description: fold(product.description),
  };
}

/** Weight contributed by a single term, or 0 when it appears nowhere. */
function scoreTerm(fields: FoldedProduct, term: string): number {
  let score = 0;

  if (fields.name.startsWith(term)) score += WEIGHT.namePrefix;
  else if (fields.name.includes(term)) score += WEIGHT.name;

  if (fields.collectionName.includes(term)) score += WEIGHT.collection;
  if (fields.subtitle.includes(term)) score += WEIGHT.subtitle;
  if (fields.notes.includes(term)) score += WEIGHT.notes;
  if (fields.typeOrBadge.includes(term)) score += WEIGHT.typeOrBadge;
  if (fields.description.includes(term)) score += WEIGHT.description;

  return score;
}

/**
 * Rank the catalog lexically. Products matching every term, best first;
 * ties broken by name so the order is identical on every render — a grid that
 * reshuffles between the server and the client render is a hydration bug
 * waiting to happen.
 */
export function rankLexical(
  products: readonly ProductCardData[],
  terms: readonly string[],
): { product: ProductCardData; score: number }[] {
  if (terms.length === 0) return [];

  const scored: { product: ProductCardData; score: number }[] = [];

  for (const product of products) {
    const fields = foldProduct(product);
    let total = 0;

    for (const term of terms) {
      const termScore = scoreTerm(fields, term);
      // AND across terms: one miss disqualifies the product entirely.
      if (termScore === 0) {
        total = 0;
        break;
      }
      total += termScore;
    }

    if (total > 0) scored.push({ product, score: total });
  }

  return scored.sort(
    (a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name),
  );
}
