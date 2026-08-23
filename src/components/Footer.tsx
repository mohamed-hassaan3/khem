import Image from "next/image";

import nameLogo from "@/public/logo/name-logo-transparent.svg";
import CookieSettingsButton from "@/src/components/consent/CookieSettingsButton";
import CurrencySwitcher from "@/src/components/i18n/CurrencySwitcher";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { collections, quickAccess, world } from "@/src/constants/navigation-pages";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";

const footerLinkClass =
  "text-xs tracking-[0.05em] text-ivory/40 no-underline transition-colors duration-300 hover:text-gold";

const socialLinkClass =
  "text-[10px] tracking-[0.15em] text-ivory/35 no-underline transition-colors duration-300 hover:text-gold";

const legalLinkClass =
  "text-[11px] tracking-[0.08em] text-ivory/25 no-underline transition-colors duration-300 hover:text-ivory/60";

/** Platform names are proper nouns — the same in both locales. */
const socialLinks = ["Instagram", "Facebook", "Pinterest"] as const;

export default async function Footer({ locale }: { locale: Locale }) {
  const dict = await getDictionary(locale);
  const year = new Date().getFullYear();

  /*
   * The Nav's two shop columns, one under the other. Both tables come from
   * `src/constants/navigation-pages.ts`, so the footer offers exactly the
   * destinations the menu does — the lists cannot drift apart on the next edit
   * because there is only one list.
   */
  const collectionLinks = [
    ...collections.map((c) => ({
      label: dict.nav.collectionItems[c.key].label,
      path: c.path,
    })),
    ...quickAccess.map((item) => ({
      label: dict.nav.quickAccessItems[item.key],
      path: item.path,
    })),
  ];

  const worldLinks = [
    ...world.map((w) => ({
      label:
        w.key === "journal"
          ? dict.footer.links.theJournal
          : dict.nav.worldItems[w.key].label,
      path: w.path,
    })),
    { label: dict.footer.links.stockists, path: "/stockists" },
    { label: dict.footer.links.contact, path: "/contact" },
  ];

  const accountLinks = [
    { label: dict.footer.links.myAccount, path: "/account" },
    { label: dict.footer.links.myOrders, path: "/account" },
    { label: dict.footer.links.trackOrder, path: "/account" },
    { label: dict.footer.links.returns, path: "/return-exchange" },
  ];

  const legalLinks = [
    { label: dict.footer.links.privacyPolicy, href: "/privacy-policy" },
    { label: dict.footer.links.termsConditions, href: "/terms-conditions" },
    { label: dict.footer.links.cookiePolicy, href: "/cookie-policy" },
  ];

  return (
    <footer className="border-t border-[var(--color-border)] bg-background pt-20">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-16 px-6 pb-20 md:px-20 lg:grid-cols-[2fr_1fr_1fr_1fr] lg:gap-16">
        <div>
          <LocaleLink href="/" className="mb-7 inline-block no-underline">
            {/*
             * Static import, not a string path. A relative `src` resolves
             * against the current URL, so `"logo/…"` silently became
             * `/ar/logo/…` on every prefixed route — a 404 that the catch-all
             * answered with a full page render. Importing the asset makes a
             * relative path unrepresentable and supplies the intrinsic size.
             */}
            <Image
              src={nameLogo}
              alt={dict.footer.logoAlt}
              className="h-16 w-auto"
            />
          </LocaleLink>
          <p className="mb-8 max-w-[300px] text-[13px] leading-[1.9] text-ivory/40">
            {dict.footer.brandBlurb}
          </p>
          {/*
           * Latin proper nouns on an Arabic page. Without the explicit `ltr`
           * they are caught by the RTL `letter-spacing: normal` rule in
           * `globals.css` and lose the tracking their type depends on.
           *
           * Marked per-link rather than on the row: `dir` on the flex container
           * would also reverse the item flow, left-aligning this row inside an
           * otherwise right-aligned Arabic column.
           */}
          <div className="flex flex-wrap gap-5">
            {socialLinks.map((name) => (
              <a
                target="_blank"
                rel="noopener noreferrer"
                key={name}
                href={`https://www.${name.toLowerCase()}.com/khemperfumes/`}
                dir="ltr"
                lang="en"
                className={socialLinkClass}
              >
                {name}
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="eyebrow mb-7">{dict.footer.collections}</p>
          <nav
            className="flex flex-col gap-3.5"
            aria-label={dict.footer.collections}
          >
            {collectionLinks.map((item) => (
              <LocaleLink
                key={`${item.label}-${item.path}`}
                href={item.path}
                className={footerLinkClass}
              >
                {item.label}
              </LocaleLink>
            ))}
          </nav>
        </div>

        <div>
          <p className="eyebrow mb-7">{dict.footer.worldOfKhem}</p>
          <nav
            className="flex flex-col gap-3.5"
            aria-label={dict.footer.worldOfKhem}
          >
            {worldLinks.map((item) => (
              <LocaleLink
                key={item.label}
                href={item.path}
                className={footerLinkClass}
              >
                {item.label}
              </LocaleLink>
            ))}
          </nav>
        </div>

        <div>
          <p className="eyebrow mb-7">{dict.footer.myAccount}</p>
          <nav
            className="mb-10 flex flex-col gap-3.5"
            aria-label={dict.footer.myAccount}
          >
            {accountLinks.map((item) => (
              <LocaleLink
                key={item.label}
                href={item.path}
                className={footerLinkClass}
              >
                {item.label}
              </LocaleLink>
            ))}
          </nav>
          <div>
            <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-ivory/25">
              {dict.footer.boutique}
            </p>
            <p className="whitespace-pre-line text-xs leading-[1.8] text-ivory/40">
              {dict.footer.boutiqueAddress}
            </p>
            <p className="text-xs leading-[1.8]">
              <a
                // href="tel:+20000000000"
                className="text-gold/70 no-underline transition-colors hover:text-gold"
              >
                {/* +20 00 000 0000 */} {dict.common.comingSoon}
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 border-t border-[var(--color-border)] px-6 py-6 md:flex-row md:items-center md:px-20">
        <p className="text-[11px] tracking-[0.1em] text-ivory/25">
          {interpolate(dict.footer.rights, { year })}
        </p>
        <div className="flex flex-wrap gap-7">
          {legalLinks.map((item) => (
            <LocaleLink
              key={item.href}
              href={item.href}
              className={legalLinkClass}
            >
              {item.label}
            </LocaleLink>
          ))}
          {/*
           * The way back to a consent decision already made — a banner without
           * one is not compliant. A button rather than a link because it opens
           * the panel in place; it borrows the link class so the row still
           * reads as four peers.
           */}
          <CookieSettingsButton className={legalLinkClass} />
        </div>
        {/*
         * Currency sits beside "crafted in", not among the legal links: it is a
         * control, and the row beside it is a set of destinations. The gap keeps
         * the bar's three parts reading as three parts at `md` and above, and
         * the pair wraps together on a phone.
         */}
        <div className="flex items-center gap-5">
          <CurrencySwitcher />
          <p className="text-[11px] tracking-[0.08em] text-ivory/20">
            {dict.footer.craftedIn}
          </p>
        </div>
      </div>
    </footer>
  );
}
