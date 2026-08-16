/**
 * Product comment validation.
 *
 * Two schemas with different jobs:
 *
 * - `productCommentSchema` guards the *way in*. It runs inside the Server
 *   Action on every submission; the textarea's own checks are a UX affordance.
 * - `commentRowSchema` guards the *way out*. `supabase-js` is untyped here (no
 *   generated `Database` type yet), so a row arrives as `unknown` and is parsed
 *   rather than asserted — an assertion would be a lie the compiler believes.
 *
 * Field errors are emitted as *codes*, not sentences, matching
 * `schemas/contact.ts`: the client owns the copy, so server-authored English
 * can never leak onto an Arabic page.
 */

import { z } from "zod";

/** Floor, so a stray keypress is not a comment. */
export const COMMENT_MIN_LENGTH = 2;

/** Cap on the body. Must equal the `char_length` CHECK in the SQL. */
export const COMMENT_MAX_LENGTH = 1_200;

export const productCommentSchema = z.object({
  /*
   * The product this belongs to. Shape-checked here; *existence* is checked in
   * the action against the catalog, because only the service layer knows what
   * a real slug is.
   */
  slug: z.string().trim().min(1, "slugInvalid").max(120, "slugInvalid"),
  body: z
    .string()
    .trim()
    .min(1, "bodyRequired")
    .min(COMMENT_MIN_LENGTH, "bodyTooShort")
    .max(COMMENT_MAX_LENGTH, "bodyTooLong"),
  /**
   * Honeypot. A real visitor never sees this field, so any value at all means
   * a bot filled the form by walking the DOM. Empty string or absent only.
   */
  company: z.string().max(0).optional(),
});

export type ProductCommentInput = z.infer<typeof productCommentSchema>;

/**
 * A row as selected from `public.product_comment`.
 *
 * Note what is absent: `author_clerk_id`. It is never selected, and parsing
 * with a schema that has no such key means it cannot be smuggled through by a
 * future `select("*")`.
 */
export const commentRowSchema = z.object({
  id: z.string(),
  author_name: z.string().nullable(),
  body: z.string(),
  created_at: z.string(),
});
