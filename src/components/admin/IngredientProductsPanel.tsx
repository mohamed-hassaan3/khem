"use client";

/**
 * Which perfumes a material is printed on.
 *
 * The `"IngredientUsage"` junction table, as a set of toggles rather than as
 * rows. That is how the question actually gets asked at the desk — "which of
 * these is oud in?" — and it is why `setIngredientProducts` takes the whole set
 * and diffs it: the same submission twice leaves the same rows, and no
 * intermediate state exists in which the material is linked to nothing.
 *
 * The display name stored against each link is snapshotted from `"Product"` on
 * the server, never sent from here. A form that could name its own product
 * could print a label for something else entirely.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setIngredientProducts } from "@/src/actions/admin/content";
import { AdminButton, AdminNotice } from "@/src/components/admin/fields";
import type { AdminActionResult } from "@/src/schemas/admin";

export interface ProductOption {
  slug: string;
  name: string;
  collectionSlug: string;
}

export default function IngredientProductsPanel({
  ingredientId,
  products,
  selected,
}: {
  ingredientId: string;
  /** Every live product, for the picker. */
  products: readonly ProductOption[];
  /** The slugs currently linked. */
  selected: readonly string[];
}) {
  const router = useRouter();

  const [chosen, setChosen] = useState<string[]>([...selected]);
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Compared as sets so re-ordering does not read as an unsaved change.
  const dirty =
    chosen.length !== selected.length ||
    chosen.some((slug) => !selected.includes(slug));

  function toggle(slug: string) {
    setResult(null);
    setChosen((current) =>
      current.includes(slug)
        ? current.filter((value) => value !== slug)
        : [...current, slug],
    );
  }

  function save() {
    setResult(null);

    startTransition(async () => {
      const outcome = await setIngredientProducts({
        ingredientId,
        productSlugs: chosen,
      });

      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      {products.length === 0 ? (
        <p className="border border-ground-border px-5 py-10 text-center text-[12px] leading-relaxed text-ground-muted">
          There are no live products to link this material to.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {products.map((product) => {
            const active = chosen.includes(product.slug);

            return (
              <button
                key={product.slug}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(product.slug)}
                title={product.collectionSlug}
                className={`border px-4 py-2 text-[11px] tracking-wide transition-colors duration-300 ${
                  active
                    ? "border-gold/50 bg-gold/10 text-ground-accent"
                    : "border-ground-border text-ground-muted hover:border-gold/30 hover:text-ground"
                }`}
              >
                {product.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <AdminButton disabled={isPending || !dirty} onClick={save}>
          {isPending
            ? "Saving"
            : dirty
              ? "Save perfumes"
              : "No unsaved changes"}
        </AdminButton>

        <span className="text-[11px] tracking-wide text-ground-muted">
          {chosen.length === 0
            ? "Printed on no perfume"
            : `Printed on ${chosen.length} perfume${chosen.length === 1 ? "" : "s"}`}
        </span>
      </div>
    </div>
  );
}
