import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AddressCard from "@/src/components/account/AddressCard";
import EmptyState from "@/src/components/ecommerce/EmptyState";
import { getViewer } from "@/src/lib/auth";
import { signInPathWithReturn } from "@/src/lib/auth-redirect";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import { ACCOUNT_PATHS } from "@/src/lib/routes";
import { getAddressesForUser } from "@/src/services/account";

/**
 * Saved delivery addresses.
 *
 * Empty until the `Address` table exists (AGENTS.md §9). The "Add New Address"
 * button the original design carried is deliberately absent along with Edit
 * and Remove: there is no Server Action to receive any of them, and a control
 * that silently does nothing is worse than its absence. All three arrive in
 * the migration that gives `getAddressesForUser` a query.
 */
export const dynamic = "force-dynamic";

const PATH = ACCOUNT_PATHS.addresses;

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
      title: dict.account.addresses.meta.title,
      description: dict.account.addresses.meta.description,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function AddressesPage({
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

  const [dict, addresses] = await Promise.all([
    getDictionary(activeLocale),
    getAddressesForUser(viewer.id),
  ]);

  return (
    <div>
      <p className="eyebrow mb-3">{dict.account.addresses.eyebrow}</p>

      <h1 className="mb-8 md:mb-12 font-heading text-3xl font-normal text-ivory sm:text-4xl">
        {dict.account.addresses.heading}
      </h1>

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          heading={dict.account.addresses.empty.heading}
          body={dict.account.addresses.empty.body}
          cta={dict.account.addresses.empty.cta}
          href="/collections"
        />
      ) : (
        <div className="grid grid-cols-1 gap-0.5 lg:grid-cols-2">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              locale={activeLocale}
              dict={dict.account.addresses}
            />
          ))}
        </div>
      )}
    </div>
  );
}
