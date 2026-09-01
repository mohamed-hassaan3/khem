import Image from "next/image";

import nameLogo from "@/public/logo/name-logo-transparent.webp";
import FooterDisclosure from "@/src/components/FooterDisclosure";
import FooterGroup from "@/src/components/FooterGroup";
import CookieSettingsButton from "@/src/components/consent/CookieSettingsButton";
import CurrencySwitcher from "@/src/components/i18n/CurrencySwitcher";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import {
  collections as collectionColumn,
  collectionLinks as collectionEntries,
  quickAccess,
  world,
} from "@/src/constants/navigation-pages";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";

/*
 * Ground-relative, even though the footer is charcoal on every page and §21
 * says it stays that way. The colours are written against `--ground-*` so the
 * footer carries its ground *explicitly* (`.ground-charcoal` on the element)
 * rather than by inheriting whatever `body` happens to be — which is the exact
 * assumption that made the rest of the site dark-only.
 *
 * Charcoal, not the obsidian this was. Obsidian is #0d0d0d and belonged to a
 * site that was dark all the way up; against an ivory page it reads as a hole
 * cut in the document. `--color-ink` is the same charcoal the type on every
 * light section is set in, so the footer lands as the palette's structural
 * colour filling the frame — a deliberate ending rather than a change of mode.
 */
const footerLinkClass =
  "text-xs tracking-[0.05em] text-ground-muted no-underline transition-colors duration-300 hover:text-ground-accent";

const socialLinkClass =
  "text-[10px] tracking-[0.15em] text-ground-muted no-underline transition-colors duration-300 hover:text-ground-accent";

const legalLinkClass =
  "text-[11px] tracking-[0.08em] text-ground-muted/70 no-underline transition-colors duration-300 hover:text-ground";

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
  /*
   * `collectionEntries` is the nav's column with its "Fragrances" group already
   * flattened away. The group is a disclosure, and a footer sitemap has nothing
   * to disclose — every collection is simply listed.
   */
  const collectionLinks = [
    ...collectionEntries.map((c) => ({
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
    <footer className="ground-charcoal border-t border-ground-border pt-12 md:pt-20">
      {/*
        `gap-0` below `md`: the groups are accordion rows there and each draws
        its own bottom rule, so a gap would break the run of dividers into
        floating segments. The column gap returns with the columns.
      */}
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-0 px-4 pb-12 sm:px-6 md:gap-16 md:px-10 md:pb-20 lg:grid-cols-[2fr_1fr_1fr_1fr] lg:gap-16 lg:px-12 xl:px-16">
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
              sizes="151px"
              className="h-16 w-auto"
            />
          </LocaleLink>
          <p className="mb-8 max-w-[300px] text-[13px] leading-[1.9] text-ground-muted">
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

        <FooterGroup title={dict.footer.collections}>
          {/*
           * Two renderings of the same destinations, one per width — the shape
           * `<FooterGroup>` itself already uses for its heading, and for the
           * same reason: what is right on a phone is wrong on a desktop.
           *
           * On a phone the group is a disclosure the visitor opened on purpose,
           * and a flat run of links inside it is the shortest thing to thumb
           * through. Subheadings there would add rows to a panel whose whole
           * value is that it is closed by default. **Unchanged.**
           *
           * On a desktop it is a column that is always open, and fifteen
           * undifferentiated links is a wall — the menu prints the same shelf
           * in three parts and is legible because of it. So from `md` up the
           * column is walked in its *native* shape, groups included, and reads
           * the way the navigation reads.
           *
           * Both are the same table (`collections` / `quickAccess`), so the two
           * widths cannot come to disagree about which collections exist.
           */}
          <nav
            className="flex flex-col gap-3.5 md:hidden"
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

          <nav
            className="hidden flex-col gap-3.5 md:flex"
            aria-label={dict.footer.collections}
          >
            {collectionColumn.map((entry) =>
              entry.kind === "group" ? (
                /*
                 * A group is a disclosure, not a link: there is no page at
                 * "Fragrances" for it to lead to — the rows beneath it say it
                 * better — and the column is long enough that being able to
                 * close the parts you are not reading is the point. Each one
                 * is independent; opening Scent Profiles leaves Fragrances
                 * exactly as the reader left it.
                 */
                <FooterDisclosure
                  key={entry.key}
                  title={dict.nav.collectionGroups[entry.key]}
                >
                  {entry.children.map((child) => (
                    <LocaleLink
                      key={child.path}
                      href={child.path}
                      className={`${footerLinkClass} ps-3`}
                    >
                      {dict.nav.collectionItems[child.key].label}
                    </LocaleLink>
                  ))}
                </FooterDisclosure>
              ) : (
                <LocaleLink
                  key={entry.path}
                  href={entry.path}
                  className={footerLinkClass}
                >
                  {dict.nav.collectionItems[entry.key].label}
                </LocaleLink>
              ),
            )}

            {/*
              The ways in close the column, as they do on a phone — and as a
              disclosure too, because it is a group of the same kind even
              though it comes from a different table.
            */}
            <FooterDisclosure title={dict.nav.quickAccess}>
              {quickAccess.map((item) => (
                <LocaleLink
                  key={item.path}
                  href={item.path}
                  className={`${footerLinkClass} ps-3`}
                >
                  {dict.nav.quickAccessItems[item.key]}
                </LocaleLink>
              ))}
            </FooterDisclosure>
          </nav>
        </FooterGroup>

        <FooterGroup title={dict.footer.worldOfKhem}>
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
        </FooterGroup>

        <FooterGroup title={dict.footer.myAccount}>
          <nav
            className="mb-6 md:mb-10 flex flex-col gap-3.5"
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
            <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-ground-muted/70">
              {dict.footer.boutique}
            </p>
            <p className="whitespace-pre-line text-xs leading-[1.8] text-ground-muted">
              {dict.footer.boutiqueAddress}
            </p>
            <p className="text-xs leading-[1.8]">
              <a
                // href="tel:+20000000000"
                className="text-ground-accent/80 no-underline transition-colors hover:text-ground-accent"
              >
                {/* +20 00 000 0000 */} {dict.common.comingSoon}
              </a>
            </p>
          </div>
        </FooterGroup>
      </div>

      <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 border-t border-ground-border px-4 py-6 sm:px-6 md:flex-row md:items-center md:px-10 lg:px-12 xl:px-16">
        <p className="text-[11px] tracking-[0.1em] text-ground-muted/70">
          {interpolate(dict.footer.rights, { year })}
        </p>
        <div className="flex flex-wrap gap-4 md:gap-7">
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
          <p className="text-[11px] tracking-[0.08em] text-ground-muted/60">
            {dict.footer.craftedIn}
          </p>
        </div>
      </div>
    </footer>
  );
}
