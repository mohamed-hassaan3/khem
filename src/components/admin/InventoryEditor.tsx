"use client";

/**
 * Setting a product's stock from the inventory table.
 *
 * An absolute count, not a delta: this is the control used after counting the
 * shelf, and on a page left open while sales came in "set it to 4" stays
 * correct where "subtract 1" would double-apply.
 *
 * Save is explicit and only offered once the number has actually changed —
 * a stock field that wrote on every keystroke would fire a request per digit,
 * and `4` typed over `40` passes through `4` on its way to `41`.
 *
 * The confirmation is deliberately quiet and short-lived: an editor correcting
 * twenty rows should get an acknowledgement, not twenty banners.
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { adjustInventory } from "@/src/actions/admin/inventory";
import { FIELD_CLASS } from "@/src/components/admin/fields";

const CONFIRMATION_MS = 2_500;

export default function InventoryEditor({
  slug,
  inventory,
}: {
  slug: string;
  inventory: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(inventory));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // A server refresh brings a new count — after a sale, or after somebody else
  // corrected it — and the input must follow rather than keep showing a figure
  // that is no longer true.
  //
  // Adjusted during render rather than in an effect: React re-runs this
  // component with the new prop and the corrected input in one pass, where an
  // effect would paint the stale number first and then replace it.
  const [serverValue, setServerValue] = useState(inventory);
  if (serverValue !== inventory) {
    setServerValue(inventory);
    setValue(String(inventory));
  }

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), CONFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  const changed = value.trim() !== String(inventory);

  function save() {
    setError(null);

    startTransition(async () => {
      const outcome = await adjustInventory({ slug, inventory: value });

      if (!outcome.ok) {
        setError(outcome.fieldErrors?.inventory ?? outcome.message);
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`stock-${slug}`}>
        Stock for {slug}
      </label>

      <input
        id={`stock-${slug}`}
        type="number"
        min={0}
        value={value}
        disabled={isPending}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (changed) save();
          }
        }}
        className={`${FIELD_CLASS} w-24 px-3 py-2 text-[12px]`}
      />

      <button
        type="button"
        onClick={save}
        disabled={!changed || isPending}
        className="rounded-none border border-ground-border px-3 py-2 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-muted transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-gold/40 hover:text-ground-accent disabled:pointer-events-none disabled:opacity-25"
      >
        {isPending ? "…" : saved && !changed ? "Saved" : "Save"}
      </button>

      {error ? <span className="text-[10px] text-danger">{error}</span> : null}
    </div>
  );
}
