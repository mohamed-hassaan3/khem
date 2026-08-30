import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getViewer } from "@/src/lib/auth";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import MarketingPreference from "@/src/components/account/MarketingPreference";
import { marketingOptInForUser } from "@/src/services/notifications";

/**
 * Preferences — the panel before the feature.
 *
 * Marketing subscription preferences belong to a later phase, and the honest
 * thing to render until then is a page that says so and names where the two
 * choices that *do* exist already live: language and currency, both switched
 * from the foot of any page, and the unsubscribe link every letter carries.
 *
 * **No dummy toggles.** A switch that renders but stores nothing is worse than
 * no switch at all — a customer who turns marketing email off here would
 * reasonably believe the house had stopped writing to them. The real control
 * arrives with the marketing preference column that backs it.
 *
 * `force-dynamic` and the session gate stay, so the route behaves exactly like
 * its neighbours from the day it holds real settings.
 */
export const dynamic = "force-dynamic";

const PATH = ACCOUNT_PATHS.preferences;

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
      title: dict.account.preferences.meta.title,
      description: dict.account.preferences.meta.description,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function PreferencesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, viewer] = await Promise.all([params, getViewer()]);
  const activeLocale = isLocale(locale) ? locale : "en";

  if (viewer === null)
    redirect(signInPathWithReturn(activeLocale, localizePath(activeLocale, PATH)));

  const [dict, marketingOptIn] = await Promise.all([
    getDictionary(activeLocale),
    marketingOptInForUser(viewer.id),
  ]);

  const copy = dict.account.preferences;

  return (
    <div>
      <p className="eyebrow mb-3">{copy.eyebrow}</p>

      <h1 className="mb-8 md:mb-12 font-heading text-3xl font-normal text-ground sm:text-4xl">
        {copy.heading}
      </h1>

      <div className="flex flex-col gap-6">
        <MarketingPreference initial={marketingOptIn} copy={copy.marketing} />

        {/*
          * Language and currency are not settings this page owns — they are
          * chosen from the footer and follow the visitor everywhere. Saying so
          * is better than a second control that would have to stay in step
          * with the first.
          */}
        <section className="card px-6 py-6 sm:px-8 sm:py-7">
          <p className="mb-1.5 font-heading text-[13px] tracking-[0.08em] text-ground">
            {copy.language.heading}
          </p>
          <p className="max-w-prose text-[12px] leading-loose text-ground-muted">
            {copy.language.body}
          </p>
        </section>
      </div>
    </div>
  );
}
