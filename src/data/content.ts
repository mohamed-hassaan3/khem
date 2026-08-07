/**
 * Local seed data for editorial content.
 *
 * Same contract as `products.ts`: this is the only place these records are
 * hardcoded, and it is shaped for a straight insert into Supabase (or a CMS)
 * later. See `src/types/content.ts` for why these are not Prisma models yet.
 */

import type {
  CraftPillar,
  Ingredient,
  JournalArticle,
  Testimonial,
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
      "Kyphi Noir is unlike anything I have encountered. Ancient yet wholly modern. Extraordinary.",
    author: "James Whitmore",
    authorTitle: "Luxury Editor, Condé Nast",
  },
  {
    id: "sofia-marchetti",
    quote:
      "The attention to detail — from the bottle to the scent — signals a new era of Egyptian luxury.",
    author: "Sofia Marchetti",
    authorTitle: "Creative Director, Milan",
  },
];

export const INGREDIENTS: Ingredient[] = [
  {
    id: "oud",
    name: "Oud",
    slug: "oud",
    origin: "Laos & Cambodia",
    image: {
      url: "https://images.unsplash.com/photo-1607506740211-ff3d6b933dda?w=400&h=500&fit=crop&auto=format",
      alt: "Aged oud wood chips resting on dark stone",
    },
  },
  {
    id: "frankincense",
    name: "Frankincense",
    slug: "frankincense",
    origin: "Oman",
    image: {
      url: "https://images.unsplash.com/photo-1643797517714-a273548abc3c?w=400&h=500&fit=crop&auto=format",
      alt: "Frankincense resin tears in low golden light",
    },
  },
  {
    id: "saffron",
    name: "Saffron",
    slug: "saffron",
    origin: "Iran",
    image: {
      url: "https://images.unsplash.com/photo-1640975972263-1f73398e943b?w=400&h=500&fit=crop&auto=format",
      alt: "Hand-picked saffron threads gathered in a dark bowl",
    },
  },
  {
    id: "neroli",
    name: "Neroli",
    slug: "neroli",
    origin: "Egypt",
    image: {
      url: "https://images.unsplash.com/photo-1533603208986-24fd819e718a?w=400&h=500&fit=crop&auto=format",
      alt: "Neroli blossoms from the Egyptian bitter orange harvest",
    },
  },
  {
    id: "ambergris",
    name: "Ambergris",
    slug: "ambergris",
    origin: "Atlantic",
    image: {
      url: "https://images.unsplash.com/photo-1760860992203-85ca32536788?w=400&h=500&fit=crop&auto=format",
      alt: "A weathered piece of ambergris against deep shadow",
    },
  },
  {
    id: "rose-absolute",
    name: "Rose Absolute",
    slug: "rose-absolute",
    origin: "Grasse",
    image: {
      url: "https://images.unsplash.com/photo-1676950933747-5f886cadf014?w=400&h=500&fit=crop&auto=format",
      alt: "Rose petals from Grasse awaiting extraction",
    },
  },
];

export const JOURNAL_ARTICLES: JournalArticle[] = [
  {
    id: "alchemy-of-ancient-egyptian-perfumery",
    slug: "alchemy-of-ancient-egyptian-perfumery",
    title: "The Alchemy of Ancient Egyptian Perfumery",
    category: "Heritage",
    publishedAt: "2024-12-01",
    image: {
      url: "https://images.unsplash.com/photo-1762530211537-011645caef57?w=600&h=400&fit=crop&auto=format",
      alt: "Ancient Egyptian vessels used for blending sacred oils",
    },
  },
  {
    id: "following-oud-along-the-silk-road",
    slug: "following-oud-along-the-silk-road",
    title: "Following Oud Along the Silk Road",
    category: "Ingredients",
    publishedAt: "2024-11-01",
    image: {
      url: "https://images.unsplash.com/photo-1654612514062-7cc235e7b68c?w=600&h=400&fit=crop&auto=format",
      alt: "A caravan route at dusk, tracing the historic oud trade",
    },
  },
  {
    id: "inside-the-atelier-kyphi-noir",
    slug: "inside-the-atelier-kyphi-noir",
    title: "Inside the Atelier: The Making of Kyphi Noir",
    category: "Craftsmanship",
    publishedAt: "2024-10-01",
    image: {
      url: "https://images.unsplash.com/photo-1718728593303-94ec0352cf3d?w=600&h=400&fit=crop&auto=format",
      alt: "A perfumer's organ of raw materials inside the KHEM atelier",
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
