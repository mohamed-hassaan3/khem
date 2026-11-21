import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AccountBell from "@/src/components/account/AccountBell";
import AccountPageHeader from "@/src/components/account/AccountPageHeader";
import ActivityFeed from "@/src/components/account/ActivityFeed";
import GlanceRows from "@/src/components/account/GlanceRows";
import MemberCard from "@/src/components/account/MemberCard";
import { formatOrderDate, StatusChip } from "@/src/components/account/OrderCard";
import { isActiveOrder } from "@/src/components/account/OrderRail";
import OrderSpotlight from "@/src/components/account/OrderSpotlight";
import Price from "@/src/components/ecommerce/Price";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { getViewer } from "@/src/lib/auth";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { isLocale, localizePath, type Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import type { Dictionary } from "@/src/lib/i18n/dictionaries/en";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import {
  ensureUserRowId,
  getAddressesForUser,
  getOrdersForUser,
} from "@/src/services/account";
import { claimGuestOrdersForIdentity } from "@/src/services/order-claims";
import { creditLedgerForUser } from "@/src/services/credits";
import { marketingOptInForUser, notificationsForUser } from "@/src/services/notifications";
import { rewardsForUser } from "@/src/services/rewards";
import { vouchersForUser } from "@/src/services/vouchers";
import type { OrderSummary } from "@/src/types/account";

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

  // Backfill the Clerk customer row for accounts whose creation webhook was
  // missed, then claim only when Clerk confirms this primary email.
  await ensureUserRowId(viewer);
  await claimGuestOrdersForIdentity({
    clerkUserId: viewer.id,
    email: viewer.primaryEmail,
    emailVerified: viewer.primaryEmailVerified,
  });

  const [dict, orders, ledger, vouchers, rewards, notifications, addresses, marketingOptIn] =
    await Promise.all([
      getDictionary(activeLocale),
      getOrdersForUser(viewer.id),
      /*
       * The membership card's figures. Read from the same services the Wallet
       * reads, rather than from a summary of their own: a figure on Home and a
       * figure on the panel it opens must be the same figure, and the only way
       * to guarantee that is to count the same rows.
       *
       * The email is the session's verified primary address — a grant may have
       * been issued to it before this person ever had an account.
       */
      creditLedgerForUser(viewer.id),
      vouchersForUser({ clerkUserId: viewer.id, email: viewer.primaryEmail }),
      rewardsForUser(viewer.id),
      // Request-memoised: the bell in the header shares this read.
      notificationsForUser({ clerkUserId: viewer.id, email: viewer.primaryEmail }),
      getAddressesForUser(viewer.id),
      marketingOptInForUser(viewer.id),
    ]);

  const hub = dict.account.hub;

  // Greet by first name where Clerk holds one; an email-only account gets the
  // neutral heading rather than a greeting addressed to an email address.
  const firstName = viewer.fullName?.trim().split(/\s+/)[0] ?? null;
  const heading = firstName
    ? interpolate(dict.account.heading, { name: firstName })
    : dict.account.headingFallback;

  /*
   * The spotlight: the newest order still moving, else the newest order.
   * `getOrdersForUser` sorts newest first.
   */
  const activeOrder = orders.find((order) => isActiveOrder(order.status)) ?? null;
  const spotlight = activeOrder ?? orders[0] ?? null;

  const availableVouchers = vouchers.filter((voucher) => voucher.status === "AVAILABLE").length;

  /*
   * The soonest date a credit lapses, over the spendable ones only. A credit
   * still awaiting delivery has no expiry yet (0026 starts the clock at
   * delivery), and an expired one has nothing left to warn about.
   */
  const nextExpiry =
    ledger.credits
      .filter((credit) => credit.status === "AVAILABLE" && credit.expiresAt !== null)
      .map((credit) => credit.expiresAt as string)
      .sort((a, b) => a.localeCompare(b))[0] ?? null;

  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0] ?? null;

  /** Staggered entrance: each block rises a beat after the one before it. */
  const rise = (step: number) => ({ animationDelay: `${80 + step * 70}ms` });

  return (
    <div>
      <AccountPageHeader
        size="display"
        eyebrow={dict.account.eyebrow}
        heading={heading}
        action={<AccountBell viewer={viewer} locale={activeLocale} dict={dict} />}
      />

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="acct-rise lg:col-span-5" style={rise(0)}>
          <MemberCard
            name={viewer.fullName ?? viewer.primaryEmail ?? ""}
            nameIsEmail={!viewer.fullName}
            points={rewards.enabled ? rewards.balancePoints : null}
            creditInCents={ledger.availableInCents}
            vouchers={availableVouchers}
            creditExpiresAt={nextExpiry}
            locale={activeLocale}
            dict={hub}
          />
        </div>

        <div className="acct-rise lg:col-span-7" style={rise(1)}>
          {spotlight ? (
            <OrderSpotlight
              order={spotlight}
              heading={activeOrder ? hub.onItsWay : hub.latestOrder}
              locale={activeLocale}
              dict={dict.account}
            />
          ) : (
            <section className="flex h-full flex-col">
              <h2 className="mb-3 font-heading text-[15px] font-medium tracking-[0.06em] text-ground rtl:text-[19px] rtl:tracking-normal">
                {hub.latestOrder}
              </h2>
              <div className="flex flex-1 flex-col items-start justify-center gap-4 rounded-lg border border-dashed border-ground-border p-5 lg:p-7">
                <p className="text-[13px] text-ground-muted">{hub.noOrders}</p>
                <LocaleLink href="/collections" className="btn btn-primary">
                  {hub.shop}
                </LocaleLink>
              </div>
            </section>
          )}
        </div>

        {/* Desktop only: the last few orders as a table. On a phone the
            spotlight and the Orders tab already carry this. */}
        {orders.length > 0 ? (
          <section className="acct-rise hidden lg:col-span-8 lg:block" style={rise(2)}>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="font-heading text-[15px] font-medium tracking-[0.06em] text-ground rtl:text-[19px] rtl:tracking-normal">
                {hub.recentOrders}
              </h2>
              <LocaleLink
                href={ACCOUNT_PATHS.orders}
                className="text-[11px] uppercase tracking-[0.14em] text-ground-accent no-underline hover:text-ground rtl:text-[12px] rtl:normal-case rtl:tracking-normal"
              >
                {hub.allOrders}
              </LocaleLink>
            </div>
            <RecentOrdersTable orders={orders.slice(0, 4)} locale={activeLocale} dict={dict.account} />
          </section>
        ) : null}

        <section
          className={`acct-rise ${orders.length > 0 ? "lg:col-span-4" : "lg:col-span-12"}`}
          style={rise(3)}
        >
          <div className="mb-1 flex items-baseline justify-between gap-4 lg:mb-3">
            <h2 className="font-heading text-[15px] font-medium tracking-[0.06em] text-ground rtl:text-[19px] rtl:tracking-normal">
              {hub.activity}
            </h2>
            <LocaleLink
              href={ACCOUNT_PATHS.notifications}
              className="text-[11px] uppercase tracking-[0.14em] text-ground-accent no-underline hover:text-ground rtl:text-[12px] rtl:normal-case rtl:tracking-normal"
            >
              {hub.seeAll}
            </LocaleLink>
          </div>
          <div className="lg:rounded-lg lg:border lg:border-ground-border lg:bg-stone lg:px-5 lg:py-2">
            <ActivityFeed
              items={notifications.slice(0, 3)}
              locale={activeLocale}
              copy={dict.account.notifications}
              empty={hub.noActivity}
            />
          </div>
        </section>

        <section className="acct-rise lg:col-span-12" style={rise(4)}>
          <h2 className="mb-1 font-heading text-[15px] font-medium tracking-[0.06em] text-ground lg:mb-3 rtl:text-[19px] rtl:tracking-normal">
            {hub.glance}
          </h2>
          <GlanceRows address={defaultAddress} marketingOptIn={marketingOptIn} dict={hub} />
        </section>
      </div>
    </div>
  );
}

/** The desktop overview's order table — four newest orders, one row each. */
function RecentOrdersTable({
  orders,
  locale,
  dict,
}: {
  orders: readonly OrderSummary[];
  locale: Locale;
  dict: Dictionary["account"];
}) {
  const copy = dict.hub.orders;
  return (
    <div className="overflow-x-auto rounded-lg border border-ground-border bg-stone px-5 py-2">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-ground-border">
            {[copy.order, copy.date, copy.items, copy.status].map((heading) => (
              <th key={heading} scope="col" className="py-3 text-start text-[10px] font-medium uppercase tracking-[0.18em] text-ground-muted rtl:text-[12px] rtl:normal-case rtl:tracking-normal">
                {heading}
              </th>
            ))}
            <th scope="col" className="py-3 text-end text-[10px] font-medium uppercase tracking-[0.18em] text-ground-muted rtl:text-[12px] rtl:normal-case rtl:tracking-normal">
              {copy.total}
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-ground-border last:border-b-0">
              <td className="py-3.5 pe-4">
                <LocaleLink
                  href={`${ACCOUNT_PATHS.orders}#${order.orderNumber}`}
                  {...ltrIsland(locale)}
                  className="font-heading text-ground no-underline hover:text-ground-accent"
                >
                  {order.orderNumber}
                </LocaleLink>
              </td>
              <td className="whitespace-nowrap py-3.5 pe-4 text-ground-muted">
                {formatOrderDate(order.placedAt, locale)}
              </td>
              <td className="max-w-[16rem] truncate py-3.5 pe-4" {...ltrIsland(locale)}>
                {order.lines.map((line) => line.productName).join(", ")}
              </td>
              <td className="py-3.5 pe-4">
                <StatusChip status={order.status} label={dict.orders.status[order.status]} />
              </td>
              <td className="py-3.5 text-end">
                <Price cents={order.totalInCents} className="whitespace-nowrap font-heading text-ground-accent" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
