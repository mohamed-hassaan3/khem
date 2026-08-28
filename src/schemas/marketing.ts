/**
 * Marketing write validation — the boundary for the **dashboard**.
 *
 * Same shape and the same reasoning as `src/schemas/discounts.ts`: English
 * sentences rather than error codes, because this surface has one reader; empty
 * strings normalised to `null` because a form input cannot hold one; and every
 * cross-field rule expressed as a refinement, because a schema cannot see the
 * other rows and one that pretended to would go stale between here and the write.
 *
 * The customer-facing half needs no schema. A visitor sends an email address to
 * `subscribeForOffer()` — which reuses `newsletterSchema` — and nothing else in
 * these three systems is writable from a browser.
 */

import { z } from "zod";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Empty means "no boundary". A row with neither is valid and always-on. */
function optionalDate(message: string) {
  return z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .refine(
      (value) => value === null || !Number.isNaN(Date.parse(value)),
      message,
    );
}

/** Trimmed, and empty collapsed to `null` so a cleared field clears the column. */
function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value.length === 0 ? null : value));
}

const booleanField = z
  .union([z.boolean(), z.string()])
  .transform((value) => (typeof value === "boolean" ? value : value === "true"));

/**
 * The end must follow the start. Shared by announcements and promotions, which
 * carry the same pair and the same database constraint.
 */
function windowRule(
  value: { startsAt: string | null; endsAt: string | null },
  ctx: z.RefinementCtx,
): void {
  if (
    value.startsAt !== null &&
    value.endsAt !== null &&
    Date.parse(value.endsAt) <= Date.parse(value.startsAt)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "The end must come after the start.",
    });
  }
}

// ── Announcements ─────────────────────────────────────────────

/**
 * An app path, or nothing.
 *
 * Refused rather than sanitised: this value is rendered straight into an anchor
 * in the site header, so `https://…`, `//host`, and `javascript:` are all
 * rejected at the boundary and again by a check constraint on the column. An
 * announcement is not the place to introduce an open redirect.
 */
const hrefField = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .refine(
    (value) => value === null || /^\/[A-Za-z0-9/_-]*$/.test(value),
    "Use a path on this site, starting with a slash — for example /collections/noir.",
  );

const announcementFields = z.object({
  message: z
    .string()
    .trim()
    .min(1, "An announcement needs something to say.")
    .max(160, "Keep it to 160 characters — the bar is one line tall."),
  messageAr: optionalText(160, "Keep it to 160 characters."),
  href: hrefField,
  ctaLabel: optionalText(40, "That label is too long."),
  ctaLabelAr: optionalText(40, "That label is too long."),
  isActive: booleanField,
  sortOrder: z.coerce
    .number({ error: "Enter a number." })
    .int("Whole numbers only.")
    .min(-999, "Too low.")
    .max(999, "Too high.")
    .default(0),
  startsAt: optionalDate("That is not a valid date."),
  endsAt: optionalDate("That is not a valid date."),
});

/**
 * A call-to-action label with nowhere to go is a word that looks like a link and
 * is not one. The database cannot say this — it is a rule about two nullable
 * columns — so it is said here, and the storefront mapper drops the label
 * defensively for a row written any other way.
 */
function announcementRules(
  value: z.infer<typeof announcementFields>,
  ctx: z.RefinementCtx,
): void {
  windowRule(value, ctx);

  if (value.href === null && value.ctaLabel !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["ctaLabel"],
      message: "A call to action needs a link. Add one, or clear the label.",
    });
  }
}

export const createAnnouncementSchema =
  announcementFields.superRefine(announcementRules);

export const updateAnnouncementSchema = announcementFields
  .extend({ id: z.string().trim().min(1, "Which announcement?") })
  .superRefine(announcementRules);

export const announcementIdSchema = z.object({
  id: z.string().trim().min(1, "Which announcement?"),
});

export const setAnnouncementActiveSchema = z.object({
  id: z.string().trim().min(1, "Which announcement?"),
  isActive: booleanField,
});

// ── House marketing settings ──────────────────────────────────

export const marketingSettingsSchema = z.object({
  announcementsEnabled: booleanField,
  /*
   * Written out rather than derived from `ANNOUNCEMENT_MODES`: a `z.enum()`
   * built from a `readonly AnnouncementMode[]` widens to `string`, and the
   * parsed value would stop being assignable to the column's type. A new mode is
   * a compile error in `src/types/marketing.ts` and an edit here, which is the
   * right amount of friction for a value the storefront switches on.
   */
  announcementMode: z.enum(["STATIC", "MARQUEE", "CAROUSEL"]),
  announcementIntervalMs: z.coerce
    .number({ error: "Enter a number." })
    .int("Whole milliseconds only.")
    .min(1500, "At least 1.5 seconds — anything faster cannot be read.")
    .max(15000, "At most 15 seconds."),

  offerPopupEnabled: booleanField,
  offerPopupDelayMs: z.coerce
    .number({ error: "Enter a number." })
    .int("Whole milliseconds only.")
    .min(3000, "At least 3 seconds. A popup on arrival is the one thing to avoid.")
    .max(120000, "At most 2 minutes."),
  offerPopupScrollPercent: z.coerce
    .number({ error: "Enter a number." })
    .int("Whole percent only.")
    .min(0, "Cannot be negative.")
    .max(100, "At most 100."),
  offerPopupSnoozeDays: z.coerce
    .number({ error: "Enter a number." })
    .int("Whole days only.")
    .min(1, "At least a day.")
    .max(365, "At most a year."),

  offerPopupEyebrow: optionalText(60, "That eyebrow is too long."),
  offerPopupEyebrowAr: optionalText(60, "That eyebrow is too long."),
  offerPopupHeading: z
    .string()
    .trim()
    .min(1, "The popup needs a heading.")
    .max(90, "That heading is too long."),
  offerPopupHeadingAr: optionalText(90, "That heading is too long."),
  offerPopupBody: optionalText(300, "That paragraph is too long."),
  offerPopupBodyAr: optionalText(300, "That paragraph is too long."),
  offerPopupImageUrl: z
    .string()
    .trim()
    .url("That is not a valid image URL.")
    .max(500, "That URL is too long."),
  offerPopupImageAlt: z
    .string()
    .trim()
    .min(1, "Describe the photograph for somebody who cannot see it.")
    .max(160, "That description is too long."),
  offerPopupImageAltAr: optionalText(160, "That description is too long."),
});

// ── Promotions ────────────────────────────────────────────────

const promotionFields = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the campaign a name.")
    .max(80, "That name is too long."),
  description: optionalText(300, "That description is too long."),
  label: optionalText(40, "That label is too long."),
  labelAr: optionalText(40, "That label is too long."),

  kind: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.coerce
    .number({ error: "Enter a number." })
    .int("Whole numbers only.")
    .positive("Must be more than zero."),

  appliesTo: z.enum(["PRODUCTS", "COLLECTIONS"]),
  isActive: booleanField,
  startsAt: optionalDate("That is not a valid date."),
  endsAt: optionalDate("That is not a valid date."),
  stacksWithCodes: booleanField,
  priority: z.coerce
    .number({ error: "Enter a number." })
    .int("Whole numbers only.")
    .min(-999, "Too low.")
    .max(999, "Too high.")
    .default(0),

  productSlugs: z.array(z.string().trim().regex(SLUG_PATTERN)).default([]),
  collectionSlugs: z.array(z.string().trim().regex(SLUG_PATTERN)).default([]),
});

function promotionRules(
  value: z.infer<typeof promotionFields>,
  ctx: z.RefinementCtx,
): void {
  windowRule(value, ctx);

  if (value.kind === "PERCENTAGE" && value.value > 100) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: "A percentage cannot be more than 100.",
    });
  }

  /*
   * A promotion with nothing selected prices nothing. Unlike a discount code —
   * which can legitimately apply to the whole bag — a promotion has no `ALL`
   * scope at all, so an empty selection is always a mistake rather than a
   * house-wide sale somebody expressed briefly.
   */
  if (value.appliesTo === "PRODUCTS" && value.productSlugs.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["productSlugs"],
      message: "Choose at least one product.",
    });
  }

  if (value.appliesTo === "COLLECTIONS" && value.collectionSlugs.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["collectionSlugs"],
      message: "Choose at least one collection.",
    });
  }
}

export const createPromotionSchema = promotionFields.superRefine(promotionRules);

export const updatePromotionSchema = promotionFields
  .extend({ id: z.string().trim().min(1, "Which promotion?") })
  .superRefine(promotionRules);

export const promotionIdSchema = z.object({
  id: z.string().trim().min(1, "Which promotion?"),
});

export const setPromotionActiveSchema = z.object({
  id: z.string().trim().min(1, "Which promotion?"),
  isActive: booleanField,
});
