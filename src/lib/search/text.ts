/**
 * Query normalization and the document builder both halves of the engine share.
 *
 * Nothing here reaches the network or the catalog — it is pure string work, so
 * the offline embedding script, the route handler, and the Server Components can
 * all import it.
 */

import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, SEARCH_PARAM } from "./config";
import type { Product } from "@/src/types/catalog";

/**
 * Case- and diacritic-insensitive comparison form.
 *
 * Applied to *both* sides of every comparison — "Ambré" must be found by
 * "ambre", which is what anyone without a French keyboard will type. Arabic
 * harakat fold away by the same rule, though the catalog itself is English (see
 * the note on `productEmbeddingSource`).
 */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Trim, collapse internal whitespace, and cap the length.
 *
 * The cap is a security boundary, not a nicety: this string is sent to a
 * third-party embedding provider, and an uncapped one turns the search endpoint
 * into a free embedding API.
 */
export function normalizeQuery(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

/** True once a query is an intent rather than a keystroke. */
export function isSearchable(query: string): boolean {
  return query.length >= MIN_QUERY_LENGTH;
}

/** The folded, non-empty terms of a query. */
export function queryTerms(query: string): string[] {
  return fold(query).split(" ").filter(Boolean);
}

/**
 * A linkable search, as a locale-agnostic app path — `<LocaleLink>` and
 * `localizePath()` add the prefix.
 */
export function searchHref(query: string): string {
  return `/search?${SEARCH_PARAM}=${encodeURIComponent(normalizeQuery(query))}`;
}

/**
 * The text that gets embedded for a product. **This function is the contract.**
 *
 * The offline script embeds exactly this string, and the query vector is only
 * comparable to vectors built from documents of this shape. When the catalog
 * moves to Postgres, this same string becomes a generated column (or a trigger)
 * so the stored vectors keep describing the same document — see
 * `supabase/sql/product-search.sql`.
 *
 * Changing what goes in here without re-running `npm run embed` and bumping
 * `EMBEDDING_VERSION` leaves stored vectors describing text that no longer
 * exists. `npm run embed -- --check` is the guard against exactly that.
 *
 * The document is deliberately prose-shaped rather than a field dump: embedding
 * models are trained on natural language, and "Top notes: bergamot, pink
 * pepper" retrieves better than a bare comma list. It is English-only because
 * the catalog is — the Arabic UI searches the same English documents, which is
 * why the Arabic popular-search chips carry an English `term`.
 */
export function productEmbeddingSource(
  product: Product,
  collectionName: string,
): string {
  const lines: string[] = [];

  lines.push(
    product.subtitle ? `${product.name}. ${product.subtitle}.` : `${product.name}.`,
  );

  const type = product.format ?? product.concentration?.replace(/_/g, " ").toLowerCase();
  lines.push(
    type
      ? `From the ${collectionName} collection. ${type}, ${product.volumeMl} ml.`
      : `From the ${collectionName} collection. ${product.volumeMl} ml.`,
  );

  if (product.topNotes.length > 0) {
    lines.push(`Top notes: ${product.topNotes.join(", ")}.`);
  }
  if (product.heartNotes.length > 0) {
    lines.push(`Heart notes: ${product.heartNotes.join(", ")}.`);
  }
  if (product.baseNotes.length > 0) {
    lines.push(`Base notes: ${product.baseNotes.join(", ")}.`);
  }
  if (product.includes.length > 0) {
    lines.push(`Includes: ${product.includes.join(", ")}.`);
  }
  if (product.badge) lines.push(`${product.badge}.`);
  if (product.tags.length > 0) {
    lines.push(`${product.tags.map((tag) => tag.replace(/_/g, " ").toLowerCase()).join(", ")}.`);
  }

  lines.push(product.description);
  if (product.story) lines.push(product.story);

  return lines.join(" ");
}
