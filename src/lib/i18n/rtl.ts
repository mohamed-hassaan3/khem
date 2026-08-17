import { LOCALE_DIRECTION, type Locale } from "./config";

/**
 * Attributes that mark a subtree as English left-to-right content.
 *
 * ## When to use this, and when to use `dir="auto"` instead
 *
 * This helper is for text that is Latin script *by design, in every locale*:
 * house and perfume names, botanical binomials, SKUs, email addresses, `@`
 * handles, and `tel:` targets. Those are known at author time to be LTR, and
 * pinning `lang="en"` also stops a screen reader announcing them in an Arabic
 * voice. Every remaining call site should carry a comment naming the value it
 * guards.
 *
 * It is **not** the tool for database prose any more. Since
 * `supabase/sql/0007_i18n_content.sql` the content tables carry Arabic columns,
 * and `resolveText()` falls back to English when one is missing — so whether a
 * given field is Arabic or English is a runtime fact about the row, not a
 * compile-time one about the field. Those elements take `dir="auto"`, which
 * resolves direction from the first strong character of the text that actually
 * rendered: Arabic copy lays out RTL, a fallback English string lays out LTR,
 * and neither needs the component to know which it got.
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

/**
 * The mirror of {@link readingArrow} — "back the way you came".
 *
 * Its own function rather than an inversion written at the call site, because
 * "the opposite of the reading arrow" is a rule about direction and belongs
 * beside the rule it opposes.
 */
export function backArrow(locale: Locale): string {
  return LOCALE_DIRECTION[locale] === "rtl" ? "→" : "←";
}
