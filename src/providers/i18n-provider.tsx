"use client";

import { createContext, useContext, useMemo } from "react";

import {
  LOCALE_DIRECTION,
  type Direction,
  type Locale,
} from "@/src/lib/i18n/config";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";

interface I18nContextValue {
  locale: Locale;
  dir: Direction;
  dictionary: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Makes the active locale and its dictionary available to Client Components.
 *
 * Mounted once in the `[locale]` root layout. Server Components should call
 * `getDictionary()` directly rather than reaching for these hooks.
 */
export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({ locale, dir: LOCALE_DIRECTION[locale], dictionary }),
    [locale, dictionary],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (context === null) {
    throw new Error("useI18n must be used within an <I18nProvider>.");
  }

  return context;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

export function useDir(): Direction {
  return useI18n().dir;
}

export function useDictionary(): Dictionary {
  return useI18n().dictionary;
}
