import Link from "next/link";
import { Plus } from "lucide-react";

import {
  AdminCell,
  AdminEmpty,
  AdminLinkButton,
  AdminPageHeader,
  AdminRow,
  AdminStatus,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import AdminSearch from "@/src/components/admin/AdminSearch";
import StatusToggle from "@/src/components/admin/StatusToggle";
import { matchesTerm, searchTerm } from "@/src/lib/admin/filter";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listAdminArticles } from "@/src/services/admin/journal";

export const dynamic = "force-dynamic";

export default async function AdminJournalPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const term = searchTerm(query);
  const all = await listAdminArticles();

  const articles = all.filter((article) =>
    matchesTerm(term, [article.title, article.slug, article.category]),
  );

  return (
    <>
      <AdminPageHeader
        title="Journal"
        description="An unpublished article is invisible to visitors — the database policy hides it, so a draft is genuinely private rather than merely unlinked."
        action={
          <AdminLinkButton href={localizePath(activeLocale, "/admin/journal/new")}>
            <Plus size={13} strokeWidth={1.25} />
            New article
          </AdminLinkButton>
        }
      />

      <AdminSearch placeholder="Search by title, slug or category" />

      {articles.length === 0 ? (
        <AdminEmpty
          message={term.length > 0 ? `Nothing matches “${term}”.` : "No articles yet."}
          action={
            term.length > 0 ? undefined : (
              <AdminLinkButton href={localizePath(activeLocale, "/admin/journal/new")}>
                Write the first article
              </AdminLinkButton>
            )
          }
        />
      ) : (
        <AdminTable
          headers={[
            "Title",
            "Category",
            "Date",
            "Read",
            "Status",
            { label: "Publication action", hidden: true },
            { label: "Edit", hidden: true },
          ]}
        >
          {articles.map((article) => (
            <AdminRow key={article.slug}>
              <AdminCell>
                <span className="block">{article.title}</span>
                <span className="mt-1 block text-[10px] tracking-wide text-ivory/25">
                  {article.slug}
                  {article.isFeatured ? " · featured" : ""}
                </span>
              </AdminCell>
              <AdminCell muted>{article.category}</AdminCell>
              <AdminCell muted>{article.publishedAt}</AdminCell>
              <AdminCell muted>{article.readTimeMinutes} min</AdminCell>
              <AdminCell>
                <AdminStatus
                  live={article.isPublished}
                  liveLabel="Published"
                  offLabel="Draft"
                />
              </AdminCell>
              <AdminCell>
                <StatusToggle
                  kind="article-publish"
                  slug={article.slug}
                  isOn={article.isPublished}
                  onLabel="Unpublish"
                  offLabel="Publish"
                  confirmLabel="Confirm"
                />
              </AdminCell>
              <AdminCell>
                <Link
                  href={localizePath(activeLocale, `/admin/journal/${article.slug}`)}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-gold/70 transition-colors duration-300 hover:text-gold"
                >
                  Edit
                </Link>
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </>
  );
}
