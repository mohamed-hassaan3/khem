import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/src/components/admin/AdminTable";
import OfferForm from "@/src/components/admin/OfferForm";
import { isLocale, localizePath } from "@/src/lib/i18n/config";
import {
  listAdminCollections,
  listAdminProducts,
} from "@/src/services/admin/catalog";
import { getOffer } from "@/src/services/admin/offers";

/** One offer, with its four selections. */
export const dynamic = "force-dynamic";

export default async function EditOfferPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";

  const [offer, products, collections] = await Promise.all([
    getOffer(id),
    listAdminProducts(),
    listAdminCollections(),
  ]);

  if (!offer) notFound();

  return (
    <>
      <Link
        href={localizePath(activeLocale, "/admin/offers")}
        className="mb-8 inline-flex items-center gap-2 font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
      >
        <ArrowLeft size={13} strokeWidth={1.25} />
        All offers
      </Link>

      <AdminPageHeader
        title={offer.name}
        description={
          offer.redemptionCount === 0
            ? "Not used yet."
            : `Used ${offer.redemptionCount} ${offer.redemptionCount === 1 ? "time" : "times"}. A refunded order returns its use to both caps.`
        }
      />

      <OfferForm
        offer={offer}
        locale={activeLocale}
        products={products
          .filter((product) => !product.isArchived)
          .map((product) => ({ slug: product.slug, name: product.name }))}
        collections={collections.map((collection) => ({
          slug: collection.slug,
          name: collection.name,
        }))}
      />
    </>
  );
}
