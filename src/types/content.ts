/**
 * Editorial content types.
 *
 * IMPORTANT: none of these are Prisma models. AGENTS.md §9 defines no table for
 * testimonials, ingredients, journal articles, or craft pillars. They are kept
 * in a separate module from `catalog.ts` precisely so that the boundary between
 * "already has a schema" and "still needs one" stays obvious.
 *
 * When these move server-side they will most likely become either Supabase
 * tables (`Article` is already implied by the pgvector/embedding requirement in
 * AGENTS.md §6) or a headless CMS. Either way the service layer absorbs it.
 */

/** A reusable image reference, matching the `url` + `alt` pair used in catalog images. */
export interface ContentImage {
  url: string;
  alt: string;
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  /** Role and city, e.g. "Perfume Critic, Cairo". */
  authorTitle: string;
}

export interface Ingredient {
  id: string;
  name: string;
  slug: string;
  /** Sourcing region, e.g. "Laos & Cambodia". */
  origin: string;
  image: ContentImage;
}

export interface JournalArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  /**
   * ISO-8601 date. Never store a pre-formatted display string — formatting is
   * a presentation concern handled by `formatArticleDate()`.
   */
  publishedAt: string;
  image: ContentImage;
}

/** One of the four numbered pillars in the Craftsmanship section. */
export interface CraftPillar {
  id: string;
  /** Display ordinal, e.g. "01". */
  number: string;
  title: string;
  description: string;
}
