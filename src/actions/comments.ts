"use server";

/**
 * Product comment submission.
 *
 * Anyone may leave one — signed in or not. What separates the two is not access
 * but attribution, and attribution is decided *here*, from the Clerk session,
 * never from the payload. `ProductCommentInput` has no name field at all, so a
 * client cannot post as someone else; the worst it can do is post as a guest.
 *
 * Since `0018_comment_rating_images.sql` a submission may also carry a 1–5 star
 * rating and up to three photographs. The rating makes the body optional: a
 * visitor who wants to say only "five stars" should not have to write a
 * paragraph to do it. What is *not* optional is that a row carry one or the
 * other — the schema refuses an empty submission and so does the table.
 *
 * Ordering mirrors `actions/contact.ts`: cheapest and most traffic-shedding
 * first, so nothing touches the database before the throttle. Photographs are
 * decoded last, after every free rejection has already been made.
 *
 * Privacy: this action never logs a comment body, an author name, or an object
 * path. Failure logs carry the provider error and nothing else.
 */

import { revalidatePath } from "next/cache";

import { getViewer } from "@/src/lib/auth";
import {
  COMMENT_IMAGE_BUCKET,
  COMMENT_IMAGE_EXTENSION,
  COMMENT_MAX_IMAGE_BYTES,
  COMMENT_MAX_IMAGES,
  decodeDataUrl,
  readImageSize,
  sniffImageType,
  type CommentImageType,
} from "@/src/lib/comment-images";
import { clientKey, isRateLimited } from "@/src/lib/email/rate-limit";
import { LOCALES } from "@/src/lib/i18n/config";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { productCommentSchema, type CommentImageUpload } from "@/src/schemas/comments";
import { COMMENT_COLUMNS_FLAT, toComment } from "@/src/services/comments";
import { productHref } from "@/src/lib/routes";
import { getDetailPageTarget } from "@/src/services/products";
import type { CommentActionResult } from "@/src/types/comments";

/**
 * Five comments per ten minutes per client.
 *
 * Higher than the contact form's three — a comment costs nobody's attention
 * directly — but still low, because the cost being controlled is a public wall
 * every visitor reads. Unchanged by the photographs: three files inside one
 * submission is the per-comment cap, not a new budget.
 */
const LIMIT = { limit: 5, windowMs: 10 * 60 * 1_000 };

/** Untrusted shape as it crosses the boundary. Zod decides what it really is. */
export interface ProductCommentFormInput {
  slug: string;
  body: string;
  /** 1–5. Absent when the visitor only wrote words. */
  rating?: number;
  /** Data URLs, at most `COMMENT_MAX_IMAGES` of them. */
  images?: CommentImageUpload[];
  /** Honeypot. Always empty for a human. */
  company: string;
}

/** One photograph, decoded and vouched for by its own bytes. */
interface PreparedImage {
  bytes: Uint8Array;
  type: CommentImageType;
  width: number | null;
  height: number | null;
}

/**
 * Decode, sniff and measure every attachment, or say which rule it broke.
 *
 * The browser's declared MIME is discarded here on purpose: it comes from a
 * file extension, so `payload.pdf` renamed to `photo.png` arrives claiming to
 * be a PNG. What the bytes say is what gets stored — and a file whose bytes say
 * nothing recognisable is refused.
 */
function prepareImages(
  uploads: CommentImageUpload[],
): { ok: true; images: PreparedImage[] } | { ok: false; code: string } {
  if (uploads.length > COMMENT_MAX_IMAGES) {
    return { ok: false, code: "imageCount" };
  }

  const images: PreparedImage[] = [];

  for (const upload of uploads) {
    const bytes = decodeDataUrl(upload.dataUrl);
    if (!bytes) return { ok: false, code: "imageType" };

    // The decoded length, not the one the client reported. This is the number
    // the bucket's own `file_size_limit` would enforce anyway; enforcing it
    // before the upload is what keeps a rejected file off the network.
    if (bytes.length > COMMENT_MAX_IMAGE_BYTES) {
      return { ok: false, code: "imageTooLarge" };
    }

    const type = sniffImageType(bytes);
    if (!type) return { ok: false, code: "imageType" };

    const size = readImageSize(bytes, type);

    images.push({
      bytes,
      type,
      width: size?.width ?? null,
      height: size?.height ?? null,
    });
  }

  return { ok: true, images };
}

export async function postProductComment(
  input: ProductCommentFormInput,
): Promise<CommentActionResult> {
  // 1. Honeypot — a bot walked the DOM. Report success, write nothing.
  if (input.company.length > 0) {
    return { ok: true, comment: null };
  }

  // 2. Throttle, before any database call.
  if (isRateLimited("comment", await clientKey(), LIMIT)) {
    return { ok: false, error: "rateLimited" };
  }

  // 3. Authoritative validation. The form checked the same rules; that was
  //    an affordance, this is the boundary.
  const parsed = productCommentSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return { ok: false, error: "validation", fieldErrors };
  }

  const { slug, body, rating, images: uploads } = parsed.data;

  /*
   * 4. The slug is untrusted input. The table does have a foreign key onto
   *    `"Product"(slug)` now, but matching first is what returns a clean field
   *    error to the visitor instead of a constraint violation.
   *
   *    Scoped to products with a *detail page*, not to fragrances: a comment
   *    can only be read where a thread renders, and since
   *    `0013_product_image_caption.sql` that includes body care and home
   *    fragrance. Checking against the fragrance-only query here is what would
   *    reject every ritual comment with `slugInvalid`.
   */
  const product = await getDetailPageTarget(slug);
  if (!product) {
    return { ok: false, error: "validation", fieldErrors: { slug: "slugInvalid" } };
  }

  // 5. Photographs, decoded and vouched for before anything is written. A bad
  //    attachment must not leave a comment behind.
  const prepared = prepareImages(uploads ?? []);
  if (!prepared.ok) {
    return { ok: false, error: "validation", fieldErrors: { images: prepared.code } };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Unreachable in practice: `<ProductComments>` renders nothing when the
    // database is unconfigured, so there is no form to submit. Handled anyway —
    // a silent success here would tell the visitor their words were kept.
    console.warn("[comments] Supabase is not configured; comment not stored.");
    return { ok: false, error: "delivery" };
  }

  /*
   * 6. Identity, from the session and only from the session. A signed-out
   *    visitor gets nulls; the UI renders the translated "Guest" label over
   *    them, which is why no such string is written here.
   */
  const viewer = await getViewer();
  const authorName = viewer?.fullName?.trim() || null;

  try {
    const { data, error } = await supabase
      .from("product_comment")
      .insert({
        product_slug: product.slug,
        author_clerk_id: viewer?.id ?? null,
        author_name: authorName,
        body: body ?? null,
        rating: rating ?? null,
      })
      .select(COMMENT_COLUMNS_FLAT)
      .single();

    // supabase-js returns `{ data, error }` rather than throwing. Not checking
    // it is the silent-drop bug: the await resolves, the form thanks the
    // visitor, and nothing was written.
    if (error) {
      console.error("[comments] Insert rejected:", error.message);
      return { ok: false, error: "delivery" };
    }

    const commentId = (data as { id?: unknown }).id;
    if (typeof commentId !== "string") {
      console.error("[comments] Insert returned an unreadable row.");
      return { ok: false, error: "delivery" };
    }

    /*
     * 7. The photographs, now that there is an id to file them under.
     *
     *    Paths are built entirely from values this server chose — the product
     *    slug, the new row's id, the loop index, and the extension implied by
     *    the *sniffed* type. No part of an uploaded filename survives, so a
     *    name like `../../avatar.png` has nowhere to go. `upsert: false` means
     *    a collision fails loudly rather than overwriting somebody's file.
     */
    const storedPaths: string[] = [];

    const rollback = async () => {
      if (storedPaths.length > 0) {
        await supabase.storage.from(COMMENT_IMAGE_BUCKET).remove(storedPaths);
      }
      await supabase.from("product_comment").delete().eq("id", commentId);
    };

    for (const [index, image] of prepared.images.entries()) {
      const path = `${product.slug}/${commentId}/${index}.${COMMENT_IMAGE_EXTENSION[image.type]}`;

      const { error: uploadError } = await supabase.storage
        .from(COMMENT_IMAGE_BUCKET)
        .upload(path, image.bytes, {
          contentType: image.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("[comments] Upload rejected:", uploadError.message);
        await rollback();
        return { ok: false, error: "delivery" };
      }

      storedPaths.push(path);
    }

    let imageRows: unknown[] = [];

    if (storedPaths.length > 0) {
      const { data: inserted, error: imageError } = await supabase
        .from("product_comment_image")
        .insert(
          storedPaths.map((storage_path, index) => ({
            comment_id: commentId,
            storage_path,
            width: prepared.images[index].width,
            height: prepared.images[index].height,
            sort_order: index,
          })),
        )
        .select("id, storage_path, width, height, sort_order");

      /*
       * A comment whose photographs are in the bucket but absent from the
       * table would render as words with the pictures silently missing, and
       * nothing would ever reconcile it. A clean failure the visitor can retry
       * is the better outcome, so the objects and the row both go.
       */
      if (imageError) {
        console.error("[comments] Image rows rejected:", imageError.message);
        await rollback();
        return { ok: false, error: "delivery" };
      }

      imageRows = inserted ?? [];
    }

    // Mapped by the same function the thread query uses, so the row the author
    // sees immediately and the row everyone else sees after revalidation are
    // produced by one piece of code.
    const comment = toComment({
      ...(data as Record<string, unknown>),
      product_comment_image: imageRows,
    });

    if (!comment) {
      console.error("[comments] Insert returned an unreadable row.");
      await rollback();
      return { ok: false, error: "delivery" };
    }

    /*
     * 8. The page is ISR at 300s (see the route's `revalidate`), so without
     *    this the comment would be invisible to everyone else for up to five
     *    minutes. Both locales, because the same thread renders on each.
     *
     *    The path comes from `productHref()` rather than a `/perfume/` literal:
     *    a body mist's thread lives at `/ritual/…`, and revalidating a hard-
     *    coded perfume path would purge a page that does not exist while
     *    leaving the one the visitor just wrote on stale.
     */
    const path = productHref(product);
    for (const locale of LOCALES) {
      revalidatePath(`/${locale}${path}`);
    }

    return { ok: true, comment };
  } catch (cause) {
    console.error(
      "[comments] Insert threw:",
      cause instanceof Error ? cause.message : "unknown error",
    );
    return { ok: false, error: "delivery" };
  }
}
