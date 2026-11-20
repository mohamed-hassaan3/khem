/**
 * What a customer may say about where their parcels go.
 *
 * The bounds are not invented here — every one of them is the `check` constraint
 * written on `public."Address"` in `supabase/sql/0024_customers.sql`, restated
 * so the form refuses what the database would refuse anyway. A field that
 * passes this and then fails at the insert would be a schema that lies to the
 * person filling it in.
 *
 * **No owner in the payload.** There is no `userId` and no `clerkId`: the
 * account is taken from the session inside the action, and a schema that
 * accepted an owner would be one that lets a signed-in customer write into
 * somebody else's address book. `id` is present because editing needs to name a
 * row, and the action scopes it — `.eq("userId", …)` — so a forged one touches
 * nothing.
 *
 * `postalCode` accepts the empty string. Egyptian addresses frequently carry no
 * postal code and a great many people who have one do not know it; the column is
 * `not null` with no minimum, so "" is a value it holds, and demanding one here
 * is how a domestic address book loses a domestic address. The same reasoning as
 * `src/schemas/checkout.ts`.
 */

import { z } from "zod";

import { OTHER_COUNTRY } from "@/src/constants/countries";

/** An ISO-3166 alpha-2 code, as the country chooser stores it. */
export const COUNTRY_CODE = /^[A-Z]{2}$/;

/**
 * The vocabulary of a field failure.
 *
 * Codes rather than sentences, because the sentence has to exist twice — the
 * form is bilingual and the action is not the place either language lives. The
 * client resolves these through `account.addresses.form.errors`.
 */
export type AddressErrorCode = "required" | "tooShort" | "tooLong" | "invalid";

export const addressInputSchema = z.object({
  /** Present means edit. The action still proves the row is this customer's. */
  id: z.string().trim().min(1).max(64).optional(),

  /** The customer's own name for the place: "Home", "Office". */
  label: z.string().trim().min(1).max(60),
  recipient: z.string().trim().min(2).max(120),

  line1: z.string().trim().min(1).max(200),
  /** A landmark line, and optional. Blank is stored as null, never as "". */
  line2: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),

  city: z.string().trim().min(1).max(80),
  /*
   * Governorate. Optional, like the postal code: neither form asks for it any
   * more (`src/components/checkout/AddressFields.tsx`), and a courier works
   * from the street, the landmark and the city. The column is `not null` with
   * no minimum, so "" is a value it holds. An address saved with one keeps it,
   * because the form carries it unseen.
   */
  state: z.string().trim().max(80).default(""),
  postalCode: z.string().trim().max(20),
  /*
   * A country code from the chooser. Shape, not membership: a country dropped
   * from the featured list (`src/constants/countries.ts`) stays a valid value
   * for the addresses already saved in it.
   *
   * Two things are refused. The checkout's "Another country" sentinel is a
   * placeholder, not a place. And free text — which the form can no longer
   * produce — is let through here only so the action can accept it on one
   * condition: it is the value already stored on the address being edited (a
   * row from before the field was a chooser). See `saveAddress`.
   */
  country: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((value) => value !== OTHER_COUNTRY),

  isDefault: z.boolean().optional().default(false),
});

/** Naming one row of the address book. Everything else comes from the session. */
export const addressIdSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

export type AddressInput = z.input<typeof addressInputSchema>;
export type AddressPayload = z.output<typeof addressInputSchema>;

/** The fields a form can show an error against. `id` is never one of them. */
export type AddressField = Exclude<keyof AddressPayload, "id" | "isDefault">;

/**
 * Zod's issues, reduced to one code per field.
 *
 * The first issue on a field wins: a value that is both empty and malformed is
 * empty, and telling somebody two things about one input at once is how a form
 * stops being read.
 */
export function addressFieldErrors(
  error: z.ZodError,
): Partial<Record<AddressField, AddressErrorCode>> {
  const errors: Partial<Record<AddressField, AddressErrorCode>> = {};

  for (const issue of error.issues) {
    const [field] = issue.path;
    if (typeof field !== "string" || field === "id" || field === "isDefault") {
      continue;
    }

    const key = field as AddressField;
    if (errors[key] !== undefined) continue;

    if (issue.code === "too_small") {
      // `min(1)` is "you left it blank"; `min(2)` on the recipient is "that is
      // not a name". Different failures, different sentences.
      errors[key] = Number(issue.minimum) <= 1 ? "required" : "tooShort";
    } else if (issue.code === "too_big") {
      errors[key] = "tooLong";
    } else {
      errors[key] = "invalid";
    }
  }

  return errors;
}
