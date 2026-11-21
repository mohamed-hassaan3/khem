"use client";

import { useCurrency } from "@/src/providers/currency-provider";
import { useLocale } from "@/src/providers/i18n-provider";

/**
 * The current language and display currency, e.g. "English · EGP".
 *
 * A client island because the display currency is a per-visitor choice
 * resolved after hydration (`currency-provider.tsx`); rendering it on the
 * server would print the base currency to everyone. Language names are
 * endonyms — each language named in itself — so they are not copy to
 * translate.
 */
const ENDONYM = { en: "English", ar: "العربية" } as const;

export default function RegionValue() {
  const locale = useLocale();
  const { currency, isHydrated } = useCurrency();

  return (
    <span className="shrink-0 text-[12px] text-ground-muted">
      <span>{ENDONYM[locale]}</span>
      {/* The separator stays in the surrounding direction; only the code is
          an LTR island, so Arabic reads "العربية · EGP". */}
      {isHydrated ? (
        <>
          <span aria-hidden="true"> · </span>
          <span dir="ltr">{currency}</span>
        </>
      ) : null}
    </span>
  );
}
