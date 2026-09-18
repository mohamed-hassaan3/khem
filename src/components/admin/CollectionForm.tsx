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
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminCollection } from "@/src/schemas/db/admin";

/** The categories a collection may stand under, as the form offers them. */
export interface CategoryOption {
  slug: string;
  name: string;
  kind: string;
}

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
  categories,
  locale,
}: {
  /** `null` when creating. */
  collection: AdminCollection | null;
  /**
   * Every category, in editorial order — the shelves this collection may stand
   * on. Passed in rather than fetched here: this is a client component, and the
   * list is three rows the page already had to read.
   */
  categories: readonly CategoryOption[];
  /** The locale this dashboard is being served under, for the post-save route. */
  locale: Locale;
}) {
  const router = useRouter();
  const isEdit = collection !== null;

  const [name, setName] = useState(collection?.name ?? "");
  const [slug, setSlug] = useState(collection?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(collection?.description ?? "");
    const [subdescription, setSubdescription] = useState(
      collection?.subdescription ?? "",
    );
  const [bannerUrl, setBannerUrl] = useState(collection?.bannerUrl ?? "");
  const [bannerAlt, setBannerAlt] = useState(collection?.bannerAlt ?? "");
  // Empty means "reuse the banner". `AdminCollection` deliberately keeps the
  // stored null rather than the fallback, so this field shows what is actually
  // set — see `src/schemas/db/admin.ts`.
  const [cardUrl, setCardUrl] = useState(collection?.cardUrl ?? "");
  const [cardAlt, setCardAlt] = useState(collection?.cardAlt ?? "");
  const [categorySlug, setCategorySlug] = useState<string>(
    collection?.categorySlug ?? categories[0]?.slug ?? "",
  );
  const [isFeatured, setIsFeatured] = useState(collection?.isFeatured ?? false);
  const [sortOrder, setSortOrder] = useState(String(collection?.sortOrder ?? 0));

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  /*
   * Hoisted out of `submit()` so it can be compared as well as posted: this
   * one object is both what the action receives and what `useUnsavedGuard`
   * watches, so a field that reaches the server necessarily reaches the
   * comparison too.
   */
  const payload = {
    slug,
    name,
    description,
    subdescription,
    bannerUrl,
    bannerAlt,
    cardUrl,
    cardAlt,
    categorySlug,
    isFeatured,
    sortOrder,
  };

  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload,
    save: () => persist(),
    pending: isPending,
  });

  /** Saves and reports whether it worked. Awaited by the leave-page dialog. */
  async function persist(): Promise<boolean> {
    setResult(null);

    const outcome = isEdit
      ? await updateCollection(payload)
      : await createCollection(payload);

    /*
     * Successes leave, failures stay. A receipt has done its job the moment it
     * is read; a refusal names a field and has to be acted on, so it keeps its
     * place above the form. See `admin-toast-provider.tsx`.
     */
    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);

    if (outcome.ok && !isEdit) {
      // Straight into the edit screen for the row just made, so the next
      // thing an editor does — adding products to it — starts from a page
      // that knows the collection exists.
      router.push(localizePath(locale, `/admin/collections/${outcome.slug}`));
      router.refresh();
    } else if (outcome.ok) {
      router.refresh();
    }

    // The form now matches the row, so leaving it is no longer losing anything.
    if (outcome.ok) markSaved();
    return outcome.ok;
  }

  function submit() {
    /*
     * The callback stays `async` and awaits: React 19 keeps `isPending` true for
     * the life of an async transition, and a synchronous callback that merely
     * *starts* the promise would drop the flag immediately — the save button
     * would stop saying "Saving" the instant it was pressed.
     */
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
        <AdminNotice tone={result.ok ? "success" : "error"}>{result.message}</AdminNotice>
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

      <AdminTextarea
        id="subdescription"
        label="Card subdescription"
        required
        rows={2}
        value={subdescription}
        error={fieldErrors.subdescription}
        hint="Short copy shown on collection cards. Keep it to roughly 15 words; the banner uses the longer description above."
        onChange={setSubdescription}
      />

      {/*
        Two images, because they are cropped for two different frames: the
        banner is the landscape hero on the collection page, the card is the
        portrait tile in the home page grid. Grouped under headings rather than
        left as four adjacent URL fields, which is where the wrong file gets
        pasted into the wrong box.
      */}
      <fieldset className="space-y-6 border-t border-ground-border pt-8">
        <legend className="sr-only">Banner image</legend>

        <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground-accent">
          Banner image
        </p>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="bannerUrl"
            label="Banner URL"
            required
            type="url"
            value={bannerUrl}
            error={fieldErrors.bannerUrl}
            hint="Landscape, around 1800×900. The hero on the collection page. Must be an https image on an allowed host (Unsplash or Cloudinary)."
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
      </fieldset>

      <fieldset className="space-y-6 border-t border-ground-border pt-8">
        <legend className="sr-only">Card image</legend>

        <p className="font-heading text-[11px] uppercase tracking-[0.2em] text-ground-accent">
          Card image
        </p>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="cardUrl"
            label="Card URL"
            type="url"
            value={cardUrl}
            error={fieldErrors.cardUrl}
            hint="Portrait 3:4, around 900×1200. The tile in the home page grid. Leave blank to reuse the banner."
            onChange={setCardUrl}
          />

          <AdminInput
            id="cardAlt"
            label="Card alt text"
            value={cardAlt}
            error={fieldErrors.cardAlt}
            hint="Required once a card image is set — it is a different photograph, so it needs its own description."
            onChange={setCardAlt}
          />
        </div>
      </fieldset>

      <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
        {/*
          The category, which replaced the old "Kind" select.
          
          A collection no longer declares what it sells: its category does, and
          the database copies that answer down onto this row on every save. So
          there is one field here instead of two that could contradict each
          other, and the hint names the consequence rather than the mechanism.
        */}
        <AdminSelect
          id="categorySlug"
          label="Category"
          required
          value={categorySlug}
          options={categories.map((category) => ({
            value: category.slug,
            label: `${category.name} — ${category.kind}`,
          }))}
          error={fieldErrors.categorySlug}
          hint="The shelf this collection stands on. It decides how these goods are sold: a fragrance category gives its products their own detail pages, the others sell from the grid."
          onChange={setCategorySlug}
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

      <div className="flex gap-3 border-t border-ground-border pt-8">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save collection" : "Create collection"}
        </AdminButton>
      </div>
    </form>
  );
}
