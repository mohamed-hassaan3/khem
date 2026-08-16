import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ProductForm from "@/src/components/admin/ProductForm";
import { isLocale } from "@/src/lib/i18n/config";
import { listAdminCollections } from "@/src/services/admin/catalog";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const collections = await listAdminCollections();

  return (
    <>
      <AdminPageHeader
        title="New product"
        description="Photographs are added on the next screen, once the product exists."
      />
      <ProductForm product={null} collections={collections} locale={activeLocale} />
    </>
  );
}
