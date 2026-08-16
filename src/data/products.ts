/**
 * Local seed data for the catalog.
 *
 * This module is the ONLY place holding hardcoded catalog records. It is shaped
 * exactly like the future `Collection` / `Product` / `ProductImage` rows, so the
 * Supabase migration is: seed these values into Postgres, then delete this file
 * and repoint `src/services/products.ts`. Nothing else changes.
 *
 * NOTE ON MONEY: `priceInCents` holds **Egyptian piastres** — 147000 is EGP
 * 1,470.00. EGP is the base currency, the settlement currency, and what the
 * prerendered HTML shows; `src/lib/currency.ts` converts to the five display
 * currencies and `formatPrice` is the only place that crosses between them. The
 * field keeps the `priceInCents` name because it mirrors the Prisma column in
 * AGENTS.md §9, where "cents" means "minor units".
 *
 * NOTE ON NOTE PYRAMIDS: each fragrance carries three notes per tier, and the
 * first note of every tier is the one the card grids display. That ordering is
 * load-bearing — `ProductCard` renders `topNotes[0]`, `heartNotes[0]`, and
 * `baseNotes[0]`, so reordering a tier changes what every listing page shows.
 * These are still placeholder pyramids; replace them with the perfumer's real
 * formulas before launch, keeping the signature note first in each tier.
 *
 * NOTE ON IMAGERY: every URL below is a photo already vetted for this project —
 * Unsplash for the catalog at large, Cloudinary for the house's own product
 * renders — and `images.unsplash.com` / `res.cloudinary.com` are the only remote
 * hosts allowed by `next.config.ts`. Invent a photo slug and `next/image`
 * returns a 404, so a new product reuses a vetted photograph until its own
 * render exists.
 *
 * NOTE ON NAMES: a name is unique within its collection, not across the
 * catalog. "Amber" is a Gemstone fragrance, a room spray, and a body mist —
 * three different goods a customer would never confuse, because they live on
 * separate pages and every card and cart line prints the format token beside
 * the name ("Amber · Room Spray"). What must stay unique is the `slug`, which
 * is the URL key, and the `sku`.
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
 *   Signature → 100 ML      Noir → 100 ML      Gemstone → 50 ML
 *   Room Spray → 200 ML     Body Mist → 150 ML
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
      "The house at its most concentrated. Two compositions drawn from the perfumes the temples actually burned — held back from the Signature range because neither would sit quietly beside anything else.",
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
      "Mineral light made wearable. Six fragrances cut from the stones the Egyptians buried with their kings — lapis and turquoise from the desert mines, amber from the resin roads, emerald, sapphire, and opal from the trade that followed.",
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
      "Ancient Egyptians understood that beauty was ritual. Our body mists extend the KHEM fragrance experience beyond the flacon — a fine veil worn over skin and hair, alone or beneath the eau de parfum it shares an accord with.",
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
      "In Ancient Egypt, a scented space was a sacred space. Our room sprays extend the KHEM world into your interiors — a few pumps into the air of a room, and the atmosphere changes before anyone has entered it.",
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
    id: "sunlit-citrine",
    name: "Sunlit Citrine",
    slug: "sunlit-citrine",
    subtitle: "The season's first light on resin",
    description:
      "Golden amber lifted by saffron and immortelle, closing on labdanum and Haitian vetiver.",
    story:
      "Citrine was the stone the Egyptians cut for the living rather than the dead — worn at the throat, kept in the light, never sealed into a tomb. Sunlit Citrine is built the same way: a fragrance for the hours you are awake in.\n\nIt opens bright and dry, pink pepper over mandarin leaf, before the resins arrive. Immortelle and saffron hold the middle with an almost honeyed weight, and labdanum, tonka, and Haitian vetiver take it down into skin. It is the warmest fragrance the house has released, and the first composed entirely in the new Cairo atelier.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: "New",
    tags: ["NEW_ARRIVAL"],
    topNotes: ["Golden Amber", "Pink Pepper", "Mandarin Leaf"],
    heartNotes: ["Immortelle", "Saffron", "Orris Butter"],
    baseNotes: ["Labdanum", "Tonka Bean", "Haitian Vetiver"],
    volumeMl: 100,
    priceInCents: 147000,
    sku: "KHEM-SIG-SUN-100",
    inventory: 18,
    isBestseller: false,
    collectionSlug: "signature",
    images: [
      {
        url: "https://images.unsplash.com/photo-1709662217788-6a8a1b31562a?w=600&h=800&fit=crop&auto=format",
        alt: "The Sunlit Citrine flacon lit from above on warm stone",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1667070796007-185faecdf8a1?w=900&h=1100&fit=crop&auto=format",
        alt: "Sunlit Citrine photographed beside cut resin and saffron threads",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1613549026666-73c9c9083c62?w=900&h=1100&fit=crop&auto=format",
        alt: "Sunlit Citrine held against a low golden horizon",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "sapphire",
    name: "Sapphire",
    slug: "sapphire",
    subtitle: "The hour before the sun returns",
    description:
      "Night iris over smoked oud and black leather, closing on ash wood and grey ambrette.",
    story:
      "Sapphire is the darkest stone the house works with, and this is the darkest thing in the Gemstone range — a fragrance about the last hour of night rather than the first hour of morning.\n\nIt opens cold: night iris, bergamot chilled almost to bitterness, a thread of elemi. Then it closes over. Smoked oud and black leather sit at the centre without ever becoming sweet, and the drydown is ash wood, grey ambrette, and a vetiver so dark it reads as stone. Composed in a run of six hundred, and not repeated.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: "New · Limited",
    tags: ["NEW_ARRIVAL", "LIMITED_EDITION"],
    topNotes: ["Night Iris", "Cold Bergamot", "Elemi"],
    heartNotes: ["Smoked Oud", "Black Leather", "Cypriol"],
    baseNotes: ["Ash Wood", "Grey Ambrette", "Vetiver Noir"],
    volumeMl: 50,
    priceInCents: 84000,
    sku: "KHEM-GEM-SAP-050",
    inventory: 12,
    isBestseller: false,
    collectionSlug: "gemstone",
    images: [
      {
        url: "https://images.unsplash.com/photo-1533603208986-24fd819e718a?w=600&h=800&fit=crop&auto=format",
        alt: "The Sapphire flacon almost lost against an unlit background",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1738664926458-d8ca7f56549f?w=900&h=1100&fit=crop&auto=format",
        alt: "Sapphire lit by a single blue edge of light",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1654612514062-7cc235e7b68c?w=900&h=1100&fit=crop&auto=format",
        alt: "Sapphire standing on cold polished stone before dawn",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },

  /*
   * ── SIGNATURE ──────────────────────────────────────────────────────────
   *
   * Six fragrances, 100 ML, EGP 1,470. The founding range.
   */
  {
    id: "onyx-night",
    name: "Onyx Night",
    slug: "onyx-night",
    subtitle: "Sacred temple incense reimagined",
    description:
      "Black frankincense and smoked incense over black oud, labdanum, and dark rose.",
    story:
      "Onyx was carved into the amulets laid against the chest, the stone the Egyptians trusted to hold something in place. This fragrance is built around the same idea: an incense composition that settles rather than rises.\n\nIt opens with frankincense and black pepper, smoke without heat. The heart is black oud and a rose so dark it reads as resin, and the base — amber, myrrh, sandalwood — is what remains on the skin the following morning. The most complex formula the house has released, and its most requested.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Frankincense", "Smoked Incense", "Black Pepper"],
    heartNotes: ["Black Oud", "Labdanum", "Dark Rose"],
    baseNotes: ["Amber", "Myrrh", "Sandalwood"],
    volumeMl: 100,
    priceInCents: 147000,
    sku: "KHEM-SIG-ONX-100",
    inventory: 24,
    isBestseller: true,
    collectionSlug: "signature",
    images: [
      {
        url: "https://res.cloudinary.com/co1xzkhf/image/upload/Gemini_Generated_Image_3vrr7v3vrr7v3vrr.png",
        alt: "The Onyx Night flacon standing in low incense smoke",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1738664926458-d8ca7f56549f?w=900&h=1100&fit=crop&auto=format",
        alt: "Onyx Night against a wall of unlit black stone",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1643797517714-a273548abc3c?w=900&h=1100&fit=crop&auto=format",
        alt: "Frankincense resin beside the Onyx Night flacon",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "ivory-temple",
    name: "Ivory Temple",
    slug: "ivory-temple",
    subtitle: "The golden radiance of dawn",
    description:
      "The golden radiance of dawn captured in solar musk, saffron, and white amber.",
    story:
      "The limestone of the temple at Deir el-Bahari turns almost white an hour after sunrise, and holds the heat of it until evening. Ivory Temple is that hour: an opening of solar musk and bergamot so bright it reads almost colourless.\n\nBeneath it, saffron and neroli warm the composition the way a stone wall warms through a morning. What remains on the skin hours later is white amber and vanilla absolue — not the dawn itself, but the memory of standing in it.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Solar Musk", "Bergamot", "Aldehydes"],
    heartNotes: ["Saffron", "Neroli", "Jasmine Sambac"],
    baseNotes: ["White Amber", "Sandalwood", "Vanilla Absolue"],
    volumeMl: 100,
    priceInCents: 147000,
    sku: "KHEM-SIG-IVO-100",
    inventory: 18,
    isBestseller: true,
    collectionSlug: "signature",
    images: [
      {
        url: "https://res.cloudinary.com/co1xzkhf/image/upload/hero-ivory_temple.png",
        alt: "Ivory Temple flacon catching gold light at dawn",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://res.cloudinary.com/co1xzkhf/image/upload/ingredients-ivory_temple.png",
        alt: "Ivory Temple gilded shoulder throwing a long morning shadow",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://res.cloudinary.com/co1xzkhf/image/upload/lifestyle-ivory_temple.png",
        alt: "Ivory Temple photographed against a warm ochre backdrop",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "silk-serenity",
    name: "Silk Serenity",
    slug: "silk-serenity",
    subtitle: "Sacred purity from dark waters",
    description:
      "White lotus over aquatic musk and water lily, resting on cedar and white musk.",
    story:
      "The blue lotus closes at dusk and sinks below the surface of the water, and opens again at first light — which is why the Egyptians painted it into every scene of rebirth they carved.\n\nSilk Serenity holds that moment of opening. White lotus and a green accord above, aquatic musk and water lily through the middle, cedar and ambrette beneath. The lightest thing the house makes, and the one most often bought for someone else.",
    concentration: "EAU_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["White Lotus", "Bergamot", "Green Accord"],
    heartNotes: ["Aquatic Musk", "Water Lily", "Jasmine"],
    baseNotes: ["Cedar", "White Musk", "Ambrette"],
    volumeMl: 100,
    priceInCents: 147000,
    sku: "KHEM-SIG-SLK-100",
    inventory: 30,
    isBestseller: false,
    collectionSlug: "signature",
    images: [
      {
        url: "https://images.unsplash.com/photo-1607506740211-ff3d6b933dda?w=600&h=800&fit=crop&auto=format",
        alt: "The Silk Serenity flacon against pale water-lit stone",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1718728593303-94ec0352cf3d?w=900&h=1100&fit=crop&auto=format",
        alt: "Silk Serenity photographed beside still water",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1760860992203-85ca32536788?w=900&h=1100&fit=crop&auto=format",
        alt: "Silk Serenity in flat morning light on a white surface",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "desert-lily",
    name: "Desert Lily",
    slug: "desert-lily",
    subtitle: "The eternal feminine",
    description:
      "Rose absolute and pink pepper over neroli and jasmine, settling into sandalwood and white musk.",
    story:
      "The desert lily flowers after rain that may not come for years, and flowers anyway — which is the closest thing Egyptian botany has to a statement of faith.\n\nThe fragrance is built around rose absolute, but it is not a rose soliflore: pink pepper cuts the opening, neroli and orris keep the heart from turning sweet, and sandalwood and benzoin hold it close to the skin. It is the fragrance the atelier recommends most often to someone who says they do not wear florals.",
    concentration: "EAU_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Rose Absolute", "Pink Pepper", "Bergamot"],
    heartNotes: ["Neroli", "Jasmine", "Orris"],
    baseNotes: ["Sandalwood", "White Musk", "Benzoin"],
    volumeMl: 100,
    priceInCents: 147000,
    sku: "KHEM-SIG-DES-100",
    inventory: 26,
    isBestseller: false,
    collectionSlug: "signature",
    images: [
      {
        url: "https://images.unsplash.com/photo-1608721279136-cd41b752fa41?w=600&h=800&fit=crop&auto=format",
        alt: "The Desert Lily flacon beside cut rose heads",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1676950933747-5f886cadf014?w=900&h=1100&fit=crop&auto=format",
        alt: "Desert Lily lit warmly against a dark ground",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1747696766706-5485b39bf358?w=900&h=1100&fit=crop&auto=format",
        alt: "Desert Lily photographed on sun-warmed sand",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "crimson-sun",
    name: "Crimson Sun",
    slug: "crimson-sun",
    subtitle: "Forged of sunlight and kingship",
    description:
      "Saffron and cardamom over a gold accord and jasmine sambac, closing on amber resin.",
    story:
      "The sun the Egyptians carved above a king's head is never yellow in the surviving pigment — it is red, the colour of the disc at the moment it touches the horizon and the day is decided.\n\nCrimson Sun is that colour worn. Saffron and cardamom open it with heat rather than brightness; a gold accord and jasmine sambac hold the centre; amber resin, sandalwood, and tonka carry it into the evening. Formal, and unmistakably an evening fragrance.",
    concentration: "EXTRAIT_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Saffron", "Bergamot", "Cardamom"],
    heartNotes: ["Gold Accord", "Jasmine Sambac", "Orris"],
    baseNotes: ["Amber Resin", "Sandalwood", "Tonka Bean"],
    volumeMl: 100,
    priceInCents: 147000,
    sku: "KHEM-SIG-CRM-100",
    inventory: 22,
    isBestseller: false,
    collectionSlug: "signature",
    images: [
      {
        url: "https://images.unsplash.com/photo-1640975972263-1f73398e943b?w=600&h=800&fit=crop&auto=format",
        alt: "The Crimson Sun flacon burning with reflected red light",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1676950933747-5f886cadf014?w=900&h=1100&fit=crop&auto=format",
        alt: "Crimson Sun against a gilded surface at last light",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1738664926482-1a986adb3e6c?w=900&h=1100&fit=crop&auto=format",
        alt: "Crimson Sun throwing warm colour across dark stone",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },

  /*
   * ── NOIR ───────────────────────────────────────────────────────────────
   *
   * Two fragrances, 100 ML, EGP 2,880. Both are named for perfumes that
   * genuinely existed: Kyphi, the sixteen-ingredient temple compound burned at
   * sunset, and the Mendesian, the myrrh-and-cassia oil of the Delta that
   * Pliny and Dioscorides both wrote down the formula for.
   */
  {
    id: "kyphi",
    name: "Kyphi",
    slug: "kyphi",
    subtitle: "The compound burned at sunset",
    description:
      "Black iris and incense smoke over patchouli, dark rose, and cistus, closing on burnt wood.",
    story:
      "Kyphi was not a perfume in the modern sense. It was a compound of sixteen ingredients — resins, wine, honey, raisins, myrrh — kneaded, aged, and burned in the temples as the sun went down, and the recipe survives in full on the walls at Edfu and Philae.\n\nThis is not a reconstruction of it; a literal one would be undrinkable smoke. It is what that ritual smells like from the far side of the courtyard: black iris and incense above, patchouli and cistus at the centre, burnt wood and benzoin at the end. The most concentrated thing the house makes.",
    concentration: "PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: ["LIMITED_EDITION"],
    topNotes: ["Black Iris", "Incense Smoke", "Bergamot"],
    heartNotes: ["Patchouli", "Dark Rose", "Cistus"],
    baseNotes: ["Burnt Wood", "Benzoin", "Dark Musk"],
    volumeMl: 100,
    priceInCents: 288000,
    sku: "KHEM-NOI-KYP-100",
    inventory: 14,
    isBestseller: true,
    collectionSlug: "noir",
    images: [
      {
        url: "https://images.unsplash.com/photo-1643797517714-a273548abc3c?w=600&h=800&fit=crop&auto=format",
        alt: "The Kyphi flacon beside burning resin",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1533603208986-24fd819e718a?w=900&h=1100&fit=crop&auto=format",
        alt: "Kyphi almost invisible against an unlit wall",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1738664926458-d8ca7f56549f?w=900&h=1100&fit=crop&auto=format",
        alt: "Kyphi lit by a single low flame",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "mendesian",
    name: "Mendesian",
    slug: "mendesian",
    subtitle: "The oil of the Delta",
    description:
      "Papyrus and an aquatic accord over vetiver and lotus, closing on dark musk and driftwood.",
    story:
      "The Mendesian was made at Mendes in the Nile Delta and traded across the Mediterranean for a thousand years — myrrh, cassia, and resin carried in oil, the most expensive perfume of the ancient world.\n\nThe modern reading keeps the river rather than the recipe. Papyrus and violet leaf open it green and cold; vetiver, lotus, and iris hold the middle; dark musk, driftwood, and ambergris close it the way silt closes over stone. It smells of moving water, which is a difficult thing to make and the reason this one took three years.",
    concentration: "PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: ["LIMITED_EDITION"],
    topNotes: ["Papyrus", "Aquatic Accord", "Violet Leaf"],
    heartNotes: ["Vetiver", "Lotus Flower", "Iris"],
    baseNotes: ["Dark Musk", "Driftwood", "Ambergris"],
    volumeMl: 100,
    priceInCents: 288000,
    sku: "KHEM-NOI-MEN-100",
    inventory: 11,
    isBestseller: true,
    collectionSlug: "noir",
    images: [
      {
        url: "https://res.cloudinary.com/co1xzkhf/image/upload/hero-noir_1.png",
        alt: "The Mendesian flacon standing in near darkness",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1718728593303-94ec0352cf3d?w=900&h=1100&fit=crop&auto=format",
        alt: "Mendesian photographed beside still river water",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1607506740211-ff3d6b933dda?w=900&h=1100&fit=crop&auto=format",
        alt: "Mendesian resting on wet stone under flat daylight",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },

  /*
   * ── GEMSTONE ───────────────────────────────────────────────────────────
   *
   * Six fragrances, 50 ML, EGP 840. Sapphire leads the array above, with the
   * new arrivals.
   */
  {
    id: "lapis",
    name: "Lapis",
    slug: "lapis",
    subtitle: "The blue of the burial mask",
    description:
      "Blue iris and juniper over violet leaf and orris, closing on ambergris and cashmere wood.",
    story:
      "Every scrap of lapis in Egypt came six thousand kilometres by land from Badakhshan, and it was still ground into powder and laid across the face of a dead king. No stone was ever worth more trouble.\n\nThe fragrance is cool and mineral rather than floral: blue iris and juniper above, violet leaf and orris through the middle, ambergris and cashmere wood beneath. It wears close to the skin and stays there — the quietest thing in the Gemstone range, and the one that lasts longest.",
    concentration: "EAU_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Blue Iris", "Bergamot", "Juniper"],
    heartNotes: ["Violet Leaf", "Orris", "Jasmine"],
    baseNotes: ["Ambergris", "Cashmere Wood", "White Musk"],
    volumeMl: 50,
    priceInCents: 84000,
    sku: "KHEM-GEM-LAP-050",
    inventory: 20,
    isBestseller: false,
    collectionSlug: "gemstone",
    images: [
      {
        url: "https://images.unsplash.com/photo-1709662369957-0cbf9f8452fc?w=600&h=800&fit=crop&auto=format",
        alt: "The Lapis flacon reading almost ultramarine against dark stone",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1738664926482-1a986adb3e6c?w=900&h=1100&fit=crop&auto=format",
        alt: "Lapis throwing blue light across a polished surface",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1718728593303-94ec0352cf3d?w=900&h=1100&fit=crop&auto=format",
        alt: "Lapis photographed beside raw blue mineral",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "amber",
    name: "Amber",
    slug: "amber",
    subtitle: "Warm stone, warmer skin",
    description:
      "Pink pepper and blood orange over red amber and rose, closing on cedarwood and benzoin.",
    story:
      "Amber is not a stone at all — it is resin that waited forty million years to harden, which the Egyptians understood well enough to burn it as an offering rather than cut it as a gem.\n\nThe fragrance keeps that warmth literal. Blood orange and cinnamon open it, red amber and immortelle hold the centre, cedarwood and tonka close it. It reads warmer on skin than it does on paper, which is why the atelier asks you to wear it for an hour before deciding.",
    concentration: "EAU_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Pink Pepper", "Blood Orange", "Cinnamon"],
    heartNotes: ["Red Amber", "Rose", "Immortelle"],
    baseNotes: ["Cedarwood", "Benzoin", "Tonka Bean"],
    volumeMl: 50,
    priceInCents: 84000,
    sku: "KHEM-GEM-AMB-050",
    inventory: 22,
    isBestseller: true,
    collectionSlug: "gemstone",
    images: [
      {
        url: "https://images.unsplash.com/photo-1747696766706-5485b39bf358?w=600&h=800&fit=crop&auto=format",
        alt: "The Amber flacon glowing against warm sand",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1640975972263-1f73398e943b?w=900&h=1100&fit=crop&auto=format",
        alt: "Amber lit from behind, the liquid reading almost red",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1738664926482-1a986adb3e6c?w=900&h=1100&fit=crop&auto=format",
        alt: "Amber beside pieces of raw resin on dark stone",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "emerald",
    name: "Emerald",
    slug: "emerald",
    subtitle: "Cut from the mines at Sikait",
    description:
      "Galbanum and fig leaf over green cardamom and orris, closing on vetiver and moss.",
    story:
      "The emerald mines at Sikait, in the Eastern Desert, are the oldest worked emerald deposits on earth — Cleopatra's mines, still standing as cut galleries in the rock.\n\nEmerald is the green in the range, and it is green in the difficult sense: galbanum and fig leaf at the top, sharp and almost bitter, softened only slowly by green cardamom and orris. Vetiver, moss, and cedar close it. Nothing here is sweet, and nothing here is trying to be.",
    concentration: "EAU_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: ["LIMITED_EDITION"],
    topNotes: ["Galbanum", "Fig Leaf", "Green Mandarin"],
    heartNotes: ["Green Cardamom", "Orris", "Violet Leaf"],
    baseNotes: ["Vetiver", "Oakmoss", "Cedar"],
    volumeMl: 50,
    priceInCents: 84000,
    sku: "KHEM-GEM-EME-050",
    inventory: 16,
    isBestseller: false,
    collectionSlug: "gemstone",
    images: [
      {
        url: "https://images.unsplash.com/photo-1654612514062-7cc235e7b68c?w=600&h=800&fit=crop&auto=format",
        alt: "The Emerald flacon against deep green shadow",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1778058505814-6d247ccb600c?w=900&h=1100&fit=crop&auto=format",
        alt: "Emerald photographed beside cut fig leaves",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1608721279136-cd41b752fa41?w=900&h=1100&fit=crop&auto=format",
        alt: "Emerald throwing green light across rough stone",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "opal",
    name: "Opal",
    slug: "opal",
    subtitle: "One stone, several colours",
    description:
      "Aldehydes and white pepper over silver iris and heliotrope, closing on white amber and mineral musk.",
    story:
      "An opal does not have a colour. It has an angle — turn it and the fire in it moves, which is why the stone was cut into inlay rather than beads, set flat where it could be looked at rather than worn end-on.\n\nThe fragrance is built to do the same thing. Aldehydes and white pepper open it almost colourless; silver iris and heliotrope give it a powdery centre that reads differently on different skin; white amber, mineral musk, and ambrette close it. Two people wearing Opal rarely smell as though they are wearing the same thing.",
    concentration: "EAU_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Aldehydes", "White Pepper", "Bergamot"],
    heartNotes: ["Silver Iris", "Heliotrope", "Orris Butter"],
    baseNotes: ["White Amber", "Mineral Musk", "Ambrette"],
    volumeMl: 50,
    priceInCents: 84000,
    sku: "KHEM-GEM-OPA-050",
    inventory: 18,
    isBestseller: false,
    collectionSlug: "gemstone",
    images: [
      {
        url: "https://images.unsplash.com/photo-1760860992203-85ca32536788?w=600&h=800&fit=crop&auto=format",
        alt: "The Opal flacon catching shifting pale light",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1667070796007-185faecdf8a1?w=900&h=1100&fit=crop&auto=format",
        alt: "Opal photographed against a pearl-grey surface",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1613549026666-73c9c9083c62?w=900&h=1100&fit=crop&auto=format",
        alt: "Opal throwing an iridescent edge of colour",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "turquoise",
    name: "Turquoise",
    slug: "turquoise",
    subtitle: "Mined from the Sinai",
    description:
      "Neroli and green mandarin over sea salt and orange blossom, closing on white musk and driftwood.",
    story:
      "Turquoise came out of Serabit el-Khadim in the Sinai, where the miners cut a temple to Hathor into the rock beside the workings and left their names on it.\n\nThe fragrance is the sea end of the range: neroli and green mandarin above, sea salt and orange blossom through the middle, white musk and driftwood beneath. Bright, saline, and easily the most worn thing the house makes in summer.",
    concentration: "EAU_DE_PARFUM",
    format: null,
    includes: [],
    badge: null,
    tags: [],
    topNotes: ["Neroli", "Bergamot", "Green Mandarin"],
    heartNotes: ["Sea Salt", "Orange Blossom", "Jasmine"],
    baseNotes: ["White Musk", "Driftwood", "Ambrette"],
    volumeMl: 50,
    priceInCents: 84000,
    sku: "KHEM-GEM-TUR-050",
    inventory: 24,
    isBestseller: false,
    collectionSlug: "gemstone",
    images: [
      {
        url: "https://images.unsplash.com/photo-1718728593303-94ec0352cf3d?w=600&h=800&fit=crop&auto=format",
        alt: "The Turquoise flacon against pale sea-lit stone",
        isPrimary: true,
        sortOrder: 0,
      },
      {
        url: "https://images.unsplash.com/photo-1709662369957-0cbf9f8452fc?w=900&h=1100&fit=crop&auto=format",
        alt: "Turquoise lit from behind, the glass reading almost sea-blue",
        isPrimary: false,
        sortOrder: 1,
      },
      {
        url: "https://images.unsplash.com/photo-1607506740211-ff3d6b933dda?w=900&h=1100&fit=crop&auto=format",
        alt: "Turquoise resting on wet stone under flat daylight",
        isPrimary: false,
        sortOrder: 2,
      },
    ],
  },

  /*
   * ── BODY CARE ──────────────────────────────────────────────────────────
   *
   * Four body mists, 150 ML, EGP 390. A mist, not an oil: alcohol-light, worn
   * over skin and hair, and named for the Gemstone fragrance each one shares
   * an accord with.
   */
  {
    id: "amber-body-mist",
    name: "Amber",
    slug: "amber-body-mist",
    subtitle: "Light · Layerable · Everyday",
    description:
      "A fine mist carrying the Amber accord — blood orange, red amber, benzoin — over skin and hair. Light enough to wear on its own through the day, and made to be layered beneath the eau de parfum it shares its heart with.",
    story: null,
    concentration: null,
    format: "Body Mist",
    includes: [],
    badge: null,
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 150,
    priceInCents: 39000,
    sku: "KHEM-BOD-AMB-150",
    inventory: 30,
    isBestseller: false,
    collectionSlug: "body-care",
    images: [
      {
        url: "https://images.unsplash.com/photo-1767360963892-3353defd6584?w=600&h=800&fit=crop&auto=format",
        alt: "The Amber body mist bottle standing in soft golden light",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "opal-body-mist",
    name: "Opal",
    slug: "opal-body-mist",
    subtitle: "Light · Layerable · Everyday",
    description:
      "The Opal accord as a mist — aldehydes, silver iris, and white amber, sprayed over skin and hair. Powdery and almost weightless, it settles differently on everyone who wears it.",
    story: null,
    concentration: null,
    format: "Body Mist",
    includes: [],
    badge: null,
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 150,
    priceInCents: 39000,
    sku: "KHEM-BOD-OPA-150",
    inventory: 30,
    isBestseller: false,
    collectionSlug: "body-care",
    images: [
      {
        url: "https://images.unsplash.com/photo-1779524477261-12141ccbd8d9?w=600&h=800&fit=crop&auto=format",
        alt: "The Opal body mist bottle against a pale bathing chamber wall",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "lapis-body-mist",
    name: "Lapis",
    slug: "lapis-body-mist",
    subtitle: "Light · Layerable · Everyday",
    description:
      "The Lapis accord as a mist — blue iris, violet leaf, and cashmere wood. Cool and mineral on the skin, and the one to reach for when a full eau de parfum would be too much.",
    story: null,
    concentration: null,
    format: "Body Mist",
    includes: [],
    badge: null,
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 150,
    priceInCents: 39000,
    sku: "KHEM-BOD-LAP-150",
    inventory: 28,
    isBestseller: false,
    collectionSlug: "body-care",
    images: [
      {
        url: "https://images.unsplash.com/photo-1709662369957-0cbf9f8452fc?w=600&h=800&fit=crop&auto=format",
        alt: "The Lapis body mist bottle reading deep blue in low light",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "turquoise-body-mist",
    name: "Turquoise",
    slug: "turquoise-body-mist",
    subtitle: "Light · Layerable · Everyday",
    description:
      "The Turquoise accord as a mist — neroli, sea salt, and white musk, misted over skin and hair after sun or shower. The lightest thing the house makes, and the one that disappears fastest in the heat.",
    story: null,
    concentration: null,
    format: "Body Mist",
    includes: [],
    badge: null,
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 150,
    priceInCents: 39000,
    sku: "KHEM-BOD-TUR-150",
    inventory: 32,
    isBestseller: false,
    collectionSlug: "body-care",
    images: [
      {
        url: "https://images.unsplash.com/photo-1718728593303-94ec0352cf3d?w=600&h=800&fit=crop&auto=format",
        alt: "The Turquoise body mist bottle against pale sea-lit stone",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },

  /*
   * ── HOME FRAGRANCE ─────────────────────────────────────────────────────
   *
   * Four room sprays, 200 ML, EGP 490. Sprayed into the air of a room, not
   * onto a surface and not through a reed.
   */
  {
    id: "amber-room-spray",
    name: "Amber",
    slug: "amber-room-spray",
    subtitle: "Five pumps · One atmosphere",
    description:
      "Five pumps into the air of a room and it changes. The Amber accord — blood orange, red amber, benzoin — hangs for hours without settling into anything heavy. Made for the hour before people arrive.",
    story: null,
    concentration: null,
    format: "Room Spray",
    includes: [],
    badge: null,
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 200,
    priceInCents: 49000,
    sku: "KHEM-HOM-AMB-200",
    inventory: 24,
    isBestseller: false,
    collectionSlug: "room-fragrance",
    images: [
      {
        url: "https://images.unsplash.com/photo-1738520420642-bc8761cc9f16?w=600&h=800&fit=crop&auto=format",
        alt: "The Amber room spray bottle against a warm interior wall",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "opal-room-spray",
    name: "Opal",
    slug: "opal-room-spray",
    subtitle: "Five pumps · One atmosphere",
    description:
      "The Opal accord sprayed into a room — aldehydes, silver iris, white amber. Clean and powdery rather than sweet, and the one that suits a bedroom or a dressing room best.",
    story: null,
    concentration: null,
    format: "Room Spray",
    includes: [],
    badge: null,
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 200,
    priceInCents: 49000,
    sku: "KHEM-HOM-OPA-200",
    inventory: 24,
    isBestseller: false,
    collectionSlug: "room-fragrance",
    images: [
      {
        url: "https://images.unsplash.com/photo-1609599176235-f93af914fde0?w=600&h=800&fit=crop&auto=format",
        alt: "The Opal room spray bottle in a dim interior",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "lapis-room-spray",
    name: "Lapis",
    slug: "lapis-room-spray",
    subtitle: "Five pumps · One atmosphere",
    description:
      "The Lapis accord sprayed into a room — blue iris, juniper, cashmere wood. Cool and mineral, it holds a room at a distance rather than warming it, which is exactly right for a study.",
    story: null,
    concentration: null,
    format: "Room Spray",
    includes: [],
    badge: null,
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 200,
    priceInCents: 49000,
    sku: "KHEM-HOM-LAP-200",
    inventory: 22,
    isBestseller: false,
    collectionSlug: "room-fragrance",
    images: [
      {
        url: "https://images.unsplash.com/photo-1738664926482-1a986adb3e6c?w=600&h=800&fit=crop&auto=format",
        alt: "The Lapis room spray bottle throwing blue light across dark stone",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
  {
    id: "turquoise-room-spray",
    name: "Turquoise",
    slug: "turquoise-room-spray",
    subtitle: "Five pumps · One atmosphere",
    description:
      "The Turquoise accord sprayed into a room — neroli, sea salt, driftwood. It reads like a window opened onto the sea, and it is the one to use in a room that has been closed all day.",
    story: null,
    concentration: null,
    format: "Room Spray",
    includes: [],
    badge: null,
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 200,
    priceInCents: 49000,
    sku: "KHEM-HOM-TUR-200",
    inventory: 26,
    isBestseller: false,
    collectionSlug: "room-fragrance",
    images: [
      {
        url: "https://images.unsplash.com/photo-1607506740211-ff3d6b933dda?w=600&h=800&fit=crop&auto=format",
        alt: "The Turquoise room spray bottle against pale sea-lit stone",
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
      "Contains six of our Signature 3ml vials — one from each fragrance in the founding range. The complete introduction to the world of KHEM.",
    story: null,
    concentration: null,
    format: "6 × 3 ML Vials",
    includes: [
      "Onyx Night 3ml",
      "Ivory Temple 3ml",
      "Sunlit Citrine 3ml",
      "Silk Serenity 3ml",
      "Desert Lily 3ml",
      "Crimson Sun 3ml",
    ],
    badge: "Most Popular",
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 18,
    priceInCents: 69000,
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
      "Both Noir compositions, presented in weighted vials. For those drawn to shadow, depth, and the more esoteric expressions of Egyptian heritage.",
    story: null,
    concentration: null,
    format: "2 × 10 ML Vials",
    includes: ["Kyphi 10ml", "Mendesian 10ml", "KHEM story booklet"],
    badge: "Limited",
    tags: ["LIMITED_EDITION"],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 20,
    priceInCents: 129000,
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
    format: "14 × 3 ML Vials",
    includes: [
      "All 6 Signature fragrances 3ml",
      "Both Noir fragrances 3ml",
      "All 6 Gemstone fragrances 3ml",
      "Lacquered collector's box",
      "KHEM story booklet",
      "Black wax seal",
    ],
    badge: "Exclusive",
    tags: [],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 42,
    priceInCents: 189000,
    sku: "KHEM-DIS-LIB-042",
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
      "Onyx Night 50ml",
      "Ivory Temple 50ml",
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
    priceInCents: 270000,
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
      "Both Noir fragrances at 30ml, hand-sealed in black wax and set in a weighted coffret. Produced once a year, in a numbered run.",
    story: null,
    concentration: null,
    format: "2 × 30 ML Flacons",
    includes: [
      "Kyphi 30ml",
      "Mendesian 30ml",
      "Weighted coffret with black wax seal",
      "Numbered certificate",
    ],
    badge: "Limited",
    tags: ["LIMITED_EDITION"],
    topNotes: [],
    heartNotes: [],
    baseNotes: [],
    volumeMl: 60,
    priceInCents: 240000,
    sku: "KHEM-GFT-OBS-060",
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
      "Everything needed to scent a room the way a temple was scented: the Amber accord as a room spray, a hand-poured candle, and frankincense cones with their brass holder.",
    story: null,
    concentration: null,
    format: "Room Spray · Candle · Incense",
    includes: [
      "Amber Room Spray 200ml",
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
    volumeMl: 200,
    priceInCents: 119000,
    sku: "KHEM-GFT-HRT-200",
    inventory: 20,
    isBestseller: false,
    collectionSlug: "gift-set",
    images: [
      {
        url: "https://images.unsplash.com/photo-1609599176235-f93af914fde0?w=600&h=800&fit=crop&auto=format",
        alt: "A room spray and candle vessel set against a dark interior wall",
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  },
];

/** The fragrance given the full-bleed feature section on the home page. */
export const FEATURED_PRODUCT_SLUG = "kyphi";
