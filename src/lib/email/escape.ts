/**
 * HTML escaping for values that reach an email template.
 *
 * The most important file in the contact pipeline. Everything interpolated
 * into `templates.ts` is attacker-controlled text that lands in an inbox a
 * KHEM colleague will open — mail clients render HTML, so an unescaped message
 * body is stored XSS with a human delivery mechanism.
 *
 * Server-only by construction: nothing here imports React or touches state.
 */

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape the five characters that can break out of HTML text or an attribute. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]!);
}

/**
 * Escape, then turn newlines into `<br>`.
 *
 * Order matters and is the whole point: converting newlines first would leave
 * the injected `<br>` tags to be escaped into visible `&lt;br&gt;`, and any
 * attempt to fix that by escaping around them reopens the hole.
 */
export function escapeMultiline(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>");
}

/**
 * Strip CR/LF from a value bound for a mail header.
 *
 * Defence in depth — the subject is enum-validated before it gets here, so
 * this should never have anything to remove. It stays because a header
 * injection is unrecoverable and the check costs one pass over a short string.
 */
export function stripHeaderBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}
