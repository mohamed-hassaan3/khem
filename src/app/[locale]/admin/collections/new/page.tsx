import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import CollectionForm from "@/src/components/admin/CollectionForm";
import { isLocale } from "@/src/lib/i18n/config";
import { listAdminCategories } from "@/src/services/admin/catalog";

export const dynamic = "force-dynamic";

export default async function NewCollectionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const categories = await listAdminCategories();

  return (
    <>
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
