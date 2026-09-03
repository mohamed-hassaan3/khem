"use client";

/**
 * Create or edit a category — the shelf a collection stands on.
 *
 * The twin of `<CollectionForm>`, one level up, and deliberately shorter: a
 * category has no card crop and no home-page tile, because nothing renders one.
 * What it has that a collection does not is `kind`, which is now authored here
 * and here only — every collection beneath inherits it through
 * `collection_kind_from_category()` (`supabase/sql/0045_category.sql`), so the
 * two can never contradict each other.
 *
 * The client-side checks are affordances; `schemas/admin.ts` re-validates
 * everything inside the action, which is the boundary.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminTextarea,
  AdminToggle,
} from "@/src/components/admin/fields";
import { createCategory, updateCategory } from "@/src/actions/admin/catalog";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminCategory } from "@/src/schemas/db/admin";

/**
 * What each kind means for the goods beneath it.
 *
 * The labels name the *consequence* rather than the enum: an editor choosing
 * here is deciding whether these products get their own detail pages, which is
 * the only thing this field visibly does.
 */
const KIND_OPTIONS = [
  {
    value: "FRAGRANCE",
    label: "Fragrance — each product gets its own detail page",
  },
  { value: "BODY", label: "Body care — sold from the grid, ritual layout" },
  { value: "HOME", label: "Home fragrances — sold from the grid, ritual layout" },
  { value: "DISCOVERY", label: "Discovery — sample sets, sold from the grid" },
  { value: "GIFT", label: "Gift sets — sold from the grid" },
] as const;

/** Slug suggestion, applied only while creating and only if untouched. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export default function CategoryForm({
  category,
  locale,
}: {
  /** `null` when creating. */
  category: AdminCategory | null;
  locale: Locale;
}) {
  const router = useRouter();
  const isEdit = category !== null;

  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(category?.description ?? "");
  const [bannerUrl, setBannerUrl] = useState(category?.bannerUrl ?? "");
  const [bannerAlt, setBannerAlt] = useState(category?.bannerAlt ?? "");
  const [kind, setKind] = useState<string>(category?.kind ?? "FRAGRANCE");
  const [isEnabled, setIsEnabled] = useState(category?.isEnabled ?? true);
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0));

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  const payload = {
    slug,
    name,
    description,
    bannerUrl,
    bannerAlt,
    kind,
    isEnabled,
    sortOrder,
  };

  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload,
    save: () => persist(),
    pending: isPending,
  });

  async function persist(): Promise<boolean> {
    setResult(null);

    const outcome = isEdit
      ? await updateCategory(payload)
      : await createCategory(payload);

    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);

    if (outcome.ok && !isEdit) {
      // Straight into the edit screen for the row just made — the next thing an
      // editor does is add a collection to it, and that starts from here.
      router.push(localizePath(locale, `/admin/categories/${outcome.slug}`));
      router.refresh();
    } else if (outcome.ok) {
      router.refresh();
    }

    if (outcome.ok) markSaved();
    return outcome.ok;
  }

  function submit() {
    startTransition(async () => {
      await persist();
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="max-w-3xl space-y-8"
    >
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
        <AdminInput
          id="name"
          label="Name"
          required
          value={name}
          error={fieldErrors.name}
          onChange={(value) => {
            setName(value);
            if (!slugTouched) setSlug(slugify(value));
          }}
        />

        <AdminInput
          id="slug"
          label="Slug"
          required
          value={slug}
          readOnly={isEdit}
          error={fieldErrors.slug}
          hint={
            isEdit
              ? "Fixed after creation — it is the category's URL and its id."
              : "Becomes /collections/<slug>. Lowercase, hyphens, no spaces."
          }
          onChange={(value) => {
            setSlugTouched(true);
            setSlug(value);
          }}
        />
      </div>

      <AdminTextarea
        id="description"
        label="Description"
        required
        rows={4}
        value={description}
        error={fieldErrors.description}
        hint="Printed under the heading on the category page, and used as its search description."
        onChange={setDescription}
      />

      <fieldset className="space-y-4 md:space-y-6">
        <legend className="label mb-2">Banner</legend>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="bannerUrl"
            label="Banner URL"
            required
            value={bannerUrl}
            error={fieldErrors.bannerUrl}
            hint="Landscape, around 1800×900. The hero at the top of the category page."
            onChange={setBannerUrl}
          />

          <AdminInput
            id="bannerAlt"
            label="Banner alt text"
            required
            value={bannerAlt}
            error={fieldErrors.bannerAlt}
            hint="Read aloud by screen readers. Describe the photograph, not the category."
            onChange={setBannerAlt}
          />
        </div>
      </fieldset>

      <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
        <AdminSelect
          id="kind"
          label="Kind"
          required
          value={kind}
          options={KIND_OPTIONS}
          error={fieldErrors.kind}
          hint="Decides how the goods beneath this category are sold. Changing it rewrites every collection under it."
          onChange={setKind}
        />

        <AdminInput
          id="sortOrder"
          label="Sort order"
          type="number"
          min={0}
          value={sortOrder}
          error={fieldErrors.sortOrder}
          hint="Lower sorts first. The running order is editorial, not alphabetical."
          onChange={setSortOrder}
        />
      </div>

      <AdminToggle
        id="isEnabled"
        label="Offered on the storefront"
        description="Switching a category off withdraws its page, its filter chip and its menu entries. Its collections and products keep their rows and come back exactly as they were."
        checked={isEnabled}
        onChange={setIsEnabled}
      />

      <div className="flex gap-3 border-t border-ground-border pt-8">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save category" : "Create category"}
        </AdminButton>
      </div>
    </form>
  );
}
