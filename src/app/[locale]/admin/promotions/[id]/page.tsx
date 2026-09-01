import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import PromotionForm from "@/src/components/admin/PromotionForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  listAdminCollections,
  listAdminProducts,
} from "@/src/services/admin/catalog";
import { getPromotion } from "@/src/services/admin/promotions";

/** One promotion. */
export const dynamic = "force-dynamic";

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [promotion, products, collections] = await Promise.all([
    getPromotion(decodeURIComponent(id)),
    listAdminProducts(),
    listAdminCollections(),
  ]);

  if (!promotion) notFound();

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
        title={promotion.name}
        description={
          promotion.productCount === 0
            ? "Pricing nothing at the moment — check its window, its switch, and whether another promotion outranks it."
            : `Currently the price on ${promotion.productCount} product${promotion.productCount === 1 ? "" : "s"}.`
        }
      />

      <PromotionForm
        promotion={promotion}
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
