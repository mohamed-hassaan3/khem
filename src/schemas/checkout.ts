/**
 * Checkout write validation.
 *
 * The boundary. `src/actions/checkout.ts` is a public HTTP endpoint like every
 * Server Action, and this file is what actually decides what reaches
 * `place_order()`. The form checks the same rules first only so a visitor sees
 * the mistake before losing the round trip.
 *
 * ## Why the messages are keys, not sentences
 *
 * `src/schemas/orders.ts` — the dashboard's twin of this file — writes English
 * prose into its messages, and says why: the desk is English by construction
 * and has exactly one reader. The storefront has neither property. So every
 * message here is a **key under `dict.checkout.errors`**, resolved by the
 * client in the visitor's own language. A key that has no translation is a
 * compile error on the dictionary side, which is the point.
 *
 * ## What is deliberately absent
 *
 * No price, no subtotal, no total, no shipping. The browser posts product ids
 * and quantities; every figure is derived server-side from the catalog. A
 * schema that accepted a total would be a schema that lets somebody pay one
 * pound for a bottle, and no amount of validation downstream can undo that.
 */

import { z } from "zod";

import { MAX_QUANTITY_PER_LINE } from "@/src/lib/cart";
import { isEgypt } from "@/src/lib/shipping";
import { LOCALES } from "@/src/lib/i18n/config";

/**
 * A cart line as it crosses the wire.
 *
 * `productId` is the uuid the catalog projection carries and the browser
 * stores; it is checked for shape here and for existence in the action, which
 * is the only place that can answer the question.
 */
const checkoutItemSchema = z.object({
  productId: z.string().trim().min(8, "items").max(64, "items"),
  quantity: z.coerce
    .number({ error: "quantity" })
    .int("quantity")
    .min(1, "quantity")
    .max(MAX_QUANTITY_PER_LINE, "quantity"),
});

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "name").max(120, "nameLong"),

  // Required, unlike the dashboard's optional field. A walk-in can leave
  // without giving an address; somebody buying online cannot be sent a receipt,
  // a confirmation, or a shipping notice without one, and all three are
  // promised on the page.
  customerEmail: z.email("email").max(200, "email"),

  // Also required, and for a blunter reason: a courier in Cairo phones ahead.
  // An address with no number is a parcel that comes back.
  customerPhone: z.string().trim().min(7, "phone").max(40, "phone"),

  paymentMethod: z.enum(["CARD", "CASH"], { error: "paymentMethod" }),

  /*
   * A Discovery Credit to spend, or nothing.
   *
   * An **id only** — never an amount, never an owner, never a verdict on
   * whether it may be used. Everything that decides those is read from the
   * database inside `place_order()`, under a row lock, in the same transaction
   * that writes the order. See `supabase/sql/0027_credit_redemption.sql`.
   *
   * Shape-checked here and nothing more: an id that does not exist, belongs to
   * somebody else, or has already been spent is refused there, because that is
   * the only place the answer cannot go stale between the check and the write.
   */
  creditId: z.string().trim().max(64, "credit").default(""),

  /*
   * A discount code, or nothing.
   *
   * A **string only** — never a percentage, an amount, or a verdict. What it is
   * worth and whether it applies at all are decided by `resolve_discount()`
   * inside the order transaction, which is what `supabase/AGENTS.md` §12's
   * "never calculate final order prices on the client" actually requires.
   *
   * Shape-checked here and nothing more. Uppercasing happens in SQL, so the
   * customer may type it however they like.
   */
  discountCode: z.string().trim().max(40, "discount").default(""),

  // Validated rather than trusted: it decides which language every future email
  // about this order is written in, and it arrives from the client.
  locale: z.enum(LOCALES, { error: "locale" }),

  line1: z.string().trim().min(4, "line1").max(200, "line1Long"),
  line2: z.string().trim().max(200, "line2Long").default(""),
  city: z.string().trim().min(2, "city").max(80, "cityLong"),
  // Governorate in Egypt, state or province elsewhere.
  state: z.string().trim().min(2, "state").max(80, "stateLong"),
  // Optional on purpose. Egyptian addresses frequently carry no postal code,
  // and demanding one is how a checkout loses a domestic sale.
  postalCode: z.string().trim().max(20, "postalCodeLong").default(""),
  /*
   * Egypt, and only Egypt. The house delivers nowhere else, and a checkout that
   * takes the money first and discovers the address on a picking slip has
   * already failed the customer. `isEgypt` is a small allowlist rather than a
   * country parser — see `src/lib/shipping.ts` for why generosity here would be
   * a hole rather than a kindness.
   */
  country: z
    .string()
    .trim()
    .min(2, "country")
    .max(80, "countryLong")
    .refine(isEgypt, "outsideEgypt"),

  /** Delivery instructions from the customer. Distinct from the desk's `note`. */
  note: z.string().trim().max(500, "noteLong").default(""),

  items: z
    .array(checkoutItemSchema)
    .min(1, "emptyCart")
    .max(50, "tooManyLines")
    .refine(
      (items) => new Set(items.map((item) => item.productId)).size === items.length,
      "duplicateLines",
    ),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;

/**
 * First error per field, keyed by field name.
 *
 * Same helper shape as `fieldErrorsFrom` in `src/actions/admin/shared.ts`, kept
 * separate because that one is imported by modules behind `requireAdmin()` and
 * this one is not. The values are dictionary keys; the client resolves them.
 */
export function checkoutFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}
