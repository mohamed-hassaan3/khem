/**
 * Turning database failures into sentences.
 *
 * Not a "use server" module: it exports no action, only the two helpers every
 * action in this directory uses. Keeping them here means the mapping from a
 * Postgres error code to an editor-readable message is written once, and a
 * constraint that gains a friendlier message gains it everywhere.
 *
 * ## Why map at all
 *
 * The alternative is showing the raw provider message. `duplicate key value
 * violates unique constraint "Product_sku_key"` tells an engineer exactly what
 * happened and tells the person filling in the form nothing they can act on —
 * and it leaks the schema's internal names to whatever is on the other end of
 * the request. Unmapped codes still fall through to a generic sentence, with
 * the real message going to the server log where it belongs.
 */

import type { z } from "zod";

import type { AdminActionResult } from "@/src/schemas/admin";

/** The shape supabase-js hands back in `{ error }`. */
export interface PostgresErrorLike {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

/** What kind of row the caller was writing, for the message wording. */
export type AdminEntity = "collection" | "product" | "article" | "image";

/**
 * Returned when `SUPABASE_SECRET_KEY` is absent.
 *
 * Unreachable in a configured deployment — the dashboard cannot render its
 * lists without the same client — but handled explicitly, because a silent
 * success here would tell an editor their work was saved when nothing was
 * written.
 */
export const UNCONFIGURED: AdminActionResult = {
  ok: false,
  message:
    "The database is not configured on this deployment, so nothing was saved.",
};

/**
 * First error per field, keyed by the schema path.
 *
 * Same shape and same "first one wins" rule as `actions/comments.ts`: a field
 * with three complaints needs the editor to read one of them, not all three.
 */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    // Nested paths (`images.2.url`) are joined so the gallery editor can find
    // the row an error belongs to.
    const key = issue.path.map((part) => String(part)).join(".");
    if (key.length > 0 && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

/** Which unique constraint fired, from the provider's message. */
function uniqueViolation(
  error: PostgresErrorLike,
  entity: AdminEntity,
): AdminActionResult {
  const text = `${error.message} ${error.details ?? ""}`;

  if (text.includes("_sku_key")) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: { sku: "Another product already uses this SKU." },
    };
  }

  if (text.includes("_slug_key") || text.includes("_pkey")) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: {
        slug: `That slug is already taken by another ${entity}. Pick a different one.`,
      },
    };
  }

  if (text.includes("one_primary")) {
    return {
      ok: false,
      message: "Only one image can be marked as the primary.",
    };
  }

  return { ok: false, message: "That value is already used by another row." };
}

/**
 * Map a provider error onto something an editor can act on.
 *
 * The caller has already logged the raw message; this decides only what the
 * form says.
 */
export function postgresFailure(
  error: PostgresErrorLike,
  entity: AdminEntity,
): AdminActionResult {
  switch (error.code) {
    case "23505":
      return uniqueViolation(error, entity);

    case "23503":
      // Both directions of the same foreign key: a product pointing at a
      // collection that is not there, or a collection something still points at.
      return entity === "collection"
        ? {
            ok: false,
            message:
              "This collection still has products in it. Move or archive them first.",
          }
        : {
            ok: false,
            message: "Some fields need attention.",
            fieldErrors: { collectionSlug: "That collection no longer exists." },
          };

    case "23514":
      if (error.message.includes("product_strength_or_format")) {
        return {
          ok: false,
          message: "Some fields need attention.",
          fieldErrors: {
            concentration:
              "A product needs either a concentration (fragrances) or a format line (body, home, sets).",
          },
        };
      }
      return {
        ok: false,
        message: "One of these values is outside the range the database allows.",
      };

    case "23502":
      return { ok: false, message: "A required field was left empty." };

    default:
      return {
        ok: false,
        message: "The database refused that change. The details are in the server log.",
      };
  }
}
