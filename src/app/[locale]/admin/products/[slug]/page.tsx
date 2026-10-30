import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ProductForm from "@/src/components/admin/ProductForm";
import ProductImageEditor from "@/src/components/admin/ProductImageEditor";
import { AdminNotice } from "@/src/components/admin/fields";
import StatusToggle from "@/src/components/admin/StatusToggle";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { hasDetailPage, productHref } from "@/src/lib/routes";
import { getAdminProduct, getAdminProductScentProfileSlugs, listAdminCollections } from "@/src/services/admin/catalog";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams]);
  const activeLocale = isLocale(locale) ? locale : "en";

  const [product, collections, dictionary, scentProfileSlugs] = await Promise.all([
    getAdminProduct(slug),
    listAdminCollections(),
    getDictionary(activeLocale),
    getAdminProductScentProfileSlugs(slug),
  ]);

  if (!product) notFound();

  const collection = collections.find((entry) => entry.slug === product.collectionSlug);

  /*
   * Both facts come from `src/lib/routes.ts` rather than from a `kind ===
   * "FRAGRANCE"` test written out again here. That local copy of the rule went
   * stale the moment body care and home fragrance gained `/ritual/[slug]`: an
   * editor would have been left with no way to preview a page that exists.
   *
   * A product whose collection could not be resolved gets no link, since there
   * is no kind to route on.
   */
  const linkable = collection ? { slug: product.slug, collectionKind: collection.kind } : null;
  const storefrontHref = linkable && hasDetailPage(linkable) ? productHref(linkable) : null;

  return (
    <>
      <AdminPageHeader
        title={product.name}
        description={product.isArchived ? "Archived — not visible anywhere on the storefront." : undefined}
        action={
          storefrontHref ? (
            <Link
              href={localizePath(activeLocale, storefrontHref)}
              className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
            >
              View on storefront ↗
            </Link>
          ) : null
        }
      />

      {query.gallery === "save-failed" ? (
        <div className="mb-6 max-w-3xl">
          <AdminNotice tone="error">{dictionary.adminProduct.gallerySaveFailed}</AdminNotice>
        </div>
      ) : null}

      <ProductForm product={product} collections={collections} locale={activeLocale} scentProfileSlugs={scentProfileSlugs} />

      <section className="mt-10 md:mt-16 max-w-3xl border-t border-ground-border pt-10">
        <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.25em] text-ground-accent">
          Gallery
        </h2>
        <p className="mb-6 max-w-xl text-[11px] leading-relaxed text-ground-muted">
          The primary image is what every grid card shows. Order is the order
          the detail page displays them in.
        </p>

        <ProductImageEditor productSlug={product.slug} images={product.images} />
      </section>

      <section className="mt-10 md:mt-16 max-w-3xl border-t border-ground-border pt-8">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-danger/70">
          Availability
        </h2>
        <p className="mt-3 mb-5 max-w-xl text-[11px] leading-relaxed text-ground-muted">
          Archiving removes this product from every grid and 404s its detail
          page. Nothing is deleted, and it can be restored from here or from the
          list.
        </p>

        <StatusToggle
          kind="product-archive"
          slug={product.slug}
          isOn={!product.isArchived}
          onLabel="Archive product"
          offLabel="Restore product"
          confirmLabel="Click again to confirm"
        />
      </section>
    </>
  );
}
