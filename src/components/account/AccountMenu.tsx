"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { viewerIsAdmin } from "@/src/actions/account";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { localizePath } from "@/src/lib/i18n/config";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { ACCOUNT_PATHS, ADMIN_PATH } from "@/src/lib/routes";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";

/**
 * The house's own account menu, in place of Clerk's `<UserButton>` popover.
 *
 * ## Why this is not a themed `<UserButton>`
 *
 * Three pieces of that popover had to go: the "Manage account" row, the
 * "Secured by Clerk" badge, and the "Development mode" footer. None of them can
 * be removed properly. The badge is a paid-plan setting (see the `options`
 * comment in `src/lib/clerk-appearance.ts`), the footer is Clerk telling the
 * truth about a development instance, and "Manage account" is not removable at
 * all. Hiding any of them with CSS means shipping a selector against a hashed
 * internal class that a patch release renames — at which point the branding
 * reappears in production, or a menu item vanishes.
 *
 * So the popover is ours and the three rows simply do not exist. **Clerk keeps
 * everything that matters**: `useUser()` is still the only source of the name
 * and the address, `signOut()` still ends the session, and `/account/profile`
 * still renders Clerk's `<UserProfile>` for the records Clerk owns — name,
 * password, connected accounts, active sessions. What changed is a dropdown,
 * not an authentication boundary. `khemClerkAppearance` is untouched and still
 * themes `<SignIn>`, `<SignUp>` and `<UserProfile>`.
 *
 * ## The admin row
 *
 * A customer sees Dashboard and Sign Out. An administrator sees Admin Dashboard
 * between them.
 *
 * Which one this is cannot be known at render time. The menu lives in the
 * header of every route, so reading `currentUser()` where it renders would turn
 * the whole site dynamic — the locale layout's comment on the `<ClerkProvider
 * dynamic>` prop records exactly that cost. So the question is asked **when the
 * menu is first opened**, through `viewerIsAdmin()`, and the answer is held for
 * the life of the component: a visitor who never opens the menu never triggers
 * the call, and one who opens it repeatedly triggers it once.
 *
 * The answer decides whether a link is drawn and nothing else. `/admin` is
 * guarded by `requireAdmin()` in its layout and again in every admin Server
 * Action, so a customer who flips this boolean in their own browser earns a link
 * to a 404. That is the point of putting the check where the data is.
 */

export default function AccountMenu() {
  const dict = useDictionary();
  const locale = useLocale();
  const { user } = useUser();
  const { signOut } = useClerk();

  const [open, setOpen] = useState(false);
  /** `null` until the question has been asked and answered. */
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  /** Guards the one call, across every open and close. */
  const askedRef = useRef(false);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      /*
       * Asked on the way open, not on mount: the overwhelming majority of page
       * views never open this menu, and a request per view to decide whether to
       * draw one link for one person in the house is a poor trade.
       *
       * A failure leaves `isAdmin` false — the menu an administrator would have
       * seen minus one row, rather than a menu that refuses to open. They still
       * reach the dashboard by typing `/admin`.
       */
      if (!wasOpen && !askedRef.current) {
        askedRef.current = true;
        void viewerIsAdmin()
          .then(setIsAdmin)
          .catch(() => setIsAdmin(false));
      }

      return !wasOpen;
    });
  }, []);

  /*
   * Pointerdown rather than click: a menu that survives until mouseup reads as
   * one that failed to notice the dismissal.
   *
   * This is also what closes the menu on a navigation started elsewhere in the
   * header — the pointer lands outside first. A navigation started *inside* the
   * menu closes it in the row's own handler, which is why there is no effect
   * here watching the pathname: an App Router transition does not unmount the
   * header, but neither route to a new page leaves the popover open.
   */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const node = containerRef.current;
      if (node && !node.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Focus the first row when the menu opens, so a keyboard reaches it in one
  // step rather than tabbing through the rest of the header.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  /*
   * The rows, in order. The admin link is spliced in rather than appended:
   * Sign Out is the last thing in a menu, and a destructive-feeling row that
   * moves as a link appears above it is a row somebody eventually clicks by
   * mistake.
   */
  const rows = [
    { key: "dashboard", label: dict.nav.dashboard, href: ACCOUNT_PATHS.overview },
    ...(isAdmin === true
      ? [{ key: "admin", label: dict.nav.adminDashboard, href: ADMIN_PATH }]
      : []),
  ];

  /** The live rows, in DOM order, with the holes left by removed ones dropped. */
  function focusableItems(): HTMLElement[] {
    return itemRefs.current.filter((item): item is HTMLElement => item !== null);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close(true);
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    event.preventDefault();

    const items = focusableItems();
    if (items.length === 0) return;

    const current = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    // Wraps in both directions, and starts at the top when focus is elsewhere.
    const next = (current + step + items.length) % items.length;

    items[next]?.focus();
  }

  const fullName = user?.fullName?.trim() || null;
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const initial = (fullName ?? email ?? "K").charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="relative flex shrink-0 items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-label={dict.nav.accountMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={toggle}
        onKeyDown={onKeyDown}
        className="flex h-[26px] w-[26px] cursor-pointer items-center justify-center overflow-hidden rounded-full border border-gold/30 bg-gold/10 transition-colors duration-300 ease-luxury-bezier hover:border-gold/70"
      >
        {user?.hasImage && user.imageUrl ? (
          <Image
            src={user.imageUrl}
            alt=""
            width={26}
            height={26}
            className="h-[26px] w-[26px] object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="font-heading text-[11px] font-semibold text-gold"
          >
            {initial}
          </span>
        )}
      </button>

      {/*
       * `end-0` and not `right-0`: the panel hangs off the trailing edge of the
       * trigger in both directions, which is the start edge on the Arabic tree.
       *
       * Kept mounted while closed so the fade has something to run on, and
       * `inert` so a closed menu holds no focus and reads to nothing — the same
       * treatment the mobile drawer gets in `Nav`.
       */}
      <div
        id="account-menu"
        role="menu"
        aria-label={dict.nav.accountMenu}
        inert={!open}
        onKeyDown={onKeyDown}
        className={[
          "absolute end-0 top-[calc(100%+18px)] z-1002 w-64 origin-top",
          "border border-border bg-[color-mix(in_srgb,var(--color-surface)_96%,transparent)] backdrop-blur-xl",
          "rounded-[2px] shadow-[var(--shadow-luxury)]",
          "transition-all duration-400 ease-luxury-bezier",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-0.5 opacity-0",
        ].join(" ")}
      >
        <div className="border-b border-border px-5 py-4">
          {fullName ? (
            <p className="mb-1 font-heading text-[13px] font-normal text-ivory">
              {fullName}
            </p>
          ) : null}

          {/* An address is a Latin string whose order carries meaning. */}
          {email ? (
            <p
              {...ltrIsland(locale)}
              className="truncate text-[11px] tracking-[0.05em] text-ivory/35"
            >
              {email}
            </p>
          ) : null}
        </div>

        {rows.map((row, index) => (
          <LocaleLink
            key={row.key}
            href={row.href}
            role="menuitem"
            ref={(node: HTMLAnchorElement | null) => {
              itemRefs.current[index] = node;
            }}
            onClick={() => close()}
            className="block border-b border-border px-5 py-4 font-heading text-[11px] tracking-[0.12em] text-ivory/70 no-underline transition-colors duration-300 ease-luxury-bezier hover:bg-gold/6 hover:text-gold focus-visible:bg-gold/6 focus-visible:text-gold"
          >
            {row.label}
          </LocaleLink>
        ))}

        <button
          type="button"
          role="menuitem"
          ref={(node) => {
            itemRefs.current[rows.length] = node;
            // The admin row can disappear between renders; without this the
            // array keeps a stale entry past the end and the arrow keys walk
            // onto a detached node.
            itemRefs.current.length = rows.length + 1;
          }}
          onClick={() => {
            close();
            // Derived from the provider's locale, never from a prop or a query
            // string, so it cannot become an open redirect.
            void signOut({ redirectUrl: localizePath(locale, "/") });
          }}
          className="block w-full cursor-pointer bg-transparent px-5 py-4 text-start font-heading text-[11px] tracking-[0.12em] text-ivory/40 transition-colors duration-300 ease-luxury-bezier hover:bg-gold/6 hover:text-gold focus-visible:bg-gold/6 focus-visible:text-gold"
        >
          {dict.nav.signOut}
        </button>
      </div>
    </div>
  );
}
