import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdminCell,
  AdminLinkButton,
  AdminPageHeader,
  AdminRow,
  AdminTable,
} from "@/src/components/admin/AdminTable";
import CategoryForm from "@/src/components/admin/CategoryForm";
import DeleteCategoryButton from "@/src/components/admin/DeleteCategoryButton";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  getAdminCategory,
  listAdminCollections,
} from "@/src/services/admin/catalog";

export const dynamic = "force-dynamic";

/**
 * One category, and what stands on it.
 *
 * The collections are listed here rather than left to the Collections screen
 * because this is where the hierarchy is legible: the shelf, and the ranges on
 * it, in one place. Each row links to its own edit screen — nothing is edited
 * twice.
 */
export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // The slug is a route param and therefore untrusted; it is used here as an
  // equality filter and nothing else.
  const [category, allCollections] = await Promise.all([
    getAdminCategory(slug),
    listAdminCollections(),
  ]);

  if (!category) notFound();

  const collections = allCollections.filter(
    (collection) => collection.categorySlug === category.slug,
  );

  return (
    <>
      <AdminPageHeader
        title={category.name}
        description={`${collections.length} collection${collections.length === 1 ? "" : "s"} under this category.`}
        action={
          <Link
            href={localizePath(activeLocale, `/collections/${category.slug}`)}
            className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
          >
            View on storefront ↗
          </Link>
        }
      />

      <CategoryForm category={category} locale={activeLocale} />

      <section className="mt-10 md:mt-16 max-w-3xl border-t border-ground-border pt-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-ground-subtle">
              Collections on this shelf
            </h2>
            <p className="mt-3 max-w-xl text-[11px] leading-relaxed text-ground-muted">
              Every product beneath this category is reached through one of
              these. The category page lists them all together.
            </p>
          </div>

          <AdminLinkButton
            href={localizePath(activeLocale, "/admin/collections/new")}
          >
            New collection
          </AdminLinkButton>
        </div>

        {collections.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-ground-muted">
            Nothing stands here yet.
          </p>
        ) : (
          <AdminTable
            headers={["Name", "Slug", "Order", { label: "Edit", hidden: true }]}
          >
            {collections.map((collection) => (
              <AdminRow key={collection.slug}>
                <AdminCell>{collection.name}</AdminCell>
                <AdminCell muted>{collection.slug}</AdminCell>
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
          </AdminTable>
        )}
      </section>

      <section className="mt-10 md:mt-16 max-w-3xl border-t border-ground-border pt-8">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-danger/70">
          Danger zone
        </h2>
        <p className="mt-3 mb-5 max-w-xl text-[11px] leading-relaxed text-ground-muted">
          Deleting a category is permanent. Only an empty one can be deleted —
          and switching it off above withdraws it from the storefront without
          losing anything.
        </p>

        <DeleteCategoryButton
          slug={category.slug}
          collectionCount={collections.length}
          locale={activeLocale}
        />
      </section>
    </>
  );
}
