/**
 * Order and inventory write validation.
 *
 * Kept beside `schemas/admin.ts` rather than inside it: that file is the
 * catalog and journal boundary and is already long, and these rules have a
 * different twin — `supabase/sql/0015_orders.sql` and its three functions
 * rather than `0001_catalog.sql`. Same contract as its neighbour, though: a
 * Server Action is a public endpoint, and this is what actually decides what
 * reaches Postgres. The forms check the same rules only so an editor sees the
 * mistake before losing the round trip.
 *
 * English sentences, not error codes, for the reason `schemas/admin.ts` gives:
 * the dashboard is English by construction and has exactly one reader.
 */

import { z } from "zod";

import { MAX_QUANTITY_PER_LINE } from "@/src/lib/cart";

import type { OrderStatus } from "@/src/types/account";

/** Same shape the catalog actions return, re-exported so callers import one thing. */
export type { AdminActionResult } from "./admin";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const orderStatusValues = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;

export const paymentStatusValues = ["UNPAID", "PAID", "FAILED", "REFUNDED"] as const;

/**
 * One line of an order being recorded.
 *
 * No price: the price comes from the catalog inside `place_order()`. A form
 * that could name its own price is a form that can sell a bottle for nothing,
 * and the amount charged must come from the same place the storefront quotes.
 */
const orderLineSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, "Choose a product.")
    .regex(SLUG_PATTERN, "That is not a product slug."),
  quantity: z.coerce
    .number({ error: "Enter a quantity." })
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    // The same ceiling the storefront's stepper enforces. Stock is checked in
    // the database, where it can be checked under a lock; this only refuses
    // the obviously mistyped.
    .max(MAX_QUANTITY_PER_LINE * 10, "That quantity looks like a typing mistake."),
});

export const createOrderSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, "Who is this order for?")
    .max(120, "That name is too long."),
  customerEmail: z
    .union([z.literal(""), z.email("That is not a valid email address.")])
    .default(""),
  customerPhone: z
    .string()
    .trim()
    .max(40, "That phone number is too long.")
    .default(""),
  // A walk-in is the default. `ONLINE` exists so a phone order taken by the
  // desk can be recorded honestly, and so checkout has a value to write.
  channel: z.enum(["ONLINE", "OFFLINE"]).default("OFFLINE"),
  note: z.string().trim().max(2_000, "That note is too long.").default(""),
  /** Delivery charged on this order, in piastres. Zero for a collection. */
  shipInCents: z.coerce
    .number({ error: "Enter a delivery charge." })
    .int("Delivery must be a whole number of piastres.")
    .min(0, "Delivery cannot be negative.")
    .max(1_000_000, "That delivery charge looks like a typing mistake.")
    .default(0),
  items: z
    .array(orderLineSchema)
    .min(1, "An order needs at least one product.")
    .max(50, "That is more lines than one order can hold.")
    .refine(
      (items) => new Set(items.map((item) => item.slug)).size === items.length,
      "The same product appears twice — combine the lines instead.",
    ),
});

export type CreateOrderInput = z.input<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1, "Which order?"),
  status: z.enum(orderStatusValues),
});

/**
 * Claiming an order as opened.
 *
 * One field, because there is nothing to decide: the actor comes from
 * `requireAdmin()` on the server and the timestamp from `now()` in the
 * database. A request that could name either could forge a read receipt.
 */
export const markOrderOpenedSchema = z.object({
  orderId: z.string().min(1, "Which order?"),
});

export const updatePaymentStatusSchema = z.object({
  orderId: z.string().min(1, "Which order?"),
  paymentStatus: z.enum(paymentStatusValues),
});

/**
 * The counter a stock operation addresses.
 *
 * Online and offline move independently: the website sells from one, the desk
 * from the other, and neither borrows. Reused from `"OrderChannel"` in the
 * database rather than twinned, because an order's channel *is* the counter it
 * draws from.
 */
const inventoryChannel = z.enum(["ONLINE", "OFFLINE"], {
  error: "Choose online or offline.",
});

/** A quantity that actually moves something. */
const movementQuantity = z.coerce
  .number({ error: "Enter a quantity." })
  .int("Quantity must be a whole number.")
  .min(1, "Quantity must be at least 1.")
  .max(1_000_000, "That quantity looks like a typing mistake.");

const productSlug = z
  .string()
  .trim()
  .regex(SLUG_PATTERN, "That is not a product slug.");

/** An optional note an editor may attach to a movement. */
const movementReason = z
  .string()
  .trim()
  .max(200, "Please shorten that note.")
  .optional()
  .transform((value) => (value === "" ? undefined : value));

export const adjustInventorySchema = z.object({
  slug: z.string().trim().regex(SLUG_PATTERN, "That is not a product slug."),
  /**
   * An absolute count, not a delta. This is the control an editor uses after
   * counting the shelf, and "set it to what I just counted" is the only
   * instruction that survives a page they left open for an hour.
   */
  inventory: z.coerce
    .number({ error: "Enter a stock count." })
    .int("Stock must be a whole number.")
    .min(0, "Stock cannot be negative.")
    .max(1_000_000, "That stock count looks like a typing mistake."),
  /**
   * Which counter is being corrected. Stock is two independent numbers since
   * `supabase/sql/0042_inventory_channels.sql` — see `channel` below.
   */
  channel: inventoryChannel,
});

/** Units sold at the counter, entered at the end of the day. */
export const offlineSaleSchema = z.object({
  slug: productSlug,
  quantity: movementQuantity,
  reason: movementReason,
});

/** New stock arriving into one counter. */
export const receiveStockSchema = z.object({
  slug: productSlug,
  channel: inventoryChannel,
  quantity: movementQuantity,
  reason: movementReason,
});

/**
 * Units moved between counters.
 *
 * `from` and `to` are both required and must differ — the database refuses a
 * same-channel transfer too, but a form should not be able to ask for one.
 */
export const transferStockSchema = z
  .object({
    slug: productSlug,
    from: inventoryChannel,
    to: inventoryChannel,
    quantity: movementQuantity,
    reason: movementReason,
  })
  .refine((value) => value.from !== value.to, {
    error: "A transfer needs two different counters.",
    path: ["to"],
  });

/**
 * Which status may follow which.
 *
 * A closed record stays closed: once an order is cancelled or refunded its
 * units are back on the shelf, and re-opening it would sell stock the desk has
 * already promised elsewhere without taking it down again. Everything else is
 * allowed to move in both directions, because a desk mis-clicks and correcting
 * "shipped" back to "processing" is a normal Tuesday.
 */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
  PROCESSING: ["PENDING", "SHIPPED", "DELIVERED", "CANCELLED"],
  SHIPPED: ["PROCESSING", "DELIVERED", "CANCELLED"],
  DELIVERED: ["SHIPPED", "REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
