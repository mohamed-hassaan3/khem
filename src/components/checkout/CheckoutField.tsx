"use client";

/**
 * The checkout form's two primitives: a numbered section, and a field.
 *
 * Written once here rather than repeated across the contact and delivery steps,
 * because a checkout where the phone field looks half a shade different from
 * the one above it is a checkout that looks unfinished — and this is the screen
 * where a visitor decides whether to hand over a card number.
 *
 * ## The field treatment
 *
 * AGENTS.md §3.2: transparent fill, a thin rule that turns gold on focus, an
 * uppercase gold label, and a glow instead of the webkit ring. The rule is a
 * `border-b` rather than a full box — a form of eleven boxed inputs reads as an
 * admin panel, and eleven hairlines reads as a ledger.
 *
 * ## RTL
 *
 * Logical properties throughout (`ps-`, `text-start`), and no `left`/`right`
 * anywhere. Arabic is a first-class locale on this page, not an afterthought:
 * every label, every error, and the section numerals all mirror.
 */

import { Check } from "lucide-react";
import type { ReactNode } from "react";

export interface CheckoutSectionProps {
  /** `01`, `02`, `03` — the position, not a step the visitor must complete. */
  index: string;
  title: string;
  /** Renders the gold tick once every field in the section is valid. */
  complete?: boolean;
  children: ReactNode;
}

/**
 * One titled block of the form.
 *
 * The three sections are stacked on one page rather than being a wizard. A
 * boutique does not make somebody click "next" three times to spend money, and
 * a single scroll lets them correct the address after seeing the total.
 */
export function CheckoutSection({
  index,
  title,
  complete = false,
  children,
}: CheckoutSectionProps) {
  return (
    <section className="border-b border-border py-10 first:pt-0 last:border-b-0 lg:py-12">
      <header className="mb-8 flex items-center gap-4">
        <span
          aria-hidden="true"
          className="font-heading text-[11px] tabular-nums tracking-[0.2em] text-gold/40"
        >
          {index}
        </span>

        <h2 className="font-heading text-sm font-normal uppercase tracking-[0.15em] text-ivory">
          {title}
        </h2>

        {/* A quiet acknowledgement, not a progress bar. It appears; nothing
            moves when it does, because the icon sits in a fixed-width slot. */}
        <span className="ms-auto flex h-4 w-4 items-center justify-center">
          {complete ? (
            <Check
              size={14}
              strokeWidth={1.25}
              aria-hidden="true"
              className="text-gold"
            />
          ) : null}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-x-4 md:gap-x-6 gap-y-4 md:gap-y-7 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

export interface CheckoutFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
  placeholder?: string;
  /** Resolved error text, already translated. `undefined` when valid. */
  error?: string;
  /** A quiet line under the field — why we ask for a phone number. */
  hint?: string;
  /** Full width in the two-column grid. */
  wide?: boolean;
  autoComplete?: string;
  /** Renders a `<textarea>` instead. Used once, for delivery instructions. */
  multiline?: boolean;
  required?: boolean;
}

const FIELD_CLASS =
  "w-full border-0 border-b border-border bg-transparent px-0 py-3 text-[14px] tracking-wide text-ivory " +
  "transition-[border-color,box-shadow] duration-300 ease-out " +
  "placeholder:text-ivory/20 " +
  "hover:border-gold/40 " +
  "focus:border-gold focus:shadow-[0_1px_0_0_rgba(200,169,106,0.35)] focus:outline-none " +
  "aria-[invalid=true]:border-danger";

export function CheckoutField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  hint,
  wide = false,
  autoComplete,
  multiline = false,
  required = false,
}: CheckoutFieldProps) {
  // Wired to `aria-describedby` so a screen reader hears the error and the
  // hint, rather than only sighted users seeing them.
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label
        htmlFor={id}
        className="mb-2 block font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70"
      >
        {label}
        {/* Optional fields say so in their placeholder; a sea of asterisks on
            a nine-field form is noise, so only the exceptions are marked. */}
      </label>

      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={3}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${FIELD_CLASS} resize-none`}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={FIELD_CLASS}
        />
      )}

      {error ? (
        <p id={errorId} className="mt-2 text-[11px] tracking-wide text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-2 text-[11px] leading-relaxed text-ivory/25">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
