/**
 * The KHEM Points vocabulary.
 *
 * Mirrors `supabase/sql/0059_rewards.sql`. Points are whole numbers; the money
 * they convert to is in piastres, the same minor unit as
 * `Product.priceInCents`.
 *
 * Nothing in this file is ever assembled from a browser. A balance, what a
 * redemption is worth, and whether one is allowed are all decided in SQL — the
 * client only ever names a *count*, and even that is re-priced under a lock
 * inside `place_order()`.
 */

/**
 * Where a movement came from.
 *
 * `REFERRAL` has no writer yet and is deliberately present: a later referral
 * feature should write rows rather than migrate a type that is in use.
 */
export type PointsSource =
  | "PURCHASE"
  | "SIGNUP"
  | "FIRST_PURCHASE"
  | "REVIEW"
  | "REFERRAL"
  | "ADMIN_ADJUSTMENT"
  | "REFUND_REVERSAL"
  | "REDEMPTION"
  | "EXPIRATION";

/** One movement. Append-only; a correction is a new row, never an edit. */
export interface PointsTransaction {
  id: string;
  clerkUserId: string;
  /** Signed: earning adds, redeeming and expiring subtract. Never zero. */
  amount: number;
  source: PointsSource;
  /** The order that earned, spent or gave these back. */
  orderId: string | null;
  /** The product slug behind a `REVIEW`. Null otherwise. */
  referenceId: string | null;
  note: string | null;
  /** The admin behind an `ADMIN_ADJUSTMENT`; null for everything the system did. */
  actor: string | null;
  occurredAt: string;
  /** When these particular points lapse. Null never expires. */
  expiresAt: string | null;
}

/**
 * What a customer holds, derived by the `reward_balances` view.
 *
 * Stored nowhere. A balance column beside a transaction list is two records of
 * one fact — the argument `src/types/credit.ts` makes about credit status,
 * applied to a number.
 */
export interface RewardBalance {
  clerkUserId: string;
  balancePoints: number;
  /** Earning sources only. A restored redemption is money coming back, not
   *  money earned, and counting it here would make a refund look like a reward. */
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  expiredPoints: number;
  adjustedPoints: number;
  lastMovementAt: string | null;
}

/** The empty balance, for a customer who has never held a point. */
export const EMPTY_BALANCE: Omit<RewardBalance, "clerkUserId"> = {
  balancePoints: 0,
  lifetimeEarned: 0,
  lifetimeRedeemed: 0,
  expiredPoints: 0,
  adjustedPoints: 0,
  lastMovementAt: null,
};

/**
 * One movement, as the customer's own ledger prints it.
 *
 * `actor` is deliberately not carried across: it names the member of the house
 * behind a manual adjustment, which is the desk's business and not the
 * customer's. Same omission, for the same reason, as `CreditLedgerEntry`.
 */
export interface RewardLedgerEntry {
  id: string;
  amount: number;
  source: PointsSource;
  /** The order, in its `KHEM-YYYY-NNNN` form — the only form a customer has
   *  ever been shown. `points_transactions.orderId` is a uuid. */
  orderNumber: string | null;
  note: string | null;
  occurredAt: string;
  expiresAt: string | null;
}

/**
 * Everything the account panel says about points, in one read.
 *
 * The conversion figures travel with the balance so the panel can say "170 EGP
 * available" and "60 points away from your next reward" without a second call
 * and without doing the arithmetic in a component.
 */
export interface CustomerRewards {
  enabled: boolean;
  balancePoints: number;
  /** What the balance is worth right now, at the current rate. */
  valueInCents: number;
  /** The floor a redemption starts at. */
  minRedeemPoints: number;
  /** How many more points until the next whole reward step. Zero when the
   *  balance already sits on one. */
  pointsToNextReward: number;
  /** What that next step will be worth. */
  nextRewardInCents: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  expiredPoints: number;
  entries: readonly RewardLedgerEntry[];
}

/** Why a redemption was refused. Mirrors `resolve_points_redemption()`. */
export type PointsRefusalCode =
  | "DISABLED"
  | "NOT_SIGNED_IN"
  | "BELOW_MINIMUM"
  | "INSUFFICIENT"
  | "NOTHING_TO_REDUCE"
  | "INVALID"
  | "UNKNOWN";

/**
 * What a redemption would be worth.
 *
 * An estimate that binds nothing, exactly like `DiscountPreview`:
 * `place_order()` resolves the same request again, under an advisory lock, in
 * the transaction that writes the order — and that is what the customer is
 * charged.
 */
export type PointsPreview =
  | { ok: true; points: number; amountInCents: number }
  | { ok: false; reasonCode: PointsRefusalCode; reason: string };

/** A customer's points as the dashboard lists them. */
export interface AdminRewardCustomer extends RewardBalance {
  name: string | null;
  email: string | null;
}

/** A page of that list. */
export interface AdminRewardPage {
  customers: readonly AdminRewardCustomer[];
  total: number;
}
