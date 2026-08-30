import { Package } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import OrderCard from "@/src/components/account/OrderCard";
import EmptyState from "@/src/components/ecommerce/EmptyState";
import { getViewer } from "@/src/lib/auth";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import { getOrdersForUser } from "@/src/services/account";

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

export default async function OrdersPage({
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

  const [dict, orders] = await Promise.all([
    getDictionary(activeLocale),
    getOrdersForUser(viewer.id),
  ]);

  return (
    <div>
      <p className="eyebrow mb-3">{dict.account.orders.eyebrow}</p>

      <h1 className="mb-8 md:mb-12 font-heading text-3xl font-normal text-ground sm:text-4xl">
        {dict.account.orders.heading}
      </h1>

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          heading={dict.account.orders.empty.heading}
          body={dict.account.orders.empty.body}
          cta={dict.account.orders.empty.cta}
          href="/collections"
        />
      ) : (
        <div className="flex flex-col gap-0.5">
          {/*
            * Newest first — the sort lives in `getOrdersForUser`, and the
            * index here only marks which card wears the badge.
            */}
          {orders.map((order, index) => (
            <OrderCard
              key={order.id}
              order={order}
              locale={activeLocale}
              dict={dict.account.orders}
              isLatest={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
