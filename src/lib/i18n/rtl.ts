import { LOCALE_DIRECTION, type Locale } from "./config";

/**
 * Attributes that mark a subtree as English left-to-right content.
 *
 * The records in `src/data/*.ts` (products, testimonials, ingredients, craft
 * steps, timeline, legal documents) are English-only in this pass. Dropping
 * them raw into an RTL page misplaces trailing punctuation, reverses list
 * markers, and leaves screen readers announcing English in an Arabic voice —
 * so each such block is explicitly re-anchored to `ltr`/`en`.
 *
 * Returns an empty object on the English tree, where the page direction
 * already matches and the attributes would be redundant.
 */
export function ltrIsland(locale: Locale) {
  return LOCALE_DIRECTION[locale] === "rtl"
    ? ({ dir: "ltr", lang: "en" } as const)
    : ({} as const);
}

export type LtrIsland = ReturnType<typeof ltrIsland>;

/**
 * A "continue reading" arrow that points the way the text runs.
 *
 * `→` in an RTL context reads as "backwards"; the mirrored glyph is the
 * correct affordance, and unlike a CSS transform it stays crisp at any size.
 */
export function readingArrow(locale: Locale): string {
  return LOCALE_DIRECTION[locale] === "rtl" ? "←" : "→";
}
