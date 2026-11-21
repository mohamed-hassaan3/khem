import { Package } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AccountBell from "@/src/components/account/AccountBell";
import AccountPageHeader from "@/src/components/account/AccountPageHeader";
import OpenOrderFromHash from "@/src/components/account/OpenOrderFromHash";
import OrderCard from "@/src/components/account/OrderCard";
import { isActiveOrder } from "@/src/components/account/OrderRail";
import Price from "@/src/components/ecommerce/Price";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import EmptyState from "@/src/components/ecommerce/EmptyState";
import { getViewer } from "@/src/lib/auth";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import { ensureUserRowId, getAccountSummary, getOrdersForUser } from "@/src/services/account";
import { claimGuestOrdersForIdentity } from "@/src/services/order-claims";

/**
 * Order history, and where "Track Your Order" in the emails lands.
 *
 * Newest first, each card carrying the rail of stations the order has reached.
 * `force-dynamic` is what makes that rail current: a status the desk changed a
 * minute ago is on the page at the next load. There is no live subscription and
 * there cannot be one — `supabase/sql/0015_orders.sql` grants the public roles
 * nothing on `"Order"`, so a browser cannot listen to it. The email is what
 * actively notifies; this page is what the customer opens when it does.
 */
export const dynamic = "force-dynamic";

const PATH = ACCOUNT_PATHS.orders;

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
      title: dict.account.orders.meta.title,
      description: dict.account.orders.meta.description,
    }),
    robots: { index: false, follow: false },
  };
}

/** The segmented filter, as a search param: no client JavaScript, and shareable. */
type OrderFilter = "all" | "active" | "completed";

function parseFilter(value: string | string[] | undefined): OrderFilter {
  return value === "active" || value === "completed" ? value : "all";
}

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, viewer, query] = await Promise.all([params, getViewer(), searchParams]);
  const filter = parseFilter(query.filter);
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

  const [dict, orders, summary] = await Promise.all([
    getDictionary(activeLocale),
    getOrdersForUser(viewer.id),
    getAccountSummary(viewer.id),
  ]);

  const hub = dict.account.hub;
  const activeCount = orders.filter((order) => isActiveOrder(order.status)).length;
  const completedCount = orders.length - activeCount;
  const shown = orders.filter((order) =>
    filter === "all" ? true : filter === "active" ? isActiveOrder(order.status) : !isActiveOrder(order.status),
  );
  // The first order still moving opens by default: it is the one being checked.
  const openId = shown.find((order) => isActiveOrder(order.status))?.id ?? null;

  const tabs: { key: OrderFilter; label: string; count: number }[] = [
    { key: "all", label: hub.orders.all, count: orders.length },
    { key: "active", label: hub.orders.active, count: activeCount },
    { key: "completed", label: hub.orders.completed, count: completedCount },
  ];

  return (
    <div>
      <OpenOrderFromHash />

      <AccountPageHeader
        eyebrow={dict.account.orders.eyebrow}
        heading={dict.account.orders.heading}
        aside={
          orders.length > 0 ? (
            <>
              {summary.orderCount === 1
                ? hub.orders.summaryOne
                : interpolate(hub.orders.summary, { count: String(summary.orderCount) })}
              {" · "}
              <Price cents={summary.lifetimeSpendInCents} className="text-ground" />{" "}
              {hub.orders.allTime}
            </>
          ) : null
        }
        action={<AccountBell viewer={viewer} locale={activeLocale} dict={dict} />}
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          heading={dict.account.orders.empty.heading}
          body={dict.account.orders.empty.body}
          cta={dict.account.orders.empty.cta}
          href="/collections"
          compact
        />
      ) : (
        <>
          <nav
            aria-label={hub.orders.filterLabel}
            className="acct-rise mb-5 grid grid-cols-3 gap-1 rounded-lg border border-ground-border bg-stone p-1 sm:inline-grid sm:min-w-[26rem]"
            style={{ animationDelay: "80ms" }}
          >
            {tabs.map((tab) => {
              const isActive = tab.key === filter;
              return (
                <LocaleLink
                  key={tab.key}
                  href={tab.key === "all" ? PATH : `${PATH}?filter=${tab.key}`}
                  aria-current={isActive ? "page" : undefined}
                  scroll={false}
                  className={[
                    "flex h-10 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] uppercase tracking-[0.1em] no-underline",
                    "transition-[background-color,color,box-shadow] duration-300 ease-luxury-bezier rtl:text-[12px] rtl:normal-case rtl:tracking-normal",
                    isActive
                      ? "bg-ground-bg text-ground shadow-[0_1px_2px_rgba(36,35,33,0.08)]"
                      : "text-ground-muted hover:text-ground",
                  ].join(" ")}
                >
                  {tab.label}
                  <span className="text-ground-muted">· {tab.count}</span>
                </LocaleLink>
              );
            })}
          </nav>

          {shown.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ground-border px-5 py-8 text-center text-[13px] text-ground-muted">
              {filter === "active" ? hub.orders.noneActive : hub.orders.noneCompleted}
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {shown.map((order, index) => (
                <div key={order.id} className="acct-rise" style={{ animationDelay: `${140 + Math.min(index, 6) * 60}ms` }}>
                  <OrderCard
                    order={order}
                    locale={activeLocale}
                    dict={dict.account}
                    defaultOpen={order.id === openId}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
