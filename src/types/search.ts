/**
 * Search types.
 *
 * The suggestion shape is deliberately *narrower* than `ProductCardData`: it is
 * what crosses the network to the overlay panel, so it carries what a suggestion
 * row draws and nothing else. Inventory, SKU, and the note pyramid stay on the
 * server.
 */

import type { ProductPromotion } from "./marketing";
import type {
  CollectionKind,
  Concentration,
  ProductImage,
} from "@/src/types/catalog";

/**
 * Which passes actually contributed to a result set.
 *
 * `"lexical"` means the semantic pass contributed nothing — no gateway
 * credentials, a provider error, a timeout, or a catalog whose vectors have not
 * been written yet. It is recorded for observability and never surfaced to the
 * visitor: a search that quietly works beats one that explains why it is
 * degraded.
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
  /** The list price, always. */
  priceInCents: number;
  /**
   * The running campaign, if any.
   *
   * Carried across the wire so a suggestion row prints the same pair the grid
   * behind it prints. A panel quoting list prices over a catalogue on sale would
   * be the one surface in the site disagreeing with every other.
   */
  promotion: ProductPromotion | null;
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
