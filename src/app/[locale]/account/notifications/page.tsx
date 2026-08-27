import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getViewer } from "@/src/lib/auth";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ACCOUNT_PATHS } from "@/src/lib/routes";

/**
 * Notifications — the panel before the feature.
 *
 * The dashboard's navigation was specified in full while the customer
 * notification centre belongs to a later phase, and a rail with a link that
 * 404s is worse than either. So the route exists and says plainly that there is
 * nothing here yet, and — the part that matters — where the house *does* write
 * to the customer in the meantime.
 *
 * **There are no invented notifications and no dummy toggles on this page.** A
 * placeholder that fakes its own feature is a lie the next engineer has to
 * discover, and a customer who reads it will wait for updates that were never
 * going to arrive. When the notification store exists, this file gains a query
 * and loses this comment.
 *
 * `force-dynamic` and the session gate stay, so the route behaves exactly like
 * its neighbours from the day it holds real rows.
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

  const dict = await getDictionary(activeLocale);
  const copy = dict.account.notifications;

  return (
    <div>
      <p className="eyebrow mb-3">{copy.eyebrow}</p>

      <h1 className="mb-8 md:mb-12 font-heading text-3xl font-normal text-ivory sm:text-4xl">
        {copy.heading}
      </h1>

      <section className="border border-gold/15 bg-gold/6 px-8 py-8">
        <p className="mb-2 font-heading text-[14px] tracking-[0.06em] text-gold">
          {copy.emptyHeading}
        </p>

        <p className="max-w-prose text-[12px] leading-loose text-ivory/40">
          {copy.emptyBody}
        </p>
      </section>
    </div>
  );
}
