"use client";

import { useClerk } from "@clerk/nextjs";

import { localizePath } from "@/src/lib/i18n/config";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";

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
}: {
  className?: string;
}) {
  const { signOut } = useClerk();
  const dict = useDictionary();
  const locale = useLocale();

  return (
    <button
      type="button"
      onClick={() => signOut({ redirectUrl: localizePath(locale, "/") })}
      className={[
        "cursor-pointer bg-transparent p-0 font-heading text-[11px] tracking-[0.12em]",
        "text-ground-muted/70 transition-colors duration-300 hover:text-ground-muted",
        className,
      ].join(" ")}
    >
      {dict.nav.signOut}
    </button>
  );
}
