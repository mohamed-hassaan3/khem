"use client";

import { localizePath } from "@/src/lib/i18n/config";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";
import { useKhemSession } from "@/src/providers/session-provider";

/**
 * Ends the session.
 *
 * The page this replaced rendered a "Sign Out" button wired to nothing at all
 * — it had a hover colour and no `onClick`.
 *
 * `redirectUrl` is built through `localizePath` from the provider's locale, so
 * an Arabic visitor lands on `/ar` rather than being dropped into the English
 * tree by their own sign-out. It is derived, never taken from a prop or a
 * query string, so it cannot become an open redirect.
 */

export default function SignOutButton({
  className = "",
  variant = "link",
}: {
  className?: string;
  /**
   * `link` — the quiet text control at the foot of the desktop rail.
   * `block` — the full-width, 48px button closing the Profile panel on phones,
   * where there is no rail.
   */
  variant?: "link" | "block";
}) {
  const { signOut } = useKhemSession();
  const dict = useDictionary();
  const locale = useLocale();

  return (
    <button
      type="button"
      onClick={() => void signOut(localizePath(locale, "/"))}
      className={[
        variant === "block"
          ? "flex h-12 w-full cursor-pointer items-center justify-center rounded-md border border-ground-border bg-transparent font-heading text-[11px] uppercase tracking-[0.2em] text-ground transition-colors duration-300 ease-luxury-bezier hover:border-ground-accent hover:text-ground-accent"
          : "min-h-11 cursor-pointer bg-transparent p-0 text-start font-heading text-[11px] tracking-[0.12em] text-ground-muted transition-colors duration-300 hover:text-ground",
        className,
      ].join(" ")}
    >
      {dict.nav.signOut}
    </button>
  );
}
