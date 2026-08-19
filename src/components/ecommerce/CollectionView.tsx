import { ChevronRight } from "lucide-react";
import Image from "next/image";

import CollectionGrid, {
  type CollectionGridItem,
  type CollectionOption,
} from "@/src/components/ecommerce/CollectionGrid";
import ProductCard from "@/src/components/ecommerce/ProductCard";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { productFacets } from "@/src/lib/facets";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type { Collection, ProductCardData } from "@/src/types/catalog";

/**
 * The body shared by `/collections` and `/collections/[slug]` — Server
 * Component.
 *
 * Both routes render the same page: hero, breadcrumb, description, one filter
 * row, product grid. The only difference is whether a collection is in scope, so
 * the two `page.tsx` files stay thin (params, metadata, data) and the
 * composition lives here.
 *
 * That one row differs in kind between them, and only in kind: the overview
 * filters the catalog in place with chips, a collection page navigates between
 * collections with links. Chips on a single-collection page would be a filter
 * with one possible value; links on the overview would make choosing a chapter a
 * page load, which is exactly what the in-place filter is for.
 *
 * Cards are rendered here, on the server, and handed to `<CollectionGrid>` as
 * nodes; only the sort state and the wishlist toggle are client-side.
 */

export interface CollectionViewProps {
  locale: Locale;
  /** `null` renders the whole-catalogue overview. */
  collection: Collection | null;
  products: ProductCardData[];
  /**
   * Every collection — drives the filter row, so an eighth needs no edit here.
   * The overview is passed all kinds; the single-collection route is passed the
   * fragrance collections its tab bar can address.
   */
  collections: Collection[];
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

const CARD_SIZES =
  "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";

export default async function CollectionView({
  locale,
  collection,
  products,
  collections,
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
    collectionSlug: product.collectionSlug,
    facets: productFacets(product),
    card: (
      <ProductCard product={product} locale={locale} sizes={CARD_SIZES} />
    ),
  }));

  /*
   * The chip row belongs to the overview alone — see the note at the top of this
   * file. `<CollectionGrid>` drops the chips it cannot fill, so a collection with
   * nothing live in it takes its chip with it.
   */
  const collectionOptions: CollectionOption[] | undefined =
    collection === null
      ? collections.map((entry) => ({ slug: entry.slug, label: entry.name }))
      : undefined;

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

        <div className="relative z-1 w-full px-6 pb-14 md:px-20 md:pb-18">
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
                 * The overview counts "pieces": it lists body oils and gift
                 * sets too, and calling those fragrances would be wrong in
                 * both languages.
                 */
                collection === null
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

      {/* ── DESCRIPTION + SORT · TABS · GRID ────────── */}
      <CollectionGrid
        items={items}
        collections={collectionOptions}
        facetLabels={dict.collections.facets}
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
        /*
         * Links, and only on the single-collection route: the overview gets the
         * chip row instead, and printing both would be the two-row bar this page
         * was cut down from.
         */
        tabs={
          collection === null ? undefined : (
            <div className="border-b border-border bg-background">
              <div className="mx-auto flex max-w-350 gap-10 overflow-x-auto px-6 md:px-20">
                <CollectionTab
                  href="/collections"
                  label={dict.collections.tabAll}
                  isActive={false}
                />

                {collections.map((entry) => (
                  <CollectionTab
                    key={entry.id}
                    href={`/collections/${entry.slug}`}
                    label={entry.name}
                    isActive={collection.slug === entry.slug}
                  />
                ))}
              </div>
            </div>
          )
        }
      />
    </div>
  );
}

/**
 * One tab in the collection bar. Styling mirrors `<JournalGrid>`'s tabs.
 *
 * `scroll={false}` is the point of this component. `<Link>` defaults to
 * scrolling to the top of the new Page element whenever that element's top edge
 * is outside the viewport — which it always is once the visitor has scrolled
 * past the hero into the grid. Switching collections therefore threw them back
 * to the top of the page, away from the tab bar they were using. Opting out
 * keeps the tab bar under the cursor, so the grid swaps beneath a stationary
 * viewport, the way a filter should behave.
 */
function CollectionTab({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <LocaleLink
      href={href}
      scroll={false}
      aria-current={isActive ? "page" : undefined}
      className={`whitespace-nowrap border-b-2 py-5 font-heading text-[11px] tracking-[0.2em] no-underline transition-colors duration-300 ease-out ${
        isActive
          ? "border-gold text-gold"
          : "border-transparent text-ivory/40 hover:text-ivory/70"
      }`}
      /*
       * Collection names are translated database columns, so direction is a
       * runtime fact about the row — see `src/lib/i18n/rtl.ts`.
       */
      dir="auto"
    >
      {label}
    </LocaleLink>
  );
}
