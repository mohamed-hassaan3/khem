import { redirect } from "next/navigation";

import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { ACCOUNT_PATHS } from "@/src/lib/routes";

/**
 * Addresses — now a section of the profile.
 *
 * The panel moved into `/account/profile#addresses`, and this route stays
 * because links to it are already out in the world: bookmarks, and the account
 * links the house's letters carry. A 404 for somebody following one of those
 * would be a worse outcome than either place having the panel.
 *
 * No metadata and no session gate of its own. It renders nothing and reads
 * nothing — the layout above it has already rejected an unauthenticated
 * request, and the profile route gates itself again on arrival.
 */
export const dynamic = "force-dynamic";

export default async function AddressesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  redirect(
    `${localizePath(activeLocale, ACCOUNT_PATHS.profile)}#addresses`,
  );
}
