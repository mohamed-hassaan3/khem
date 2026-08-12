import { Droplet, Gem, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import CategoryHero from "@/src/components/ecommerce/CategoryHero";
import FeatureTriptych from "@/src/components/ecommerce/FeatureTriptych";
import MerchGrid from "@/src/components/ecommerce/MerchGrid";
import { LOCALES, isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import {
  getCollectionBySlug,
  getProductCardsByKind,
} from "@/src/services/products";

/**
 * ISR, 1 hour — a catalog listing page, matching `/collections`.
 */
export const revalidate = 3600;

const PATH = "/body-care";
const COLLECTION_SLUG = "body-care";

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
    title: dict.bodyCare.meta.title,
    description: dict.bodyCare.meta.description,
    ogTitle: dict.bodyCare.meta.ogTitle,
    ogDescription: dict.bodyCare.meta.ogDescription,
  });
}

/** Body care — rituals for the skin. */
export default async function BodyCarePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, collection, products] = await Promise.all([
    params,
    getCollectionBySlug(COLLECTION_SLUG),
    getProductCardsByKind("BODY"),
  ]);

  // The layout has already rejected any segment that is not a real locale.
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  // The collection is what supplies the hero. Its absence means the category
  // has been retired from the catalog, which is a 404 rather than a bare page.
  if (!collection) notFound();

  const ritual = dict.bodyCare.ritual;

  return (
    <div className="min-h-screen bg-background text-ivory">
      <CategoryHero
        eyebrow={dict.bodyCare.eyebrow}
        titleLead={dict.bodyCare.titleLead}
        titleAccent={dict.bodyCare.titleAccent}
        description={dict.bodyCare.description}
        imageUrl={collection.bannerUrl}
        imageAlt={collection.bannerAlt}
      />

      {/* The SPA drew these three with `✦ ◆ ◇`; they are Lucide icons now. */}
      <FeatureTriptych
        items={[
          { icon: Sparkles, ...ritual.layering },
          { icon: Gem, ...ritual.natural },
          { icon: Droplet, ...ritual.practice },
        ]}
      />

      <MerchGrid
        items={products}
        locale={activeLocale}
        emptyLabel={dict.bodyCare.empty}
      />
    </div>
  );
}
