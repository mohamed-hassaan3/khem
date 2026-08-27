/**
 * Stockist write validation.
 *
 * Kept beside `schemas/orders.ts` rather than inside `schemas/admin.ts` for the
 * same reason that file gives: its twin is a different migration —
 * `supabase/sql/0003_directory.sql` — and `admin.ts` is already long.
 *
 * ## The two constraints this file mirrors
 *
 * `"Stockist"` carries two CHECK constraints, and they are the interesting part
 * of the whole screen:
 *
 *   stockist_coming_soon_has_no_details
 *     — an announced location has no address, phone, hours or map link;
 *   stockist_open_has_address
 *     — an open one has an address.
 *
 * Both are enforced by the database, which is what makes them true. They are
 * restated here so the *editor* finds out at the field rather than through a
 * Postgres check violation rendered as a form-level sentence — the constraint
 * names would mean nothing to the person filling in the form.
 *
 * The invariant is worth stating plainly: an announcement is not a destination.
 * Without it, half-filling a `comingSoon` row would publish a phone number for
 * a shop nobody can visit.
 *
 * English sentences, not error codes, for the reason `schemas/admin.ts` gives:
 * the dashboard is English by construction and has one reader.
 */

import { z } from "zod";

/** Mirrors `public."StockistRegion"`. Labels live in `dict.stockists.regions`. */
export const stockistRegionValues = [
  "middleEast",
  "europe",
  "americas",
  "asiaPacific",
] as const;

/** Mirrors `public."StockistType"`. */
export const stockistTypeValues = [
  "flagship",
  "boutique",
  "retailPartner",
  "departmentStore",
] as const;

/** Mirrors `public."StockistStatus"`. */
export const stockistStatusValues = ["open", "comingSoon"] as const;

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Empty string means "not set".
 *
 * Forms cannot hold null — an untouched text input is `""` — and the column is
 * nullable, so the two have to be reconciled somewhere. Here, once, rather than
 * in every action that writes a stockist.
 */
function optionalText(max: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value.length === 0 ? null : value));
}

/** A URL, or nothing. Rejects anything that is not http(s). */
function optionalUrl(message: string) {
  return z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .refine(
      (value) => value === null || /^https?:\/\/\S+$/.test(value),
      message,
    );
}

const stockistFields = z.object({
  name: z
    .string()
    .trim()
    .min(2, "What is this location called?")
    .max(120, "That name is too long."),
  name_ar: optionalText(120, "That name is too long."),

  city: z.string().trim().min(1, "Which city?").max(80, "That is too long."),
  city_ar: optionalText(80, "That is too long."),

  country: z.string().trim().min(1, "Which country?").max(80, "That is too long."),
  country_ar: optionalText(80, "That is too long."),

  region: z.enum(stockistRegionValues),
  type: z.enum(stockistTypeValues),
  status: z.enum(stockistStatusValues),

  address: optionalText(300, "That address is too long."),
  address_ar: optionalText(300, "That address is too long."),

  // Display form — "+20 11 234 5678". Latin in both trees, so no Arabic twin.
  phone: optionalText(40, "That phone number is too long."),

  /*
   * The `tel:` target. Permissive on the prefix because the seeded rows carry
   * `tel:+20…` while the column comment describes the bare number, and a
   * validator that refused either would make an existing row uneditable.
   */
  phoneHref: optionalText(60, "That is too long.").refine(
    (value) => value === null || /^(tel:)?\+?[0-9\s-]+$/.test(value),
    "A tel: target is digits, optionally with a leading + — no letters.",
  ),

  hours: optionalText(120, "That is too long."),
  hours_ar: optionalText(120, "That is too long."),

  mapsUrl: optionalUrl("A map link must start with http:// or https://"),

  imageUrl: z
    .string()
    .trim()
    .min(1, "This location needs a photograph.")
    .refine((value) => /^https?:\/\/\S+$/.test(value), "That is not a valid URL."),
  imageAlt: z
    .string()
    .trim()
    .min(2, "Describe the photograph for anyone who cannot see it.")
    .max(200, "That description is too long."),
  imageAlt_ar: optionalText(200, "That description is too long."),

  isPublished: z.coerce.boolean().default(true),
  sortOrder: z.coerce
    .number({ error: "Enter a number." })
    .int("Whole numbers only.")
    .min(0, "Cannot be negative.")
    .max(9_999, "That is too large.")
    .default(0),
});

/**
 * The two CHECK constraints, restated against the parsed values.
 *
 * Attached with `superRefine` rather than as field-level rules because each one
 * is a statement about *two* fields — the status and the detail — and neither
 * field can decide on its own whether it is valid.
 */
function applyStatusRules(
  value: z.infer<typeof stockistFields>,
  ctx: z.RefinementCtx,
): void {
  if (value.status === "comingSoon") {
    const details = [
      ["address", value.address],
      ["address_ar", value.address_ar],
      ["phone", value.phone],
      ["phoneHref", value.phoneHref],
      ["hours", value.hours],
      ["hours_ar", value.hours_ar],
      ["mapsUrl", value.mapsUrl],
    ] as const;

    for (const [path, detail] of details) {
      if (detail !== null) {
        ctx.addIssue({
          code: "custom",
          path: [path],
          message:
            "An announced location publishes no details. Clear this, or set the status to open.",
        });
      }
    }

    return;
  }

  if (value.address === null) {
    ctx.addIssue({
      code: "custom",
      path: ["address"],
      message: "An open location needs an address people can visit.",
    });
  }
}

export const createStockistSchema = stockistFields
  .extend({
    /*
     * The id is the slug, typed once and then permanent — the same convention
     * as `Collection.id` in `0001_catalog.sql`. `"Stockist".id` has no default,
     * so unlike every other table here one has to be supplied.
     */
    id: z
      .string()
      .trim()
      .min(2, "Give this location a short id, like cairo-flagship.")
      .max(64, "That id is too long.")
      .regex(ID_PATTERN, "Lowercase letters, numbers and hyphens only."),
  })
  .superRefine(applyStatusRules);

/** The id identifies the row and is never edited — renaming one would orphan it. */
export const updateStockistSchema = stockistFields
  .extend({ id: z.string().trim().min(1, "Which location?") })
  .superRefine(applyStatusRules);

/** The row-level publish switch, which changes what the public directory shows. */
export const setStockistPublishedSchema = z.object({
  id: z.string().trim().min(1, "Which location?"),
  isPublished: z.coerce.boolean(),
});

export const deleteStockistSchema = z.object({
  id: z.string().trim().min(1, "Which location?"),
});

export type CreateStockistInput = z.input<typeof createStockistSchema>;
