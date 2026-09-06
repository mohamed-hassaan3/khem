import Link from "next/link";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import TargetsEditor, {
  type TargetMonthRow,
} from "@/src/components/admin/TargetsEditor";
import { isoDay, monthBounds } from "@/src/lib/admin/finance";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  ensureRecurringExpenses,
  getMonthlyActuals,
  listFinancialTargets,
} from "@/src/services/admin/finance";

/**
 * Monthly targets.
 *
 * Three amounts per month, independent and optional — a house may know what it
 * wants to sell before it knows what it wants to keep. **Empty is not zero**:
 * an empty field means no target, and the dashboard simply omits that meter,
 * whereas a zero would be a declared intention to make nothing.
 *
 * Each row's *actual* comes from `finance_monthly()` — the same function the
 * dashboard's tiles and the reports' charts read — so a target and the figure
 * beside it can never be about different months. There is no second definition
 * of what September is anywhere in this feature.
 *
 * Thirteen months: the current one and the twelve before it. Setting a target
 * for a month further ahead is a real thing to want and is one edit away — the
 * form takes any month — but a list that scrolled through 2021 by default would
 * bury the only three rows anybody opens.
 */

export const dynamic = "force-dynamic";

/** How many months back the list reaches, the current one included. */
const MONTHS_SHOWN = 13;

export default async function AdminTargetsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const firstMonth = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (MONTHS_SHOWN - 1), 1),
  );
  const lastMonth = monthBounds(
    isoDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))),
  );

  await ensureRecurringExpenses();

  const [actuals, targets] = await Promise.all([
    getMonthlyActuals(isoDay(firstMonth), lastMonth.to ?? isoDay(today)),
    listFinancialTargets(),
  ]);

  const actualsByMonth = new Map(actuals.map((point) => [point.period, point]));
  const targetsByMonth = new Map(
    targets.map((target) => [target.periodMonth, target]),
  );

  /*
   * Built from the calendar rather than from either result, so a month with no
   * sales and no target still appears — which is the month somebody most likely
   * came here to set one for.
   */
  const rows: TargetMonthRow[] = Array.from({ length: MONTHS_SHOWN }, (_, offset) => {
    const month = isoDay(
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1)),
    );

    return {
      periodMonth: month,
      actuals: actualsByMonth.get(month) ?? null,
      target: targetsByMonth.get(month) ?? null,
    };
  });

  return (
    <>
      <AdminPageHeader
        title="Targets"
        description="What each month is aiming for, and what it actually did. All three targets are optional and independent — leave one empty and it simply is not measured. An empty target is not a target of zero."
        action={
          <Link
            href={localizePath(activeLocale, "/admin/finance")}
            className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
          >
            ← Finance
          </Link>
        }
      />

      <p className="mb-8 max-w-2xl text-[12px] leading-relaxed text-ground-muted">
        Actuals are read from the same figures the dashboard prints: revenue and
        product cost from the Sales &amp; Profit ledger, expenses from the
        expense ledger. Gross and net profit read as an em dash for a month whose
        sales carry no product cost — unknown, rather than zero.
      </p>

      <TargetsEditor rows={rows} />
    </>
  );
}
