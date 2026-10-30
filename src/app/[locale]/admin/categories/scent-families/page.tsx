import Link from "next/link";

import { AdminPageHeader, AdminTable, AdminRow, AdminCell, AdminEmpty } from "@/src/components/admin/AdminTable";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { SCENT_PROFILE_SLUGS } from "@/src/lib/scent-profiles";
import { listAdminScentProfiles } from "@/src/services/admin/catalog";

export const dynamic = "force-dynamic";

export default async function AdminScentProfilesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const profiles = await listAdminScentProfiles();
  return <>
    <AdminPageHeader title="Scent families" description="Manage profile page copy and the products assigned to each fixed scent profile." />
    {profiles.length === 0 ? <AdminEmpty message="Scent profiles are unavailable. Confirm the profile tables have been set up." /> : (
      <AdminTable headers={["Profile", "Products", "Storefront", { label: "Edit", hidden: true }]}>
        {SCENT_PROFILE_SLUGS.map((slug) => {
          const profile = profiles.find((entry) => entry.slug === slug);
          if (!profile) return null;
          return <AdminRow key={slug}>
            <AdminCell>{profile.name}<span className="mt-1 block text-[10px] text-ground-muted">{slug}</span></AdminCell>
            <AdminCell muted>{profile.memberCount}</AdminCell>
            <AdminCell><Link href={localizePath(activeLocale, `/collections/${slug}`)} className="font-heading text-[9px] uppercase tracking-[0.16em] text-ground-accent">View ↗</Link></AdminCell>
            <AdminCell><Link href={localizePath(activeLocale, `/admin/categories/scent-families/${slug}`)} className="font-heading text-[9px] uppercase tracking-[0.16em] text-ground-accent">Edit</Link></AdminCell>
          </AdminRow>;
        })}
      </AdminTable>
    )}
  </>;
}
