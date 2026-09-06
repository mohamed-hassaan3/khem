/**
 * ⚠️ TEMPORARY — the pre-launch cover. Delete this module at launch.
 *
 * One boolean decides whether KHEM is a shop or a Coming Soon card, and this
 * file is the only place that reads it. `src/proxy.ts` asks it what to do with a
 * request; `app/prelaunch/page.tsx` asks it whether it may render. Nothing else
 * in the repository knows the feature exists.
 *
 * ## Why the flag is server-only
 *
 * `KHEM_PRELAUNCH`, not `NEXT_PUBLIC_KHEM_PRELAUNCH`. A `NEXT_PUBLIC_` value is
 * inlined into the JavaScript every visitor downloads, so the site would ship a
 * readable announcement of its own launch state — and the only reader that needs
 * it is the proxy, which runs on the server. There is no client component in
 * this feature that reads any of this: `PRELAUNCH_FILM_SRC` reaches the browser
 * as a prop from a Server Component, which is why this module has no
 * `"use client"` sibling and needs none.
 *
 * ## Fail-safe
 *
 * Off is the default and off means *nothing changes*. The flag is `true` only
 * for the literal word, after trimming and lower-casing; `"1"`, `"yes"`, `"on"`,
 * an empty string and a typo all mean off. Trimming and folding are deliberate
 * in the other direction too — somebody who writes `TRUE` or leaves a trailing
 * space plainly meant yes, and silently ignoring them would be its own trap.
 *
 * There is no partial state. Every consequence in this file hangs off the one
 * boolean, so no combination of environment variables can produce a half-covered
 * site.
 *
 * ## Removing the whole feature
 *
 * Delete `src/app/prelaunch/`, `src/components/prelaunch/`, this file,
 * `src/docs/prelaunch.md`, `public/prelaunch/` if a film was added, the two
 * blocks in `src/proxy.ts`, the `/prelaunch` entry in `src/app/robots.ts`, the
 * two variables in `.env.example`, and the section in `AGENTS.md`. That is the
 * complete footprint.
 */

/**
 * Where the cover lives.
 *
 * Outside `app/[locale]/` on purpose — see `app/prelaunch/layout.tsx`. `/` is
 * *rewritten* here rather than redirected, so the address bar keeps the
 * canonical home URL and the cover never becomes a second indexable address for
 * the front page.
 */
export const PRELAUNCH_PATH = "/prelaunch";

/**
 * A film to play over the light field, or `null` for the field alone.
 *
 * **This is the whole video-replacement procedure.** Set
 * `KHEM_PRELAUNCH_VIDEO_URL` to either a path under `public/` (drop the file at
 * `public/prelaunch/khem-cover.mp4` and use `/prelaunch/khem-cover.mp4`) or a
 * full remote URL. No component, route or stylesheet changes either way.
 *
 * `null` is a first-class answer and the shipped default: `<PrelaunchFilm>`
 * renders the authored light field underneath a film at all times, so with no
 * film configured the cover is complete, and with one configured the field is
 * what the visitor looks at until the first frame decodes. That is why this
 * feature needs no poster image — and why no part of the composition is tuned to
 * one frame of one video.
 */
export const PRELAUNCH_FILM_SRC: string | null =
  process.env.KHEM_PRELAUNCH_VIDEO_URL ?? null;

/**
 * Whether the storefront is covered.
 *
 * Read on each call rather than memoised, matching `allowedEmails()` in
 * `src/lib/admin/auth.ts`: in development the variable can change between
 * requests, and the parse is a comparison.
 */
export function prelaunchEnabled(): boolean {
  return (process.env.KHEM_PRELAUNCH ?? "").trim().toLowerCase() === "true";
}

/**
 * Path prefixes the cover must never touch, whatever the flag says.
 *
 * `/admin` and `/account` because the house has to keep trading while the shop
 * front says Coming Soon. The auth routes because they are how anyone reaches
 * those. `/unsubscribe` because it is the address printed in every marketing
 * email already sent, and covering it would turn a temporary presentation layer
 * into a compliance problem. `/design-preview` and `/prelaunch` because they sit
 * outside the locale tree and answer for themselves.
 */
const EXEMPT_PREFIXES = [
  "/admin",
  "/account",
  "/sign-in",
  "/sign-up",
  "/unsubscribe",
  PRELAUNCH_PATH,
  "/design-preview",
] as const;

/**
 * The commerce paths the cover closes.
 *
 * An explicit list rather than "everything that is not editorial", and the
 * difference matters at launch: a denylist that fell out of date could hide a
 * page nobody meant to hide, whereas a stale allowlist merely leaves a shop page
 * open — visible in a minute of testing. It also makes "when the flag is off,
 * every route behaves exactly as today" true by inspection.
 *
 * Locale-agnostic app paths, matched against `stripLocale()`'s `path`, so
 * `/cart` and `/ar/cart` cannot fall out of step.
 */
const GATED_COMMERCE_PREFIXES = [
  "/perfume",
  "/collections",
  "/set",
  "/ritual",
  "/cart",
  "/checkout",
  "/search",
  "/new-arrival",
] as const;

/**
 * Prefix match on segment boundaries.
 *
 * `/account` must not match `/accounts-payable`, and `/set` must not match
 * `/settings`. A bare `startsWith` gets both wrong, and the second one would
 * quietly close a route that has nothing to do with the shop.
 */
function matchesPath(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** True for the routes the cover leaves strictly alone. Checked first. */
export function isPrelaunchExempt(path: string): boolean {
  return matchesPath(path, EXEMPT_PREFIXES);
}

/** True for the shop routes that send a visitor back to the cover. */
export function isGatedCommercePath(path: string): boolean {
  return matchesPath(path, GATED_COMMERCE_PREFIXES);
}
