import { ChevronRight } from "lucide-react";
import Image from "next/image";

import NavGround from "@/src/components/NavGround";

import CollectionGrid, {
  type CollectionGridItem,
} from "@/src/components/ecommerce/CollectionGrid";
import ProductCard from "@/src/components/ecommerce/ProductCard";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { facetVocabulary, productFacets } from "@/src/lib/facets";
import { getCategories } from "@/src/services/products";
import { unitPriceInCents } from "@/src/lib/pricing";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
import type { ProductCardData } from "@/src/types/catalog";
import type { MerchPage } from "@/src/types/catalog";

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
  /** Editable presentation for the `/collections` overview. */
  overviewPage?: MerchPage | null;
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
  overviewPage = null,
  products,
  countsEverything = false,
}: CollectionViewProps) {
  const dict = await getDictionary(locale);

  const isDark = collection !== null && DARK_COLLECTIONS.has(collection.slug);
  const heroImage = collection?.bannerUrl ?? overviewPage?.bannerUrl ?? ALL_HERO_IMAGE;
  const heroAlt = collection?.bannerAlt ?? overviewPage?.bannerAlt ?? "";
  const title = collection?.name ?? overviewPage?.name ?? dict.collections.all.name;
  const description =
    collection?.description ??
    overviewPage?.description ??
    dict.collections.all.description;

  const items: CollectionGridItem[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    // What the grid's price sort orders on. The promoted figure, so a bag that
    // says "low to high" agrees with the numbers printed on the cards.
    priceInCents: unitPriceInCents(product),
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

  /*
   * The chip row's vocabulary: the two merchandising cuts from the dictionary,
   * and the categories between them from the database — so a category created
   * in the dashboard becomes a chip with no code change, and one switched off
   * stops being offered everywhere at once.
   *
   * Read only for the overview, which is the one screen that prints chips.
   */
  const facets = facetVocabulary(
    isOverview ? await getCategories(locale) : [],
    dict.collections.facets,
  );

  /*
   * The one campaign labelling this page, if there is exactly one.
   *
   * Derived from the products already in hand rather than queried: the page has
   * their promotions attached, so counting them is free, and a line derived from
   * what is actually on screen cannot advertise a campaign whose products are
   * all out of stock and filtered away.
   */
  const labels = new Map<string, number>();

  for (const product of products) {
    const label = product.promotion?.label;
    if (!label) continue;
    labels.set(label, (labels.get(label) ?? 0) + 1);
  }

  const campaign =
    labels.size === 1
      ? (() => {
          const [[label, count]] = [...labels];
          return { label, count };
        })()
      : null;

  /*
   * The visitor is shopping, so the page is ivory — banner included. The hero
   * used to keep its own obsidian ground because its photograph was darkened
   * to make ivory type legible; now the photograph runs at its own luminance
   * and the type is charcoal, so the banner belongs to the page.
   */
  return (
    <div className="ground-ivory min-h-screen">
      {/*
        `hero`: the header floats transparently over the banner until the
        visitor scrolls past it.

        This is safe here only because the transparent state takes the *page's*
        ground rather than obsidian — the banner is light and its type is
        charcoal, so the header's links are charcoal too. An earlier version of
        this pass had the header keeping ivory links in that state, which
        painted an invisible header onto a pale limestone photograph.
      */}
      <NavGround ground="ivory" />
      {/* ── HERO ───────────────────────────────────── */}
      {/*
        ── COLLECTION BANNER ─── §14 ────────────────

        Charcoal type on the photograph, not ivory type on a darkened one.

        This is the shape §14 names for a collection banner: the imagery, and
        the collection's name set in the structural colour. It reads as an
        editorial cover rather than as the same dark strip every page used to
        open with, and it lets the photography carry its own light — which is
        the entire argument for having commissioned it.
      */}
      {/*
        Stage 2 (D6): 220px on a phone, so the first row of products is on the
        first screen; the original 60vh banner from `md` up. Breadcrumb, then
        the title with its count on one baseline, then two lines of intro
        (phone only; from `md` the grid's bar carries the full description).
      */}
      <section className="ground-ivory relative flex h-55 items-end overflow-hidden md:h-[60vh] md:min-h-105">
        <Image
          src={heroImage}
          alt={heroAlt}
          fill
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className={`object-cover ${isDark ? "brightness-105" : ""}`}
        />
        <div aria-hidden="true" className="banner-scrim banner-scrim-base" />
        <div className="relative z-1 w-full px-4 pb-4 md:px-20 md:pb-18">
          <div className="mx-auto max-w-350">
            <nav
              aria-label={dict.collections.home}
              className="mb-2 flex items-center gap-1.5 md:mb-8 md:gap-2"
            >
              <LocaleLink
                href="/"
                className="text-[11px] tracking-wide text-ground-muted no-underline transition-colors duration-300 ease-out hover:text-ground"
              >
                {dict.collections.home}
              </LocaleLink>
              <ChevronRight
                size={12}
                strokeWidth={1.25}
                aria-hidden="true"
                className="text-ground-muted rtl:rotate-180"
              />
              <span
                aria-current="page"
                className="text-[11px] tracking-wide text-ground"
                dir="auto"
              >
                {title}
              </span>
            </nav>

            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 md:flex-col-reverse md:items-start md:gap-4">
              <h1
                className="font-heading text-[30px] font-normal leading-tight text-ground sm:text-5xl md:text-7xl"
                dir="auto"
              >
                {title}
              </h1>
              <p className="eyebrow">
                {interpolate(
                  countsEverything
                    ? dict.collections.countLabelAll
                    : dict.collections.countLabel,
                  { count: products.length },
                )}
              </p>
            </div>

            <p
              dir="auto"
              className="mt-1.5 line-clamp-2 max-w-[330px] text-xs leading-normal text-ground-muted md:hidden"
            >
              {description}
            </p>

            {campaign ? (
              <p
                dir="auto"
                className="mt-2 inline-flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] tracking-[0.08em] text-ground-muted md:mt-6"
              >
                <span className="border border-ground-accent/40 px-2.5 py-1 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-accent">
                  {campaign.label}
                </span>
                <span>
                  {interpolate(
                    campaign.count === 1
                      ? dict.collections.campaignOne
                      : dict.collections.campaign,
                    { count: campaign.count },
                  )}
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <CollectionGrid
        items={items}
        showFacets={isOverview}
        facetOrder={facets.order}
        facetLabels={facets.labels}
        showSort
        description={
          /*
           * A collection's own description comes from the database, which has
           * carried Arabic columns since `0007_i18n_content.sql` — so `dir="auto"`
           * resolves direction from the text that actually rendered.
           */
          <p
            className="max-w-lg text-[13px] leading-loose text-ground-muted"
            dir="auto"
          >
            {description}
          </p>
        }
      />
    </div>
  );
}
