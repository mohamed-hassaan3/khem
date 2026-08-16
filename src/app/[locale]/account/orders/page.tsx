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
 * Order history.
 *
 * The list is empty today because there is no `Order` table — see the seam in
 * `src/services/account.ts`. It renders the empty state honestly rather than
 * the three invented orders the previous page shipped, and it renders the real
 * list the moment that service returns rows, with no change here.
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

      <h1 className="mb-12 font-heading text-3xl font-normal text-ivory sm:text-4xl">
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
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              locale={activeLocale}
              dict={dict.account.orders}
            />
          ))}
        </div>
      )}
    </div>
  );
}
