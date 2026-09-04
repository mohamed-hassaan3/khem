import NavGround from "@/src/components/NavGround";
import { redirect } from "next/navigation";

import AccountIdentity from "@/src/components/account/AccountIdentity";
import AccountSidebar from "@/src/components/account/AccountSidebar";
import SignOutButton from "@/src/components/account/SignOutButton";
import { getViewer } from "@/src/lib/auth";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { AUTH_PATHS } from "@/src/lib/routes";

/**
 * The customer portal shell — identity block, navigation rail, panel slot.
 *
 * Shared by all four sections so the session is read **once** per navigation
 * rather than once per panel, and so the rail keeps its scroll position when
 * moving between them.
 *
 * **This is the gate.** Clerk v7 deprecates middleware path-matching in favour
 * of resource-based checks, so `src/proxy.ts` performs no protection at all —
 * the session is verified here, where the data is, and again in each panel
 * beneath. See the note in `src/proxy.ts` for why a matcher was the wrong
 * mechanism for this route in particular.
 *
 * The redirect is locale-aware: `/ar/account` sends an unauthenticated visitor
 * to `/ar/sign-in`, not into the English tree at the moment they are trying to
 * reach their account.
 */

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, viewer] = await Promise.all([params, getViewer()]);

  // The parent layout has already rejected any segment that is not a locale.
  const activeLocale = isLocale(locale) ? locale : "en";

  /*
   * No `redirect_url` here, unlike the panels beneath: a layout cannot know
   * which child it is wrapping, so the only target it could name is `/account`
   * — which is already Clerk's fallback. The precise return path is attached
   * by whichever panel is being requested, and by `src/proxy.ts` before either
   * of them runs.
   */
  if (viewer === null) redirect(localizePath(activeLocale, AUTH_PATHS.signIn));

  /*
   * No unread count is read here any more. The rail used to carry a numeral and
   * this layout fetched it; the header bell owns that number now, and it asks
   * for it through a Server Action of its own so the storefront's thirty routes
   * stay static. Two surfaces counting the same rows is two surfaces that can
   * disagree — see `<NotificationBell>`.
   */

  return (
    <div className="ground-ivory min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      {/* §17: usability over drama. The portal opens on a rule, not an image. */}
      <NavGround ground="ivory" />
      {/*
       * Below `lg` the rail is a sticky strip beneath the nav rather than a
       * column; the original page kept a fixed 280px sidebar at every width,
       * which left the panels unusable on a phone.
       */}
      <aside className="sticky top-[var(--chrome-h)] z-10 flex flex-col border-b border-ground-border bg-[var(--card-bg)] transition-[top,height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none lg:top-[var(--chrome-h)] lg:h-[calc(100svh-var(--chrome-h))] lg:overflow-y-auto lg:border-b-0 lg:border-e lg:border-ground-border lg:bg-[var(--card-bg)] lg:py-15">
        <div className="hidden lg:mb-5 lg:block">
          <AccountIdentity viewer={viewer} locale={activeLocale} />
        </div>

        <AccountSidebar />
      </aside>

      <main className="px-5 pb-14 pt-10 sm:px-8 lg:px-20 lg:pt-15">
        {children}

        {/* The rail's sign-out sits in the desktop column; on mobile the
            strip has no room for it, so it closes the panel instead. */}
        <div className="mt-10 md:mt-16 border-t border-ground-border pt-8 lg:hidden">
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}
