/**
 * Where the money went, as bars.
 *
 * `<TopProductsBars>`'s twin, and deliberately *not* lightweight-charts for the
 * same reason: that library draws time series, and a ranked comparison of a
 * dozen categories is a list with proportional rules. Rendering it in CSS keeps
 * this a Server Component with no canvas, no hydration and no second axis to
 * explain — and, unlike a pie, it stays readable when one category is 60% of
 * the spend and four are 1% each.
 *
 * Bars are relative to the largest line rather than to the total: the question
 * this panel answers is "what is the money going on", which is a comparison
 * between the rows.
 */

import { egpCompact } from "@/src/lib/admin/money";
import { EXPENSE_GROUP_LABEL } from "@/src/lib/admin/finance";
import type { ExpenseBreakdownRow } from "@/src/types/finance";

export default function BreakdownBars({
  rows,
  totalInCents,
}: {
  rows: readonly ExpenseBreakdownRow[];
  /** The window's total, so each row can state its share of the whole. */
  totalInCents: number;
}) {
  const leader = rows.reduce((max, row) => Math.max(max, row.amountInCents), 0);

  return (
    <ul className="space-y-5">
      {rows.map((row) => {
        // Guarded against a zero leader: every category being zero is the empty
        // state's job, not a division by zero.
        const width = leader > 0 ? (row.amountInCents / leader) * 100 : 0;
        const share = totalInCents > 0 ? (row.amountInCents / totalInCents) * 100 : null;

        return (
          <li key={`${row.categoryGroup}:${row.categoryName}`}>
            <div className="mb-2 flex items-baseline justify-between gap-4">
              <span className="min-w-0 text-[12px] tracking-wide text-ground">
                {row.categoryName}
                <span className="ms-2 text-[10px] uppercase tracking-[0.2em] text-ground-subtle">
                  {EXPENSE_GROUP_LABEL[row.categoryGroup]}
                </span>
              </span>
              <span className="shrink-0 font-heading text-[11px] tracking-[0.1em] text-ground-accent">
                {egpCompact(row.amountInCents)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-ivory/8">
                <div
                  className="h-px bg-gold transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ width: `${Math.max(width, 2)}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-end text-[10px] tracking-wide text-ground-muted">
                {share === null ? "—" : `${share.toFixed(0)}%`}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
