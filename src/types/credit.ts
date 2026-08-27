/**
 * The Discovery Credit vocabulary.
 *
 * Mirrors `supabase/sql/0026_discovery_credits.sql`. Money is in piastres
 * throughout, the same minor unit as `Product.priceInCents`.
 *
 * The shapes here describe a credit as the *system* sees it. Nothing in this
 * file is ever assembled from a browser: a credit's amount, owner and
 * eligibility are decided in SQL, and the client only ever names an id.
 */

/**
 * A credit's state, derived by the `credit_balances` view.
 *
 * Never stored. A status column beside a transaction list is two records of one
 * fact, and the day they disagree there is no way to tell which is lying.
 */
export type CreditStatus =
  /** Earned, but the Discovery Set has not been delivered — the clock has not started. */
  | "PENDING_DELIVERY"
  /** Spendable now. */
  | "AVAILABLE"
  /** Nothing left on it. The transactions say whether it was spent or lapsed. */
  | "REDEEMED"
  /** Past its sixty days with money still on it. */
  | "EXPIRED"
  /** The Discovery Set was refunded. */
  | "CANCELLED";

/** The five movements the policy names. Nothing else may be written. */
export type CreditTransactionKind =
  | "EARNED"
  | "USED"
  | "REFUNDED"
  | "EXPIRED"
  | "ADJUSTED";

/** One credit, with its derived balance and status. */
export interface Credit {
  id: string;
  /** The Clerk user who owns it. A credit is not transferable. */
  clerkUserId: string;
  /** The Discovery Set order that earned it. */
  sourceOrderId: string;
  sourceOrderItemId: string;
  /** Which unit of a multi-quantity line. A line of two earns two credits. */
  unitIndex: number;
  /** What was paid for that unit — the credit's face value. */
  amountInCents: number;
  earnedAt: string;
  /** Null until the Set is delivered. */
  deliveredAt: string | null;
  /** Sixty days after delivery. Null until then. */
  expiresAt: string | null;
  cancelledAt: string | null;
  /** The sum of the ledger. Stored nowhere. */
  balanceInCents: number;
  status: CreditStatus;
}

/** One movement on a credit. Append-only. */
export interface CreditTransaction {
  id: string;
  creditId: string;
  kind: CreditTransactionKind;
  /** Signed: EARNED and REFUNDED add, USED and EXPIRED subtract. */
  amountInCents: number;
  /** The order that spent or restored it. */
  orderId: string | null;
  note: string | null;
  /** The admin behind an ADJUSTED row; null for everything the system did. */
  actor: string | null;
  occurredAt: string;
}

/** A credit on its own screen: the row, its trail, and who it belongs to. */
export interface CreditDetail extends Credit {
  transactions: readonly CreditTransaction[];
  /** The customer's name, resolved from the source order for the desk's benefit. */
  customerName: string | null;
  customerEmail: string | null;
  sourceOrderNumber: string | null;
}

/** A page of the credit list. */
export interface CreditPage {
  credits: readonly Credit[];
  total: number;
}

/**
 * The figures above the list, over every credit.
 *
 * `pendingDelivery` earns its place: a Discovery Set nobody ever marks
 * delivered leaves a customer holding a credit they cannot spend, and nothing
 * else on the site would ever say so.
 */
export interface CreditTotals {
  issuedCount: number;
  issuedInCents: number;
  availableCount: number;
  availableInCents: number;
  redeemedCount: number;
  redeemedInCents: number;
  expiredCount: number;
  cancelledCount: number;
  pendingDeliveryCount: number;
}
