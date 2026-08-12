import { Feather, Gift, PackageCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Reveal from "@/src/components/animation/Reveal";
import CategoryHero from "@/src/components/ecommerce/CategoryHero";
import DiscoverySetCard from "@/src/components/ecommerce/DiscoverySetCard";
import FeatureTriptych from "@/src/components/ecommerce/FeatureTriptych";
import { LOCALES, isLocale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { localeMetadata } from "@/src/lib/i18n/metadata";
import {
  getCollectionBySlug,
  getProductCardsByKind,
} from "@/src/services/products";

/** ISR, 1 hour — a catalog listing page, matching `/collections`. */
export const revalidate = 3600;

const PATH = "/gift-set";
const COLLECTION_SLUG = "gift-set";

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
    title: dict.giftSet.meta.title,
    description: dict.giftSet.meta.description,
    ogTitle: dict.giftSet.meta.ogTitle,
    ogDescription: dict.giftSet.meta.ogDescription,
  });
}

/**
 * Gift sets — the house composed for giving.
 *
 * Structurally `/discovery`'s twin, and deliberately so: both sell a boxed
 * composition straight from the card, so both use `<DiscoverySetCard>`, which
 * prints the contents list and the merchandising badge a single product card
 * has nowhere to put. What separates them is the goods — full-size flacons and
 * ritual objects here, sample vials there — which is why they are different
 * `CollectionKind`s with different routes rather than one grid with a filter.
 */
export default async function GiftSetPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, collection, sets] = await Promise.all([
    params,
    getCollectionBySlug(COLLECTION_SLUG),
    getProductCardsByKind("GIFT"),
  ]);

  // The layout has already rejected any segment that is not a real locale.
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  // The collection is what supplies the hero. Its absence means the category
  // has been retired from the catalog, which is a 404 rather than a bare page.
  if (!collection) notFound();

  const ritual = dict.giftSet.ritual;

  return (
    <div className="min-h-screen bg-background text-ivory">
      <CategoryHero
        eyebrow={dict.giftSet.eyebrow}
        titleLead={dict.giftSet.titleLead}
        titleAccent={dict.giftSet.titleAccent}
        description={dict.giftSet.description}
        note={dict.giftSet.note}
        imageUrl={collection.bannerUrl}
        imageAlt={collection.bannerAlt}
      />

      <section className="bg-background px-6 py-24 md:px-20 md:py-30">
        <div className="mx-auto max-w-350">
          {sets.length === 0 ? (
            <p className="py-24 text-center text-[13px] leading-loose text-ivory/35">
              {dict.giftSet.empty}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
              {sets.map((set, index) => (
                <Reveal key={set.id} delay={(index % 3) * 0.1}>
                  <DiscoverySetCard product={set} locale={activeLocale} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <FeatureTriptych
        items={[
          { icon: Gift, ...ritual.presentation },
          { icon: Feather, ...ritual.message },
          { icon: PackageCheck, ...ritual.delivery },
        ]}
      />
    </div>
  );
}
