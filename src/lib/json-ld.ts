/**
 * Serialising structured data into a `<script>` tag, safely.
 *
 * ## The bug this exists to prevent
 *
 * `JSON.stringify` escapes quotes and backslashes. It does **not** escape `<`:
 *
 *     JSON.stringify({ headline: "</script><img src=x onerror=…>" })
 *     → {"headline":"</script><img src=x onerror=…>"}
 *
 * An HTML parser ends a `<script>` element at the first literal `</script>` in
 * its text, whatever the JavaScript string context around it says. So a stored
 * value containing that sequence closes the tag early and everything after it
 * is parsed as markup — stored XSS, executing for every reader of the page.
 *
 * This is not hypothetical for KHEM: journal articles are authored in the
 * dashboard and rendered publicly, and `title`, `excerpt`, `category` and the
 * image URL all reach the JSON-LD block. The dashboard is properly protected by
 * `requireAdmin()`, so reaching this needs admin access — but the payload then
 * runs in every anonymous reader's browser, including another administrator's.
 * Admin-authored content rendered publicly is still untrusted input.
 *
 * ## The fix, and why it is lossless
 *
 * `<` becomes `<`. That is a valid JSON escape which parses back to exactly
 * `<`, so every consumer — Google's Rich Results parser included — sees the
 * string it was given. Nothing is stripped, nothing is rewritten, and no caller
 * has to remember to sanitise its own values.
 *
 * ## Why a shared helper rather than a `.replace()` at the call site
 *
 * There is one JSON-LD block in the codebase today and there are about to be
 * several — Product, Offer, Organization, WebSite and BreadcrumbList are all
 * scheduled. A per-call-site fix is a rule each of those has to remember; a
 * helper is one they cannot forget, because the escaping is not theirs to do.
 *
 * ⚠ Every `<script type="application/ld+json">` in this app must take its
 * `__html` from here. There is no second correct way to do it.
 */

import "server-only";

/**
 * A JSON-LD document, ready for `dangerouslySetInnerHTML`.
 *
 * @example
 * <script
 *   type="application/ld+json"
 *   dangerouslySetInnerHTML={jsonLdHtml(jsonLd)}
 * />
 */
export function jsonLdHtml(document: unknown): { __html: string } {
  return { __html: JSON.stringify(document).replace(/</g, "\\u003c") };
}
