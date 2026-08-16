import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ArticleForm from "@/src/components/admin/ArticleForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getAdminArticle, listAdminArticles } from "@/src/services/admin/journal";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [article, all] = await Promise.all([
    getAdminArticle(slug),
    listAdminArticles(),
  ]);

  if (!article) notFound();

  const categories = [...new Set(all.map((entry) => entry.category))].sort();

  return (
    <>
      <AdminPageHeader
        title={article.title}
        description={article.isPublished ? undefined : "Draft — not visible to visitors."}
        action={
          article.isPublished ? (
            <Link
              href={localizePath(activeLocale, "/journal")}
              className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/40 transition-colors duration-300 hover:text-gold"
            >
              View journal ↗
            </Link>
          ) : null
        }
      />

      <ArticleForm article={article} categories={categories} locale={activeLocale} />
    </>
  );
}
