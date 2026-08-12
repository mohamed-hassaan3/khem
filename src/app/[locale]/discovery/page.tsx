import { BadgePercent, Clock, Package } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Reveal from "@/src/components/animation/Reveal";
import CategoryHero from "@/src/components/ecommerce/CategoryHero";
import DiscoveryComparison from "@/src/components/ecommerce/DiscoveryComparison";
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

const PATH = "/discovery";
const COLLECTION_SLUG = "discovery";

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
    title: dict.discovery.meta.title,
    description: dict.discovery.meta.description,
    ogTitle: dict.discovery.meta.ogTitle,
    ogDescription: dict.discovery.meta.ogDescription,
  });
}

/** Discovery sets — the way in. */
export default async function DiscoveryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, collection, sets] = await Promise.all([
    params,
    getCollectionBySlug(COLLECTION_SLUG),
    getProductCardsByKind("DISCOVERY"),
  ]);

  // The layout has already rejected any segment that is not a real locale.
  const activeLocale = isLocale(locale) ? locale : "en";
  const dict = await getDictionary(activeLocale);

  if (!collection) notFound();

  const steps = dict.discovery.promise.steps;

  return (
    <div className="min-h-screen bg-background text-ivory">
      <CategoryHero
        eyebrow={dict.discovery.eyebrow}
        titleLead={dict.discovery.titleLead}
        titleAccent={dict.discovery.titleAccent}
        description={dict.discovery.description}
        note={dict.discovery.note}
        imageUrl={collection.bannerUrl}
        imageAlt={collection.bannerAlt}
      />

      <section className="bg-background px-6 py-24 md:px-20 md:py-30">
        <div className="mx-auto max-w-350">
          {sets.length === 0 ? (
            <p className="py-24 text-center text-[13px] leading-loose text-ivory/35">
              {dict.discovery.empty}
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
        variant="steps"
        eyebrow={dict.discovery.promise.eyebrow}
        heading={dict.discovery.promise.heading}
        items={[
          { icon: Package, ...steps.choose },
          { icon: Clock, ...steps.discover },
          { icon: BadgePercent, ...steps.unlock },
        ]}
      />

      <DiscoveryComparison sets={sets} locale={activeLocale} />
    </div>
  );
}
