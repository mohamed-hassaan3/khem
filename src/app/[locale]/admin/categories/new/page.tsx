import { AdminPageHeader, AdminBackLink } from "@/src/components/admin/AdminTable";
import CategoryForm from "@/src/components/admin/CategoryForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { requireAdmin } from "@/src/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // The layout's gate does not cover a page on client navigation — see requireAdmin().
  await requireAdmin();

  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  return (
    <>
      <AdminBackLink href={localizePath(isLocale(locale) ? locale : "en", "/admin/categories")}>Categories</AdminBackLink>
      <AdminPageHeader
        title="New category"
        description="The slug becomes the category's URL and its id, and cannot be changed afterwards. Its page opens at /collections/<slug> the moment it is created."
      />
      <CategoryForm category={null} locale={activeLocale} />
    </>
  );
}
