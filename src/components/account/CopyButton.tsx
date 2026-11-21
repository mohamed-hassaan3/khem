"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Copy a code to the clipboard, and say so.
 *
 * One control for the two codes a customer copies out of their account — a
 * voucher code and a parcel's tracking number — replacing the voucher-only
 * `CopyCodeButton`.
 *
 * - `solid` — the voucher ticket's ink button with a visible label.
 * - `icon`  — a 40px square beside a tracking number; the label is its
 *   `aria-label`, and the result is announced through the live region.
 *
 * The glyph crossfades from Copy to Check for 2.4s. The announcement lives in
 * a visually hidden `aria-live` region so a screen reader hears "Copied"
 * without the layout shifting under a sighted visitor's thumb.
 */
const CONFIRM_MS = 2400;

export interface CopyButtonProps {
  value: string;
  /** Accessible name, e.g. "Copy voucher code WELCOME10". */
  label: string;
  /** `solid` only: the visible text. */
  text?: string;
  copiedText: string;
  failedText: string;
  variant?: "solid" | "icon";
  disabled?: boolean;
}

export default function CopyButton({
  value,
  label,
  text,
  copiedText,
  failedText,
  variant = "solid",
  disabled = false,
}: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  async function copy() {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    timerRef.current = setTimeout(() => setState("idle"), CONFIRM_MS);
  }

  const glyph = (
    <span className="relative grid size-3.5 place-items-center" aria-hidden="true">
      <Copy
        size={14}
        strokeWidth={1.25}
        className={`absolute transition-[opacity,transform] duration-300 ease-luxury-bezier ${
          state === "copied" ? "scale-75 opacity-0" : "scale-100 opacity-100"
        }`}
      />
      <Check
        size={14}
        strokeWidth={1.5}
        className={`absolute transition-[opacity,transform] duration-300 ease-luxury-bezier ${
          state === "copied" ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      />
    </span>
  );

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => void copy()}
        aria-label={label}
        className={
          variant === "icon"
            ? "grid size-10 shrink-0 cursor-pointer place-items-center rounded-md border border-ground-border bg-transparent text-ground transition-colors duration-300 ease-luxury-bezier hover:border-ground-accent hover:text-ground-accent disabled:cursor-not-allowed disabled:opacity-40"
            : "inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-ground bg-ground px-3.5 font-heading text-[10px] uppercase tracking-[0.16em] text-ground-bg transition-colors duration-300 ease-luxury-bezier hover:border-ground-accent hover:bg-ground-accent disabled:cursor-not-allowed disabled:opacity-40 rtl:text-[12px] rtl:normal-case rtl:tracking-normal"
        }
      >
        {glyph}
        {variant === "solid" ? (state === "copied" ? copiedText : text) : null}
      </button>

      <span aria-live="polite" className="sr-only">
        {state === "copied" ? copiedText : state === "failed" ? failedText : ""}
      </span>
    </>
  );
}
