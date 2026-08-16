"use client";

/**
 * Archive a product, or publish an article — the two switches that change what
 * the public sees without opening an editor.
 *
 * Confirm-then-act, in two clicks against the same button. A modal would be
 * more ceremony than the action deserves; no confirmation at all would put
 * "remove this from the entire storefront" one stray click away in a table row.
 * The armed state times out, so a button left armed does not stay armed for the
 * next person to reach for it.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setProductArchived } from "@/src/actions/admin/catalog";
import { setArticlePublished } from "@/src/actions/admin/journal";
import type { AdminActionResult } from "@/src/schemas/admin";

/** How long an armed button stays armed. */
const ARM_TIMEOUT_MS = 4_000;

export default function StatusToggle({
  kind,
  slug,
  isOn,
  onLabel,
  offLabel,
  confirmLabel,
}: {
  /** Which action to call — the two share this control, not their endpoints. */
  kind: "product-archive" | "article-publish";
  slug: string;
  /** Current state: live product / published article. */
  isOn: boolean;
  /** What the button offers when the row is on. */
  onLabel: string;
  /** What it offers when the row is off. */
  offLabel: string;
  /** What it says while armed. */
  confirmLabel: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  function run() {
    if (!armed) {
      setArmed(true);
      return;
    }

    setArmed(false);
    setError(null);

    startTransition(async () => {
      const outcome: AdminActionResult =
        kind === "product-archive"
          ? await setProductArchived({ slug, isArchived: isOn })
          : await setArticlePublished({ slug, isPublished: !isOn });

      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }

      router.refresh();
    });
  }

  /* Turning something off is the destructive direction, whichever record it is. */
  const destructive = isOn;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className={`rounded-none border px-4 py-2 font-heading text-[9px] uppercase tracking-[0.2em] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none disabled:opacity-40 ${
          armed
            ? "border-danger bg-danger/10 text-danger"
            : destructive
              ? "border-border text-ivory/40 hover:border-danger/50 hover:text-danger"
              : "border-border text-ivory/40 hover:border-gold/40 hover:text-gold"
        }`}
      >
        {isPending ? "Working…" : armed ? confirmLabel : isOn ? onLabel : offLabel}
      </button>

      {error ? <span className="text-[10px] text-danger">{error}</span> : null}
    </div>
  );
}
