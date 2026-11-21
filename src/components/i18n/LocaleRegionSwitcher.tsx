"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  LOCALES,
  LOCALE_HTML_TAG,
  LOCALE_LABELS,
  LOCALE_SHORT_LABELS,
  localizePath,
  stripLocale,
  type Locale,
} from "@/src/lib/i18n/config";
import {
  EUROPE,
  INTERNATIONAL,
  SWITCHER_REGIONS,
  currencyForRegion,
  representativeCountry,
  type Region,
} from "@/src/lib/currency";
import { useCurrency } from "@/src/providers/currency-provider";
import { useI18n } from "@/src/providers/i18n-provider";

/**
 * One control for the language the site is read in and the country its prices
 * are drawn for.
 *
 * It replaces two: an inline `EN | AR` rail in the header and a currency
 * `<select>` in the footer. The second was a question about *where the visitor
 * is* asked in the vocabulary of currency codes, at the bottom of the page,
 * where nobody looking for it would think to look. Both answers are now behind
 * one trigger that states them — `EN · Egypt` — and one panel that offers them.
 *
 * ## The country is the choice; the currency follows
 *
 * `currency-provider.tsx` still owns the currency, and every price still reads
 * it. Choosing a country writes the country cookie *and* commits the currency
 * that country is priced in, so the two cannot be set to disagree. Nothing
 * about the prerendering guarantee changes: the server still renders the base
 * currency and this control is inert until the cookies have been read.
 *
 * ## One row per currency
 *
 * The country is only ever used to pick the display currency — the house
 * ships within Egypt alone, and checkout never reads this choice — so the list
 * offers the six outcomes that exist (`SWITCHER_REGIONS`): Egypt, Saudi
 * Arabia, UAE, UK, Europe, International. It once listed all twenty eurozone
 * countries by name, twenty rows that did the same thing. The order is the
 * house's and is not re-sorted per language.
 *
 * ## The current row says so
 *
 * The active language and the active country carry a visible "Current" /
 * "حاليًا" beside their name, not colour alone. One country row is always
 * current once the cookies are read: a chosen region, else the one the
 * detected currency implies, else International.
 *
 * ## Country names are formatted, not translated
 *
 * `Intl.DisplayNames` names the four countries in the reading locale — the
 * same mechanism `src/lib/shipping.ts` uses for the checkout's country field.
 * Europe and International are regions, not countries, and come from the
 * dictionary.
 */

/**
 * How a locale's own name is presented.
 *
 * Latin labels carry the house's wide uppercase tracking; Arabic must not.
 * Letter-spacing breaks the joins between Arabic glyphs, turning a connected
 * word into disconnected letterforms — this is a correctness rule, not a
 * stylistic preference.
 *
 * `dir` travels with the class for the same reason. On an Arabic page the RTL
 * rule in `globals.css` strips letter-spacing from everything that is not an
 * explicit LTR island, which would flatten the `English`/`EN` label's tracking
 * along with it. Both facts come off one branch so they cannot drift apart.
 */
function labelAttributes(locale: Locale) {
  return locale === "ar"
    ? { dir: "rtl" as const, className: "tracking-normal" }
    : { dir: "ltr" as const, className: "uppercase tracking-[0.2em]" };
}

const ROW =
  "flex w-full items-center justify-between gap-6 px-4 py-2 text-start text-[11px] no-underline transition-colors duration-300 ease-luxury-bezier";

/** The rule between the two lists, drawn across the panel rather than as the
 * 60px `gold-line` flourish, which reads as an ornament and not as a divider. */
const DIVIDER = "my-3 h-px w-full bg-ground-border";

const ROW_IDLE = "text-ground-muted hover:text-ground-accent";
const ROW_ACTIVE = "text-ground-accent";

/**
 * The "Current" marker beside an active row's name.
 *
 * It is chrome in the page's language, so it follows the reading locale, not
 * the row's: on the Arabic page the English row's marker is still "حاليًا".
 * Arabic takes no letter-spacing and no case — see `labelAttributes`.
 */
function CurrentMarker({ locale, label }: { locale: Locale; label: string }) {
  return (
    <span
      lang={LOCALE_HTML_TAG[locale]}
      className={[
        "shrink-0 whitespace-nowrap text-[9px] text-ground-subtle",
        locale === "ar" ? "tracking-normal" : "uppercase tracking-[0.15em]",
      ].join(" ")}
    >
      <span aria-hidden="true">· </span>
      {label}
    </span>
  );
}

export default function LocaleRegionSwitcher({
  variant = "compact",
}: {
  /** `compact` for the desktop nav rail, `full` for the mobile drawer. */
  variant?: "compact" | "full";
}) {
  const { locale: activeLocale, dictionary } = useI18n();
  const { currency, region, setRegion, isHydrated } = useCurrency();
  const pathname = usePathname();
  const panelId = useId();

  /*
   * Open-ness is derived against the path, the shape `<Nav>` uses for its own
   * menus: a language row inside the panel navigates, and the panel must be
   * closed when the new route paints. Deriving it means no effect has to
   * *notice* the navigation and close it in a second render pass.
   */
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [openRequested, setOpenRequested] = useState(false);
  const isOpen = openRequested && openPath === pathname;

  // Stable per path, so the dismissal effect below re-subscribes only when the
  // route actually changes.
  const setIsOpen = useCallback(
    (next: boolean) => {
      setOpenPath(pathname);
      setOpenRequested(next);
    },
    [pathname],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The pathname always carries the locale prefix (`/ar/...`) even though the
  // English URL the visitor sees is unprefixed, so strip it back to the
  // locale-agnostic path before re-prefixing for the target locale.
  const { path } = stripLocale(pathname);

  const tag = LOCALE_HTML_TAG[activeLocale];

  /**
   * The country rows, in the house's fixed order, named in the reading locale.
   *
   * ## Short names
   *
   * A country is called what it is called: "UAE", not "United Arab Emirates",
   * which is the form the header rail has room for and the form a visitor is
   * looking for. Three sources, in order — the house's own short names
   * (`regionSwitcher.shortNames`, translated, and the only ones written down),
   * then CLDR's `style: "short"`, then the full name. The middle one is not
   * redundant: it shortens what it knows, but which countries those are varies
   * by ICU version, and the UAE is one Chrome does not shorten today.
   *
   * `Intl.DisplayNames` can throw on an environment without the region data, so
   * the whole construction is guarded: a browser that cannot name countries
   * gets the codes rather than an empty panel. Europe and International are
   * never passed to `Intl` — they are not regions it knows.
   */
  const shortNames: Record<string, string> = dictionary.regionSwitcher.shortNames;

  const countries = useMemo(() => {
    let name = (code: string) => shortNames[code] ?? code;

    try {
      const short = new Intl.DisplayNames([tag], {
        type: "region",
        style: "short",
      });
      const long = new Intl.DisplayNames([tag], { type: "region" });

      name = (code: string) => {
        const house = shortNames[code];
        if (house !== undefined) return house;

        const abbreviated = short.of(code);
        // `of()` returns the code itself when it knows no name for it, which is
        // not a name — fall through to the long form before giving up.
        if (abbreviated !== undefined && abbreviated !== code) return abbreviated;

        return long.of(code) ?? code;
      };
    } catch {
      /* Codes it is. */
    }

    const { europe, international } = dictionary.regionSwitcher;

    return SWITCHER_REGIONS.map((code) => ({
      code,
      name:
        code === EUROPE ? europe : code === INTERNATIONAL ? international : name(code),
      currency: currencyForRegion(code),
    }));
  }, [tag, shortNames, dictionary.regionSwitcher]);

  /**
   * The current row, and what the trigger says.
   *
   * A chosen region is stated. Failing that, the region the *detected
   * currency* implies — every currency but the dollar belongs to one row — and
   * failing that International. Never `null`, so one row is always current.
   * See `representativeCountry`.
   */
  const activeRegion: Region =
    region ?? representativeCountry(currency) ?? INTERNATIONAL;

  const regionLabel =
    countries.find((entry) => entry.code === activeRegion)?.name ?? activeRegion;

  const currentLabel = dictionary.regionSwitcher.current;

  // Closing on outside click is `pointerdown`, not `click`: a click that lands
  // on a link elsewhere on the page should dismiss the panel before it
  // navigates, not after.
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && containerRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      // A keyboard visitor must not be dropped on `<body>`.
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, setIsOpen]);

  const trigger = labelAttributes(activeLocale);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={dictionary.regionSwitcher.label}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen(!isOpen)}
        className={[
          "flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 font-body",
          variant === "compact" ? "text-[10px]" : "text-xs",
          isOpen ? "text-ground-accent" : "text-ground-muted",
          "transition-colors duration-300 ease-luxury-bezier hover:text-ground-accent",
        ].join(" ")}
      >
        <span dir={trigger.dir} lang={tag} className={trigger.className}>
          {LOCALE_SHORT_LABELS[activeLocale]}
        </span>
        <span aria-hidden="true" className="inline-block h-2.5 w-px bg-border" />
        {/*
          An em dash until the cookies have been read, rather than a country
          nobody chose: the server renders the base currency (see
          `currency-provider.tsx`), so any country printed here before hydration
          would be a guess that changes under the visitor a frame later. The
          placeholder holds the trigger's shape while the real answer arrives.
        */}
        <span className={activeLocale === "ar" ? "tracking-normal" : "tracking-[0.08em]"}>
          {isHydrated ? regionLabel : "—"}
        </span>
        <ChevronDown
          width={13}
          height={13}
          strokeWidth={1.25}
          aria-hidden="true"
          className={[
            "transition-transform duration-300 ease-luxury-bezier",
            isOpen ? "rotate-180" : "rotate-0",
          ].join(" ")}
        />
      </button>

      <div
        id={panelId}
        inert={!isOpen}
        className={[
          /*
           * The compact panel floats under the trigger; the drawer's opens in
           * place. Logical properties throughout — `end-0` anchors the panel to
           * the trigger's trailing edge under both directions, where `right-0`
           * would hang it off the wrong side of an Arabic header.
           */
          variant === "compact"
            ? "ground-ivory absolute end-0 top-[calc(100%+14px)] z-1002 w-64 border border-ground-border shadow-3"
            : "ground-ivory relative mt-4 w-full border border-ground-border",
          "py-4 transition-all duration-300 ease-luxury-bezier motion-reduce:transition-none",
          isOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1.5 opacity-0",
          // A panel faded out is still a panel: in the drawer it would hold its
          // rows' height open below the trigger.
          isOpen ? "" : variant === "full" ? "hidden" : "",
        ].join(" ")}
      >
        <p className="eyebrow px-4 pb-2">{dictionary.regionSwitcher.language}</p>
        <nav aria-label={dictionary.regionSwitcher.language}>
          {LOCALES.map((locale) => {
            const isActive = locale === activeLocale;
            const { dir, className } = labelAttributes(locale);

            return (
              <Link
                key={locale}
                href={localizePath(locale, path)}
                hrefLang={LOCALE_HTML_TAG[locale]}
                aria-current={isActive ? "true" : undefined}
                onClick={() => setIsOpen(false)}
                className={`${ROW} ${isActive ? ROW_ACTIVE : ROW_IDLE}`}
              >
                {/*
                  `dir` sits on the label, not on the row. On the row it also
                  reverses the row's own alignment, which pushed العربية to the
                  opposite edge from English and made two peers read as two
                  different kinds of thing.
                */}
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span dir={dir} lang={LOCALE_HTML_TAG[locale]} className={className}>
                    {LOCALE_LABELS[locale]}
                  </span>
                  {isActive ? (
                    <CurrentMarker locale={activeLocale} label={currentLabel} />
                  ) : null}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className={DIVIDER} aria-hidden="true" />

        <p className="eyebrow px-4 pb-2">{dictionary.regionSwitcher.country}</p>
        {/*
          Six rows, so no scroll container: the panel fits a phone's height as
          it is. Before hydration no row is current — the trigger shows an em
          dash for the same reason (the server cannot know the visitor's
          currency).
        */}
        <div role="group" aria-label={dictionary.regionSwitcher.country}>
          {countries.map((entry) => {
            const isActive = isHydrated && activeRegion === entry.code;

            return (
              <button
                key={entry.code}
                type="button"
                disabled={!isHydrated}
                aria-current={isActive ? "true" : undefined}
                onClick={() => {
                  setRegion(entry.code);
                  setIsOpen(false);
                }}
                className={`${ROW} cursor-pointer ${
                  isActive ? ROW_ACTIVE : ROW_IDLE
                } disabled:cursor-default disabled:opacity-60`}
              >
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span>{entry.name}</span>
                  {isActive ? (
                    <CurrentMarker locale={activeLocale} label={currentLabel} />
                  ) : null}
                </span>
                {/*
                  The currency the row commits to, stated on the row rather than
                  left to be discovered on the next price. Latin either way, so it
                  is an LTR island on the Arabic panel.
                */}
                <span
                  dir="ltr"
                  lang="en"
                  className="shrink-0 text-[10px] uppercase tracking-[0.1em] opacity-70"
                >
                  {entry.currency}
                </span>
              </button>
            );
          })}
        </div>

        <p className="px-4 pt-3 text-[10px] leading-relaxed text-ground-subtle">
          {dictionary.regionSwitcher.note}
        </p>
      </div>
    </div>
  );
}
