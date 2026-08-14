"use client";

/**
 * The gold switch used by the cookie preferences panel.
 *
 * ## Why a `<button role="switch">`
 *
 * Not a checkbox: the control is styled from the ground up, and a checkbox
 * would need its native appearance suppressed anyway. `role="switch"` with
 * `aria-checked` is what a screen reader announces as "on/off", which is what
 * this is — a checkbox announces "checked", which reads oddly for a setting.
 *
 * ## The knob moves by inset, not transform
 *
 * `translate-x` is not mirrored by `dir`, so an RTL page would slide the knob
 * off the wrong edge — the same trap `Nav.tsx` and `SearchOverlay.tsx` document
 * for their panels. Animating `inset-inline-start` is direction-aware by
 * construction, so nothing here needs an RTL special case.
 */

export interface ConsentToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Locked categories render as on and refuse interaction. */
  disabled?: boolean;
  /** Id of the element naming this control. */
  labelledBy: string;
}

export default function ConsentToggle({
  checked,
  onChange,
  disabled = false,
  labelledBy,
}: ConsentToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative h-6 w-11 shrink-0 rounded-full border",
        "transition-colors duration-500 ease-luxury-bezier",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/60",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        checked ? "border-gold/60 bg-gold/25" : "border-white/12 bg-white/6",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "absolute top-1/2 size-4 -translate-y-1/2 rounded-full",
          "transition-[inset-inline-start,background-color] duration-500 ease-luxury-bezier",
          checked ? "bg-gold" : "bg-ivory/40",
        ].join(" ")}
        style={{ insetInlineStart: checked ? "calc(100% - 1.25rem)" : "0.25rem" }}
      />
    </button>
  );
}
