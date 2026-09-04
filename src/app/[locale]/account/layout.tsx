import NavGround from "@/src/components/NavGround";
import { redirect } from "next/navigation";

import AccountIdentity from "@/src/components/account/AccountIdentity";
import AccountSidebar from "@/src/components/account/AccountSidebar";
import NotificationBell from "@/src/components/account/NotificationBell";
import SignOutButton from "@/src/components/account/SignOutButton";
import { getViewer } from "@/src/lib/auth";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { AUTH_PATHS } from "@/src/lib/routes";
import { notificationsForUser } from "@/src/services/notifications";

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
   * The bell's feed, read once for the whole portal.
   *
   * Read here rather than in the bell because the bell is a Client Component
   * and this is a secret-key query — and read after the gate, never beside it,
   * so it cannot run for a request that is about to be redirected away.
   *
   * `notificationsForUser()` is memoised per request, so this costs nothing
   * extra on `/account/notifications`: the panel beneath shares this very read
   * rather than running the feed a second time. Both halves of the owner come
   * from the session — a voucher grant may predate the account and is keyed by
   * address.
   *
   * The rail used to carry a quiet numeral instead. The bell owns that number
   * now; two surfaces counting the same unread rows is two surfaces that can
   * come to disagree.
   */
  const [dict, notifications] = await Promise.all([
    getDictionary(activeLocale),
    notificationsForUser({
      clerkUserId: viewer.id,
      email: viewer.primaryEmail,
    }),
  ]);

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
        {/*
          * The bell, at the head of every panel and nowhere else on the site.
          * It sits above the panel rather than inside it so that all four
          * sections carry it identically, and none of them has to remember to.
          */}
        <div className="mb-6 flex justify-end md:mb-8">
          <NotificationBell
            notifications={notifications}
            locale={activeLocale}
            copy={dict.account.bell}
            feedCopy={dict.account.notifications}
          />
        </div>

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
