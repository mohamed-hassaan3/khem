/**
 * The finance vocabulary.
 *
 * The shapes `supabase/sql/0063_finance.sql` hands back: an expense, a
 * recurring rule, a category, a monthly target, and the three report shapes
 * that join them to the sales ledger. Read by `/admin/finance` and by nothing
 * else — these rows carry salaries and supplier names, and no storefront
 * surface has any business with either.
 *
 * Money is in piastres throughout, the same minor unit as
 * `Product.priceInCents` and everything on the sales ledger. Nothing here is a
 * float, and no percentage is stored: an achievement and a margin are derived
 * at the moment they are printed, from two integers and an explicit zero guard.
 *
 * ## The one null that means something
 *
 * `cogsInCents`, `grossProfitInCents` and `netProfitInCents` are `number | null`
 * everywhere below, and the null is load-bearing — it means *the cost of these
 * goods was never recorded*, not *these goods were free*. `src/types/sales.ts`
 * makes the same distinction for the same reason: a zero here would read as
 * "these sales were pure profit", which is the most expensive wrong number this
 * dashboard could print. Null travels all the way to the screen, which says so.
 */

/** Which family a category belongs to. Mirrors `public."ExpenseGroup"`. */
export type ExpenseGroup =
  | "OPERATIONS"
  | "PEOPLE"
  | "BUSINESS"
  | "MARKETING"
  | "PRODUCTION"
  | "OTHER";

/**
 * What has happened to an expense.
 *
 * `PENDING` is incurred and not yet paid, and **counts** toward operating
 * expenses: the cost belongs to the month it was incurred in, not to the day
 * the transfer cleared. `VOID` counts nowhere and is the delete that keeps the
 * audit trail.
 */
export type ExpenseStatus = "PENDING" | "PAID" | "VOID";

export type ExpenseCadence = "MONTHLY" | "YEARLY";

/** One row of the manageable category list. */
export interface ExpenseCategory {
  id: string;
  name: string;
  group: ExpenseGroup;
  sortOrder: number;
  /** A shipped default. Renameable and archivable, never deletable. */
  isSystem: boolean;
  isArchived: boolean;
  /** How many expenses point at it. Decides whether deletion is offered. */
  expenseCount?: number;
}

/** One recorded cost. */
export interface Expense {
  id: string;
  name: string;

  categoryId: string;
  /** The category **as it was called** when this row was written. */
  categoryName: string;
  categoryGroup: ExpenseGroup;

  amountInCents: number;
  /** `YYYY-MM-DD` — the day the cost belongs to, and the reporting key. */
  incurredOn: string;
  status: ExpenseStatus;

  vendor: string | null;
  reference: string | null;
  notes: string | null;

  recurringRuleId: string | null;
  /** `YYYY-MM` or `YYYY` for a generated row; null for a one-time expense. */
  periodKey: string | null;
  isRecurring: boolean;

  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  voidedAt: string | null;
}

/** A template. Its rows are what the reports actually read. */
export interface ExpenseRule {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  amountInCents: number;
  cadence: ExpenseCadence;
  startsOn: string;
  endsOn: string | null;
  vendor: string | null;
  notes: string | null;
  isActive: boolean;
  /** How many occurrences it has already written. */
  generatedCount?: number;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

/** One month's targets. All three independent, and null means "no target". */
export interface FinancialTarget {
  id: string;
  /** `YYYY-MM-DD`, always the first of the month. */
  periodMonth: string;
  revenueTargetInCents: number | null;
  grossProfitTargetInCents: number | null;
  netProfitTargetInCents: number | null;
  notes: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

/**
 * The dashboard tiles for one window.
 *
 * Revenue is merchandise revenue — what customers paid for goods. Delivery
 * charged to the customer is not in it, and neither shipping cost nor payment
 * processing fees are deducted from it: no per-order column records either, so
 * they are recorded as expenses and appear in `expenseInCents`.
 */
export interface FinanceSummary {
  orderCount: number;
  units: number;

  /** List value before any benefit. */
  originalInCents: number;
  /** Everything the five instruments gave away. */
  discountInCents: number;
  /** What was actually paid for merchandise. */
  revenueInCents: number;

  /** Cost of the goods sold, or null when nothing in the window was costed. */
  cogsInCents: number | null;
  /** `revenue − cogs`, of the costed lines only. Null with the cost. */
  grossProfitInCents: number | null;
  /** The honest denominator for a margin while part of the catalogue is uncosted. */
  costedRevenueInCents: number;
  linesMissingCost: number;
  refundedOrderCount: number;

  /** Everything not voided, whether paid yet or not. */
  expenseInCents: number;
  expensePaidInCents: number;
  expensePendingInCents: number;
  expenseCount: number;
  voidCount: number;

  /** `grossProfit − expenses`. Null whenever gross profit is. */
  netProfitInCents: number | null;
}

/** Expense totals for a window, uncapped by any list limit. */
export interface ExpenseTotals {
  totalInCents: number;
  paidInCents: number;
  pendingInCents: number;
  expenseCount: number;
  voidCount: number;
}

/** Where the money went, by snapshotted category. */
export interface ExpenseBreakdownRow {
  categoryName: string;
  categoryGroup: ExpenseGroup;
  amountInCents: number;
  expenseCount: number;
}

/** One point on a finance series — a day or a month, same shape. */
export interface FinancePoint {
  /** `YYYY-MM-DD`. For a monthly series, the first of the month. */
  period: string;
  revenueInCents: number;
  cogsInCents: number | null;
  grossProfitInCents: number | null;
  expenseInCents: number;
  netProfitInCents: number | null;
  costedRevenueInCents: number;
  linesMissingCost: number;
  units: number;
  orderCount: number;
  /** Present only on a monthly series. */
  revenueTargetInCents?: number | null;
  grossProfitTargetInCents?: number | null;
  netProfitTargetInCents?: number | null;
}
