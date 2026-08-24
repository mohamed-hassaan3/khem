import { ChevronRight } from "lucide-react";
import Image from "next/image";

import CollectionGrid, {
  type CollectionGridItem,
} from "@/src/components/ecommerce/CollectionGrid";
import ProductCard from "@/src/components/ecommerce/ProductCard";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { productFacets } from "@/src/lib/facets";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * The body shared by `/collections` and `/collections/[slug]` — Server
 * Component.
 *
 * Both routes render the same page: hero, breadcrumb, description, product
 * grid. The only difference is whether a collection is in scope, so the two
 * `page.tsx` files stay thin (params, metadata, data) and the composition lives
 * here.
 *
 * **Only the overview filters.** The chips and the sort control belong to
 * `/collections` alone: a chip row on a single-collection page is a filter whose
 * answer is the page you are already on, and the collection tab bar that used to
 * sit there was a second navigation surface duplicating the menu that is never
 * more than a click away. A collection page is a hero, a description and its
 * goods.
 *
 * Cards are rendered here, on the server, and handed to `<CollectionGrid>` as
 * nodes; only the sort state and the add-to-bag control are client-side.
 */

/**
 * What the hero needs, and no more.
 *
 * A `Collection` row satisfies this structurally, and so does a page assembled
 * in code — which is how `/collections/best-sellers` renders as a collection
 * page without being a `Collection` row it cannot be (see `MERCH_PAGE_FACETS`
 * in `src/lib/facets.ts`). Narrowing the prop is what saved a second page
 * component: nothing here ever read `kind`, `id` or the card crop.
 */
export interface CollectionHeader {
  slug: string;
  name: string;
  description: string;
  bannerUrl: string;
  bannerAlt: string;
}

export interface CollectionViewProps {
  locale: Locale;
  /** `null` renders the whole-catalogue overview. */
  collection: CollectionHeader | null;
  products: ProductCardData[];
  /**
   * Count the goods as "pieces" rather than as fragrances. True wherever the
   * listing crosses the fragrance boundary — the overview, and both
   * merchandising pages, which draw from body care and the sets as well.
   */
  countsEverything?: boolean;
}

/** Hero fallback for the overview, carried over from the original design. */
const ALL_HERO_IMAGE =
  "https://images.unsplash.com/photo-1738664926458-d8ca7f56549f?w=1800&h=900&fit=crop&auto=format";

/**
 * Noir is graded darker than the rest, matching `<CollectionCard tone>` on the
 * home page. Keyed by slug rather than branched inline so a new collection can
 * opt in without touching the JSX.
 */
const DARK_COLLECTIONS = new Set(["noir"]);

const CARD_SIZES = "(min-width: 1024px) 33vw, 50vw";

export default async function CollectionView({
  locale,
  collection,
  products,
  countsEverything = false,
}: CollectionViewProps) {
  const dict = await getDictionary(locale);

  const isDark = collection !== null && DARK_COLLECTIONS.has(collection.slug);
  const heroImage = collection?.bannerUrl ?? ALL_HERO_IMAGE;
  const heroAlt = collection?.bannerAlt ?? "";
  const title = collection?.name ?? dict.collections.all.name;
  const description = collection?.description ?? dict.collections.all.description;

  const items: CollectionGridItem[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    priceInCents: product.priceInCents,
    inventory: product.inventory,
    facets: productFacets(product),
    card: (
      <ProductCard product={product} locale={locale} sizes={CARD_SIZES} />
    ),
  }));

  /*
   * The chip row and the sort control both belong to the overview alone — see
   * the note at the top of this file. `<CollectionGrid>` drops the chips it
   * cannot fill, so a collection with nothing live in it takes its chip with it.
   */
  const isOverview = collection === null;

  return (
    <div className="min-h-screen bg-background text-ivory">
      {/* ── HERO ───────────────────────────────────── */}
      <section className="relative flex h-[60vh] min-h-105 items-end overflow-hidden">
        <Image
          src={heroImage}
          alt={heroAlt}
          fill
          priority
          quality={85}
          sizes="100vw"
          className={`object-cover saturate-60 ${
            isDark ? "brightness-30" : "brightness-45"
          }`}
        />
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />

        <div className="relative z-1 w-full px-4 pb-14 md:px-20 md:pb-18">
          <div className="mx-auto max-w-350">
            {/*
             * A literal "/" separator points the wrong way on the Arabic tree;
             * the chevron mirrors with `dir` instead.
             */}
            <nav
              aria-label={dict.collections.home}
              className="mb-8 flex items-center gap-2"
            >
              <LocaleLink
                href="/"
                className="text-[11px] tracking-wide text-ivory/35 no-underline transition-colors duration-300 ease-out hover:text-ivory/70"
              >
                {dict.collections.home}
              </LocaleLink>

              <ChevronRight
                size={12}
                strokeWidth={1.25}
                aria-hidden="true"
                className="text-ivory/20 rtl:rotate-180"
              />

              <span
                aria-current="page"
                className="text-[11px] tracking-wide text-gold/70"
                dir="auto"
              >
                {title}
              </span>
            </nav>

            <p className="eyebrow mb-4">
              {interpolate(
                /*
                 * "Pieces" wherever the listing crosses the fragrance boundary:
                 * it lists body oils and gift sets too, and calling those
                 * fragrances would be wrong in both languages.
                 */
                countsEverything
                  ? dict.collections.countLabelAll
                  : dict.collections.countLabel,
                { count: products.length },
              )}
            </p>

            <h1
              className="font-heading text-4xl font-normal text-ivory sm:text-6xl md:text-7xl"
              dir="auto"
            >
              {title}
            </h1>
          </div>
        </div>
      </section>

      {/* ── DESCRIPTION + SORT · FILTER · GRID ──────── */}
      <CollectionGrid
        items={items}
        showFacets={isOverview}
        facetLabels={dict.collections.facets}
        showSort={isOverview}
        description={
          /*
           * A collection's own description comes from the database, which has
           * carried Arabic columns since `0007_i18n_content.sql` — so `dir="auto"`
           * resolves direction from the text that actually rendered.
           */
          <p
            className="max-w-lg text-[13px] leading-loose text-ivory/40"
            dir="auto"
          >
            {description}
          </p>
        }
      />
    </div>
  );
}
