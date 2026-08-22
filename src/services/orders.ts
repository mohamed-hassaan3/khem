import "server-only";

/**
 * Order reads for the **storefront** — the checkout path and the confirmation
 * page.
 *
 * Distinct from `src/services/admin/orders.ts`, which reads the same table for
 * the desk, and from `src/services/account.ts`, which reads it for a signed-in
 * customer. Three readers, three projections, and the differences between them
 * are the access control:
 *
 *  - the desk sees everything, behind `requireAdmin()`;
 *  - the portal sees a customer's own orders, filtered on `clerkUserId` from a
 *    verified session;
 *  - **this file sees almost nothing**, because its one caller is reachable by
 *    anybody holding an order number, and order numbers are sequential.
 *
 * All three use the secret key, because `supabase/sql/0015_orders.sql` grants
 * the public roles nothing at all on `"Order"`.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import { orderStatusSchema, parseList } from "@/src/schemas/db/orders";
import type { OrderConfirmation } from "@/src/types/checkout";
import { z } from "zod";

function logFailure(query: string, message: string): void {
  console.error(`[orders] ${query} failed: ${message}`);
}

/**
 * Mask an address down to something a person recognises and a scraper cannot use.
 *
 * `mohamed@outlook.com` → `m•••@outlook.com`. The purpose is one line on the
 * confirmation page — "a confirmation is on its way to m•••@outlook.com" —
 * which reassures the buyer they typed it correctly without printing a live
 * address on a page anyone can reach by guessing the number above it.
 */
function maskEmail(email: string | null): string | null {
  if (email === null) return null;

  const at = email.lastIndexOf("@");
  if (at < 1) return null;

  return `${email.slice(0, 1)}•••${email.slice(at)}`;
}

// ── Confirmation ──────────────────────────────────────────────

const confirmationRowSchema = z.object({
  orderNumber: z.string(),
  status: orderStatusSchema,
  paymentMethod: z.enum(["CARD", "CASH"]),
  placedAt: z.string(),
  subtotalInCents: z.number(),
  shipInCents: z.number(),
  totalInCents: z.number(),
  customerEmail: z.string().nullable().default(null),
  items: z
    .array(z.object({ productName: z.string(), quantity: z.number() }))
    .default([]),
});

/**
 * One order, as `/checkout/confirmed` prints it.
 *
 * ## The column list is the security boundary
 *
 * `KHEM-2026-1043` is one keystroke from `KHEM-2026-1042`, so this must be
 * treated as a public read no matter who is signed in. Which means the answer
 * to "what can somebody learn by enumerating order numbers?" has to be
 * *nothing worth having*: no address, no phone, no name, no `note`, and an
 * email that is masked before it leaves this function.
 *
 * What remains — a status, a total, and a list of product names — is what the
 * buyer needs to see and what an enumerator gains nothing from. Do not widen
 * this list. If the confirmation page ever needs the delivery address, the
 * right move is to require a session and read through
 * `src/services/account.ts`, not to add a column here.
 */
export async function getOrderForConfirmation(
  orderNumber: string,
): Promise<OrderConfirmation | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Order")
    .select(
      "orderNumber, status, paymentMethod, placedAt, subtotalInCents, " +
        "shipInCents, totalInCents, customerEmail, " +
        "items:OrderItem(productName, quantity)",
    )
    .eq("orderNumber", orderNumber)
    .maybeSingle();

  if (error) {
    logFailure("getOrderForConfirmation", error.message);
    return null;
  }

  const parsed = confirmationRowSchema.safeParse(data);
  if (!parsed.success) return null;

  const { items, customerEmail, ...order } = parsed.data;

  return {
    ...order,
    maskedEmail: maskEmail(customerEmail),
    lines: items,
  };
}

// ── Cart resolution ───────────────────────────────────────────

/** One resolved line: what `place_order()` takes, plus the price to add up. */
export interface ResolvedCartLine {
  productId: string;
  slug: string;
  name: string;
  quantity: number;
  priceInCents: number;
}

export type CartResolution =
  | { ok: true; lines: readonly ResolvedCartLine[]; subtotalInCents: number }
  | { ok: false; reason: "unavailable" | "missing"; productName?: string };

const cartProductRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  priceInCents: z.number(),
  isArchived: z.boolean(),
});

/**
 * Turn the browser's `{ productId, quantity }` pairs into priced lines.
 *
 * The cart stores ids because that is all `src/providers/cart-provider.tsx`
 * ever persists — no names, no prices, deliberately. So the ids have to become
 * slugs somewhere, and it happens here, from the database, in one query.
 *
 * ## What this is and is not authoritative for
 *
 * The **slugs** are authoritative: `place_order()` takes slugs and nothing
 * else can supply them. The **subtotal** is not — it exists only so the caller
 * can compute a shipping fee, which `place_order()` takes as an input and
 * cannot derive. The order's real subtotal is recomputed inside that function
 * from rows it has locked, so a price that changes between this read and that
 * write moves the total and does not corrupt it.
 *
 * An id with no row, or an archived product, is a refusal rather than a silent
 * drop. Quietly removing a line and charging for the rest means somebody pays
 * for an order they did not place.
 */
export async function resolveCartToLines(
  items: readonly { productId: string; quantity: number }[],
): Promise<CartResolution> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, reason: "unavailable" };

  const ids = items.map((item) => item.productId);

  const { data, error } = await supabase
    .from("Product")
    .select("id, slug, name, priceInCents, isArchived")
    .in("id", ids);

  if (error) {
    logFailure("resolveCartToLines", error.message);
    return { ok: false, reason: "unavailable" };
  }

  const products = new Map(
    parseList(data, (row) => {
      const parsed = cartProductRowSchema.safeParse(row);
      return parsed.success ? parsed.data : null;
    }).map((product) => [product.id, product]),
  );

  const lines: ResolvedCartLine[] = [];

  for (const item of items) {
    const product = products.get(item.productId);

    // A forged id, a deleted product, or a bag left open across a catalog
    // change. The visitor is told the bag no longer matches the catalog rather
    // than being charged for what is left of it.
    if (!product) return { ok: false, reason: "missing" };

    // Archived is refused here as well as inside `place_order()`. The database
    // check is the one that counts; this one exists so the visitor gets the
    // product's name in the message instead of a generic failure.
    if (product.isArchived) {
      return { ok: false, reason: "missing", productName: product.name };
    }

    lines.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      quantity: item.quantity,
      priceInCents: product.priceInCents,
    });
  }

  const subtotalInCents = lines.reduce(
    (sum, line) => sum + line.priceInCents * line.quantity,
    0,
  );

  return { ok: true, lines, subtotalInCents };
}

// ── Mail payload ──────────────────────────────────────────────

const mailRowSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  customerName: z.string(),
  customerEmail: z.string().nullable().default(null),
  customerPhone: z.string().nullable().default(null),
  /*
   * Never printed in a letter — only branched on. It is what decides whether
   * "Track Your Order" can point at the customer portal at all: an order placed
   * without a session belongs to no account and would land a guest on a
   * sign-in wall. See `customerOrderEmail` in `src/lib/email/order-templates.ts`.
   */
  clerkUserId: z.string().nullable().default(null),
  status: orderStatusSchema,
  paymentMethod: z.enum(["CARD", "CASH"]),
  paymentStatus: z.enum(["UNPAID", "PAID", "FAILED", "REFUNDED"]),
  locale: z.enum(["en", "ar"]).catch("en"),
  subtotalInCents: z.number(),
  shipInCents: z.number(),
  totalInCents: z.number(),
  trackingCode: z.string().nullable().default(null),
  shipLine1: z.string().nullable().default(null),
  shipLine2: z.string().nullable().default(null),
  shipCity: z.string().nullable().default(null),
  shipState: z.string().nullable().default(null),
  shipPostalCode: z.string().nullable().default(null),
  shipCountry: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
  placedAt: z.string(),
  items: z
    .array(
      z.object({
        productName: z.string(),
        quantity: z.number(),
        priceInCents: z.number(),
      }),
    )
    .default([]),
});

/** Everything the email templates need, in one shape. */
export type OrderMailRecord = z.infer<typeof mailRowSchema>;

/**
 * The order, as an email needs it.
 *
 * Wide where the confirmation projection is narrow — this one carries the
 * address and the phone number, because the house notification *is* the
 * picking slip and a courier cannot deliver to a masked email.
 *
 * That width is safe for one reason only: the two callers are
 * `src/actions/checkout.ts` and `src/actions/admin/orders.ts`, and neither
 * renders this into a page. It goes to a mail template addressed to the
 * customer themselves or to the house inbox. **Do not call this from a page.**
 */
export async function getOrderForMail(
  orderId: string,
): Promise<OrderMailRecord | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Order")
    .select(
      "id, orderNumber, customerName, customerEmail, customerPhone, clerkUserId, status, " +
        "paymentMethod, paymentStatus, locale, subtotalInCents, shipInCents, " +
        "totalInCents, trackingCode, shipLine1, shipLine2, shipCity, shipState, " +
        "shipPostalCode, shipCountry, note, placedAt, " +
        "items:OrderItem(productName, quantity, priceInCents)",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    logFailure("getOrderForMail", error.message);
    return null;
  }

  const parsed = mailRowSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** The same record, found by the number the desk and the webhook hold. */
export async function getOrderForMailByNumber(
  orderNumber: string,
): Promise<OrderMailRecord | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Order")
    .select("id")
    .eq("orderNumber", orderNumber)
    .maybeSingle();

  if (error || !data || typeof data.id !== "string") {
    if (error) logFailure("getOrderForMailByNumber", error.message);
    return null;
  }

  return getOrderForMail(data.id);
}
