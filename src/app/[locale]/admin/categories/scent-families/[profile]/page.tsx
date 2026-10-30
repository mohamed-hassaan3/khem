import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ScentProfileEditor from "@/src/components/admin/ScentProfileEditor";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { parseScentProfileSlug } from "@/src/lib/scent-profiles";
import { getAdminScentProfile } from "@/src/services/admin/catalog";

export const dynamic = "force-dynamic";

export default async function EditAdminScentProfilePage({ params }: { params: Promise<{ locale: string; profile: string }> }) {
  const { locale, profile: segment } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const profileSlug = parseScentProfileSlug(segment);
  if (!profileSlug) notFound();
  const data = await getAdminScentProfile(profileSlug);
  if (!data) notFound();
  return <>
    <AdminPageHeader title={data.profile.name} description={`Edit the ${profileSlug} scent profile.`} action={<Link href={localizePath(activeLocale, "/admin/categories/scent-families")} className="font-heading text-[9px] uppercase tracking-[0.16em] text-ground-accent">All scent profiles</Link>} />
    <ScentProfileEditor profile={data.profile} members={data.members} locale={activeLocale} />
  </>;
}
