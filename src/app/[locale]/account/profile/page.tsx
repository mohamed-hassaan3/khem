import { UserProfile } from "@clerk/nextjs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getViewer } from "@/src/lib/auth";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ACCOUNT_PATHS } from "@/src/lib/routes";

/**
 * Profile.
 *
 * `<UserProfile />` rather than a hand-built form. Name, email, phone,
 * password, connected accounts, and active sessions are all Clerk-owned
 * records: writing them means the Backend API, and the sessions list has no
 * hand-rolled equivalent at all. The four inputs the previous page carried
 * were `defaultValue`-only — they held invented values and saved nothing.
 *
 * `routing="hash"` keeps Clerk's internal navigation in the fragment, so its
 * sub-pages do not need catch-all segments of their own under `/account`.
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

  const dict = await getDictionary(activeLocale);

  return (
    <div>
      <p className="eyebrow mb-3">{dict.account.profile.eyebrow}</p>

      <h1 className="mb-12 font-heading text-3xl font-normal text-ivory sm:text-4xl">
        {dict.account.profile.heading}
      </h1>

      {/*
       * Clerk's own card is wide; it scrolls inside this wrapper rather than
       * pushing the page into a horizontal scrollbar on a phone.
       */}
      <div className="max-w-full overflow-x-auto">
        <UserProfile routing="hash" />
      </div>
    </div>
  );
}
