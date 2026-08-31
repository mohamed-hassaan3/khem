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

import type { CollectionKind } from "@/src/types/catalog";

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

/**
 * A product this ingredient appears in.
 *
 * The shape `productHref()` takes, and deliberately so: a material can be used
 * in a candle or a body oil as easily as in a perfume, and those open on
 * `/ritual/[slug]` rather than `/perfume/[slug]`. Carrying the kind is what
 * stopped the "Found in" list from linking every usage into a 404.
 */
export interface IngredientUsage {
  name: string;
  /** Product slug. Where it resolves to is `productHref()`'s to say. */
  slug: string;
  /** Its collection's kind — the other half of a linkable product. */
  collectionKind: CollectionKind;
}

/**
 * The closed olfactive vocabulary an ingredient is catalogued against.
 *
 * A union rather than free-form strings: the badges on each card and the scent
 * profile pages (`src/lib/scent-profiles.ts`) read from the same seven labels,
 * so a typo in a record must fail typecheck instead of silently producing an
 * eighth family no profile can ever gather.
 *
 * The display order lives in the `"IngredientFamily"` table, whose rows a
 * trigger validates every `Ingredient.families` value against.
 */
export type IngredientFamily =
  | "Woody Aromas"
  | "Floral"
  | "Fresh / Citrus"
  | "Gourmand"
  | "Oriental Aromas"
  | "Aquatic Aromas"
  | "Herbal";

export interface Ingredient {
  id: string;
  name: string;
  slug: string;
  /** Botanical or zoological binomial, e.g. "Aquilaria malaccensis". */
  latinName: string;
  /** Sourcing region, e.g. "Laos & Cambodia". */
  origin: string;
  /**
   * Olfactive families, e.g. `["Woody Aromas", "Oriental Aromas"]`. An array
   * rather than a " · "-joined display string so filtering is a predicate, not
   * a substring match — this maps directly onto a Prisma `String[]` like
   * `Product.topNotes`.
   *
   * Finer descriptors (resinous, powdery, leathery…) deliberately live in
   * `description`, not here: badges stay inside the seven filterable families.
   */
  families: IngredientFamily[];
  /** Scarcity label, e.g. "Extremely Rare". */
  rarity: string;
  /** Relative cost, 1 (least) to 5 (most). Rendered as "$"×n. */
  priceTier: number;
  description: string;
  /** Perfumes built on this material. */
  usedIn: IngredientUsage[];
  /** Short provenance notes shown in the detail panel. */
  facts: string[];
  image: ContentImage;
}

export interface JournalArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  /**
   * The essay itself, as stored: blank lines separate blocks, `## ` opens a
   * subheading, `> ` opens a pull quote. Never HTML —
   * `parseArticleBody()` in `src/lib/journal/body.ts` turns it into blocks the
   * detail page renders as text nodes.
   *
   * Empty string on a list query, which selects `ARTICLE_CARD_COLUMNS` and
   * therefore never carries the body over the wire.
   */
  body: string;
  /**
   * ISO-8601 date. Never store a pre-formatted display string — formatting is
   * a presentation concern handled by `formatArticleDate()`.
   */
  publishedAt: string;
  /** Estimated reading time in minutes. Formatted at render, never stored as "8 min". */
  readTimeMinutes: number;
  /** Promoted to the large card at the top of `/journal`. */
  isFeatured: boolean;
  image: ContentImage;
}

/** One entry on the `/heritage` timeline. */
export interface TimelineEvent {
  id: string;
  /** Display year, e.g. "3000 BC" — not a date, so it stays a string. */
  year: string;
  title: string;
  description: string;
}

/** One of the brand values on `/heritage`. */
export interface BrandValue {
  id: string;
  title: string;
  description: string;
}

/** A mission or vision statement on `/about`. */
export interface MissionStatement {
  id: string;
  /** Section label, e.g. "Mission". */
  label: string;
  title: string;
  text: string;
}

/** One of the four numbered pillars in the Craftsmanship section. */
export interface CraftPillar {
  id: string;
  /** Display ordinal, e.g. "01". */
  number: string;
  title: string;
  description: string;
}

/**
 * One of the six numbered stages on `/craftsmanship`.
 *
 * Distinct from `CraftPillar`: the pillars are the home page's four-item
 * summary, these are the full atelier process.
 */
export interface CraftStep {
  id: string;
  /** Display ordinal, e.g. "01". Matches `CraftPillar.number`. */
  number: string;
  title: string;
  /** Italic gold line under the title, e.g. "Mouth-Blown. Hand-Polished. Singular." */
  subtitle: string;
  body: string;
  image: ContentImage;
}

/** One figure in the `/craftsmanship` stat band. */
export interface CraftStat {
  id: string;
  /**
   * Display figure, e.g. "300+" or "100%". Mixed units and nothing computes on
   * them, so a string — same reasoning as `TimelineEvent.year`.
   */
  value: string;
  label: string;
}

/**
 * A house statement from the atelier.
 *
 * Deliberately not a `Testimonial` despite the identical shape: that record set
 * is third-party press and feeds the home page carousel, so reusing it would
 * put the head perfumer among the critics.
 */
export interface CraftQuote {
  id: string;
  quote: string;
  author: string;
  /** Role, e.g. "Head Perfumer & Co-Founder, KHEM". */
  authorTitle: string;
}

// ── The landing-page hero ─────────────────────────────────────

/**
 * What the first screen of `/` is made of.
 *
 * `IMAGES` reads {@link HeroSlide}s and ignores the video fields; `VIDEO` reads
 * one video and ignores the slides. Never both — see the header of
 * `supabase/sql/0037_hero.sql`.
 */
export type HeroMediaType = "IMAGES" | "VIDEO";

/**
 * Where the headline, description and button sit in the frame.
 *
 * Named for the Latin-script reading, placed with logical properties: under
 * `dir="rtl"` `BOTTOM_LEFT` lands in the bottom *right*, which is the same
 * corner of the reading order. See `supabase/sql/0038_hero_content_position.sql`.
 */
export type HeroContentPosition = "CENTER" | "BOTTOM_LEFT";

/** One hero image, resolved to the active locale. */
export interface HeroSlide {
  id: string;
  imageUrl: string;
  /** Already resolved. Never empty — the column refuses it. */
  alt: string;
}

/**
 * The hero, as the storefront renders it.
 *
 * **Resolved and already filtered.** The service has chosen between each
 * English column and its `_ar` twin, and it has applied the three `show*`
 * booleans: a headline the desk switched off arrives as `null`, so the
 * component cannot render a heading nobody asked for and has no visibility rule
 * of its own to get wrong.
 *
 * `slides` is empty and `videoUrl` is null when the house has configured no
 * media. That is the unconfigured state, and the home page answers it with the
 * typographic composition it opened on before this table existed.
 */
export interface Hero {
  mediaType: HeroMediaType;
  contentPosition: HeroContentPosition;
  /** Milliseconds one slide holds. Meaningless with fewer than two slides. */
  slideDurationMs: number;
  slides: readonly HeroSlide[];
  videoUrl: string | null;
  videoPosterUrl: string | null;
  /** Resolved. Names the video for somebody who cannot see it. */
  videoAlt: string | null;
  headline: string | null;
  description: string | null;
  buttonLabel: string | null;
  /** An app path. `LocaleLink` prefixes it for the active locale. */
  buttonHref: string | null;
}

/** One hero image, as the dashboard edits it. */
export interface AdminHeroSlide {
  /** `null` for a row added in the editor and not yet written. */
  id: string | null;
  imageUrl: string;
  alt: string;
  altAr: string | null;
}

/**
 * The hero with both languages and the visibility flags, for the editor.
 *
 * The `show*` booleans are here and absent from {@link Hero} for the reason
 * given there: the storefront is handed a decision, the dashboard is handed the
 * switch.
 */
export interface AdminHero {
  mediaType: HeroMediaType;
  contentPosition: HeroContentPosition;
  slideDurationMs: number;
  videoUrl: string | null;
  videoPosterUrl: string | null;
  videoAlt: string | null;
  videoAltAr: string | null;
  showHeadline: boolean;
  showDescription: boolean;
  showButton: boolean;
  headline: string | null;
  headlineAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  buttonLabel: string | null;
  buttonLabelAr: string | null;
  buttonHref: string | null;
  slides: readonly AdminHeroSlide[];
}
