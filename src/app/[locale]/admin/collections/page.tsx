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
import {
  listAdminCollections,
  listAdminMerchPages,
} from "@/src/services/admin/catalog";

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
  const [all, allMerchPages] = await Promise.all([
    listAdminCollections(),
    listAdminMerchPages(),
  ]);

  const collections = all.filter((collection) =>
    matchesTerm(term, [collection.name, collection.slug, collection.kind]),
  );

  /*
   * The merchandising page sits in the same table because that is where an
   * editor looks for "the pages under /collections". It is not a collection:
   * no product belongs to it, so it has no kind, no featured flag and no
   * running order — hence the em dashes rather than invented values.
   */
  const merchPages = allMerchPages.filter((page) =>
    matchesTerm(term, [page.name, page.slug, "MERCHANDISING"]),
  );

  const rows = collections.length + merchPages.length;

  return (
    <>
      <AdminPageHeader
        title="Collections"
        description="A collection decides where its products are sold. The merchandising rows below edit fixed catalogue pages, including the complete /collections overview."
        action={
          <AdminLinkButton href={localizePath(activeLocale, "/admin/collections/new")}>
            <Plus size={13} strokeWidth={1.25} />
            New collection
          </AdminLinkButton>
        }
      />

      <AdminSearch placeholder="Search by name, slug or kind" />

      {rows === 0 ? (
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
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                >
                  Edit
                </Link>
              </AdminCell>
            </AdminRow>
          ))}

          {merchPages.map((page) => (
            <AdminRow key={page.slug}>
              <AdminCell>{page.name}</AdminCell>
              <AdminCell muted>{page.slug}</AdminCell>
              <AdminCell muted>MERCHANDISING</AdminCell>
              <AdminCell muted>—</AdminCell>
              <AdminCell muted>—</AdminCell>
              <AdminCell>
                <Link
                  href={localizePath(activeLocale, `/admin/collections/${page.slug}`)}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
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
