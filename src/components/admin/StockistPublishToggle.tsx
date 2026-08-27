"use client";

/**
 * Show or hide one location, from the table row.
 *
 * Confirm-then-act in two clicks against the same button, and the armed state
 * times out — the same pattern and the same reasoning as `StatusToggle`, which
 * this deliberately does not extend: that component is hard-wired to two
 * actions by a `kind` prop, and adding a third would grow a switch that already
 * couples two unrelated screens. One small component per switch is the cheaper
 * shape.
 *
 * Hiding is the reversible half of removing. It takes the boutique off
 * `/stockists` while the row, both languages of its copy and its photograph all
 * survive — which is why this is the control offered in the table and deletion
 * lives inside the editor.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setStockistPublished } from "@/src/actions/admin/directory";

/** How long an armed button stays armed. */
const ARM_TIMEOUT_MS = 4_000;

export default function StockistPublishToggle({
  id,
  isPublished,
}: {
  id: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  // A button left armed must not stay armed for whoever reaches for it next.
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  function act() {
    setFailed(false);

    startTransition(async () => {
      const outcome = await setStockistPublished({
        id,
        isPublished: !isPublished,
      });

      setArmed(false);

      if (!outcome.ok) {
        setFailed(true);
        return;
      }

      // The row re-renders from the server, so the button's label follows the
      // stored value rather than an optimistic guess that could disagree.
      router.refresh();
    });
  }

  if (failed) {
    return (
      <span className="font-heading text-[9px] uppercase tracking-[0.2em] text-danger">
        Failed — reload
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => (armed ? act() : setArmed(true))}
      aria-label={
        armed
          ? `Confirm — ${isPublished ? "hide" : "publish"} this location`
          : isPublished
            ? "Hide this location from the public directory"
            : "Publish this location to the public directory"
      }
      className={`inline-block border px-3 py-1 font-heading text-[9px] uppercase tracking-[0.2em] transition-colors duration-300 disabled:opacity-40 disabled:pointer-events-none ${
        armed
          ? "border-danger/50 text-danger"
          : isPublished
            ? "border-success/40 text-success hover:border-gold/40 hover:text-gold"
            : "border-border text-ivory/30 hover:border-gold/40 hover:text-gold"
      }`}
    >
      {isPending
        ? "Saving"
        : armed
          ? isPublished
            ? "Confirm hide"
            : "Confirm show"
          : isPublished
            ? "Live"
            : "Hidden"}
    </button>
  );
}
