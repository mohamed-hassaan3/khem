"use client";

/**
 * Create or edit a journal article.
 *
 * The publication switch is on the form rather than only in the list, because
 * "write it now, publish it later" is the normal way an editorial page gets
 * made — and an article saved unpublished is genuinely invisible: the RLS
 * policy on `"Article"` publishes `isPublished` rows only, so a draft is not
 * merely hidden by a query somewhere.
 *
 * `publishedAt` is the *display* date on the card and the sort key for the
 * journal; it is not "when this was created", which is why it is an editable
 * field and not a timestamp taken behind the editor's back.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createArticle, updateArticle } from "@/src/actions/admin/journal";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminTextarea,
  AdminToggle,
} from "@/src/components/admin/fields";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminArticle } from "@/src/schemas/db/admin";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Today, as the `YYYY-MM-DD` a `<input type="date">` wants. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ArticleForm({
  article,
  categories,
  locale,
}: {
  /** `null` when creating. */
  article: AdminArticle | null;
  /** Categories already in use, offered as a datalist rather than a closed set. */
  categories: readonly string[];
  locale: Locale;
}) {
  const router = useRouter();
  const isEdit = article !== null;

  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [category, setCategory] = useState(article?.category ?? "");
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [publishedAt, setPublishedAt] = useState(article?.publishedAt ?? today());
  const [readTimeMinutes, setReadTimeMinutes] = useState(
    String(article?.readTimeMinutes ?? 5),
  );
  const [imageUrl, setImageUrl] = useState(article?.imageUrl ?? "");
  const [imageAlt, setImageAlt] = useState(article?.imageAlt ?? "");
  const [isFeatured, setIsFeatured] = useState(article?.isFeatured ?? false);
  const [isPublished, setIsPublished] = useState(article?.isPublished ?? false);

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
    title,
    category,
    excerpt,
    body,
    publishedAt,
    readTimeMinutes,
    isFeatured,
    isPublished,
    imageUrl,
    imageAlt,
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

    const outcome = isEdit ? await updateArticle(payload) : await createArticle(payload);
    /*
     * Successes leave, failures stay. A receipt has done its job the moment it
     * is read; a refusal names a field and has to be acted on, so it keeps its
     * place above the form. See `admin-toast-provider.tsx`.
     */
    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);

    if (outcome.ok && !isEdit) {
      router.push(localizePath(locale, `/admin/journal/${outcome.slug}`));
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
          id="title"
          label="Title"
          required
          value={title}
          error={fieldErrors.title}
          onChange={(value) => {
            setTitle(value);
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
              ? "Fixed after creation — a shared or indexed article URL must keep working."
              : "Becomes the article's URL."
          }
          onChange={(value) => {
            setSlugTouched(true);
            setSlug(value);
          }}
        />
      </div>

      <div>
        <AdminInput
          id="category"
          label="Category"
          required
          value={category}
          error={fieldErrors.category}
          hint="Becomes a filter tab on /journal. Reuse an existing one where it fits."
          onChange={setCategory}
        />
        {categories.length > 0 ? (
          <p className="mt-2 text-[11px] tracking-wide text-ground-subtle">
            In use: {categories.join(" · ")}
          </p>
        ) : null}
      </div>

      <AdminTextarea
        id="excerpt"
        label="Excerpt"
        required
        rows={4}
        value={excerpt}
        error={fieldErrors.excerpt}
        hint="The passage shown on the card, and the lead paragraph on the article page."
        onChange={setExcerpt}
      />

      <AdminTextarea
        id="body"
        label="Body"
        rows={22}
        value={body}
        error={fieldErrors.body}
        hint={
          "The essay itself. Leave a blank line between paragraphs. Start a line with " +
          "## for a section heading, or > for a pull quote. Plain text only — " +
          "HTML is never rendered as markup."
        }
        onChange={setBody}
      />

      <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
        <AdminInput
          id="publishedAt"
          label="Display date"
          required
          type="date"
          value={publishedAt}
          error={fieldErrors.publishedAt}
          hint="Shown on the card and used to sort the journal."
          onChange={setPublishedAt}
        />

        <AdminInput
          id="readTimeMinutes"
          label="Read time (minutes)"
          required
          type="number"
          min={1}
          value={readTimeMinutes}
          error={fieldErrors.readTimeMinutes}
          onChange={setReadTimeMinutes}
        />

        <AdminInput
          id="imageUrl"
          label="Image URL"
          required
          type="url"
          value={imageUrl}
          error={fieldErrors.imageUrl}
          hint="https, on an allowed host (Unsplash or Cloudinary)."
          onChange={setImageUrl}
        />

        <AdminInput
          id="imageAlt"
          label="Image alt text"
          required
          value={imageAlt}
          error={fieldErrors.imageAlt}
          onChange={setImageAlt}
        />
      </div>

      <div className="space-y-3">
        <AdminToggle
          id="isPublished"
          label="Published"
          description="Unpublished articles are invisible to visitors — the database policy hides them, not just a query."
          checked={isPublished}
          onChange={setIsPublished}
        />

        <AdminToggle
          id="isFeatured"
          label="Featured"
          description="Promoted to the large card at the top of /journal."
          checked={isFeatured}
          onChange={setIsFeatured}
        />
      </div>

      <div className="flex gap-3 border-t border-ground-border pt-8">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save article" : "Create article"}
        </AdminButton>
      </div>
    </form>
  );
}
