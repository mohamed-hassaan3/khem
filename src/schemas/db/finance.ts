/**
 * Row schemas for Finance & Expenses.
 *
 * House rules, unchanged from `./sales.ts`: an explicit column list rather than
 * `select('*')`, rows parsed rather than asserted, and one malformed row dropped
 * instead of a blanked screen.
 *
 * The `.default(…)` and `.nullable()` here are the same defensive posture the
 * sales schemas take — a deployment running ahead of
 * `supabase/sql/0063_finance.sql` must degrade to a missing figure, not to an
 * empty Expenses table with no explanation on it.
 */

import { z } from "zod";

import type {
  Expense,
  ExpenseBreakdownRow,
  ExpenseCategory,
  ExpenseRule,
  ExpenseTotals,
  FinancePoint,
  FinanceSummary,
  FinancialTarget,
} from "@/src/types/finance";

import { parseList } from "./catalog";

export const expenseGroupSchema = z.enum([
  "OPERATIONS",
  "PEOPLE",
  "BUSINESS",
  "MARKETING",
  "PRODUCTION",
  "OTHER",
]);

export const expenseStatusSchema = z.enum(["PENDING", "PAID", "VOID"]);

export const expenseCadenceSchema = z.enum(["MONTHLY", "YEARLY"]);

/**
 * `bigint` and `numeric` come back from PostgREST as strings once they leave
 * the safe integer range, and as numbers below it. Coerced throughout, so a
 * boutique that has a very expensive year does not blank its own report.
 */
const money = z.coerce.number();

/** A `date` column arrives as `YYYY-MM-DD`. Kept as the string it is. */
const isoDay = z.string();

export const EXPENSE_CATEGORY_COLUMNS =
  'id, name, "group", "sortOrder", "isSystem", "isArchived"';

const expenseCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  group: expenseGroupSchema,
  sortOrder: z.coerce.number().default(0),
  isSystem: z.boolean().default(false),
  isArchived: z.boolean().default(false),
});

export function toExpenseCategory(row: unknown): ExpenseCategory | null {
  const parsed = expenseCategorySchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const EXPENSE_COLUMNS =
  'id, name, "categoryId", "categoryName", "categoryGroup", ' +
  '"amountInCents", "incurredOn", status, vendor, reference, notes, ' +
  '"recurringRuleId", "periodKey", "isRecurring", ' +
  '"createdBy", "createdAt", "updatedBy", "updatedAt", "voidedAt"';

const expenseSchema = z.object({
  id: z.string(),
  name: z.string(),

  categoryId: z.string(),
  categoryName: z.string(),
  categoryGroup: expenseGroupSchema,

  amountInCents: money,
  incurredOn: isoDay,
  status: expenseStatusSchema,

  vendor: z.string().nullable().default(null),
  reference: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),

  recurringRuleId: z.string().nullable().default(null),
  periodKey: z.string().nullable().default(null),
  isRecurring: z.boolean().default(false),

  createdBy: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedBy: z.string().nullable().default(null),
  updatedAt: z.string(),
  voidedAt: z.string().nullable().default(null),
});

export function toExpense(row: unknown): Expense | null {
  const parsed = expenseSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const EXPENSE_RULE_COLUMNS =
  'id, name, "categoryId", "amountInCents", cadence, "startsOn", "endsOn", ' +
  'vendor, notes, "isActive", "createdBy", "createdAt", "updatedBy", "updatedAt"';

/**
 * The rule itself. Its category *name* is resolved by the service from the
 * category list it has already read, rather than through a PostgREST embed.
 *
 * A rule is a template, not a historical record, so it is correct for it to
 * show the category's current name — the exact opposite of an expense row,
 * which carries a snapshot precisely so history cannot be rewritten.
 */
const expenseRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string(),
  amountInCents: money,
  cadence: expenseCadenceSchema,
  startsOn: isoDay,
  endsOn: isoDay.nullable().default(null),
  vendor: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  isActive: z.boolean().default(true),
  createdBy: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedBy: z.string().nullable().default(null),
  updatedAt: z.string(),
  /** Filled in by the service; never selected from the rules table. */
  categoryName: z.string().default(""),
});

export function toExpenseRule(row: unknown): ExpenseRule | null {
  const parsed = expenseRuleSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const FINANCIAL_TARGET_COLUMNS =
  'id, "periodMonth", "revenueTargetInCents", "grossProfitTargetInCents", ' +
  '"netProfitTargetInCents", notes, "updatedBy", "updatedAt"';

const financialTargetSchema = z.object({
  id: z.string(),
  periodMonth: isoDay,
  // Nullable and **not** defaulted to zero: null is "no target", and zero would
  // be a house that had decided to aim for nothing.
  revenueTargetInCents: money.nullable().default(null),
  grossProfitTargetInCents: money.nullable().default(null),
  netProfitTargetInCents: money.nullable().default(null),
  notes: z.string().nullable().default(null),
  updatedBy: z.string().nullable().default(null),
  updatedAt: z.string(),
});

export function toFinancialTarget(row: unknown): FinancialTarget | null {
  const parsed = financialTargetSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

const financeSummarySchema = z.object({
  orderCount: z.coerce.number().default(0),
  units: z.coerce.number().default(0),
  originalInCents: money.default(0),
  discountInCents: money.default(0),
  revenueInCents: money.default(0),
  // The three that must never default to zero — see `src/types/finance.ts`.
  cogsInCents: money.nullable().default(null),
  grossProfitInCents: money.nullable().default(null),
  costedRevenueInCents: money.default(0),
  linesMissingCost: z.coerce.number().default(0),
  refundedOrderCount: z.coerce.number().default(0),
  expenseInCents: money.default(0),
  expensePaidInCents: money.default(0),
  expensePendingInCents: money.default(0),
  expenseCount: z.coerce.number().default(0),
  voidCount: z.coerce.number().default(0),
  netProfitInCents: money.nullable().default(null),
});

export function toFinanceSummary(row: unknown): FinanceSummary | null {
  const parsed = financeSummarySchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

/** A window with nothing in it. Rendered, never thrown. */
export const EMPTY_FINANCE_SUMMARY: FinanceSummary = {
  orderCount: 0,
  units: 0,
  originalInCents: 0,
  discountInCents: 0,
  revenueInCents: 0,
  cogsInCents: null,
  grossProfitInCents: null,
  costedRevenueInCents: 0,
  linesMissingCost: 0,
  refundedOrderCount: 0,
  expenseInCents: 0,
  expensePaidInCents: 0,
  expensePendingInCents: 0,
  expenseCount: 0,
  voidCount: 0,
  netProfitInCents: null,
};

const expenseTotalsSchema = z.object({
  totalInCents: money.default(0),
  paidInCents: money.default(0),
  pendingInCents: money.default(0),
  expenseCount: z.coerce.number().default(0),
  voidCount: z.coerce.number().default(0),
});

export function toExpenseTotals(row: unknown): ExpenseTotals | null {
  const parsed = expenseTotalsSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export const EMPTY_EXPENSE_TOTALS: ExpenseTotals = {
  totalInCents: 0,
  paidInCents: 0,
  pendingInCents: 0,
  expenseCount: 0,
  voidCount: 0,
};

const expenseBreakdownSchema = z.object({
  categoryName: z.string(),
  categoryGroup: expenseGroupSchema,
  amountInCents: money.default(0),
  expenseCount: z.coerce.number().default(0),
});

export function toExpenseBreakdownRow(row: unknown): ExpenseBreakdownRow | null {
  const parsed = expenseBreakdownSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

/**
 * A day or a month, normalised to one shape.
 *
 * `finance_daily()` names its bucket `day` and `finance_monthly()` names it
 * `month`; both become `period` here so a chart does not have to know which
 * granularity produced it.
 */
const financePointSchema = z
  .object({
    day: isoDay.optional(),
    month: isoDay.optional(),
    revenueInCents: money.default(0),
    cogsInCents: money.nullable().default(null),
    grossProfitInCents: money.nullable().default(null),
    expenseInCents: money.default(0),
    netProfitInCents: money.nullable().default(null),
    costedRevenueInCents: money.default(0),
    linesMissingCost: z.coerce.number().default(0),
    units: z.coerce.number().default(0),
    orderCount: z.coerce.number().default(0),
    revenueTargetInCents: money.nullable().default(null),
    grossProfitTargetInCents: money.nullable().default(null),
    netProfitTargetInCents: money.nullable().default(null),
  })
  .transform(({ day, month, ...rest }): FinancePoint | null => {
    const period = day ?? month;
    if (!period) return null;
    return { period, ...rest };
  });

export function toFinancePoint(row: unknown): FinancePoint | null {
  const parsed = financePointSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export { parseList };
