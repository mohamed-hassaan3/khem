import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ArticleForm from "@/src/components/admin/ArticleForm";
import { isLocale } from "@/src/lib/i18n/config";
import { listAdminArticles } from "@/src/services/admin/journal";

export const dynamic = "force-dynamic";

export default async function NewArticlePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // Categories are free text, but reusing an existing one keeps the journal's
  // filter tabs from growing a near-duplicate on every article.
  const existing = await listAdminArticles();
  const categories = [...new Set(existing.map((article) => article.category))].sort();

  return (
    <>
      <AdminPageHeader
        title="New article"
        description="Save it unpublished to keep drafting; publishing puts it on /journal and in the sitemap."
      />
      <ArticleForm article={null} categories={categories} locale={activeLocale} />
    </>
  );
}
