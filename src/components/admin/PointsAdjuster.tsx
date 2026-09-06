"use client";

/**
 * The one manual lever over a customer's points.
 *
 * Shaped exactly like the credit adjuster it sits beside: a **signed** amount, a
 * required reason, and the administrator taken from the session rather than the
 * form. It writes a new ledger row and never edits one, which is what keeps the
 * history answerable — the whole argument `supabase/sql/0059_rewards.sql` makes
 * about not storing a balance.
 *
 * ## Why the reason is required
 *
 * An unexplained adjustment is exactly the row an audit cannot answer. Six
 * months later "−500" with no sentence beside it is indistinguishable from a
 * mistake, and the customer is the one who has to live with the ambiguity.
 *
 * ## Why it refuses to go below zero
 *
 * `adjust_points()` refuses it under a lock and this refuses it in the form. The
 * database is the boundary; this is the affordance that stops an editor
 * discovering the rule by hitting it.
 */

import { useState, useTransition } from "react";

import { adjustPoints } from "@/src/actions/admin/rewards";
import { AdminButton, AdminInput, AdminNotice } from "@/src/components/admin/fields";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";

export default function PointsAdjuster({
  clerkUserId,
  name,
}: {
  clerkUserId: string;
  /** Who this is, for the panel's heading. Never sent anywhere. */
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const { toast } = useAdminToast();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer whitespace-nowrap border border-ground-border px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.16em] text-ground-muted transition-colors duration-300 hover:border-ground-accent/40 hover:text-ground-accent"
      >
        Adjust
      </button>
    );
  }

  return (
    <div className="w-72 space-y-3 border border-ground-accent/30 p-4">
      <p className="font-heading text-[10px] uppercase tracking-[0.16em] text-ground-muted">
        Adjust {name}
      </p>

      {result && !result.ok ? (
        <AdminNotice tone="error">{result.message}</AdminNotice>
      ) : null}

      <AdminInput
        id={`points-${clerkUserId}`}
        label="Points"
        type="number"
        value={points}
        onChange={setPoints}
        error={fieldErrors.points}
        hint="Positive gives, negative takes away. Zero records nothing."
      />

      <AdminInput
        id={`note-${clerkUserId}`}
        label="Reason"
        value={note}
        onChange={setNote}
        error={fieldErrors.note}
        hint="Printed in the desk's ledger and in the customer's own."
      />

      <div className="flex gap-2">
        <AdminButton
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              const outcome = await adjustPoints({
                clerkUserId,
                points,
                note,
              });

              setResult(outcome.ok ? null : outcome);

              if (outcome.ok) {
                toast(outcome.message);
                setPoints("");
                setNote("");
                setOpen(false);
              }
            });
          }}
        >
          {isPending ? "Recording" : "Record"}
        </AdminButton>

        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setResult(null);
          }}
          className="cursor-pointer px-3 font-heading text-[10px] uppercase tracking-[0.16em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
