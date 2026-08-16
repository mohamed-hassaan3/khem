"use client";

/**
 * Delete a collection — the only true delete in the dashboard.
 *
 * It exists here and nowhere else because a collection is the one record with
 * no visibility switch: products archive, articles unpublish, and both keep
 * their history. An empty collection has no history to keep.
 *
 * The button is closed entirely when products still point at the collection.
 * That is not the safeguard — the foreign key is, and the action surfaces its
 * refusal as a sentence — it is what stops an editor being offered an operation
 * that cannot succeed.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteCollection } from "@/src/actions/admin/catalog";
import { AdminButton } from "@/src/components/admin/fields";
import { localizePath, type Locale } from "@/src/lib/i18n/config";

export default function DeleteCollectionButton({
  slug,
  productCount,
  locale,
}: {
  slug: string;
  productCount: number;
  locale: Locale;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (productCount > 0) {
    return (
      <p className="text-[11px] leading-relaxed text-ivory/30">
        This collection holds {productCount} product{productCount === 1 ? "" : "s"}.
        Move or archive them before it can be deleted.
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
      const outcome = await deleteCollection(slug);

      if (!outcome.ok) {
        setArmed(false);
        setError(outcome.message);
        return;
      }

      router.push(localizePath(locale, "/admin/collections"));
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
            : "Delete collection"}
      </AdminButton>

      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
