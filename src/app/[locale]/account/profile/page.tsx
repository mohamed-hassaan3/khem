import { UserProfile } from "@clerk/nextjs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AddressBook from "@/src/components/account/AddressBook";
import MarketingPreference from "@/src/components/account/MarketingPreference";
import { getViewer } from "@/src/lib/auth";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
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

  const [dict, addresses, marketingOptIn] = await Promise.all([
    getDictionary(activeLocale),
    getAddressesForUser(viewer.id),
    marketingOptInForUser(viewer.id),
  ]);

  const copy = dict.account.profile;

  return (
    <div>
      <p className="eyebrow mb-3">{copy.eyebrow}</p>

      <h1 className="mb-8 md:mb-12 font-heading text-3xl font-normal text-ground sm:text-4xl">
        {copy.heading}
      </h1>

      {/* ── Your details ────────────────────────────── */}
      <section className="mb-12 md:mb-16">
        <h2 className="mb-6 font-heading text-base text-ground">
          {copy.sections.account}
        </h2>

        {/*
         * Clerk's own card is wide; it scrolls inside this wrapper rather than
         * pushing the page into a horizontal scrollbar on a phone.
         */}
        <div className="max-w-full overflow-x-auto">
          <UserProfile routing="hash" />
        </div>
      </section>

      {/* ── Addresses ───────────────────────────────── */}
      <section id="addresses" className="mb-12 scroll-mt-32 md:mb-16">
        <h2 className="mb-6 font-heading text-base text-ground">
          {copy.sections.addresses}
        </h2>

        <AddressBook
          initial={addresses}
          locale={activeLocale}
          dict={dict.account.addresses}
        />
      </section>

      {/* ── Preferences ─────────────────────────────── */}
      <section id="preferences" className="scroll-mt-32">
        <h2 className="mb-6 font-heading text-base text-ground">
          {copy.sections.preferences}
        </h2>

        <div className="flex flex-col gap-6">
          <MarketingPreference
            initial={marketingOptIn}
            copy={dict.account.preferences.marketing}
          />

          {/*
            * Language and currency are not settings this page owns — they are
            * chosen from the header and the footer and follow the visitor
            * everywhere. Saying so is better than a second control that would
            * have to stay in step with the first.
            */}
          <section className="card px-6 py-6 sm:px-8 sm:py-7">
            <p className="mb-1.5 font-heading text-[13px] tracking-[0.08em] text-ground">
              {dict.account.preferences.language.heading}
            </p>
            <p className="max-w-prose text-[12px] leading-loose text-ground-muted">
              {dict.account.preferences.language.body}
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
