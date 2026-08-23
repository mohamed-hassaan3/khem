/**
 * Customer portal types.
 *
 * These mirror the AGENTS.md §9 Prisma models rather than inventing a parallel
 * vocabulary: `OrderSummary` is the projection of `Order` + `OrderItem` that
 * the history list renders, `SavedAddress` is `Address` minus the columns no
 * screen shows. Keeping the names aligned is what makes the Supabase migration
 * a change of function *body* in `src/services/account.ts` and nothing else.
 *
 * Identity is deliberately absent from the service layer: `Viewer` is built
 * from the Clerk session, never queried, so no route can be tricked into
 * rendering a customer other than the one holding the session.
 */

/** Mirrors the §9 `OrderStatus` enum. */
export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

/**
 * One station on the rail — a status the order actually reached, and when.
 *
 * Rows of `"OrderStatusEvent"` (`supabase/sql/0017_order_events.sql`), written
 * by the same database functions that set the status. This is what lets the
 * tracker print a date under a station instead of an unlabelled dot: `"Order"`
 * itself holds one `updatedAt` and could never say *when* a parcel shipped.
 */
export interface OrderEvent {
  status: OrderStatus;
  /** ISO-8601, formatted at the edge in the active locale. */
  occurredAt: string;
}

/** One line of an order, as the history list prints it. */
export interface OrderLine {
  productName: string;
  quantity: number;
}

/**
 * An order as the history list renders it.
 *
 * `placedAt` is ISO-8601 and formatted at the edge with the active locale —
 * the previous page hardcoded "December 12, 2024", which is a display decision
 * frozen into data and wrong in Arabic.
 */
export interface OrderSummary {
  id: string;
  /** The human-facing `KHEM-YYYY-NNNN` number, not the uuid. */
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  totalInCents: number;
  lines: readonly OrderLine[];
  /**
   * The stations this order has reached, oldest first, one entry per status.
   *
   * A status the desk set twice appears once, stamped with the first time —
   * that is the date the customer was told, and a rail that moved its own
   * dates backwards and forwards would be worse than one with none.
   */
  events: readonly OrderEvent[];
  /** Absent until the order ships. */
  trackingCode: string | null;
}

/** A saved shipping address. */
export interface SavedAddress {
  id: string;
  /** `Home`, `Office` — the customer's own name for the place. */
  label: string;
  recipient: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

/**
 * The counts on the overview panel.
 *
 * Derived server-side rather than in the component so the page never has to
 * hold every order in memory to print a total.
 */
export interface AccountSummary {
  orderCount: number;
  lifetimeSpendInCents: number;
}

/** The signed-in customer, assembled from the Clerk session. */
export interface Viewer {
  /** Clerk's user id — the `clerkId` column in the §9 `User` model. */
  id: string;
  /** Full name when Clerk holds one; `null` when the account is email-only. */
  fullName: string | null;
  primaryEmail: string | null;
  imageUrl: string | null;
  /** Uppercase first letter of the name, falling back to the email. */
  initial: string;
}
