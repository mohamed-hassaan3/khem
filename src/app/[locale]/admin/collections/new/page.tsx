import { AdminPageHeader, AdminBackLink } from "@/src/components/admin/AdminTable";
import CollectionForm from "@/src/components/admin/CollectionForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listAdminCategories } from "@/src/services/admin/catalog";
import { requireAdmin } from "@/src/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function NewCollectionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // The layout's gate does not cover a page on client navigation — see requireAdmin().
  await requireAdmin();

  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const categories = await listAdminCategories();

  return (
    <>
      <AdminBackLink href={localizePath(isLocale(locale) ? locale : "en", "/admin/collections")}>Collections</AdminBackLink>
      <AdminPageHeader
        title="New collection"
        description="A collection stands under a category and holds products. The slug becomes its URL and its id, and cannot be changed afterwards."
      />
      <CollectionForm
        collection={null}
        categories={categories}
        locale={activeLocale}
      />
    </>
  );
}
