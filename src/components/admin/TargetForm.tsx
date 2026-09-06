"use client";

/**
 * One month's targets.
 *
 * Three amounts, all optional and all independent: a house may have decided
 * what it wants to sell without having decided what it wants to keep. **Empty
 * is not zero** — an empty field means "no target for this", and the dashboard
 * simply does not show that meter, whereas a zero would be a house that had
 * declared it was aiming for nothing.
 *
 * The month is a `month` input rather than a date, because a target is set for
 * September and not for the 6th of it. The schema normalises it to the first of
 * the month, which is the only value the column accepts.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteFinancialTarget,
  saveFinancialTarget,
} from "@/src/actions/admin/finance";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminNotice,
  AdminTextarea,
  FIELD_CLASS,
} from "@/src/components/admin/fields";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { FinancialTarget } from "@/src/types/finance";

function toPounds(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);
}

/** `YYYY-MM` — what a month input takes, from a `YYYY-MM-DD` first-of-month. */
function toMonthInput(periodMonth: string): string {
  return periodMonth.slice(0, 7);
}

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function TargetForm({
  target,
  /** Fixed when editing an existing month, chosen when setting a new one. */
  lockedMonth = null,
  onSaved,
}: {
  target: FinancialTarget | null;
  lockedMonth?: string | null;
  /** Lets the list collapse the editor after a save. */
  onSaved?: () => void;
}) {
  const router = useRouter();

  const [periodMonth, setPeriodMonth] = useState(
    lockedMonth
      ? toMonthInput(lockedMonth)
      : target
        ? toMonthInput(target.periodMonth)
        : thisMonth(),
  );
  const [revenueTarget, setRevenueTarget] = useState(
    toPounds(target?.revenueTargetInCents),
  );
  const [grossProfitTarget, setGrossProfitTarget] = useState(
    toPounds(target?.grossProfitTargetInCents),
  );
  const [netProfitTarget, setNetProfitTarget] = useState(
    toPounds(target?.netProfitTargetInCents),
  );
  const [notes, setNotes] = useState(target?.notes ?? "");

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const { toast } = useAdminToast();

  function submit(event: React.FormEvent) {
    event.preventDefault();

    startTransition(async () => {
      setResult(null);

      const outcome = await saveFinancialTarget({
        periodMonth,
        revenueTarget,
        grossProfitTarget,
        netProfitTarget,
        notes,
      });

      if (!outcome.ok) {
        setResult(outcome);
        return;
      }

      toast(outcome.message);
      onSaved?.();
      router.refresh();
    });
  }

  function clear() {
    setArmed(false);
    startTransition(async () => {
      const outcome = await deleteFinancialTarget(`${periodMonth}-01`);

      if (!outcome.ok) {
        setResult(outcome);
        return;
      }

      toast(outcome.message);
      onSaved?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {result && !result.ok ? (
        <AdminNotice tone="error">{result.message}</AdminNotice>
      ) : null}

      <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
        <AdminField
          label="Month"
          htmlFor="periodMonth"
          error={fieldErrors.periodMonth}
          required
        >
          <input
            id="periodMonth"
            type="month"
            value={periodMonth}
            disabled={lockedMonth !== null}
            onChange={(event) => setPeriodMonth(event.target.value)}
            className={`${FIELD_CLASS} ${lockedMonth !== null ? "cursor-not-allowed text-ground-muted" : ""}`}
          />
        </AdminField>

        <AdminInput
          id="revenueTarget"
          type="number"
          step="0.01"
          min={0}
          label="Revenue target (EGP)"
          value={revenueTarget}
          onChange={setRevenueTarget}
          error={fieldErrors.revenueTarget}
          hint="Merchandise revenue, delivery excluded."
        />
      </div>

      <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
        <AdminInput
          id="grossProfitTarget"
          type="number"
          step="0.01"
          min={0}
          label="Gross profit target (EGP)"
          value={grossProfitTarget}
          onChange={setGrossProfitTarget}
          error={fieldErrors.grossProfitTarget}
          hint="Revenue after what the goods cost."
        />

        <AdminInput
          id="netProfitTarget"
          type="number"
          step="0.01"
          min={0}
          label="Net profit target (EGP)"
          value={netProfitTarget}
          onChange={setNetProfitTarget}
          error={fieldErrors.netProfitTarget}
          hint="Gross profit after operating expenses."
        />
      </div>

      <AdminTextarea
        id="notes"
        label="Notes"
        value={notes}
        onChange={setNotes}
        error={fieldErrors.notes}
        rows={2}
        hint="Leave any of the three empty for “no target”. Empty is not zero."
      />

      <div className="flex flex-wrap items-center gap-3">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving" : "Save targets"}
        </AdminButton>

        {target ? (
          armed ? (
            <>
              <AdminButton variant="danger" disabled={isPending} onClick={clear}>
                Clear this month
              </AdminButton>
              <AdminButton variant="ghost" onClick={() => setArmed(false)}>
                Keep them
              </AdminButton>
            </>
          ) : (
            <AdminButton variant="ghost" onClick={() => setArmed(true)}>
              Clear
            </AdminButton>
          )
        ) : null}
      </div>
    </form>
  );
}
