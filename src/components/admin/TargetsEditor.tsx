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
      <span className="text-[11px] tracking-wide text-ground-subtle">
        {actualInCents === null ? "—" : egpCompact(actualInCents)}
        <span className="ms-2 text-ground-subtle">no target</span>
      </span>
    );
  }

  const met = progress.achievement !== null && progress.achievement >= 100;

  return (
    <span className="text-[11px] tracking-wide text-ground">
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
    <ul className="space-y-3">
      {rows.map((row) => {
        const isOpen = openMonth === row.periodMonth;
        const hasTarget =
          row.target !== null &&
          (row.target.revenueTargetInCents !== null ||
            row.target.grossProfitTargetInCents !== null ||
            row.target.netProfitTargetInCents !== null);

        return (
          <li key={row.periodMonth} className="border border-ground-border">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground">
                  {monthLabel(row.periodMonth)}
                </p>
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-ground-subtle">
                  {hasTarget ? "Target set" : "No target"}
                </p>
              </div>

              <dl className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <div>
                  <dt className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
                    Revenue
                  </dt>
                  <dd className="mt-1">
                    <Cell
                      targetInCents={row.target?.revenueTargetInCents ?? null}
                      actualInCents={row.actuals?.revenueInCents ?? 0}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
                    Gross profit
                  </dt>
                  <dd className="mt-1">
                    <Cell
                      targetInCents={row.target?.grossProfitTargetInCents ?? null}
                      actualInCents={row.actuals?.grossProfitInCents ?? null}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-subtle">
                    Net profit
                  </dt>
                  <dd className="mt-1">
                    <Cell
                      targetInCents={row.target?.netProfitTargetInCents ?? null}
                      actualInCents={row.actuals?.netProfitInCents ?? null}
                    />
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => setOpenMonth(isOpen ? null : row.periodMonth)}
                className="rounded-none border border-ground-border px-5 py-2.5 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-muted transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-gold/40 hover:text-ground-accent focus:outline-none"
              >
                {isOpen ? "Close" : hasTarget ? "Edit" : "Set targets"}
              </button>
            </div>

            {isOpen ? (
              <div className="border-t border-ground-border p-5 sm:p-6">
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
