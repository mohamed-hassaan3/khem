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

import { Check, ChevronDown } from "lucide-react";
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
    <section className="border-b border-ground-border py-6 last:border-b-0 lg:py-12 lg:first:pt-0">
      {/*
        Stage 2: the step number in a 22px circle, filled once the section is
        complete. The tick it replaces said the same thing in a second place.
        `complete` is visual only; the schema decides validity on the server.
      */}
      <header className="mb-4 flex items-center gap-2.5 lg:mb-8">
        <span
          aria-hidden="true"
          className={`grid size-5.5 shrink-0 place-items-center rounded-full border text-[11px] tabular-nums transition-colors duration-500 ease-luxury-bezier ${
            complete
              ? "border-ground-accent bg-ground-accent text-ivory"
              : "border-ground-border text-ground-muted"
          }`}
        >
          {complete ? (
            <Check size={12} strokeWidth={2} aria-hidden="true" />
          ) : (
            Number(index)
          )}
        </span>
        <h2 className="font-heading text-base font-normal tracking-[0.04em] text-ground lg:text-sm lg:uppercase lg:tracking-[0.15em]">
          {title}
        </h2>
      </header>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2 md:gap-x-6 md:gap-y-7">
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

/*
 * The checkout keeps its underline shape — a rule under the text rather than a
 * box — because a column of boxed fields is the visual register of a form, and
 * this one is meant to read as a series of statements. That is a composition,
 * not drift, so it survives as a modifier on the shared field.
 *
 * The invalid state is no longer declared here: `.field[aria-invalid="true"]`
 * covers it for every field on the site.
 */
// Boxed, 48px, white on the ivory page: the Stage 2 checkout field (was an underline).
const FIELD_CLASS = "field min-h-12 bg-white hover:border-ground-accent/40";

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
        className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-ground-muted"
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
        <p id={hintId} className="mt-2 text-[11px] leading-relaxed text-ground-muted/70">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface CheckoutSelectOption {
  value: string;
  label: string;
}

export interface CheckoutSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly CheckoutSelectOption[];
  /**
   * Further options under a labelled `<optgroup>`, after `options`. Phones
   * show the label as a section header in the native picker.
   */
  group?: { label: string; options: readonly CheckoutSelectOption[] };
  /** Resolved error text, already translated. `undefined` when valid. */
  error?: string;
  /** A quiet line under the field — where the value came from. */
  hint?: string;
  /** Full width in the two-column grid. */
  wide?: boolean;
  autoComplete?: string;
}

/**
 * The field treatment, as a chooser.
 *
 * A native `<select>` rather than a custom listbox, and that is a decision
 * rather than a shortcut. A list of countries is exactly the case where the
 * platform wins: a phone renders it as its own wheel, a desktop
 * browser lets somebody type "eg" to jump, keyboard and screen-reader behaviour
 * are correct without a line of code, and none of that has to be re-earned.
 *
 * What it costs is the option list's own styling, which belongs to the OS. So
 * the *closed* control is dressed to match `<CheckoutField>` exactly —
 * `appearance-none`, the same hairline, the same gold focus glow — and the
 * chevron is drawn on top with the field's own icon weight. The open list looks
 * like the operating system, which is what a visitor expects it to look like.
 *
 * `bg-ivory` on the options is load-bearing on the desktop browsers that do
 * honour it: without it a dark page renders black text on a black list.
 */
export function CheckoutSelect({
  id,
  label,
  value,
  onChange,
  options,
  group,
  error,
  hint,
  wide = false,
  autoComplete,
}: CheckoutSelectProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-ground-muted"
      >
        {label}
      </label>

      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${FIELD_CLASS} cursor-pointer appearance-none pe-9`}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-ivory text-ink"
            >
              {option.label}
            </option>
          ))}

          {group ? (
            <optgroup label={group.label} className="bg-ivory text-ink">
              {group.options.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-ivory text-ink"
                >
                  {option.label}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>

        {/* Decorative: the control it belongs to is already labelled, and a
            pointer-transparent icon keeps the whole field clickable. */}
        <ChevronDown
          size={14}
          strokeWidth={1.25}
          aria-hidden="true"
          className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-ground-muted"
        />
      </div>

      {error ? (
        <p id={errorId} className="mt-2 text-[11px] tracking-wide text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-2 text-[11px] leading-relaxed text-ground-muted/70">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
