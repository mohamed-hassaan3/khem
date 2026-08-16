import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import CollectionForm from "@/src/components/admin/CollectionForm";
import DeleteCollectionButton from "@/src/components/admin/DeleteCollectionButton";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  countProductsInCollection,
  getAdminCollection,
} from "@/src/services/admin/catalog";

export const dynamic = "force-dynamic";

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  // The slug is a route param and therefore untrusted; it is used here as an
  // equality filter and nothing else.
  const [collection, productCount] = await Promise.all([
    getAdminCollection(slug),
    countProductsInCollection(slug),
  ]);

  if (!collection) notFound();

  return (
    <>
      <AdminPageHeader
        title={collection.name}
        description={`${productCount} product${productCount === 1 ? "" : "s"} in this collection.`}
        action={
          <Link
            href={localizePath(activeLocale, `/collections/${collection.slug}`)}
            className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/40 transition-colors duration-300 hover:text-gold"
          >
            View on storefront ↗
          </Link>
        }
      />

      <CollectionForm collection={collection} locale={activeLocale} />

      <section className="mt-16 max-w-3xl border-t border-border pt-8">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-danger/70">
          Danger zone
        </h2>
        <p className="mt-3 mb-5 max-w-xl text-[11px] leading-relaxed text-ivory/30">
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
