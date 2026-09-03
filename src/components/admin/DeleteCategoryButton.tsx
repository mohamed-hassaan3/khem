"use client";

/**
 * Delete a category.
 *
 * The twin of `<DeleteCollectionButton>`, one level up, with the same posture:
 * the button is closed entirely while collections still stand under the
 * category. That is not the safeguard — `"Collection"."categorySlug"` is a real
 * foreign key and the action surfaces its refusal as a sentence — it is what
 * stops an editor being offered an operation that cannot succeed.
 *
 * Unlike a collection, a category *does* have a visibility switch, so the copy
 * here points at it: withdrawing a season is almost always the intended act,
 * and it is reversible.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteCategory } from "@/src/actions/admin/catalog";
import { AdminButton } from "@/src/components/admin/fields";
import { localizePath, type Locale } from "@/src/lib/i18n/config";

export default function DeleteCategoryButton({
  slug,
  collectionCount,
  locale,
}: {
  slug: string;
  collectionCount: number;
  locale: Locale;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (collectionCount > 0) {
    return (
      <p className="text-[11px] leading-relaxed text-ground-muted">
        {collectionCount} collection{collectionCount === 1 ? "" : "s"} stand
        {collectionCount === 1 ? "s" : ""} under this category. Move them
        elsewhere first, or switch the category off above — that withdraws it
        from the storefront without losing anything.
      </p>
    );
  }

  function run() {
    if (!armed) {
      setArmed(true);
      return;
    }

    setError(null);

    startTransition(async () => {
      const outcome = await deleteCategory(slug);

      if (!outcome.ok) {
        setArmed(false);
        setError(outcome.message);
        return;
      }

      router.push(localizePath(locale, "/admin/categories"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <AdminButton variant="danger" onClick={run} disabled={isPending}>
        {isPending
          ? "Deleting…"
          : armed
            ? "Click again to delete permanently"
            : "Delete category"}
      </AdminButton>

      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
