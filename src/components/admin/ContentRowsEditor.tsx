"use client";

/**
 * One editor for every flat content table.
 *
 * The heritage timeline, the craft pillars, the brand values, the mission
 * statements, the craft stats — nine tables in `supabase/sql/0002_content.sql`
 * share one shape: a hand-typed id, a handful of text columns, half of them
 * with an Arabic twin, and a `sortOrder`. Nine hand-written editors would be
 * nine copies of the same three hundred lines, drifting apart at the first
 * change.
 *
 * So the fields are data. A caller passes a {@link RowField} list describing
 * what to render, and the three Server Actions that write it.
 *
 * ## Why the actions are props
 *
 * The alternative is a `kind` discriminator and a switch inside this file —
 * which is what `StatusToggle` does, and what makes it awkward to extend.
 * Server Actions can be passed from a Server Component to a Client Component
 * directly, so each caller hands over its own three and this component needs to
 * know nothing about which table it is editing.
 *
 * ## One card, one save
 *
 * A single form over every row would let one validation error block unrelated
 * edits, and would make "remove this one" strange to express. Each card owns
 * its own pending state and its own result banner.
 *
 * ## The Arabic fields are the point
 *
 * Every `_ar` column in these tables is currently empty, and the public pages
 * fall back to English through `resolveText()`. Filling them in is the reason
 * this screen exists, so the twins sit beside their English source rather than
 * behind a tab, and a row with an untranslated field says so in its heading.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminTextarea,
  AdminToggle,
} from "@/src/components/admin/fields";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";

/**
 * A value as it arrives from a row.
 *
 * `boolean` is here for the toggle columns — `"CraftQuote"."isPublished"` and
 * whatever follows it. Everything is held as a string inside the card and
 * `stringify` turns a stored `true` into `"true"`, which is what the toggle
 * branch reads back.
 */
export type RowValue = string | number | boolean | null;

export interface RowField {
  /** Column name — also the key in the payload and in `fieldErrors`. */
  name: string;
  label: string;
  kind?: "text" | "textarea" | "toggle";
  hint?: string;
  /** Marks a column as the Arabic twin of another, for the heading badge. */
  isTranslation?: boolean;
}

export type ContentRow = Record<string, RowValue>;

type SaveAction = (input: unknown) => Promise<AdminActionResult>;

function stringify(value: RowValue): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function RowCard({
  row,
  fields,
  isNew,
  headingField,
  entityLabel,
  onCreate,
  onUpdate,
  onDelete,
  onDone,
}: {
  row: ContentRow;
  fields: readonly RowField[];
  isNew: boolean;
  headingField: string;
  entityLabel: string;
  onCreate: SaveAction;
  onUpdate: SaveAction;
  onDelete: SaveAction;
  onDone: () => void;
}) {
  const router = useRouter();

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = { id: stringify(row.id) };
    for (const field of fields) {
      const value = row[field.name];
      // `stringify` turns a stored boolean into "true"/"false", which is
      // exactly what the toggle branch above reads back.
      initial[field.name] =
        field.kind === "toggle" && value === null ? "true" : stringify(value);
    }
    initial.sortOrder = stringify(row.sortOrder ?? 0);
    return initial;
  });

  const [idTouched, setIdTouched] = useState(!isNew);
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function set(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  /** Id suggestion while creating, from whichever field titles the card. */
  function setHeading(value: string) {
    set(headingField, value);

    if (!idTouched) {
      set(
        "id",
        value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 64),
      );
    }
  }

  /*
   * `values` is already this row's payload — it is what the action receives —
   * so the guard watches it directly rather than assembling a copy that could
   * fall out of step with it.
   */
  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload: values,
    save: () => persist(),
    pending: isPending,
  });

  /** Saves and reports whether it worked. Awaited by the leave-page dialog. */
  async function persist(): Promise<boolean> {
    setResult(null);

    const outcome = isNew ? await onCreate(values) : await onUpdate(values);
    /*
     * Successes leave, failures stay. A receipt has done its job the moment it
     * is read; a refusal names a field and has to be acted on, so it keeps its
     * place above the form. See `admin-toast-provider.tsx`.
     */
    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);

    if (outcome.ok) {
      router.refresh();
      if (isNew) onDone();
    }

    // This row now matches the record, so leaving is no longer losing anything.
    if (outcome.ok) markSaved();
    return outcome.ok;
  }

  function save() {
    /*
     * The callback stays `async` and awaits: React 19 keeps `isPending` true for
     * the life of an async transition, and a synchronous callback that merely
     * *starts* the promise would drop the flag immediately — the save button
     * would stop saying "Saving" the instant it was pressed.
     */
    startTransition(async () => {
      await persist();
    });
  }

  function remove() {
    startTransition(async () => {
      const outcome = await onDelete({ id: values.id });

      if (outcome.ok) {
        router.refresh();
        return;
      }

      setArmed(false);
      setResult(outcome);
    });
  }

  // A row whose Arabic columns are all empty renders English on the Arabic
  // site. That is a correct fallback and still worth flagging.
  const translations = fields.filter((field) => field.isTranslation);
  const untranslated = translations.every(
    (field) => values[field.name].trim().length === 0,
  );

  const hasTranslations = translations.length > 0;

  return (
    <div className="border border-border p-5 sm:p-6">
      <div className="space-y-4 md:space-y-6">
        {!isNew ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-heading text-[11px] tracking-[0.1em] text-ivory/70">
              {values[headingField] || values.id}
            </span>
            {hasTranslations && untranslated ? (
              <span
                title="No Arabic — the Arabic page falls back to the English text"
                className="inline-block border border-border px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.2em] text-ivory/30"
              >
                No Arabic
              </span>
            ) : null}
          </div>
        ) : null}

        {result ? (
          <AdminNotice tone={result.ok ? "success" : "error"}>
            {result.message}
          </AdminNotice>
        ) : null}

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          {fields.map((field) => {
            if (field.kind === "toggle") {
              /*
               * Carried as the strings "true"/"false" because every value in
               * this editor is a string. `schemas/content.ts` parses them with
               * an explicit comparison rather than `z.coerce.boolean()`, which
               * would read the string "false" as **true**.
               */
              return (
                <AdminToggle
                  key={field.name}
                  id={`${field.name}-${values.id || "new"}`}
                  label={field.label}
                  description={field.hint}
                  checked={values[field.name] === "true"}
                  onChange={(next) => set(field.name, next ? "true" : "false")}
                />
              );
            }

            const Component =
              field.kind === "textarea" ? AdminTextarea : AdminInput;

            return (
              <Component
                key={field.name}
                id={`${field.name}-${values.id || "new"}`}
                label={field.label}
                value={values[field.name]}
                onChange={(next: string) =>
                  field.name === headingField
                    ? setHeading(next)
                    : set(field.name, next)
                }
                error={fieldErrors[field.name]}
                hint={field.hint}
              />
            );
          })}

          <AdminInput
            id={`sortOrder-${values.id || "new"}`}
            label="Sort order"
            value={values.sortOrder}
            onChange={(next) => set("sortOrder", next)}
            error={fieldErrors.sortOrder}
            hint="Lower numbers come first."
          />

          {isNew ? (
            <AdminInput
              id="new-row-id"
              label="Id"
              value={values.id}
              onChange={(next) => {
                setIdTouched(true);
                set("id", next);
              }}
              error={fieldErrors.id}
              hint="Permanent once saved."
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <AdminButton disabled={isPending} onClick={save}>
            {isPending ? "Saving" : isNew ? `Add ${entityLabel}` : "Save"}
          </AdminButton>

          {isNew ? (
            <AdminButton variant="ghost" disabled={isPending} onClick={onDone}>
              Cancel
            </AdminButton>
          ) : (
            <AdminButton
              variant={armed ? "danger" : "ghost"}
              disabled={isPending}
              onClick={() => (armed ? remove() : setArmed(true))}
            >
              {armed ? "Confirm — remove" : "Remove"}
            </AdminButton>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContentRowsEditor({
  rows,
  fields,
  headingField,
  entityLabel,
  emptyMessage,
  onCreate,
  onUpdate,
  onDelete,
}: {
  rows: readonly ContentRow[];
  fields: readonly RowField[];
  /** Which field titles the card and seeds the id while creating. */
  headingField: string;
  /** Singular, lowercase — "timeline entry". Used in button labels. */
  entityLabel: string;
  emptyMessage: string;
  onCreate: SaveAction;
  onUpdate: SaveAction;
  onDelete: SaveAction;
}) {
  const [adding, setAdding] = useState(false);

  const blank: ContentRow = { id: "", sortOrder: 0 };
  for (const field of fields) {
    // A new row is published unless somebody says otherwise; an empty string
    // would read as "false" through the toggle above.
    blank[field.name] = field.kind === "toggle" ? "true" : "";
  }

  return (
    <div className="space-y-5">
      {rows.length === 0 && !adding ? (
        <p className="border border-border px-5 py-10 text-center text-[12px] leading-relaxed text-ivory/35">
          {emptyMessage}
        </p>
      ) : null}

      {rows.map((row) => (
        <RowCard
          key={stringify(row.id)}
          row={row}
          fields={fields}
          isNew={false}
          headingField={headingField}
          entityLabel={entityLabel}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onDone={() => undefined}
        />
      ))}

      {adding ? (
        <RowCard
          row={blank}
          fields={fields}
          isNew
          headingField={headingField}
          entityLabel={entityLabel}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onDone={() => setAdding(false)}
        />
      ) : (
        <AdminButton variant="ghost" onClick={() => setAdding(true)}>
          <Plus size={13} strokeWidth={1.25} />
          Add {entityLabel}
        </AdminButton>
      )}
    </div>
  );
}
