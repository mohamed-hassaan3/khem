import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import StockistForm from "@/src/components/admin/StockistForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getAdminStockist } from "@/src/services/admin/directory";

/**
 * One location.
 *
 * Addressed by its id, which is the hand-typed short name — `cairo-flagship` —
 * and is permanent: the row is keyed by it, and renaming one would orphan
 * whatever links to it.
 */
export const dynamic = "force-dynamic";

export default async function EditStockistPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const stockist = await getAdminStockist(decodeURIComponent(id));
  if (!stockist) notFound();

  const listPath = localizePath(activeLocale, "/admin/stockists");

  return (
    <>
      <Link
        href={listPath}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35 transition-colors duration-300 hover:text-gold"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All stockists
      </Link>

      <AdminPageHeader
        title={stockist.name}
        description={
          stockist.isPublished
            ? `${stockist.city}, ${stockist.country} · on the public directory`
            : `${stockist.city}, ${stockist.country} · hidden from the public directory`
        }
      />

      <StockistForm stockist={stockist} locale={activeLocale} />
    </>
  );
}
