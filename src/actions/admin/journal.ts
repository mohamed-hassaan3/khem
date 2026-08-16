"use server";

/**
 * Journal writes.
 *
 * Same trust model as `actions/admin/catalog.ts`: `requireAdmin()` first,
 * Zod second, service key third, and no RLS policy added anywhere to make it
 * work. See that file's header for the reasoning in full.
 *
 * The one thing peculiar to articles: `isPublished` is the visibility switch
 * the public policy on `"Article"` reads, so an unpublished row is invisible to
 * the storefront without being deleted. That is what makes drafting possible
 * here at all, and it is why there is no delete action — a retired article
 * becomes a draft rather than a hole in the archive.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import { revalidateArticle } from "@/src/lib/admin/revalidate";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  createArticleSchema,
  setArticlePublishedSchema,
  updateArticleSchema,
  type AdminActionResult,
} from "@/src/schemas/admin";

import {
  UNCONFIGURED,
  fieldErrorsFrom,
  postgresFailure,
  type PostgresErrorLike,
} from "./shared";

export async function createArticle(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createArticleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { slug, ...rest } = parsed.data;

  const { error } = await supabase.from("Article").insert({
    id: slug,
    slug,
    ...rest,
  });

  if (error) {
    console.error(`[admin] createArticle rejected (${actor.email}): ${error.message}`);
    return postgresFailure(error as PostgresErrorLike, "article");
  }

  revalidateArticle();
  console.log(`[admin] article created by ${actor.email} → ${slug}`);

  return {
    ok: true,
    slug,
    message: parsed.data.isPublished
      ? `"${parsed.data.title}" published.`
      : `"${parsed.data.title}" saved as a draft.`,
  };
}

export async function updateArticle(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateArticleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  // The slug identifies the row and is never part of the payload — an article
  // URL that has been shared or indexed must keep working.
  const { slug, ...rest } = parsed.data;

  const { data, error } = await supabase
    .from("Article")
    .update(rest)
    .eq("slug", slug)
    .select("slug")
    .maybeSingle();

  if (error) {
    console.error(`[admin] updateArticle rejected (${actor.email}): ${error.message}`);
    return postgresFailure(error as PostgresErrorLike, "article");
  }

  if (!data) {
    return { ok: false, message: "That article no longer exists." };
  }

  revalidateArticle();
  console.log(`[admin] article updated by ${actor.email} → ${slug}`);

  return { ok: true, slug, message: `"${parsed.data.title}" saved.` };
}

/** Publish or retire an article without opening the editor. */
export async function setArticlePublished(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = setArticlePublishedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That request was not understood." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { slug, isPublished } = parsed.data;

  const { data, error } = await supabase
    .from("Article")
    .update({ isPublished })
    .eq("slug", slug)
    .select("slug")
    .maybeSingle();

  if (error) {
    console.error(`[admin] setArticlePublished rejected (${actor.email}): ${error.message}`);
    return postgresFailure(error as PostgresErrorLike, "article");
  }

  if (!data) {
    return { ok: false, message: "That article no longer exists." };
  }

  revalidateArticle();
  console.log(
    `[admin] article ${isPublished ? "published" : "unpublished"} by ${actor.email} → ${slug}`,
  );

  return {
    ok: true,
    slug,
    message: isPublished
      ? "Published — it is live on the journal."
      : "Returned to draft. It is no longer on the journal.",
  };
}
