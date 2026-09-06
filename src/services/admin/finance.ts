import "server-only";

/**
 * What it cost to run the house, and what that leaves.
 *
 * ## Why the arithmetic is not here
 *
 * `./sales.ts`'s reason, unchanged. Every total comes back already aggregated
 * from `finance_summary()`, `finance_daily()` and `finance_monthly()`: summing
 * an expense ledger and a sales ledger in TypeScript would mean fetching both
 * whole to print six numbers, and getting slower with each month. The expense
 * table is the one read that returns rows, and it is capped.
 *
 * ## Finance never recomputes a sale
 *
 * Revenue and COGS come from `public."SalesLedgerRow"` — the same view
 * `/admin/sales` reads, filtered on the same `"countsAsRevenue"`. Nothing in
 * this module or the SQL behind it prices an order, resolves a benefit, or
 * values a refund. `place_order()` and `set_order_status()` remain the only
 * authorities, and Finance reads their answers.
 *
 * ## Authority and failure posture
 *
 * `getSupabaseAdmin()`, behind the admin layout's `requireAdmin()`, because
 * `supabase/sql/0063_finance.sql` grants the public roles nothing at all —
 * these rows carry salaries and supplier names. A failed read logs the
 * provider's message and returns an empty projection rather than throwing into
 * a page, exactly as every other service here does.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { FinanceWindow } from "@/src/lib/admin/finance";
import {
  EMPTY_EXPENSE_TOTALS,
  EMPTY_FINANCE_SUMMARY,
  EXPENSE_CATEGORY_COLUMNS,
  EXPENSE_COLUMNS,
  EXPENSE_RULE_COLUMNS,
  FINANCIAL_TARGET_COLUMNS,
  parseList,
  toExpense,
  toExpenseBreakdownRow,
  toExpenseCategory,
  toExpenseRule,
  toExpenseTotals,
  toFinancePoint,
  toFinanceSummary,
  toFinancialTarget,
} from "@/src/schemas/db/finance";
import type { OrderChannel } from "@/src/types/order";
import type {
  Expense,
  ExpenseBreakdownRow,
  ExpenseCategory,
  ExpenseRule,
  ExpenseStatus,
  ExpenseTotals,
  FinancePoint,
  FinanceSummary,
  FinancialTarget,
} from "@/src/types/finance";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/**
 * Write any recurring occurrence that is due and not yet written.
 *
 * Called once at the top of the Finance dashboard read. It is a single RPC that
 * returns zero on every call after the first within a period — the unique index
 * on `("recurringRuleId", "periodKey")` is what makes that true, not a flag and
 * not a lock, so calling it from a render is safe however many tabs are open.
 *
 * Deliberately silent about its own failure: a rule that could not be generated
 * is a missing expense, which the dashboard will show as a smaller number, and
 * that is a far better outcome than a 500 on the screen a desk opens every
 * morning. The message goes to the server log.
 */
export async function ensureRecurringExpenses(): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;

  const { data, error } = await supabase.rpc("generate_recurring_expenses", {});

  if (error) {
    logFailure("ensureRecurringExpenses", error.message);
    return 0;
  }

  return typeof data === "number" ? data : 0;
}

/** The dashboard tiles for one window. */
export async function getFinanceSummary(
  window: FinanceWindow,
  channel?: OrderChannel,
): Promise<FinanceSummary> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return EMPTY_FINANCE_SUMMARY;

  const { data, error } = await supabase.rpc("finance_summary", {
    p_from: window.from,
    p_to: window.to,
    p_channel: channel ?? null,
  });

  if (error) {
    logFailure("getFinanceSummary", error.message);
    return EMPTY_FINANCE_SUMMARY;
  }

  // A set-returning function comes back as an array of one row; an empty window
  // comes back as one row of zeros, not as nothing.
  const rows = parseList(data, toFinanceSummary);
  return rows[0] ?? EMPTY_FINANCE_SUMMARY;
}

/**
 * The daily or monthly series behind the charts.
 *
 * Gap-filled in Postgres rather than here, unlike `analytics.ts`: the two sides
 * being filled come from different tables, and a day with an expense and no
 * sale has to appear as surely as a day with a sale and no expense. Only a
 * dense calendar with two left joins gets both.
 */
export async function getFinanceSeries(
  window: FinanceWindow,
  granularity: "daily" | "monthly",
  channel?: OrderChannel,
): Promise<FinancePoint[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc(
    granularity === "daily" ? "finance_daily" : "finance_monthly",
    {
      p_from: window.from,
      p_to: window.to,
      p_channel: channel ?? null,
    },
  );

  if (error) {
    logFailure(`getFinanceSeries(${granularity})`, error.message);
    return [];
  }

  return parseList(data, toFinancePoint);
}

/** Where the money went over a window, largest first. */
export async function getExpenseBreakdown(
  window: FinanceWindow,
): Promise<ExpenseBreakdownRow[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("finance_expense_by_category", {
    p_from: window.from,
    p_to: window.to,
  });

  if (error) {
    logFailure("getExpenseBreakdown", error.message);
    return [];
  }

  return parseList(data, toExpenseBreakdownRow);
}

/**
 * Expense totals for a window, counted in Postgres.
 *
 * The Expenses screen renders at most 500 rows; summing what it rendered would
 * understate a busy range. This counts them all.
 */
export async function getExpenseTotals(
  window: FinanceWindow,
): Promise<ExpenseTotals> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return EMPTY_EXPENSE_TOTALS;

  const { data, error } = await supabase.rpc("finance_expense_summary", {
    p_from: window.from,
    p_to: window.to,
  });

  if (error) {
    logFailure("getExpenseTotals", error.message);
    return EMPTY_EXPENSE_TOTALS;
  }

  const rows = parseList(data, toExpenseTotals);
  return rows[0] ?? EMPTY_EXPENSE_TOTALS;
}

/**
 * The category list.
 *
 * Archived ones are included by default because an expense recorded against one
 * still has to render its name in a filter; the forms filter them out.
 */
export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("expense_categories")
    .select(EXPENSE_CATEGORY_COLUMNS)
    .order("group", { ascending: true })
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    logFailure("listExpenseCategories", error.message);
    return [];
  }

  return parseList(data, toExpenseCategory);
}

/**
 * The categories, each with how many expenses point at it.
 *
 * One extra read rather than a `group by` RPC: the category list is thirty-odd
 * rows and this question is asked on one screen, to decide whether deleting a
 * category is offered at all.
 */
export async function listExpenseCategoriesWithUse(): Promise<ExpenseCategory[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const categories = await listExpenseCategories();
  if (categories.length === 0) return [];

  const { data, error } = await supabase
    .from("expenses")
    .select("categoryId")
    .limit(10_000);

  if (error) {
    logFailure("listExpenseCategoriesWithUse", error.message);
    return categories;
  }

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { categoryId?: unknown }[]) {
    const id = typeof row.categoryId === "string" ? row.categoryId : null;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return categories.map((category) => ({
    ...category,
    expenseCount: counts.get(category.id) ?? 0,
  }));
}

/** What the Expenses screen may narrow by. All optional, and combinable. */
export interface ExpenseFilters {
  from?: string | null;
  to?: string | null;
  categoryId?: string;
  status?: ExpenseStatus;
  /** `recurring` keeps only generated rows; `one-time` drops them. */
  recurrence?: "recurring" | "one-time";
}

/**
 * The expense rows, newest first.
 *
 * Every filter here is a column, so all of them narrow in Postgres. The
 * free-text search is deliberately *not* a filter: it matches a name, a vendor
 * and a reference, and building an `or` across them means handing PostgREST a
 * filter expression assembled from somebody's keystrokes.
 * `src/lib/admin/filter.ts` explains why this codebase does not do that; the
 * page filters the returned rows instead.
 *
 * Capped rather than paged, like every other list on this dashboard — and the
 * totals beside it come from `getExpenseTotals()`, which is not capped, so a
 * range with more than 500 expenses still adds up correctly.
 */
export async function listExpenses(
  filters: ExpenseFilters = {},
  limit = 500,
): Promise<Expense[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  let query = supabase.from("expenses").select(EXPENSE_COLUMNS);

  if (filters.from) query = query.gte("incurredOn", filters.from);
  if (filters.to) query = query.lte("incurredOn", filters.to);
  if (filters.categoryId) query = query.eq("categoryId", filters.categoryId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.recurrence) {
    query = query.eq("isRecurring", filters.recurrence === "recurring");
  }

  const { data, error } = await query
    .order("incurredOn", { ascending: false })
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (error) {
    logFailure("listExpenses", error.message);
    return [];
  }

  return parseList(data, toExpense);
}

/** One expense, for its edit screen. */
export async function getExpense(id: string): Promise<Expense | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logFailure("getExpense", error.message);
    return null;
  }

  return data ? toExpense(data) : null;
}

/**
 * The recurring rules, with their category's **current** name and how many
 * occurrences each has written.
 *
 * The name is resolved here from the category list rather than through a
 * PostgREST embed: a rule is a template, so showing the current name is right,
 * and one small map beats a nested select whose shape the parser would have to
 * know about.
 */
export async function listExpenseRules(): Promise<ExpenseRule[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const [{ data, error }, categories] = await Promise.all([
    supabase
      .from("expense_recurring_rules")
      .select(EXPENSE_RULE_COLUMNS)
      .order("isActive", { ascending: false })
      .order("startsOn", { ascending: false }),
    listExpenseCategories(),
  ]);

  if (error) {
    logFailure("listExpenseRules", error.message);
    return [];
  }

  const rules = parseList(data, toExpenseRule);
  if (rules.length === 0) return [];

  const names = new Map(categories.map((category) => [category.id, category.name]));

  const { data: generated, error: countError } = await supabase
    .from("expenses")
    .select("recurringRuleId")
    .not("recurringRuleId", "is", null)
    .limit(10_000);

  if (countError) logFailure("listExpenseRules counts", countError.message);

  const counts = new Map<string, number>();
  for (const row of (generated ?? []) as { recurringRuleId?: unknown }[]) {
    const id = typeof row.recurringRuleId === "string" ? row.recurringRuleId : null;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return rules.map((rule) => ({
    ...rule,
    categoryName: names.get(rule.categoryId) ?? rule.categoryId,
    generatedCount: counts.get(rule.id) ?? 0,
  }));
}

/** One rule, for its edit screen. */
export async function getExpenseRule(id: string): Promise<ExpenseRule | null> {
  const rules = await listExpenseRules();
  return rules.find((rule) => rule.id === id) ?? null;
}

/**
 * The monthly targets, newest month first.
 *
 * Capped at five years: the Targets screen shows a rolling window, and a house
 * that has been trading longer than that is not helped by scrolling past 2021.
 */
export async function listFinancialTargets(limit = 60): Promise<FinancialTarget[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("financial_targets")
    .select(FINANCIAL_TARGET_COLUMNS)
    .order("periodMonth", { ascending: false })
    .limit(limit);

  if (error) {
    logFailure("listFinancialTargets", error.message);
    return [];
  }

  return parseList(data, toFinancialTarget);
}

/** One month's targets, or null when none has been set. */
export async function getFinancialTarget(
  periodMonth: string,
): Promise<FinancialTarget | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("financial_targets")
    .select(FINANCIAL_TARGET_COLUMNS)
    .eq("periodMonth", periodMonth)
    .maybeSingle();

  if (error) {
    logFailure("getFinancialTarget", error.message);
    return null;
  }

  return data ? toFinancialTarget(data) : null;
}

/**
 * One month's actuals, from the same function the charts read.
 *
 * Used by the Targets screen so each row's "actual" is produced by the exact
 * query the dashboard's tiles are, rather than by a second definition of what a
 * month is.
 */
export async function getMonthlyActuals(
  from: string,
  to: string,
  channel?: OrderChannel,
): Promise<FinancePoint[]> {
  return getFinanceSeries({ from, to }, "monthly", channel);
}
