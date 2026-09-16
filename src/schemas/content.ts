/**
 * Editorial content write validation.
 *
 * Covers the flat tables in `supabase/sql/0002_content.sql` that
 * `/admin/content` edits. Phase 5a is the heritage timeline and the craft
 * pillars; the remaining tables land here beside them, because they are the
 * same shape and splitting them across files would only hide that.
 *
 * ## The shared shape
 *
 * A hand-typed id, some text columns, an Arabic twin for each column that is
 * genuinely display copy, and a `sortOrder`. What differs between tables is
 * only *which* columns translate, and that is a content decision recorded in
 * `supabase/sql/0008_i18n_content.sql`:
 *
 *  - `TimelineEvent.year` **does** translate — it is display text ("3000 BC" →
 *    "٣٠٠٠ ق.م"), not a date;
 *  - `CraftPillar.number` **does not** — "01" is an ordinal in Western digits
 *    in both trees.
 *
 * English sentences, not error codes: the dashboard has one reader.
 */

import { z } from "zod";

import { ingredientFamilySchema } from "./db/content";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Empty string means "no translation yet" — a form input cannot hold null. */
function optionalText(max: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value.length === 0 ? null : value));
}

function requiredText(min: number, max: number, missing: string, tooLong: string) {
  return z.string().trim().min(min, missing).max(max, tooLong);
}

const idField = z
  .string()
  .trim()
  .min(2, "Give this a short id.")
  .max(64, "That id is too long.")
  .regex(ID_PATTERN, "Lowercase letters, numbers and hyphens only.");

const sortOrderField = z.coerce
  .number({ error: "Enter a number." })
  .int("Whole numbers only.")
  .min(0, "Cannot be negative.")
  .max(9_999, "That is too large.")
  .default(0);

/** Create and update differ only in how strictly the id is checked. */
function pair<T extends z.ZodRawShape>(fields: z.ZodObject<T>) {
  return {
    create: fields.extend({ id: idField }),
    update: fields.extend({ id: z.string().trim().min(1, "Which row?") }),
    remove: z.object({ id: z.string().trim().min(1, "Which row?") }),
  };
}

// ── TimelineEvent — /heritage ─────────────────────────────────

const timelineFields = z.object({
  year: requiredText(1, 40, "Which year?", "That is too long."),
  // Display text, so it translates. Western digits are conventional in Arabic
  // too, but the era marker is not — "BC" becomes "ق.م".
  year_ar: optionalText(40, "That is too long."),

  title: requiredText(2, 120, "What happened?", "That title is too long."),
  title_ar: optionalText(120, "That title is too long."),

  description: requiredText(
    2,
    1_000,
    "Describe the moment.",
    "That description is too long.",
  ),
  description_ar: optionalText(1_000, "That description is too long."),

  sortOrder: sortOrderField,
});

export const {
  create: createTimelineEventSchema,
  update: updateTimelineEventSchema,
  remove: deleteTimelineEventSchema,
} = pair(timelineFields);

// ── CraftPillar — the home page ───────────────────────────────

const craftPillarFields = z.object({
  // No Arabic twin: "01" reads identically in both trees.
  number: requiredText(1, 8, "Give it an ordinal, like 01.", "That is too long."),

  title: requiredText(2, 120, "What is this pillar?", "That title is too long."),
  title_ar: optionalText(120, "That title is too long."),

  description: requiredText(
    2,
    1_000,
    "Describe it.",
    "That description is too long.",
  ),
  description_ar: optionalText(1_000, "That description is too long."),

  sortOrder: sortOrderField,
});

export const {
  create: createCraftPillarSchema,
  update: updateCraftPillarSchema,
  remove: deleteCraftPillarSchema,
} = pair(craftPillarFields);

/**
 * A checkbox arriving from {@link ContentRowsEditor}.
 *
 * **Not `z.coerce.boolean()`.** Every value in that editor is a string, and
 * `Boolean("false")` is `true` — so coercion would make an unpublished row
 * impossible to save and give no error while doing it. This compares instead.
 */
const booleanField = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === "boolean" ? value : value === "true"))
  .default(true);

// ── Testimonial — home page ──────────────────────────────────

const testimonialFields = z.object({
  quote: requiredText(2, 1_000, "What was said?", "That quote is too long."),
  quote_ar: optionalText(1_000, "That quote is too long."),
  author: requiredText(2, 120, "Who said it?", "That name is too long."),
  author_ar: optionalText(120, "That name is too long."),
  authorTitle: requiredText(2, 160, "What is their role?", "That is too long."),
  authorTitle_ar: optionalText(160, "That is too long."),
  isPublished: booleanField,
  sortOrder: sortOrderField,
});

export const {
  create: createTestimonialSchema,
  update: updateTestimonialSchema,
  remove: deleteTestimonialSchema,
} = pair(testimonialFields);

// ── BrandValue — /heritage ────────────────────────────────────

const brandValueFields = z.object({
  title: requiredText(2, 120, "What is this value?", "That title is too long."),
  title_ar: optionalText(120, "That title is too long."),
  description: requiredText(2, 1_000, "Describe it.", "That description is too long."),
  description_ar: optionalText(1_000, "That description is too long."),
  sortOrder: sortOrderField,
});

export const {
  create: createBrandValueSchema,
  update: updateBrandValueSchema,
  remove: deleteBrandValueSchema,
} = pair(brandValueFields);

// ── MissionStatement — /about ─────────────────────────────────

const missionStatementFields = z.object({
  label: requiredText(1, 60, "Give the section a label.", "That label is too long."),
  label_ar: optionalText(60, "That label is too long."),
  title: requiredText(2, 160, "What is the statement?", "That title is too long."),
  title_ar: optionalText(160, "That title is too long."),
  text: requiredText(2, 2_000, "Write the statement.", "That is too long."),
  text_ar: optionalText(2_000, "That is too long."),
  sortOrder: sortOrderField,
});

export const {
  create: createMissionStatementSchema,
  update: updateMissionStatementSchema,
  remove: deleteMissionStatementSchema,
} = pair(missionStatementFields);

// ── CraftStep — /craftsmanship ────────────────────────────────

const craftStepFields = z.object({
  // No Arabic twin: an ordinal in Western digits in both trees.
  number: requiredText(1, 8, "Give it an ordinal, like 01.", "That is too long."),
  title: requiredText(2, 120, "What is this stage?", "That title is too long."),
  title_ar: optionalText(120, "That title is too long."),
  subtitle: requiredText(2, 200, "Write the gold line.", "That is too long."),
  subtitle_ar: optionalText(200, "That is too long."),
  body: requiredText(2, 2_000, "Describe the stage.", "That is too long."),
  body_ar: optionalText(2_000, "That is too long."),

  // One photograph in both trees; only what it is *called* changes.
  imageUrl: z
    .string()
    .trim()
    .min(1, "This stage needs a photograph.")
    .refine((value) => /^https?:\/\/\S+$/.test(value), "That is not a valid URL."),
  imageAlt: requiredText(
    2,
    200,
    "Describe the photograph for anyone who cannot see it.",
    "That description is too long.",
  ),
  imageAlt_ar: optionalText(200, "That description is too long."),

  sortOrder: sortOrderField,
});

export const {
  create: createCraftStepSchema,
  update: updateCraftStepSchema,
  remove: deleteCraftStepSchema,
} = pair(craftStepFields);

// ── CraftStat — /craftsmanship ────────────────────────────────

const craftStatFields = z.object({
  value: requiredText(1, 20, "What is the figure?", "That is too long."),
  // Only for figures carrying a word — "300+" and "100%" read the same in both
  // scripts and are left empty to fall back.
  value_ar: optionalText(20, "That is too long."),
  label: requiredText(2, 120, "What does it measure?", "That label is too long."),
  label_ar: optionalText(120, "That label is too long."),
  sortOrder: sortOrderField,
});

export const {
  create: createCraftStatSchema,
  update: updateCraftStatSchema,
  remove: deleteCraftStatSchema,
} = pair(craftStatFields);

// ── CraftQuote — /craftsmanship ───────────────────────────────

const craftQuoteFields = z.object({
  quote: requiredText(2, 1_000, "What was said?", "That quote is too long."),
  quote_ar: optionalText(1_000, "That quote is too long."),
  author: requiredText(2, 120, "Who said it?", "That name is too long."),
  author_ar: optionalText(120, "That name is too long."),
  authorTitle: requiredText(2, 160, "What is their role?", "That is too long."),
  authorTitle_ar: optionalText(160, "That is too long."),
  /*
   * The RLS policy on `"CraftQuote"` filters unpublished rows out of every
   * public read, so this flag is the whole control over whether the quote
   * appears on `/craftsmanship`.
   */
  isPublished: booleanField,
  sortOrder: sortOrderField,
});

export const {
  create: createCraftQuoteSchema,
  update: updateCraftQuoteSchema,
  remove: deleteCraftQuoteSchema,
} = pair(craftQuoteFields);

// ── Ingredient — /ingredients, the home rail, and every PDP ───

/**
 * The seven olfactive families, offered as checkboxes.
 *
 * Sourced from the same enum the *read* path validates against, not from the
 * `"IngredientFamily"` table. The two are meant to agree, and if they ever
 * drift the enum is the one that matters: a material carrying a family outside
 * it fails `safeParse` and is dropped from `/ingredients` entirely — the
 * material disappears, with nothing in the UI to say why.
 */
export const ingredientFamilyValues = ingredientFamilySchema.options;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A list of short lines, as `AdminStringList` hands it over.
 *
 * Blank entries are dropped rather than rejected: an editor who adds a row and
 * changes their mind should not have to find and delete it to save.
 */
function textList(max: number, tooLong: string) {
  return z
    .array(z.string().trim().max(max, tooLong))
    .default([])
    .transform((values) => values.filter((value) => value.length > 0));
}

const ingredientFields = z.object({
  name: requiredText(2, 120, "What is this material?", "That name is too long."),
  name_ar: optionalText(120, "That name is too long."),

  slug: z
    .string()
    .trim()
    .min(2, "Give it a slug.")
    .max(64, "That slug is too long.")
    .regex(SLUG_PATTERN, "Lowercase letters, numbers and hyphens only."),

  // No Arabic twin — a binomial is Latin in both trees, which is the point of one.
  latinName: requiredText(2, 120, "What is the binomial?", "That is too long."),

  origin: requiredText(2, 120, "Where is it sourced?", "That is too long."),
  origin_ar: optionalText(120, "That is too long."),

  /*
   * At least one family, and only from the closed seven. An empty array would
   * make the material unreachable through every filter on `/ingredients`.
   */
  families: z
    .array(ingredientFamilySchema)
    .min(1, "Choose at least one olfactive family."),

  rarity: requiredText(2, 60, "How scarce is it?", "That is too long."),
  rarity_ar: optionalText(60, "That is too long."),

  priceTier: z.coerce
    .number({ error: "Enter a number." })
    .int("Whole numbers only.")
    .min(1, "Between 1 and 5.")
    .max(5, "Between 1 and 5."),

  description: requiredText(2, 2_000, "Describe it.", "That is too long."),
  description_ar: optionalText(2_000, "That is too long."),

  facts: textList(300, "That fact is too long."),
  /*
   * The Arabic facts fall back **as a whole** — see `resolveList`. A half
   * translated list would render half in each script, so the form says so and
   * the reader is never handed a mixture.
   */
  facts_ar: textList(300, "That fact is too long."),

  imageUrl: z
    .string()
    .trim()
    .min(1, "This material needs a photograph.")
    .refine((value) => /^https?:\/\/\S+$/.test(value), "That is not a valid URL."),
  imageAlt: requiredText(
    2,
    200,
    "Describe the photograph for anyone who cannot see it.",
    "That description is too long.",
  ),
  imageAlt_ar: optionalText(200, "That description is too long."),

  sortOrder: sortOrderField,
});

export const createIngredientSchema = ingredientFields.extend({ id: idField });

/** The id identifies the row and is never edited; the slug still can be. */
export const updateIngredientSchema = ingredientFields.extend({
  id: z.string().trim().min(1, "Which material?"),
});

export const deleteIngredientSchema = z.object({
  id: z.string().trim().min(1, "Which material?"),
});

/**
 * Which perfumes a material appears in.
 *
 * A whole set rather than one row at a time, because that is how the question
 * is actually asked — "which of these is oud in?" — and because a set makes the
 * write idempotent: the action diffs against what is stored and the same
 * submission twice leaves the same rows.
 */
export const setIngredientProductsSchema = z.object({
  ingredientId: z.string().trim().min(1, "Which material?"),
  productSlugs: z
    .array(z.string().trim().regex(SLUG_PATTERN, "That is not a product slug."))
    .max(60, "That is more perfumes than the panel supports.")
    // The unique constraint on ("ingredientId","productSlug") would refuse a
    // duplicate anyway; de-duplicating here makes it a no-op rather than an error.
    .transform((slugs) => [...new Set(slugs)]),
});

// ── The landing-page hero ─────────────────────────────────────

/**
 * A media URL: absolute, and https only.
 *
 * Stricter than the ingredient photograph field above, which still accepts
 * `http://`. A hero image is the largest asset on the site's most-visited page
 * and is served into an https document; an insecure one would be blocked as
 * mixed content and show as a hole in the composition. The database restates
 * this as a check constraint.
 */
function mediaUrl(message: string) {
  return z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .refine((value) => value === null || /^https:\/\/\S+$/.test(value), message);
}

/**
 * The hero button's destination — an app path, or nothing.
 *
 * The same rule and the same refusal as `href` in `src/schemas/marketing.ts`:
 * this value is rendered straight into an anchor above the fold, so absolute
 * URLs, protocol-relative hosts and `javascript:` are rejected at the boundary
 * and again by the column. A hero button is not the place to introduce an open
 * redirect.
 */
const heroHrefField = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .refine(
    (value) => value === null || /^\/[A-Za-z0-9/_-]*$/.test(value),
    "Use a path on this site, starting with a slash — for example /collections.",
  );

/**
 * One slide.
 *
 * A row whose URL and both alts are empty is a spare the editor added and did
 * not fill in; `heroFields` drops those before this schema ever sees them, which
 * is why the URL here is required rather than optional.
 */
const heroSlideSchema = z.object({
  id: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .default(null),
  imageUrl: z
    .string()
    .trim()
    .min(1, "A slide needs an image.")
    .refine(
      (value) => /^https:\/\/\S+$/.test(value),
      "Use a full https:// image address.",
    ),
  alt: requiredText(
    2,
    160,
    "Describe the image for anyone who cannot see it.",
    "That description is too long.",
  ),
  altAr: optionalText(160, "That description is too long."),
});

/** True for a row the editor added and left entirely blank. */
function isBlankSlide(row: unknown): boolean {
  if (typeof row !== "object" || row === null) return true;

  const slide = row as Record<string, unknown>;

  return ["imageUrl", "alt", "altAr"].every((key) => {
    const value = slide[key];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

const heroFields = z.object({
  mediaType: z.enum(["IMAGES", "VIDEO"], {
    error: "Choose images or a video.",
  }),

  /**
   * Where the words sit. No cross-field rule: a hero with no content at all is
   * still allowed to carry a position, which is what lets an editor switch the
   * headline back on and find the composition they left.
   */
  contentPosition: z.enum(["CENTER", "BOTTOM_LEFT"], {
    error: "Choose where the hero content sits.",
  }),

  slideDurationMs: z.coerce
    .number({ error: "Choose how long a slide holds." })
    .int("Whole milliseconds only.")
    .min(3000, "Three seconds is the shortest a slide may hold.")
    .max(15000, "Fifteen seconds is the longest a slide may hold."),

  /**
   * No maximum. One image is a static hero, two or more rotate, and how many a
   * campaign runs is the house's decision — the storefront fetches only the
   * first on load, so the marginal one costs a request that may never happen.
   */
  slides: z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((row) => !isBlankSlide(row)) : value),
    z.array(heroSlideSchema),
  ),

  videoUrl: mediaUrl("Use a full https:// video address."),
  videoPosterUrl: mediaUrl("Use a full https:// image address."),
  videoAlt: optionalText(160, "That description is too long."),
  videoAltAr: optionalText(160, "That description is too long."),

  showHeadline: z.boolean(),
  showDescription: z.boolean(),
  showButton: z.boolean(),

  headline: optionalText(120, "Keep the headline to 120 characters."),
  headlineAr: optionalText(120, "Keep the headline to 120 characters."),
  description: optionalText(280, "Keep the description to 280 characters."),
  descriptionAr: optionalText(280, "Keep the description to 280 characters."),
  buttonLabel: optionalText(40, "That label is too long."),
  buttonLabelAr: optionalText(40, "That label is too long."),
  buttonHref: heroHrefField,
});

/**
 * The four rules a hero must satisfy to render rather than break.
 *
 * None of them says "there must be media". A hero with no images and no video
 * is the unconfigured state — the home page answers it with the typographic
 * composition it has always had — and refusing to save it would leave an editor
 * unable to clear a campaign.
 */
function heroRules(
  value: z.infer<typeof heroFields>,
  ctx: z.RefinementCtx,
): void {
  if (value.mediaType === "VIDEO" && value.videoUrl === null) {
    ctx.addIssue({
      code: "custom",
      path: ["videoUrl"],
      message: "A video hero needs a video. Add one, or switch back to images.",
    });
  }

  if (value.showHeadline && value.headline === null) {
    ctx.addIssue({
      code: "custom",
      path: ["headline"],
      message: "The headline is switched on but empty.",
    });
  }

  if (value.showDescription && value.description === null) {
    ctx.addIssue({
      code: "custom",
      path: ["description"],
      message: "The description is switched on but empty.",
    });
  }

  if (value.showButton && value.buttonLabel === null) {
    ctx.addIssue({
      code: "custom",
      path: ["buttonLabel"],
      message: "The button is switched on but has no label.",
    });
  }

  if (value.showButton && value.buttonHref === null) {
    ctx.addIssue({
      code: "custom",
      path: ["buttonHref"],
      message: "The button is switched on but has nowhere to go.",
    });
  }
}

export const heroSchema = heroFields.superRefine(heroRules);
