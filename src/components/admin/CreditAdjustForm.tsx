"use client";

/**
 * The one credit write an administrator may make.
 *
 * An **adjustment**, not an edit. It appends an ADJUSTED row to the ledger and
 * leaves everything already there intact — which is the whole reason the
 * balance is derived rather than stored: a correction that could overwrite the
 * history would make the trail below it a work of fiction.
 *
 * The reason is required. An unexplained adjustment is precisely the row an
 * audit cannot answer, and requiring it costs one sentence at the moment
 * somebody already knows why they are doing it.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { adjustCredit } from "@/src/actions/admin/credits";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminTextarea,
} from "@/src/components/admin/fields";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";

export default function CreditAdjustForm({ creditId }: { creditId: string }) {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { toast } = useAdminToast();

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function submit() {
    setResult(null);

    startTransition(async () => {
      const outcome = await adjustCredit({
        creditId,
        amountInCents: amount,
        note,
      });

      // Successes leave, failures stay — see `admin-toast-provider.tsx`.
      if (outcome.ok) toast(outcome.message);
      setResult(outcome.ok ? null : outcome);

      if (outcome.ok) {
        setAmount("");
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-4 md:space-y-6"
    >
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      <AdminInput
        id="amountInCents"
        label="Amount, in piastres"
        value={amount}
        onChange={setAmount}
        error={fieldErrors.amountInCents}
        hint="Positive gives; negative takes away. 5000 is 50.00 EGP."
      />

      <AdminTextarea
        id="note"
        label="Reason"
        value={note}
        onChange={setNote}
        error={fieldErrors.note}
        hint="Recorded against your name on the ledger below."
      />

      <AdminButton type="submit" disabled={isPending}>
        {isPending ? "Recording" : "Record adjustment"}
      </AdminButton>
    </form>
  );
}
