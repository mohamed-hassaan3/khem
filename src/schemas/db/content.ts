/**
 * Row schemas for the editorial content tables.
 *
 * Same contract as `catalog.ts`: rows are parsed, never asserted, and a
 * malformed one is dropped rather than allowed to blank the section it belongs
 * to. Where the database stores an image as two flat columns, the mapper
 * rebuilds the `{ url, alt }` pair the components read — the shape stays a
 * property of the type, not of the storage.
 */

import { z } from "zod";

import type { Locale } from "@/src/lib/i18n/config";
import {
  resolveList,
  resolveOptionalText,
  resolveText,
} from "@/src/lib/i18n/resolve";

import type {
  AdminHero,
  AdminHeroSlide,
  BrandValue,
  CraftPillar,
  CraftQuote,
  CraftStat,
  CraftStep,
  Hero,
  HeroSlide,
  Ingredient,
  JournalArticle,
  MissionStatement,
  Testimonial,
  TimelineEvent,
} from "@/src/types/content";

/**
 * The closed olfactive vocabulary, mirroring `IngredientFamily`.
 *
 * Exported so the dashboard's ingredient form offers exactly these seven and
 * cannot invent an eighth. That matters more than it looks: an `Ingredient`
 * carrying a family outside this enum fails `safeParse` and is **dropped by
 * `parseList`** — the whole material vanishes from `/ingredients`, silently.
 * The `"IngredientFamily"` table's trigger would happily allow it, so this enum
 * is the tighter of the two constraints and the one a form must respect.
 */
export const ingredientFamilySchema = z.enum([
  "Woody Aromas",
  "Floral",
  "Fresh / Citrus",
  "Gourmand",
  "Oriental Aromas",
  "Aquatic Aromas",
  "Herbal",
]);

// ── Testimonial ───────────────────────────────────────────────

export const TESTIMONIAL_COLUMNS = "id, quote, author, authorTitle";

const testimonialRowSchema = z.object({
  id: z.string(),
  quote: z.string(),
  author: z.string(),
  authorTitle: z.string(),
});

export function toTestimonial(row: unknown): Testimonial | null {
  const parsed = testimonialRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

// ── Ingredient ────────────────────────────────────────────────

/**
 * `usedIn` reaches through two foreign keys rather than one.
 *
 * `"IngredientUsage"."productSlug"` references `"Product".slug`
 * (`supabase/sql/0002_content.sql`), and a product's collection carries the
 * `kind` that decides which page it opens on. Selecting that one extra column
 * here is what lets the "Found in" list render through `productHref()` — a
 * material used in a candle links to `/ritual/…` instead of a `/perfume/…` URL
 * that would 404. No migration: existing tables, existing grants, one more
 * column on an embed that was already being made.
 */
export const INGREDIENT_COLUMNS =
  "id, name, name_ar, slug, latinName, origin, origin_ar, families, " +
  "rarity, rarity_ar, priceTier, description, description_ar, " +
  "facts, facts_ar, imageUrl, imageAlt, imageAlt_ar, " +
  "usedIn:IngredientUsage(name, productSlug, sortOrder, product:Product(collection:Collection(kind)))";

/** Mirrors `CollectionKind` — the same closed vocabulary `catalog.ts` parses. */
const collectionKindSchema = z.enum([
  "FRAGRANCE",
  "BODY",
  "HOME",
  "DISCOVERY",
  "GIFT",
]);

/*
 * PostgREST renders a to-one embed as an object on some versions and a
 * single-element array on others, so both are accepted — the same union
 * `catalog.ts` uses for `collection:Collection(...)`, and for the same reason:
 * a shape difference must not blank a section.
 */
const embeddedKind = z.object({ kind: collectionKindSchema });

const embeddedProduct = z.object({
  collection: z.union([embeddedKind, z.array(embeddedKind).min(1)]),
});

const ingredientUsageRowSchema = z.object({
  name: z.string(),
  productSlug: z.string(),
  sortOrder: z.number().default(0),
  /*
   * Nullable and optional on purpose. A product hidden by RLS comes back as
   * `null`, and a query made before this embed existed carries nothing at all;
   * either way the usage falls back to `"FRAGRANCE"` below, which is exactly
   * the behaviour that shipped before — a widened `select` can degrade, but it
   * can never empty the list.
   */
  product: z
    .union([embeddedProduct, z.array(embeddedProduct).min(1)])
    .nullable()
    .default(null),
});

function first<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

const ingredientRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  name_ar: z.string().nullable().default(null),
  slug: z.string(),
  // No twin: a binomial is Latin in both trees, which is the whole point of one.
  latinName: z.string(),
  origin: z.string(),
  origin_ar: z.string().nullable().default(null),
  // Not translated per row: the seven families are a closed vocabulary, and the
  // `label_ar` on `"IngredientFamily"` is unread — see `toIngredient` below.
  families: z.array(ingredientFamilySchema),
  rarity: z.string(),
  rarity_ar: z.string().nullable().default(null),
  priceTier: z.number(),
  description: z.string(),
  description_ar: z.string().nullable().default(null),
  facts: z.array(z.string()),
  facts_ar: z.array(z.string()).nullable().default(null),
  imageUrl: z.string(),
  imageAlt: z.string(),
  imageAlt_ar: z.string().nullable().default(null),
  usedIn: z.array(ingredientUsageRowSchema).default([]),
});

export function toIngredient(row: unknown, locale: Locale): Ingredient | null {
  const parsed = ingredientRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const {
    imageUrl,
    imageAlt,
    imageAlt_ar,
    name_ar,
    origin_ar,
    rarity_ar,
    description_ar,
    facts_ar,
    usedIn,
    ...ingredient
  } = parsed.data;

  return {
    ...ingredient,
    name: resolveText(ingredient.name, name_ar, locale),
    origin: resolveText(ingredient.origin, origin_ar, locale),
    rarity: resolveText(ingredient.rarity, rarity_ar, locale),
    description: resolveText(ingredient.description, description_ar, locale),
    /*
     * `resolveList`, not a per-item resolve: the fallback is all-or-nothing. A
     * provenance panel half in Arabic and half in English reads as a bug, and a
     * shorter Arabic array must never be zipped against the English one.
     */
    facts: resolveList(ingredient.facts, facts_ar, locale),
    usedIn: [...usedIn]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((usage) => ({
        name: usage.name,
        slug: usage.productSlug,
        collectionKind: usage.product
          ? first(first(usage.product).collection).kind
          : "FRAGRANCE",
      })),
    image: { url: imageUrl, alt: resolveText(imageAlt, imageAlt_ar, locale) },
  };
}

/**
 * The dashboard's projection.
 *
 * Both languages unresolved, plus `sortOrder`, plus the usage rows with the
 * ids the desk needs to change them. No product embed: the admin list shows
 * which perfumes a material is in, not what kind of collection each belongs to.
 */
export const ADMIN_INGREDIENT_COLUMNS =
  "id, name, name_ar, slug, latinName, origin, origin_ar, families, " +
  "rarity, rarity_ar, priceTier, description, description_ar, " +
  "facts, facts_ar, imageUrl, imageAlt, imageAlt_ar, sortOrder, " +
  "usedIn:IngredientUsage(id, name, productSlug, sortOrder)";

const adminIngredientRowSchema = ingredientRowSchema
  .omit({ usedIn: true })
  .extend({
    sortOrder: z.coerce.number().default(0),
    usedIn: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          productSlug: z.string(),
          sortOrder: z.coerce.number().default(0),
        }),
      )
      .default([]),
  });

export type AdminIngredient = z.infer<typeof adminIngredientRowSchema>;

export function toAdminIngredient(row: unknown): AdminIngredient | null {
  const parsed = adminIngredientRowSchema.safeParse(row);
  if (!parsed.success) return null;

  return {
    ...parsed.data,
    usedIn: [...parsed.data.usedIn].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

// ── Article ───────────────────────────────────────────────────

/**
 * Everything a card needs, and nothing more.
 *
 * The body of a fifteen-minute essay has no business travelling with a grid of
 * six cards, and `embedding` — 1536 floats — has no business leaving the
 * database at all. Both are absent here by construction rather than by
 * discipline at each call site.
 */
export const ARTICLE_CARD_COLUMNS =
  "id, slug, title, category, excerpt, publishedAt, readTimeMinutes, isFeatured, " +
  "imageUrl, imageAlt";

/** The card projection plus the essay. Only `getArticleBySlug()` asks for it. */
export const ARTICLE_COLUMNS = `${ARTICLE_CARD_COLUMNS}, body`;

const articleRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  excerpt: z.string(),
  /* A `date` column; PostgREST renders it as `YYYY-MM-DD`, which is the ISO-8601
   * the type promises and `formatArticleDate()` parses. */
  publishedAt: z.string(),
  readTimeMinutes: z.number(),
  isFeatured: z.boolean(),
  imageUrl: z.string(),
  imageAlt: z.string(),
  /*
   * Absent from a card projection and present on the detail one, which is why
   * it defaults rather than being required. The column itself is
   * `not null default ''` in Postgres, so the default describes the *query*,
   * not a row that could be missing the value.
   *
   * One schema for both projections rather than two: a second schema is a
   * second place to add the next column to, and forgetting it there would fail
   * a page rather than a type check.
   */
  body: z.string().default(""),
});

export function toArticle(row: unknown): JournalArticle | null {
  const parsed = articleRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { imageUrl, imageAlt, ...article } = parsed.data;
  return { ...article, image: { url: imageUrl, alt: imageAlt } };
}

// ── Heritage and About ────────────────────────────────────────

/*
 * `year` is display text ("3000 BC"), not a date, so it translates — "٣٠٠٠ ق.م"
 * — which is why `year_ar` exists at all. See `supabase/sql/0008_i18n_content.sql`.
 */
export const TIMELINE_COLUMNS =
  "id, year, year_ar, title, title_ar, description, description_ar";

const timelineRowSchema = z.object({
  id: z.string(),
  year: z.string(),
  year_ar: z.string().nullable().default(null),
  title: z.string(),
  title_ar: z.string().nullable().default(null),
  description: z.string(),
  description_ar: z.string().nullable().default(null),
});

export function toTimelineEvent(
  row: unknown,
  locale: Locale,
): TimelineEvent | null {
  const parsed = timelineRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { year_ar, title_ar, description_ar, ...event } = parsed.data;

  return {
    ...event,
    year: resolveText(event.year, year_ar, locale),
    title: resolveText(event.title, title_ar, locale),
    description: resolveText(event.description, description_ar, locale),
  };
}

/** The dashboard's projection — both languages unresolved, plus the order. */
export const ADMIN_TIMELINE_COLUMNS = `${TIMELINE_COLUMNS}, sortOrder`;

const adminTimelineRowSchema = timelineRowSchema.extend({
  sortOrder: z.coerce.number().default(0),
});

export type AdminTimelineEvent = z.infer<typeof adminTimelineRowSchema>;

export function toAdminTimelineEvent(row: unknown): AdminTimelineEvent | null {
  const parsed = adminTimelineRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const BRAND_VALUE_COLUMNS =
  "id, title, title_ar, description, description_ar";

const brandValueRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  title_ar: z.string().nullable().default(null),
  description: z.string(),
  description_ar: z.string().nullable().default(null),
});

export function toBrandValue(row: unknown, locale: Locale): BrandValue | null {
  const parsed = brandValueRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { title_ar, description_ar, ...value } = parsed.data;

  return {
    ...value,
    title: resolveText(value.title, title_ar, locale),
    description: resolveText(value.description, description_ar, locale),
  };
}

export const ADMIN_BRAND_VALUE_COLUMNS = `${BRAND_VALUE_COLUMNS}, sortOrder`;

const adminBrandValueRowSchema = brandValueRowSchema.extend({
  sortOrder: z.coerce.number().default(0),
});

export type AdminBrandValue = z.infer<typeof adminBrandValueRowSchema>;

export function toAdminBrandValue(row: unknown): AdminBrandValue | null {
  const parsed = adminBrandValueRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const MISSION_STATEMENT_COLUMNS =
  "id, label, label_ar, title, title_ar, text, text_ar";

const missionStatementRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  label_ar: z.string().nullable().default(null),
  title: z.string(),
  title_ar: z.string().nullable().default(null),
  text: z.string(),
  text_ar: z.string().nullable().default(null),
});

export function toMissionStatement(
  row: unknown,
  locale: Locale,
): MissionStatement | null {
  const parsed = missionStatementRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { label_ar, title_ar, text_ar, ...statement } = parsed.data;

  return {
    ...statement,
    label: resolveText(statement.label, label_ar, locale),
    title: resolveText(statement.title, title_ar, locale),
    text: resolveText(statement.text, text_ar, locale),
  };
}

export const ADMIN_MISSION_STATEMENT_COLUMNS = `${MISSION_STATEMENT_COLUMNS}, sortOrder`;

const adminMissionStatementRowSchema = missionStatementRowSchema.extend({
  sortOrder: z.coerce.number().default(0),
});

export type AdminMissionStatement = z.infer<typeof adminMissionStatementRowSchema>;

export function toAdminMissionStatement(
  row: unknown,
): AdminMissionStatement | null {
  const parsed = adminMissionStatementRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

// ── Craftsmanship ─────────────────────────────────────────────

/* `number` ("01") is an ordinal in Western digits in both trees — no twin. */
export const CRAFT_PILLAR_COLUMNS =
  "id, number, title, title_ar, description, description_ar";

const craftPillarRowSchema = z.object({
  id: z.string(),
  number: z.string(),
  title: z.string(),
  title_ar: z.string().nullable().default(null),
  description: z.string(),
  description_ar: z.string().nullable().default(null),
});

export function toCraftPillar(row: unknown, locale: Locale): CraftPillar | null {
  const parsed = craftPillarRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { title_ar, description_ar, ...pillar } = parsed.data;

  return {
    ...pillar,
    title: resolveText(pillar.title, title_ar, locale),
    description: resolveText(pillar.description, description_ar, locale),
  };
}

/** The dashboard's projection — both languages unresolved, plus the order. */
export const ADMIN_CRAFT_PILLAR_COLUMNS = `${CRAFT_PILLAR_COLUMNS}, sortOrder`;

const adminCraftPillarRowSchema = craftPillarRowSchema.extend({
  sortOrder: z.coerce.number().default(0),
});

export type AdminCraftPillar = z.infer<typeof adminCraftPillarRowSchema>;

export function toAdminCraftPillar(row: unknown): AdminCraftPillar | null {
  const parsed = adminCraftPillarRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const CRAFT_STEP_COLUMNS =
  "id, number, title, title_ar, subtitle, subtitle_ar, body, body_ar, " +
  "imageUrl, imageAlt, imageAlt_ar";

const craftStepRowSchema = z.object({
  id: z.string(),
  // No twin: an ordinal in Western digits in both trees, like `CraftPillar`.
  number: z.string(),
  title: z.string(),
  title_ar: z.string().nullable().default(null),
  subtitle: z.string(),
  subtitle_ar: z.string().nullable().default(null),
  body: z.string(),
  body_ar: z.string().nullable().default(null),
  // The photograph is one file in both trees; only what it is *called* changes.
  imageUrl: z.string(),
  imageAlt: z.string(),
  imageAlt_ar: z.string().nullable().default(null),
});

export function toCraftStep(row: unknown, locale: Locale): CraftStep | null {
  const parsed = craftStepRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const {
    imageUrl,
    imageAlt,
    imageAlt_ar,
    title_ar,
    subtitle_ar,
    body_ar,
    ...step
  } = parsed.data;

  return {
    ...step,
    title: resolveText(step.title, title_ar, locale),
    subtitle: resolveText(step.subtitle, subtitle_ar, locale),
    body: resolveText(step.body, body_ar, locale),
    image: { url: imageUrl, alt: resolveText(imageAlt, imageAlt_ar, locale) },
  };
}

export const ADMIN_CRAFT_STEP_COLUMNS = `${CRAFT_STEP_COLUMNS}, sortOrder`;

const adminCraftStepRowSchema = craftStepRowSchema.extend({
  sortOrder: z.coerce.number().default(0),
});

export type AdminCraftStep = z.infer<typeof adminCraftStepRowSchema>;

export function toAdminCraftStep(row: unknown): AdminCraftStep | null {
  const parsed = adminCraftStepRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const CRAFT_STAT_COLUMNS = "id, value, value_ar, label, label_ar";

const craftStatRowSchema = z.object({
  id: z.string(),
  value: z.string(),
  /*
   * Only for figures that carry a *word*. "300+" and "100%" read identically in
   * both scripts and are left null to fall back — see
   * `supabase/sql/0008_i18n_content.sql`.
   */
  value_ar: z.string().nullable().default(null),
  label: z.string(),
  label_ar: z.string().nullable().default(null),
});

export function toCraftStat(row: unknown, locale: Locale): CraftStat | null {
  const parsed = craftStatRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { value_ar, label_ar, ...stat } = parsed.data;

  return {
    ...stat,
    value: resolveText(stat.value, value_ar, locale),
    label: resolveText(stat.label, label_ar, locale),
  };
}

export const ADMIN_CRAFT_STAT_COLUMNS = `${CRAFT_STAT_COLUMNS}, sortOrder`;

const adminCraftStatRowSchema = craftStatRowSchema.extend({
  sortOrder: z.coerce.number().default(0),
});

export type AdminCraftStat = z.infer<typeof adminCraftStatRowSchema>;

export function toAdminCraftStat(row: unknown): AdminCraftStat | null {
  const parsed = adminCraftStatRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const CRAFT_QUOTE_COLUMNS =
  "id, quote, quote_ar, author, author_ar, authorTitle, authorTitle_ar";

const craftQuoteRowSchema = z.object({
  id: z.string(),
  quote: z.string(),
  quote_ar: z.string().nullable().default(null),
  author: z.string(),
  // A name is a proper noun; the twin exists for names genuinely written in
  // Arabic script and is null otherwise.
  author_ar: z.string().nullable().default(null),
  authorTitle: z.string(),
  authorTitle_ar: z.string().nullable().default(null),
});

export function toCraftQuote(row: unknown, locale: Locale): CraftQuote | null {
  const parsed = craftQuoteRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { quote_ar, author_ar, authorTitle_ar, ...craftQuote } = parsed.data;

  return {
    ...craftQuote,
    quote: resolveText(craftQuote.quote, quote_ar, locale),
    author: resolveText(craftQuote.author, author_ar, locale),
    authorTitle: resolveText(craftQuote.authorTitle, authorTitle_ar, locale),
  };
}

/**
 * The dashboard's projection.
 *
 * Carries `isPublished`, which the public column list does not need: the RLS
 * policy on `"CraftQuote"` filters unpublished rows out before they are read,
 * so a public query never sees one. The dashboard reads with the secret key and
 * must see them, which is the whole reason the flag is editable here.
 */
export const ADMIN_CRAFT_QUOTE_COLUMNS = `${CRAFT_QUOTE_COLUMNS}, isPublished, sortOrder`;

const adminCraftQuoteRowSchema = craftQuoteRowSchema.extend({
  isPublished: z.boolean().default(true),
  sortOrder: z.coerce.number().default(0),
});

export type AdminCraftQuote = z.infer<typeof adminCraftQuoteRowSchema>;

export function toAdminCraftQuote(row: unknown): AdminCraftQuote | null {
  const parsed = adminCraftQuoteRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

// ── Hero ──────────────────────────────────────────────────────

const heroMediaTypeSchema = z.enum(["IMAGES", "VIDEO"]);

const heroContentPositionSchema = z.enum(["CENTER", "BOTTOM_LEFT"]);

export const HERO_SLIDE_COLUMNS = "id, imageUrl, alt, alt_ar";

const heroSlideRowSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  alt: z.string(),
  alt_ar: z.string().nullable().default(null),
});

export function toHeroSlide(row: unknown, locale: Locale): HeroSlide | null {
  const parsed = heroSlideRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { alt_ar, ...slide } = parsed.data;

  return { ...slide, alt: resolveText(slide.alt, alt_ar, locale) };
}

export const HERO_SETTING_COLUMNS =
  "mediaType, contentPosition, slideDurationMs, videoUrl, videoPosterUrl, videoAlt, " +
  "videoAlt_ar, showHeadline, showDescription, showButton, headline, " +
  "headline_ar, description, description_ar, buttonLabel, buttonLabel_ar, " +
  "buttonHref";

const heroSettingRowSchema = z.object({
  mediaType: heroMediaTypeSchema.default("IMAGES"),
  contentPosition: heroContentPositionSchema.catch("CENTER"),
  slideDurationMs: z.coerce.number().default(6000),
  videoUrl: z.string().nullable().default(null),
  videoPosterUrl: z.string().nullable().default(null),
  videoAlt: z.string().nullable().default(null),
  videoAlt_ar: z.string().nullable().default(null),
  showHeadline: z.boolean().default(false),
  showDescription: z.boolean().default(false),
  showButton: z.boolean().default(false),
  headline: z.string().nullable().default(null),
  headline_ar: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  description_ar: z.string().nullable().default(null),
  buttonLabel: z.string().nullable().default(null),
  buttonLabel_ar: z.string().nullable().default(null),
  buttonHref: z.string().nullable().default(null),
});

/**
 * The storefront's hero, with every decision already made.
 *
 * Two of those decisions are worth naming, because they are the reason this
 * mapper exists rather than the component reading the row:
 *
 * 1. **The `show*` flags are applied here.** A headline that is switched off, or
 *    switched on with nothing typed into it, both arrive as `null` — so the
 *    component's only question is "is there a headline", and there is no second
 *    visibility rule in the view layer to disagree with this one.
 * 2. **The media branch is applied here.** A hero in `VIDEO` mode is handed no
 *    slides and a hero in `IMAGES` mode is handed no video, whatever the row
 *    happens to still hold from a previous campaign. The columns keep their
 *    values so an editor can switch back; the storefront never sees the half it
 *    is not showing.
 *
 * A button survives only with both a label and a destination. The database says
 * the same thing in a check constraint; this is the defensive half, for a row
 * written before that constraint existed.
 */
export function toHero(
  row: unknown,
  slideRows: readonly unknown[] | null,
  locale: Locale,
): Hero | null {
  const parsed = heroSettingRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const setting = parsed.data;
  const isVideo = setting.mediaType === "VIDEO";

  const slides = isVideo
    ? []
    : (slideRows ?? [])
        .map((slideRow) => toHeroSlide(slideRow, locale))
        .filter((slide): slide is HeroSlide => slide !== null);

  const headline = setting.showHeadline
    ? resolveOptionalText(setting.headline, setting.headline_ar, locale)
    : null;
  const description = setting.showDescription
    ? resolveOptionalText(setting.description, setting.description_ar, locale)
    : null;
  const buttonLabel = setting.showButton
    ? resolveOptionalText(setting.buttonLabel, setting.buttonLabel_ar, locale)
    : null;
  const buttonHref = setting.showButton ? setting.buttonHref : null;

  const hasButton = buttonLabel !== null && buttonHref !== null;

  return {
    mediaType: setting.mediaType,
    contentPosition: setting.contentPosition,
    slideDurationMs: setting.slideDurationMs,
    slides,
    videoUrl: isVideo ? setting.videoUrl : null,
    videoPosterUrl: isVideo ? setting.videoPosterUrl : null,
    videoAlt: isVideo
      ? resolveOptionalText(setting.videoAlt, setting.videoAlt_ar, locale)
      : null,
    headline,
    description,
    buttonLabel: hasButton ? buttonLabel : null,
    buttonHref: hasButton ? buttonHref : null,
  };
}

/** The dashboard's projection — both languages, the flags, and the order. */
export const ADMIN_HERO_SLIDE_COLUMNS = `${HERO_SLIDE_COLUMNS}, sortOrder`;

const adminHeroSlideRowSchema = heroSlideRowSchema.extend({
  sortOrder: z.coerce.number().default(0),
});

export function toAdminHeroSlide(row: unknown): AdminHeroSlide | null {
  const parsed = adminHeroSlideRowSchema.safeParse(row);
  if (!parsed.success) return null;

  return {
    id: parsed.data.id,
    imageUrl: parsed.data.imageUrl,
    alt: parsed.data.alt,
    altAr: parsed.data.alt_ar,
  };
}

export const ADMIN_HERO_SETTING_COLUMNS = HERO_SETTING_COLUMNS;

/**
 * The hero as the editor holds it: nothing resolved, nothing filtered.
 *
 * `resolveText()` would hand back the English fallback for an empty Arabic
 * field, and saving that would write the English copy into the Arabic column as
 * though somebody had translated it — the reason `src/services/admin/content.ts`
 * gives at the top for every one of these twins.
 */
export function toAdminHero(
  row: unknown,
  slideRows: readonly unknown[] | null,
): AdminHero | null {
  const parsed = heroSettingRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const setting = parsed.data;

  return {
    mediaType: setting.mediaType,
    contentPosition: setting.contentPosition,
    slideDurationMs: setting.slideDurationMs,
    videoUrl: setting.videoUrl,
    videoPosterUrl: setting.videoPosterUrl,
    videoAlt: setting.videoAlt,
    videoAltAr: setting.videoAlt_ar,
    showHeadline: setting.showHeadline,
    showDescription: setting.showDescription,
    showButton: setting.showButton,
    headline: setting.headline,
    headlineAr: setting.headline_ar,
    description: setting.description,
    descriptionAr: setting.description_ar,
    buttonLabel: setting.buttonLabel,
    buttonLabelAr: setting.buttonLabel_ar,
    buttonHref: setting.buttonHref,
    slides: (slideRows ?? [])
      .map(toAdminHeroSlide)
      .filter((slide): slide is AdminHeroSlide => slide !== null),
  };
}
