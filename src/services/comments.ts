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

import { commentImageUrl } from "@/src/lib/comment-images";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  COMMENT_MAX_RATING,
  COMMENT_MIN_RATING,
  commentRowSchema,
} from "@/src/schemas/comments";
import type {
  ProductComment,
  ProductCommentImage,
  ProductRatingSummary,
} from "@/src/types/comments";

/**
 * The projection, in one place. Deliberately excludes `author_clerk_id`.
 *
 * The photographs ride along as an embedded resource rather than a second
 * round trip — a thread of fifty comments would otherwise be fifty-one queries.
 */
export const COMMENT_COLUMNS =
  "id, author_name, body, rating, created_at, product_comment_image(id, storage_path, width, height, sort_order)";

/**
 * The same projection without the join.
 *
 * Used by the insert's `.select()`: a freshly written comment has no images
 * attached *yet* (they are uploaded after the row exists), so asking for them
 * there would return an empty array the action would then have to overwrite.
 */
export const COMMENT_COLUMNS_FLAT = "id, author_name, body, rating, created_at";

/** Ceiling on a single product's thread, so a popular page cannot unbound. */
const MAX_COMMENTS = 50;

/** An empty summary — the shape every failure and every unrated product returns. */
function emptyRatingSummary(): ProductRatingSummary {
  const distribution: Record<number, number> = {};
  for (let star = COMMENT_MIN_RATING; star <= COMMENT_MAX_RATING; star += 1) {
    distribution[star] = 0;
  }
  return { average: 0, count: 0, distribution };
}

/**
 * Map a validated row to the client-facing projection.
 *
 * Shared with the action so the row the author sees optimistically and the rows
 * everyone else sees after revalidation are produced by the same code.
 */
export function toComment(row: unknown): ProductComment | null {
  const parsed = commentRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const images: ProductCommentImage[] = (parsed.data.product_comment_image ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .flatMap((image) => {
      // `null` means the app is unconfigured, which is not a state this row can
      // do anything about — it drops out rather than rendering a broken frame.
      const url = commentImageUrl(image.storage_path);
      if (!url) return [];

      return [
        {
          id: image.id,
          url,
          width: image.width ?? null,
          height: image.height ?? null,
        },
      ];
    });

  return {
    id: parsed.data.id,
    authorName: parsed.data.author_name,
    body: parsed.data.body,
    rating: parsed.data.rating,
    images,
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
 * Logs the provider's message and nothing else: comment bodies, author names
 * and object paths never reach a log line.
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

/**
 * Star ratings for one product, aggregated.
 *
 * Counted in the application rather than by a Postgres `avg()`, because the
 * thread ceiling above means the rows are already small and a view or an RPC
 * would be a second piece of schema to keep in step with `0018`. If a product
 * ever carries thousands of ratings this becomes a materialised aggregate; it
 * is not one today because it would be a guess dressed as an optimisation.
 *
 * Degrades exactly like the thread query: a zeroed summary, which
 * `<RatingSummary>` renders as nothing at all.
 */
export async function getProductRatingSummary(
  slug: string,
): Promise<ProductRatingSummary> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return emptyRatingSummary();

  try {
    const { data, error } = await supabase
      .from("product_comment")
      .select("rating")
      .eq("product_slug", slug)
      .eq("is_published", true)
      .not("rating", "is", null);

    if (error) {
      console.error("[comments] Rating query failed:", error.message);
      return emptyRatingSummary();
    }

    const summary = emptyRatingSummary();
    let total = 0;

    for (const row of data ?? []) {
      const rating = (row as { rating?: unknown }).rating;
      if (
        typeof rating !== "number" ||
        !Number.isInteger(rating) ||
        rating < COMMENT_MIN_RATING ||
        rating > COMMENT_MAX_RATING
      ) {
        continue;
      }

      summary.count += 1;
      summary.distribution[rating] += 1;
      total += rating;
    }

    summary.average = summary.count === 0 ? 0 : total / summary.count;

    return summary;
  } catch (cause) {
    console.error(
      "[comments] Rating query threw:",
      cause instanceof Error ? cause.message : "unknown error",
    );
    return emptyRatingSummary();
  }
}
