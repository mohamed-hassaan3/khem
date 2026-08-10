"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  LOCALES,
  LOCALE_HTML_TAG,
  LOCALE_LABELS,
  LOCALE_SHORT_LABELS,
  localizePath,
  stripLocale,
  type Locale,
} from "@/src/lib/i18n/config";
import { useI18n } from "@/src/providers/i18n-provider";

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

export default function LanguageSwitcher({
  variant = "compact",
}: {
  /** `compact` for the desktop nav rail, `full` for the mobile drawer. */
  variant?: "compact" | "full";
}) {
  const { locale: activeLocale, dictionary } = useI18n();
  const pathname = usePathname();

  // The pathname always carries the locale prefix (`/ar/...`) even though the
  // English URL the visitor sees is unprefixed, so strip it back to the
  // locale-agnostic path before re-prefixing for the target locale.
  const { path } = stripLocale(pathname);

  const labels = variant === "compact" ? LOCALE_SHORT_LABELS : LOCALE_LABELS;

  return (
    <nav
      aria-label={dictionary.languageSwitcher.label}
      className={
        variant === "compact"
          ? "flex items-center gap-2.5"
          : "flex items-center gap-4"
      }
    >
      {LOCALES.map((locale, index) => {
        const isActive = locale === activeLocale;
        const sizeClass = variant === "compact" ? "text-[10px]" : "text-xs";
        const { dir, className: labelClass } = labelAttributes(locale);

        return (
          <div key={locale} className="flex items-center gap-2.5">
            {index > 0 ? (
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-px bg-border"
              />
            ) : null}

            {isActive ? (
              <span
                aria-current="true"
                dir={dir}
                lang={LOCALE_HTML_TAG[locale]}
                className={`font-body ${sizeClass} ${labelClass} text-gold`}
              >
                {labels[locale]}
              </span>
            ) : (
              <Link
                href={localizePath(locale, path)}
                hrefLang={LOCALE_HTML_TAG[locale]}
                dir={dir}
                lang={LOCALE_HTML_TAG[locale]}
                className={`font-body ${sizeClass} ${labelClass} text-ivory/40 no-underline transition-colors duration-300 ease-luxury-bezier hover:text-gold`}
              >
                {labels[locale]}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
