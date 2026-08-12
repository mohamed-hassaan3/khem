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
  {
    id: "gemstone",
    name: "Gemstone",
    slug: "gemstone",
    description:
      "Mineral light made wearable. Three fragrances cut from the stones the Egyptians buried with their kings — lapis, carnelian, turquoise.",
    bannerUrl:
      "https://images.unsplash.com/photo-1738664926482-1a986adb3e6c?w=900&h=1200&fit=crop&auto=format",
    bannerAlt: "A faceted flacon throwing coloured light across dark stone",
    /*
     * Deliberately not featured. The home preview grid is two columns under the
     * heading "Two Worlds of Scent" — a third card there would leave a ragged
     * row and contradict its own copy. Gemstone surfaces on `/collections`, in
     * the collection tab bar, and in the Nav mega-menu instead.
     */
    isFeatured: false,
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
  {
    id: "isis-rose",
    name: "Isis Rose",
    slug: "isis-rose",
    subtitle: "The eternal feminine",
    description:
      "The eternal feminine — soft, powerful, divine. Rose absolute over neroli and sandalwood.",
    story: null,
    concentration: "EXTRAIT_DE_PARFUM",
    topNotes: ["Rose Absolute"],
    heartNotes: ["Neroli"],
    baseNotes: ["Sandalwood"],
    volumeMl: 100,
    priceInCents: 31000,
    sku: "KHEM-SIG-ISR-100",
    inventory: 21,
    isBestseller: false,
    collectionSlug: "signature",
    images: [
      {
        url: "https://images.unsplash.com/photo-1608721279136-cd41b752fa41?w=600&h=800&fit=crop&auto=format",
        alt: "Isis Rose flacon beside scattered rose petals",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "anubis-ombre",
    name: "Anubis Ombre",
    slug: "anubis-ombre",
    subtitle: "Guardian of the threshold",
    description:
      "Guardian of the threshold between worlds, drawn in dark oud, labdanum, and smoke.",
    story: null,
    concentration: "EXTRAIT_DE_PARFUM",
    topNotes: ["Dark Oud"],
    heartNotes: ["Labdanum"],
    baseNotes: ["Smoke"],
    volumeMl: 100,
    priceInCents: 46000,
    sku: "KHEM-NOI-ANU-100",
    inventory: 6,
    isBestseller: false,
    collectionSlug: "noir",
    images: [
      {
        url: "https://images.unsplash.com/photo-1533603208986-24fd819e718a?w=600&h=800&fit=crop&auto=format",
        alt: "Anubis Ombre flacon standing in near-total darkness",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "lotus-blanc",
    name: "Lotus Blanc",
    slug: "lotus-blanc",
    subtitle: "Sacred purity from dark waters",
    description:
      "Sacred purity emerging from dark waters: white lotus, aquatic musk, and cedar.",
    story: null,
    concentration: "EXTRAIT_DE_PARFUM",
    topNotes: ["White Lotus"],
    heartNotes: ["Aquatic Musk"],
    baseNotes: ["Cedar"],
    volumeMl: 100,
    priceInCents: 27500,
    sku: "KHEM-SIG-LOT-100",
    inventory: 30,
    isBestseller: false,
    collectionSlug: "signature",
    images: [
      {
        url: "https://images.unsplash.com/photo-1607506740211-ff3d6b933dda?w=600&h=800&fit=crop&auto=format",
        alt: "Lotus Blanc flacon reflected in still dark water",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "horus-gold",
    name: "Horus Gold",
    slug: "horus-gold",
    subtitle: "Forged of sunlight and kingship",
    description:
      "A fragrance forged of sunlight and kingship — saffron, a gold accord, and amber resin.",
    story: null,
    concentration: "EXTRAIT_DE_PARFUM",
    topNotes: ["Saffron"],
    heartNotes: ["Gold Accord"],
    baseNotes: ["Amber Resin"],
    volumeMl: 100,
    priceInCents: 34500,
    sku: "KHEM-SIG-HOR-100",
    inventory: 15,
    isBestseller: false,
    collectionSlug: "signature",
    images: [
      {
        url: "https://images.unsplash.com/photo-1640975972263-1f73398e943b?w=600&h=800&fit=crop&auto=format",
        alt: "Horus Gold flacon gilded in raking afternoon light",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "lapis-eternel",
    name: "Lapis Éternel",
    slug: "lapis-eternel",
    subtitle: "The blue of the burial mask",
    description:
      "The blue of the burial mask, rendered in cold iris, violet leaf, and ambergris.",
    story:
      "Lapis lazuli travelled two thousand miles from the mountains of Badakhshan before it reached the workshops of Thebes, where it was ground into the blue of Tutankhamun's mask. Lapis Éternel follows that route in reverse — a cold mineral iris that warms, slowly, into ambergris held against the skin.",
    concentration: "EXTRAIT_DE_PARFUM",
    topNotes: ["Blue Iris"],
    heartNotes: ["Violet Leaf"],
    baseNotes: ["Ambergris"],
    volumeMl: 100,
    priceInCents: 39000,
    sku: "KHEM-GEM-LAP-100",
    inventory: 10,
    isBestseller: false,
    collectionSlug: "gemstone",
    images: [
      {
        url: "https://images.unsplash.com/photo-1709662369957-0cbf9f8452fc?w=600&h=800&fit=crop&auto=format",
        alt: "Lapis Éternel flacon lit from behind in deep blue shadow",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "carnelian-ember",
    name: "Carnelian Ember",
    slug: "carnelian-ember",
    subtitle: "Warm stone, warmer skin",
    description:
      "Warm stone against warmer skin — pink pepper, red amber, and dry cedarwood.",
    story: null,
    concentration: "EXTRAIT_DE_PARFUM",
    topNotes: ["Pink Pepper"],
    heartNotes: ["Red Amber"],
    baseNotes: ["Cedarwood"],
    volumeMl: 100,
    priceInCents: 36000,
    sku: "KHEM-GEM-CAR-100",
    inventory: 14,
    isBestseller: false,
    collectionSlug: "gemstone",
    images: [
      {
        url: "https://images.unsplash.com/photo-1747696766706-5485b39bf358?w=600&h=800&fit=crop&auto=format",
        alt: "Carnelian Ember flacon glowing amber against dark stone",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "turquoise-nefer",
    name: "Turquoise Néfer",
    slug: "turquoise-nefer",
    subtitle: "Mined from the Sinai",
    description:
      "Mined from the Sinai and worn against the sea: neroli, sea salt, and white musk.",
    story: null,
    concentration: "EXTRAIT_DE_PARFUM",
    topNotes: ["Neroli"],
    heartNotes: ["Sea Salt"],
    baseNotes: ["White Musk"],
    volumeMl: 100,
    priceInCents: 34000,
    sku: "KHEM-GEM-TUR-100",
    inventory: 16,
    isBestseller: false,
    collectionSlug: "gemstone",
    images: [
      {
        url: "https://images.unsplash.com/photo-1718728593303-94ec0352cf3d?w=600&h=800&fit=crop&auto=format",
        alt: "Turquoise Néfer flacon against pale mineral green light",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
];

/** The fragrance given the full-bleed feature section on the home page. */
export const FEATURED_PRODUCT_SLUG = "kyphi-noir";
