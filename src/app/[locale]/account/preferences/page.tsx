import { redirect } from "next/navigation";

import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { ACCOUNT_PATHS } from "@/src/lib/routes";

/**
 * Preferences — now a section of the profile.
 *
 * The panel moved into `/account/profile#preferences`. This route stays for the
 * links already sent: every marketing letter's footer points a customer at
 * their preferences, and those letters cannot be edited after they are sent.
 *
 * The unsubscribe link itself is unaffected — it goes to `/unsubscribe` and has
 * never come through here.
 */
export const dynamic = "force-dynamic";

export default async function PreferencesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  redirect(
    `${localizePath(activeLocale, ACCOUNT_PATHS.profile)}#preferences`,
  );
}
