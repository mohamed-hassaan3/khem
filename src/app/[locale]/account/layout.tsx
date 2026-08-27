import { redirect } from "next/navigation";

import AccountIdentity from "@/src/components/account/AccountIdentity";
import AccountSidebar from "@/src/components/account/AccountSidebar";
import SignOutButton from "@/src/components/account/SignOutButton";
import { getViewer } from "@/src/lib/auth";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { AUTH_PATHS } from "@/src/lib/routes";
import { unreadNotificationCount } from "@/src/services/notifications";

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
   * The rail's unread numeral. Read here rather than in the sidebar because the
   * sidebar is a Client Component and this is a secret-key query — and read
   * after the gate, never beside it, so it cannot run for a request that is
   * about to be redirected away.
   */
  const unreadCount = await unreadNotificationCount({
    clerkUserId: viewer.id,
    email: viewer.primaryEmail,
  });

  return (
    <div className="min-h-screen bg-background pt-20 text-ivory lg:grid lg:grid-cols-[280px_1fr]">
      {/*
       * Below `lg` the rail is a sticky strip beneath the nav rather than a
       * column; the original page kept a fixed 280px sidebar at every width,
       * which left the panels unusable on a phone.
       */}
      <aside className="sticky top-20 z-10 flex flex-col border-b border-border bg-surface/60 backdrop-blur-md lg:top-20 lg:h-[calc(100vh-5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-e lg:border-border lg:bg-surface lg:py-15 lg:backdrop-blur-none">
        <div className="hidden lg:mb-5 lg:block">
          <AccountIdentity viewer={viewer} locale={activeLocale} />
        </div>

        <AccountSidebar unreadCount={unreadCount} />
      </aside>

      <main className="px-5 pb-14 pt-10 sm:px-8 lg:px-20 lg:pt-15">
        {children}

        {/* The rail's sign-out sits in the desktop column; on mobile the
            strip has no room for it, so it closes the panel instead. */}
        <div className="mt-10 md:mt-16 border-t border-border pt-8 lg:hidden">
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}
