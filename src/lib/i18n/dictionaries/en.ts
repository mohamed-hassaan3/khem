/**
 * English dictionary — the reference locale.
 *
 * This file defines the `Dictionary` shape. Every other locale is typed
 * against it, so adding a key here is a compile error everywhere else until
 * it is translated.
 *
 * Scope is UI chrome and page-level editorial copy that lives in JSX. The
 * long-form records in Postgres (testimonials, timeline, craft steps,
 * ingredient detail, legal documents, products) are NOT translated here —
 * they stay English for both locales until that content layer moves to a CMS.
 */

import type { CollectionKind, Concentration } from "@/src/types/catalog";

export const en = {
  common: {
    readMore: "Read More",
    discover: "Discover",
    explore: "Explore",
    shopNow: "Shop Now",
    viewAll: "View All",
    learnMore: "Learn More",
    back: "Back",
    close: "Close",
    loading: "Loading",
    comingSoon: "Coming Soon...",
    minRead: "{minutes} min read",
  },

  nav: {
    collections: "Collections",
    worldOfKhem: "World of KHEM",
    stockists: "Stockists",
    menu: "Menu",
    discover: "Discover",
    boutique: "Boutique",
    featured: "Featured",
    quickAccess: "Quick Access",
    newArrival: "New Arrival",
    ourCollections: "Our Collections",
    search: "Search",
    cart: "Shopping bag",
    /** Accessible label for the bag link once it holds something. */
    cartCount: "Shopping bag, {count} items",
    cartCountOne: "Shopping bag, 1 item",
    account: "Account",
    /** Accessible label for the avatar button once a session exists. */
    accountMenu: "Account menu",
    signIn: "Sign In",
    signOut: "Sign Out",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    featuredProduct: "Sunlit Citrine",
    featuredCollectionAlt: "Signature Collection",
    fromTheJournal: "From the Journal",
    journalLabel: "Journal",
    featuredArticleTitle: "The Alchemy of Ancient Egyptian Perfumery",
    featuredArticleAlt: "Heritage",
    /*
     * The "Our Collections" column, in the order it is printed: the whole shelf
     * first, then the three fragrance chapters, the five olfactive cuts, and the
     * two non-perfume ranges. New Arrival and the sets sit in Quick Access
     * instead — a way of buying is not a chapter of the library.
     */
    collectionItems: {
      allProducts: {
        label: "All Products",
        desc: "Every fragrance, ritual and set in one place",
      },
      signature: {
        label: "Signature Collection",
        desc: "Timeless expressions of Egyptian heritage",
      },
      gemstone: {
        label: "Gemstone Collection",
        desc: "Mineral light made wearable",
      },
      noir: {
        label: "Noir Collection",
        desc: "A darker, more exclusive chapter",
      },
      oriental: {
        label: "Oriental",
        desc: "Resin, amber and incense — warmth that stays",
      },
      floral: {
        label: "Floral",
        desc: "Petals treated as material, never as decoration",
      },
      fresh: {
        label: "Fresh",
        desc: "Citrus peel, sea air and cut green stems",
      },
      woody: {
        label: "Woody",
        desc: "Oud, sandalwood and cedar — the bones of a scent",
      },
      gourmand: {
        label: "Gourmand",
        desc: "Honey and vanilla, kept dry and kept adult",
      },
      bodyCare: {
        label: "Body Care",
        desc: "Rituals for the skin",
      },
      homeFragrance: {
        label: "Home Fragrances",
        desc: "Scent your sanctuary",
      },
    },
    /*
     * The label of the one collection *group* — a disclosure in the menu, not a
     * destination, so it has no `desc` and no path and cannot be a
     * `collectionItems` entry.
     */
    collectionGroups: {
      fragrances: "Fragrances",
      scentProfiles: "Scent Profiles",
    },
    worldItems: {
      heritage: { label: "Our Heritage" },
      craftsmanship: { label: "Craftsmanship" },
      ingredients: { label: "Ingredients" },
      journal: { label: "Journal" },
      about: { label: "About KHEM" },
    },
    /*
     * Quick Access, in the order it is printed — the ways in. The newest work
     * first, then the two set categories, which are ways of buying rather than
     * chapters of the library, and Best Sellers, which crosses every collection
     * at once. See `src/constants/navigation-pages.ts` for why Key Ingredients
     * is no longer among them, and why All Products moved up into Our
     * Collections.
     */
    quickAccessItems: {
      newArrival: "New Arrival",
      discoverySets: "Discovery Sets",
      giftSets: "Gift Sets",
      bestSellers: "Best Sellers",
    },
  },

  footer: {
    brandBlurb:
      "A luxury Egyptian fragrance house that transforms history, mythology, and ancient craftsmanship into timeless modern scents.",
    collections: "Collections",
    worldOfKhem: "The World of KHEM",
    myAccount: "My Account",
    boutique: "Boutique",
    boutiqueAddress: "New Cairo\nCairo, Egypt",
    rights: "© {year} KHEM Fragrance House. All rights reserved.",
    craftedIn: "Crafted with reverence in Cairo",
    logoAlt: "KHEM Perfumes — Essence of Heritage",
    /*
     * The Collections column is no longer listed here: it is rendered from the
     * same `collections` / `quickAccess` tables the Nav uses, so the two
     * surfaces cannot drift apart. What remains is copy the Footer alone prints.
     */
    links: {
      theJournal: "The Journal",
      stockists: "Stockists",
      contact: "Contact",
      myAccount: "My Account",
      myOrders: "My Orders",
      trackOrder: "Track Order",
      returns: "Returns & Exchanges",
      privacyPolicy: "Privacy Policy",
      termsConditions: "Terms & Conditions",
      cookiePolicy: "Cookie Policy",
    },
  },

  home: {
    meta: {
      title: "KHEM Perfumes | Luxury Egyptian Perfumes",
      description:
        "Discover KHEM Perfumes, a luxury Egyptian fragrance house inspired by Ancient Egypt. Explore premium Eau de Parfum collections crafted with timeless elegance.",
    },
    hero: {
      tagline: "Essence of Heritage",
      exploreCollections: "Explore Collections",
      ourStory: "Our Story",
      scroll: "Scroll",
    },
    collections: {
      eyebrow: "Our Collections",
      heading: "Two Worlds of Scent",
      ordinal: "Collection {ordinal}",
    },
    essences: {
      eyebrow: "The Essences",
      heading: "Signature Fragrances",
      viewAll: "View All",
      empty: "New fragrances are being prepared. Please return shortly.",
    },
    story: {
      eyebrow: "Our Heritage",
      headingLine1: "Born from the",
      headingLine2: "Cradle of Civilization",
      body1:
        "KHEM takes its name from the ancient Egyptian word for black earth — the fertile soil of the Nile delta that gave birth to one of history's greatest civilizations. In this spirit, we transform the sacred ingredients, architectural forms, and mythological symbols of Ancient Egypt into modern luxury fragrances.",
      body2:
        "Every fragrance is a meditation on memory — a bridge between the timeless and the contemporary, the sacred and the sensual.",
      cta: "Discover Our Story",
      imageAlt: "Ancient Egyptian relief carvings in warm low light",
    },
    craft: {
      eyebrow: "The Craft",
      heading: "Mastery in Every Drop",
      lede: "From the hand-blown crystal flacons to the rare ingredients sourced from four continents, every detail is an act of devotion.",
      cta: "Learn More",
    },
    featured: {
      eyebrow: "New Arrival",
      cta: "Discover {name}",
    },
    ingredients: {
      eyebrow: "The Ingredients",
      heading: "Nature's Finest",
      viewAll: "View All Ingredients",
      from: "From {origin}",
    },
    journal: {
      eyebrow: "The KHEM Journal",
      heading: "Stories of Scent",
      cta: "Read the Journal",
    },
    newsletter: {
      eyebrow: "Private Access",
      heading: "Join the Inner Circle",
      lede: "Receive exclusive previews of new fragrances, early access to each release, and intimate stories from the KHEM atelier.",
    },
  },

  collections: {
    meta: {
      title: "Collections",
      description:
        "The complete KHEM catalogue — browse by collection: Signature, Noir, and Gemstone alongside body care, home fragrance, discovery sets, and gift sets.",
      ogTitle: "Collections | The Complete KHEM Library",
      ogDescription:
        "Browse everything KHEM makes in one place — three fragrance collections, body care, home fragrance, and sets.",
    },
    all: {
      name: "The Complete Library",
      description:
        "Every piece the house makes, in one place — fragrance, body care, home, and the sets composed for giving.",
    },
    home: "Home",
    countLabel: "{count} Fragrances",
    /** The overview lists more than fragrances, so it counts neutrally. */
    countLabelAll: "{count} Pieces",
    /** Accessible name for the one filter row — the facet chips. */
    filterLabel: "Filter the catalogue",
    /*
     * Keyed by `ProductFacet` (`src/lib/facets.ts`) — kebab-case because the
     * key is also the `?facet=` value, and one spelling for both is one fewer
     * mapping to keep in step. Declared in chip order, which `FACET_ORDER`
     * owns; this object only supplies the words.
     */
    facets: {
      "new-arrivals": "New Arrival",
      signature: "Signature",
      gemstone: "Gemstone",
      noir: "Noir",
      "body-care": "Body Care",
      "home-fragrance": "Home Fragrances",
      discovery: "Discovery Sets",
      "gift-set": "Gift Sets",
      "best-sellers": "Best Sellers",
    },
    /*
     * The state line above the grid on `/collections`. Both the filter and the
     * sort can be arrived at rather than chosen — a shared `?facet=` URL, a sort
     * left set from earlier in the visit — so the page says what it is showing
     * instead of leaving a two-thirds shorter catalogue unexplained.
     */
    activeState: {
      filteredBy: "Filtered by {name}",
      sortedBy: "Sorted by {name}",
      clear: "Clear",
    },
    /*
     * The merchandising cut that has a page of its own — see
     * `MERCH_PAGE_FACETS` in `src/lib/facets.ts`. Keyed by facet, like
     * `facets` above, and carrying what a `Collection` row would have supplied
     * for a seeded collection: a name, a description, and the alt text of a
     * hero it has no column to store.
     */
    merchPages: {
      "best-sellers": {
        name: "Best Sellers",
        description:
          "The pieces the house cannot keep on the shelf — chosen by our customers rather than by us, and drawn from every collection we make.",
        bannerAlt: "Black marble lit from one side, veined with pale gold",
        meta: {
          title: "Best Sellers",
          description:
            "The most sought-after KHEM pieces, across every collection — fragrance, body care, home fragrance, and the sets composed for giving.",
          ogTitle: "Best Sellers | KHEM",
          ogDescription:
            "What our customers reach for most, drawn from every KHEM collection.",
        },
      },
    },
    /*
     * The five scent-profile pages — see `src/lib/scent-profiles.ts`. Keyed by
     * slug, and carrying what a `Collection` row would have supplied: a name, a
     * description, and the alt text of a hero it has no column to store.
     *
     * This is the *fallback*. `"ScentProfile"` is seeded with the same copy and
     * is what the pages render when the database is reachable, so an editor can
     * rewrite a profile's story without a deploy.
     */
    scentProfiles: {
      oriental: {
        name: "Oriental",
        description:
          "Warmth with something withheld in it. Resins, amber and incense that settle into the skin and stay there — the register KHEM was founded on, and the one a room notices an hour after you have left it.",
        bannerAlt: "A carved temple relief of offering bearers with their vessels",
        meta: {
          title: "Oriental Fragrances",
          description:
            "KHEM compositions built on resin, amber and incense — the warm, long-staying register the house was founded on.",
          ogTitle: "Oriental | KHEM",
          ogDescription:
            "Resin, amber and incense. The warmest register in the KHEM library.",
        },
      },
      floral: {
        name: "Floral",
        description:
          "Flowers taken seriously. Jasmine picked before dawn, rose distilled the same day it is cut — petals treated as material rather than as decoration, and composed with enough shadow to keep them from turning sweet.",
        bannerAlt: "A single crocus in bloom against deep shadow",
        meta: {
          title: "Floral Fragrances",
          description:
            "KHEM compositions built on jasmine, rose and orange blossom — petals treated as material, and given shadow enough to stay serious.",
          ogTitle: "Floral | KHEM",
          ogDescription:
            "Jasmine picked before dawn, rose distilled the day it is cut.",
        },
      },
      fresh: {
        name: "Fresh",
        description:
          "The first breath of the composition, and the reason you lean in again. Citrus peel, sea air and cut green stems — light, but never thin: every one of these is built over something that holds.",
        bannerAlt: "Turquoise surf breaking over pale sand, seen from above",
        meta: {
          title: "Fresh Fragrances",
          description:
            "KHEM compositions built on citrus, sea air and green stems — light on the skin, and built over something that holds.",
          ogTitle: "Fresh | KHEM",
          ogDescription:
            "Citrus peel, sea air and cut green stems. Light, but never thin.",
        },
      },
      woody: {
        name: "Woody",
        description:
          "The bones of a fragrance. Oud, sandalwood and cedar — the materials the house travels furthest for, and the ones that decide how a perfume behaves in its last hour rather than its first.",
        bannerAlt: "Low sunlight through a stand of pines",
        meta: {
          title: "Woody Fragrances",
          description:
            "KHEM compositions built on oud, sandalwood and cedar — the materials that decide how a perfume behaves in its last hour.",
          ogTitle: "Woody | KHEM",
          ogDescription:
            "Oud, sandalwood and cedar. The bones of a KHEM composition.",
        },
      },
      gourmand: {
        name: "Gourmand",
        description:
          "Edible in the way a memory is edible. Honey, vanilla, dried fruit and roasted almond, kept dry and kept adult — appetite rather than dessert, and worn closer to the skin than any other register we make.",
        bannerAlt: "A glass of honey beside blossom and dried fruit in low light",
        meta: {
          title: "Gourmand Fragrances",
          description:
            "KHEM compositions built on honey, vanilla and dried fruit — appetite rather than dessert, worn close to the skin.",
          ogTitle: "Gourmand | KHEM",
          ogDescription:
            "Honey, vanilla and dried fruit, kept dry and kept adult.",
        },
      },
    },
    sortBy: "Sort By",
    sortOptions: {
      featured: "Featured",
      priceAsc: "Price: Low to High",
      priceDesc: "Price: High to Low",
    },
    tabAll: "All",
    /** Accessible name of the add-to-bag control overlaid on each card. */
    addToBag: "Add {name} to bag",
    /** The same control when the product has no stock left. */
    soldOut: "{name} is sold out",
    empty: "New fragrances are being prepared. Please return shortly.",
  },

  about: {
    meta: {
      title: "About",
      description:
        "KHEM was founded in Cairo in 2019 to create extraordinary fragrances from extraordinary ingredients, inspired by the civilization that gave the world perfume.",
      ogTitle: "About KHEM | A House of Ancient Futures",
      ogDescription:
        "The founders, the mission, and the vision behind KHEM — a luxury Egyptian fragrance house bridging five millennia of perfumery and the modern world.",
    },
    hero: {
      eyebrow: "About KHEM",
      headingLine1: "A House of",
      headingLine2: "Ancient Futures",
      lede: "KHEM was founded in Cairo in 2019 with a single mission: to create the world's most extraordinary fragrances using the most extraordinary ingredients, inspired by the most extraordinary civilization in human history.",
    },
    founders: {
      eyebrow: "The Founders",
      heading: "Mohamed Hassaan & Dr. Karim Mansour",
      body1:
        "Mohamed Hassaan is an award-winning perfumer trained in Grasse with twenty years of experience creating for the world's finest houses. Dr. Karim Mansour is an Egyptologist and cultural historian at Cairo University, with particular expertise in ancient Egyptian ritual practices.",
      body2:
        "Together, they met at an exhibition on ancient Egyptian cosmetics in 2017. “We both understood immediately,” Mohamed recalls, “that this was the most profound fragrance tradition in human history — and that nobody had yet done it justice.”",
      quote:
        "We are not recreating history. We are translating it into a language the present can feel.",
      quoteAuthor: "Mohamed Hassaan, Co-Founder",
      imageAlt: "The KHEM founders in the atelier",
    },
    cta: {
      heading: "Experience KHEM",
      primary: "Shop Now",
      secondary: "Our Heritage",
    },
  },

  contact: {
    meta: {
      title: "Contact",
      description:
        "Contact KHEM for fragrance enquiries, order support, bespoke commissions, or to arrange a private consultation at our Cairo boutique.",
      ogTitle: "Contact KHEM",
      ogDescription:
        "Reach the KHEM team in Cairo — enquiries, order support, press, wholesale, and private fragrance consultations.",
    },
    hero: {
      eyebrow: "We Are Here",
      headingLine1: "Contact",
      headingLine2: "KHEM",
      lede: "Our team is available to answer questions about our fragrances, assist with orders, arrange private consultations at our Cairo boutique, or discuss bespoke commissions.",
    },
    form: {
      eyebrow: "Send a Message",
      headingLine1: "How can we",
      headingLine2: "assist you?",
    },
    consultation: {
      eyebrow: "Private Consultation",
      heading: "Experience KHEM in Person",
      body: "Arrange a private fragrance consultation at our Cairo boutique. Our perfumers will guide you through the complete KHEM library and help you discover your signature scent.",
      cta: "Request Appointment",
    },
    social: {
      eyebrow: "Follow KHEM",
      profileLabel: "KHEM on {platform}",
    },
  },

  craftsmanship: {
    meta: {
      title: "Craftsmanship",
      description:
        "Six stages, four continents, one uncompromising standard — sourcing, formulation, mouth-blown flacons, hand filling, packaging, and a final assessment by a human nose.",
      ogTitle: "Craftsmanship | Mastery in Every Drop",
      ogDescription:
        "How a KHEM fragrance is made: sixteen months, hundreds of formulation trials, and a bottle assembled entirely by hand.",
    },
    hero: {
      eyebrow: "The Art of KHEM",
      headingLine1: "Mastery in",
      headingLine2: "Every Drop",
      lede: "Six stages. Four continents. One uncompromising standard. The creation of a KHEM fragrance is a devotional act — a process that takes months and demands perfection at every step.",
      scrollHint: "Explore the Process",
    },
    steps: {
      label: "Step {number}",
    },
    cta: {
      eyebrow: "The Result",
      heading: "Fragrances Worthy of History",
      lede: "Sixteen months of work. Hundreds of decisions. One bottle. Discover the fragrances that justify every step of this process.",
      primary: "Shop Collections",
      secondary: "Our Ingredients",
    },
  },

  heritage: {
    meta: {
      title: "Our Heritage",
      description:
        "KHEM takes its name from Kemet, the ancient Egyptian name for the Black Land. Five thousand years of Egyptian perfumery, from the first kyphi to the Noir chapter.",
      ogTitle: "Our Heritage | The Land of Black Earth",
      ogDescription:
        "A timeline of scent spanning five millennia — from temple kyphi and the Ebers Papyrus to the founding of KHEM in Cairo.",
    },
    hero: {
      eyebrow: "Our Heritage",
      headingLine1: "The Land of",
      headingLine2: "Black Earth",
      lede: "KHEM takes its name from Kemet — the ancient Egyptian name for Egypt itself, meaning “the Black Land” — a reference to the fertile dark soil left by the Nile's annual flood. In this spirit, we cultivate something extraordinary from the richest cultural soil in human history.",
    },
    philosophy: {
      eyebrow: "Philosophy",
      heading:
        "“We do not recreate the past. We invoke its spirit within the present.”",
      body1:
        "Ancient Egypt did not merely use fragrance as adornment. Scent was woven into the fabric of spiritual practice, healing, ritual, and identity. The temples burned kyphi at sunset. The dead were anointed with precious oils. Fragrance was the language of divinity.",
      body2:
        "At KHEM, we approach this legacy with reverence. We study ancient formulas, work with Egyptologists, source our ingredients from the same regions that supplied the ancient perfumers, and apply modern perfumery techniques to create something that honors the past without being trapped by it.",
    },
    quoteBand:
      "Every hieroglyph was a prayer. Every ritual was a poem. Every scent was a bridge between the human and the divine.",
    timeline: {
      eyebrow: "Five Thousand Years",
      heading: "A Timeline of Scent",
    },
    values: {
      eyebrow: "Our Values",
      heading: "What We Believe",
    },
    cta: {
      eyebrow: "Explore Our World",
      heading: "Begin Your Journey",
      primary: "Shop Collections",
      secondary: "Our Craftsmanship",
    },
  },

  ingredients: {
    meta: {
      title: "Ingredients",
      description:
        "Oud, frankincense, saffron, neroli, ambergris, and black iris — the rare natural materials behind every KHEM fragrance, and where each one comes from.",
      ogTitle: "Ingredients | Nature's Finest",
      ogDescription:
        "The raw materials of KHEM: their origin, olfactive family, rarity, and the perfumes they build.",
    },
    hero: {
      eyebrow: "The Raw Materials",
      headingLine1: "Nature's",
      headingLine2: "Finest",
      lede: "Every KHEM fragrance begins with an uncompromising commitment to ingredient quality. We use only the finest natural raw materials from the most prestigious sources on earth.",
    },
    cta: {
      eyebrow: "Experience Them",
      heading: "Rare Ingredients. Living Fragrances.",
      lede: "Each KHEM fragrance uses these extraordinary materials in combinations informed by five thousand years of Egyptian perfumery tradition.",
      primary: "Discover the Fragrances",
    },
  },

  journal: {
    meta: {
      title: "Journal",
      description:
        "The KHEM Journal — olfactory essays on Egyptian perfumery, rare ingredients, and the craft behind every flacon.",
      ogTitle: "The KHEM Journal | Stories of Scent",
      ogDescription:
        "Editorial essays on ancient Egyptian perfumery, the sourcing of rare materials, and life inside the KHEM atelier.",
    },
    eyebrow: "The KHEM Journal",
    heading: "Stories of Scent",
    featured: "Featured",
    readArticle: "Read Article",
    read: "Read",
    empty: "No essays in this category yet. Please return shortly.",

    /* The detail page at `/journal/[slug]`. Article text itself is stored in
     * Postgres and is English-only — only the chrome around it is translated. */
    article: {
      journal: "Journal",
      breadcrumbLabel: "Breadcrumb",
      backToJournal: "Back to the Journal",
      related: {
        eyebrow: "Continue Reading",
        heading: "From the Journal",
      },
    },
  },

  stockists: {
    meta: {
      title: "Stockists",
      description:
        "Find KHEM in person. Our flagship boutique and retail partners, with addresses, opening hours, and directions.",
      ogTitle: "Stockists | Find KHEM",
      ogDescription:
        "Where to experience KHEM in person — the flagship boutique in Cairo and every retail partner that carries the house.",
    },
    hero: {
      eyebrow: "Find KHEM",
      heading: "Our Stockists",
    },
    filterLabel: "Filter by region",
    regionAll: "All Regions",
    regions: {
      middleEast: "Middle East",
      europe: "Europe",
      americas: "Americas",
      asiaPacific: "Asia Pacific",
    },
    types: {
      flagship: "Flagship",
      boutique: "Boutique",
      retailPartner: "Retail Partner",
      departmentStore: "Department Store",
    },
    /*
     * Two keys rather than an ICU plural: `interpolate()` is deliberately not
     * a message formatter (see its doc comment), and Arabic's plural system is
     * not solved by a `{count}` placeholder. When a third form is needed, this
     * becomes `Intl.PluralRules`.
     */
    countOne: "{count} Location Worldwide",
    countOther: "{count} Locations Worldwide",
    address: "Address",
    telephone: "Telephone",
    hours: "Hours",
    directions: "Get Directions",
    directionsFor: "Get directions to {name}",
    /*
     * Not `common.comingSoon` ("Coming Soon..."): the ellipsis and the tense
     * are wrong for a location badge, which states a fact about a boutique
     * rather than teasing unfinished copy.
     */
    comingSoon: "Opening Soon",
    empty:
      "No stockists in this region yet. New boutiques are announced here first.",
    partners: {
      eyebrow: "Our Partners",
      heading: "World-Class Retail Partners",
    },
    wholesale: {
      eyebrow: "Carry KHEM",
      heading: "Wholesale & Partnership Enquiries",
      lede: "We partner selectively with retailers who share our commitment to luxury, authenticity, and the highest standards of customer experience.",
      cta: "Contact Our Trade Team",
    },
  },

  ingredientsExplorer: {
    closeDetails: "Close {name} details",
    foundIn: "Found in",
    rareFacts: "Rare Facts",
  },

  contactForm: {
    successHeading: "Message Received",
    successBody: "We will respond within 24 hours. Thank you for your enquiry.",
    yourName: "Your Name",
    emailAddress: "Email Address",
    nameRequired: "Please enter your name.",
    nameTooLong: "Please shorten your name.",
    emailInvalid: "Please enter a valid email address.",
    subjectInvalid: "Please choose a subject from the list.",
    messageRequired: "Please enter a message.",
    messageTooShort: "Please write a little more — at least ten characters.",
    messageTooLong: "Please shorten your message to 4,000 characters or fewer.",
  },

  legal: {
    cookiePolicy: {
      title: "Cookie Policy",
      description:
        "Every cookie KHEM uses and what it does — essential, preferences, and anonymous analytics. No advertising cookies, no ad networks.",
      ogTitle: "Cookie Policy | KHEM",
      ogDescription:
        "A short page, because we use few cookies. Here is every one of them and what it does.",
    },
    privacyPolicy: {
      title: "Privacy Policy",
      description:
        "What KHEM collects, why we collect it, and the control you keep over it — including who we share data with and how long we keep it.",
      ogTitle: "Privacy Policy | KHEM",
      ogDescription:
        "How KHEM Fragrance House handles your personal information, and the rights you hold over it.",
    },
    returnExchange: {
      title: "Returns & Exchanges",
      description:
        "How to cancel, return, or exchange a KHEM order, and what to do if a parcel arrives damaged or incorrect.",
      ogTitle: "Returns & Exchanges | KHEM",
      ogDescription:
        "Cancellations, returns, exchanges, refunds, and damaged orders — the full KHEM customer care procedure.",
    },
    termsConditions: {
      title: "Terms & Conditions",
      description:
        "The agreement between you and KHEM Fragrance House when you place an order — pricing, delivery, product information, fragrance safety, and governing law.",
      ogTitle: "Terms & Conditions | KHEM",
      ogDescription:
        "What we owe you and what we ask in return when you order from KHEM Fragrance House, Cairo.",
    },
  },

  product: {
    collectionLabel: "{name} Collection",
    home: "Home",
    collections: "Collections",
    quantity: "Quantity",
    decreaseQuantity: "Decrease quantity",
    increaseQuantity: "Increase quantity",
    addToCart: "Add to Cart",
    buyNow: "Buy Now",
    added: "Added to Cart",
    /* Accessible name for the bar that follows the visitor down the page. */
    stickyBar: "{name} — purchase",
    soldOut: "Sold Out",
    inStock: "In stock — ships within 48 hours",
    lowStock: "Only {count} remaining",
    storyHeading: "The Story",
    pyramidHeading: "Fragrance Pyramid",
    topNotes: "Top Notes",
    heartNotes: "Heart Notes",
    baseNotes: "Base Notes",
    ingredientsHeading: "Key Ingredients",
    ingredientOrigin: "From {origin}",
    /*
     * The "Scent Profile" line — one profile, or two at the most. Derived from
     * the materials the perfume is built on rather than stored on the product;
     * `productScentProfiles()` in `src/lib/scent-profiles.ts` explains the count.
     * The names themselves come from `collections.scentProfiles`, so the chip
     * and the page it links to cannot disagree.
     */
    scentProfileHeading: "Scent Profile",
    gallery: {
      label: "{name} gallery",
      thumbnail: "View image {index} of {total}",
      previous: "Previous image",
      next: "Next image",
    },
    /*
     * Keyed by the `Concentration` union so a new enum member is a compile
     * error here rather than a raw SCREAMING_SNAKE string in the UI.
     */
    concentrations: {
      PARFUM: "Parfum",
      EXTRAIT_DE_PARFUM: "Extrait de Parfum",
      EAU_DE_PARFUM: "Eau de Parfum",
      ATTAR_OIL: "Attar Oil",
    } satisfies Record<Concentration, string>,
    trust: {
      delivery: {
        title: "Complimentary Delivery",
        desc: "On all orders over EGP 2,000",
      },
      packaging: {
        title: "Luxury Packaging",
        desc: "Gift-ready presentation",
      },
      returns: {
        title: "30-Day Returns",
        desc: "Unworn, sealed items",
      },
    },
    related: {
      eyebrow: "You May Also Love",
      heading: "Explore the Collection",
    },
    /*
     * Visitor comments. `guest` is the attribution for anyone not signed in —
     * it is a *label*, never stored text, so the same row reads "Guest" here
     * and "ضيف" in the Arabic tree.
     */
    comments: {
      eyebrow: "In Their Words",
      heading: "Reflections",
      postingAs: "Writing as {name}",
      guest: "Guest",
      placeholder: "Share how this fragrance wears on you…",
      srLabel: "Your comment",
      submit: "Post Comment",
      submitting: "Posting",
      sent: "Thank you. Your reflection is published.",
      bodyTooShort: "A little more, please",
      bodyTooLong: "Please keep your comment under 1,200 characters",
      deliveryError: "We could not post your comment. Please try again.",
      contentRequired: "Leave a rating, or a few words, or both",

      /*
       * Stars. `ratingOutOf` is the accessible name of every star row —
       * readonly or interactive — so a screen reader hears a number rather
       * than five unlabelled controls.
       */
      ratingLabel: "Your Rating",
      ratingOptional: "Optional",
      ratingOutOf: "{rating} out of 5",
      ratingClear: "Clear rating",
      ratingInvalid: "Please choose between one and five stars",
      ratingSummaryLabel: "Average rating",
      ratingCount: "{count} ratings",
      ratingCountOne: "1 rating",
      submitRating: "Post Rating",

      /* Photographs. */
      addPhotos: "Add photos",
      removePhoto: "Remove photo {index}",
      photoLimit: "Up to 3 photos per comment",
      photoTooLarge: "Each photo must be under 5 MB",
      photoType: "Photos must be JPEG, PNG or WebP",
      photoAlt: "Photo {index} from {name}",
      viewPhoto: "View photo {index} of {total}",
      lightboxLabel: "Photos from {name}",
      photoCounter: "{index} / {total}",
      photoClose: "Close photos",
      photoPrevious: "Previous photo",
      photoNext: "Next photo",
    },
  },

  bodyCare: {
    meta: {
      title: "Body Care",
      description:
        "Dry oils and rituals for the skin, carrying the KHEM fragrance signature beyond the flacon.",
      ogTitle: "Body Care | KHEM",
      ogDescription:
        "Ancient Egyptians understood that beauty was ritual. Layer scent into the very fabric of the skin.",
    },
    eyebrow: "The Ritual",
    titleLead: "Body",
    titleAccent: "Care",
    description:
      "Ancient Egyptians understood that beauty was ritual. Our body care range extends the KHEM fragrance experience beyond the flacon — layering scent into the very fabric of the skin.",
    ritual: {
      layering: {
        title: "Fragrance Layering",
        body: "Apply body products before your fragrance to amplify and extend the scent throughout the day.",
      },
      natural: {
        title: "Natural Formulas",
        body: "No silicones, no sulfates, no synthetic fillers. Only ingredients worthy of the skin.",
      },
      practice: {
        title: "Ritual Practice",
        body: "Each product is designed to transform a routine into a ceremony of self-care.",
      },
    },
    empty: "New rituals are being prepared. Please return shortly.",
  },

  homeFragrance: {
    meta: {
      title: "Home Fragrances",
      description:
        "Room sprays and home scents that turn an interior into a temple of olfactory experience.",
      ogTitle: "Home Fragrances | KHEM",
      ogDescription:
        "In Ancient Egypt, a scented space was a sacred space. Bring the KHEM world into your interiors.",
    },
    eyebrow: "Scent Your Sanctuary",
    titleLead: "Home",
    titleAccent: "Fragrances",
    description:
      "In Ancient Egypt, a scented space was a sacred space. Our home fragrance range extends the KHEM world into your interiors — transforming rooms into temples of olfactory experience.",
    filterLabel: "Filter by type",
    filterAll: "All",
    empty: "New home fragrances are being prepared. Please return shortly.",
  },

  /**
   * `/ritual/[slug]` — the body-care and home-fragrance detail page.
   *
   * One section for two collection kinds, because they are one page shape. Only
   * the eyebrow differs, and it is keyed by `CollectionKind` so a renamed member
   * of that union is a compile error here rather than a blank line above a
   * product name.
   */
  ritual: {
    meta: {
      title: "The Ritual",
      description:
        "Body care and home fragrance from KHEM — each object presented with the materials it is made from and the story behind it.",
      ogTitle: "The Ritual | KHEM",
      ogDescription:
        "Three photographs and a short story for every mist and every room spray the house makes.",
    },
    /* Only `BODY` and `HOME` reach this page; the other kinds have no entry. */
    eyebrow: {
      BODY: "The Ritual",
      HOME: "Scent Your Sanctuary",
    } satisfies Record<Extract<CollectionKind, "BODY" | "HOME">, string>,
  },

  newArrival: {
    meta: {
      title: "New Arrivals",
      description:
        "The newest KHEM compositions — presented in full, with their stories, their pyramids, and the run they were released in.",
      ogTitle: "New Arrivals | KHEM",
      ogDescription:
        "Two new extraits from the Cairo atelier. Seen first, here.",
    },
    eyebrow: "Just Arrived",
    titleLead: "The New",
    titleAccent: "Compositions",
    description:
      "Twice a year the atelier releases what it has been working on. These are the newest additions to the house — each one presented in full, as it deserves to be.",
    heroImageAlt: "Dark marble veined with pale mineral light",
    /** Small counter under the hero — "Two new compositions". */
    count: "{count} new compositions",
    countOne: "One new composition",
    indexLabel: "Release",
    notes: {
      top: "Top",
      heart: "Heart",
      base: "Base",
    },
    cta: "Discover the Fragrance",
    closing: {
      eyebrow: "The Full Library",
      heading: "Everything else the house makes",
      body: "Three fragrance collections, body care, home fragrance, and the sets composed for giving — all in one place.",
      cta: "Browse the Collection",
    },
    empty: "The next release is being prepared. Please return shortly.",
  },

  giftSet: {
    meta: {
      title: "Gift Sets",
      description:
        "Full-size flacons, ritual objects, and hand-finished presentation — composed for the moment a fragrance is given.",
      ogTitle: "Gift Sets | KHEM",
      ogDescription:
        "The house presented as an offering. Lacquered boxes, wax seals, and cards written by hand.",
    },
    eyebrow: "Composed for Giving",
    titleLead: "Gift",
    titleAccent: "Sets",
    description:
      "A gift of fragrance is a gift of memory. Each set pairs full-size flacons and ritual objects with presentation finished by hand at the atelier — the box, the seal, and the card are part of the composition.",
    note: "Complimentary wrapping and a hand-written card with every set.",
    ritual: {
      presentation: {
        title: "Lacquered Presentation",
        body: "Every set arrives in a hand-lacquered box, wrapped in heavy paper and closed with a black wax seal.",
      },
      message: {
        title: "Written by Hand",
        body: "Your message is written onto a gold-embossed card at the atelier — never printed, never machine-lettered.",
      },
      delivery: {
        title: "Discreet Delivery",
        body: "Sets ship without pricing enclosed, and can be scheduled to arrive on the day you choose.",
      },
    },
    empty: "New gift sets are being prepared. Please return shortly.",
  },

  discovery: {
    meta: {
      title: "Discovery Sets",
      description:
        "Curated sample sets — explore the full KHEM olfactory world before committing to a full-size flacon.",
      ogTitle: "Discovery Sets | KHEM",
      ogDescription:
        "Every journey into KHEM should begin with discovery. Each purchase may be applied to a full-size order.",
    },
    eyebrow: "Begin Here",
    titleLead: "Discovery",
    titleAccent: "Sets",
    description:
      "Every journey into KHEM should begin with discovery. Our curated sets allow you to explore the full range of our olfactory world before committing to a full-size flacon.",
    note: "Each discovery purchase may be applied to full-size orders.",
    includes: "Includes",
    empty: "New discovery sets are being prepared. Please return shortly.",
    promise: {
      eyebrow: "The KHEM Promise",
      heading: "Discovery to Full Size",
      steps: {
        choose: {
          title: "Choose Your Set",
          body: "Select the discovery set that aligns with your curiosity — whether you are drawn to warmth and heritage, darkness and mystery, or wish to explore the complete KHEM world.",
        },
        discover: {
          title: "Discover Your Signature",
          body: "Wear each vial across different days and occasions. KHEM fragrances evolve dramatically on skin — give each one the time it deserves before deciding.",
        },
        unlock: {
          title: "Unlock Your Credit",
          body: "When you purchase a full-size flacon of any fragrance you discovered, your discovery set purchase price is applied as a credit toward the full bottle.",
        },
      },
    },
    compare: {
      eyebrow: "Compare",
      heading: "Which Set Is Right for You?",
      caption:
        "Discovery sets compared by contents, volume, presentation, and price.",
      rows: {
        vials: "Vials Included",
        volume: "Total Volume",
        box: "Collector's Box",
        booklet: "Story Booklet",
        credit: "Applies to Full Size",
        price: "Price",
      },
      yes: "Included",
      no: "Not included",
    },
  },

  cart: {
    meta: {
      title: "Shopping Bag",
      description:
        "Review the fragrances in your KHEM bag before checkout — complimentary delivery on orders over EGP 2,000.",
    },
    eyebrow: "Your Selection",
    heading: "The Cart",
    /*
     * Two forms rather than `Intl.PluralRules`: the counts on this page are
     * small, and neither locale needs the full category set to read correctly
     * at those sizes. Revisit alongside the note in `interpolate.ts` if a
     * quantity ever reaches the teens.
     */
    itemCountOne: "1 item",
    itemCount: "{count} items",
    summary: "Order Summary",
    subtotal: "Subtotal",
    shipping: "Shipping",
    complimentary: "Complimentary",
    freeShippingNudge: "Add {amount} more for complimentary delivery.",
    total: "Total",
    taxNote: "Taxes calculated at checkout",
    checkout: "Proceed to Checkout",
    continueShopping: "Continue Shopping",
    /** Visible label on the button; `remove` is its accessible name. */
    removeLabel: "Remove",
    remove: "Remove {name} from your bag",
    /** Announced when a quantity or total changes. */
    updated: "Bag updated. {count} items, {total}.",
    /**
     * The slide-in panel. It shares every other string on this block with
     * `/cart` — the two surfaces list the same bag and must not drift into
     * two vocabularies for it — and adds only what a panel needs that a page
     * does not.
     */
    drawer: {
      heading: "Shopping Bag",
      close: "Close shopping bag",
      /** Leads out of the panel to the full `/cart` page. */
      viewBag: "View Bag",
      error: "We could not load your bag just now.",
    },
    empty: {
      heading: "Your Cart is Empty",
      body: "Discover our collection of luxury fragrances and begin your journey with KHEM.",
      cta: "Explore Collections",
    },
  },

  /**
   * Checkout.
   *
   * `errors` is keyed by what `src/schemas/checkout.ts` puts in a Zod message.
   * That file writes **keys**, not sentences — unlike the admin schemas, whose
   * one reader is an English-only dashboard — so a validation message with no
   * entry here is a lookup miss the client shows as `errors.server`. Adding a
   * rule there means adding a line here and in `ar.ts`.
   */
  checkout: {
    meta: {
      title: "Checkout",
      description:
        "Complete your KHEM order — card or cash on delivery, wrapped and sealed in Cairo.",
    },
    eyebrow: "Final Step",
    heading: "Checkout",

    steps: {
      contact: "Contact",
      delivery: "Delivery",
      payment: "Payment",
    },

    contact: {
      name: "Full Name",
      namePlaceholder: "As it should appear on the parcel",
      email: "Email Address",
      emailPlaceholder: "you@example.com",
      emailHint: "Your receipt and every update are sent here.",
      phone: "Phone Number",
      phonePlaceholder: "+20 1X XXX XXXX",
      phoneHint: "The courier calls ahead before delivering.",
      signedInAs: "Signed in as {email}",
      guestNote:
        "Ordering as a guest. Create an account after checkout to follow this order.",
    },

    delivery: {
      line1: "Street Address",
      line1Placeholder: "Building, street, apartment",
      line2: "Landmark or Additional Detail",
      line2Placeholder: "Optional",
      city: "City",
      state: "Governorate",
      postalCode: "Postal Code",
      postalCodePlaceholder: "Optional",
      country: "Country",
      /** Under the country field once it has been resolved from the request. */
      countryDetected: "Chosen from your location — change it if that is not right.",
      outsideEgyptTitle: "We deliver within Egypt",
      outsideEgyptBody:
        "The country above is one the house does not ship to yet, so this order cannot be completed. If you are in Egypt, choose it from the list and you may carry on — otherwise write to us and we will tell you the moment that changes.",
      note: "Delivery Instructions",
      notePlaceholder: "Optional — a gate code, a preferred hour",
    },

    payment: {
      heading: "How would you like to pay?",
      card: {
        title: "Pay by Card",
        body: "Visa, Mastercard and Meeza. Encrypted and processed by Stripe.",
      },
      cash: {
        title: "Cash on Delivery",
        body: "Pay the courier in cash when your parcel arrives.",
      },
      /** Shown in place of the card option when Stripe is not configured. */
      cardUnavailable: "Card payment is temporarily unavailable.",
      cashNotice:
        "Please have the exact amount ready. Our courier does not carry change.",
      settlement:
        "Charged in Egyptian pounds ({amount}), whichever currency you are browsing in.",
      securedBy: "Secured by Stripe",
    },

    discount: {
      heading: "Discount Code",
      lede: "If the house has given you a code, enter it here. It is applied when your order is placed.",
      placeholder: "Enter your code",
      applied: "Discount",
      blockedByCredit:
        "A discount code cannot be combined with a Discovery Credit. Remove the credit above to use one.",
    },

    credit: {
      heading: "Discovery Credit",
      lede: "You have credit from a Discovery Set. It pays for one full-size fragrance and is used in full.",
      none: "Do not use a credit",
      use: "Apply {amount}",
      applied: "Discovery Credit",
      expires: "Expires {date}",
      forfeitNotice:
        "This credit is worth more than your bag. The difference is not carried over.",
      deliveryStillCharged: "Delivery is not covered by a credit.",
    },

    review: {
      heading: "Your Order",
      edit: "Edit bag",
      itemCountOne: "1 item",
      itemCount: "{count} items",
      subtotal: "Subtotal",
      delivery: "Delivery",
      complimentary: "Complimentary",
      total: "Total",
      taxNote: "All prices include tax.",
    },

    submit: {
      cash: "Place Order",
      card: "Pay {amount}",
      working: "Securing your order",
      /** Between placing the order and the card form appearing. */
      preparing: "Preparing secure payment",
    },

    empty: {
      heading: "Your Cart is Empty",
      body: "There is nothing to check out yet. Choose a fragrance and return here.",
      cta: "Explore Collections",
    },

    errors: {
      /* Field-level, keyed by the Zod messages in `src/schemas/checkout.ts`. */
      name: "Please tell us who this order is for.",
      nameLong: "That name is too long.",
      email: "Please enter a valid email address.",
      phone: "Please enter a phone number the courier can reach.",
      line1: "Please enter the street address.",
      line1Long: "That address line is too long.",
      line2Long: "That line is too long.",
      city: "Please enter the city.",
      cityLong: "That city name is too long.",
      state: "Please enter the governorate.",
      stateLong: "That governorate name is too long.",
      postalCodeLong: "That postal code is too long.",
      country: "Please enter the country.",
      countryLong: "That country name is too long.",
      outsideEgypt:
        "KHEM delivers within Egypt only. Choose Egypt as your country to continue.",
      noteLong: "Please keep delivery instructions under 500 characters.",
      quantity: "One of the quantities is not valid.",
      paymentMethod: "Please choose how you would like to pay.",
      locale: "Something went wrong with your language setting.",

      /* Form-level. */
      validation: "Some details need your attention.",
      emptyCart: "Your bag is empty.",
      tooManyLines: "That is more lines than one order can hold.",
      duplicateLines: "The same fragrance appears twice in your bag.",
      outOfStock:
        "One of your fragrances is no longer available in that quantity.",
      unavailable: "One of your fragrances is no longer available.",
      creditRejected: "Your Discovery Credit could not be applied.",
      discountRejected: "That discount code could not be applied.",
      cartChanged:
        "Your bag no longer matches our catalogue. Please review it and try again.",
      rateLimited: "Too many attempts. Please wait a few minutes and try again.",
      unconfigured:
        "Orders cannot be taken on this deployment. Please contact the house.",
      server: "Something went wrong on our side. Your card was not charged.",
      /* Card-specific, from Stripe or from the intent route. */
      payment: "Your payment could not be completed. Please try again.",
      paymentSetup:
        "We could not open a secure payment. Please try again in a moment.",
    },

    confirmed: {
      meta: {
        title: "Order Confirmed",
        description: "Your KHEM order has been received.",
      },
      eyebrow: "Thank You",
      heading: "Your order is confirmed",
      /** Cash orders. */
      headingCash: "Your order is confirmed",
      body: "It has reached the house in Cairo and is being prepared by hand.",
      bodyCash:
        "It has reached the house in Cairo and is being prepared by hand. Please have {amount} ready for the courier.",
      orderNumber: "Order",
      placedOn: "Placed",
      total: "Total",
      paymentMethod: "Payment",
      card: "Card",
      cash: "Cash on delivery",
      emailSent: "A confirmation is on its way to {email}.",
      emailSentGeneric: "A confirmation is on its way to you.",
      trackCta: "Track Your Order",
      createAccountCta: "Create an Account to Track It",
      continueCta: "Continue Exploring",
      notFound: {
        heading: "We cannot find that order",
        body: "The reference may be mistyped. If you have a confirmation email, its number is the one to use.",
        cta: "Return Home",
      },
    },
  },

  auth: {
    signIn: {
      meta: {
        title: "Sign In",
        description:
          "Sign in to your KHEM account to follow your orders, saved fragrances, and addresses.",
      },
      eyebrow: "The House",
      heading: "Enter the House",
      body: "Sign in to follow your orders, your saved fragrances, and your addresses.",
    },
    signUp: {
      meta: {
        title: "Create Account",
        description:
          "Create a KHEM account for early access to new releases, private events, and complimentary delivery.",
      },
      eyebrow: "Join the Circle",
      heading: "Create an Account",
      body: "Early access to new releases, invitations to private events, and complimentary delivery on every order.",
    },
    marketing: {
      label: "Email me with news and offers",
      note: "New releases, private events, and seasonal editions. You may unsubscribe at any time.",
    },
    /** Guest routes offered beneath the form — neither needs a session. */
    guestLead: "No account yet? You can still browse.",
    guestCart: "Your Bag",
  },

  account: {
    meta: {
      title: "Account",
      description: "Your KHEM account.",
    },
    eyebrow: "Welcome Back",
    /** Greets by first name; falls back to `headingFallback` when unnamed. */
    heading: "{name}",
    headingFallback: "Your Account",
    nav: {
      label: "Account sections",
      overview: "Overview",
      orders: "My Orders",
      addresses: "Addresses",
      profile: "Profile",
    },
    stats: {
      orders: "Total Orders",
      spent: "Total Spent",
      allTime: "All time",
    },
    recentOrder: "Recent Order",
    viewAllOrders: "View All",
    benefits: {
      heading: "Exclusive Member Benefits",
      body: "As a KHEM member, you receive early access to new releases, invitations to private events, and complimentary delivery on all orders.",
    },
    orders: {
      meta: {
        title: "My Orders",
        description: "Your KHEM order history.",
      },
      eyebrow: "Order History",
      heading: "My Orders",
      tracking: "Tracking: {code}",
      /** Marks the newest order in the list; the service does the sorting. */
      latest: "Latest",
      /*
       * The station rail. Keyed by the `OrderStatus` union like `status`
       * above, so a seventh status is a compile error rather than a blank
       * stop — but worded as *stops on a journey* rather than as states: a
       * customer reads "On Its Way", not "Shipped".
       */
      tracker: {
        label: "Order progress",
        PENDING: "Order Placed",
        PROCESSING: "Being Prepared",
        SHIPPED: "On Its Way",
        DELIVERED: "Delivered",
        CANCELLED: "Cancelled",
        REFUNDED: "Refunded",
      },
      status: {
        PENDING: "Pending",
        PROCESSING: "Processing",
        SHIPPED: "Shipped",
        DELIVERED: "Delivered",
        CANCELLED: "Cancelled",
        REFUNDED: "Refunded",
      },
      empty: {
        heading: "No Orders Yet",
        body: "When you place your first order, it will appear here with its tracking details.",
        cta: "Explore Collections",
      },
    },
    addresses: {
      meta: {
        title: "Addresses",
        description: "Your saved KHEM delivery addresses.",
      },
      eyebrow: "Saved Locations",
      heading: "Addresses",
      default: "Default",
      edit: "Edit",
      remove: "Remove",
      add: "+ Add New Address",
      empty: {
        heading: "No Saved Addresses",
        body: "Addresses you use at checkout will be kept here for next time.",
        cta: "Explore Collections",
      },
    },
    profile: {
      meta: {
        title: "Profile",
        description: "Your KHEM profile details.",
      },
      eyebrow: "Your Details",
      heading: "Profile",
    },
  },

  testimonials: {
    showFrom: "Show testimonial from {author}",
  },

  newsletter: {
    successHeading: "Welcome to the Circle",
    successBody: "You will receive a confirmation shortly.",
  },

  unsubscribe: {
    meta: {
      title: "Leave the Inner Circle",
      description: "Manage your KHEM Inner Circle subscription.",
    },
    eyebrow: "The Inner Circle",
    confirmHeading: "Leave the Inner Circle?",
    confirmBody:
      "You will stop receiving word of new compositions, private consultations, and notes from the perfumer. Your orders and account are untouched.",
    confirmButton: "Unsubscribe",
    working: "One moment",
    doneHeading: "You have been removed.",
    doneBody:
      "We will not write to you again. If it was a mistake, you are welcome back at any time from the foot of any page.",
    alreadyHeading: "You are already unsubscribed.",
    alreadyBody: "There is nothing further to do — the house is not writing to you.",
    invalidHeading: "That link is not valid.",
    invalidBody:
      "It may have already been used, or been altered in transit. Write to the house and a person will help.",
    failedBody: "Something went wrong. Please try that link once more.",
    home: "Return to the house",
  },

  forms: {
    name: "Name",
    email: "Email",
    subject: "Subject",
    message: "Message",
    send: "Send Message",
    sending: "Sending",
    subscribe: "Subscribe",
    newsletterPlaceholder: "Your email address",
    required: "This field is required",
    invalidEmail: "Please enter a valid email address",
    successMessage: "Thank you. We will respond shortly.",
    errorMessage: "Something went wrong. Please try again.",
    rateLimited: "Too many messages just now. Please try again in a few minutes.",
    deliveryFailed:
      "We could not send your message. Please try again, or write to info@khemperfumes.com directly.",
  },

  search: {
    meta: {
      title: "Search",
      titleWithQuery: "Search: {query}",
      description:
        "Search the KHEM library by name, note, or feeling — the Signature, Noir, and Gemstone fragrances alongside body care, home fragrance, and sets.",
      ogTitle: "Search | KHEM Perfumes",
      ogDescription: "Find a fragrance by its name, its notes, or the mood you are after.",
    },

    dialogLabel: "Search KHEM",
    inputLabel: "Search fragrances, notes, and collections",
    placeholder: "Oud, amber, something for winter…",
    close: "Close search",
    closeHint: "ESC",
    clear: "Clear search",

    eyebrow: "Search",
    headingEmpty: "Search",
    submit: "Search",

    recent: "Recent Searches",
    clearRecent: "Clear",
    popular: "Popular Searches",
    collections: "Collections",
    products: "Fragrances",

    loading: "Searching",
    resultCount: "{count} results",
    resultCountOne: "1 result",
    resultCountNone: "No results",

    noResults: "No matches for “{query}”",
    noResultsHint:
      "Try a note — oud, amber, jasmine — or the feeling you are after.",
    error: "Search is unavailable for a moment. Please try again.",
    enterHint: "Press Enter for all results",

    emptyPrompt: "What are you searching for?",
    emptyPromptBody:
      "Search by name, by note, or by the mood you want to wear — “something smoky for a winter night” works as well as “oud”.",
    browseCta: "Browse the Collections",

    /*
     * The chip's `term` is what gets searched and the `label` is what is shown.
     * They are separate because the catalog is stored in English: an Arabic
     * chip has to display Arabic and search English, or it would return nothing.
     */
    popularTerms: [
      { label: "Oud", term: "oud" },
      { label: "Amber", term: "amber" },
      { label: "Jasmine", term: "jasmine" },
      { label: "Incense", term: "incense" },
      { label: "Gift Sets", term: "gift set" },
      { label: "Discovery", term: "discovery" },
    ],
  },

  notFound: {
    heading: "Page Not Found",
    body: "The page you are seeking has slipped beyond our grasp — like perfume dispersing into warm air.",
    primary: "Return Home",
    secondary: "Explore Collections",
  },

  languageSwitcher: {
    label: "Change language",
  },

  /*
   * Display currency. The names are the visitor's own words for their currency,
   * not the ISO code — "Egyptian Pound", not "EGP" — because the switcher is
   * chrome, and chrome is translated. The prices themselves keep the ISO symbol
   * Intl gives them (`src/lib/format.ts`).
   */
  currencySwitcher: {
    label: "Change currency",
    names: {
      USD: "US Dollar",
      EGP: "Egyptian Pound",
      EUR: "Euro",
      GBP: "British Pound",
      AED: "UAE Dirham",
      SAR: "Saudi Riyal",
    },
    /*
     * Shown wherever a non-USD price is committed to — the buy block and the
     * bag. Prices outside USD are converted at an indicative rate, and saying
     * so is not optional: the card is charged in dollars.
     */
    conversionNote:
      "Shown in {currency} at an indicative rate. Your order is charged in Egyptian Pounds.",
  },

  /*
   * Cookie consent. The category names and descriptions deliberately echo the
   * table in the published Cookie Policy (the `"LegalDocument"` row) — the banner and
   * the policy must never describe different sets of cookies.
   */
  cookieConsent: {
    regionLabel: "Cookie consent",
    eyebrow: "Privacy",
    title: "Cookies at KHEM",
    body: "We use a small number of cookies to keep your bag intact, remember your preferences, and understand which pages are read. We run no advertising cookies and work with no ad networks — your browsing is never sold or shared.",
    policyLink: "Read the Cookie Policy",
    settingsLink: "Cookie Settings",
    acceptAll: "Accept All",
    decline: "Decline",
    managePreferences: "Manage Preferences",
    hidePreferences: "Hide Preferences",
    savePreferences: "Save Preferences",
    alwaysActive: "Always Active",
    lastUpdated: "Last updated {date}",
    categories: {
      essential: {
        name: "Essential",
        description:
          "Keeps you signed in, keeps your bag intact, and secures checkout. These cannot be switched off.",
      },
      preferences: {
        name: "Preferences",
        description:
          "Remembers your language, region, and the fragrances you have recently viewed.",
      },
      analytics: {
        name: "Analytics",
        description:
          "Anonymous, aggregated data on which pages are read and where visitors get stuck. It tells us what to fix; it does not tell us who you are.",
      },
    },
  },
};

/**
 * The contract every locale must satisfy.
 *
 * Deliberately inferred without `as const`: values widen to `string`, so other
 * locales are checked for *shape* (every key present, none extra) rather than
 * being forced to equal the English text.
 */
export type Dictionary = typeof en;
