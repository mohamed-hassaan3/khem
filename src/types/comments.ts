/**
 * Product comment types.
 *
 * The shape here is the *client-facing* projection, not the table: it carries
 * no `author_clerk_id` and no `is_published`, so neither can be leaked by a
 * component that renders a comment.
 */

import type { FormActionError } from "./contact";

/** One photograph on a comment, resolved to something renderable. */
export interface ProductCommentImage {
  id: string;
  /** Public URL, composed by `src/lib/comment-images.ts`. Never a raw path. */
  url: string;
  /** Intrinsic pixel size when it could be read, so the box can be reserved. */
  width: number | null;
  height: number | null;
}

/** One published comment, as the UI consumes it. */
export interface ProductComment {
  id: string;
  /**
   * Clerk display name captured at post time, or `null` for a guest.
   *
   * The "Guest" label is deliberately not stored: it is substituted at render
   * time from the dictionary, so the same row reads "Guest" on `/en` and "ضيف"
   * on `/ar`.
   */
  authorName: string | null;
  /**
   * `null` for a rating left without words — a valid comment since
   * `0018_comment_rating_images.sql`. A row always carries this or a rating.
   */
  body: string | null;
  /** 1–5 stars, or `null` when the visitor only wrote. */
  rating: number | null;
  images: ProductCommentImage[];
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/**
 * What the section prints above the form.
 *
 * `average` is unrounded — the component decides how many decimals to show, so
 * the number is not rounded twice by two call sites that disagree.
 */
export interface ProductRatingSummary {
  average: number;
  count: number;
  /** How many ratings landed on each star, keyed 1–5. */
  distribution: Record<number, number>;
}

/**
 * What `postProductComment()` hands back.
 *
 * Mirrors `FormActionResult` and reuses its error codes, with one addition: the
 * success branch returns the stored row so the client can show it immediately
 * rather than waiting on revalidation.
 *
 * `comment` is `null` on the honeypot branch — the submission is reported as a
 * success and nothing is written, because telling a bot it was detected only
 * teaches it to adapt.
 */
export type CommentActionResult =
  | { ok: true; comment: ProductComment | null }
  | {
      ok: false;
      error: FormActionError;
      /** Field name → error code, present only for `validation`. */
      fieldErrors?: Record<string, string>;
    };
