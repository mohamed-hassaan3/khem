import type { Metadata } from "next";
import { redirect } from "next/navigation";

import MemberBenefits from "@/src/components/account/MemberBenefits";
import OrderCard from "@/src/components/account/OrderCard";
import StatGrid from "@/src/components/account/StatGrid";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { getViewer } from "@/src/lib/auth";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { readingArrow } from "@/src/lib/i18n/rtl";
import { AUTH_PATHS, ACCOUNT_PATHS } from "@/src/lib/routes";
import { getAccountSummary, getOrdersForUser } from "@/src/services/account";

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

  if (viewer === null) redirect(localizePath(activeLocale, AUTH_PATHS.signIn));

  const [dict, summary, orders] = await Promise.all([
    getDictionary(activeLocale),
    getAccountSummary(viewer.id),
    getOrdersForUser(viewer.id),
  ]);

  // Greet by first name where Clerk holds one; an email-only account gets the
  // neutral heading rather than a greeting addressed to an email address.
  const firstName = viewer.fullName?.trim().split(/\s+/)[0] ?? null;
  const heading = firstName
    ? interpolate(dict.account.heading, { name: firstName })
    : dict.account.headingFallback;

  const [mostRecentOrder] = orders;

  return (
    <div>
      <p className="eyebrow mb-3">{dict.account.eyebrow}</p>

      <h1 className="mb-12 font-heading text-3xl font-normal text-ivory sm:text-4xl lg:text-5xl">
        {heading}
      </h1>

      <StatGrid summary={summary} />

      {mostRecentOrder ? (
        <section className="mb-10">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-heading text-base text-ivory">
              {dict.account.recentOrder}
            </h2>

            <LocaleLink
              href={ACCOUNT_PATHS.orders}
              className="font-heading text-[10px] tracking-[0.15em] text-gold/70 no-underline transition-colors duration-300 hover:text-gold"
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
