"use client";

import { usePathname } from "next/navigation";

import { ACCOUNT_TABS, activeTab } from "@/src/components/account/account-nav";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { stripLocale } from "@/src/lib/i18n/config";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * The account's tab bar on phones — fixed to the bottom of the viewport.
 *
 * Replaces the horizontally scrolling strip that sat sticky under the site
 * header. That strip spent ~68px of the top of every screen and put the
 * sections where a thumb cannot reach; here they cost the bottom 64px, where
 * it can. `lg:hidden`: the desktop rail is the same four links.
 *
 * Safe-area aware (`env(safe-area-inset-bottom)`) so the labels clear the
 * iPhone home indicator. `data-account-tabbar` is what `globals.css` keys the
 * body's bottom padding on (`body:has(...)`), so the site footer — which
 * renders after the account layout — still scrolls fully clear of the bar.
 */
export default function AccountTabBar() {
  const dict = useDictionary().account.hub.tabs;
  const { path } = stripLocale(usePathname());
  const current = activeTab(path);

  return (
    <nav
      data-account-tabbar=""
      aria-label={dict.label}
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-ground-border bg-ground-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      {ACCOUNT_TABS.map(({ key, href, icon: Icon }) => {
        const isActive = key === current;

        return (
          <LocaleLink
            key={key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={[
              "relative flex h-16 flex-col items-center justify-center gap-1 no-underline",
              "text-[10px] uppercase tracking-[0.12em] transition-colors duration-300 ease-luxury-bezier",
              "rtl:text-[11px] rtl:normal-case rtl:tracking-normal",
              isActive ? "text-ground-accent" : "text-ground-muted hover:text-ground",
            ].join(" ")}
          >
            {/* The active mark: a short gold rule along the bar's top edge,
                drawn in from the centre. */}
            <span
              aria-hidden="true"
              className={[
                "absolute -top-px left-1/2 h-0.5 w-10 -translate-x-1/2 bg-ground-accent",
                "origin-center transition-transform duration-500 ease-luxury-bezier motion-reduce:transition-none",
                isActive ? "scale-x-100" : "scale-x-0",
              ].join(" ")}
            />
            <Icon size={21} strokeWidth={1.25} aria-hidden="true" />
            {dict[key]}
          </LocaleLink>
        );
      })}
    </nav>
  );
}
