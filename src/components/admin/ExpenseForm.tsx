"use client";

/**
 * An expense, in the fields a boutique owner thinks in.
 *
 * ## One form, two outcomes
 *
 * **Repeats** is the field that matters. Left at *one-time*, this records a
 * single cost. Set to monthly or yearly, it creates a *rule* instead — and the
 * date the desk typed becomes the first of a series, with every occurrence up
 * to today written by the database in one pass. The hint under the control says
 * exactly that, because "I entered rent once and got six rows" is a surprise
 * worth spending a sentence on.
 *
 * The switch is hidden entirely when editing: a row that exists is a row, and
 * turning it into a rule after the fact would mean deciding whether the five
 * months before it should suddenly appear. That decision belongs on the rule's
 * own screen.
 *
 * ## Money is typed in pounds
 *
 * Every other admin form here takes the minor unit, because a product's price is
 * quoted that way. Nobody types rent as 4000000. `src/schemas/finance.ts` does
 * the one conversion, so no component multiplies money.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createExpense,
  deleteExpense,
  updateExpense,
} from "@/src/actions/admin/finance";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminTextarea,
} from "@/src/components/admin/fields";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { EXPENSE_GROUP_LABEL, EXPENSE_GROUPS } from "@/src/lib/admin/finance";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { Expense, ExpenseCategory } from "@/src/types/finance";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Unpaid — incurred, not yet paid" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Void — counts nowhere, stays on record" },
] as const;

const REPEAT_OPTIONS = [
  { value: "none", label: "One-time" },
  { value: "MONTHLY", label: "Every month" },
  { value: "YEARLY", label: "Every year" },
] as const;

/** Pounds, for the input. The action converts back. */
function toPounds(cents: number | undefined): string {
  if (cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

/** Today, UTC — the same day boundary every finance figure uses. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseForm({
  expense,
  categories,
  locale,
}: {
  /** `null` when recording a new one. */
  expense: Expense | null;
  categories: readonly ExpenseCategory[];
  locale: Locale;
}) {
  const router = useRouter();
  const isEdit = expense !== null;

  const [name, setName] = useState(expense?.name ?? "");
  const [categoryId, setCategoryId] = useState(
    expense?.categoryId ?? categories[0]?.id ?? "",
  );
  const [amount, setAmount] = useState(toPounds(expense?.amountInCents));
  const [incurredOn, setIncurredOn] = useState(expense?.incurredOn ?? todayIso());
  const [status, setStatus] = useState<string>(expense?.status ?? "PENDING");
  const [vendor, setVendor] = useState(expense?.vendor ?? "");
  const [reference, setReference] = useState(expense?.reference ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");

  const [repeats, setRepeats] = useState<string>("none");
  const [endsOn, setEndsOn] = useState("");

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  /*
   * Grouped by family, and archived categories are dropped: a category nobody
   * should use again must not be one keystroke from being used again. An
   * expense already recorded against one still edits fine, because its own
   * category is added back below.
   */
  const selectable = categories.filter(
    (category) => !category.isArchived || category.id === expense?.categoryId,
  );

  const categoryOptions = EXPENSE_GROUPS.flatMap((group) =>
    selectable
      .filter((category) => category.group === group)
      .map((category) => ({
        value: category.id,
        label: `${EXPENSE_GROUP_LABEL[group]} · ${category.name}`,
      })),
  );

  const payload = isEdit
    ? { name, categoryId, amount, incurredOn, status, vendor, reference, notes }
    : {
        name,
        categoryId,
        amount,
        incurredOn,
        status,
        vendor,
        reference,
        notes,
        repeats,
        endsOn,
      };

  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload,
    save: () => persist(),
    pending: isPending,
  });

  async function persist(): Promise<boolean> {
    setResult(null);

    const outcome = isEdit
      ? await updateExpense(expense.id, payload)
      : await createExpense(payload);

    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);

    if (outcome.ok) {
      markSaved();
      router.push(localizePath(locale, "/admin/finance/expenses"));
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

  function remove() {
    setArmed(false);
    startTransition(async () => {
      if (!expense) return;
      const outcome = await deleteExpense(expense.id);

      if (!outcome.ok) {
        setResult(outcome);
        return;
      }

      toast(outcome.message);
      router.push(localizePath(locale, "/admin/finance/expenses"));
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-8 md:space-y-10">
      {result && !result.ok ? (
        <AdminNotice tone="error">{result.message}</AdminNotice>
      ) : null}

      {isEdit && expense.isRecurring ? (
        <AdminNotice tone="warning">
          This was written by a recurring expense. Correcting it here changes
          this period only — the rule keeps producing the amount it holds.
        </AdminNotice>
      ) : null}

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          The cost
        </h2>

        <AdminInput
          id="name"
          label="What it is"
          value={name}
          onChange={setName}
          error={fieldErrors.name}
          placeholder="September rent"
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
            hint="Operating cost only. What the goods themselves cost is set per product and reported by Sales & Profit."
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
            placeholder="40000"
            required
          />
        </div>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="incurredOn"
            type="date"
            label={repeats === "none" ? "Date" : "First occurrence"}
            value={incurredOn}
            onChange={setIncurredOn}
            error={fieldErrors.incurredOn}
            hint="The day the cost belongs to, which is what every report groups by."
            required
          />

          <AdminSelect
            id="status"
            label="Status"
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
            error={fieldErrors.status}
            hint="Unpaid still counts: a cost belongs to the month it was incurred in, not the day the transfer cleared."
          />
        </div>
      </section>

      {isEdit ? null : (
        <section className="space-y-4 md:space-y-6">
          <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Repeats
          </h2>

          <AdminSelect
            id="repeats"
            label="How often"
            value={repeats}
            onChange={setRepeats}
            options={REPEAT_OPTIONS}
            error={fieldErrors.repeats}
            hint="A recurring expense is recorded once and written for every period since the first occurrence. Changing the amount later moves future periods only — a closed month keeps what it was written with."
          />

          {repeats === "none" ? null : (
            <AdminInput
              id="endsOn"
              type="date"
              label="Until (optional)"
              value={endsOn}
              onChange={setEndsOn}
              error={fieldErrors.endsOn}
              hint="Leave empty for an open-ended commitment. Nothing is ever written past today."
            />
          )}
        </section>
      )}

      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
          Detail
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="vendor"
            label="Supplier"
            value={vendor}
            onChange={setVendor}
            error={fieldErrors.vendor}
            placeholder="Optional"
          />

          <AdminInput
            id="reference"
            label="Reference"
            value={reference}
            onChange={setReference}
            error={fieldErrors.reference}
            placeholder="Invoice number, or a link to a scan"
          />
        </div>

        <AdminTextarea
          id="notes"
          label="Notes"
          value={notes}
          onChange={setNotes}
          error={fieldErrors.notes}
          rows={3}
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving" : isEdit ? "Save expense" : "Record expense"}
        </AdminButton>

        {isEdit && !expense.isRecurring ? (
          armed ? (
            <>
              <AdminButton variant="danger" disabled={isPending} onClick={remove}>
                Delete for good
              </AdminButton>
              <AdminButton variant="ghost" onClick={() => setArmed(false)}>
                Keep it
              </AdminButton>
            </>
          ) : (
            <AdminButton variant="ghost" onClick={() => setArmed(true)}>
              Delete
            </AdminButton>
          )
        ) : null}
      </div>

      {isEdit ? (
        <div className="border-t border-ground-border pt-6 text-[11px] leading-relaxed text-ground-muted">
          <p>
            Recorded {expense.createdBy ? `by ${expense.createdBy} ` : ""}on{" "}
            {expense.createdAt.slice(0, 10)}
            {expense.updatedBy && expense.updatedAt.slice(0, 10) !== expense.createdAt.slice(0, 10)
              ? ` · last changed by ${expense.updatedBy} on ${expense.updatedAt.slice(0, 10)}`
              : ""}
            .
          </p>
          <p className="mt-2">
            Setting the status to <strong>Void</strong> removes it from every
            figure while keeping the record — which is what to reach for instead
            of deleting anything that has already been reported on.
          </p>
        </div>
      ) : null}
    </form>
  );
}
