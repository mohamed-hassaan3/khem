/**
 * Legal document types.
 *
 * IMPORTANT: none of these are Prisma models. AGENTS.md §9 defines no table for
 * policy documents, and none is needed while the copy is authored rather than
 * managed. They live beside `content.ts` and `contact.ts` for the same reason:
 * the boundary between "already has a schema" and "still needs one" stays
 * obvious.
 *
 * When these move server-side they become either a small `LegalDocument` table
 * or CMS globals — the service layer absorbs it either way.
 */

import type { ContentImage } from "@/src/types/content";

/**
 * The closed set of legal routes.
 *
 * A union rather than free-form strings: `getLegalDocument()` indexes a record
 * keyed by this type, so a typo fails typecheck instead of producing a runtime
 * lookup miss on a page that must never 404.
 */
export type LegalDocumentSlug =
  | "privacy-policy"
  | "terms-conditions"
  | "return-exchange"
  | "cookie-policy";

/** A two-column reference table, e.g. cookie categories or retention periods. */
export interface LegalTable {
  head: readonly [string, string];
  rows: readonly (readonly [string, string])[];
}

/**
 * One renderable unit inside a section.
 *
 * A closed discriminated union rather than an HTML string: every document is
 * typechecked, and nothing ever reaches `dangerouslySetInnerHTML`.
 */
export type LegalBlock =
  | { kind: "text"; text: string }
  | { kind: "list"; items: readonly string[] }
  /** Gold-bordered callout for the one thing in a section a reader must not miss. */
  | { kind: "note"; text: string }
  | { kind: "table"; table: LegalTable }
  /**
   * A sentence ending in an internal cross-reference, e.g. Terms → Returns.
   * `href` is always an in-app route, so it renders through `next/link`.
   */
  | { kind: "link"; text: string; href: string; label: string };

export interface LegalSection {
  /** Anchor target and React `key`; kebab-case, unique within the document. */
  id: string;
  title: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  slug: LegalDocumentSlug;
  /** Uppercase kicker above the title, e.g. "Legal". */
  eyebrow: string;
  title: string;
  /**
   * One-sentence plain-language summary. Shown in the hero and reused verbatim
   * as the route's meta description.
   */
  lede: string;
  /** ISO-8601 date. Formatted at render by `formatLegalDate` — never stored as a display string. */
  updatedAt: string;
  banner: ContentImage;
  sections: readonly LegalSection[];
  /** Address for questions about this specific document. */
  contactEmail: string;
}
