/**
 * Locale configuration — the single source of truth for KHEM's supported
 * languages.
 *
 * Strategy is `as-needed` prefixing: English is the default and keeps the
 * unprefixed URLs the site already ships (`/heritage`), Arabic is prefixed
 * (`/ar/heritage`). `src/proxy.ts` rewrites unprefixed requests into the
 * internal `/en/*` tree so the visible URL never changes.
 *
 * Nothing here imports React or Next — it is safe in the proxy (Node runtime),
 * in Server Components, and in Client Components alike.
 */

export const LOCALES = ["en", "ar"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export type Direction = "ltr" | "rtl";

export const LOCALE_DIRECTION: Record<Locale, Direction> = {
  en: "ltr",
  ar: "rtl",
};

/** Each language names itself. These are never translated. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
};

/** Compact labels for the desktop switcher rail. */
export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  ar: "ع",
};

/** Value for the `lang` attribute and `hreflang` link annotations. */
export const LOCALE_HTML_TAG: Record<Locale, string> = {
  en: "en",
  ar: "ar",
};

/** OpenGraph expects a language_TERRITORY pair, not a bare language tag. */
export const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  ar: "ar_EG",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Reject anything that is not a same-origin absolute path.
 *
 * Route params and `usePathname()` are untrusted input: a crafted value like
 * `//evil.com` or `https://evil.com` would otherwise flow into a `<Link href>`
 * and produce an off-site navigation from what looks like an internal link.
 */
function normalizePath(path: string): string {
  if (!path.startsWith("/")) return "/";
  // Protocol-relative URLs (`//host`) are absolute despite the leading slash.
  if (path.startsWith("//")) return "/";
  return path;
}

/**
 * Map a locale-agnostic app path onto a locale.
 *
 * `localizePath("en", "/heritage") === "/heritage"` (default locale is
 * unprefixed), `localizePath("ar", "/heritage") === "/ar/heritage"`, and
 * `localizePath("ar", "/") === "/ar"`.
 *
 * Idempotent: passing an already-prefixed path does not double-prefix it.
 */
export function localizePath(locale: Locale, path: string): string {
  const safePath = normalizePath(path);

  if (locale === DEFAULT_LOCALE) return safePath;

  const prefix = `/${locale}`;
  if (safePath === prefix || safePath.startsWith(`${prefix}/`)) return safePath;

  return safePath === "/" ? prefix : `${prefix}${safePath}`;
}

/**
 * Inverse of {@link localizePath}: split a real pathname into the locale it
 * addresses and the locale-agnostic path beneath it.
 *
 * `stripLocale("/ar/heritage") === { locale: "ar", path: "/heritage" }`
 * `stripLocale("/heritage")    === { locale: "en", path: "/heritage" }`
 */
export function stripLocale(pathname: string): {
  locale: Locale;
  path: string;
} {
  const safePath = normalizePath(pathname);

  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;

    const prefix = `/${locale}`;
    if (safePath === prefix) return { locale, path: "/" };
    if (safePath.startsWith(`${prefix}/`)) {
      return { locale, path: safePath.slice(prefix.length) };
    }
  }

  return { locale: DEFAULT_LOCALE, path: safePath };
}

/**
 * `alternates` block for a page's metadata.
 *
 * Every URL advertises both language variants of *itself* plus an `x-default`
 * pointing at the English version, which is what search engines need in order
 * to serve the right locale rather than treating the two trees as duplicates.
 *
 * Lives here rather than in the layout so pages can import it without pulling
 * the layout's font, Nav, and Footer modules into their graph.
 */
export function localeAlternates(locale: Locale, path: string) {
  return {
    // Each locale is canonical for its own URL — pointing Arabic at the English
    // URL would ask search engines to drop the Arabic tree from the index.
    canonical: localizePath(locale, path),
    languages: {
      en: localizePath("en", path),
      ar: localizePath("ar", path),
      "x-default": localizePath("en", path),
    },
  };
}
