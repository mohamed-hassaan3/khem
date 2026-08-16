/**
 * Product comment query layer.
 *
 * The seam between the UI and Postgres, in the same spirit as
 * `services/products.ts` — with the difference that this one is already talking
 * to the database rather than describing the query it will become.
 *
 * Read path only. Writing is `actions/comments.ts`, because a write needs the
 * Clerk session, the throttle, and revalidation, none of which belong in a
 * query function.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import { commentRowSchema } from "@/src/schemas/comments";
import type { ProductComment } from "@/src/types/comments";

/** The projection, in one place. Deliberately excludes `author_clerk_id`. */
export const COMMENT_COLUMNS = "id, author_name, body, created_at";

/** Ceiling on a single product's thread, so a popular page cannot unbound. */
const MAX_COMMENTS = 50;

/**
 * Map a validated row to the client-facing projection.
 *
 * Shared with the action so the row the author sees optimistically and the rows
 * everyone else sees after revalidation are produced by the same code.
 */
export function toComment(row: unknown): ProductComment | null {
  const parsed = commentRowSchema.safeParse(row);
  if (!parsed.success) return null;

  return {
    id: parsed.data.id,
    authorName: parsed.data.author_name,
    body: parsed.data.body,
    createdAt: parsed.data.created_at,
  };
}

/**
 * Published comments for one product, newest first.
 *
 * Returns `[]` on every failure — unconfigured, offline, malformed row. A
 * database outage degrades this section to "no comments yet" instead of taking
 * down a product page that is perfectly renderable without it.
 *
 * Logs the provider's message and nothing else: comment bodies and author names
 * never reach a log line.
 */
export async function getCommentsForProduct(
  slug: string,
): Promise<ProductComment[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("product_comment")
      .select(COMMENT_COLUMNS)
      // Parameterised by the client, never interpolated into SQL.
      .eq("product_slug", slug)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(MAX_COMMENTS);

    if (error) {
      console.error("[comments] Query failed:", error.message);
      return [];
    }

    // `data` is `unknown[]` as far as this module is concerned: no generated
    // `Database` type exists yet, so each row is parsed rather than trusted.
    // A single malformed row is dropped; it does not take the thread with it.
    return (data ?? [])
      .map(toComment)
      .filter((comment): comment is ProductComment => comment !== null);
  } catch (cause) {
    console.error(
      "[comments] Query threw:",
      cause instanceof Error ? cause.message : "unknown error",
    );
    return [];
  }
}
