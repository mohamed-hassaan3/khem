"use client";

import { Check, X } from "lucide-react";

import { useAdminToast } from "@/src/providers/admin-toast-provider";

/**
 * Where the confirmations appear.
 *
 * Bottom-right, and below the sticky header rather than over it: the header
 * holds the rail toggle and the bell, and a notice that covered either would be
 * a notice that took a control away for four seconds.
 *
 * `aria-live="polite"` on a region that is always mounted — a live region added
 * to the DOM at the same moment it fills is frequently missed entirely.
 *
 * Each one is dismissible. The timer is a courtesy, not a decision: somebody who
 * has read it should be able to clear it and get on.
 */
export default function AdminToaster() {
  const { toasts, dismiss } = useAdminToast();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 end-6 z-1002 flex w-[min(88vw,22rem)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 border border-gold/30 bg-ivory px-4 py-3 shadow-3"
        >
          <Check
            size={14}
            strokeWidth={1.5}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-ground-accent"
          />

          <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-ground">
            {toast.message}
          </p>

          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
            className="-me-1 shrink-0 cursor-pointer p-1 text-ground-muted transition-colors duration-300 hover:text-ground-accent"
          >
            <X size={13} strokeWidth={1.5} />
          </button>
        </div>
      ))}
    </div>
  );
}
