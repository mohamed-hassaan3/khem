import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import PromotionForm from "@/src/components/admin/PromotionForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  listAdminCollections,
  listAdminProducts,
} from "@/src/services/admin/catalog";

/** A new campaign. Targets are pickers over the live catalog, never free text. */
export const dynamic = "force-dynamic";

export default async function NewPromotionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [products, collections] = await Promise.all([
    listAdminProducts(),
    listAdminCollections(),
  ]);

  return (
    <>
      <Link
        href={localizePath(activeLocale, "/admin/promotions")}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All promotions
      </Link>

      <AdminPageHeader
        title="New promotion"
        description="What the campaign takes off is applied by the database when an order is placed. This screen describes the rule."
      />

      <PromotionForm
        promotion={null}
        locale={activeLocale}
        products={products
          .filter((product) => !product.isArchived)
          .map((product) => ({ slug: product.slug, name: product.name }))}
        collections={collections.map((collection) => ({
          slug: collection.slug,
          name: collection.name,
        }))}
      />
    </>
  );
}
