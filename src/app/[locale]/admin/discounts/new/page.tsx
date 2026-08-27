import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import DiscountForm from "@/src/components/admin/DiscountForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  listAdminCollections,
  listAdminProducts,
} from "@/src/services/admin/catalog";

/** A new code. Restrictions are pickers over the live catalog, never free text. */
export const dynamic = "force-dynamic";

export default async function NewDiscountPage({
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
        href={localizePath(activeLocale, "/admin/discounts")}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35 transition-colors duration-300 hover:text-gold"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All discounts
      </Link>

      <AdminPageHeader
        title="New discount"
        description="What the code is worth is decided by the database when an order is placed. This screen describes the rule."
      />

      <DiscountForm
        discount={null}
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
