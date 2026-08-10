import { notFound } from "next/navigation";

/**
 * Catch-all that funnels unmatched paths into the locale-aware 404.
 *
 * `src/proxy.ts` rewrites unprefixed requests into `/en/*`, so a URL that
 * matches no route — `/fr/heritage` becomes `/en/fr/heritage`, or any of the
 * not-yet-built routes the nav links to, such as `/collections` — would
 * otherwise fall past the `[locale]` segment entirely and render Next's bare
 * default 404, with no root layout, no `lang`/`dir`, and no chrome.
 *
 * Matching here keeps those requests inside the locale tree so
 * `app/[locale]/not-found.tsx` renders in the right language, while static
 * segments still take routing precedence over this catch-all.
 */
export default function CatchAll(): never {
  notFound();
}
