/**
 * Search types.
 *
 * The suggestion shape is deliberately *narrower* than `ProductCardData`: it is
 * what crosses the network to the overlay panel, so it carries what a suggestion
 * row draws and nothing else. Inventory, SKU, and the note pyramid stay on the
 * server.
 */

import type {
  CollectionKind,
  Concentration,
  ProductImage,
} from "@/src/types/catalog";

/**
 * Which passes actually contributed to a result set.
 *
 * `"lexical"` means the semantic pass was unavailable — no API key, no
 * embedding index, a provider error, or a timeout. It is recorded for
 * observability and never surfaced to the visitor: a search that quietly works
 * beats one that explains why it is degraded.
 */
export type SearchMode = "hybrid" | "lexical";

/** One product row in the overlay panel. */
export interface ProductSuggestion {
  id: string;
  name: string;
  /** Ready-to-use app path from `productHref()` — the client never routes. */
  href: string;
  collectionName: string;
  collectionKind: CollectionKind;
  /*
   * The format line is *not* resolved here. A fragrance prints its
   * concentration in translated dictionary copy while everything else prints a
   * stored English `format` string, so the pair crosses the wire and
   * `formatProductType()` resolves it in the panel, which holds the dictionary.
   */
  concentration: Concentration | null;
  format: string | null;
  priceInCents: number;
  image: ProductImage;
}

/** One collection row in the overlay panel. */
export interface CollectionSuggestion {
  id: string;
  name: string;
  href: string;
  description: string;
}

/** The `/api/search` payload. */
export interface SearchSuggestionsPayload {
  products: ProductSuggestion[];
  collections: CollectionSuggestion[];
  mode: SearchMode;
}

/** One catalog vector as stored in `src/data/embeddings.generated.json`. */
export interface EmbeddingEntry {
  /** SHA-256 of the document that produced this vector — the staleness guard. */
  sourceHash: string;
  vector: number[];
}

/**
 * The generated embedding index.
 *
 * `model`, `dimensions`, and `version` are checked against `search/config.ts`
 * before a single similarity is computed: a query vector is only comparable to
 * vectors produced by the same model from the same kind of document.
 */
export interface EmbeddingIndex {
  model: string;
  dimensions: number;
  version: number;
  generatedAt: string;
  items: Record<string, EmbeddingEntry>;
}
