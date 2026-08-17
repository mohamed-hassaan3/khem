"use server";

/**
 * Product comment submission.
 *
 * Anyone may leave one — signed in or not. What separates the two is not access
 * but attribution, and attribution is decided *here*, from the Clerk session,
 * never from the payload. `ProductCommentInput` has no name field at all, so a
 * client cannot post as someone else; the worst it can do is post as a guest.
 *
 * Ordering mirrors `actions/contact.ts`: cheapest and most traffic-shedding
 * first, so nothing touches the database before the throttle.
 *
 * Privacy: this action never logs a comment body or an author name. Failure
 * logs carry the provider error and nothing else.
 */

import { revalidatePath } from "next/cache";

import { getViewer } from "@/src/lib/auth";
import { clientKey, isRateLimited } from "@/src/lib/email/rate-limit";
import { LOCALES } from "@/src/lib/i18n/config";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import { productCommentSchema } from "@/src/schemas/comments";
import { COMMENT_COLUMNS, toComment } from "@/src/services/comments";
import { getProductBySlug } from "@/src/services/products";
import type { CommentActionResult } from "@/src/types/comments";

/**
 * Five comments per ten minutes per client.
 *
 * Higher than the contact form's three — a comment costs nobody's attention
 * directly — but still low, because the cost being controlled is a public wall
 * every visitor reads.
 */
const LIMIT = { limit: 5, windowMs: 10 * 60 * 1_000 };

/** Untrusted shape as it crosses the boundary. Zod decides what it really is. */
export interface ProductCommentFormInput {
  slug: string;
  body: string;
  /** Honeypot. Always empty for a human. */
  company: string;
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

  // 3. Authoritative validation. The textarea checked the same rules; that was
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

  const { slug, body } = parsed.data;

  /*
   * 4. The slug is untrusted input and the table has no foreign key to lean on
   *    (the catalog is still static). Matching it against the catalog is what
   *    stops the table filling with rows for products that do not exist.
   */
  //    Existence check only — nothing here renders product copy, so the
  //    default locale is the right argument.
  const product = await getProductBySlug("en", slug);
  if (!product) {
    return { ok: false, error: "validation", fieldErrors: { slug: "slugInvalid" } };
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
   * 5. Identity, from the session and only from the session. A signed-out
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
        body,
      })
      .select(COMMENT_COLUMNS)
      .single();

    // supabase-js returns `{ data, error }` rather than throwing. Not checking
    // it is the silent-drop bug: the await resolves, the form thanks the
    // visitor, and nothing was written.
    if (error) {
      console.error("[comments] Insert rejected:", error.message);
      return { ok: false, error: "delivery" };
    }

    const comment = toComment(data);
    if (!comment) {
      console.error("[comments] Insert returned an unreadable row.");
      return { ok: false, error: "delivery" };
    }

    /*
     * 6. The page is ISR at 300s (see the route's `revalidate`), so without
     *    this the comment would be invisible to everyone else for up to five
     *    minutes. Both locales, because the same thread renders on each.
     */
    for (const locale of LOCALES) {
      revalidatePath(`/${locale}/perfume/${product.slug}`);
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
