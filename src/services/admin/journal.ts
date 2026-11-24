/**
 * Journal reads for the dashboard.
 *
 * Same bargain as `services/admin/catalog.ts`, and for the same reason: the
 * public policy on `"Article"` publishes `isPublished` rows only, and a draft
 * an editor cannot see is a draft they cannot publish. Bypassing RLS here is
 * what the screen is for; `requireAdmin()` is what makes it safe.
 */

import "server-only";

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  ADMIN_ARTICLE_COLUMNS,
  parseList,
  toAdminArticle,
  type AdminArticle,
} from "@/src/schemas/db/admin";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/** Every article, drafts included, newest first. */
export async function listAdminArticles(): Promise<AdminArticle[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Article")
    .select(ADMIN_ARTICLE_COLUMNS)
    .order("publishedAt", { ascending: false });

  if (error) {
    logFailure("listAdminArticles", error.message);
    return [];
  }

  return parseList(data, toAdminArticle);
}

export async function getAdminArticle(slug: string): Promise<AdminArticle | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("Article")
    .select(ADMIN_ARTICLE_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    logFailure("getAdminArticle", error.message);
    return null;
  }

  return toAdminArticle(data);
}

/**
 * How many articles exist and how many are unpublished — Today's one line on
 * the journal. One column of every row rather than every column of every row.
 */
export async function countAdminArticles(): Promise<{ total: number; unpublished: number }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { total: 0, unpublished: 0 };

  const { data, error } = await supabase.from("Article").select("isPublished");

  if (error) {
    logFailure("countAdminArticles", error.message);
    return { total: 0, unpublished: 0 };
  }

  const rows = data ?? [];
  return {
    total: rows.length,
    unpublished: rows.filter((row) => row.isPublished !== true).length,
  };
}
