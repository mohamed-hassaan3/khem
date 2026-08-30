import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import AnnouncementForm from "@/src/components/admin/AnnouncementForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getAdminAnnouncement } from "@/src/services/admin/marketing";

/** One line of the bar. */
export const dynamic = "force-dynamic";

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const announcement = await getAdminAnnouncement(decodeURIComponent(id));
  if (!announcement) notFound();

  return (
    <>
      <Link
        href={localizePath(activeLocale, "/admin/announcements")}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All announcements
      </Link>

      <AdminPageHeader
        title="Announcement"
        description={announcement.message}
      />

      <AnnouncementForm announcement={announcement} locale={activeLocale} />
    </>
  );
}
