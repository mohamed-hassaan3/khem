"use client";

import { CURRENCIES, isCurrency } from "@/src/lib/currency";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useCurrency } from "@/src/providers/currency-provider";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";

/**
 * The visitor's way to overrule the currency their location resolved to.
 *
 * A native `<select>`, not the inline rail `LanguageSwitcher` uses: two
 * languages fit on a line, six currencies do not, and a native control brings
 * keyboard support, the platform's own dropdown, and correct behaviour on touch
 * for free — none of which a hand-rolled popover would match without a great
 * deal more code.
 *
 * ## Codes, not names
 *
 * The options are ISO codes, so the control says exactly what the price beside
 * it says. They are Latin either way, which is why the whole thing is an LTR
 * island on the Arabic tree — the same treatment `src/lib/i18n/rtl.ts` gives
 * every other English token. The translated currency *names* are not wasted:
 * they carry the conversion note in `ProductPurchase` and `CartSummary`, where
 * the sentence around them is prose.
 *
 * ## Inert until hydrated
 *
 * The server renders USD because that is what the prices in the same HTML say
 * (`currency-provider.tsx`). Until the cookie has been read, the control is
 * disabled rather than absent: it holds its width, so the footer bar does not
 * reflow when the real currency arrives.
 */
export default function CurrencySwitcher() {
  const { currency, setCurrency, isHydrated } = useCurrency();
  const dictionary = useDictionary();
  const locale = useLocale();

  return (
    <select
      value={currency}
      disabled={!isHydrated}
      onChange={(event) => {
        // The value comes back as a string; the guard is what keeps a tampered
        // option out of the cookie.
        const next = event.target.value;
        if (isCurrency(next)) setCurrency(next);
      }}
      aria-label={dictionary.currencySwitcher.label}
      {...ltrIsland(locale)}
      className="cursor-pointer appearance-none border-none bg-transparent p-0 font-body text-[11px] uppercase tracking-[0.1em] text-ground-muted/70 outline-none transition-colors duration-300 ease-luxury-bezier hover:text-ground-accent focus-visible:text-ground-accent disabled:cursor-default disabled:opacity-60"
    >
      {CURRENCIES.map((code) => (
        // The option list is drawn by the platform, so it is deliberately left
        // unstyled — a half-styled native dropdown looks broken, an unstyled
        // one looks like the operating system.
        <option key={code} value={code} className="bg-ivory text-ink">
          {code}
        </option>
      ))}
    </select>
  );
}
