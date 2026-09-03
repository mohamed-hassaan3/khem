/**
 * Discount write validation.
 *
 * The boundary for the **dashboard**. The customer-facing half needs no schema
 * of its own: a shopper sends a code string, and `resolve_discount()` decides
 * everything about it — `supabase/AGENTS.md` §12's "never calculate final order
 * prices on the client", enforced where it cannot be bypassed.
 *
 * English sentences, not error codes: the dashboard has one reader.
 */

import { z } from "zod";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Uppercased on the way in, because the column is stored uppercased and unique.
 * Comparing case-insensitively later would let `welcome10` and `WELCOME10` be
 * two rows that look like one code.
 */
const codeField = z
  .string()
  .trim()
  .min(3, "A code needs at least three characters.")
  .max(40, "That code is too long.")
  .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and hyphens only.")
  .transform((value) => value.toUpperCase());

/** Empty means "no limit" — a form input cannot hold null. */
function optionalPositiveInt(message: string) {
  return z
    .union([z.literal(""), z.coerce.number().int().positive()])
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || value > 0, message);
}

/** Empty means "no boundary". A code with neither is valid and always-on. */
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

const discountFields = z.object({
  kind: z.enum(["PERCENTAGE", "FIXED"]),

  /**
   * Read together with `kind`: a percentage 1–100, or an amount in piastres.
   * The upper bound on a percentage is checked again by the database, which is
   * what makes it true.
   */
  value: z.coerce
    .number({ error: "Enter a number." })
    .int("Whole numbers only.")
    .positive("Must be more than zero."),

  isActive: z.union([z.boolean(), z.string()]).transform(
    (value) => (typeof value === "boolean" ? value : value === "true"),
  ),

  startsAt: optionalDate("That is not a valid date."),
  endsAt: optionalDate("That is not a valid date."),

  totalUseLimit: optionalPositiveInt("Must be more than zero."),
  perCustomerLimit: optionalPositiveInt("Must be more than zero."),

  minimumOrderInCents: z.coerce
    .number({ error: "Enter a number." })
    .int("Whole piastres only.")
    .min(0, "Cannot be negative.")
    .default(0),

  appliesTo: z.enum(["ALL", "PRODUCTS", "COLLECTIONS"]),

  requiresGrant: z.union([z.boolean(), z.string()]).transform(
    (value) => (typeof value === "boolean" ? value : value === "true"),
  ),

  /**
   * Whether this is *the* welcome offer.
   *
   * At most one campaign may hold it, and that is enforced in the database
   * rather than here: a partial unique index refuses a second, and a trigger
   * clears the previous holder in the same statement. So this field needs no
   * cross-row validation — a schema cannot see the other rows anyway, and one
   * that pretended to would be a check that goes stale between here and the
   * write. See `supabase/sql/0030_welcome.sql`.
   */
  isWelcome: z.union([z.boolean(), z.string()]).transform(
    (value) => (typeof value === "boolean" ? value : value === "true"),
  ),

  description: z
    .string()
    .trim()
    .max(300, "That description is too long.")
    .transform((value) => (value.length === 0 ? null : value)),

  productSlugs: z.array(z.string().trim().regex(SLUG_PATTERN)).default([]),
  collectionSlugs: z.array(z.string().trim().regex(SLUG_PATTERN)).default([]),
});

/**
 * A percentage above 100 would hand money back, and a restricted discount with
 * nothing restricted to it can never apply. Both are statements about *two*
 * fields, which is why they are refinements rather than field rules.
 */
function applyRules(
  value: z.infer<typeof discountFields>,
  ctx: z.RefinementCtx,
): void {
  if (value.kind === "PERCENTAGE" && value.value > 100) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: "A percentage cannot be more than 100.",
    });
  }

  if (value.appliesTo === "PRODUCTS" && value.productSlugs.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["productSlugs"],
      message: "Choose at least one product, or apply the code to everything.",
    });
  }

  if (value.appliesTo === "COLLECTIONS" && value.collectionSlugs.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["collectionSlugs"],
      message: "Choose at least one collection, or apply the code to everything.",
    });
  }

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

export const createDiscountSchema = discountFields
  .extend({ code: codeField })
  .superRefine(applyRules);

/** The code is the row's identity here and is not editable — orders reference it. */
export const updateDiscountSchema = discountFields
  .extend({ id: z.string().trim().min(1, "Which code?") })
  .superRefine(applyRules);

export const setDiscountActiveSchema = z.object({
  id: z.string().trim().min(1, "Which code?"),
  isActive: z.union([z.boolean(), z.string()]).transform(
    (value) => (typeof value === "boolean" ? value : value === "true"),
  ),
});

export const deleteDiscountSchema = z.object({
  id: z.string().trim().min(1, "Which code?"),
});

/**
 * Inviting one address to an invitation-only code.
 *
 * The address is validated here and **normalised in the database**, not here:
 * `discount_grants` is unique on the lowercased form and `resolve_discount()`
 * looks it up the same way, so the normalisation has to happen where both can
 * see it. This schema's job is to refuse what is not an address at all.
 */
export const issueGrantSchema = z.object({
  code: codeField,
  email: z.email("That is not a valid email address."),
  /** Empty means "until the campaign itself ends". */
  expiresInDays: z
    .union([z.literal(""), z.coerce.number().int().positive().max(3650)])
    .transform((value) => (value === "" ? null : value)),
});

export const revokeGrantSchema = z.object({
  code: codeField,
  grantId: z.string().min(1, "Which grant?"),
});
