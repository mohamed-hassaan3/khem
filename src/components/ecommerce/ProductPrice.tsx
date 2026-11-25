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
 * The percentage is optional and off by default — a soft gold-tinted tag, not an
 * outline. It earns its place in a grid, where a shopper is comparing, and not
 * on a detail page, where the two figures are already side by side. The product
 * card carries it on the photograph's campaign flag instead (`ProductFlag`'s
 * `detail`), where it is seen first; the set and merch cards keep it here.
 *
 * ## Layout stability
 *
 * The pair is a flex row with `tabular-nums` on both figures, for the reason
 * `Price.tsx` gives: the currency swap after hydration must resize the price
 * without moving what sits beside it. A promoted card is taller than an
 * unpromoted one by one line at most, and that difference is present in the
 * server HTML — it is not introduced after paint, so it cannot shift a grid.
 */
/** "EGP 1,470" → "1,470"; digits and their separators only, any script. */
function amountOnly(formatted: string): string {
  return formatted.replace(/[^\d.,\u0660-\u0669\u066B\u066C]/g, "");
}

export default function ProductPrice({
  priceInCents,
  promotion,
  className = "",
  showPercent = false,
  /** Stacks the two figures instead of running them inline. */
  stacked = false,
  /** One unbroken line with tighter spacing — the product card's price row. */
  inline = false,
}: {
  /** The list price, always — `"Product"."priceInCents"`. */
  priceInCents: number;
  promotion: ProductPromotion | null;
  className?: string;
  showPercent?: boolean;
  stacked?: boolean;
  inline?: boolean;
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
          : inline
            ? "inline-flex items-baseline gap-x-1 whitespace-nowrap sm:gap-x-1.5"
            : "flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
      }
    >
      {/*
        The price paid first, at full weight: it is the number the shopper is
        looking for, and the struck figure after it explains it. Reading order,
        not visual position, so the pair runs correctly right-to-left too.
      */}
      <span className={`tabular-nums ${className}`.trim()}>
        {formatPrice(promotion.priceInCents)}
      </span>

      {/*
        `line-through` on a muted ink rather than on the accent: the struck
        figure is history, and history is not the accent colour. A formatted
        price already reads the way the active locale reads.
      */}
      <span
        className={`${inline ? "text-[10px] sm:text-[11px]" : "text-[11px] sm:text-xs"} tabular-nums text-ground-muted line-through decoration-ground-muted/70 decoration-[0.5px]`}
        // Announced as what it is, so a screen reader does not read two prices
        // as a range.
        aria-label={`Was ${formatPrice(promotion.listPriceInCents)}`}
      >
        {/*
          Inline, the struck figure drops its currency: the sale price beside
          it already names it, and "EGP 1,176 1,470 · 100 ML" fits a phone's
          half-width card where the repeated "EGP" did not.
        */}
        {inline
          ? amountOnly(formatPrice(promotion.listPriceInCents))
          : formatPrice(promotion.listPriceInCents)}
      </span>

      {showPercent && promotion.percentOff > 0 ? (
        <span
          aria-hidden
          dir="ltr"
          className="self-center rounded-[3px] bg-gold/14 px-1.5 py-[2px] text-[9px] font-medium tabular-nums tracking-[0.06em] text-ground-accent sm:text-[10px]"
        >
          −{promotion.percentOff}%
        </span>
      ) : null}
    </span>
  );
}
