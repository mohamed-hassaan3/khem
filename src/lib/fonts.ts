import localFont from "next/font/local";

import { DEFAULT_LOCALE, type Locale } from "./i18n/config";

/**
 * These fonts are checked in under `src/app/fonts` so a production build does
 * not depend on the shape or availability of a Google Fonts response.
 * `preload: false` remains deliberate: both locale trees are statically
 * reachable from the shared layout, and preloading here would fetch both
 * language families on every page.
 */

/* ── Latin (en) ─────────────────────────────────────── */

export const headingFont = localFont({
  src: "../app/fonts/cinzel-variable.woff2",
  weight: "400 600",
  variable: "--font-heading",
  display: "swap",
  preload: false,
});

export const bodyFont = localFont({
  src: "../app/fonts/inter-variable.woff2",
  weight: "400 600",
  variable: "--font-body",
  display: "swap",
  preload: false,
});

/* ── Arabic (ar) ────────────────────────────────────── */

export const arHeadingFont = localFont({
  src: [
    { path: "../app/fonts/amiri-regular.woff2", weight: "400" },
    { path: "../app/fonts/amiri-bold.woff2", weight: "700" },
  ],
  variable: "--font-heading",
  display: "swap",
  preload: false,
});

export const arBodyFont = localFont({
  src: [
    { path: "../app/fonts/ibm-plex-sans-arabic-regular.woff2", weight: "400" },
    { path: "../app/fonts/ibm-plex-sans-arabic-medium.woff2", weight: "500" },
    { path: "../app/fonts/ibm-plex-sans-arabic-semibold.woff2", weight: "600" },
  ],
  variable: "--font-body",
  display: "swap",
  preload: false,
});

/** The font variable classes for a locale. */
export function getFontVariables(locale: Locale): string {
  return locale === DEFAULT_LOCALE
    ? `${headingFont.variable} ${bodyFont.variable}`
    : `${arHeadingFont.variable} ${arBodyFont.variable}`;
}
