"use client";

import { useEffect, useRef, useState } from "react";

import { AdminButton } from "@/src/components/admin/fields";
import type { PendingNavigation } from "@/src/providers/unsaved-changes-provider";

/**
 * "You have unsaved changes." — §12.1's dialog, in the house's register.
 *
 * Three answers, and the order is deliberate: **Cancel** first because staying
 * is the safe one, **Discard** second, **Save Changes** last and gold, because
 * it is the one somebody almost always wants.
 *
 * Saves **every** dirty editor on the screen, not just one — see the provider's
 * header for why a screen can hold several.
 *
 * ## Save does not navigate on a failed save
 *
 * The button awaits the editor's own save and leaves only when it reports
 * success. A dialog that navigated away from a validation error would take the
 * editor's work *and* the explanation of why it was refused — worse than having
 * no dialog at all. On failure this closes and leaves the form showing its own
 * error, which is where the error already renders.
 *
 * ## A real `<dialog>`
 *
 * `showModal()` gives focus containment, the top layer, and `Escape` for free —
 * all three correctly, which hand-rolled modals in this codebase's past have
 * not. `Escape` is Cancel by definition, so the `cancel` event closes.
 *
 * Focus returns to whatever opened it, which the element remembers by itself.
 */

export default function UnsavedChangesDialog({
  pending,
  onClose,
}: {
  pending: PendingNavigation | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  function discard() {
    const proceed = pending?.proceed;
    onClose();
    proceed?.();
  }

  async function saveThenGo() {
    if (!pending || saving) return;

    setSaving(true);
    let ok = false;

    try {
      ok = await pending.save();
    } finally {
      setSaving(false);
    }

    const proceed = pending.proceed;
    onClose();

    // Only on success. A refused save keeps the editor where the error is.
    if (ok) proceed();
  }

  const busy = saving || (pending?.pending ?? false);

  return (
    <dialog
      ref={ref}
      aria-labelledby="unsaved-title"
      onCancel={(event) => {
        // Escape is Cancel. Prevented and handled here so the close path is one
        // function rather than two that can drift apart.
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[min(92vw,26rem)] border border-gold/25 bg-ivory p-0 text-ground shadow-3 backdrop:bg-ink/55"
    >
      <div className="px-7 py-7">
        <h2
          id="unsaved-title"
          className="font-heading text-[13px] uppercase tracking-[0.2em] text-ground-accent"
        >
          Unsaved changes
        </h2>

        <p className="mt-3 text-[12px] leading-relaxed text-ground-muted">
          You have changes that have not been saved. Would you like to save them
          before leaving?
        </p>

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <AdminButton variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </AdminButton>

          <AdminButton variant="danger" disabled={busy} onClick={discard}>
            Discard Changes
          </AdminButton>

          <AdminButton
            variant="gold"
            disabled={busy}
            onClick={() => void saveThenGo()}
          >
            {busy ? "Saving" : "Save Changes"}
          </AdminButton>
        </div>
      </div>
    </dialog>
  );
}
