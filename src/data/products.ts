/**
 * Local seed data for the catalog.
 *
 * This module is the ONLY place holding hardcoded catalog records. It is shaped
 * exactly like the future `Collection` / `Product` / `ProductImage` rows, so the
 * Supabase migration is: seed these values into Postgres, then delete this file
 * and repoint `src/services/products.ts`. Nothing else changes.
 *
 * NOTE ON NOTE PYRAMIDS: the original design listed three notes per fragrance
 * without saying which tier each belonged to. They are assigned top → heart →
 * base in their original display order to preserve the existing UI exactly.
 * Replace with the perfumer's real pyramid before launch.
 */

import type { Collection, Product } from "@/src/types/catalog";

export const COLLECTIONS: Collection[] = [
  {
    id: "signature",
    name: "Signature",
    slug: "signature",
    description:
      "Timeless expressions of Egyptian heritage. Fragrances that carry the warmth of temples and the spirit of sacred rituals.",
    bannerUrl:
      "https://images.unsplash.com/photo-1676950933747-5f886cadf014?w=900&h=1200&fit=crop&auto=format",
    bannerAlt:
      "A golden flacon lit from the side against a warm obsidian backdrop",
    isFeatured: true,
  },
  {
    id: "noir",
    name: "Noir",
    slug: "noir",
    description:
      "A darker, more exclusive chapter. Limited editions borne from obsidian, shadow, and the mysteries of the underworld.",
    bannerUrl:
      "https://images.unsplash.com/photo-1778058505814-6d247ccb600c?w=900&h=1200&fit=crop&auto=format",
    bannerAlt: "A black glass perfume bottle half-consumed by shadow",
    isFeatured: true,
  },
];

export const PRODUCTS: Product[] = [
  {
    id: "kyphi-noir",
    name: "Kyphi Noir",
    slug: "kyphi-noir",
    subtitle: "Sacred temple incense reimagined",
    description:
      "Sacred temple incense reimagined for the modern wearer, built on smoke, resin, and warmth.",
    story:
      "Inspired by the sacred temple incense of Ancient Egypt, Kyphi Noir opens with a veil of smoky frankincense before surrendering to black oud and ancient amber resin.",
    concentration: "EXTRAIT_DE_PARFUM",
    topNotes: ["Frankincense"],
    heartNotes: ["Black Oud"],
    baseNotes: ["Amber"],
    volumeMl: 100,
    priceInCents: 29500,
    sku: "KHEM-SIG-KYN-100",
    inventory: 24,
    isBestseller: true,
    collectionSlug: "signature",
    images: [
      {
        url: "https://images.unsplash.com/photo-1676950933747-5f886cadf014?w=600&h=800&fit=crop&auto=format",
        alt: "Kyphi Noir extrait de parfum flacon in warm amber light",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1738664926458-d8ca7f56549f?w=1800&h=900&fit=crop&auto=format",
        alt: "Kyphi Noir photographed against drifting temple incense smoke",
        isPrimary: false,
        sortOrder: 1,
      },
    ],
  },
  {
    id: "ra-soleil",
    name: "Rā Soleil",
    slug: "ra-soleil",
    subtitle: "The golden radiance of dawn",
    description:
      "The golden radiance of dawn captured in solar musk, saffron, and white amber.",
    story: null,
    concentration: "EXTRAIT_DE_PARFUM",
    topNotes: ["Solar Musk"],
    heartNotes: ["Saffron"],
    baseNotes: ["White Amber"],
    volumeMl: 100,
    priceInCents: 32000,
    sku: "KHEM-SIG-RAS-100",
    inventory: 18,
    isBestseller: true,
    collectionSlug: "signature",
    images: [
      {
        url: "https://images.unsplash.com/photo-1760860992203-85ca32536788?w=600&h=800&fit=crop&auto=format",
        alt: "Rā Soleil flacon catching gold light at dawn",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "nile-absolue",
    name: "Nile Absolue",
    slug: "nile-absolue",
    subtitle: "The river of eternal mysteries",
    description:
      "The river of eternal mysteries, drawn in papyrus, vetiver, and dark musk.",
    story: null,
    concentration: "EXTRAIT_DE_PARFUM",
    topNotes: ["Papyrus"],
    heartNotes: ["Vetiver"],
    baseNotes: ["Dark Musk"],
    volumeMl: 100,
    priceInCents: 38000,
    sku: "KHEM-NOI-NIL-100",
    inventory: 12,
    isBestseller: true,
    collectionSlug: "noir",
    images: [
      {
        url: "https://images.unsplash.com/photo-1778058505814-6d247ccb600c?w=600&h=800&fit=crop&auto=format",
        alt: "Nile Absolue flacon submerged in deep green shadow",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "obsidian-elixir",
    name: "Obsidian Elixir",
    slug: "obsidian-elixir",
    subtitle: "Volcanic stone turned liquid shadow",
    description:
      "Volcanic stone turned liquid shadow: black iris, patchouli, and burnt wood.",
    story: null,
    concentration: "EXTRAIT_DE_PARFUM",
    topNotes: ["Black Iris"],
    heartNotes: ["Patchouli"],
    baseNotes: ["Burnt Wood"],
    volumeMl: 100,
    priceInCents: 42000,
    sku: "KHEM-NOI-OBS-100",
    inventory: 8,
    isBestseller: true,
    collectionSlug: "noir",
    images: [
      {
        url: "https://images.unsplash.com/photo-1643797517714-a273548abc3c?w=600&h=800&fit=crop&auto=format",
        alt: "Obsidian Elixir flacon cut from black volcanic glass",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
];

/** The fragrance given the full-bleed feature section on the home page. */
export const FEATURED_PRODUCT_SLUG = "kyphi-noir";
