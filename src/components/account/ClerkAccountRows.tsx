"use client";

import { UserProfile } from "@clerk/nextjs";
import { ChevronRight, LockKeyhole, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { khemUserProfileAppearance } from "@/src/lib/clerk-appearance";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * Profile's "Account" group: two rows that open Clerk's own account screens.
 *
 * Clerk owns name, email, phone, password, connected accounts and sessions —
 * writing them means its Backend API, and the sessions list has no hand-built
 * equivalent — so these rows do not rebuild any of it. They open
 * `<UserProfile routing="hash">` in a sheet, starting at its profile page
 * (`#/`) or its security page (`#/security`).
 *
 * The sheet rises from the bottom on a phone and fades in centred on desktop.
 * It is a real modal: `role="dialog"`, `aria-modal`, Escape and the backdrop
 * close it, the page behind stops scrolling, and focus returns to the row that
 * opened it. Clerk mounts only while it is open, so a Profile visit that never
 * opens it never pays for Clerk's UI.
 *
 * Portalled to `<body>` so no ancestor can ever become its containing block:
 * a transformed ancestor captures `position: fixed`, and that once clipped
 * this "full-screen" sheet to the Account group (see `.acct-rise`).
 */
type Page = "profile" | "security";

export interface ClerkAccountRowsProps {
  /** e.g. "Google connected · 2 active sessions"; null when Clerk could not say. */
  securityDetail: string | null;
}

export default function ClerkAccountRows({ securityDetail }: ClerkAccountRowsProps) {
  const dict = useDictionary().account.hub.profile;
  const [open, setOpen] = useState<Page | null>(null);
  const returnRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpen(null);
    // Leave the URL as it was before Clerk's hash routing touched it.
    if (window.location.hash.startsWith("#/")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    returnRef.current?.focus();
  }, []);

  function launch(page: Page, trigger: HTMLButtonElement) {
    returnRef.current = trigger;
    // Clerk's hash router reads its starting page from the fragment on mount.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#/${page === "security" ? "security" : ""}`,
    );
    setOpen(page);
  }

  useEffect(() => {
    if (open === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const rows: { page: Page; icon: typeof UserRound; title: string; detail: string | null }[] = [
    { page: "profile", icon: UserRound, title: dict.details, detail: null },
    { page: "security", icon: LockKeyhole, title: dict.security, detail: securityDetail },
  ];

  return (
    <>
      {rows.map(({ page, icon: Icon, title, detail }) => (
        <button
          key={page}
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => launch(page, event.currentTarget)}
          className="group flex min-h-14 w-full cursor-pointer items-center gap-3 border-t border-ground-border bg-transparent px-4 py-3 text-start text-ground transition-colors duration-300 first:border-t-0 hover:bg-ground-bg/60"
        >
          <Icon size={18} strokeWidth={1.25} aria-hidden="true" className="shrink-0 text-ground-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px]">{title}</span>
            {detail ? (
              <span className="mt-0.5 block truncate text-[11px] text-ground-muted rtl:text-[12px]">{detail}</span>
            ) : null}
          </span>
          <ChevronRight
            size={16}
            strokeWidth={1.25}
            aria-hidden="true"
            className="shrink-0 text-ground-muted transition-transform duration-500 ease-luxury-bezier group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
          />
        </button>
      ))}

      {open !== null
        ? createPortal(
        <div className="fixed inset-0 z-[1002] flex items-end justify-center sm:items-center sm:p-6">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={close}
            className="acct-fade absolute inset-0 cursor-default bg-ink/45 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={open === "security" ? dict.security : dict.details}
            className="acct-sheet relative flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-2xl border border-ground-border bg-ground-bg shadow-3 sm:max-w-3xl sm:rounded-xl"
          >
            <div className="flex items-center justify-between border-b border-ground-border px-4 py-2">
              <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-ground-border sm:hidden" />
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label={dict.close}
                className="absolute end-2 top-1.5 grid size-11 cursor-pointer place-items-center rounded-md bg-transparent text-ground-muted transition-colors duration-300 hover:text-ground"
              >
                <X size={18} strokeWidth={1.25} aria-hidden="true" />
              </button>
              <span className="h-10" />
            </div>
            <div className="overflow-y-auto">
              <UserProfile routing="hash" appearance={khemUserProfileAppearance} />
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
