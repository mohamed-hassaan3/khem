import Image from "next/image";

import AddToBagButton from "@/src/components/ecommerce/AddToBagButton";
import ProductPrice from "@/src/components/ecommerce/ProductPrice";
import ProductFlag from "@/src/components/ecommerce/ProductFlag";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { productFlag } from "@/src/lib/facets";
import { formatVolume } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import MatchLine from "@/src/components/search/MatchLine";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { productHref } from "@/src/lib/routes";
import type { ProductCardData } from "@/src/types/catalog";

/**
 * Product card — Server Component.
 *
 * Takes the narrow `ProductCardData` projection rather than a full `Product`, so
 * the list query never has to over-select.
 *
 * Kind-agnostic since `/collections` began listing the whole catalog: the link
 * comes from `productHref()`, so a body oil in that grid opens `/ritual/…` and a
 * gift set its category page — where each can actually be bought — instead of a
 * `/perfume/…` URL that would 404.
 *
 * ## An article with a stretched link, not one big anchor
 *
 * This card used to *be* a `<LocaleLink>` wrapping everything. That is why the
 * bag control could not live in it — a `<button>` is not valid inside an `<a>`
 * — and why three grids plus the home page each wrapped the card in a
 * `relative` div to overlay `<AddToBagButton>` on top of it. `<RelatedProducts>`
 * did not, which is how a product in the related rail came to have no way of
 * being added to the bag.
 *
 * Now the card is an `<article>` and the link is an absolutely-positioned
 * overlay covering it (`z-1`). The bag sits above that overlay (`z-2`), so the
 * two are simply different regions of the card and never overlap. §36's "the
 * bag must not trigger card navigation" therefore holds *structurally* — there
 * is no event to stop, and no wrapper for a call site to forget.
 *
 * ## Equal height
 *
 * §8, and it is structural rather than a fixed pixel height: the card is a flex
 * column, the name clamps to one line, the subtitle to two, and `mt-auto`
 * pushes the price row to the bottom. A product with a long subtitle and one
 * with none produce identically-sized cards, and the price rows line up across
 * the grid — without capping the card at a height that would break the day
 * somebody adds a fourth line of copy.
 */

export interface ProductCardProps {
  product: ProductCardData;
  locale: Locale;
  /** Drives the `sizes` hint; the grid is 2 → 2 → 4 columns. */
  sizes?: string;
  /**
   * Search results only, and only in meaning-based mode: the notes this
   * product really contains that are closest to the query
   * (`search_match_notes()`, 0076). When present they take the note-pill slot
   * as a "Matches · …" line, so the card neither grows nor claims a reason it
   * lacks. Every other caller omits it and the card is unchanged.
   */
  matchNotes?: readonly string[];
}

/*
 * Matched to the grid the card is actually rendered into: 2 columns, then 3
 * from `md`, then 4 from `lg`, inside a container that caps at `max-w-350`
 * (1400px). The final entry is a fixed 350px because past 1400px the container
 * stops growing and a `vw` unit would keep over-fetching.
 *
 * The previous value claimed `25vw` at `lg` while every grid rendered three
 * columns, so each card was fetching an image roughly a third smaller than the
 * slot it filled. That is fixed here rather than in the grids, so the default
 * cannot drift from the layout again.
 */
const DEFAULT_SIZES =
  "(min-width: 1400px) 350px, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw";

export default async function ProductCard({
  product,
  locale,
  sizes = DEFAULT_SIZES,
  matchNotes,
}: ProductCardProps) {
  const dict = await getDictionary(locale);

  /*
   * One note per tier, top → heart → base. Pyramids are three deep in the data;
   * printing all nine would bury the card's name and price under pills. The
   * full pyramid is the product detail page's job.
   */
  /*
   * Stage 2 (`prompts/storefront-redesign-stage-2.md` D5): the notes as one
   * line of text, "Frankincense · Black oud · Amber", ellipsised. The chips
   * this replaces truncated to "Franki…" at two-up, which said less than the
   * line now does. Products without notes fall back to their format.
   */
  const notes = [
    product.topNotes[0],
    product.heartNotes[0],
    product.baseNotes[0],
  ].filter(Boolean);
  const notesLine =
    notes.length > 0 ? notes.join(" · ") : (product.format ?? null);

  const flag = productFlag(product);
  const isSoldOut = product.inventory === 0;
  const volume = formatVolume(product.volumeMl);

  return (
    <article className="img-zoom group relative flex h-full flex-col">
      <div
        className={`relative aspect-3/4 overflow-hidden rounded-md bg-[var(--card-bg)] ${
          isSoldOut ? "opacity-55 grayscale-[0.35]" : ""
        }`}
      >
        {/*
          One flag, in this order: sold out, the campaign's label, the house's
          own badge, then the derived facet. Inside the photograph's frame so it
          clips to the rounded corner.
        */}
        {isSoldOut ? (
          <ProductFlag label={dict.product.soldOut} locale={locale} tone="muted" />
        ) : product.promotion ? (
          <ProductFlag
            label={product.promotion.label ?? ""}
            detail={product.promotion.percentOff > 0 ? `−${product.promotion.percentOff}%` : undefined}
            locale={locale}
            tone="campaign"
          />
        ) : product.badge ? (
          <ProductFlag label={product.badge} locale={locale} island />
        ) : flag ? (
          <ProductFlag label={dict.collections.facets[flag]} locale={locale} />
        ) : null}

        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.alt}
          fill
          sizes={sizes}
          className={`object-cover transition-[opacity,transform] duration-700 ease-luxury-bezier motion-reduce:transition-none ${
            product.hoverImage ? "group-hover:opacity-0" : ""
          }`}
        />
        {product.hoverImage ? (
          <Image
            src={product.hoverImage.url}
            alt=""
            aria-hidden="true"
            fill
            sizes={sizes}
            className="object-cover opacity-0 transition-opacity duration-700 ease-luxury-bezier group-hover:opacity-100 motion-reduce:transition-none"
          />
        ) : null}

        {/* Above the stretched link (`z-1`), so it is its own target. */}
        <span className="absolute bottom-1 end-1 z-2">
          <AddToBagButton
            productId={product.id}
            name={product.name}
            inventory={product.inventory}
            variant="round"
          />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col pt-2.5">
        <p className="line-clamp-1 text-[9px] uppercase tracking-[0.12em] text-ground-accent sm:tracking-[0.2em]">
          {product.collectionName}
        </p>
        <h3
          {...ltrIsland(locale)}
          className="mt-1 line-clamp-1 font-heading text-sm font-normal tracking-[0.03em] text-ground sm:text-base"
        >
          {product.name}
        </h3>

        {matchNotes && matchNotes.length > 0 ? (
          <MatchLine
            label={dict.search.ai.matches}
            notes={matchNotes}
            className="mt-1 line-clamp-2"
          />
        ) : notesLine ? (
          <p
            dir="auto"
            className="mt-0.5 truncate text-[11px] text-ground-muted"
          >
            {notesLine}
          </p>
        ) : null}

        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-xs text-ground">
          <ProductPrice
            priceInCents={product.priceInCents}
            promotion={product.promotion}
            className="text-xs text-ground sm:text-[13px]"
          />
          {volume === null || product.promotion ? null : (
            <span className="text-ground-muted">· {volume}</span>
          )}
        </p>
        {/*
          On a reduced card the volume takes its own line: two prices and a
          volume do not fit a phone's half-width card, and wrapping left a
          stray "· 100 ML" under the figures.
        */}
        {volume !== null && product.promotion ? (
          <p className="mt-0.5 text-[11px] text-ground-muted">{volume}</p>
        ) : null}
      </div>

      {/*
        The whole card is the link; the bag button sits above it. A real
        `<a>`, so the card is one Tab stop and opens in a new tab as expected.
      */}
      <LocaleLink
        href={productHref(product)}
        aria-label={product.name}
        className="absolute inset-0 z-1 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      />
    </article>
  );
}
