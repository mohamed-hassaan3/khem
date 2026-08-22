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
  country: z.string().trim().min(2, "country").max(80, "countryLong"),

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
