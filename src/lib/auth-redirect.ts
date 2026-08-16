import type { Locale } from "./i18n/config";
import { localizePath, stripLocale } from "./i18n/config";
import { AUTH_PATHS } from "./routes";

/**
 * Where a visitor goes back to after signing in.
 *
 * Sign-in used to end at `/account` unconditionally, which is the wrong place
 * for someone who was reading a product page and only clicked the account icon
 * — they lose their position to a portal they did not ask for. The origin
 * instead travels with the flow as a query parameter and Clerk returns them to
 * it.
 *
 * **Why this parameter name.** `redirect_url` is Clerk's own contract, not an
 * invention here: it appears in `PRESERVED_QUERYSTRING_PARAMS` inside
 * `@clerk/shared`, so Clerk carries it across every internal hop of a
 * multi-step flow (password reset, MFA challenge, SSO callback, email
 * verification) and honours it in preference to `fallbackRedirectUrl`. Nothing
 * in this codebase performs the post-login navigation itself.
 *
 * **Why the sanitizer.** The value is whatever the URL says, and anyone can
 * craft that URL. Unchecked it is a textbook open redirect: a link to our real,
 * correctly-certificated sign-in page that deposits the visitor on an
 * attacker's copy of it the moment they authenticate. Everything below exists
 * to make the target provably same-origin.
 */

/** Clerk's parameter name. Must not be renamed — see the module note. */
export const AUTH_REDIRECT_PARAM = "redirect_url";

/** True when the path addresses `/sign-in`, `/sign-up`, or a step beneath one. */
function isAuthPath(path: string): boolean {
  return Object.values(AUTH_PATHS).some(
    (authPath) => path === authPath || path.startsWith(`${authPath}/`),
  );
}

/**
 * Reduce an untrusted `redirect_url` to a path we are willing to navigate to,
 * or `null` when there is no such path.
 *
 * Accepted: a single-slash absolute path on this origin, optionally carrying a
 * query string or fragment. Everything else is rejected rather than repaired —
 * an off-site value is not a formatting mistake to fix, it is an attempt.
 */
export function sanitizeAuthRedirect(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string" || value.length === 0) return null;

  // `//evil.com` and `https://evil.com` are absolute despite the first
  // character; `/\evil.com` is the same trick spelled with the separator
  // browsers also accept.
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("\\")) return null;

  // Whitespace and control characters are how a target gets smuggled past a
  // naive check and then re-parsed differently by the browser. Written as a
  // code-point scan rather than a character class because a control-character
  // regex is exactly what `no-control-regex` exists to flag.
  if (/\s/.test(value)) return null;
  const hasControlChar = Array.from(value).some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
  if (hasControlChar) return null;

  // Returning someone to the form they just completed is a loop, not a return.
  const [pathname] = value.split(/[?#]/);
  if (isAuthPath(stripLocale(pathname).path)) return null;

  return value;
}

/**
 * The localized sign-in URL, carrying `target` as the place to return to.
 *
 * A target that does not survive {@link sanitizeAuthRedirect} is dropped
 * entirely rather than substituted, which leaves Clerk's configured fallback
 * (`/account`) to decide — the behaviour of a plain visit to `/sign-in`.
 */
export function signInPathWithReturn(
  locale: Locale,
  target: string | null | undefined,
): string {
  const signInPath = localizePath(locale, AUTH_PATHS.signIn);
  const safeTarget = sanitizeAuthRedirect(target);

  if (safeTarget === null) return signInPath;

  return `${signInPath}?${AUTH_REDIRECT_PARAM}=${encodeURIComponent(safeTarget)}`;
}

/**
 * The same, for the sign-up URL the auth forms link across to, so a visitor who
 * switches forms mid-flow is still returned to where they started.
 */
export function signUpPathWithReturn(
  locale: Locale,
  target: string | null | undefined,
): string {
  const signUpPath = localizePath(locale, AUTH_PATHS.signUp);
  const safeTarget = sanitizeAuthRedirect(target);

  if (safeTarget === null) return signUpPath;

  return `${signUpPath}?${AUTH_REDIRECT_PARAM}=${encodeURIComponent(safeTarget)}`;
}
