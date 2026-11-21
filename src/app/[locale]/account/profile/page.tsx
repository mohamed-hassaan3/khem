import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { Globe } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AccountBell from "@/src/components/account/AccountBell";
import AccountIdentity from "@/src/components/account/AccountIdentity";
import AddressBook from "@/src/components/account/AddressBook";
import ClerkAccountRows from "@/src/components/account/ClerkAccountRows";
import RegionValue from "@/src/components/account/RegionValue";
import SignOutButton from "@/src/components/account/SignOutButton";
import MarketingPreference from "@/src/components/account/MarketingPreference";
import { getViewer } from "@/src/lib/auth";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import { getAddressesForUser } from "@/src/services/account";
import { marketingOptInForUser } from "@/src/services/notifications";

/**
 * Profile — the account's own details, its addresses, and its preferences.
 *
 * ## Three panels became three sections
 *
 * Addresses and Preferences were rail entries of their own. Each was one short
 * panel, and a customer looking for "where do my parcels go" or "stop writing
 * to me" looks under their profile before they look at a rail. Both routes
 * still exist — email carries links to them — and both now redirect here, to
 * the `#addresses` and `#preferences` anchors below.
 *
 * ## Clerk still owns what Clerk owns
 *
 * `<UserProfile />` rather than a hand-built form. Name, email, phone,
 * password, connected accounts, and active sessions are all Clerk-owned
 * records: writing them means the Backend API, and the sessions list has no
 * hand-rolled equivalent at all.
 *
 * `routing="hash"` keeps Clerk's internal navigation in the fragment. Its own
 * routes all begin `#/`, so they cannot collide with the two bare anchors this
 * page adds.
 *
 * ## The address book writes for the first time
 *
 * `"Address"` has existed since `supabase/sql/0024_customers.sql` and nothing
 * ever wrote to it: an address typed at checkout went to the `ship*` snapshot
 * on the order — deliberately immutable, deliberately not an address book — and
 * this panel stayed empty for a reason no screen explained. `<AddressBook>` and
 * `src/actions/addresses.ts` are that missing half.
 */
export const dynamic = "force-dynamic";

const PATH = ACCOUNT_PATHS.profile;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  return {
    ...localeMetadata({
      locale: activeLocale,
      path: PATH,
      title: dict.account.profile.meta.title,
      description: dict.account.profile.meta.description,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, viewer] = await Promise.all([params, getViewer()]);
  const activeLocale = isLocale(locale) ? locale : "en";

  // Every protected resource checks for itself — see `src/proxy.ts` for why
  // the middleware no longer does it on this route's behalf.
  // The panel the visitor asked for travels with the redirect, so signing in
  // returns them here rather than to the portal index.
  if (viewer === null)
    redirect(signInPathWithReturn(activeLocale, localizePath(activeLocale, PATH)));

  const [dict, addresses, marketingOptIn, security] = await Promise.all([
    getDictionary(activeLocale),
    getAddressesForUser(viewer.id),
    marketingOptInForUser(viewer.id),
    securitySummary(viewer.id),
  ]);

  const hub = dict.account.hub;
  const copy = dict.account.profile;

  /*
   * "Google connected · 2 active sessions" — the line under "Password &
   * sign-in". Both halves come from Clerk for this session's own user id and
   * nothing else; either half that Clerk cannot answer is simply left out.
   */
  const securityDetail =
    [
      security.providers.length > 0
        ? interpolate(hub.profile.connected, { providers: security.providers.join(", ") })
        : null,
      security.sessions === null
        ? null
        : security.sessions === 1
          ? hub.profile.sessionOne
          : interpolate(hub.profile.sessions, { count: String(security.sessions) }),
    ]
      .filter(Boolean)
      .join(" · ") || null;

  const rise = (step: number) => ({ animationDelay: `${80 + step * 70}ms` });

  return (
    <div>
      <header className="acct-rise mb-6 flex items-center justify-between gap-4 md:mb-10">
        <AccountIdentity viewer={viewer} locale={activeLocale} variant="hero" eyebrow={copy.heading} />
        <div className="shrink-0">
          <AccountBell viewer={viewer} locale={activeLocale} dict={dict} />
        </div>
      </header>

      <div className="grid gap-7 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-10">
        {/* ── Account (Clerk) ─────────────────────────── */}
        <section id="details" className="acct-rise scroll-mt-32" style={rise(1)}>
          <GroupLabel>{hub.profile.account}</GroupLabel>
          <div className="overflow-hidden rounded-lg border border-ground-border bg-stone">
            <ClerkAccountRows securityDetail={securityDetail} />
          </div>
        </section>

        {/* ── Communication ───────────────────────────── */}
        <section id="preferences" className="acct-rise scroll-mt-32" style={rise(2)}>
          <GroupLabel>{hub.profile.communication}</GroupLabel>
          <MarketingPreference initial={marketingOptIn} copy={dict.account.preferences.marketing} />
        </section>

        {/* ── Addresses ───────────────────────────────── */}
        <section id="addresses" className="acct-rise scroll-mt-32" style={rise(3)}>
          <GroupLabel>{hub.profile.addresses}</GroupLabel>
          <AddressBook initial={addresses} locale={activeLocale} dict={dict.account.addresses} />
        </section>

        {/* ── Region ──────────────────────────────────── */}
        <section className="acct-rise" style={rise(4)}>
          <GroupLabel>{hub.profile.region}</GroupLabel>
          {/*
           * Language and currency are not settings this page owns — they are
           * chosen from the header and follow the visitor everywhere. The row
           * shows the current pair and says where to change it, rather than a
           * second control that would have to stay in step with the first.
           */}
          <div className="flex min-h-14 items-center gap-3 rounded-lg border border-ground-border bg-stone px-4 py-3 sm:px-5">
            <Globe size={18} strokeWidth={1.25} aria-hidden="true" className="shrink-0 text-ground-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-ground">{hub.region}</span>
              <span className="mt-0.5 block text-[11px] text-ground-muted rtl:text-[12px]">{hub.regionHint}</span>
            </span>
            <RegionValue />
          </div>
        </section>
      </div>

      {/* Phones only: the rail carries sign-out on desktop. */}
      <div className="acct-rise mt-8 lg:hidden" style={rise(5)}>
        <SignOutButton variant="block" />
      </div>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 px-1 text-[10px] uppercase tracking-[0.24em] text-ground-muted rtl:text-[13px] rtl:normal-case rtl:tracking-normal">
      {children}
    </h2>
  );
}

/**
 * Connected sign-in providers and the active-session count, from Clerk.
 *
 * `currentUser()` is request-memoised, so this is the session's own user and
 * no second fetch. The session list is one Backend API call scoped to that id.
 * Any failure degrades to "unknown" — the row then shows no subtitle — never to
 * an error page: this is a courtesy line, not a record.
 */
async function securitySummary(
  userId: string,
): Promise<{ providers: string[]; sessions: number | null }> {
  const user = await currentUser();
  const providers = (user?.externalAccounts ?? [])
    .map((account) => account.provider.replace(/^oauth_/, ""))
    .filter((provider, index, all) => provider.length > 0 && all.indexOf(provider) === index)
    .map((provider) => provider.charAt(0).toUpperCase() + provider.slice(1));

  try {
    const client = await clerkClient();
    const { totalCount } = await client.sessions.getSessionList({ userId, status: "active" });
    return { providers, sessions: totalCount };
  } catch (error) {
    console.error(
      `[account] session count unavailable: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return { providers, sessions: null };
  }
}
