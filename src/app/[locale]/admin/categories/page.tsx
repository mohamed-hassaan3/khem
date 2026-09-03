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

  const categories = all.filter((category) =>
    matchesTerm(term, [category.name, category.slug, category.kind]),
  );

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

      {categories.length === 0 ? (
        <AdminEmpty
          message={
            term.length > 0
              ? `Nothing matches “${term}”.`
              : "No categories yet. A collection cannot exist without one."
          }
          action={
            term.length > 0 ? undefined : (
              <AdminLinkButton
                href={localizePath(activeLocale, "/admin/categories/new")}
              >
                Create the first category
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
            "Collections",
            "Storefront",
            "Order",
            { label: "Edit", hidden: true },
          ]}
        >
          {categories.map((category) => (
            <AdminRow key={category.slug}>
              <AdminCell>{category.name}</AdminCell>
              <AdminCell muted>{category.slug}</AdminCell>
              <AdminCell muted>{category.kind}</AdminCell>
              <AdminCell muted>{counts.get(category.slug) ?? 0}</AdminCell>
              <AdminCell>
                <AdminStatus
                  live={category.isEnabled}
                  liveLabel="Offered"
                  offLabel="Withdrawn"
                />
              </AdminCell>
              <AdminCell muted>{category.sortOrder}</AdminCell>
              <AdminCell>
                <Link
                  href={localizePath(
                    activeLocale,
                    `/admin/categories/${category.slug}`,
                  )}
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
