import NavGround from "@/src/components/NavGround";
import { redirect } from "next/navigation";

import AccountIdentity from "@/src/components/account/AccountIdentity";
import KhemClerkProvider from "@/src/components/auth/KhemClerkProvider";
import AccountSidebar from "@/src/components/account/AccountSidebar";
import AccountTabBar from "@/src/components/account/AccountTabBar";
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

/**
 * Nothing under `/account` may be indexed.
 *
 * Declared on the layout so it covers the whole subtree, including panels added
 * later. Each panel used to state it individually and two of them —
 * `addresses` and `preferences` — had been missed, which is exactly the
 * failure a per-page rule invites; found by the pre-launch audit (finding F14,
 * `src/docs/SECURITY-AUDIT-STAGE-3.md`).
 *
 * This is a crawler instruction, not a protection: the gate is `getViewer()`
 * below and again in every panel. A page that needed `noindex` to stay private
 * would already be broken. What it prevents is a customer's account URL sitting
 * in a search index, and `follow: false` keeps crawlers from walking deeper
 * into a tree that will only answer them with a redirect.
 *
 * Next merges `robots` field-by-field from the nearest declaration, so a panel
 * may still tighten this; none currently needs to.
 */
export const metadata = {
  robots: { index: false, follow: false },
};

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
   * The full Clerk provider lives here, not in the root layout: the account
   * pages render Clerk's `<UserProfile>` and sign-out, and everywhere else
   * Clerk loads only for signed-in visitors
   * (prompts/clerk-load-only-where-needed.md).
   *
   * ## The shell (prompts/account-redesign-stage-1.md)
   *
   * Desktop (`lg+`): a sticky rail — identity, the four sections, sign-out —
   * beside the panel column. Phones: no rail and no top strip; the four
   * sections are a tab bar fixed to the bottom of the viewport, and `<main>`
   * is padded by the bar's height plus the safe area so a panel's last row is
   * never underneath it.
   *
   * The bell is no longer placed here. It belongs to each panel's title row
   * (`<AccountBell>`), which reads the same request-memoised feed.
   */
  return (
    <KhemClerkProvider locale={activeLocale}>
      <div className="ground-ivory min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
        {/* §17: usability over drama. The portal opens on a rule, not an image. */}
        <NavGround ground="ivory" />

        <aside className="sticky top-[var(--chrome-h)] hidden h-[calc(100svh-var(--chrome-h))] flex-col gap-6 overflow-y-auto border-e border-ground-border bg-stone px-5 py-8 transition-[top,height] duration-500 ease-luxury-bezier motion-reduce:transition-none lg:flex">
          <div className="border-b border-ground-border px-1.5 pb-6">
            <AccountIdentity viewer={viewer} locale={activeLocale} />
          </div>

          <AccountSidebar />

          <div className="mt-auto px-3">
            <SignOutButton />
          </div>
        </aside>

        <main className="min-w-0 px-4 pb-12 pt-6 sm:px-8 lg:px-12 lg:pb-16 lg:pt-12 xl:px-16">
          <div className="mx-auto max-w-[1080px]">{children}</div>
        </main>

        <AccountTabBar />
      </div>
    </KhemClerkProvider>
  );
}
