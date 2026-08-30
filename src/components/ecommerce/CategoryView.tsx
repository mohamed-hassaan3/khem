import {
  BadgePercent,
  Clock,
  Droplet,
  Feather,
  Gem,
  Gift,
  Package,
  PackageCheck,
  Sparkles,
} from "lucide-react";

import NavGround from "@/src/components/NavGround";
import Reveal from "@/src/components/animation/Reveal";
import CategoryHero from "@/src/components/ecommerce/CategoryHero";
import DiscoveryComparison from "@/src/components/ecommerce/DiscoveryComparison";
import DiscoverySetCard from "@/src/components/ecommerce/DiscoverySetCard";
import FeatureTriptych from "@/src/components/ecommerce/FeatureTriptych";
import MerchGrid from "@/src/components/ecommerce/MerchGrid";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import type { Collection, ProductCardData } from "@/src/types/catalog";

/**
 * The non-fragrance half of `/collections/[slug]` — Server Component.
 *
 * Body care, home fragrance, discovery sets and gift sets each used to hold a
 * route of their own (`/body-care`, `/room-fragrance`, `/discovery`,
 * `/gift-set`). They are collections like any other, so they now live under
 * `/collections/[slug]` with the rest and those paths permanently redirect —
 * one URL per set of goods rather than two.
 *
 * What they are *not* is chapters of the perfume library, and that is why this
 * component exists beside `<CollectionView>` rather than inside it. A fragrance
 * collection is a grid of cards that lead to a detail page; these four sell from
 * the card itself and open on an editorial hero, so the page shapes genuinely
 * differ. Each section below is the component the old route already used, moved
 * rather than rewritten.
 *
 * The kind is what selects both the layout and the copy, so a collection whose
 * `kind` is set in the admin dashboard gets the right page with no edit here.
 */

export interface CategoryViewProps {
  locale: Locale;
  /** Never a `FRAGRANCE` collection — that branch renders `<CollectionView>`. */
  collection: Collection;
  products: ProductCardData[];
}

export default async function CategoryView({
  locale,
  collection,
  products,
}: CategoryViewProps) {
  const dict = await getDictionary(locale);

  switch (collection.kind) {
    /* Rituals for the skin. */
    case "BODY": {
      const copy = dict.bodyCare;
      const ritual = copy.ritual;

      return (
        <div className="ground-ivory min-h-screen">
      <NavGround ground="ivory" />
          <CategoryHero
            eyebrow={copy.eyebrow}
            titleLead={copy.titleLead}
            titleAccent={copy.titleAccent}
            description={copy.description}
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
            locale={locale}
            emptyLabel={copy.empty}
          />
        </div>
      );
    }

    /*
     * Scent for a room. The filter bar lives inside `<MerchGrid>` and derives
     * its tabs from the products present, so a candle or a diffuser added to the
     * catalog appears as a filter with no edit here.
     */
    case "HOME": {
      const copy = dict.homeFragrance;

      return (
        <div className="ground-ivory min-h-screen">
          <CategoryHero
            eyebrow={copy.eyebrow}
            titleLead={copy.titleLead}
            titleAccent={copy.titleAccent}
            description={copy.description}
            imageUrl={collection.bannerUrl}
            imageAlt={collection.bannerAlt}
          />

          <MerchGrid
            items={products}
            locale={locale}
            emptyLabel={copy.empty}
            showFilters
          />
        </div>
      );
    }

    /* The way in — sample vials, and the comparison table that ranks them. */
    case "DISCOVERY": {
      const copy = dict.discovery;
      const steps = copy.promise.steps;

      return (
        <div className="ground-ivory min-h-screen">
          <CategoryHero
            eyebrow={copy.eyebrow}
            titleLead={copy.titleLead}
            titleAccent={copy.titleAccent}
            description={copy.description}
            note={copy.note}
            imageUrl={collection.bannerUrl}
            imageAlt={collection.bannerAlt}
          />

          <SetGrid sets={products} locale={locale} emptyLabel={copy.empty} />

          <FeatureTriptych
            variant="steps"
            eyebrow={copy.promise.eyebrow}
            heading={copy.promise.heading}
            items={[
              { icon: Package, ...steps.choose },
              { icon: Clock, ...steps.discover },
              { icon: BadgePercent, ...steps.unlock },
            ]}
          />

          <DiscoveryComparison sets={products} locale={locale} />
        </div>
      );
    }

    /*
     * The house composed for giving. Structurally discovery's twin, and
     * deliberately so: both sell a boxed composition straight from the card, so
     * both use `<DiscoverySetCard>`, which prints the contents list and the
     * merchandising badge a single product card has nowhere to put. What
     * separates them is the goods — full-size flacons and ritual objects here,
     * sample vials there.
     */
    case "GIFT": {
      const copy = dict.giftSet;
      const ritual = copy.ritual;

      return (
        <div className="ground-ivory min-h-screen">
          <CategoryHero
            eyebrow={copy.eyebrow}
            titleLead={copy.titleLead}
            titleAccent={copy.titleAccent}
            description={copy.description}
            note={copy.note}
            imageUrl={collection.bannerUrl}
            imageAlt={collection.bannerAlt}
          />

          <SetGrid sets={products} locale={locale} emptyLabel={copy.empty} />

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

    /*
     * Exhaustive against `CollectionKind` minus `FRAGRANCE`: a sixth kind is a
     * compile error here rather than a blank page in production.
     */
    case "FRAGRANCE":
    default: {
      const unreachable: never = collection.kind as never;
      return unreachable;
    }
  }
}

/**
 * The boxed-set grid shared by discovery and gift sets.
 *
 * Both routes printed the same three-up grid of `<DiscoverySetCard>`s with the
 * same empty state; keeping one copy of it is what stopped the two drifting
 * apart when they were separate files, and it still is now that they are two
 * arms of one switch.
 */
function SetGrid({
  sets,
  locale,
  emptyLabel,
}: {
  sets: ProductCardData[];
  locale: Locale;
  emptyLabel: string;
}) {
  return (
    <section className="px-4 py-14 sm:px-6 md:px-10 lg:px-12 xl:px-16 md:py-30">
      <div className="mx-auto max-w-350">
        {sets.length === 0 ? (
          <p className="py-14 md:py-24 text-center text-[13px] leading-loose text-ground-muted">
            {emptyLabel}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
            {sets.map((set, index) => (
              <Reveal key={set.id} delay={(index % 4) * 0.1} className="h-full">
                <DiscoverySetCard product={set} locale={locale} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
