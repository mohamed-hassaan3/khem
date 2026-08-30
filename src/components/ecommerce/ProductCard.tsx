import Image from "next/image";

import AddToBagButton from "@/src/components/ecommerce/AddToBagButton";
import ProductPrice from "@/src/components/ecommerce/ProductPrice";
import ProductFlag from "@/src/components/ecommerce/ProductFlag";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { productFlag } from "@/src/lib/facets";
import { formatVolume } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { getDictionary } from "@/src/lib/i18n/get-dictionary";
import { interpolate } from "@/src/lib/i18n/interpolate";
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
}: ProductCardProps) {
  const dict = await getDictionary(locale);

  /*
   * One note per tier, top → heart → base. Pyramids are three deep in the data;
   * printing all nine would bury the card's name and price under pills. The
   * full pyramid is the product detail page's job.
   */
  const notes = [
    product.topNotes[0],
    product.heartNotes[0],
    product.baseNotes[0],
  ].filter(Boolean);

  /*
   * Non-fragrance goods have no pyramid, so the pill row would collapse to an
   * empty gap in the middle of the card. Their format line — "Room Spray",
   * "3 × 30 ML Flacons" — takes the same slot instead.
   */
  const pills = notes.length > 0 ? notes : product.format ? [product.format] : [];

  /*
   * Two pills and a count, on one line, always.
   *
   * The row used to wrap: three note pills in a 4-up column is two rows on most
   * widths, which added ~24px to every card carrying a full pyramid and none to
   * a card carrying a format line. That is a card growing because of its
   * *content*, which is exactly what §8 forbids — and it was the last place the
   * grid could still go ragged after the clamps went on the name and subtitle.
   *
   * The overflow becomes a `+N` rather than being dropped silently, so the card
   * says that there is more to the pyramid than it is showing. What that more
   * *is* belongs to the detail page, which prints all nine.
   */
  const shownPills = pills.slice(0, 2);
  const hiddenPillCount = pills.length - shownPills.length;

  /*
   * One badge, resolved in the same order on all three card types: the stored
   * free-text `badge` is a merchandiser's deliberate override and wins, then
   * the merchandising flag `productFlag()` resolves, so a card never has to.
   */
  const flag = productFlag(product);

  /*
   * A product that cannot be bought has no business leading with "Best Seller",
   * so this takes the corner slot from both the stored badge and the flag —
   * muted rather than gold, because it is a withdrawal and not a claim.
   */
  const isSoldOut = product.inventory === 0;

  return (
    <article className="card img-zoom group relative flex h-full flex-col overflow-hidden">
      {isSoldOut ? (
        <ProductFlag label={dict.product.soldOut} locale={locale} tone="muted" />
      ) : /*
           A running campaign outranks both the stored badge and the facet flag,
           and only when it carries a label: a promotion the house set without
           naming is a quiet price change, and inventing "SALE" for it would be
           the card saying something the merchandiser deliberately did not.
         */
      product.promotion?.label ? (
        <ProductFlag label={product.promotion.label} locale={locale} tone="campaign" />
      ) : product.badge ? (
        <ProductFlag label={product.badge} locale={locale} island />
      ) : flag ? (
        <ProductFlag label={dict.collections.facets[flag]} locale={locale} />
      ) : null}

      {/*
        Sold stock is dimmed and drained the way a museum dims a piece that is
        not currently on show. Only the image: the name, price, and pills below
        stay at full legibility, because the card is still a link worth reading.
      */}
      <div
        className={`relative aspect-4/5 overflow-hidden bg-[var(--card-bg)] ${
          isSoldOut ? "opacity-55 grayscale-[0.35]" : ""
        }`}
      >
        {/*
          The cross-fade. Both frames are `fill` inside one aspect-ratio box, so
          the swap is opacity alone — the card's height is fixed by the box and
          nothing in the grid can shift. Graded identically — ungraded, now — so
          the transition reads as one continuous image rather than the lights
          coming up. 700ms sits just inside the 800ms `img-zoom` scale both
          frames share, so the swap settles while the zoom is still running.
        */}
        <Image
          src={product.primaryImage.url}
          alt={product.primaryImage.alt}
          fill
          sizes={sizes}
          className={`object-cover transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            product.hoverImage ? "group-hover:opacity-0" : ""
          }`}
        />
        {product.hoverImage ? (
          /*
            `alt=""` and aria-hidden: this is the same product from a second
            angle, and a screen reader must not hear the flacon described twice.
          */
          <Image
            src={product.hoverImage.url}
            alt=""
            aria-hidden="true"
            fill
            sizes={sizes}
            className="object-cover opacity-0 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <p className="mb-1 line-clamp-1 text-[9px] uppercase tracking-[0.2em] text-ground-accent/70 sm:mb-1.5">
          {interpolate(dict.product.collectionLabel, {
            name: product.collectionName,
          })}
        </p>
        {/*
          The perfume name is a proper noun and stays Latin in both trees, so it
          keeps a real LTR island. Subtitle and notes are translated, and take
          `dir="auto"` instead: an untranslated row falls back to English, and
          only the rendered text can decide which way that runs.

          `line-clamp-1`: a two-line name is the most common way a card in this
          grid grew taller than the one beside it.
        */}
        <h3
          {...ltrIsland(locale)}
          className="mb-1 line-clamp-1 font-heading text-[13px] font-normal tracking-wide text-ground sm:text-base sm:tracking-wider"
        >
          {product.name}
        </h3>
        {product.subtitle ? (
          /*
            Hidden on the two-up mobile grid: in a ~170px column the subtitle
            wraps to three lines and pushes the price below the fold of the
            card. The name and price are what a phone browser is scanning for.
          */
          <p
            dir="auto"
            className="mb-2.5 hidden line-clamp-2 text-xs leading-relaxed tracking-wide text-ground-muted sm:block"
          >
            {product.subtitle}
          </p>
        ) : null}

        {/*
          `flex-nowrap` with the pills allowed to shrink: at the 4-up column
          width two full note names do not fit side by side, and the choice is
          between truncating one and letting the row become two. Truncating
          keeps every card in the grid the same height, which is the property
          being protected here.
        */}
        <div
          dir="auto"
          className="mb-2 flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden sm:mb-3"
        >
          {shownPills.map((note) => (
            <span
              key={note}
              className="min-w-0 truncate border border-ground-accent/20 px-2 py-0.5 text-[9px] tracking-widest text-ground-accent/80"
            >
              {note}
            </span>
          ))}
          {hiddenPillCount > 0 ? (
            /*
              `aria-hidden`: "+1" is a layout artefact, not information. A
              screen reader hears the two notes that are rendered and, on the
              detail page, the whole pyramid.
            */
            <span
              aria-hidden="true"
              className="shrink-0 border border-ground-accent/20 px-1.5 py-0.5 text-[9px] tracking-widest text-ground-accent/60"
            >
              +{hiddenPillCount}
            </span>
          ) : null}
        </div>

        {/*
          The spacer that bottom-aligns the price row across a grid of cards
          whose copy is different lengths. See the note on equal height above.
        */}
        <div className="mt-auto" />

        <div className="flex items-end justify-between gap-2 border-t border-ground-border pt-2.5">
          <div className="min-w-0">
            <ProductPrice
              priceInCents={product.priceInCents}
              promotion={product.promotion}
              showPercent
              className="font-heading text-[13px] text-ground sm:text-sm"
            />
            <p className="mt-1 text-[9px] uppercase tracking-[0.15em] text-ground-muted sm:text-[10px]">
              {formatVolume(product.volumeMl)}
            </p>
          </div>

          {/*
            Above the stretched link (`z-2` against its `z-1`), so this region of
            the card belongs to the button and the rest belongs to the anchor.
          */}
          <span className="relative z-2">
            <AddToBagButton
              productId={product.id}
              name={product.name}
              inventory={product.inventory}
            />
          </span>
        </div>
      </div>

      {/*
        The stretched link. Last in source order so it does not sit between the
        card's content and its own overlay, and labelled explicitly: without a
        name of its own an empty anchor covering a card is announced as a bare
        "link" with nothing to distinguish it from the fifteen others in the
        grid.
      */}
      <LocaleLink
        href={productHref(product)}
        aria-label={product.name}
        className="absolute inset-0 z-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      />
    </article>
  );
}
