import Link from "next/link";
import { Plus } from "lucide-react";

import {
  AdminCell,
  AdminEmpty,
  AdminLinkButton,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import AdminSearch from "@/src/components/admin/AdminSearch";
import ExpenseStatusControl from "@/src/components/admin/ExpenseStatusControl";
import FilterChips from "@/src/components/admin/FilterChips";
import FinancePeriodTabs from "@/src/components/admin/FinancePeriodTabs";
import MovementDateRange from "@/src/components/admin/MovementDateRange";
import SalesFigure from "@/src/components/admin/SalesFigure";
import { matchesTerm, searchTerm } from "@/src/lib/admin/filter";
import {
  EXPENSE_CADENCE_LABEL,
  EXPENSE_STATUS_LABEL,
  dayLabel,
  financeWindow,
  parseExpenseStatus,
  parseFinancePeriod,
  parseIsoDate,
  parseRecurrence,
} from "@/src/lib/admin/finance";
import { egp, egpCompact } from "@/src/lib/admin/money";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  ensureRecurringExpenses,
  getExpenseTotals,
  listExpenseCategories,
  listExpenseRules,
  listExpenses,
} from "@/src/services/admin/finance";

/**
 * The expense ledger.
 *
 * Every filter here is a column, so all of them narrow in Postgres. The search
 * box is the exception and deliberately so: it matches a name, a supplier and a
 * reference, and building an `or` across those means handing PostgREST a filter
 * expression assembled from somebody's keystrokes. `src/lib/admin/filter.ts`
 * explains why this codebase does not do that — the rows are already here, so
 * the term is applied to them.
 *
 * The totals above the table come from `finance_expense_summary()` and are
 * **not** derived from the rows below, which are capped at 500. A range with
 * more expenses than that still adds up correctly, and the two disagreeing is
 * the signal that the cap was reached.
 *
 * Recurring rules sit beneath the ledger rather than in it: a rule is not a
 * cost, it is a promise to keep recording one, and mixing the two would make
 * the table's Amount column mean two different things.
 */

export const dynamic = "force-dynamic";

export default async function AdminExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const period = parseFinancePeriod(query.period);
  const from = parseIsoDate(query.from);
  const to = parseIsoDate(query.to);
  const window = financeWindow(period, from, to);

  const rawStatus = Array.isArray(query.status) ? query.status[0] : query.status;
  const status = rawStatus ? parseExpenseStatus(rawStatus) : null;

  const rawCategory = Array.isArray(query.category) ? query.category[0] : query.category;
  const categoryId = typeof rawCategory === "string" && rawCategory ? rawCategory : undefined;

  const rawRepeat = Array.isArray(query.repeat) ? query.repeat[0] : query.repeat;
  const recurrence = rawRepeat ? parseRecurrence(rawRepeat) : null;

  const term = searchTerm(query);

  await ensureRecurringExpenses();

  const [rows, totals, categories, rules] = await Promise.all([
    listExpenses({
      from: window.from,
      to: window.to,
      categoryId,
      status: status ?? undefined,
      recurrence: recurrence ?? undefined,
    }),
    getExpenseTotals(window),
    listExpenseCategories(),
    listExpenseRules(),
  ]);

  const visible = rows.filter((row) =>
    matchesTerm(term, [row.name, row.categoryName, row.vendor, row.reference]),
  );

  const base = localizePath(activeLocale, "/admin/finance/expenses");
  const isCustom = Boolean(from || to);

  const carried = {
    ...(isCustom ? {} : { period }),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(categoryId ? { category: categoryId } : {}),
    ...(status ? { status } : {}),
    ...(recurrence ? { repeat: recurrence } : {}),
    ...(term ? { q: term } : {}),
  };

  /*
   * Only categories something has actually been recorded under, plus the one
   * currently selected. A filter listing thirty-four options where thirty are
   * empty is a filter nobody reads.
   */
  const used = new Set(rows.map((row) => row.categoryId));
  const categoryChips = [
    { value: "", label: "Every category" },
    ...categories
      .filter((category) => used.has(category.id) || category.id === categoryId)
      .map((category) => ({ value: category.id, label: category.name })),
  ];

  return (
    <>
      <AdminPageHeader
        title="Expenses"
        description="What it costs to run KHEM — rent, salaries, utilities, taxes, marketing, packaging. Never the cost of the goods themselves: that is set per product and reported by Sales & Profit."
        action={
          <FinancePeriodTabs
            basePath={base}
            active={period}
            query={query}
            overridden={isCustom}
          />
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SalesFigure
          label="Total"
          value={egp(totals.totalInCents)}
          note={`${totals.expenseCount} expense${totals.expenseCount === 1 ? "" : "s"} in this window, voided ones excluded.`}
        />
        <SalesFigure label="Paid" value={egp(totals.paidInCents)} tone="muted" />
        <SalesFigure
          label="Unpaid"
          value={egp(totals.pendingInCents)}
          tone={totals.pendingInCents > 0 ? "accent" : "muted"}
          note="Incurred and still owed. It counts toward the month it belongs to."
        />
        <SalesFigure
          label="Voided"
          value={String(totals.voidCount)}
          tone="muted"
          note="Kept on record, counted nowhere."
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <AdminLinkButton href={`${base}/new`}>
          <Plus size={13} strokeWidth={1.25} />
          Record an expense
        </AdminLinkButton>

        <Link
          href={localizePath(activeLocale, "/admin/finance/categories")}
          className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
        >
          Categories →
        </Link>
      </div>

      <MovementDateRange basePath={base} from={from ?? ""} to={to ?? ""} />

      <FilterChips
        basePath={base}
        param="status"
        active={status ?? ""}
        query={{ ...carried, status: undefined }}
        chips={[
          { value: "", label: "Any status" },
          { value: "PENDING", label: "Unpaid" },
          { value: "PAID", label: "Paid" },
          { value: "VOID", label: "Void" },
        ]}
      />

      <FilterChips
        basePath={base}
        param="repeat"
        active={recurrence ?? ""}
        query={{ ...carried, repeat: undefined }}
        chips={[
          { value: "", label: "One-time and recurring" },
          { value: "recurring", label: "Recurring" },
          { value: "one-time", label: "One-time" },
        ]}
      />

      {categoryChips.length > 1 ? (
        <FilterChips
          basePath={base}
          param="category"
          active={categoryId ?? ""}
          query={{ ...carried, category: undefined }}
          chips={categoryChips}
        />
      ) : null}

      <AdminSearch
        placeholder="Search expenses"
        label="Search by name, supplier or reference"
      />

      {visible.length === 0 ? (
        <AdminEmpty
          message={
            rows.length === 0
              ? "No expenses in this window. Record rent, salaries and utilities here and net profit becomes a real number."
              : "No expense matches that search."
          }
          action={
            rows.length === 0 ? (
              <AdminLinkButton href={`${base}/new`}>
                Record the first expense
              </AdminLinkButton>
            ) : undefined
          }
        />
      ) : (
        <AdminTable
          headers={[
            "Date",
            "Expense",
            "Category",
            "Amount",
            "Repeats",
            "Status",
            { label: "Actions", hidden: true },
          ]}
        >
          {visible.map((row) => (
            <AdminRow key={row.id}>
              <AdminCell muted>{dayLabel(row.incurredOn)}</AdminCell>

              <AdminCell>
                <Link
                  href={`${base}/${row.id}`}
                  className="font-heading text-[11px] tracking-[0.1em] transition-colors duration-300 hover:text-ground-accent"
                >
                  {row.name}
                </Link>
                {row.vendor ? (
                  <span className="mt-1.5 block text-[11px] text-ground-muted">
                    {row.vendor}
                  </span>
                ) : null}
              </AdminCell>

              <AdminCell muted>{row.categoryName}</AdminCell>

              <AdminCell>
                <span
                  className={
                    row.status === "VOID" ? "text-ground-subtle line-through" : undefined
                  }
                >
                  {egp(row.amountInCents)}
                </span>
              </AdminCell>

              <AdminCell muted>
                {row.isRecurring ? (
                  <Link
                    href={localizePath(
                      activeLocale,
                      `/admin/finance/recurring/${row.recurringRuleId}`,
                    )}
                    className="transition-colors duration-300 hover:text-ground-accent"
                  >
                    {row.periodKey && row.periodKey.length === 4
                      ? EXPENSE_CADENCE_LABEL.YEARLY
                      : EXPENSE_CADENCE_LABEL.MONTHLY}
                  </Link>
                ) : (
                  "One-time"
                )}
              </AdminCell>

              <AdminCell muted>{EXPENSE_STATUS_LABEL[row.status]}</AdminCell>

              <AdminCell>
                <ExpenseStatusControl id={row.id} status={row.status} />
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}

      {rows.length >= 500 ? (
        <p className="mt-4 text-[11px] leading-relaxed text-ground-muted">
          Showing the 500 most recent expenses in this window. The totals above
          count every one of them — narrow the range to see the rest.
        </p>
      ) : null}

      <section className="mt-12">
        <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          Recurring expenses
        </h2>
        <p className="mb-6 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
          Each of these writes one expense per period, once. Changing the amount
          applies from the next period — the months already recorded keep what
          they were written with, so a rent rise never rewrites last September.
        </p>

        {rules.length === 0 ? (
          <AdminEmpty message="Nothing recurring yet. Record an expense and set it to repeat monthly or yearly." />
        ) : (
          <AdminTable
            headers={[
              "Expense",
              "Category",
              "Amount",
              "Every",
              "Window",
              "Recorded",
              "State",
              { label: "Edit", hidden: true },
            ]}
          >
            {rules.map((rule) => (
              <AdminRow key={rule.id}>
                <AdminCell>
                  <Link
                    href={localizePath(activeLocale, `/admin/finance/recurring/${rule.id}`)}
                    className="font-heading text-[11px] tracking-[0.1em] transition-colors duration-300 hover:text-ground-accent"
                  >
                    {rule.name}
                  </Link>
                </AdminCell>
                <AdminCell muted>{rule.categoryName}</AdminCell>
                <AdminCell>{egpCompact(rule.amountInCents)}</AdminCell>
                <AdminCell muted>{EXPENSE_CADENCE_LABEL[rule.cadence]}</AdminCell>
                <AdminCell muted>
                  {dayLabel(rule.startsOn)} → {rule.endsOn ? dayLabel(rule.endsOn) : "open"}
                </AdminCell>
                <AdminCell muted>
                  {rule.generatedCount ?? 0}{" "}
                  {(rule.generatedCount ?? 0) === 1 ? "period" : "periods"}
                </AdminCell>
                <AdminCell muted>{rule.isActive ? "Recurring" : "Stopped"}</AdminCell>
                <AdminCell>
                  <Link
                    href={localizePath(activeLocale, `/admin/finance/recurring/${rule.id}`)}
                    className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
                  >
                    Edit
                  </Link>
                </AdminCell>
              </AdminRow>
            ))}
          </AdminTable>
        )}
      </section>
    </>
  );
}
