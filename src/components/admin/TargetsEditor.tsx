"use client";

/**
 * The months, and the one being edited.
 *
 * A client component for one reason: which row is open. Everything else — the
 * actuals, the achievements, the month list — was computed on the server and
 * arrives as props, so this holds a single string of state and no data.
 *
 * The editor opens *inside* the row rather than on its own page, because
 * setting a target is a decision made while looking at what the month actually
 * did. Navigating away from those figures to type a number at them is the wrong
 * shape for the task.
 */

import { useState } from "react";

import TargetForm from "@/src/components/admin/TargetForm";
import { egpCompact } from "@/src/lib/admin/money";
import { formatAchievement, monthLabel, targetProgress } from "@/src/lib/admin/finance";
import type { FinancePoint, FinancialTarget } from "@/src/types/finance";

export interface TargetMonthRow {
  /** `YYYY-MM-DD`, first of the month. */
  periodMonth: string;
  actuals: FinancePoint | null;
  target: FinancialTarget | null;
}

/** One target's actual and achievement, or a pair of em dashes. */
function Cell({
  targetInCents,
  actualInCents,
}: {
  targetInCents: number | null;
  actualInCents: number | null;
}) {
  const progress = targetProgress(targetInCents, actualInCents);

  if (!progress) {
    return (
      // The month's pill already says "No target"; the figure stands alone.
      <span className="text-[13px] text-ground">
        {actualInCents === null ? "—" : egpCompact(actualInCents)}
      </span>
    );
  }

  const met = progress.achievement !== null && progress.achievement >= 100;

  return (
    <span className="block text-[13px] text-ground">
      {progress.actualInCents === null ? "—" : egpCompact(progress.actualInCents)}
      <span className="text-ground-subtle"> / {egpCompact(progress.targetInCents)}</span>
      <span
        className={`ms-2 font-heading text-[10px] tracking-[0.1em] ${
          met ? "text-ground-accent" : "text-ground-muted"
        }`}
      >
        {formatAchievement(progress.achievement)}
      </span>
    </span>
  );
}

export default function TargetsEditor({ rows }: { rows: readonly TargetMonthRow[] }) {
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const isOpen = openMonth === row.periodMonth;
        const hasTarget =
          row.target !== null &&
          (row.target.revenueTargetInCents !== null ||
            row.target.grossProfitTargetInCents !== null ||
            row.target.netProfitTargetInCents !== null);

        return (
          <li key={row.periodMonth} className="rounded-lg border border-ground-border bg-stone">
            {/* Compact on phones: month, state and the button on one line,
                the three figures side by side beneath. (stage 6d) */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-2">
                <p className="font-heading text-[15px] text-ground">{monthLabel(row.periodMonth)}</p>
                <span
                  className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] ${
                    hasTarget ? "border-gold/50 text-ground-accent" : "border-ground-border text-ground-muted"
                  }`}
                >
                  {hasTarget ? "Target set" : "No target"}
                </span>
                <button
                  type="button"
                  onClick={() => setOpenMonth(isOpen ? null : row.periodMonth)}
                  aria-expanded={isOpen}
                  className="ms-auto h-9 shrink-0 cursor-pointer rounded-lg border border-ground-border px-3 text-[12px] text-ground transition-colors duration-300 hover:border-gold/40"
                >
                  {isOpen ? "Close" : hasTarget ? "Edit" : "Set targets"}
                </button>
              </div>

              <dl className="mt-2 grid grid-cols-3 gap-2">
                <div className="min-w-0">
                  <dt className="text-[11px] text-ground-muted">Revenue</dt>
                  <dd className="mt-0.5">
                    <Cell
                      targetInCents={row.target?.revenueTargetInCents ?? null}
                      actualInCents={row.actuals?.revenueInCents ?? 0}
                    />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] text-ground-muted">Gross profit</dt>
                  <dd className="mt-0.5">
                    <Cell
                      targetInCents={row.target?.grossProfitTargetInCents ?? null}
                      actualInCents={row.actuals?.grossProfitInCents ?? null}
                    />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] text-ground-muted">Net profit</dt>
                  <dd className="mt-0.5">
                    <Cell
                      targetInCents={row.target?.netProfitTargetInCents ?? null}
                      actualInCents={row.actuals?.netProfitInCents ?? null}
                    />
                  </dd>
                </div>
              </dl>
            </div>

            {isOpen ? (
              <div className="border-t border-ground-border px-4 py-4 sm:p-6">
                <TargetForm
                  target={row.target}
                  lockedMonth={row.periodMonth}
                  onSaved={() => setOpenMonth(null)}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
