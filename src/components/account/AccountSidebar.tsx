"use client";

import { usePathname } from "next/navigation";

import SignOutButton from "@/src/components/account/SignOutButton";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { stripLocale } from "@/src/lib/i18n/config";
import { useDictionary } from "@/src/providers/i18n-provider";
import { ACCOUNT_PATHS } from "@/src/lib/routes";

/**
 * The portal's navigation rail.
 *
 * A client component for one reason — it needs `usePathname()` to mark the
 * active section. The identity block above it stays a Server Component, so the
 * session's name and email are never serialized into the client bundle.
 *
 * The panels were tabs in `useState` before this change. They are routes now:
 * shareable, back-button correct, and each one free to become its own query.
 *
 */

export default function AccountSidebar({
  unreadCount = 0,
}: {
  /**
   * How many notifications are new.
   *
   * A quiet numeral beside one rail entry, and the *only* place a count appears
   * anywhere on the storefront: §16 asks for optional and non-intrusive, so
   * there is no bell over the shop and no badge in the header. Somebody who has
   * come to their account sees it; somebody browsing fragrances does not.
   */
  unreadCount?: number;
}) {
  const dict = useDictionary();
  const pathname = usePathname();

  // `usePathname()` returns the *public* path (`/ar/account`, `/account`), so
  // it is stripped back to the locale-agnostic form the link table holds.
  const { path } = stripLocale(pathname);

  /*
   * The dashboard's sections, in the order the customer is likely to want
   * them: who they are, what they have bought, where it goes, what the house
   * owes them, then the two settings panels.
   */
  const links = [
    { href: ACCOUNT_PATHS.overview, label: dict.account.nav.overview },
    { href: ACCOUNT_PATHS.profile, label: dict.account.nav.profile },
    { href: ACCOUNT_PATHS.orders, label: dict.account.nav.orders },
    { href: ACCOUNT_PATHS.addresses, label: dict.account.nav.addresses },
    { href: ACCOUNT_PATHS.vouchers, label: dict.account.nav.vouchers },
    { href: ACCOUNT_PATHS.notifications, label: dict.account.nav.notifications },
    { href: ACCOUNT_PATHS.preferences, label: dict.account.nav.preferences },
  ] as const;

  return (
    <>
      <nav
        aria-label={dict.account.nav.label}
        /*
         * Under `lg` the rail becomes a horizontally scrolling strip. The old
         * page pinned a 280px sidebar at every width, which left the panels
         * roughly 95px wide on a phone.
         */
        className="flex gap-1 overflow-x-auto px-4 py-3 lg:flex-col lg:overflow-visible lg:px-5 lg:py-0"
      >
        {links.map((link) => {
          // Exact match only: `/account` must not light up on `/account/orders`.
          const isActive = path === link.href;
          const showCount =
            link.href === ACCOUNT_PATHS.notifications && unreadCount > 0;

          return (
            <LocaleLink
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={[
                "shrink-0 whitespace-nowrap px-4 py-3.5 font-heading text-xs tracking-[0.12em] no-underline",
                "border-b-2 lg:border-b-0 lg:border-s-2",
                "transition-colors duration-300 ease-luxury-bezier",
                isActive
                  ? "border-gold bg-gold/8 text-gold"
                  : "border-transparent text-ivory/45 hover:text-ivory/80",
              ].join(" ")}
            >
              {link.label}

              {showCount ? (
                <span className="ms-2 font-heading text-[10px] tabular-nums text-gold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </LocaleLink>
          );
        })}
      </nav>

      <div className="mt-auto hidden border-t border-border px-9 py-5 lg:block">
        <SignOutButton />
      </div>
    </>
  );
}
