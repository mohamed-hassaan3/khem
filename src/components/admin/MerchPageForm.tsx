"use client";

/**
 * Edit a merchandising page.
 *
 * A narrower sibling of `<CollectionForm>`: same local state, same
 * `useTransition`, same inline result — four fields instead of ten, and no
 * create or delete path at all. `/collections/best-sellers` exists because
 * `MERCH_PAGE_FACETS` routes it, so the only thing an editor can change here is
 * how the page introduces itself.
 *
 * The note above the fields is the important part of this screen. Everything a
 * form usually implies — that what you type decides what appears — is untrue
 * here: membership comes from each product's own Bestseller toggle, and an
 * editor who does not know that will look for a product picker that has
 * deliberately never existed.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateMerchPage } from "@/src/actions/admin/catalog";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminTextarea,
} from "@/src/components/admin/fields";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminMerchPage } from "@/src/schemas/db/admin";

/** Where the products on each page come from, in the editor's terms. */
const MEMBERSHIP_HINT: Record<AdminMerchPage["slug"], string> = {
  "best-sellers":
    "Products appear here when their Bestseller toggle is on — set it on the product, not on this page.",
};

export default function MerchPageForm({ page }: { page: AdminMerchPage }) {
  const router = useRouter();

  const [name, setName] = useState(page.name);
  const [description, setDescription] = useState(page.description);
  const [bannerUrl, setBannerUrl] = useState(page.bannerUrl);
  const [bannerAlt, setBannerAlt] = useState(page.bannerAlt);

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  /*
   * Hoisted out of the save so it can be compared as well as posted: this one
   * object is both what the action receives and what `useUnsavedGuard` watches,
   * so a field that reaches the server necessarily reaches the comparison too.
   */
  const payload = {
    slug: page.slug,
    name,
    description,
    bannerUrl,
    bannerAlt,
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

    const outcome = await updateMerchPage(payload);

    /*
     * Successes leave, failures stay. A receipt has done its job the moment it
     * is read; a refusal names a field and has to be acted on, so it keeps its
     * place above the form. See `admin-toast-provider.tsx`.
     */
    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);
    if (!outcome.ok) return false;

    // The form now matches the row, so leaving is no longer losing anything.
    markSaved();
    router.refresh();
    return true;
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

      <p className="max-w-xl text-[11px] leading-relaxed text-ground-muted">
        {MEMBERSHIP_HINT[page.slug]} This screen sets the page&rsquo;s heading,
        its opening paragraph and its hero photograph. The Arabic wording is held
        separately and is not edited here.
      </p>

      <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
        <AdminInput
          id="name"
          label="Name"
          required
          value={name}
          error={fieldErrors.name}
          hint="The heading on the page. The Nav and the Footer keep their own wording."
          onChange={setName}
        />

        <AdminInput
          id="slug"
          label="Slug"
          readOnly
          value={page.slug}
          hint="Fixed — it is the page's URL, and the two are the only merchandising pages the site routes."
          // Read-only, so there is no state to hold; the field is here to say
          // which page is being edited, not to accept a value.
          onChange={() => {}}
        />
      </div>

      <AdminTextarea
        id="description"
        label="Description"
        required
        rows={4}
        value={description}
        error={fieldErrors.description}
        hint="The paragraph under the hero."
        onChange={setDescription}
      />

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
            hint="Landscape, around 1800×900. Must be an https image on an allowed host (Unsplash or Cloudinary)."
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

      <div className="flex gap-3 border-t border-ground-border pt-8">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save page"}
        </AdminButton>
      </div>
    </form>
  );
}
