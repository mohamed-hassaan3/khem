/**
 * Local seed data for the catalog.
 *
 * This module is the ONLY place holding hardcoded catalog records. It is shaped
 * exactly like the future `Collection` / `Product` / `ProductImage` rows, so the
 * Supabase migration is: seed these values into Postgres, then delete this file
 * and repoint `src/services/products.ts`. Nothing else changes.
 *
 * NOTE ON NOTE PYRAMIDS: each fragrance carries three notes per tier, and the
 * first note of every tier is the one the card grids display. That ordering is
 * load-bearing — `ProductCard` renders `topNotes[0]`, `heartNotes[0]`, and
 * `baseNotes[0]`, so reordering a tier changes what every listing page shows.
 * These are still placeholder pyramids; replace them with the perfumer's real
 * formulas before launch, keeping the signature note first in each tier.
 *
 * NOTE ON IMAGERY: every URL below is an Unsplash photo already vetted for this
 * project, and `images.unsplash.com` is the only remote host allowed by
 * `next.config.ts`. Invent a photo slug and `next/image` returns a 404.
 *
 * NOTE ON NON-FRAGRANCE GOODS: body care, home fragrance, and discovery sets
 * are `Product` rows like any other, distinguished by their collection's
 * `kind`. Two fields differ for them: `concentration` is `null` (a room spray
 * has no *eau de parfum* strength) and `format` carries the display line
 * instead, and their note tiers are empty because they have no pyramid to
 * show. `volumeMl` stays honest — a set of six 3 ML vials is 18.
 */

import type { Collection, Product } from "@/src/types/catalog";

/**
 * BOTTLE FORMAT IS A PROPERTY OF THE COLLECTION, NOT OF THE PRODUCT.
 *
 *   Signature → 100 ML     Noir → 100 ML     Gemstone → 50 ML
 *
 * Every fragrance in a collection ships in that collection's bottle, at one
 * price, under one SKU — which is exactly what `Product` stores. A new
 * collection declares its format here, and its products follow.
 */
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
    kind: "FRAGRANCE",
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
    kind: "FRAGRANCE",
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
    kind: "FRAGRANCE",
  },

  /*
   * ── NON-FRAGRANCE COLLECTIONS ──────────────────────────────────────────
   *
   * Body care, home fragrance, and discovery sets live in this same catalog
   * rather than in a parallel "merch" module, because the cart and the
   * wishlist persist a product id and resolve it against one projection: an
   * id that is not in `PRODUCTS` silently vanishes from the bag. `kind` is
   * what keeps them out of the fragrance surfaces — see
   * `getProductCardsByKind()` in `src/services/products.ts`.
   */
  {
    id: "body-care",
    name: "Body Care",
    slug: "body-care",
    description:
      "Ancient Egyptians understood that beauty was ritual. Our body care range extends the KHEM fragrance experience beyond the flacon — layering scent into the very fabric of the skin.",
    bannerUrl:
      "https://images.unsplash.com/photo-1779524477261-12141ccbd8d9?w=1800&h=900&fit=crop&auto=format",
    bannerAlt:
      "Oiled skin catching low warm light against a dark bathing chamber",
    isFeatured: false,
    kind: "BODY",
  },
  {
    id: "room-fragrance",
    name: "Home Fragrance",
    slug: "room-fragrance",
    description:
      "In Ancient Egypt, a scented space was a sacred space. Our home fragrance range extends the KHEM world into your interiors — transforming rooms into temples of olfactory experience.",
    bannerUrl:
      "https://images.unsplash.com/photo-1609599176235-f93af914fde0?w=1800&h=900&fit=crop&auto=format",
    bannerAlt: "A dim interior lit by a single flame, smoke rising slowly",
    isFeatured: false,
    kind: "HOME",
  },
  {
    id: "discovery",
    name: "Discovery Sets",
    slug: "discovery",
    description:
      "Every journey into KHEM should begin with discovery. Our curated sets allow you to explore the full range of our olfactory world before committing to a full-size flacon.",
    bannerUrl:
      "https://images.unsplash.com/photo-1674620213535-9b2a2553ef40?w=1800&h=900&fit=crop&auto=format",
    bannerAlt: "A row of small sample vials laid out on dark lacquered wood",
    isFeatured: false,
    kind: "DISCOVERY",
  },
  {
    id: "gift-set",
    name: "Gift Sets",
    slug: "gift-set",
    description:
      "The house presented as an offering. Full-size flacons, ritual objects, and hand-finished presentation — composed for the moment a fragrance is given rather than chosen.",
    bannerUrl:
      "https://images.unsplash.com/photo-1762530211537-011645caef57?w=1800&h=900&fit=crop&auto=format",
    bannerAlt:
      "Ancient Egyptian vessels used for blending sacred oils, arranged for presentation",
    isFeatured: false,
    /*
     * A kind of its own rather than a second `DISCOVERY` collection: a gift set
     * holds full-size flacons and ritual objects, not sample vials, and it must
     * link to `/gift-set` rather than to `/discovery`. `productHref()` in
     * `src/lib/routes.ts` is what enforces that.
     */
    kind: "GIFT",
  },
];

export const PRODUCTS: Product[] = [
  /*
   * ── NEW ARRIVALS ───────────────────────────────────────────────────────
   *
   * Ordinary catalog rows carrying the `NEW_ARRIVAL` tag — which is what puts
   * them on `/new-arrival`, in the new-arrivals facet on `/collections`, and on
   * a `/perfume/[slug]` detail page of their own, with no route knowing they
   * are new. They lead this array because the default "Featured" sort is
   * insertion order.
   */
  {
    id: "sekhem-ambre",
    name: "Sekhem Ambré",
    slug: "sekhem-ambre",
    subtitle: "The season's first light on resin",
    description:
      "Golden amber lifted by saffron and immortelle, closing on labdanum and Haitian vetiver.",
    story:
      "Sekhem is the word the Egyptians used for the vital force that animates a body — not the soul, but the power that moves it. The temple perfumers built their resin blends to carry it: amber warmed on a brazier until the room itself felt awake.\n\nSekhem Ambré opens bright and dry, pink pepper over mandarin leaf, before the resins arrive. Immortelle and saffron hold the middle with an almost honeyed weight, and labdanum, tonka, and Haitian vetiver take it down into skin. It is the warmest fragrance the house has released, and the first composed entirely in the new Cairo atelier.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: "New",
    tags: ["NEW_ARRIVAL"],
    topNotes: ["Golden Amber", "Pink Pepper", "Mandarin Leaf"],
    heartNotes: ["Immortelle", "Saffron", "Orris Butter"],
    baseNotes: ["Labdanum", "Tonka Bean", "Haitian Vetiver"],
    volumeMl: 100,
    priceInCents: 32500,
    sku: "KHEM-SIG-SEK-100",
    inventory: 18,
    isBestseller: false,
    collectionSlug: "signature",
    images: [
      {
        url: "https://images.unsplash.com/photo-1709662217788-6a8a1b31562a?w=600&h=800&fit=crop&auto=format",
        alt: "Sekhem Ambré being filled by hand and fitted with its onyx stopper",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1667070796007-185faecdf8a1?w=900&h=1100&fit=crop&auto=format",
        alt: "Carved hieroglyphs lit by low raking light behind the flacon",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1613549026666-73c9c9083c62?w=900&h=1100&fit=crop&auto=format",
        alt: "Vetiver roots drying before distillation, the raw material of the base",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "duat-obscura",
    name: "Duat Obscura",
    slug: "duat-obscura",
    subtitle: "The hour before the sun returns",
    description:
      "Night iris and cold oud over leather and ash — the darkest composition in the Noir chapter.",
    story:
      "The Duat is the Egyptian underworld, and the texts describe it as a night river the sun must travel before it can rise again. Twelve hours, each with its own gate. The perfumers of the period burned resin at every one of them.\n\nDuat Obscura is built on that passage. Cold bergamot and elemi give way almost immediately to night iris and a smoked Laotian oud; leather, ash, and grey ambrette hold the drydown for the better part of a day. Released in a single numbered run of 300 flacons, hand-sealed in black wax.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: "New · Limited",
    tags: ["NEW_ARRIVAL", "LIMITED_EDITION"],
    topNotes: ["Night Iris", "Cold Bergamot", "Elemi"],
    heartNotes: ["Smoked Oud", "Black Leather", "Cypriol"],
    baseNotes: ["Ash Wood", "Grey Ambrette", "Vetiver Noir"],
    volumeMl: 100,
    priceInCents: 45000,
    sku: "KHEM-NOI-DUA-100",
    inventory: 6,
    isBestseller: false,
    collectionSlug: "noir",
    images: [
      /*
       * NOT `photo-1778058505814` — the id the Noir collection banner uses.
       * At banner crop it reads as an anonymous black flacon, but at a product
       * crop the photograph is plainly a branded competitor bottle. Flagged
       * for the same reason on the banner itself.
       */
      {
        url: "https://images.unsplash.com/photo-1533603208986-24fd819e718a?w=600&h=800&fit=crop&auto=format",
        alt: "The Duat Obscura flacon on a black reflective surface, lit from one side",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1738664926458-d8ca7f56549f?w=900&h=1100&fit=crop&auto=format",
        alt: "Dark stone veined with mineral light",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1654612514062-7cc235e7b68c?w=900&h=1100&fit=crop&auto=format",
        alt: "Carved hieroglyphs receding into low brown light",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },
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
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Frankincense", "Smoked Incense", "Black Pepper"],
    heartNotes: ["Black Oud", "Labdanum", "Dark Rose"],
    baseNotes: ["Amber", "Myrrh", "Sandalwood"],
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
        url: "https://images.unsplash.com/photo-1738664926458-d8ca7f56549f?w=900&h=1100&fit=crop&auto=format",
        alt: "Kyphi Noir photographed against drifting temple incense smoke",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1643797517714-a273548abc3c?w=900&h=1100&fit=crop&auto=format",
        alt: "The stopper of Kyphi Noir resting on unpolished black stone",
        isPrimary: false,
        sortOrder: 2,
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
    story:
      "Rā crossed the sky each day in a solar barque, and the Egyptians measured their hours by the light he carried. Rā Soleil is that light held still: an opening of solar musk and bergamot so bright it reads almost white.\n\nBeneath it, saffron and neroli warm the composition the way a stone wall warms through a morning. What remains on the skin hours later is white amber and vanilla absolue — not the dawn itself, but the memory of standing in it.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Solar Musk", "Bergamot", "Aldehydes"],
    heartNotes: ["Saffron", "Neroli", "Jasmine Sambac"],
    baseNotes: ["White Amber", "Sandalwood", "Vanilla Absolue"],
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
      {
        url: "https://images.unsplash.com/photo-1640975972263-1f73398e943b?w=900&h=1100&fit=crop&auto=format",
        alt: "Rā Soleil gilded shoulder throwing a long morning shadow",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1676950933747-5f886cadf014?w=900&h=1100&fit=crop&auto=format",
        alt: "Rā Soleil photographed against a warm ochre backdrop",
        isPrimary: false,
        sortOrder: 2,
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
    story:
      "The Nile is not scenery. It is the reason there was anything to build, and every civilisation that rose on its banks organised itself around a flood it could predict but never control.\n\nNile Absolue opens green and wet — papyrus, an aquatic accord, a bruised violet leaf — before Haitian vetiver pulls the composition down into silt and root. The drydown is dark musk and driftwood: the river at night, moving past you in the dark.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: ["LIMITED_EDITION"],
    topNotes: ["Papyrus", "Aquatic Accord", "Violet Leaf"],
    heartNotes: ["Vetiver", "Lotus Flower", "Iris"],
    baseNotes: ["Dark Musk", "Driftwood", "Ambergris"],
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
      {
        url: "https://images.unsplash.com/photo-1718728593303-94ec0352cf3d?w=900&h=1100&fit=crop&auto=format",
        alt: "Nile Absolue against pale water light, the glass beaded with damp",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1607506740211-ff3d6b933dda?w=900&h=1100&fit=crop&auto=format",
        alt: "Nile Absolue beside dried papyrus reed on wet stone",
        isPrimary: false,
        sortOrder: 2,
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
    story:
      "Obsidian is volcanic glass, and the Egyptians cut it into ritual blades and mirrors — surfaces dark enough to show you something other than your own face. Its blackness was understood as a doorway rather than an absence.\n\nObsidian Elixir does not soften. Black iris and incense smoke open cold and mineral; a decade-aged patchouli holds the centre; carbonised wood and benzoin close it. It is a fragrance for people who have noticed that the most expensive things in a room are usually the quietest.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: ["LIMITED_EDITION"],
    topNotes: ["Black Iris", "Incense Smoke", "Bergamot"],
    heartNotes: ["Patchouli", "Dark Rose", "Cistus"],
    baseNotes: ["Burnt Wood", "Benzoin", "Dark Musk"],
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
      {
        url: "https://images.unsplash.com/photo-1533603208986-24fd819e718a?w=900&h=1100&fit=crop&auto=format",
        alt: "Obsidian Elixir almost lost in an unlit room, one edge catching light",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1738664926458-d8ca7f56549f?w=900&h=1100&fit=crop&auto=format",
        alt: "Smoke curling across the shoulder of the Obsidian Elixir bottle",
        isPrimary: false,
        sortOrder: 2,
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
    story:
      "Isis gathered the scattered body of her husband and reassembled it. She is not the goddess of softness; she is the goddess of putting things back together, which is a harder and less decorative kind of power.\n\nIsis Rose is built on a Turkish rose absolute deep enough to carry that reading — never candied, never girlish. Pink pepper sharpens the opening, orris lends the powdered weight of temple linen, and sandalwood and benzoin keep the whole composition standing upright long after the flowers have gone quiet.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Rose Absolute", "Pink Pepper", "Bergamot"],
    heartNotes: ["Neroli", "Jasmine", "Orris"],
    baseNotes: ["Sandalwood", "White Musk", "Benzoin"],
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
      {
        url: "https://images.unsplash.com/photo-1676950933747-5f886cadf014?w=900&h=1100&fit=crop&auto=format",
        alt: "Isis Rose lit warmly from one side against deep shadow",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1747696766706-5485b39bf358?w=900&h=1100&fit=crop&auto=format",
        alt: "The rose-toned glass of Isis Rose photographed close",
        isPrimary: false,
        sortOrder: 2,
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
    story:
      "Anubis weighed the heart against a feather. He did not judge; he measured, and the measurement was final. He belongs to thresholds — the moment between one state and the next.\n\nAnubis Ombre is the darkest fragrance KHEM makes. Dark oud and black pepper open it with almost no sweetness at all; labdanum and a leather accord give the heart the smell of a worn ritual object; vetiver, smoke, and tonka close it slowly. Worn well, it is felt in a room before it is identified.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: ["LIMITED_EDITION"],
    topNotes: ["Dark Oud", "Black Pepper", "Saffron"],
    heartNotes: ["Labdanum", "Leather", "Dark Rose"],
    baseNotes: ["Smoke", "Vetiver", "Tonka Bean"],
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
      {
        url: "https://images.unsplash.com/photo-1778058505814-6d247ccb600c?w=900&h=1100&fit=crop&auto=format",
        alt: "Anubis Ombre half-consumed by shadow, its label barely legible",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1643797517714-a273548abc3c?w=900&h=1100&fit=crop&auto=format",
        alt: "The black glass of Anubis Ombre against unpolished stone",
        isPrimary: false,
        sortOrder: 2,
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
    story:
      "The blue lotus closes at dusk, sinks beneath the surface, and opens again at dawn. Egypt read that daily disappearance and return as the plainest available proof of rebirth, and carved it into everything.\n\nLotus Blanc keeps the water in the composition. A green, faintly bitter opening gives way to water lily and an aquatic musk that never tips into soap, and cedar and ambrette dry it out at the end. Clean, but not innocent — there is dark water under it throughout.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["White Lotus", "Bergamot", "Green Accord"],
    heartNotes: ["Aquatic Musk", "Water Lily", "Jasmine"],
    baseNotes: ["Cedar", "White Musk", "Ambrette"],
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
      {
        url: "https://images.unsplash.com/photo-1718728593303-94ec0352cf3d?w=900&h=1100&fit=crop&auto=format",
        alt: "Lotus Blanc in pale green light, the glass beaded with water",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1760860992203-85ca32536788?w=900&h=1100&fit=crop&auto=format",
        alt: "Lotus Blanc catching first light across a still surface",
        isPrimary: false,
        sortOrder: 2,
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
    story:
      "Every living pharaoh was Horus. Not a descendant, not a representative — the god himself, wearing a body, holding an office. Gold was the metal of that claim, because gold does not tarnish and neither, in theory, does a dynasty.\n\nHorus Gold opens on saffron and cardamom, warm and slightly medicinal, before a gold accord — jasmine sambac, orris, a metallic brightness — takes the centre. Amber resin, sandalwood, and tonka carry it into a long, unhurried drydown. It is a fragrance that assumes it will be listened to.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Saffron", "Bergamot", "Cardamom"],
    heartNotes: ["Gold Accord", "Jasmine Sambac", "Orris"],
    baseNotes: ["Amber Resin", "Sandalwood", "Tonka Bean"],
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
      {
        url: "https://images.unsplash.com/photo-1676950933747-5f886cadf014?w=900&h=1100&fit=crop&auto=format",
        alt: "Horus Gold against a warm obsidian backdrop, its shoulder alight",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1738664926482-1a986adb3e6c?w=900&h=1100&fit=crop&auto=format",
        alt: "Gilt detail on the Horus Gold stopper, photographed close",
        isPrimary: false,
        sortOrder: 2,
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
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Blue Iris", "Bergamot", "Juniper"],
    heartNotes: ["Violet Leaf", "Orris", "Jasmine"],
    baseNotes: ["Ambergris", "Cashmere Wood", "White Musk"],
    volumeMl: 50,
    priceInCents: 39000,
    sku: "KHEM-GEM-LAP-050",
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
      {
        url: "https://images.unsplash.com/photo-1738664926482-1a986adb3e6c?w=900&h=1100&fit=crop&auto=format",
        alt: "Lapis Éternel throwing faceted blue light across dark stone",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1718728593303-94ec0352cf3d?w=900&h=1100&fit=crop&auto=format",
        alt: "The cold mineral glass of Lapis Éternel photographed close",
        isPrimary: false,
        sortOrder: 2,
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
    story:
      "Carnelian was worn against the body — set into pectorals, cut into amulets, laid over the heart of the dead. It is a stone that reads as warm even in shade, which is why it was trusted next to skin.\n\nCarnelian Ember behaves the same way. Pink pepper and blood orange flare at the opening; cinnamon and immortelle give the heart a dry, resinous sweetness; red amber and cedarwood hold the base close rather than projecting it. It smells less like a fragrance worn than like a temperature.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Pink Pepper", "Blood Orange", "Cinnamon"],
    heartNotes: ["Red Amber", "Rose", "Immortelle"],
    baseNotes: ["Cedarwood", "Benzoin", "Tonka Bean"],
    volumeMl: 50,
    priceInCents: 36000,
    sku: "KHEM-GEM-CAR-050",
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
      {
        url: "https://images.unsplash.com/photo-1640975972263-1f73398e943b?w=900&h=1100&fit=crop&auto=format",
        alt: "Carnelian Ember catching low red light along one edge",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1738664926482-1a986adb3e6c?w=900&h=1100&fit=crop&auto=format",
        alt: "Faceted warm light thrown from the Carnelian Ember bottle",
        isPrimary: false,
        sortOrder: 2,
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
    story:
      "The turquoise mines of Serabit el-Khadim sit in the Sinai desert, hours from any water, and the stone they gave up is the exact colour of a sea none of those miners could see from where they worked.\n\nTurquoise Néfer is built on that contradiction. Neroli and green mandarin open it bright and dry; a sea-salt accord and orange blossom bring the water in without ever turning it aquatic; white musk, driftwood, and ambrette leave the skin smelling faintly of salt hours later.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Neroli", "Bergamot", "Green Mandarin"],
    heartNotes: ["Sea Salt", "Orange Blossom", "Jasmine"],
    baseNotes: ["White Musk", "Driftwood", "Ambrette"],
    volumeMl: 50,
    priceInCents: 34000,
    sku: "KHEM-GEM-TUR-050",
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
      {
        url: "https://images.unsplash.com/photo-1709662369957-0cbf9f8452fc?w=900&h=1100&fit=crop&auto=format",
        alt: "Turquoise Néfer lit from behind, the glass reading almost sea-blue",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1607506740211-ff3d6b933dda?w=900&h=1100&fit=crop&auto=format",
        alt: "Turquoise Néfer resting on wet stone under flat daylight",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },

  /* ── BODY CARE ─────────────────────────────────────────────────────────── */
  {
    id: "kyphi-body-mist",
    name: "Kyphi Body Mist",
    slug: "kyphi-body-mist",
    subtitle: "Rich · Absorbing · Sacred",
    description:
      "A dry oil infused with the olfactory signature of Kyphi Noir. Frankincense-enriched jojoba and squalane absorb instantly, leaving skin luminous and lightly scented for hours.",
    story: null,
    concentration: null,
    format: "Dry Body Oil",
    includes: [],
    badge: null,
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 100,
    priceInCents: 14500,
    sku: "KHEM-BOD-KYP-100",
    inventory: 20,
    isBestseller: false,
    collectionSlug: "body-care",
    images: [
      {
        url: "https://images.unsplash.com/photo-1767360963892-3353defd6584?w=600&h=800&fit=crop&auto=format",
        alt: "The Kyphi Body Mist bottle standing in soft golden light",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },

  /* ── HOME FRAGRANCE ────────────────────────────────────────────────────── */
  {
    id: "noir-room-spray",
    name: "Noir Room Spray",
    slug: "noir-room-spray",
    subtitle: "Five pumps · One atmosphere",
    description:
      "Five pumps transform any room. The Noir accord — black iris, aged patchouli, carbonized wood — creates an immediate atmosphere of depth and sophistication.",
    story: null,
    concentration: null,
    format: "Room Spray",
    includes: [],
    badge: null,
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 100,
    priceInCents: 9500,
    sku: "KHEM-HOM-NOI-100",
    inventory: 24,
    isBestseller: false,
    collectionSlug: "room-fragrance",
    images: [
      {
        url: "https://images.unsplash.com/photo-1738520420642-bc8761cc9f16?w=600&h=800&fit=crop&auto=format",
        alt: "The Noir Room Spray bottle against an unlit interior wall",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },

  /* ── DISCOVERY SETS ────────────────────────────────────────────────────── */
  {
    id: "initiation-set",
    name: "The Initiation Set",
    slug: "initiation-set",
    subtitle: "The complete introduction",
    description:
      "Contains six of our signature 3ml vials — one from each of the founding fragrances. The complete introduction to the world of KHEM.",
    story: null,
    concentration: null,
    format: "6 × 3 ML Vials",
    includes: [
      "Kyphi Noir 3ml",
      "Rā Soleil 3ml",
      "Nile Absolue 3ml",
      "Isis Rose 3ml",
      "Lotus Blanc 3ml",
      "KHEM story booklet",
    ],
    badge: "Most Popular",
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 18,
    priceInCents: 12500,
    sku: "KHEM-DIS-INI-018",
    inventory: 40,
    isBestseller: false,
    collectionSlug: "discovery",
    images: [
      {
        url: "https://images.unsplash.com/photo-1674620213535-9b2a2553ef40?w=600&h=800&fit=crop&auto=format",
        alt: "Six discovery vials arranged in a shallow presentation tray",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "noir-initiation-set",
    name: "The Noir Initiation",
    slug: "noir-initiation-set",
    subtitle: "The darker chapter",
    description:
      "The darker chapter of KHEM, presented in weighted vials. For those drawn to shadow, depth, and the more esoteric expressions of Egyptian heritage.",
    story: null,
    concentration: null,
    format: "2 × 10 ML Vials",
    includes: [
      "Nile Absolue 10ml",
      "Obsidian Elixir 10ml",
      "KHEM story booklet",
    ],
    badge: "Limited",
    tags: ["LIMITED_EDITION"],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 20,
    priceInCents: 18500,
    sku: "KHEM-DIS-NOI-020",
    inventory: 15,
    isBestseller: false,
    collectionSlug: "discovery",
    images: [
      {
        url: "https://images.unsplash.com/photo-1694481901573-a970f982ac5e?w=600&h=800&fit=crop&auto=format",
        alt: "Two weighted black vials resting on unpolished dark stone",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "complete-library-set",
    name: "The Complete Library",
    slug: "complete-library-set",
    subtitle: "The full collection in miniature",
    description:
      "The complete KHEM library in miniature. Every fragrance from all three collections, presented in a lacquered collector's box designed to be kept and displayed.",
    story: null,
    concentration: null,
    format: "12 × 3 ML Vials",
    includes: [
      "All 5 Signature fragrances 3ml",
      "All 3 Noir fragrances 3ml",
      "All 3 Gemstone fragrances 3ml",
      "Lacquered collector's box",
      "KHEM story booklet",
      "Black wax seal",
    ],
    badge: "Exclusive",
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 36,
    priceInCents: 28000,
    sku: "KHEM-DIS-LIB-036",
    inventory: 10,
    isBestseller: false,
    collectionSlug: "discovery",
    images: [
      {
        url: "https://images.unsplash.com/photo-1605174697130-0bb0b83c92fc?w=600&h=800&fit=crop&auto=format",
        alt: "A lacquered collector's box holding the full library of vials",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },

  /*
   * ── GIFT SETS ──────────────────────────────────────────────────────────
   *
   * Full-size goods composed for giving, not sample vials — hence a collection
   * of their own with `kind: "GIFT"`, and hence `/gift-set` rather than a
   * second grid on `/discovery`. Same shape as a discovery set otherwise:
   * `concentration` is null, `format` carries the display line, and `includes`
   * lists the contents the card prints.
   */
  {
    id: "gilded-offering-set",
    name: "The Gilded Offering",
    slug: "gilded-offering-set",
    subtitle: "Two full flacons, presented",
    description:
      "The two fragrances that opened the house, in full size, laid in a lacquered box with a gold-embossed card written by hand at the atelier.",
    story: null,
    concentration: null,
    format: "2 × 50 ML Flacons",
    includes: [
      "Kyphi Noir 50ml",
      "Rā Soleil 50ml",
      "Lacquered presentation box",
      "Gold-embossed card, hand-written",
      "KHEM story booklet",
    ],
    badge: "Most Loved",
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 100,
    priceInCents: 52000,
    sku: "KHEM-GFT-GLD-100",
    inventory: 12,
    isBestseller: false,
    collectionSlug: "gift-set",
    images: [
      {
        url: "https://images.unsplash.com/photo-1709666414115-47ecd5143293?w=600&h=800&fit=crop&auto=format",
        alt: "Two full-size flacons filled with amber liquid, side by side",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "obsidian-coffret-set",
    name: "The Obsidian Coffret",
    slug: "obsidian-coffret-set",
    subtitle: "The Noir chapter, sealed in wax",
    description:
      "Three Noir fragrances at 30ml, hand-sealed in black wax and set in a weighted coffret. Produced once a year, in a numbered run.",
    story: null,
    concentration: null,
    format: "3 × 30 ML Flacons",
    includes: [
      "Nile Absolue 30ml",
      "Obsidian Elixir 30ml",
      "Anubis Ombré 30ml",
      "Weighted coffret with black wax seal",
      "Numbered certificate",
    ],
    badge: "Limited",
    tags: ["LIMITED_EDITION"],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 90,
    priceInCents: 46500,
    sku: "KHEM-GFT-OBS-090",
    inventory: 9,
    isBestseller: false,
    collectionSlug: "gift-set",
    images: [
      {
        url: "https://images.unsplash.com/photo-1618994492420-b4f4d6b4890c?w=600&h=800&fit=crop&auto=format",
        alt: "Crystal flacons arranged on dark wood before packing",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "temple-hearth-set",
    name: "The Temple Hearth",
    slug: "temple-hearth-set",
    subtitle: "A scented room, given whole",
    description:
      "Everything needed to scent a room the way a temple was scented: the Noir accord as a spray, a hand-poured candle, and frankincense cones with their brass holder.",
    story: null,
    concentration: null,
    format: "Room Spray · Candle · Incense",
    includes: [
      "Noir Room Spray 100ml",
      "Hand-poured ritual candle, 45 hours",
      "Frankincense incense cones",
      "Cast brass incense holder",
      "KHEM story booklet",
    ],
    badge: "For the Home",
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 100,
    priceInCents: 28500,
    sku: "KHEM-GFT-HRT-100",
    inventory: 20,
    isBestseller: false,
    collectionSlug: "gift-set",
    images: [
      {
        url: "https://images.unsplash.com/photo-1609599176235-f93af914fde0?w=600&h=800&fit=crop&auto=format",
        alt: "A reed diffuser and candle vessel set against a dark interior wall",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
];

/** The fragrance given the full-bleed feature section on the home page. */
export const FEATURED_PRODUCT_SLUG = "kyphi-noir";
