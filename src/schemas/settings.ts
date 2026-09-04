/**
 * House settings write validation.
 *
 * Covers the three things `/admin/settings` edits: the singleton
 * `"BoutiqueSetting"` row, the contact channels, and the social profiles. All
 * three live in `supabase/sql/0003_directory.sql`.
 *
 * ## What is deliberately not here
 *
 * **`"EnquirySubject"`.** It looks like an obvious fourth section — it is a
 * list of labels with a sort order, exactly like the other two. It is excluded
 * because it is *not* the validation boundary for anything: the contact form's
 * subject is checked in the Server Action against `ENQUIRY_SUBJECTS` in
 * `src/constants/contact.ts`, because that value lands in a mail header and
 * must be validated against something that cannot change without a deploy and a
 * review. `npm run db:verify` fails if the table and the constant drift apart.
 * A dashboard that let somebody add a subject would break that check the moment
 * it was used, and the fix is a code change either way — so the table stays
 * where it is, edited alongside the constant.
 *
 * **Secrets.** No API key, signing secret, or connection string is editable or
 * readable from any admin screen. Those live in environment variables and
 * `supabase/AGENTS.md` §17 says so explicitly; nothing in this file has a
 * counterpart there.
 *
 * English sentences, not error codes: the dashboard has one reader.
 */

import { z } from "zod";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Empty string means "not set" — a form input cannot hold null. */
function optionalText(max: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value.length === 0 ? null : value));
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

// ── BoutiqueSetting ───────────────────────────────────────────

/**
 * The three addresses and the featured fragrance.
 *
 * The addresses are validated as real emails rather than as free text because
 * `inboxAddress()` sends the contact form to whatever is stored here. A typo is
 * not a cosmetic error — it is a silently swallowed enquiry, which is the one
 * failure mode `src/services/settings.ts` keeps a hard-coded fallback for.
 *
 * `featuredProductSlug` is **not** here any more. The column still exists and is
 * still the single answer to "which product is featured", but it is edited on
 * the New Arrival screen (`/admin/content/landing`) rather than under System →
 * Settings, so this form neither sends it nor writes it. Leaving it in the
 * schema would have been worse than tidy: the field is required, and a form that
 * stopped sending it would have failed to save the three email addresses with a
 * validation error about a product.
 */
export const updateBoutiqueSettingsSchema = z.object({
  houseEmail: z.email("That is not a valid email address."),
  conciergeEmail: z.email("That is not a valid email address."),
  wholesaleEmail: z.email("That is not a valid email address."),
});

// ── DeliverySetting ───────────────────────────────────────────

/**
 * A figure typed in EGP, stored in piastres.
 *
 * The same conversion `priceEgpField` performs in `schemas/admin.ts`, and here
 * for the same reason: it happens exactly once, on the way in, so no component
 * multiplies by 100 and no rounding difference can open up between the figure an
 * editor typed and the figure the cart quotes. `Math.round` because `90.1 * 100`
 * is not `9010` in binary floating point.
 */
const egpAmountField = z.coerce
  .number({ error: "Enter an amount in EGP, e.g. 90 or 1400." })
  .min(0, "This cannot be negative.")
  .max(1_000_000, "That figure looks like a typing mistake.")
  .transform((egp) => Math.round(egp * 100));

/**
 * What delivery costs on one channel — `"DeliverySetting"`,
 * `supabase/sql/0053_delivery_terms.sql`.
 *
 * The channel is a closed enum, not free text, and it identifies the row rather
 * than being a value the form sets: there are exactly two rows and the migration
 * seeds both, so this action updates and never inserts. A blank fee is a legal
 * answer meaning "delivery is complimentary on this channel", and a blank
 * minimum means every order qualifies — which is why neither has a lower bound
 * above zero.
 */
export const updateDeliverySettingSchema = z.object({
  channel: z.enum(["ONLINE", "OFFLINE"], {
    error: "Which channel — the website or the order desk?",
  }),
  feeInCents: egpAmountField,
  freeThresholdInCents: egpAmountField,
});

export type UpdateDeliverySettingInput = z.input<
  typeof updateDeliverySettingSchema
>;

// ── ContactChannel ────────────────────────────────────────────

const contactChannelFields = z.object({
  label: z
    .string()
    .trim()
    .min(1, "What is this channel called?")
    .max(60, "That label is too long."),
  label_ar: optionalText(60, "That label is too long."),

  // May carry newlines — the address and opening hours are multi-line and are
  // rendered with `whitespace-pre-line`.
  value: z
    .string()
    .trim()
    .min(1, "What should visitors see?")
    .max(400, "That is too long."),
  value_ar: optionalText(400, "That is too long."),

  /*
   * A `mailto:` or `tel:` target, or nothing when the value is not actionable
   * (an address is not a link). Restricted to those two schemes and https —
   * this string becomes an `href`, and `javascript:` in an href is the oldest
   * cross-site scripting there is.
   */
  href: optionalText(200, "That is too long.").refine(
    (value) =>
      value === null || /^(mailto:|tel:|https?:\/\/)\S+$/.test(value),
    "A link must start with mailto:, tel:, http:// or https://",
  ),

  sortOrder: sortOrderField,
});

export const createContactChannelSchema = contactChannelFields.extend({
  id: idField,
});

export const updateContactChannelSchema = contactChannelFields.extend({
  id: z.string().trim().min(1, "Which channel?"),
});

export const deleteContactChannelSchema = z.object({
  id: z.string().trim().min(1, "Which channel?"),
});

// ── SocialProfile ─────────────────────────────────────────────

const socialProfileFields = z.object({
  platform: z
    .string()
    .trim()
    .min(1, "Which platform?")
    .max(40, "That is too long."),
  handle: z
    .string()
    .trim()
    .min(1, "What is the handle?")
    .max(60, "That handle is too long."),
  /*
   * Always a real web address, and never optional: a social profile with no URL
   * is a row that renders a dead link in every email signature the house sends.
   * `mailto:` and `tel:` are not accepted here — this is a profile, not a
   * contact channel.
   */
  url: z
    .string()
    .trim()
    .min(1, "Where does it link to?")
    .max(300, "That URL is too long.")
    .refine(
      (value) => /^https?:\/\/\S+$/.test(value),
      "A profile link must start with http:// or https://",
    ),
  sortOrder: sortOrderField,
});

export const createSocialProfileSchema = socialProfileFields.extend({
  id: idField,
});

export const updateSocialProfileSchema = socialProfileFields.extend({
  id: z.string().trim().min(1, "Which profile?"),
});

export const deleteSocialProfileSchema = z.object({
  id: z.string().trim().min(1, "Which profile?"),
});
