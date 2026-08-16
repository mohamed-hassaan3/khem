"use client";

/**
 * The product gallery.
 *
 * Edited as a whole and submitted as a whole — see `saveProductImages` in
 * `actions/admin/catalog.ts` for why. The two invariants that matter are made
 * structural here rather than left to the editor's discipline:
 *
 * - **Exactly one primary.** Choosing a primary is a radio, not a checkbox, so
 *   two can never be selected. The database's partial unique index is the
 *   backstop, not the user interface.
 * - **Order is position.** Rows move with the arrows and `sortOrder` is
 *   assigned from the final array on the server, so what the list shows is what
 *   the gallery becomes.
 *
 * A thumbnail is rendered with a plain `<img>`, deliberately: `next/image`
 * throws on an unconfigured host, and this is the one screen whose job includes
 * showing an editor that the URL they pasted does not work. The schema still
 * refuses to save such a URL.
 */

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveProductImages } from "@/src/actions/admin/catalog";
import {
  AdminButton,
  AdminNotice,
  ERROR_CLASS,
  FIELD_CLASS,
  LABEL_CLASS,
} from "@/src/components/admin/fields";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminProductImage } from "@/src/schemas/db/admin";

interface Row {
  /** `null` for a row added in this session; the server mints an id. */
  id: string | null;
  url: string;
  alt: string;
  isPrimary: boolean;
}

function toRows(images: readonly AdminProductImage[]): Row[] {
  return images.map((image) => ({
    id: image.id,
    url: image.url,
    alt: image.alt,
    isPrimary: image.isPrimary,
  }));
}

export default function ProductImageEditor({
  productSlug,
  images,
}: {
  productSlug: string;
  images: readonly AdminProductImage[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(toRows(images));
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function update(index: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row, at) => (at === index ? { ...row, ...patch } : row)),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    setRows((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function setPrimary(index: number) {
    setRows((current) =>
      current.map((row, at) => ({ ...row, isPrimary: at === index })),
    );
  }

  function submit() {
    setResult(null);

    startTransition(async () => {
      const outcome = await saveProductImages({ productSlug, images: rows });
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>{result.message}</AdminNotice>
      ) : null}

      {rows.length === 0 ? (
        <p className="border border-border px-6 py-10 text-center text-[12px] tracking-wide text-ivory/35">
          No photographs yet. The grid will show a placeholder until one is added.
        </p>
      ) : null}

      <ul className="space-y-4">
        {rows.map((row, index) => (
          <li key={row.id ?? `new-${index}`} className="border border-border p-4">
            <div className="flex gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={row.url || undefined}
                alt=""
                className="h-24 w-20 shrink-0 border border-border object-cover"
              />

              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <label className={LABEL_CLASS} htmlFor={`image-url-${index}`}>
                    Image URL
                  </label>
                  <input
                    id={`image-url-${index}`}
                    value={row.url}
                    onChange={(event) => update(index, { url: event.target.value })}
                    className={FIELD_CLASS}
                  />
                  {fieldErrors[`images.${index}.url`] ? (
                    <p className={ERROR_CLASS}>{fieldErrors[`images.${index}.url`]}</p>
                  ) : null}
                </div>

                <div>
                  <label className={LABEL_CLASS} htmlFor={`image-alt-${index}`}>
                    Alt text
                  </label>
                  <input
                    id={`image-alt-${index}`}
                    value={row.alt}
                    onChange={(event) => update(index, { alt: event.target.value })}
                    className={FIELD_CLASS}
                  />
                  {fieldErrors[`images.${index}.alt`] ? (
                    <p className={ERROR_CLASS}>{fieldErrors[`images.${index}.alt`]}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-ivory/45">
                    <input
                      type="radio"
                      name="primary-image"
                      checked={row.isPrimary}
                      onChange={() => setPrimary(index)}
                      className="accent-[color:var(--color-gold)]"
                    />
                    Primary
                  </label>

                  <div className="ms-auto flex gap-2">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      className="border border-border p-2 text-ivory/40 transition-colors duration-300 hover:border-gold/40 hover:text-gold disabled:opacity-25"
                    >
                      <ArrowUp size={13} strokeWidth={1.25} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === rows.length - 1}
                      onClick={() => move(index, 1)}
                      className="border border-border p-2 text-ivory/40 transition-colors duration-300 hover:border-gold/40 hover:text-gold disabled:opacity-25"
                    >
                      <ArrowDown size={13} strokeWidth={1.25} />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
                      className="border border-border p-2 text-ivory/40 transition-colors duration-300 hover:border-danger/50 hover:text-danger"
                    >
                      <X size={13} strokeWidth={1.25} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <AdminButton
          variant="ghost"
          onClick={() =>
            setRows((current) => [
              ...current,
              { id: null, url: "", alt: "", isPrimary: current.length === 0 },
            ])
          }
        >
          <Plus size={13} strokeWidth={1.25} />
          Add image
        </AdminButton>

        <AdminButton onClick={submit} disabled={isPending}>
          {isPending ? "Saving…" : "Save gallery"}
        </AdminButton>
      </div>
    </div>
  );
}
