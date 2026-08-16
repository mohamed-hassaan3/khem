/**
 * Legal document query layer.
 *
 * Same contract as `content.ts`. One difference worth knowing: these four
 * routes must never 404, so `getLegalDocument()` throws when its document is
 * missing rather than returning `null`. A privacy policy that quietly renders
 * as an empty page is worse than a loud failure — the copy is a legal
 * obligation, not decoration.
 */

import "server-only";

import { getSupabasePublic } from "@/src/lib/supabase";
import { parseList } from "@/src/schemas/db/catalog";
import { LEGAL_DOCUMENT_COLUMNS, toLegalDocument } from "@/src/schemas/db/directory";
import type { LegalDocument, LegalDocumentSlug } from "@/src/types/legal";

function logFailure(query: string, message: string): void {
  console.error(`[legal] ${query} failed: ${message}`);
}

/**
 * One document by slug.
 *
 * `slug` is a closed union and the table's primary key is checked against the
 * same four values, so a miss means the row is absent or malformed — a
 * deployment fault, which is what the thrown error says.
 */
export async function getLegalDocument(
  slug: LegalDocumentSlug,
): Promise<LegalDocument> {
  const supabase = getSupabasePublic();

  /*
   * Three different faults used to share one message, and since these pages
   * prerender, the only place it surfaces is a build log with no stack worth
   * reading. Naming the cause is the difference between a one-line fix and an
   * afternoon: the common one by far is a deploy environment that has no
   * Supabase keys, where the query never ran at all.
   */
  if (!supabase) {
    throw new Error(
      `Legal document "${slug}" could not be read: Supabase is not configured. ` +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
        "in this environment — these pages are prerendered, so the keys must be " +
        "present at build time, not only at runtime.",
    );
  }

  const { data, error } = await supabase
    .from("LegalDocument")
    .select(LEGAL_DOCUMENT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    logFailure("getLegalDocument", error.message);
    throw new Error(
      `Legal document "${slug}" could not be read: ${error.message}`,
    );
  }

  const document = toLegalDocument(data);
  if (document) return document;

  throw new Error(`Legal document "${slug}" is missing from the database.`);
}

/**
 * The four documents in navigation order. Used by the footer, a future `/legal`
 * index, and the sitemap.
 */
export async function getLegalDocuments(): Promise<LegalDocument[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("LegalDocument")
    .select(LEGAL_DOCUMENT_COLUMNS)
    .order("sortOrder");

  if (error) {
    logFailure("getLegalDocuments", error.message);
    return [];
  }

  return parseList(data as unknown[] | null, toLegalDocument);
}
