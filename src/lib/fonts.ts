import { Amiri, Cinzel, IBM_Plex_Sans_Arabic, Inter } from "next/font/google";

import { DEFAULT_LOCALE, type Locale } from "./i18n/config";

/**
 * `preload: false` on every face is deliberate.
 *
 * `next/font` emits `<link rel="preload">` for each font reachable from a
 * route's module graph. This module declares all four faces and the `[locale]`
 * layout serves both locales, so preloading made *every* page fetch all eight
 * woff2 files — English visitors downloading Amiri and IBM Plex Sans Arabic,
 * Arabic visitors downloading Cinzel and Inter. Splitting the module does not
 * help: the layout's imports are static, so both pairs are always in scope.
 *
 * Without preload hints the browser fetches only the faces the rendered text
 * actually uses. The cost is that those faces are discovered after CSS parse
 * rather than from the document head; `display: "swap"` keeps text visible
 * throughout, so this trades a small FOUT window for halving the font payload.
 */

/* ── Latin (en) ─────────────────────────────────────── */

export const headingFont = Cinzel({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

export const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

/* ── Arabic (ar) ────────────────────────────────────── */

/**
 * Cinzel and Inter carry no Arabic glyphs, so the Arabic tree needs its own
 * pair. Amiri is a classical Naskh with the same editorial, inscriptional
 * register as Cinzel; IBM Plex Sans Arabic is the neutral UI companion Inter
 * plays in English.
 *
 * Both are declared under the *same* CSS variable names as their Latin
 * counterparts, so `globals.css` needs no locale-aware font rules — the layout
 * simply mounts one pair or the other.
 */
export const arHeadingFont = Amiri({
  subsets: ["arabic"],
  variable: "--font-heading",
  weight: ["400", "700"],
  display: "swap",
  preload: false,
});

export const arBodyFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

/**
 * The font variable classes for a locale.
 *
 * Only the active locale's fonts are mounted, so an English visitor never
 * downloads Amiri and an Arabic visitor never downloads Cinzel.
 */
export function getFontVariables(locale: Locale): string {
  return locale === DEFAULT_LOCALE
    ? `${headingFont.variable} ${bodyFont.variable}`
    : `${arHeadingFont.variable} ${arBodyFont.variable}`;
}
