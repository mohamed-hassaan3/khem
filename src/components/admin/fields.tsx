"use client";

/**
 * Form primitives for the dashboard.
 *
 * The house look, applied to a working surface: obsidian fills, a gold hairline
 * on focus, uppercase `tracking-[0.2em]` labels in the heading face, and no
 * webkit focus ring anywhere. What it is *not* is the storefront's typography —
 * an editor comparing twenty rows needs density and a legible sans, not
 * editorial letter-spacing on every value.
 *
 * These deliberately mirror the class constants in
 * `src/components/contact/ContactForm.tsx` rather than importing them: that
 * form is customer-facing copy inside a marketing page, this is a tool, and
 * coupling the two would mean a change to one surface silently restyling the
 * other. The shapes agree today because the design system does.
 *
 * Everything here is presentational and uncontrolled-by-design: state lives in
 * the parent form, which is also the thing that knows how to submit it.
 */

import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";

export const FIELD_CLASS =
  "w-full border border-border bg-ivory/3 px-4 py-3 text-[13px] tracking-wide text-ivory transition-colors duration-300 placeholder:text-ivory/25 focus:border-gold/40 focus:outline-none disabled:opacity-40";

export const LABEL_CLASS =
  "mb-2 block font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35";

export const ERROR_CLASS = "mt-2 text-[11px] tracking-wide text-danger";

export const HINT_CLASS = "mt-2 text-[11px] leading-relaxed tracking-wide text-ivory/30";

interface FieldShellProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

/** Label, control, hint, error — the one place that vertical rhythm is decided. */
export function AdminField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
}: FieldShellProps) {
  return (
    <div>
      <label className={LABEL_CLASS} htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-gold/60"> *</span> : null}
      </label>
      {children}
      {hint ? <p className={HINT_CLASS}>{hint}</p> : null}
      {error ? (
        <p className={ERROR_CLASS} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface TextProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  /**
   * `email` gives a phone keyboard the @ key; the validation is still Zod's.
   *
   * `datetime-local` is here for scheduling a campaign — the one field in this
   * dashboard that needs an hour as well as a day.
   */
  type?: "text" | "number" | "date" | "datetime-local" | "url" | "email";
  step?: string;
  min?: number;
}

export function AdminInput({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  required,
  readOnly = false,
  type = "text",
  step,
  min,
}: TextProps) {
  return (
    <AdminField label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <input
        id={id}
        type={type}
        step={step}
        min={min}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        className={`${FIELD_CLASS} ${readOnly ? "cursor-not-allowed text-ivory/40" : ""}`}
      />
    </AdminField>
  );
}

export function AdminTextarea({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  required,
  rows = 4,
}: TextProps & { rows?: number }) {
  return (
    <AdminField label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        className={`${FIELD_CLASS} resize-y leading-relaxed`}
      />
    </AdminField>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function AdminSelect({
  id,
  label,
  value,
  onChange,
  options,
  error,
  hint,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <AdminField label={label} htmlFor={id} error={error} hint={hint} required={required}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        className={`${FIELD_CLASS} appearance-none bg-surface`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-surface">
            {option.label}
          </option>
        ))}
      </select>
    </AdminField>
  );
}

/**
 * A boolean, as a switch rather than a checkbox.
 *
 * Hit target and label are one control: these flags decide whether something is
 * on the storefront, and a stray click on a 13px checkbox is not a decision
 * anyone meant to make.
 */
export function AdminToggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-4 border border-border bg-ivory/3 px-4 py-3 text-start transition-colors duration-300 hover:border-gold/30 focus:border-gold/40 focus:outline-none"
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-4 w-8 shrink-0 items-center rounded-full border transition-colors duration-300 ${
          checked ? "border-gold/50 bg-gold/25" : "border-border bg-ivory/5"
        }`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            checked ? "translate-x-4 bg-gold" : "translate-x-0.5 bg-ivory/40"
          }`}
        />
      </span>

      <span className="min-w-0">
        <span className="block font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/60">
          {label}
        </span>
        {description ? (
          <span className="mt-1 block text-[11px] leading-relaxed text-ivory/30">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * A `text[]` column, as a list of rows.
 *
 * Order is load-bearing for fragrance notes — the card grids render
 * `topNotes[1]` — so this edits position as well as content, and never sorts
 * behind the editor's back. Blank rows are dropped by the schema, so an unused
 * spare row is not an error.
 */
export function AdminStringList({
  label,
  values,
  onChange,
  error,
  hint,
  placeholder,
  addLabel = "Add",
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  addLabel?: string;
}) {
  return (
    <AdminField label={label} error={error} hint={hint}>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex gap-2">
            <input
              value={value}
              placeholder={placeholder}
              onChange={(event) => {
                const next = [...values];
                next[index] = event.target.value;
                onChange(next);
              }}
              className={FIELD_CLASS}
            />
            <button
              type="button"
              aria-label={`Remove ${label} entry ${index + 1}`}
              onClick={() => onChange(values.filter((_, at) => at !== index))}
              className="shrink-0 border border-border px-3 text-ivory/40 transition-colors duration-300 hover:border-danger/50 hover:text-danger focus:outline-none"
            >
              <X size={14} strokeWidth={1.25} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => onChange([...values, ""])}
          className="inline-flex items-center gap-2 border border-border px-4 py-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/45 transition-colors duration-300 hover:border-gold/40 hover:text-gold focus:outline-none"
        >
          <Plus size={13} strokeWidth={1.25} />
          {addLabel}
        </button>
      </div>
    </AdminField>
  );
}

/** The house button, in the three roles this surface needs. */
export function AdminButton({
  children,
  type = "button",
  variant = "gold",
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  type?: "button" | "submit";
  variant?: "gold" | "ghost" | "danger";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const variants = {
    gold: "border-gold/40 text-gold hover:border-gold hover:bg-gold/10",
    ghost: "border-border text-ivory/55 hover:border-gold/30 hover:text-gold",
    danger: "border-danger/40 text-danger hover:border-danger hover:bg-danger/10",
  } as const;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-none border px-6 py-3 font-heading text-[10px] uppercase tracking-[0.2em] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none disabled:pointer-events-none disabled:opacity-40 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

/** Result banner shown above a form after a save attempt. */
export function AdminNotice({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <p
      role="status"
      className={`border px-4 py-3 text-[12px] tracking-wide ${
        tone === "success"
          ? "border-gold/30 bg-gold/5 text-champagne"
          : "border-danger/40 bg-danger/5 text-danger"
      }`}
    >
      {children}
    </p>
  );
}
