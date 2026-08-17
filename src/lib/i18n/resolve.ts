/**
 * Locale resolution for database records.
 *
 * The content tables carry a nullable `foo_ar` beside every translatable `foo`
 * (see `supabase/sql/0007_i18n_content.sql`). These two helpers are the single
 * place that decides which of the pair a page shows, and they are called from
 * the row mappers in `src/schemas/db/*` — never from a component.
 *
 * That placement is the point. By the time a record reaches the UI its fields
 * are plain `string`s, so every type in `src/types/*` and every component prop
 * shape stays exactly as it was, and "UI displays stored data only"
 * (AGENTS.md §6) keeps meaning what it says. The alternative — handing
 * components a `Record<Locale, string>` — would push locale resolution into the
 * view layer and put a translation lookup in every card.
 *
 * Nothing here imports React or Next, matching `config.ts`: it is safe in the
 * proxy, in Server Components, and in the seed scripts alike.
 */

import { DEFAULT_LOCALE, type Locale } from "./config";

/**
 * Whether a translation is actually present.
 *
 * A blank or whitespace-only string is a missing translation, not a deliberate
 * empty one — that is what an admin leaving the Arabic field untouched produces.
 */
function isTranslated(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * The text for `locale`, falling back to English.
 *
 * Falls back when the locale is the default, when the translation is null (the
 * seeded state for anything deliberately left in Latin script), or when it is
 * blank. Nothing ever renders empty because a translator has not reached the
 * record yet.
 *
 * Callers render the result under `dir="auto"` so a fallback English string
 * still lays out left-to-right inside an Arabic page — see `rtl.ts`.
 */
export function resolveText(
  english: string,
  arabic: string | null | undefined,
  locale: Locale,
): string {
  if (locale === DEFAULT_LOCALE) return english;
  return isTranslated(arabic) ? arabic : english;
}

/** {@link resolveText} for a nullable field, preserving `null`. */
export function resolveOptionalText(
  english: string | null,
  arabic: string | null | undefined,
  locale: Locale,
): string | null {
  if (locale === DEFAULT_LOCALE) return english;
  if (isTranslated(arabic)) return arabic;
  return english;
}

/**
 * The list for `locale`, falling back to English **as a whole**.
 *
 * All-or-nothing on purpose. A note pyramid half in Arabic and half in English
 * reads as a bug rather than as a graceful degradation, and the arrays are
 * positional — `topNotes[1]` is what the card grids render — so a shorter
 * Arabic array must never be zipped against the English one.
 */
export function resolveList(
  english: readonly string[],
  arabic: readonly string[] | null | undefined,
  locale: Locale,
): string[] {
  if (locale === DEFAULT_LOCALE) return [...english];

  const translated =
    Array.isArray(arabic) &&
    arabic.length === english.length &&
    arabic.every(isTranslated);

  return translated ? [...arabic] : [...english];
}
