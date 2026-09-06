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

import { MERCH_PAGE_FACETS } from "@/src/lib/facets";
import {
  PRODUCT_TYPE_VALUES,
  typeHasContents,
  typeIsScented,
  typeTakesVolume,
  type ProductType,
} from "@/src/lib/product-types";
import { SCENT_PROFILE_SLUGS } from "@/src/lib/scent-profiles";

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
 * The `/collections/[slug]` segments the code owns.
 *
 * `best-sellers` and the five scent profiles are pages that exist because
 * `src/lib/facets.ts` and `src/lib/scent-profiles.ts` route them. A category or
 * collection saved at one of those addresses would win the resolver and make a
 * live page disappear with no error anywhere.
 *
 * The database refuses these too (`supabase/sql/0047_reserved_slugs.sql`), and
 * that is the constraint that actually holds — a seed, a restore or a `psql`
 * session never reaches this file. This exists so an editor reads a sentence in
 * the field instead of a constraint name in a failed save.
 */
const RESERVED_SLUGS: readonly string[] = [
  ...MERCH_PAGE_FACETS,
  ...SCENT_PROFILE_SLUGS,
];

const shelfSlugField = slugField.refine(
  (value) => !RESERVED_SLUGS.includes(value),
  {
    error:
      "That address already belongs to a page KHEM ships — choose another slug.",
  },
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

/**
 * A cost typed in EGP, stored in piastres. Blank means **not stated**.
 *
 * Deliberately not `priceEgpField`: a price is required and a cost is not, and
 * the difference matters more than the shared arithmetic. A cost the desk has
 * not supplied must reach the column as null, because null is what every
 * profit figure downstream reads as "unknown" — coercing a blank field to zero
 * would report the next sale of that product as pure profit.
 *
 * The conversion is `priceEgpField`'s, for `priceEgpField`'s reason: `Math.round`
 * because `14.7 * 100` is `1469.9999999999998` in binary floating point.
 */
const costEgpField = z
  .union([z.literal(""), z.coerce.number()])
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null)
  .superRefine((value, ctx) => {
    if (value === null) return;
    if (Number.isNaN(value) || value < 0) {
      ctx.addIssue({ code: "custom", message: "A cost cannot be negative." });
    } else if (value > 1_000_000) {
      ctx.addIssue({
        code: "custom",
        message: "That cost looks like a typing mistake.",
      });
    }
  })
  .transform((value) => (value === null ? null : Math.round(value * 100)));

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

const productTagField = z.enum(["NEW_ARRIVAL"]);

/**
 * What the object *is* — `public."ProductType"`, widened by
 * `0052_product_type_and_volume.sql`.
 *
 * Read from `PRODUCT_TYPE_VALUES` rather than retyped here, so the enum, the
 * form's options and this schema cannot disagree about what a legal value is.
 * Blank means *not stated*, which is a real answer: the catalogue predates the
 * column and no product is obliged to acquire a type just to be edited.
 */
const productTypeField = z.enum(PRODUCT_TYPE_VALUES);

/**
 * A volume in millilitres, or nothing.
 *
 * Blank is `null`, never `0`. `z.coerce.number()` turns `""` into zero, and a
 * zero written to a nullable column is the exact failure this field exists to
 * prevent: a gift box recorded as measuring nothing rather than as not being
 * measured at all. Whether blank is *allowed* is not decided here — it depends
 * on the product's type, which this field cannot see. See
 * {@link checkProductRules}.
 */
const volumeMlField = z
  .union([z.string(), z.number(), z.null()])
  .default(null)
  .transform((value, ctx) => {
    if (value === null || (typeof value === "string" && value.trim() === "")) {
      return null;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a volume in millilitres.",
      });
      return z.NEVER;
    }

    if (!Number.isInteger(parsed)) {
      ctx.addIssue({
        code: "custom",
        message: "Volume must be a whole number of millilitres.",
      });
      return z.NEVER;
    }

    if (parsed <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Volume must be greater than zero.",
      });
      return z.NEVER;
    }

    return parsed;
  });

/** Empty string from a `<select>`/`<input>` means "not set", never "". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Capped at ${max} characters.`)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .default(null);

// ── Navigation ────────────────────────────────────────────────

/**
 * One menu entry — a row of `"NavLink"` (`supabase/sql/0048_navigation.sql`).
 *
 * The shape mirrors the table's `nav_link_target_matches_type` check, because
 * the rule is the same rule: a row names **one** target, and which field carries
 * it is decided by `targetType`. Stating it twice is the usual bargain — the
 * constraint is what holds, this is what produces a sentence in the form.
 *
 * There is no `href` field and there must never be one. A menu entry points at
 * a row or at a page the code routes; a free-text address reachable from a form
 * is an open redirect wearing a navigation costume.
 */
const navColumnField = z.enum(["COLLECTIONS", "QUICK_ACCESS", "WORLD"], {
  error: "Choose which column this entry belongs to.",
});

const navTargetField = z.enum(["CATEGORY", "COLLECTION", "PAGE", "GROUP"], {
  error: "Choose what this entry points at.",
});

const navLinkFields = {
  columnKey: navColumnField,
  /** The disclosure this row sits inside, or null for a top-level row. */
  parentId: optionalText(64),
  targetType: navTargetField,
  categorySlug: optionalText(64),
  collectionSlug: optionalText(64),
  pageKey: optionalText(64),
  groupKey: optionalText(64),
  /** Blank means "use the target's own name" — see `0048_navigation.sql`. */
  label: optionalText(120),
  desc: optionalText(200),
  showInNav: z.boolean().default(true),
  showInFooter: z.boolean().default(true),
  isEnabled: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9_999).default(0),
};

function checkNavTarget(
  value: {
    targetType: "CATEGORY" | "COLLECTION" | "PAGE" | "GROUP";
    categorySlug: string | null;
    collectionSlug: string | null;
    pageKey: string | null;
    groupKey: string | null;
  },
  ctx: z.RefinementCtx,
): void {
  const required = {
    CATEGORY: "categorySlug",
    COLLECTION: "collectionSlug",
    PAGE: "pageKey",
    GROUP: "groupKey",
  } as const;

  const field = required[value.targetType];

  if (value[field] === null) {
    ctx.addIssue({
      code: "custom",
      path: [field],
      message: "Choose what this entry points at.",
    });
  }

  // The other three are cleared rather than reported: an editor switching a
  // row's target should not have to empty the field they switched away from.
  for (const other of Object.values(required)) {
    if (other !== field) value[other] = null;
  }
}

export const createNavLinkSchema = z
  .object(navLinkFields)
  .superRefine(checkNavTarget);

export const updateNavLinkSchema = z
  .object({ id: z.string().trim().min(1).max(64), ...navLinkFields })
  .superRefine(checkNavTarget);

export const moveNavLinkSchema = z.object({
  id: z.string().trim().min(1).max(64),
  direction: z.enum(["up", "down"], { error: "Up or down." }),
});

export type CreateNavLinkInput = z.input<typeof createNavLinkSchema>;
export type UpdateNavLinkInput = z.input<typeof updateNavLinkSchema>;

// ── Category ──────────────────────────────────────────────────

/**
 * A category — the shelf a collection stands on (`0045_category.sql`).
 *
 * `kind` lives here rather than on the collection: the database copies it down
 * onto every collection beneath, so this is the one place it is authored and
 * the two can never disagree. It is also what decides which layout a page
 * renders and whether its products get `/perfume/[slug]` detail pages, which is
 * why it is a closed enum and not free text.
 */
const categoryFields = {
  name: z
    .string()
    .trim()
    .min(2, "A category needs a name.")
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
  kind: collectionKindField,
  isEnabled: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9_999).default(0),
};

export const createCategorySchema = z.object({
  slug: shelfSlugField,
  ...categoryFields,
});

/** Update targets the slug; it never changes it — see the collection note. */
export const updateCategorySchema = z.object({
  slug: shelfSlugField,
  ...categoryFields,
});

export type CreateCategoryInput = z.input<typeof createCategorySchema>;
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;

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
  /**
   * The category this collection stands under.
   *
   * What replaced `kind` on this form. A collection no longer says what it
   * sells — its category does, and the database copies that answer down
   * (`collection_kind_from_category()`), so the dashboard offers the hierarchy
   * rather than two fields that could contradict each other.
   */
  categorySlug: slugField,
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
    slug: shelfSlugField,
    ...collectionFields,
  })
  .superRefine(checkCardImagePair);

/**
 * Update takes the slug as the *target*, never as a new value.
 *
 * Renaming a slug would break every stored cart line (they persist
 * product ids, and ids are slugs — see `supabase/sql/0001_catalog.sql`), plus
 * every indexed URL. The edit forms render it read-only and this schema has no
 * field that could change it.
 */
export const updateCollectionSchema = z
  .object({
    slug: shelfSlugField,
    ...collectionFields,
  })
  .superRefine(checkCardImagePair);

export type CreateCollectionInput = z.input<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.input<typeof updateCollectionSchema>;

// ── MerchPage ─────────────────────────────────────────────────

/**
 * Editing a merchandising page.
 *
 * There is no create and no delete schema, and the slug is a `z.enum` rather
 * than `slugField`: which merchandising pages exist is decided by
 * {@link MERCH_PAGE_FACETS}, which is what routes them, and the table carries
 * the same restriction as a check constraint. A payload naming anything else is
 * refused here before it reaches a query.
 *
 * The Arabic columns are absent by design — no dashboard screen writes them.
 */
export const updateMerchPageSchema = z.object({
  slug: z.enum(MERCH_PAGE_FACETS),
  name: z
    .string()
    .trim()
    .min(2, "This page needs a name.")
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
});

export type UpdateMerchPageInput = z.input<typeof updateMerchPageSchema>;

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
  /*
   * Blank from a `<select>` means "not stated", never the string "". Same
   * treatment as `concentration` below, for the same reason: an empty option is
   * how a form says nothing, and the column stores that as null.
   */
  productType: z
    .union([productTypeField, z.literal("")])
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null),
  volumeMl: volumeMlField,
  priceEgp: priceEgpField,
  /*
   * What the product costs the house. Optional, and blank stays blank.
   *
   * Not a price and never shown to a visitor: it exists so
   * `order_item_sales_ledger` can snapshot a real COGS figure at the moment of
   * sale, and `src/schemas/db/catalog.ts` deliberately does not select it.
   */
  costEgp: costEgpField,
  sku: z
    .string()
    .trim()
    .min(2, "A product needs a SKU.")
    .max(64, "That SKU is too long.")
    .regex(/^[A-Za-z0-9._-]+$/, "Letters, numbers, dots, dashes and underscores only."),
  /*
   * Stock is **not** a product field any more.
   *
   * `supabase/sql/0042_inventory_channels.sql` split it into
   * `"inventoryOnline"` and `"inventoryOffline"` and made `"inventory"` a
   * trigger-maintained total. A `Stock` input on this form would write to a
   * column the trigger immediately recomputes: it would report success, change
   * nothing, and leave no ledger row — which is worse than not offering it.
   *
   * Stock now moves only through `src/actions/admin/inventory.ts`, where every
   * change names the counter it touches and writes an `"InventoryMovement"`.
   * The product form links there instead.
   */
  isBestseller: z.boolean().default(false),
  collectionSlug: slugField,
  sortOrder: z.coerce.number().int().min(0).max(9_999).default(0),
};

/**
 * Everything about a product that one field cannot decide alone.
 *
 * Two rules, and both are twins of something the database already enforces —
 * the `product_strength_or_format` CHECK from `0001_catalog.sql`, and the volume
 * rule that `product_type_matches_kind()` gained in
 * `0052_product_type_and_volume.sql`. The database remains the authority. This
 * exists so the editor is told which field is involved rather than being shown a
 * constraint name, and so a form that has already hidden a field does not then
 * submit a stale value sitting behind it.
 *
 * ## Fields are cleared, not complained about
 *
 * The same bargain `checkNavTarget` strikes above. An editor who switches a
 * product from Perfume to Antique should not have to go and empty the volume
 * and the three note lists themselves — the type they chose has already said
 * those facts do not apply, so this clears them and the write records what was
 * meant.
 */
function checkProductRules(
  value: {
    productType: ProductType | null;
    concentration: string | null;
    format: string | null;
    volumeMl: number | null;
    topNotes: string[];
    heartNotes: string[];
    baseNotes: string[];
    includes: string[];
  },
  ctx: z.RefinementCtx,
): void {
  // ── The volume, which follows from the type ────────────────
  if (typeTakesVolume(value.productType)) {
    if (value.volumeMl === null) {
      ctx.addIssue({
        code: "custom",
        path: ["volumeMl"],
        message:
          "A perfume, body mist or room spray is measured in millilitres — state how many, or change the type.",
      });
    }
  } else {
    value.volumeMl = null;
  }

  // ── The pyramid, which follows from the same place ─────────
  if (!typeIsScented(value.productType)) {
    value.concentration = null;
    value.topNotes = [];
    value.heartNotes = [];
    value.baseNotes = [];

    /*
     * With the concentration gone, `format` is the only thing left that can
     * satisfy `product_strength_or_format`. Saying so here, against the field
     * the editor can actually fill in, is the difference between "write what
     * this object is" and a CHECK constraint's name.
     */
    if (value.format === null) {
      ctx.addIssue({
        code: "custom",
        path: ["format"],
        message:
          "Describe what this object is — “Alabaster Sphinx”, “Gift Box — 3 Vials”. It stands where a fragrance states its concentration.",
      });
    }

  } else if (value.concentration === null && value.format === null) {
    /*
     * The original CHECK, reached only for the types that could have satisfied
     * it either way. An antique has already been told to write a format line
     * above, and adding a second complaint about a Concentration field its form
     * does not even render would be an error the editor cannot see, let alone
     * act on.
     */
    ctx.addIssue({
      code: "custom",
      path: ["concentration"],
      message:
        "A product needs either a concentration (fragrances) or a format line (body, home, sets).",
    });
  }

  if (!typeHasContents(value.productType)) {
    value.includes = [];
  }
}

export const createProductSchema = z
  .object({ slug: slugField, ...productFields })
  .superRefine(checkProductRules);

export const updateProductSchema = z
  .object({ slug: slugField, ...productFields })
  .superRefine(checkProductRules);

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
