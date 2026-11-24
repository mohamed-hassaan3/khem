import { notFound } from "next/navigation";

import { AdminPageHeader, AdminBackLink } from "@/src/components/admin/AdminTable";
import ScentProfileEditor from "@/src/components/admin/ScentProfileEditor";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { parseScentProfileSlug } from "@/src/lib/scent-profiles";
import { getAdminScentProfile } from "@/src/services/admin/catalog";
import { requireAdmin } from "@/src/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function EditAdminScentProfilePage({ params }: { params: Promise<{ locale: string; profile: string }> }) {
  // The layout's gate does not cover a page on client navigation — see requireAdmin().
  await requireAdmin();

  const { locale, profile: segment } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const profileSlug = parseScentProfileSlug(segment);
  if (!profileSlug) notFound();
  const data = await getAdminScentProfile(profileSlug);
  if (!data) notFound();
  return <>
    <AdminBackLink href={localizePath(isLocale(locale) ? locale : "en", "/admin/categories/scent-families")}>Scent families</AdminBackLink>
    <AdminPageHeader title={data.profile.name} description={`Edit the ${profileSlug} scent profile.`} />
    <ScentProfileEditor profile={data.profile} members={data.members} locale={activeLocale} />
  </>;
}
