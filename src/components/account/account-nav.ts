import { House, Package, Ticket, UserRound, type LucideIcon } from "lucide-react";

import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { ACCOUNT_PATHS } from "@/src/lib/routes";

/**
 * The account's four sections — one table for the phone tab bar and the
 * desktop rail, so the two can never list different destinations.
 *
 * Notifications is deliberately not a section: the bell and the activity feed
 * on Home are its two doors, and `/account/notifications` remains the page both
 * open. Addresses and Preferences live inside Profile.
 */
export type AccountTabKey = keyof Omit<
  Dictionary["account"]["hub"]["tabs"],
  "label"
>;

export interface AccountTab {
  key: AccountTabKey;
  href: string;
  icon: LucideIcon;
}

export const ACCOUNT_TABS: readonly AccountTab[] = [
  { key: "home", href: ACCOUNT_PATHS.overview, icon: House },
  { key: "orders", href: ACCOUNT_PATHS.orders, icon: Package },
  { key: "wallet", href: ACCOUNT_PATHS.vouchers, icon: Ticket },
  { key: "profile", href: ACCOUNT_PATHS.profile, icon: UserRound },
];

/**
 * Which tab a (locale-stripped) path belongs to.
 *
 * Prefix-matched, Home excepted: `/account/notifications` and the redirect
 * stubs are under Home's prefix and must not light up a different tab, so
 * anything that is not one of the three named sections belongs to Home.
 */
export function activeTab(path: string): AccountTabKey {
  for (const tab of ACCOUNT_TABS) {
    if (tab.key === "home") continue;
    if (path === tab.href || path.startsWith(`${tab.href}/`)) return tab.key;
  }
  return "home";
}
