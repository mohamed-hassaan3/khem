"use client";

/**
 * The category list, editable in place.
 *
 * ## Renaming is safe, and the copy says why
 *
 * Every expense carries the category name it was *written under*, and the
 * reports group on that snapshot. So renaming *Rent* to *Premises* changes what
 * new expenses will say and changes no month that has already been reported.
 * Both names then appear in a long-range breakdown, which looks odd for a
 * moment and is the honest answer: they were two different labels at two
 * different times.
 *
 * ## Archive is the normal removal
 *
 * Archiving hides a category from the two forms without disturbing anything
 * recorded under it. Deleting is refused for a category KHEM ships with (the
 * migration's seed would bring it back, which reads as a failed delete) and for
 * one anything points at — so the only category that can be deleted is one
 * somebody added by mistake.
 */

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createExpenseCategory,
  deleteExpenseCategory,
  renameExpenseCategory,
  setExpenseCategoryArchived,
} from "@/src/actions/admin/finance";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminSelect,
} from "@/src/components/admin/fields";
import { EXPENSE_GROUP_LABEL, EXPENSE_GROUPS } from "@/src/lib/admin/finance";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { ExpenseCategory, ExpenseGroup } from "@/src/types/finance";

const GROUP_OPTIONS = EXPENSE_GROUPS.map((group) => ({
  value: group,
  label: EXPENSE_GROUP_LABEL[group],
}));

/** The same rule `expenseCategorySchema` enforces, applied as the desk types. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function Row({ category }: { category: ExpenseCategory }) {
  const router = useRouter();
  const { toast } = useAdminToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [group, setGroup] = useState<string>(category.group);
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const used = category.expenseCount ?? 0;
  const deletable = !category.isSystem && used === 0;

  function act(run: () => Promise<AdminActionResult>) {
    startTransition(async () => {
      setResult(null);
      const outcome = await run();

      if (!outcome.ok) {
        setResult(outcome);
        return;
      }

      toast(outcome.message);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <li className="border border-ground-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p
            className={`font-heading text-[11px] tracking-[0.1em] ${
              category.isArchived ? "text-ground-muted line-through" : "text-ground"
            }`}
          >
            {category.name}
          </p>
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-ground-subtle">
            {EXPENSE_GROUP_LABEL[category.group]}
            {used > 0 ? ` · ${used} recorded` : " · unused"}
            {category.isSystem ? " · shipped" : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminButton variant="ghost" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Edit"}
          </AdminButton>

          <AdminButton
            variant="ghost"
            disabled={isPending}
            onClick={() =>
              act(() => setExpenseCategoryArchived(category.id, !category.isArchived))
            }
          >
            {category.isArchived ? "Restore" : "Archive"}
          </AdminButton>

          {deletable ? (
            <AdminButton
              variant="danger"
              disabled={isPending}
              onClick={() => act(() => deleteExpenseCategory(category.id))}
            >
              Delete
            </AdminButton>
          ) : null}
        </div>
      </div>

      {result && !result.ok ? (
        <div className="mt-4">
          <AdminNotice tone="error">{result.message}</AdminNotice>
        </div>
      ) : null}

      {open ? (
        <div className="mt-5 grid gap-4 border-t border-ground-border pt-5 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <AdminInput
            id={`name-${category.id}`}
            label="Name"
            value={name}
            onChange={setName}
            error={result && !result.ok ? result.fieldErrors?.name : undefined}
          />

          <AdminSelect
            id={`group-${category.id}`}
            label="Family"
            value={group}
            onChange={setGroup}
            options={GROUP_OPTIONS}
          />

          <AdminButton
            disabled={isPending}
            onClick={() =>
              act(() =>
                renameExpenseCategory(category.id, {
                  name,
                  group,
                  sortOrder: category.sortOrder,
                }),
              )
            }
          >
            {isPending ? "Saving" : "Save"}
          </AdminButton>
        </div>
      ) : null}
    </li>
  );
}

export default function ExpenseCategoryEditor({
  categories,
}: {
  categories: readonly ExpenseCategory[];
}) {
  const router = useRouter();
  const { toast } = useAdminToast();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState<string>("OPERATIONS");
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      setResult(null);

      const outcome = await createExpenseCategory({
        id: slugify(name),
        name,
        group,
        sortOrder: 500,
      });

      if (!outcome.ok) {
        setResult(outcome);
        return;
      }

      toast(outcome.message);
      setName("");
      setAdding(false);
      router.refresh();
    });
  }

  const byGroup = EXPENSE_GROUPS.map((entry) => ({
    group: entry as ExpenseGroup,
    rows: categories.filter((category) => category.group === entry),
  })).filter((section) => section.rows.length > 0);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {adding ? (
          <div className="border border-ground-border p-6">
            {result && !result.ok ? (
              <div className="mb-4">
                <AdminNotice tone="error">{result.message}</AdminNotice>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
              <AdminInput
                id="new-category-name"
                label="Name"
                value={name}
                onChange={setName}
                placeholder="Courier & shipping"
                error={result && !result.ok ? result.fieldErrors?.name : undefined}
              />

              <AdminSelect
                id="new-category-group"
                label="Family"
                value={group}
                onChange={setGroup}
                options={GROUP_OPTIONS}
              />

              <div className="flex gap-2">
                <AdminButton disabled={isPending || name.trim().length < 2} onClick={add}>
                  {isPending ? "Adding" : "Add"}
                </AdminButton>
                <AdminButton variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </AdminButton>
              </div>
            </div>
          </div>
        ) : (
          <AdminButton variant="ghost" onClick={() => setAdding(true)}>
            <Plus size={13} strokeWidth={1.25} />
            New category
          </AdminButton>
        )}
      </div>

      {byGroup.map((section) => (
        <section key={section.group}>
          <h2 className="mb-4 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            {EXPENSE_GROUP_LABEL[section.group]}
          </h2>
          <ul className="space-y-3">
            {section.rows.map((category) => (
              <Row key={category.id} category={category} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
