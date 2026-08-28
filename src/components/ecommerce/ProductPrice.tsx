"use client";

import { useFormatPrice } from "@/src/providers/currency-provider";
import type { ProductPromotion } from "@/src/types/marketing";

/**
 * A price that may be under a campaign — the storefront's only sale treatment.
 *
 * ## The restraint is the design
 *
 * A luxury house does not shout a reduction. What this renders is the previous
 * price, set small and struck through a *hairline* rather than a slash, and the
 * new price in the same gold the card always used. No red, no burst, no "SALE"
 * lozenge: the only thing that changes is that there are now two numbers, and
 * the eye reads the second one. That is exactly how a boutique writes a price
 * card by hand, and it is the difference between a house making an offer and a
 * marketplace clearing stock.
 *
 * The percentage is optional and off by default. It earns its place in a grid,
 * where a shopper is comparing, and not on a detail page, where the two figures
 * are already side by side and a badge would be the third thing saying the same.
 *
 * ## Layout stability
 *
 * The pair is a flex row with `tabular-nums` on both figures, for the reason
 * `Price.tsx` gives: the currency swap after hydration must resize the price
 * without moving what sits beside it. A promoted card is taller than an
 * unpromoted one by one line at most, and that difference is present in the
 * server HTML — it is not introduced after paint, so it cannot shift a grid.
 */
export default function ProductPrice({
  priceInCents,
  promotion,
  className = "",
  showPercent = false,
  /** Stacks the two figures instead of running them inline. */
  stacked = false,
}: {
  /** The list price, always — `"Product"."priceInCents"`. */
  priceInCents: number;
  promotion: ProductPromotion | null;
  className?: string;
  showPercent?: boolean;
  stacked?: boolean;
}) {
  const formatPrice = useFormatPrice();

  if (promotion === null) {
    return (
      <span className={`tabular-nums ${className}`.trim()}>
        {formatPrice(priceInCents)}
      </span>
    );
  }

  return (
    <span
      className={
        stacked
          ? "flex flex-col items-start gap-0.5"
          : "flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
      }
    >
      {/*
        `line-through` on a muted ivory rather than on the gold: the struck
        figure is history, and history is not the accent colour. `dir="ltr"` is
        not needed — a formatted price is a number with a currency, and the
        provider already writes it the way the active locale reads.
      */}
      <span
        className="text-[10px] tabular-nums text-ivory/35 line-through decoration-ivory/30 decoration-[0.5px] sm:text-[11px]"
        // Announced as what it is, so a screen reader does not read two prices
        // as a range.
        aria-label={`Was ${formatPrice(promotion.listPriceInCents)}`}
      >
        {formatPrice(promotion.listPriceInCents)}
      </span>

      <span className={`tabular-nums ${className}`.trim()}>
        {formatPrice(promotion.priceInCents)}
      </span>

      {showPercent && promotion.percentOff > 0 ? (
        <span
          aria-hidden
          className="border border-gold/30 px-1.5 py-px font-heading text-[8px] uppercase tracking-[0.15em] text-gold/70 sm:text-[9px]"
        >
          −{promotion.percentOff}%
        </span>
      ) : null}
    </span>
  );
}
