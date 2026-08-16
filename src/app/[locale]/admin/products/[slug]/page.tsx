import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import ProductForm from "@/src/components/admin/ProductForm";
import ProductImageEditor from "@/src/components/admin/ProductImageEditor";
import StatusToggle from "@/src/components/admin/StatusToggle";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import { getAdminProduct, listAdminCollections } from "@/src/services/admin/catalog";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [product, collections] = await Promise.all([
    getAdminProduct(slug),
    listAdminCollections(),
  ]);

  if (!product) notFound();

  const collection = collections.find((entry) => entry.slug === product.collectionSlug);
  const hasDetailPage = collection?.kind === "FRAGRANCE";

  return (
    <>
      <AdminPageHeader
        title={product.name}
        description={product.isArchived ? "Archived — not visible anywhere on the storefront." : undefined}
        action={
          hasDetailPage ? (
            <Link
              href={localizePath(activeLocale, `/perfume/${product.slug}`)}
              className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/40 transition-colors duration-300 hover:text-gold"
            >
              View on storefront ↗
            </Link>
          ) : null
        }
      />

      <ProductForm product={product} collections={collections} locale={activeLocale} />

      <section className="mt-16 max-w-3xl border-t border-border pt-10">
        <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.25em] text-gold/70">
          Gallery
        </h2>
        <p className="mb-6 max-w-xl text-[11px] leading-relaxed text-ivory/30">
          The primary image is what every grid card shows. Order is the order
          the detail page displays them in.
        </p>

        <ProductImageEditor productSlug={product.slug} images={product.images} />
      </section>

      <section className="mt-16 max-w-3xl border-t border-border pt-8">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-danger/70">
          Availability
        </h2>
        <p className="mt-3 mb-5 max-w-xl text-[11px] leading-relaxed text-ivory/30">
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
