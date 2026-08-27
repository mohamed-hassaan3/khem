/**
 * What the desk's bell shows.
 *
 * Mirrors `admin_notification_feed()` in
 * `supabase/sql/0031_admin_notifications.sql`. Nothing here is stored as a row:
 * the feed is derived from the orders, accounts, redemptions and credits that
 * already exist, and only the *read* state has a table of its own.
 *
 * Note what a notification is allowed to carry — a label, a short detail, an
 * amount, a time. **No address, no phone, no order contents.** The bell points
 * at a screen that is already behind `requireAdmin()`; it is not a second place
 * customer data is rendered.
 */

/** The four things worth telling the desk about. */
export type AdminNotificationKind = "ORDER" | "CUSTOMER" | "VOUCHER" | "CREDIT";

export interface AdminNotification {
  kind: AdminNotificationKind;
  /** Identifies the thing within its kind. Compared, never rendered. */
  entityId: string;
  /** The order number, the customer's name, the voucher code. */
  label: string;
  /** One supporting line, where there is one. */
  detail: string | null;
  /** Money involved, in piastres. Null where none is. */
  amountInCents: number | null;
  occurredAt: string;
  isRead: boolean;
}

/**
 * A product the shelf is running out of.
 *
 * Deliberately **not** an `AdminNotification`. Low stock is a *condition*, not
 * an event: a product goes low, is restocked, and goes low again. A dismissible
 * notification would hide the second occurrence, so this is read live and
 * clears itself when the shelf is refilled.
 */
export interface LowStockItem {
  slug: string;
  name: string;
  inventory: number;
}
