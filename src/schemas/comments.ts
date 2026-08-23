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

import {
  COMMENT_IMAGE_TYPES,
  COMMENT_MAX_IMAGES,
  COMMENT_MAX_IMAGE_BYTES,
} from "@/src/lib/comment-images";

export { COMMENT_IMAGE_TYPES, COMMENT_MAX_IMAGES, COMMENT_MAX_IMAGE_BYTES };

/** Floor, so a stray keypress is not a comment. */
export const COMMENT_MIN_LENGTH = 2;

/** Cap on the body. Must equal the `char_length` CHECK in the SQL. */
export const COMMENT_MAX_LENGTH = 1_200;

/** Stars. Mirrored by the `rating between 1 and 5` CHECK in the SQL. */
export const COMMENT_MIN_RATING = 1;
export const COMMENT_MAX_RATING = 5;

/**
 * One photograph as it crosses the boundary.
 *
 * `type` and `size` are what the *browser* said. Neither is trusted: the action
 * sniffs the decoded bytes and re-measures them. They are validated anyway so
 * an obviously bad file is refused before anything is decoded.
 */
export const commentImageUploadSchema = z.object({
  dataUrl: z
    .string()
    .startsWith("data:image/", "imageType")
    // Base64 inflates by ~4/3; the ceiling is generous because the decoded
    // length is what actually gets checked.
    .max(Math.ceil(COMMENT_MAX_IMAGE_BYTES * 1.4), "imageTooLarge"),
  type: z.enum(COMMENT_IMAGE_TYPES, "imageType"),
  size: z.number().int().positive("imageType").max(COMMENT_MAX_IMAGE_BYTES, "imageTooLarge"),
});

export type CommentImageUpload = z.infer<typeof commentImageUploadSchema>;

export const productCommentSchema = z
  .object({
    /*
     * The product this belongs to. Shape-checked here; *existence* is checked in
     * the action against the catalog, because only the service layer knows what
     * a real slug is.
     */
    slug: z.string().trim().min(1, "slugInvalid").max(120, "slugInvalid"),
    /**
     * Optional since `0018_comment_rating_images.sql`: a visitor may leave a
     * rating and no words at all. An empty textarea normalises to `undefined`
     * rather than `""`, so the column receives null and not a string the
     * `char_length` CHECK would reject.
     */
    body: z
      .string()
      .trim()
      .min(COMMENT_MIN_LENGTH, "bodyTooShort")
      .max(COMMENT_MAX_LENGTH, "bodyTooLong")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    rating: z
      .number()
      .int("ratingInvalid")
      .min(COMMENT_MIN_RATING, "ratingInvalid")
      .max(COMMENT_MAX_RATING, "ratingInvalid")
      .optional(),
    images: z
      .array(commentImageUploadSchema)
      .max(COMMENT_MAX_IMAGES, "imageCount")
      .optional(),
    /**
     * Honeypot. A real visitor never sees this field, so any value at all means
     * a bot filled the form by walking the DOM. Empty string or absent only.
     */
    company: z.string().max(0).optional(),
  })
  /*
   * The database says the same thing in `product_comment_has_content`. Both
   * exist for the reason the length bound does: this is the boundary the app
   * enforces, that is the one the database enforces regardless of the client.
   */
  .refine((value) => value.body !== undefined || value.rating !== undefined, {
    path: ["body"],
    message: "contentRequired",
  });

export type ProductCommentInput = z.infer<typeof productCommentSchema>;

/**
 * An image row as selected alongside its comment.
 *
 * `storage_path`, never a URL: composing one is `src/lib/comment-images.ts`'s
 * job, and a row that carried a full URL could point anywhere.
 */
export const commentImageRowSchema = z.object({
  id: z.string(),
  storage_path: z.string(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  sort_order: z.number(),
});

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
  body: z.string().nullable(),
  rating: z.number().nullable(),
  created_at: z.string(),
  /*
   * Absent on the row the insert returns (that select carries no join), an
   * array on the rows the thread query returns. Optional rather than two
   * schemas, so `toComment()` stays the single mapper both paths share.
   */
  product_comment_image: z.array(commentImageRowSchema).nullable().optional(),
});
