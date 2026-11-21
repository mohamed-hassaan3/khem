"use client";

import { usePathname } from "next/navigation";

import { ACCOUNT_TABS, activeTab } from "@/src/components/account/account-nav";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { stripLocale } from "@/src/lib/i18n/config";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * The account's desktop rail — the same four sections as the phone tab bar
 * (`account-nav.ts`), drawn as a vertical list with icons.
 *
 * A client component for one reason: `usePathname()` marks the active
 * section. The identity block above it stays a Server Component, so the
 * session's name and email are never serialized into the client bundle.
 *
 * Shown from `lg` only. Below that the tab bar is the navigation.
 */
export default function AccountSidebar() {
  const dict = useDictionary().account.hub.tabs;
  const { path } = stripLocale(usePathname());
  const current = activeTab(path);

  return (
    <nav aria-label={dict.label} className="flex flex-col gap-1">
      {ACCOUNT_TABS.map(({ key, href, icon: Icon }) => {
        const isActive = key === current;

        return (
          <LocaleLink
            key={key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={[
              "flex h-11 items-center gap-3 rounded-md px-3 no-underline",
              "font-heading text-[11px] uppercase tracking-[0.16em] rtl:text-[13px] rtl:normal-case rtl:tracking-normal",
              "transition-[background-color,color,box-shadow] duration-300 ease-luxury-bezier",
              isActive
                ? "bg-ground-bg text-ground-accent shadow-[inset_2px_0_0_var(--ground-accent)] rtl:shadow-[inset_-2px_0_0_var(--ground-accent)]"
                : "text-ground-muted hover:bg-ground-bg/60 hover:text-ground",
            ].join(" ")}
          >
            <Icon size={18} strokeWidth={1.25} aria-hidden="true" />
            {dict[key]}
          </LocaleLink>
        );
      })}
    </nav>
  );
}
