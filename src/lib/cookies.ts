/**
 * Guarded `document.cookie` access.
 *
 * The cookie counterpart to `storage.ts`, and it exists for the same two
 * reasons that file does:
 *
 * 1. **It is not always there.** `document` does not exist during SSR, and a
 *    browser configured to block storage entirely can throw on write. Every
 *    access is wrapped; a failure degrades to "no persistence", never to a
 *    crashed render.
 *
 * 2. **Its contents are untrusted input.** Anything — a visitor, a script that
 *    reached the page, a stale value written by an older build — can sit under
 *    a cookie name. Values are parsed through a caller-supplied type guard, and
 *    a blob that fails it is treated as absent.
 *
 * Deliberately minimal: one read, one write, no `Max-Age` parsing, no domain
 * handling. The only cookie the client writes today is the display currency.
 */

function getDocument(): Document | null {
  try {
    return typeof document === "undefined" ? null : document;
  } catch {
    return null;
  }
}

/**
 * Read and validate a cookie.
 *
 * Anything `isValid` rejects — an absent cookie, a malformed value, a hostile
 * payload — resolves to `fallback`. The fallback is typed separately from the
 * validated value so a caller can pass `null` to tell "absent" apart from "set
 * to the default", which is a real distinction for a preference cookie.
 */
export function readCookie<T, F = T>(
  name: string,
  isValid: (value: unknown) => value is T,
  fallback: F,
): T | F {
  const doc = getDocument();
  if (doc === null) return fallback;

  try {
    const prefix = `${name}=`;

    for (const entry of doc.cookie.split(";")) {
      const trimmed = entry.trim();
      if (!trimmed.startsWith(prefix)) continue;

      const raw = decodeURIComponent(trimmed.slice(prefix.length));
      return isValid(raw) ? raw : fallback;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Write a cookie for the whole origin.
 *
 * `SameSite=Lax` because nothing here needs to survive a cross-site POST, and
 * `Secure` only in production so the cookie still works over plain HTTP on
 * localhost. No `HttpOnly`: this is written from the browser, and the values it
 * carries are display preferences with no security meaning — which is exactly
 * why nothing else may be stored through it.
 */
export function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  const doc = getDocument();
  if (doc === null) return;

  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";

    doc.cookie =
      `${name}=${encodeURIComponent(value)}` +
      `; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
  } catch {
    // Storage blocked entirely. The choice still applies for this page view —
    // it simply will not survive the next one.
  }
}
