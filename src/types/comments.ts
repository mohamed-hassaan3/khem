/**
 * Product comment types.
 *
 * The shape here is the *client-facing* projection, not the table: it carries
 * no `author_clerk_id` and no `is_published`, so neither can be leaked by a
 * component that renders a comment.
 */

import type { FormActionError } from "./contact";

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
  body: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
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
