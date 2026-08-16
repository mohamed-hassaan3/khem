/**
 * Local seed data for editorial content.
 *
 * Same contract as `products.ts`: this is the only place these records are
 * hardcoded, and it is shaped for a straight insert into Supabase (or a CMS)
 * later. See `src/types/content.ts` for why these are not Prisma models yet.
 *
 * Nothing here is a display string: families are arrays, prices are tiers,
 * dates are ISO-8601, and reading time is a number. Formatting happens in
 * `src/lib/format.ts` and in the components — never in storage.
 */

import type {
  BrandValue,
  CraftPillar,
  CraftQuote,
  CraftStat,
  CraftStep,
  Ingredient,
  IngredientFamily,
  JournalArticle,
  MissionStatement,
  Testimonial,
  TimelineEvent,
} from "@/src/types/content";

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "yasmine-al-rashid",
    quote:
      "KHEM has redefined what it means to wear a fragrance. Each bottle is a piece of history.",
    author: "Yasmine Al-Rashid",
    authorTitle: "Perfume Critic, Cairo",
  },
  {
    id: "james-whitmore",
    quote:
      "Onyx Night is unlike anything I have encountered. Ancient yet wholly modern. Extraordinary.",
    author: "James Whitmore",
    authorTitle: "Luxury Editor, Condé Nast",
  },
  {
    id: "sofia-marchetti",
    quote:
      "The attention to detail — from the bottle to the scent — signals a new era of Egyptian luxury.",
    author: "Sofia Marchetti",
    authorTitle: "Creative Director, Dubai",
  },
];

/**
 * The seven olfactive families, in filter-bar order.
 *
 * Ordering lives here rather than being derived from `INGREDIENTS`, because the
 * bar must read as a deliberate taxonomy — a `flatMap` over the records would
 * order the chips by whichever ingredient happened to be listed first, and would
 * silently grow an eighth chip the moment a record used a new label.
 *
 * → supabase.from('IngredientFamily').select('name').order('sortOrder')
 */
export const INGREDIENT_FAMILIES: readonly IngredientFamily[] = [
  "Woody Aromas",
  "Floral",
  "Fresh / Citrus",
  "Fruity",
  "Oriental Aromas",
  "Aquatic Aromas",
  "Herbal",
];

export const INGREDIENTS: Ingredient[] = [
  {
    id: "oud",
    name: "Oud",
    slug: "oud",
    latinName: "Aquilaria malaccensis",
    origin: "Laos & Cambodia",
    families: ["Woody Aromas", "Oriental Aromas"],
    rarity: "Extremely Rare",
    priceTier: 5,
    description:
      'Known as "liquid gold," oud is the most expensive natural ingredient in perfumery. It is the dark, resinous heartwood formed when the Aquilaria tree becomes infected with a specific mold. The result of this natural alchemy is a rich, complex material — simultaneously smoky, sweet, animalic, and sacred.',
    usedIn: [
      { name: "Onyx Night", slug: "onyx-night" },
      { name: "Sapphire", slug: "sapphire" },
    ],
    facts: [
      "Wild Aquilaria trees take 100+ years to form oud",
      "Only 2% of wild trees are infected",
      "A kilo of premium oud can exceed $30,000",
    ],
    image: {
      url: "https://images.unsplash.com/photo-1607506740211-ff3d6b933dda?w=700&h=900&fit=crop&auto=format",
      alt: "Aged oud wood chips resting on dark stone",
    },
  },
  {
    id: "frankincense",
    name: "Frankincense",
    slug: "frankincense",
    latinName: "Boswellia sacra",
    origin: "Dhofar, Oman",
    families: ["Oriental Aromas", "Woody Aromas"],
    rarity: "Rare",
    priceTier: 4,
    description:
      "The most sacred of all ancient aromatics, frankincense has been burned in temples and used in ritual for over 5,000 years. The finest grade — Hojari from Oman — is hand-harvested by tapping the Boswellia sacra tree, which grows exclusively in the mountains of Dhofar.",
    usedIn: [
      { name: "Onyx Night", slug: "onyx-night" },
      { name: "Kyphi", slug: "kyphi" },
    ],
    facts: [
      "Used by Ancient Egyptians in mummification rituals",
      'The tree "bleeds" resin when scored with a blade',
      "Hojari frankincense is traded at luxury auction",
    ],
    image: {
      url: "https://images.unsplash.com/photo-1643797517714-a273548abc3c?w=700&h=900&fit=crop&auto=format",
      alt: "Frankincense resin tears in low golden light",
    },
  },
  {
    id: "saffron",
    name: "Saffron",
    slug: "saffron",
    latinName: "Crocus sativus",
    origin: "Khorasan, Iran",
    families: ["Oriental Aromas"],
    rarity: "Very Rare",
    priceTier: 4,
    description:
      "The world's most expensive spice by weight, saffron adds an incomparable warmth and subtle spiciness to fine fragrance. Each strand is the stigma of the Crocus sativus flower, hand-harvested at dawn before the blooms open. A single gram requires 150 flowers.",
    usedIn: [
      { name: "Ivory Temple", slug: "ivory-temple" },
      { name: "Crimson Sun", slug: "crimson-sun" },
      { name: "Sunlit Citrine", slug: "sunlit-citrine" },
    ],
    facts: [
      "150 flowers yield just 1 gram of saffron",
      "Harvested exclusively at dawn",
      "Used in ancient Egyptian cosmetics for over 3,500 years",
    ],
    image: {
      url: "https://images.unsplash.com/photo-1640975972263-1f73398e943b?w=700&h=900&fit=crop&auto=format",
      alt: "Hand-picked saffron threads gathered in a dark bowl",
    },
  },
  {
    id: "neroli",
    name: "Neroli",
    slug: "neroli",
    latinName: "Citrus aurantium",
    origin: "Nile Delta, Egypt",
    families: ["Floral", "Fresh / Citrus"],
    rarity: "Precious",
    priceTier: 3,
    description:
      "Distilled from the blossom of the bitter orange tree, neroli has an achingly beautiful quality — simultaneously honeyed, green, and almost metallic. We source exclusively from the orange groves of Egypt's Nile Delta, where the combination of soil and climate produces a neroli of exceptional complexity.",
    usedIn: [
      { name: "Ivory Temple", slug: "ivory-temple" },
      { name: "Desert Lily", slug: "desert-lily" },
      { name: "Turquoise", slug: "turquoise" },
    ],
    facts: [
      "Named after Princess Anne Marie Orsini of Nerola",
      "1 tonne of blossoms yields 1 kg of neroli",
      "Cleopatra reportedly bathed in neroli-infused water",
    ],
    image: {
      url: "https://images.unsplash.com/photo-1533603208986-24fd819e718a?w=700&h=900&fit=crop&auto=format",
      alt: "Neroli blossoms from the Egyptian bitter orange harvest",
    },
  },
  {
    id: "ambergris",
    name: "Ambergris",
    slug: "ambergris",
    latinName: "Physeter macrocephalus",
    origin: "Atlantic Ocean",
    families: ["Aquatic Aromas", "Oriental Aromas"],
    rarity: "Extremely Rare",
    priceTier: 5,
    description:
      "The rarest fixative in all of perfumery, ambergris is produced in the digestive system of sperm whales and found floating in ocean waters after decades of natural transformation. It adds an incomparable depth and radiance to fragrance, fixing all other notes and making them last significantly longer on skin.",
    usedIn: [
      { name: "Mendesian", slug: "mendesian" },
      { name: "Lapis", slug: "lapis" },
    ],
    facts: [
      "Ages in the ocean for up to 30 years before use",
      "Entirely natural — ethically found, never hunted",
      "A gram of fine ambergris exceeds the price of gold",
    ],
    image: {
      url: "https://images.unsplash.com/photo-1760860992203-85ca32536788?w=700&h=900&fit=crop&auto=format",
      alt: "A weathered piece of ambergris against deep shadow",
    },
  },
  {
    id: "haitian-vetiver",
    name: "Haitian Vetiver",
    slug: "haitian-vetiver",
    latinName: "Chrysopogon zizanioides",
    origin: "Haiti",
    families: ["Woody Aromas", "Herbal"],
    rarity: "Precious",
    priceTier: 3,
    description:
      "Distilled from the roots of vetiver grass, Haitian vetiver is widely considered the finest in the world — deeper, smokier, and more complex than its Javanese or Indian counterparts. It is an extraordinary material that anchors fragrances, providing extraordinary longevity and a sense of ancient earth.",
    usedIn: [
      { name: "Sunlit Citrine", slug: "sunlit-citrine" },
      { name: "Emerald", slug: "emerald" },
      { name: "Sapphire", slug: "sapphire" },
    ],
    facts: [
      "Roots can grow up to 3 meters deep into the earth",
      "Haitian vetiver has a distinctive smoky quality unique to its terroir",
      "Used in ancient temples throughout the Middle East",
    ],
    image: {
      url: "https://images.unsplash.com/photo-1613549026666-73c9c9083c62?w=700&h=900&fit=crop&auto=format",
      alt: "Vetiver roots drying before distillation",
    },
  },
  {
    id: "rose-absolute",
    name: "Rose Absolue",
    slug: "rose-absolue",
    latinName: "Rosa damascena",
    origin: "Grasse, France",
    families: ["Floral", "Fruity"],
    rarity: "Precious",
    priceTier: 3,
    description:
      "The queen of flowers, Rosa damascena has been cultivated in Grasse for fragrance production for over 300 years. Our rose absolue comes from a single family-owned estate in the Vallée des Fleurs. It is a full, honeyed, almost wine-like rose — nothing like the synthetic approximations found in most fragrances.",
    usedIn: [
      { name: "Desert Lily", slug: "desert-lily" },
      { name: "Onyx Night", slug: "onyx-night" },
      { name: "Amber", slug: "amber" },
    ],
    facts: [
      "4 tonnes of flowers yield 1 kg of rose absolue",
      "Harvested between 5 and 10 AM when concentration is highest",
      "The Damascus rose was brought to Europe by crusaders returning from Egypt",
    ],
    image: {
      url: "https://images.unsplash.com/photo-1676950933747-5f886cadf014?w=700&h=900&fit=crop&auto=format",
      alt: "Rose petals from Grasse awaiting extraction",
    },
  },
  {
    id: "black-iris",
    name: "Black Iris",
    slug: "black-iris",
    latinName: "Iris nigricans",
    origin: "Jordan Valley",
    families: ["Floral", "Woody Aromas"],
    rarity: "Exceptionally Rare",
    priceTier: 5,
    description:
      "The national flower of Jordan, the black iris (Iris nigricans) is among the rarest botanical ingredients in all of perfumery. Its extraction is extraordinarily complex and yield minimal. The result is a singular, dark, almost unearthly note — simultaneously powdery, woody, and strangely metallic.",
    usedIn: [
      { name: "Kyphi", slug: "kyphi" },
      { name: "Sapphire", slug: "sapphire" },
    ],
    facts: [
      "The national flower of Jordan",
      "Wild specimens are legally protected",
      "Considered sacred in Levantine tradition",
    ],
    image: {
      url: "https://images.unsplash.com/photo-1631189944771-466264f05965?w=700&h=900&fit=crop&auto=format",
      alt: "A dark iris bloom against deep shadow",
    },
  },
];

export const JOURNAL_ARTICLES: JournalArticle[] = [
  {
    id: "alchemy-of-ancient-egyptian-perfumery",
    slug: "alchemy-of-ancient-egyptian-perfumery",
    title: "The Alchemy of Ancient Egyptian Perfumery",
    category: "Heritage",
    excerpt:
      "How a civilization 5,000 years old developed perfume formulas so sophisticated that modern chemists still struggle to fully replicate them.",
    publishedAt: "2024-12-01",
    readTimeMinutes: 8,
    isFeatured: true,
    image: {
      url: "https://images.unsplash.com/photo-1762530211537-011645caef57?w=800&h=500&fit=crop&auto=format",
      alt: "Ancient Egyptian vessels used for blending sacred oils",
    },
  },
  {
    id: "following-oud-along-the-silk-road",
    slug: "following-oud-along-the-silk-road",
    title: "Following Oud Along the Silk Road",
    category: "Ingredients",
    excerpt:
      "A journey through the agarwood forests of Laos and Cambodia, where the world's most precious aromatic wood is harvested with extraordinary care.",
    publishedAt: "2024-11-01",
    readTimeMinutes: 12,
    isFeatured: false,
    image: {
      url: "https://images.unsplash.com/photo-1654612514062-7cc235e7b68c?w=800&h=500&fit=crop&auto=format",
      alt: "A caravan route at dusk, tracing the historic oud trade",
    },
  },
  {
    id: "inside-the-atelier-onyx-night",
    slug: "inside-the-atelier-onyx-night",
    title: "Inside the Atelier: The Making of Onyx Night",
    category: "Craftsmanship",
    excerpt:
      "Master perfumer Mohamed Hassaan opens the doors of the KHEM atelier to share how our most complex fragrance took three years and 200 iterations to perfect.",
    publishedAt: "2024-10-01",
    readTimeMinutes: 10,
    isFeatured: false,
    image: {
      url: "https://images.unsplash.com/photo-1718728593303-94ec0352cf3d?w=800&h=500&fit=crop&auto=format",
      alt: "A perfumer's organ of raw materials inside the KHEM atelier",
    },
  },
  {
    id: "hieroglyphs-of-the-nose",
    slug: "hieroglyphs-of-the-nose",
    title: "Hieroglyphs of the Nose: Reading Ancient Scent Formulas",
    category: "Heritage",
    excerpt:
      "With the help of Egyptologist Dr. Amira Soltan, we decode the scent formulas carved into the walls of the Temple of Edfu.",
    publishedAt: "2024-09-01",
    readTimeMinutes: 15,
    isFeatured: false,
    image: {
      url: "https://images.unsplash.com/photo-1667070796007-185faecdf8a1?w=800&h=500&fit=crop&auto=format",
      alt: "Carved hieroglyphs lit by low raking light",
    },
  },
  {
    id: "sacred-ritual-of-egyptian-perfume",
    slug: "sacred-ritual-of-egyptian-perfume",
    title: "The Sacred Ritual of Applying Egyptian Perfume",
    category: "Culture",
    excerpt:
      "In ancient Egypt, fragrance was never merely aesthetic. It was a spiritual practice, a daily ceremony of connection with the divine.",
    publishedAt: "2024-08-01",
    readTimeMinutes: 6,
    isFeatured: false,
    image: {
      url: "https://images.unsplash.com/photo-1678287714479-adaa0cfbe6c6?w=800&h=500&fit=crop&auto=format",
      alt: "Ancient Egyptian relief carvings in warm low light",
    },
  },
  {
    id: "saffron-the-golden-thread",
    slug: "saffron-the-golden-thread",
    title: "Saffron: The Golden Thread of KHEM",
    category: "Ingredients",
    excerpt:
      "A gram of saffron requires 150 flowers, each hand-harvested at dawn. We trace the journey of this extraordinary ingredient from the Iranian plateau to our atelier.",
    publishedAt: "2024-07-01",
    readTimeMinutes: 9,
    isFeatured: false,
    image: {
      url: "https://images.unsplash.com/photo-1640975972263-1f73398e943b?w=800&h=500&fit=crop&auto=format",
      alt: "Saffron threads gathered after the dawn harvest",
    },
  },
];

export const CRAFT_PILLARS: CraftPillar[] = [
  {
    id: "rare-ingredients",
    number: "01",
    title: "Rare Ingredients",
    description:
      "Sourced from the finest terroirs across Egypt, France, India, and Oman. Oud, frankincense, saffron, and neroli of the highest grade.",
  },
  {
    id: "master-perfumers",
    number: "02",
    title: "Master Perfumers",
    description:
      "Crafted in collaboration with the world's foremost noses. Each fragrance is refined over months until perfect equilibrium is achieved.",
  },
  {
    id: "crystal-flacons",
    number: "03",
    title: "Crystal Flacons",
    description:
      "Hand-blown in collaboration with artisan glassmakers. Each bottle is a sculptural object inspired by ancient Egyptian vessels.",
  },
  {
    id: "ritual-packaging",
    number: "04",
    title: "Ritual Packaging",
    description:
      "Wrapped in hand-marbled paper, sealed with black wax, and housed in lacquered boxes that become part of your home.",
  },
];

/** `/heritage` — five thousand years of scent, oldest first. */
export const TIMELINE: TimelineEvent[] = [
  {
    id: "birth-of-kyphi",
    year: "3000 BC",
    title: "The Birth of Kyphi",
    description:
      "Ancient Egyptians develop the first complex perfume formula — Kyphi — from sixteen sacred ingredients. It is burned in temples at sunset as an offering to the gods.",
  },
  {
    id: "great-papyrus-formulas",
    year: "1550 BC",
    title: "The Great Papyrus Formulas",
    description:
      "The Ebers Papyrus records hundreds of scent formulas using frankincense, myrrh, cinnamon, and rare resins. Perfumery becomes a sacred art form.",
  },
  {
    id: "the-scented-queen",
    year: "69 BC",
    title: "The Scented Queen",
    description:
      "Cleopatra VII saturates the sails of her ships in rose and jasmine perfume so that her arrival is announced by scent before she appears. Fragrance becomes power.",
  },
  {
    id: "khem-is-founded",
    year: "2019 AD",
    title: "KHEM is Founded",
    description:
      "A gathering of Egyptian perfumers, historians, and craftspeople in Cairo establish KHEM — a fragrance house dedicated to transforming ancient wisdom into modern luxury.",
  },
  {
    id: "the-first-collection",
    year: "2021 AD",
    title: "The First Collection",
    description:
      "The Signature Collection launches to critical acclaim, including Onyx Night — KHEM's defining fragrance and the most complex formula in the house.",
  },
  {
    id: "the-noir-chapter",
    year: "2024 AD",
    title: "The Noir Chapter",
    description:
      "The second collection — Noir — explores the darker, more esoteric aspects of Egyptian heritage. Limited edition quantities. Museum-grade packaging.",
  },
];

/** `/heritage` — what the house believes. */
export const BRAND_VALUES: BrandValue[] = [
  {
    id: "reverence",
    title: "Reverence",
    description:
      "We approach Egyptian cultural heritage with deep respect, working with historians, archaeologists, and cultural scholars to ensure our interpretations are accurate and honoring.",
  },
  {
    id: "mastery",
    title: "Mastery",
    description:
      "We work only with the finest master perfumers from Grasse, Cairo, and Dubai. Every formula undergoes years of refinement before we consider it worthy of a KHEM bottle.",
  },
  {
    id: "sustainability",
    title: "Sustainability",
    description:
      "Our ingredients are sourced through fair-trade partnerships. Our packaging uses recycled materials. We plant a tree for every bottle sold through our Egyptian reforestation program.",
  },
];

/** `/about` — mission and vision. */
export const MISSION_STATEMENTS: MissionStatement[] = [
  {
    id: "mission",
    label: "Mission",
    title: "To Honor the Ancient",
    text: "To create modern luxury fragrances that serve as a bridge between the extraordinary cultural heritage of Ancient Egypt and the contemporary world — treating history not as nostalgia, but as a living source of inspiration.",
  },
  {
    id: "vision",
    label: "Vision",
    title: "A New Egyptian Luxury",
    text: "To establish Egypt as a preeminent source of global luxury — proving that the civilization that gave the world fragrance, cosmetics, and beauty can once again lead the world in the art of perfumery.",
  },
];

/** `/craftsmanship` — the six stages of the atelier process, in order. */
export const CRAFT_STEPS: CraftStep[] = [
  {
    id: "ingredient-sourcing",
    number: "01",
    title: "Ingredient Sourcing",
    subtitle: "Four Continents. One Standard.",
    body: "Our master perfumer travels personally to source every key ingredient. Frankincense from the Dhofar mountains of Oman. Oud from the forest reserves of Laos. Saffron from the highlands of Iran. Rose absolute from the valleys of Grasse. Only the finest grade reaches our atelier.",
    image: {
      url: "https://images.unsplash.com/photo-1615885108069-7d5bef9a7e22?w=900&h=700&fit=crop&auto=format",
      alt: "Raw botanical materials laid out for grading before selection",
    },
  },
  {
    id: "formulation",
    number: "02",
    title: "Formulation",
    subtitle: "Months of Refinement. Hundreds of Trials.",
    body: "Each KHEM fragrance undergoes between 80 and 300 formulation trials before it is deemed worthy of production. Our head perfumer works in silence, revising, adjusting, layering — searching for the precise balance that honors both the ancient inspiration and the modern wearer.",
    image: {
      url: "https://images.unsplash.com/photo-1709666414115-47ecd5143293?w=900&h=700&fit=crop&auto=format",
      alt: "The perfumer's organ, ranked with trial vials mid-formulation",
    },
  },
  {
    id: "crystal-flacon-creation",
    number: "03",
    title: "Crystal Flacon Creation",
    subtitle: "Mouth-Blown. Hand-Polished. Singular.",
    body: "Each KHEM bottle is conceived as a sculptural object — a vessel worthy of its contents. Inspired by ancient Egyptian alabaster canopic jars and the geometry of temple columns, they are mouth-blown by master glassmakers in Murano, then hand-polished to optically flawless clarity.",
    image: {
      url: "https://images.unsplash.com/photo-1618994492420-b4f4d6b4890c?w=900&h=700&fit=crop&auto=format",
      alt: "A mouth-blown crystal flacon resting after hand-polishing",
    },
  },
  {
    id: "filling-and-sealing",
    number: "04",
    title: "Filling & Sealing",
    subtitle: "A Ritual, Not a Process.",
    body: "Fragrance is introduced to each bottle by hand, measured to the microgram. The stopper — weighted black onyx for Signature, obsidian for Noir — is fitted individually and sealed with black wax stamped with the KHEM falcon sigil. No two bottles are identical.",
    image: {
      url: "https://images.unsplash.com/photo-1709662217788-6a8a1b31562a?w=900&h=700&fit=crop&auto=format",
      alt: "A bottle being filled by hand and fitted with its onyx stopper",
    },
  },
  {
    id: "packaging-and-presentation",
    number: "05",
    title: "Packaging & Presentation",
    subtitle: "The Unboxing as an Event.",
    body: "KHEM packaging is designed to be kept. The outer box is lacquered matte black, embossed with hieroglyphic-inspired geometry in cold-pressed gold foil. Inside: hand-marbled tissue in ivory and champagne, a printed vellum story card, and a wax seal bearing the KHEM falcon.",
    image: {
      url: "https://images.unsplash.com/photo-1674620213535-9b2a2553ef40?w=900&h=700&fit=crop&auto=format",
      alt: "A lacquered black presentation box lined with hand-marbled tissue",
    },
  },
  {
    id: "quality-control",
    number: "06",
    title: "Quality Control",
    subtitle: "Passed by a Human Nose. Every Time.",
    body: "Before any KHEM bottle leaves the atelier, it is evaluated by our master perfumer. Not by machine. Not by algorithm. The scent is assessed cold, warm, and aged. Only bottles that meet every criterion of the original formula are released. Imperfect bottles are destroyed.",
    image: {
      url: "https://images.unsplash.com/photo-1709662369957-0cbf9f8452fc?w=900&h=700&fit=crop&auto=format",
      alt: "A finished bottle assessed on a blotter before release",
    },
  },
];

/** `/craftsmanship` — the figures shown in the band beneath the hero. */
export const CRAFT_STATS: CraftStat[] = [
  {
    id: "formulation-trials",
    value: "300+",
    label: "Formulation Trials Per Fragrance",
  },
  {
    id: "continents-sourced",
    value: "4",
    label: "Continents Sourced",
  },
  {
    id: "creation-months",
    value: "16",
    label: "Months Average Creation Time",
  },
  {
    id: "hand-assembled",
    value: "100%",
    label: "Hand-Assembled Bottles",
  },
];

/** `/craftsmanship` — the house statement from the head perfumer. */
export const MASTER_PERFUMER_QUOTE: CraftQuote = {
  id: "leila-hassan",
  quote:
    "A fragrance is not made. It is discovered — through patience, silence, and an absolute refusal to compromise.",
  author: "Mohamed Hassaan",
  authorTitle: "Head Perfumer & Co-Founder, KHEM",
};
