import Image from "next/image";

import logo from "@/public/logo/logo-transparent.webp";
import NavGround from "@/src/components/NavGround";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";

/**
 * The framing around Clerk's sign-in and sign-up forms.
 *
 * A bare `<SignIn />` on a black page reads as a login widget. The house
 * furniture around it — eyebrow, Cinzel heading, gold rule — is what makes it
 * read as the door to the boutique, and it is the same furniture every other
 * KHEM page opens on.
 *
 * This is also the signed-out gate: a visitor sent here from `/account` finds
 * the guest routes offered beneath the form, so hitting a protected page never
 * dead-ends someone who simply wanted to browse.
 */

export interface AuthShellProps {
  eyebrow: string;
  /**
   * The brand mark's alt text. Passed in rather than read from a key of its
   * own: `dict.footer.logoAlt` is already the house's one description of the
   * mark in both locales, and a second string would be the same sentence
   * translated twice.
   */
  logoAlt: string;
  heading: string;
  body: string;
  guest: Dictionary["auth"];
  children: React.ReactNode;
}

export default function AuthShell({
  eyebrow,
  logoAlt,
  heading,
  body,
  guest,
  children,
}: AuthShellProps) {
  return (
    /*
     * Ivory, not obsidian. Signing in is the same kind of task as checking out
     * — a short form completed under mild impatience — and §17 puts the account
     * area in light for exactly that reason. The cinematic register belongs to
     * the pages that are selling something.
     */
    <main className="ground-ivory flex min-h-screen flex-col items-center px-4 pb-14 pt-6 sm:justify-center sm:px-8 sm:pt-16 md:pb-24 md:pt-32">
      <NavGround ground="ivory" />

      <header className="mb-5 max-w-md text-center md:mb-10">
        {/*
         * The house mark, above the words.
         *
         * A credential form is the one screen where a visitor stops to check
         * *whose* form it is, and Clerk's card cannot carry the mark itself —
         * v7 exposes no stable, typed slot for it, and the CSS route into the
         * card's header is the kind of hack that breaks on a Clerk release.
         * So it sits in the house furniture instead, where it is ours.
         *
         * Static import, like the Footer's: a relative `src` resolves against
         * the current URL and would 404 on every `/ar` route.
         */}
        <Image
          src={logo}
          alt={logoAlt}
          sizes="(min-width: 640px) 64px, 44px"
          loading="eager"
          fetchPriority="high"
          className="mx-auto mb-3 h-11 w-auto sm:mb-6 sm:h-16"
        />

        <p className="eyebrow mb-2 sm:mb-3">{eyebrow}</p>

        <h1 className="mb-3 font-heading text-[1.75rem] font-normal leading-tight text-ground sm:mb-5 sm:text-4xl">
          {heading}
        </h1>

        <div className="gold-line mx-auto mb-3 sm:mb-6" />

        <p className="text-[13px] leading-relaxed text-ground-muted sm:leading-loose">{body}</p>
      </header>

      {/*
       * Clerk's card is centred rather than stretched: its own layout has a
       * fixed comfortable measure, and forcing it wider only spreads the
       * inputs apart.
       */}
      <div className="flex w-full justify-center">{children}</div>

      <footer className="mt-8 md:mt-14 text-center">
        <p className="mb-4 text-[11px] tracking-[0.08em] text-ground-muted">
          {guest.guestLead}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <LocaleLink
            href="/collections"
            className="font-heading text-[11px] uppercase tracking-[0.15em] text-ground-accent no-underline transition-colors duration-300 hover:text-ground"
          >
            {guest.guestCollections}
          </LocaleLink>
          <span aria-hidden="true" className="h-3 w-px bg-ground-border" />
          <LocaleLink
            href="/cart"
            className="font-heading text-[11px] uppercase tracking-[0.15em] text-ground-accent no-underline transition-colors duration-300 hover:text-ground"
          >
            {guest.guestCart}
          </LocaleLink>
        </div>
      </footer>
    </main>
  );
}
