"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { interpolate } from "@/src/lib/i18n/interpolate";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * Puts a voucher code on the clipboard and says so.
 *
 * The confirmation is `aria-live="polite"` rather than a toast: the customer
 * who most needs to be told the copy worked is the one who cannot see the
 * button change, and a message rendered beside the code reaches them without a
 * notification system existing yet.
 *
 * Disabled for any voucher that is not available. A code that would be refused
 * at checkout should not be one keystroke from being pasted there — the panel
 * refusing to hand it over is the clearest way to say it will not work.
 *
 * `navigator.clipboard` is unavailable on an insecure origin and can be refused
 * by permission, so the failure path is real and gets its own message telling
 * the customer to select the code by hand.
 */

/** How long the confirmation stands before the button returns to rest. */
const CONFIRM_MS = 2400;

export default function CopyCodeButton({
  code,
  disabled = false,
}: {
  code: string;
  disabled?: boolean;
}) {
  const dict = useDictionary().account.vouchers.list;
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A customer who copies and navigates away must not leave a timer holding a
  // setState on an unmounted component.
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  async function copy() {
    if (timerRef.current !== null) clearTimeout(timerRef.current);

    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }

    timerRef.current = setTimeout(() => setState("idle"), CONFIRM_MS);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => void copy()}
        aria-label={interpolate(dict.copyLabel, { code })}
        className={[
          "inline-flex items-center justify-center gap-2 border px-5 py-3",
          "font-heading text-[10px] uppercase tracking-[0.2em]",
          "transition-all duration-500 ease-luxury-bezier",
          disabled
            ? "cursor-not-allowed border-ground-border text-ground-muted/60"
            : "cursor-pointer border-ground-accent/40 text-ground-accent hover:border-gold hover:bg-gold/8",
        ].join(" ")}
      >
        {state === "copied" ? (
          <Check size={13} strokeWidth={1.25} aria-hidden="true" />
        ) : (
          <Copy size={13} strokeWidth={1.25} aria-hidden="true" />
        )}
        {dict.copy}
      </button>

      {/*
       * The live region is always in the tree, empty at rest. One that is
       * mounted at the moment it fills is frequently missed by screen readers.
       */}
      <p
        aria-live="polite"
        className={[
          "min-h-4 text-[11px] tracking-[0.04em]",
          state === "failed" ? "text-danger" : "text-ground-accent/70",
        ].join(" ")}
      >
        {state === "copied" ? dict.copied : null}
        {state === "failed" ? dict.copyFailed : null}
      </p>
    </div>
  );
}
