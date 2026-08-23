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
  heading: string;
  body: string;
  guest: Dictionary["auth"];
  children: React.ReactNode;
}

export default function AuthShell({
  eyebrow,
  heading,
  body,
  guest,
  children,
}: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 pb-14 md:pb-24 pt-16 md:pt-32 sm:px-8">
      <header className="mb-6 md:mb-10 max-w-md text-center">
        <p className="eyebrow mb-3">{eyebrow}</p>

        <h1 className="mb-5 font-heading text-3xl font-normal text-ivory sm:text-4xl">
          {heading}
        </h1>

        <div className="gold-line mx-auto mb-6" />

        <p className="text-[13px] leading-loose text-ivory/45">{body}</p>
      </header>

      {/*
       * Clerk's card is centred rather than stretched: its own layout has a
       * fixed comfortable measure, and forcing it wider only spreads the
       * inputs apart.
       */}
      <div className="flex w-full justify-center">{children}</div>

      <footer className="mt-8 md:mt-14 text-center">
        <p className="mb-4 text-[11px] tracking-[0.08em] text-ivory/30">
          {guest.guestLead}
        </p>

        <div className="flex items-center justify-center">
          <LocaleLink
            href="/cart"
            className="font-heading text-[11px] uppercase tracking-[0.15em] text-gold/70 no-underline transition-colors duration-300 hover:text-gold"
          >
            {guest.guestCart}
          </LocaleLink>
        </div>
      </footer>
    </main>
  );
}
