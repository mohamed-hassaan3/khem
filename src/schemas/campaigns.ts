/**
 * What a campaign may say, and what may be done to it.
 *
 * English sentences rather than dictionary keys, following `schemas/orders.ts`:
 * the dashboard is English by construction and has one reader.
 *
 * ## What is deliberately absent
 *
 * No status, no `sentAt`, no audience count. Those are dispatch's own record of
 * what it did, and a form that could set them could claim a campaign had been
 * sent when it had not — or, worse, that it had not when it had.
 *
 * The body is **plain text**. Accepting HTML from the editor would be an
 * injection surface on a letter going to thousands of people, and it would make
 * every campaign's typography an improvisation rather than the house's.
 */

import { z } from "zod";

import { LOCALES } from "@/src/lib/i18n/config";

/** A URL the house controls, or an absolute link the letter may point at. */
const httpUrl = z
  .string()
  .trim()
  .max(600, "That link is too long.")
  .refine(
    (value) => value === "" || /^https?:\/\//i.test(value),
    "Links must start with http:// or https://.",
  );

const campaignFields = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give this campaign a name.")
    .max(120, "That name is too long."),

  type: z.enum(
    [
      "NEW_ARRIVAL",
      "DISCOUNT",
      "NEW_COLLECTION",
      "EXCLUSIVE_OFFER",
      "SEASONAL",
      "CUSTOM",
    ],
    { error: "Choose a campaign type." },
  ),

  locale: z.enum(LOCALES, { error: "Choose a language." }),

  subject: z
    .string()
    .trim()
    .min(3, "Write a subject line.")
    .max(200, "That subject is too long."),

  preheader: z
    .string()
    .trim()
    .max(200, "That preview text is too long.")
    .default(""),

  body: z
    .string()
    .trim()
    .min(10, "Write the letter.")
    .max(8000, "That letter is too long."),

  heroUrl: httpUrl.transform((value) => (value === "" ? null : value)),
  heroAlt: z
    .string()
    .trim()
    .max(200, "That description is too long.")
    .transform((value) => (value === "" ? null : value)),

  ctaLabel: z.string().trim().max(60, "That button label is too long.").default(""),
  ctaHref: httpUrl.default(""),

  /*
   * Uppercased here so the foreign key into `discounts` matches: that table
   * stores codes uppercased and its own check enforces it.
   */
  discountCode: z
    .string()
    .trim()
    .max(40, "That code is too long.")
    .transform((value) => value.toUpperCase())
    .transform((value) => (value === "" ? null : value)),
});

/**
 * The two rules that are about a *pair* of fields, which is why they are
 * refinements rather than field rules — the same shape `schemas/discounts.ts`
 * uses for its own cross-field checks.
 *
 * A hero image with no description is an image a screen reader cannot pass on,
 * and a button with no label is a gold rectangle.
 */
function applyRules(
  value: z.infer<typeof campaignFields>,
  ctx: z.RefinementCtx,
): void {
  if (value.heroUrl && !value.heroAlt) {
    ctx.addIssue({
      code: "custom",
      path: ["heroAlt"],
      message: "Describe the image for readers who cannot see it.",
    });
  }

  if (value.ctaHref && !value.ctaLabel) {
    ctx.addIssue({
      code: "custom",
      path: ["ctaLabel"],
      message: "A button needs a label.",
    });
  }
}

export const createCampaignSchema = campaignFields.superRefine(applyRules);

export const updateCampaignSchema = campaignFields
  .extend({ id: z.string().trim().min(8, "Unknown campaign.") })
  .superRefine(applyRules);

export const campaignIdSchema = z.object({
  id: z.string().trim().min(8, "Unknown campaign."),
});

/**
 * When a campaign should go.
 *
 * A moment in the future, honoured to the nearest daily cron run. The past is
 * refused: a schedule already elapsed would be sent by the very next run, which
 * is "send now" wearing a disguise — and the desk should press the button that
 * says so.
 */
export const scheduleCampaignSchema = z.object({
  id: z.string().trim().min(8, "Unknown campaign."),
  scheduledAt: z
    .string()
    .trim()
    .min(1, "Choose when it should go.")
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      "That is not a valid date and time.",
    )
    .refine(
      (value) => Date.parse(value) > Date.now(),
      "Choose a moment in the future.",
    ),
});

export type CreateCampaignInput = z.input<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.input<typeof updateCampaignSchema>;
