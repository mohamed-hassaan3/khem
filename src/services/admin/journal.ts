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
