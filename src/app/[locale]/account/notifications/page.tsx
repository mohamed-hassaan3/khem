import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getViewer } from "@/src/lib/auth";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import NotificationList from "@/src/components/account/NotificationList";
import EmptyState from "@/src/components/ecommerce/EmptyState";
import { notificationsForUser } from "@/src/services/notifications";
import { BellRing } from "lucide-react";

/**
 * Notifications — what the house has told this customer.
 *
 * The panel this replaces was an honest placeholder, and its promise was that
 * "when the notification store exists, this file gains a query". There is no
 * store: `customer_notification_feed()` derives the list from the order events,
 * credits and grants that already exist, and only read-state was added. So the
 * file gained a query and nothing else in the house had to grow a second record
 * of anything.
 *
 * **Nothing about this is intrusive.** There is no bell over the shop and no
 * badge in the storefront header — §16 asks for optional and non-intrusive, and
 * a notification count in the header of a perfume boutique is neither. It lives
 * here, where somebody has come to look at their account.
 *
 * `force-dynamic` and the session gate, like every panel beside it: everything
 * on this page belongs to one visitor, and the owner is the id from the session.
 */
export const dynamic = "force-dynamic";

const PATH = ACCOUNT_PATHS.notifications;

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
      title: dict.account.notifications.meta.title,
      description: dict.account.notifications.meta.description,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, viewer] = await Promise.all([params, getViewer()]);
  const activeLocale = isLocale(locale) ? locale : "en";

  if (viewer === null)
    redirect(signInPathWithReturn(activeLocale, localizePath(activeLocale, PATH)));

  const [dict, notifications] = await Promise.all([
    getDictionary(activeLocale),
    // The owner and the address both come from the session — a grant may have
    // been issued to the address before the account existed.
    notificationsForUser({
      clerkUserId: viewer.id,
      email: viewer.primaryEmail,
    }),
  ]);

  const copy = dict.account.notifications;

  return (
    <div>
      <p className="eyebrow mb-3">{copy.eyebrow}</p>

      <h1 className="mb-8 md:mb-12 font-heading text-3xl font-normal text-ground sm:text-4xl">
        {copy.heading}
      </h1>

      {notifications.length === 0 ? (
        <EmptyState
          icon={BellRing}
          heading={copy.emptyHeading}
          body={copy.emptyBody}
          cta={dict.account.orders.empty.cta}
          href="/collections"
        />
      ) : (
        <NotificationList
          notifications={notifications}
          locale={activeLocale}
          copy={copy}
        />
      )}
    </div>
  );
}
