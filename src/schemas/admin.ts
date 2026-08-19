/**
 * Admin write validation — the boundary, not an affordance.
 *
 * Every form in `src/components/admin/` checks the same rules in the browser so
 * an editor sees a mistake before they lose the round trip. None of that is
 * trusted: a Server Action is a public HTTP endpoint, and these schemas are
 * what actually decides what reaches Postgres.
 *
 * ## What these mirror
 *
 * Each rule below has a twin in `supabase/sql/`. The database keeps the
 * authoritative constraint (`product_strength_or_format`, `priceInCents >= 0`,
 * unique `sku`), because a check that only exists in TypeScript is one a script
 * or a dashboard edit walks straight past. What these add is a *readable*
 * failure: "a product needs either a concentration or a format" instead of a
 * Postgres constraint name in a 500.
 *
 * ## Messages, not codes
 *
 * `schemas/contact.ts` and `schemas/comments.ts` emit error *codes* so the
 * client can resolve them against a dictionary and no English string reaches an
 * Arabic page. That reasoning does not apply here: the dashboard is English by
 * construction and has exactly one reader, so these carry sentences and the
 * forms render them directly.
 */

import { z } from "zod";

/** Hosts `next/image` is configured for in `next.config.ts`. */
export const ALLOWED_IMAGE_HOSTS = [
  "images.unsplash.com",
  "res.cloudinary.com",
] as const;

/** Ceiling on any single free-text editorial field. */
const LONG_TEXT_MAX = 4_000;

/**
 * Ceiling on a journal body. Roughly a 40-minute read — longer than anything
 * the journal has published, and short enough that one paste cannot fill a
 * column, an embedding request, and a cached page at once.
 */
const ARTICLE_BODY_MAX = 40_000;

/**
 * URL-safe, lowercase, hyphen-separated. The shape every seeded row already
 * has, and the shape `/perfume/[slug]` puts in front of a visitor.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugField = z
  .string()
  .trim()
  .min(2, "A slug needs at least 2 characters.")
  .max(64, "A slug may not exceed 64 characters.")
  .regex(
    SLUG_PATTERN,
    "Lowercase letters, numbers and single hyphens only — no spaces.",
  );

/**
 * An image URL `next/image` will actually render.
 *
 * The host check is not pedantry: a URL from an unlisted host throws inside
 * `next/image` at render time, so a product saved with one looks fine in the
 * dashboard and breaks the grid it appears in. Catching it here is the
 * difference between a clear message and a mystery.
 */
function isRenderableImageUrl(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value);
    return (
      protocol === "https:" &&
      (ALLOWED_IMAGE_HOSTS as readonly string[]).includes(hostname)
    );
  } catch {
    return false;
  }
}

const IMAGE_HOST_MESSAGE = `Images must be https and hosted on: ${ALLOWED_IMAGE_HOSTS.join(", ")}.`;

const imageUrlField = z
  .url("That is not a valid URL.")
  .max(2_000, "That URL is too long.")
  .refine(isRenderableImageUrl, IMAGE_HOST_MESSAGE);

/**
 * The same gate, for an image a record may simply not have.
 *
 * `imageUrlField` cannot express this: `z.url()` rejects `""`, which is what an
 * untouched text input actually submits. Blank collapses to `null` first, and
 * only a non-empty value is held to the host rule.
 */
const optionalImageUrlField = z
  .string()
  .trim()
  .max(2_000, "That URL is too long.")
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || isRenderableImageUrl(value),
    IMAGE_HOST_MESSAGE,
  );

/**
 * A list of short text lines — fragrance notes, set contents.
 *
 * Blank entries are dropped rather than rejected: the form renders a spare
 * empty row for convenience, and an editor who leaves it alone means "no more",
 * not "error".
 */
function stringList(max: number, label: string) {
  return z
    .array(z.string().trim().max(120, `Each ${label} entry is capped at 120 characters.`))
    .max(max, `At most ${max} ${label} entries.`)
    .transform((entries) => entries.filter((entry) => entry.length > 0))
    .default([]);
}

/**
 * A price typed in EGP, stored in piastres.
 *
 * The conversion happens exactly once, here, so no component multiplies by 100
 * on its own and no rounding difference can appear between the form and the
 * row. `Math.round` because `14.7 * 100` is `1469.9999999999998` in binary
 * floating point, and a silently truncated piastre is a real price error.
 */
const priceEgpField = z
  .coerce
  .number({ error: "Enter a price in EGP, e.g. 1470.00" })
  .min(0, "A price cannot be negative.")
  .max(1_000_000, "That price looks like a typing mistake.")
  .transform((egp) => Math.round(egp * 100));

const collectionKindField = z.enum([
  "FRAGRANCE",
  "BODY",
  "HOME",
  "DISCOVERY",
  "GIFT",
]);

const concentrationField = z.enum([
  "PARFUM",
  "EXTRAIT_DE_PARFUM",
  "EAU_DE_PARFUM",
  "ATTAR_OIL",
]);

const productTagField = z.enum(["NEW_ARRIVAL", "LIMITED_EDITION"]);

/** Empty string from a `<select>`/`<input>` means "not set", never "". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Capped at ${max} characters.`)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .default(null);

// ── Collection ────────────────────────────────────────────────

const collectionFields = {
  name: z
    .string()
    .trim()
    .min(2, "A collection needs a name.")
    .max(120, "That name is too long."),
  description: z
    .string()
    .trim()
    .min(10, "Write at least a sentence of description.")
    .max(LONG_TEXT_MAX, "That description is too long."),
  bannerUrl: imageUrlField,
  bannerAlt: z
    .string()
    .trim()
    .min(3, "Describe the banner for screen readers.")
    .max(200, "That alt text is too long."),
  /**
   * The portrait card crop, optional. Blank means "reuse the banner" —
   * `toCollection()` performs that fallback, so a collection without one looks
   * exactly as it did before `0010_collection_card_image.sql`.
   */
  cardUrl: optionalImageUrlField,
  cardAlt: optionalText(200),
  isFeatured: z.boolean().default(false),
  kind: collectionKindField,
  sortOrder: z.coerce.number().int().min(0).max(9_999).default(0),
};

/**
 * A card image and its alt text arrive together or not at all.
 *
 * The twin of `collection_card_image_pair` in
 * `supabase/sql/0010_collection_card_image.sql`. The constraint is what
 * actually holds — this exists so an editor reads "the card image needs alt
 * text" against the field, rather than a constraint name in a failed save.
 */
function checkCardImagePair(
  value: { cardUrl: string | null; cardAlt: string | null },
  ctx: z.RefinementCtx,
): void {
  if (value.cardUrl !== null && value.cardAlt === null) {
    ctx.addIssue({
      code: "custom",
      path: ["cardAlt"],
      message: "Describe the card image for screen readers.",
    });
  }

  if (value.cardUrl === null && value.cardAlt !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["cardUrl"],
      message: "Add a card image, or clear this alt text.",
    });
  }
}

export const createCollectionSchema = z
  .object({
    slug: slugField,
    ...collectionFields,
  })
  .superRefine(checkCardImagePair);

/**
 * Update takes the slug as the *target*, never as a new value.
 *
 * Renaming a slug would break every stored cart and wishlist line (they persist
 * product ids, and ids are slugs — see `supabase/sql/0001_catalog.sql`), plus
 * every indexed URL. The edit forms render it read-only and this schema has no
 * field that could change it.
 */
export const updateCollectionSchema = z
  .object({
    slug: slugField,
    ...collectionFields,
  })
  .superRefine(checkCardImagePair);

export type CreateCollectionInput = z.input<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.input<typeof updateCollectionSchema>;

// ── Product ───────────────────────────────────────────────────

const productFields = {
  name: z.string().trim().min(2, "A product needs a name.").max(160, "That name is too long."),
  subtitle: optionalText(200),
  description: z
    .string()
    .trim()
    .min(10, "Write at least a sentence of description.")
    .max(LONG_TEXT_MAX, "That description is too long."),
  story: optionalText(LONG_TEXT_MAX),
  concentration: z
    .union([concentrationField, z.literal("")])
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null),
  format: optionalText(120),
  includes: stringList(12, "contents"),
  badge: optionalText(60),
  tags: z
    .array(productTagField)
    .max(2)
    .transform((tags) => [...new Set(tags)])
    .default([]),
  topNotes: stringList(12, "note"),
  heartNotes: stringList(12, "note"),
  baseNotes: stringList(12, "note"),
  volumeMl: z.coerce
    .number({ error: "Enter a volume in millilitres." })
    .int("Volume must be a whole number of millilitres.")
    .positive("Volume must be greater than zero."),
  priceEgp: priceEgpField,
  sku: z
    .string()
    .trim()
    .min(2, "A product needs a SKU.")
    .max(64, "That SKU is too long.")
    .regex(/^[A-Za-z0-9._-]+$/, "Letters, numbers, dots, dashes and underscores only."),
  inventory: z.coerce
    .number({ error: "Enter a stock count." })
    .int("Stock must be a whole number.")
    .min(0, "Stock cannot be negative.")
    .max(1_000_000, "That stock count looks like a typing mistake."),
  isBestseller: z.boolean().default(false),
  collectionSlug: slugField,
  sortOrder: z.coerce.number().int().min(0).max(9_999).default(0),
};

/**
 * The TypeScript twin of the `product_strength_or_format` CHECK.
 *
 * The database still holds the real constraint; this exists so the editor is
 * told which two fields are involved instead of being shown a constraint name.
 */
function requireStrengthOrFormat(
  value: { concentration: string | null; format: string | null },
  ctx: z.RefinementCtx,
): void {
  if (value.concentration === null && value.format === null) {
    ctx.addIssue({
      code: "custom",
      path: ["concentration"],
      message:
        "A product needs either a concentration (fragrances) or a format line (body, home, sets).",
    });
  }
}

export const createProductSchema = z
  .object({ slug: slugField, ...productFields })
  .superRefine(requireStrengthOrFormat);

export const updateProductSchema = z
  .object({ slug: slugField, ...productFields })
  .superRefine(requireStrengthOrFormat);

export type CreateProductInput = z.input<typeof createProductSchema>;
export type UpdateProductInput = z.input<typeof updateProductSchema>;

export const setProductArchivedSchema = z.object({
  slug: slugField,
  isArchived: z.boolean(),
});

// ── Product gallery ───────────────────────────────────────────

/**
 * The whole gallery, submitted at once.
 *
 * Row-at-a-time editing would let "reorder" and "change the primary" be two
 * requests that can half-fail, and the partial unique index makes the
 * intermediate state — two primaries — illegal. Submitting the gallery as one
 * value means the invariant is checked once, here, before anything is written.
 */
export const saveProductImagesSchema = z.object({
  productSlug: slugField,
  images: z
    .array(
      z.object({
        /** Absent for a row the editor just added; present for an existing one. */
        id: z.string().max(64).nullable().default(null),
        url: imageUrlField,
        alt: z
          .string()
          .trim()
          .min(3, "Describe the photograph for screen readers.")
          .max(200, "That alt text is too long."),
        isPrimary: z.boolean().default(false),
      }),
    )
    .max(12, "A gallery is capped at 12 images.")
    .default([])
    .superRefine((images, ctx) => {
      if (images.filter((image) => image.isPrimary).length > 1) {
        ctx.addIssue({
          code: "custom",
          message: "Only one image can be the primary.",
        });
      }
    }),
});

export type SaveProductImagesInput = z.input<typeof saveProductImagesSchema>;

// ── Article ───────────────────────────────────────────────────

const articleFields = {
  title: z.string().trim().min(3, "An article needs a title.").max(200, "That title is too long."),
  category: z
    .string()
    .trim()
    .min(2, "An article needs a category.")
    .max(60, "That category is too long."),
  excerpt: z
    .string()
    .trim()
    .min(10, "Write at least a sentence of excerpt.")
    .max(LONG_TEXT_MAX, "That excerpt is too long."),
  /*
   * The essay. Optional, because an article is routinely created from a
   * headline and an image and written afterwards — and because the column is
   * `not null default ''`, so "not written yet" is an empty string rather than
   * a null.
   *
   * The ceiling is generous but present: this text is stored, embedded, and
   * rendered, and an unbounded textarea posting to a Server Action is an
   * unbounded write.
   */
  body: z
    .string()
    .trim()
    .max(ARTICLE_BODY_MAX, "That body is longer than the journal can store.")
    .default(""),
  /* A `date` column. Stored as `YYYY-MM-DD`; `formatArticleDate()` owns display. */
  publishedAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker — the format is YYYY-MM-DD.")
    .refine((value) => !Number.isNaN(Date.parse(value)), "That is not a real date."),
  readTimeMinutes: z.coerce
    .number({ error: "Enter a reading time in minutes." })
    .int("Reading time must be a whole number of minutes.")
    .min(1, "Reading time must be at least a minute.")
    .max(120, "That reading time looks like a typing mistake."),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(false),
  imageUrl: imageUrlField,
  imageAlt: z
    .string()
    .trim()
    .min(3, "Describe the image for screen readers.")
    .max(200, "That alt text is too long."),
};

export const createArticleSchema = z.object({ slug: slugField, ...articleFields });
export const updateArticleSchema = z.object({ slug: slugField, ...articleFields });

export type CreateArticleInput = z.input<typeof createArticleSchema>;
export type UpdateArticleInput = z.input<typeof updateArticleSchema>;

export const setArticlePublishedSchema = z.object({
  slug: slugField,
  isPublished: z.boolean(),
});

// ── Action results ────────────────────────────────────────────

/**
 * What every admin action returns.
 *
 * A discriminated union rather than a thrown error, matching
 * `actions/comments.ts`: a form needs to render a failure, not lose the
 * editor's unsaved input to an error boundary.
 */
export type AdminActionResult =
  | { ok: true; slug: string; message: string }
  | {
      ok: false;
      /** Form-level sentence, always present. */
      message: string;
      /** Per-field sentences, keyed by the schema path. */
      fieldErrors?: Record<string, string>;
    };
