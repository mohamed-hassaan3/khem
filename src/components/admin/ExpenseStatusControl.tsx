"use client";

/**
 * Marking an expense paid, unpaid, or void — from the table row.
 *
 * Two controls rather than a cycle: "paid / unpaid" is a correction anybody
 * makes ten times a month and should cost one click, while voiding removes a
 * cost from every figure on the dashboard and is armed first, the same
 * confirm-then-act shape `<StatusToggle>` uses. The armed state times out, so a
 * button left armed does not stay armed for the next person to reach for it.
 *
 * Voiding rather than deleting is the default the brief asks for: the row stays
 * in the ledger, auditable, and counts nowhere.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setExpenseStatus } from "@/src/actions/admin/finance";
import type { ExpenseStatus } from "@/src/types/finance";

/** How long an armed button stays armed. */
const ARM_TIMEOUT_MS = 4_000;

const BASE =
  "rounded-none border px-3 py-1.5 font-heading text-[9px] uppercase tracking-[0.2em] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none disabled:opacity-40";

export default function ExpenseStatusControl({
  id,
  status,
}: {
  id: string;
  status: ExpenseStatus;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  function run(next: ExpenseStatus) {
    setError(null);
    startTransition(async () => {
      const outcome = await setExpenseStatus(id, next);
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      router.refresh();
    });
  }

  if (status === "VOID") {
    return (
      <div className="inline-flex flex-col items-start gap-1">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run("PENDING")}
          className={`${BASE} border-ground-border text-ground-muted hover:border-gold/40 hover:text-ground-accent`}
        >
          {isPending ? "Working…" : "Restore"}
        </button>
        {error ? <span className="text-[10px] text-danger">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(status === "PAID" ? "PENDING" : "PAID")}
          className={`${BASE} border-ground-border text-ground-muted hover:border-gold/40 hover:text-ground-accent`}
        >
          {isPending ? "Working…" : status === "PAID" ? "Mark unpaid" : "Mark paid"}
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => (armed ? run("VOID") : setArmed(true))}
          className={`${BASE} ${
            armed
              ? "border-danger bg-danger/10 text-danger"
              : "border-ground-border text-ground-muted hover:border-danger/50 hover:text-danger"
          }`}
        >
          {armed ? "Confirm void" : "Void"}
        </button>
      </div>

      {error ? <span className="text-[10px] text-danger">{error}</span> : null}
    </div>
  );
}
