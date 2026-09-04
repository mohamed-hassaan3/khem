import type { Metadata } from "next";
import { redirect } from "next/navigation";

import MemberBenefits from "@/src/components/account/MemberBenefits";
import OrderCard from "@/src/components/account/OrderCard";
import PrivilegeBanner from "@/src/components/account/PrivilegeBanner";
import StatGrid from "@/src/components/account/StatGrid";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { getViewer } from "@/src/lib/auth";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { readingArrow } from "@/src/lib/i18n/rtl";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import { getAccountSummary, getOrdersForUser } from "@/src/services/account";
import { creditLedgerForUser } from "@/src/services/credits";
import { vouchersForUser } from "@/src/services/vouchers";

/**
 * Account overview.
 *
 * `force-dynamic` per AGENTS.md §8: every value on this page belongs to one
 * visitor, so there is nothing here to prerender or share between them. No
 * `generateStaticParams` for the same reason.
 *
 * What this page no longer does: greet an invented customer by name, claim a
 * fixed number of orders, and print a fixed lifetime total. All three were
 * hardcoded into the file it replaces and rendered identically for every
 * visitor. The name now comes from the session; the counts come from
 * `src/services/account.ts`, which reads no rows yet and will read real ones
 * without this file changing.
 */
export const dynamic = "force-dynamic";

const PATH = ACCOUNT_PATHS.overview;

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
      title: dict.account.meta.title,
      description: dict.account.meta.description,
    }),
    // Neither indexed nor crawled onward: every link from here leads deeper
    // into one customer's private data.
    robots: { index: false, follow: false },
  };
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, viewer] = await Promise.all([params, getViewer()]);
  const activeLocale = isLocale(locale) ? locale : "en";

  // The panel the visitor asked for travels with the redirect, so signing in
  // returns them here rather than to the portal index.
  if (viewer === null)
    redirect(signInPathWithReturn(activeLocale, localizePath(activeLocale, PATH)));

  const [dict, summary, orders, ledger, vouchers] = await Promise.all([
    getDictionary(activeLocale),
    getAccountSummary(viewer.id),
    getOrdersForUser(viewer.id),
    /*
     * The privileges band. Read from the same two services the Vouchers &
     * Credits panel reads, rather than from a summary of its own: a figure
     * printed at the top of the account and a figure printed on the panel it
     * links to must be the same figure, and the only way to guarantee that is
     * to count the same rows.
     *
     * The email is the session's verified primary address — a grant may have
     * been issued to it before this person ever had an account.
     */
    creditLedgerForUser(viewer.id),
    vouchersForUser({ clerkUserId: viewer.id, email: viewer.primaryEmail }),
  ]);

  // Greet by first name where Clerk holds one; an email-only account gets the
  // neutral heading rather than a greeting addressed to an email address.
  const firstName = viewer.fullName?.trim().split(/\s+/)[0] ?? null;
  const heading = firstName
    ? interpolate(dict.account.heading, { name: firstName })
    : dict.account.headingFallback;

  const [mostRecentOrder] = orders;

  const availableVouchers = vouchers.filter(
    (voucher) => voucher.status === "AVAILABLE",
  );

  /*
   * The soonest date a credit lapses, over the spendable ones only. A credit
   * still awaiting delivery has no expiry yet (0026 starts the clock at
   * delivery), and an expired one has nothing left to warn about.
   */
  const nextExpiry = ledger.credits
    .filter((credit) => credit.status === "AVAILABLE" && credit.expiresAt !== null)
    .map((credit) => credit.expiresAt as string)
    .sort((a, b) => a.localeCompare(b))[0] ?? null;

  return (
    <div>
      <p className="eyebrow mb-3">{dict.account.eyebrow}</p>

      <h1 className="mb-8 md:mb-12 font-heading text-3xl font-normal text-ground sm:text-4xl lg:text-5xl">
        {heading}
      </h1>

      {/* Above the figures, because it is the thing a customer can act on
          today. Renders nothing when they hold neither instrument. */}
      <PrivilegeBanner
        creditInCents={ledger.availableInCents}
        creditCount={ledger.availableCount}
        voucherCount={availableVouchers.length}
        expiresAt={nextExpiry}
        locale={activeLocale}
        dict={dict.account.privileges}
      />

      <StatGrid summary={summary} />

      {mostRecentOrder ? (
        <section className="mb-6 md:mb-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-heading text-base text-ground">
              {dict.account.recentOrder}
            </h2>

            <LocaleLink
              href={ACCOUNT_PATHS.orders}
              className="font-heading text-[10px] tracking-[0.15em] text-ground-accent/70 no-underline transition-colors duration-300 hover:text-ground-accent"
            >
              {`${dict.account.viewAllOrders} ${readingArrow(activeLocale)}`}
            </LocaleLink>
          </div>

          <OrderCard
            order={mostRecentOrder}
            locale={activeLocale}
            dict={dict.account.orders}
          />
        </section>
      ) : null}

      <MemberBenefits
        heading={dict.account.benefits.heading}
        body={dict.account.benefits.body}
      />
    </div>
  );
}
