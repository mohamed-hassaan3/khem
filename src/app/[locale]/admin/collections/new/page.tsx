import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import CollectionForm from "@/src/components/admin/CollectionForm";
import { isLocale } from "@/src/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function NewCollectionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  return (
    <>
      <AdminPageHeader
        title="New collection"
        description="The slug becomes the collection's URL and its id, and cannot be changed afterwards."
      />
      <CollectionForm collection={null} locale={activeLocale} />
    </>
  );
}
