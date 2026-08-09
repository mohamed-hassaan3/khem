/**
 * Legal document query layer.
 *
 * Same contract as `contact.ts`: the UI awaits these functions, so swapping the
 * source (Supabase table or CMS globals) is a change of function bodies only.
 */

// NOTE: add `import "server-only"` here once that package is installed.

import { LEGAL_DOCUMENTS, LEGAL_DOCUMENT_ORDER } from "@/src/data/legal";
import type { LegalDocument, LegalDocumentSlug } from "@/src/types/legal";

/**
 * → supabase.from('LegalDocument').select('*').eq('slug', slug).single()
 *
 * No `notFound()` branch: `slug` is a closed union and the record is keyed by
 * it, so a miss is impossible at compile time.
 */
export async function getLegalDocument(
  slug: LegalDocumentSlug,
): Promise<LegalDocument> {
  return LEGAL_DOCUMENTS[slug];
}

/**
 * → supabase.from('LegalDocument').select('*').order('sortOrder')
 *
 * Returns the four documents in navigation order. Used by the footer, a future
 * `/legal` index, and the sitemap.
 */
export async function getLegalDocuments(): Promise<LegalDocument[]> {
  return LEGAL_DOCUMENT_ORDER.map((slug) => LEGAL_DOCUMENTS[slug]);
}
