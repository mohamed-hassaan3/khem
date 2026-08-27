/**
 * The customer vocabulary, as the dashboard sees it.
 *
 * Distinct from `src/types/account.ts`, which is how a customer sees *himself
 * or herself*: that file is keyed by the Clerk session and never names another
 * person. This one describes somebody else's record, and so carries the two
 * things the portal never shows — the desk's aggregate view of what they have
 * spent, and whether they have an account at all.
 *
 * Money is in piastres throughout, the same minor unit as
 * `Product.priceInCents`. Nothing here is ever a float.
 */

import type { OrderStatus } from "./account";
import type { Credit } from "./credit";
import type { OrderChannel, PaymentStatus } from "./order";

/**
 * One person in the directory, whether or not they ever registered.
 *
 * Assembled by `customer_directory` in `supabase/sql/0024_customers.sql` from
 * two populations — account holders and the walk-in trade — because a Customers
 * screen driven by the `"User"` table alone would be nearly empty in a boutique
 * whose order book is mostly cash at the counter.
 */
export interface AdminCustomerSummary {
  /**
   * What the detail route is addressed by: a `"User"` row id for somebody with
   * an account, otherwise the email (or, for a walk-in who left neither an
   * email nor an account, `order:<id>`).
   */
  id: string;
  /** Present only when the person has signed in at least once. */
  clerkId: string | null;
  email: string | null;
  /** Their most recent spelling of their own name; null is possible, in theory. */
  name: string | null;
  phone: string | null;
  /** False for the walk-in trade — they are still customers. */
  hasAccount: boolean;
  marketingOptIn: boolean;
  /** When consent was last given *or withdrawn*. Null if never asked. */
  marketingOptInAt: string | null;
  orderCount: number;
  /** Excludes cancelled and refunded orders — money the house did not keep. */
  lifetimeSpendInCents: number;
  lastOrderAt: string | null;
  /** Registration date for an account; first purchase for everybody else. */
  joinedAt: string | null;
}

/** A page of the directory, with the figure its pager needs. */
export interface AdminCustomerPage {
  customers: readonly AdminCustomerSummary[];
  /** Matching customers *before* the limit — not the number on this page. */
  total: number;
}

/**
 * One of a customer's orders, as the detail screen lists them.
 *
 * Narrower than `AdminOrderSummary`: this is a history rail, and the columns it
 * omits are already one click away in the order book.
 */
export interface AdminCustomerOrder {
  id: string;
  orderNumber: string;
  placedAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  channel: OrderChannel;
  totalInCents: number;
  /** Null while nobody at the desk has opened it — see 0023. */
  firstOpenedAt: string | null;
}

/** A customer on their own screen: the directory row, plus what it omits. */
export interface AdminCustomerDetail extends AdminCustomerSummary {
  /** Empty for anyone without an account — an address book needs somewhere to live. */
  addresses: readonly CustomerAddress[];
  orders: readonly AdminCustomerOrder[];
  /**
   * Discovery Credits this customer holds. Empty for anyone without an account:
   * a credit belongs to a Clerk user and is not transferable.
   */
  credits: readonly Credit[];
}

/**
 * A saved address as the desk reads it.
 *
 * Structurally the same as `SavedAddress` in `src/types/account.ts` and
 * deliberately not an alias of it: the two happen to coincide today, and
 * collapsing them would mean a column added for the customer's own screen
 * silently appears on somebody else's record.
 */
export interface CustomerAddress {
  id: string;
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
