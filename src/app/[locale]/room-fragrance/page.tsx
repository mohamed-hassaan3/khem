import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CategoryHero from "@/src/components/ecommerce/CategoryHero";
import MerchGrid from "@/src/components/ecommerce/MerchGrid";
import { LOCALES, isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import {
  getCollectionBySlug,
  getProductCardsByKind,
} from "@/src/services/products";

/** ISR, 1 hour — a catalog listing page, matching `/collections`. */
export const revalidate = 3600;

const PATH = "/room-fragrance";
const COLLECTION_SLUG = "room-fragrance";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  return localeMetadata({
    locale: activeLocale,
    path: PATH,
    title: dict.roomFragrance.meta.title,
    description: dict.roomFragrance.meta.description,
    ogTitle: dict.roomFragrance.meta.ogTitle,
    ogDescription: dict.roomFragrance.meta.ogDescription,
  });
}

/**
 * Home fragrance — scent for a room.
 *
 * The filter bar lives inside `<MerchGrid>` and derives its tabs from the
 * products present, so a candle or a diffuser added to the catalog appears as a
 * filter with no edit here.
 */
export default async function RoomFragrancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, collection, products] = await Promise.all([
    params,
    getCollectionBySlug(COLLECTION_SLUG),
    getProductCardsByKind("HOME"),
  ]);

  // The layout has already rejected any segment that is not a real locale.
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  if (!collection) notFound();

  return (
    <div className="min-h-screen bg-background text-ivory">
      <CategoryHero
        eyebrow={dict.roomFragrance.eyebrow}
        titleLead={dict.roomFragrance.titleLead}
        titleAccent={dict.roomFragrance.titleAccent}
        description={dict.roomFragrance.description}
        imageUrl={collection.bannerUrl}
        imageAlt={collection.bannerAlt}
      />

      <MerchGrid
        items={products}
        locale={activeLocale}
        emptyLabel={dict.roomFragrance.empty}
        showFilters
      />
    </div>
  );
}
