import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import StockistForm from "@/src/components/admin/StockistForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { requireAdmin } from "@/src/lib/admin/auth";

/** A new location. The form is the same one the editor uses; only the id is free. */
export const dynamic = "force-dynamic";

export default async function NewStockistPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // The layout's gate does not cover a page on client navigation — see requireAdmin().
  await requireAdmin();

  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const listPath = localizePath(activeLocale, "/admin/stockists");

  return (
    <>
      <Link
        href={listPath}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All stockists
      </Link>

      <AdminPageHeader
        title="Add a location"
        description="An open location needs an address; an announced one publishes no details at all. The directory refreshes on the public site within the hour."
      />

      <StockistForm stockist={null} locale={activeLocale} />
    </>
  );
}
