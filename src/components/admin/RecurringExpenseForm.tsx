"use client";

/**
 * A recurring expense — the template, not the ledger rows.
 *
 * The one thing this screen has to make unmistakable is stated twice: in the
 * notice at the top and in the hint under the amount. **Editing a rule changes
 * the future.** September's rent stays at what September was written with,
 * whatever October becomes. That is not a limitation to be apologised for, it
 * is the property that makes a closed month trustworthy, and a form that let it
 * be doubted would be a form that invited somebody to "fix" history.
 *
 * Widening a rule's window — an earlier start, a later end — does write the
 * periods that were missing, because those are periods the house genuinely
 * incurred and had not yet recorded. Narrowing it removes nothing.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  deleteExpenseRule,
  setExpenseRuleActive,
  updateExpenseRule,
} from "@/src/actions/admin/finance";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
} from "@/src/components/admin/fields";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { EXPENSE_GROUP_LABEL, EXPENSE_GROUPS } from "@/src/lib/admin/finance";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { ExpenseCategory, ExpenseRule } from "@/src/types/finance";

const CADENCE_OPTIONS = [
  { value: "MONTHLY", label: "Every month" },
  { value: "YEARLY", label: "Every year" },
] as const;

function toPounds(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default function RecurringExpenseForm({
  rule,
  categories,
  locale,
}: {
  rule: ExpenseRule;
  categories: readonly ExpenseCategory[];
  locale: Locale;
}) {
  const router = useRouter();

  const [name, setName] = useState(rule.name);
  const [categoryId, setCategoryId] = useState(rule.categoryId);
  const [amount, setAmount] = useState(toPounds(rule.amountInCents));
  const [cadence, setCadence] = useState<string>(rule.cadence);
  const [startsOn, setStartsOn] = useState(rule.startsOn);
  const [endsOn, setEndsOn] = useState(rule.endsOn ?? "");
  const [vendor, setVendor] = useState(rule.vendor ?? "");
  const [notes, setNotes] = useState(rule.notes ?? "");
  const [isActive, setIsActive] = useState(rule.isActive);

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  const selectable = categories.filter(
    (category) => !category.isArchived || category.id === rule.categoryId,
  );

  const categoryOptions = EXPENSE_GROUPS.flatMap((group) =>
    selectable
      .filter((category) => category.group === group)
      .map((category) => ({
        value: category.id,
        label: `${EXPENSE_GROUP_LABEL[group]} · ${category.name}`,
      })),
  );

  const payload = {
    name,
    categoryId,
    amount,
    cadence,
    startsOn,
    endsOn,
    vendor,
    notes,
    isActive,
  };

  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload,
    save: () => persist(),
    pending: isPending,
  });

  async function persist(): Promise<boolean> {
    setResult(null);

    const outcome = await updateExpenseRule(rule.id, payload);

    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);

    if (outcome.ok) {
      markSaved();
      router.refresh();
    }

    return outcome.ok;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(() => {
      void persist();
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const outcome = await setExpenseRuleActive(rule.id, !rule.isActive);
      if (!outcome.ok) {
        setResult(outcome);
        return;
      }
      toast(outcome.message);
      router.refresh();
    });
  }

  function remove() {
    setArmed(false);
    startTransition(async () => {
      const outcome = await deleteExpenseRule(rule.id);
      if (!outcome.ok) {
        setResult(outcome);
        return;
      }
      toast(outcome.message);
      router.push(localizePath(locale, "/admin/finance/expenses"));
      router.refresh();
    });
  }

  const generated = rule.generatedCount ?? 0;

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-8 md:space-y-10">
      {result && !result.ok ? (
        <AdminNotice tone="error">{result.message}</AdminNotice>
      ) : null}

      <AdminNotice tone="warning">
        Changes here apply to periods not yet written.{" "}
        {generated === 0
          ? "Nothing has been recorded from this rule yet."
          : `The ${generated} ${generated === 1 ? "period" : "periods"} already recorded keep the amount they were written with.`}
      </AdminNotice>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          The commitment
        </h2>

        <AdminInput
          id="name"
          label="What it is"
          value={name}
          onChange={setName}
          error={fieldErrors.name}
          required
        />

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminSelect
            id="categoryId"
            label="Category"
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            error={fieldErrors.categoryId}
            required
          />

          <AdminInput
            id="amount"
            type="number"
            step="0.01"
            min={0}
            label="Amount (EGP)"
            value={amount}
            onChange={setAmount}
            error={fieldErrors.amount}
            hint="Applies from the next period onwards. Periods already recorded are not rewritten."
            required
          />
        </div>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-3">
          <AdminSelect
            id="cadence"
            label="How often"
            value={cadence}
            onChange={setCadence}
            options={CADENCE_OPTIONS}
            error={fieldErrors.cadence}
          />

          <AdminInput
            id="startsOn"
            type="date"
            label="First occurrence"
            value={startsOn}
            onChange={setStartsOn}
            error={fieldErrors.startsOn}
            hint="Moving it earlier writes the periods that were missing."
            required
          />

          <AdminInput
            id="endsOn"
            type="date"
            label="Until"
            value={endsOn}
            onChange={setEndsOn}
            error={fieldErrors.endsOn}
            hint="Empty is open-ended."
          />
        </div>
      </section>

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          Detail
        </h2>

        <AdminInput
          id="vendor"
          label="Supplier"
          value={vendor}
          onChange={setVendor}
          error={fieldErrors.vendor}
          placeholder="Optional"
        />

        <AdminTextarea
          id="notes"
          label="Notes"
          value={notes}
          onChange={setNotes}
          error={fieldErrors.notes}
          rows={3}
        />

        <AdminToggle
          id="isActive"
          label="Still recurring"
          description="Switching this off writes no further periods and removes none."
          checked={isActive}
          onChange={setIsActive}
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving" : "Save recurring expense"}
        </AdminButton>

        <AdminButton variant="ghost" disabled={isPending} onClick={toggleActive}>
          {rule.isActive ? "Stop recurring" : "Resume"}
        </AdminButton>

        {armed ? (
          <>
            <AdminButton variant="danger" disabled={isPending} onClick={remove}>
              Delete the rule
            </AdminButton>
            <AdminButton variant="ghost" onClick={() => setArmed(false)}>
              Keep it
            </AdminButton>
          </>
        ) : (
          <AdminButton variant="ghost" onClick={() => setArmed(true)}>
            Delete
          </AdminButton>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-ground-muted">
        Deleting the rule keeps every expense it has already recorded — they
        become ordinary one-time costs. The house did pay them, whatever becomes
        of the template. To stop the cost appearing without touching the record,
        use <strong>Stop recurring</strong>.
      </p>
    </form>
  );
}
