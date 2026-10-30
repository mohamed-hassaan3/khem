import Link from "next/link";
import { Plus } from "lucide-react";

import {
  AdminCell,
  AdminLinkButton,
  AdminPageHeader,
  AdminRow,
  AdminStatus,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import AdminSearch from "@/src/components/admin/AdminSearch";
import { searchTerm } from "@/src/lib/admin/filter";
import { withScentFamiliesRow } from "@/src/lib/admin/category-rows";
import { SCENT_PROFILE_SLUGS } from "@/src/lib/scent-profiles";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  listAdminCategories,
  listAdminCollections,
} from "@/src/services/admin/catalog";

export const dynamic = "force-dynamic";

/**
 * The shelves — the top of the catalogue hierarchy.
 *
 * Category → Collection → Product, and this is the first of the three. The
 * count of collections is printed here rather than left to the edit screen
 * because it is the one number that says whether a category is doing anything.
 */
export default async function AdminCategoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const term = searchTerm(query);
  const [all, collections] = await Promise.all([
    listAdminCategories(),
    listAdminCollections(),
  ]);

  const rows = withScentFamiliesRow(all, term);

  const counts = new Map<string, number>();
  for (const collection of collections) {
    counts.set(
      collection.categorySlug,
      (counts.get(collection.categorySlug) ?? 0) + 1,
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Categories"
        description="A category is the shelf a collection stands on — Fragrances, Body Care, Home Fragrances. It decides how the goods beneath it are sold, and it has a page of its own listing everything on it."
        action={
          <AdminLinkButton
            href={localizePath(activeLocale, "/admin/categories/new")}
          >
            <Plus size={13} strokeWidth={1.25} />
            New category
          </AdminLinkButton>
        }
      />

      <AdminSearch
        placeholder="Search categories"
        label="Search categories by name, slug or kind"
      />

      <AdminTable
          headers={[
            "Name",
            "Slug",
            "Kind",
            "Collections",
            "Storefront",
            "Order",
            { label: "Edit", hidden: true },
          ]}
        >
          {rows.map((row) => row.type === "scent-families" ? (
            <AdminRow key={row.slug}>
              <AdminCell>{row.name}</AdminCell>
              <AdminCell muted>{row.slug}</AdminCell>
              <AdminCell muted>{row.kind}</AdminCell>
              <AdminCell muted>{SCENT_PROFILE_SLUGS.length}</AdminCell>
              <AdminCell><AdminStatus live liveLabel="Offered" offLabel="Withdrawn" /></AdminCell>
              <AdminCell muted>—</AdminCell>
              <AdminCell>
                <Link
                  href={localizePath(activeLocale, "/admin/categories/scent-families")}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                >
                  Edit
                </Link>
              </AdminCell>
            </AdminRow>
          ) : (
            <AdminRow key={row.category.slug}>
              <AdminCell>{row.category.name}</AdminCell>
              <AdminCell muted>{row.category.slug}</AdminCell>
              <AdminCell muted>{row.category.kind}</AdminCell>
              <AdminCell muted>{counts.get(row.category.slug) ?? 0}</AdminCell>
              <AdminCell>
                <AdminStatus
                  live={row.category.isEnabled}
                  liveLabel="Offered"
                  offLabel="Withdrawn"
                />
              </AdminCell>
              <AdminCell muted>{row.category.sortOrder}</AdminCell>
              <AdminCell>
                <Link
                  href={localizePath(activeLocale, `/admin/categories/${row.category.slug}`)}
                  className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent transition-colors duration-300 hover:text-ground-accent"
                >
                  Edit
                </Link>
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
    </>
  );
}
