import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import CollectionForm from "@/src/components/admin/CollectionForm";
import DeleteCollectionButton from "@/src/components/admin/DeleteCollectionButton";
import MerchPageForm from "@/src/components/admin/MerchPageForm";
import { parseMerchPageSlug } from "@/src/lib/facets";
import { isLocale, localizePath, type Locale } from "@/src/lib/i18n/config";
import {
  countMerchPageProducts,
  countProductsInCollection,
  getAdminCollection,
  getAdminMerchPage,
  listAdminCategories,
} from "@/src/services/admin/catalog";

export const dynamic = "force-dynamic";

/**
 * One collection — or one merchandising page.
 *
 * The same branch the storefront route makes, for the same reason: a real
 * collection is resolved first, then the slug is tried against the two
 * merchandising pages, and anything else 404s. Keeping them behind one URL
 * space means the dashboard address of a page is the storefront address of that
 * page, and the sidebar grows nothing.
 */
export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // The slug is a route param and therefore untrusted; it is used here as an
  // equality filter and nothing else.
  const [collection, productCount, categories] = await Promise.all([
    getAdminCollection(slug),
    countProductsInCollection(slug),
    listAdminCategories(),
  ]);

  if (!collection) return renderMerchPage(activeLocale, slug);

  return (
    <>
      <AdminPageHeader
        title={collection.name}
        description={`${productCount} product${productCount === 1 ? "" : "s"} in this collection.`}
        action={
          <Link
            href={localizePath(activeLocale, `/collections/${collection.slug}`)}
            className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
          >
            View on storefront ↗
          </Link>
        }
      />

      <CollectionForm
        collection={collection}
        categories={categories}
        locale={activeLocale}
      />

      <section className="mt-10 md:mt-16 max-w-3xl border-t border-ground-border pt-8">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-danger/70">
          Danger zone
        </h2>
        <p className="mt-3 mb-5 max-w-xl text-[11px] leading-relaxed text-ground-muted">
          Deleting a collection is permanent and has no archive equivalent. Only
          an empty collection can be deleted.
        </p>

        <DeleteCollectionButton
          slug={collection.slug}
          productCount={productCount}
          locale={activeLocale}
        />
      </section>
    </>
  );
}

/**
 * The edit screen for `/collections/best-sellers`.
 *
 * No danger zone: the page is routed by `MERCH_PAGE_FACETS`, so deleting the
 * row would leave a live URL rendering its dictionary fallback rather than
 * removing anything. There is nothing here to destroy.
 *
 * A slug that is a merchandising page but has no row means the migration has
 * not been applied; that 404s rather than rendering an empty form over a table
 * the save is about to miss.
 */
async function renderMerchPage(locale: Locale, slug: string) {
  const facet = parseMerchPageSlug(slug);
  if (!facet) notFound();

  const page = await getAdminMerchPage(facet);

  if (!page) notFound();

  const count = facet === "best-sellers"
    ? (await countMerchPageProducts())[facet]
    : null;

  return (
    <>
      <AdminPageHeader
        title={page.name}
        description={
          count === null
            ? "The complete catalogue overview shown at /collections."
            : `${count} live product${count === 1 ? "" : "s"} currently in this cut.`
        }
        action={
          <Link
            href={localizePath(locale, `/collections/${page.slug}`)}
            className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
          >
            View on storefront ↗
          </Link>
        }
      />

      <MerchPageForm page={page} />
    </>
  );
}
