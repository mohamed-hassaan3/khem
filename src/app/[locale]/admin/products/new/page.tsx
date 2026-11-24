import { AdminPageHeader, AdminBackLink } from "@/src/components/admin/AdminTable";
import ProductForm from "@/src/components/admin/ProductForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { listAdminCollections } from "@/src/services/admin/catalog";
import { requireAdmin } from "@/src/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // The layout's gate does not cover a page on client navigation — see requireAdmin().
  await requireAdmin();

  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [collections, dictionary] = await Promise.all([
    listAdminCollections(),
    getDictionary(activeLocale),
  ]);

  return (
    <>
      <AdminBackLink href={localizePath(isLocale(locale) ? locale : "en", "/admin/products")}>Products</AdminBackLink>
      <AdminPageHeader
        title="New product"
        description={dictionary.adminProduct.newDescription}
      />
      <ProductForm product={null} collections={collections} locale={activeLocale} />
    </>
  );
}
