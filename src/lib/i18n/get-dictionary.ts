/**
 * Server-side dictionary loading.
 *
 * Not marked with the `server-only` package (it is not a dependency of this
 * project and the prompt calls for no new runtime deps). Client components must
 * read translations from `useDictionary()` instead of importing this module —
 * doing so would pull both dictionaries into the client bundle.
 */

import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import type { Dictionary } from "./dictionaries/en";

/**
 * Lazily loaded per locale so a visitor's RSC render only ever pulls the one
 * dictionary it needs.
 */
const loaders: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en").then((module) => module.en),
  ar: () => import("./dictionaries/ar").then((module) => module.ar),
};

/**
 * Server-only dictionary access.
 *
 * Accepts a raw `string` so route params can be passed straight through, and
 * falls back to the default locale rather than throwing — callers that need a
 * 404 for an unknown segment should guard with `isLocale()` and `notFound()`
 * first, which the `[locale]` layout does.
 */
export async function getDictionary(locale: string): Promise<Dictionary> {
  const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return loaders[resolved]();
}

export type { Dictionary };
