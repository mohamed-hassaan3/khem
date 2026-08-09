/**
 * Contact and boutique types.
 *
 * Kept separate from `content.ts` for the same reason `content.ts` is separate
 * from `catalog.ts`: these are a distinct domain with no Prisma model in
 * AGENTS.md §9 yet. When they move server-side they become either a small
 * `BoutiqueDetail` table or CMS globals — the service layer absorbs it.
 */

/** One row of the contact details list: boutique, email, telephone, hours. */
export interface ContactChannel {
  id: string;
  /** Uppercase label shown beside the value, e.g. "Telephone". */
  label: string;
  /**
   * Display value. May contain `\n` for multi-line values such as the address
   * and opening hours; rendered with `whitespace-pre-line`.
   */
  value: string;
  /** `mailto:` / `tel:` target, or `null` when the value is not actionable. */
  href: string | null;
}

/** A social profile shown on `/contact`. */
export interface SocialProfile {
  id: string;
  platform: string;
  /** Public handle, e.g. "@khemperfumes". */
  handle: string;
  url: string;
}
