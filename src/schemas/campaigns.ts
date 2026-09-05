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

import { MIN_SCHEDULE_LEAD_MS } from "@/src/lib/campaign-schedule";
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
 * A UTC instant, always: the client converts the desk's local reading before it
 * arrives here — see `src/lib/campaign-schedule.ts` — and this schema never sees
 * a wall-clock string without a zone.
 *
 * The past is refused: a schedule already elapsed would be sent by the very next
 * run, which is "send now" wearing a disguise — and the desk should press the
 * button that says so.
 *
 * The minute or two after *now* is refused for a different reason. Whatever
 * triggers the dispatch — a platform cron today, a server cron on another host
 * tomorrow — runs on a cadence this application does not set and cannot read,
 * so a moment a hundred seconds away is a promise nothing here is in a position
 * to keep. `MIN_SCHEDULE_LEAD_MS` is a floor on what may be asked for, not a
 * description of any host's timetable, and it must stay that way: the day this
 * number is derived from a cron expression is the day the schedule field starts
 * lying again on the next platform.
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
    )
    .refine(
      (value) => Date.parse(value) >= Date.now() + MIN_SCHEDULE_LEAD_MS,
      "Choose a moment at least five minutes from now, so the dispatch has time to pick it up.",
    ),
});

/**
 * Which stored audiences a campaign speaks to.
 *
 * Both may be false. A campaign sent only to hand-typed addresses selects
 * neither, and refusing that here would make Mode B impossible — whether the
 * selection actually reaches anybody is a question about counts, and
 * `sendCampaignNow()` asks it against the audience the database returns rather
 * than against the shape of this form.
 */
export const campaignAudienceSchema = z.object({
  id: z.string().trim().min(8, "Unknown campaign."),
  toSubscribers: z.boolean(),
  toCustomers: z.boolean(),
});

/** Nothing legitimate is longer, and the check happens before any query. */
const MAX_SPECIFIC_RECIPIENTS = 200;

const recipientEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter an email address.")
  .max(254, "That address is too long.")
  .pipe(z.email("That is not a valid email address."));

/**
 * The addresses somebody typed, as the complete list for this campaign.
 *
 * A **replacement**, not an append: the editor holds the whole list, sends the
 * whole list, and what comes back is what the campaign has. An append endpoint
 * would need a delete endpoint beside it and a way for the two to disagree.
 *
 * Duplicates are refused rather than silently collapsed. The database would
 * collapse them anyway — `campaign_recipients` is keyed on the address, and the
 * send is keyed on it again — but an editor who typed the same address twice
 * made a mistake, and quietly fixing it hides the fact that one of the two rows
 * they are looking at is not the one they meant.
 */
export const campaignRecipientsSchema = z
  .object({
    id: z.string().trim().min(8, "Unknown campaign."),
    emails: z
      .array(recipientEmail)
      .max(
        MAX_SPECIFIC_RECIPIENTS,
        `That is more than ${MAX_SPECIFIC_RECIPIENTS} addresses. Send to a stored audience instead.`,
      ),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();

    value.emails.forEach((email, index) => {
      if (seen.has(email)) {
        ctx.addIssue({
          code: "custom",
          path: ["emails", index],
          message: "That address is already on the list.",
        });
      }
      seen.add(email);
    });
  });

export type CreateCampaignInput = z.input<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.input<typeof updateCampaignSchema>;
