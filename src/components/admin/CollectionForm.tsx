"use client";

/**
 * Create or edit a collection.
 *
 * One component for both, because the fields are identical and the only
 * difference is whether the slug is editable — a fact the form takes as a prop
 * rather than duplicating three hundred lines to express.
 *
 * Structure follows `ContactForm`: local state, `useTransition` for the pending
 * flag, and the action's returned result rendered inline. The client-side
 * checks are affordances; `schemas/admin.ts` re-validates everything inside the
 * action, which is the boundary.
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
import { createCollection, updateCollection } from "@/src/actions/admin/catalog";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminCollection } from "@/src/schemas/db/admin";

const KIND_OPTIONS = [
  { value: "FRAGRANCE", label: "Fragrance — sold from /perfume/[slug]" },
  { value: "BODY", label: "Body care — sold from /body-care" },
  { value: "HOME", label: "Home fragrance — sold from /room-fragrance" },
  { value: "DISCOVERY", label: "Discovery — sold from /discovery" },
  { value: "GIFT", label: "Gift set — sold from /gift-set" },
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

export default function CollectionForm({
  collection,
  locale,
}: {
  /** `null` when creating. */
  collection: AdminCollection | null;
  /** The locale this dashboard is being served under, for the post-save route. */
  locale: Locale;
}) {
  const router = useRouter();
  const isEdit = collection !== null;

  const [name, setName] = useState(collection?.name ?? "");
  const [slug, setSlug] = useState(collection?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(collection?.description ?? "");
  const [bannerUrl, setBannerUrl] = useState(collection?.bannerUrl ?? "");
  const [bannerAlt, setBannerAlt] = useState(collection?.bannerAlt ?? "");
  const [kind, setKind] = useState<string>(collection?.kind ?? "FRAGRANCE");
  const [isFeatured, setIsFeatured] = useState(collection?.isFeatured ?? false);
  const [sortOrder, setSortOrder] = useState(String(collection?.sortOrder ?? 0));

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function submit() {
    setResult(null);

    startTransition(async () => {
      const payload = {
        slug,
        name,
        description,
        bannerUrl,
        bannerAlt,
        kind,
        isFeatured,
        sortOrder,
      };

      const outcome = isEdit
        ? await updateCollection(payload)
        : await createCollection(payload);

      setResult(outcome);

      if (outcome.ok && !isEdit) {
        // Straight into the edit screen for the row just made, so the next
        // thing an editor does — adding products to it — starts from a page
        // that knows the collection exists.
        router.push(localizePath(locale, `/admin/collections/${outcome.slug}`));
        router.refresh();
      } else if (outcome.ok) {
        router.refresh();
      }
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
        <AdminNotice tone={result.ok ? "success" : "error"}>{result.message}</AdminNotice>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
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
              ? "Fixed after creation — it is the collection's URL and its id."
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
        onChange={setDescription}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <AdminInput
          id="bannerUrl"
          label="Banner URL"
          required
          type="url"
          value={bannerUrl}
          error={fieldErrors.bannerUrl}
          hint="Must be an https image on an allowed host (Unsplash or Cloudinary)."
          onChange={setBannerUrl}
        />

        <AdminInput
          id="bannerAlt"
          label="Banner alt text"
          required
          value={bannerAlt}
          error={fieldErrors.bannerAlt}
          hint="Read aloud by screen readers. Describe the photograph, not the brand."
          onChange={setBannerAlt}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <AdminSelect
          id="kind"
          label="Kind"
          required
          value={kind}
          options={KIND_OPTIONS}
          error={fieldErrors.kind}
          hint="Decides which storefront route sells these goods. Fragrances get detail pages; the rest sell from their category grid."
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
        id="isFeatured"
        label="Featured on the home page"
        description="Featured collections appear in the home page grid."
        checked={isFeatured}
        onChange={setIsFeatured}
      />

      <div className="flex gap-3 border-t border-border pt-8">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save collection" : "Create collection"}
        </AdminButton>
      </div>
    </form>
  );
}
