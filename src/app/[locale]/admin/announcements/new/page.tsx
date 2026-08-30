import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import AnnouncementForm from "@/src/components/admin/AnnouncementForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";

/** A new line for the bar. */
export const dynamic = "force-dynamic";

export default async function NewAnnouncementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

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
        title="New announcement"
        description="One line, in both languages, shown at the top of every page while it is live."
      />

      <AnnouncementForm announcement={null} locale={activeLocale} />
    </>
  );
}
