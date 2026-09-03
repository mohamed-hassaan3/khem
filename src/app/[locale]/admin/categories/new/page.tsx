import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import CategoryForm from "@/src/components/admin/CategoryForm";
import { isLocale } from "@/src/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  return (
    <>
      <AdminPageHeader
        title="New category"
        description="The slug becomes the category's URL and its id, and cannot be changed afterwards. Its page opens at /collections/<slug> the moment it is created."
      />
      <CategoryForm category={null} locale={activeLocale} />
    </>
  );
}
