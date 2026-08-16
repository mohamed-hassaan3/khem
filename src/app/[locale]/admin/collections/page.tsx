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
import { matchesTerm, searchTerm } from "@/src/lib/admin/filter";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { listAdminCollections } from "@/src/services/admin/catalog";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const term = searchTerm(query);
  const all = await listAdminCollections();

  const collections = all.filter((collection) =>
    matchesTerm(term, [collection.name, collection.slug, collection.kind]),
  );

  return (
    <>
      <AdminPageHeader
        title="Collections"
        description="A collection decides where its products are sold: fragrances get their own detail pages, everything else sells from a category grid."
        action={
          <AdminLinkButton href={localizePath(activeLocale, "/admin/collections/new")}>
            <Plus size={13} strokeWidth={1.25} />
            New collection
          </AdminLinkButton>
        }
      />

      <AdminSearch placeholder="Search by name, slug or kind" />

      {collections.length === 0 ? (
        <AdminEmpty
          message={
            term.length > 0
              ? `Nothing matches “${term}”.`
              : "No collections yet. Products cannot exist without one."
          }
          action={
            term.length > 0 ? undefined : (
              <AdminLinkButton href={localizePath(activeLocale, "/admin/collections/new")}>
                Create the first collection
              </AdminLinkButton>
            )
          }
        />
      ) : (
        <AdminTable
          headers={[
            "Name",
            "Slug",
            "Kind",
            "Home page",
            "Order",
            { label: "Edit", hidden: true },
          ]}
        >
          {collections.map((collection) => (
            <AdminRow key={collection.slug}>
              <AdminCell>{collection.name}</AdminCell>
              <AdminCell muted>{collection.slug}</AdminCell>
              <AdminCell muted>{collection.kind}</AdminCell>
              <AdminCell>
                <AdminStatus
                  live={collection.isFeatured}
                  liveLabel="Featured"
                  offLabel="—"
                />
              </AdminCell>
              <AdminCell muted>{collection.sortOrder}</AdminCell>
              <AdminCell>
                <Link
                  href={localizePath(
                    activeLocale,
                    `/admin/collections/${collection.slug}`,
                  )}
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
