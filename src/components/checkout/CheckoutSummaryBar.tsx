"use client";

import { ChevronDown, ShoppingBag } from "lucide-react";

import { interpolate } from "@/src/lib/i18n/interpolate";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * The phone checkout's first row: what is being bought and what it costs,
 * before any field (Stage 2, `prompts/storefront-redesign-stage-2.md` D10).
 *
 * A native `<details>`: collapsed it states the item count and the total;
 * open it lists the lines (`<OrderReview variant="lines">`, passed as
 * children). The total is the figure the review has always printed.
 */
export interface CheckoutSummaryBarProps {
  itemCount: number;
  /** Already formatted in the visitor's display currency. */
  total: string;
  className?: string;
  children: React.ReactNode;
}

export default function CheckoutSummaryBar({
  itemCount,
  total,
  className = "",
  children,
}: CheckoutSummaryBarProps) {
  const dict = useDictionary();
  const copy = dict.checkout.review;

  return (
    <details
      className={`group ground-stone border-b border-ground-border bg-ground-bg ${className}`}
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ground-accent [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-[13px] text-ground">
          <ShoppingBag size={16} strokeWidth={1.25} aria-hidden="true" />
          {copy.heading} ·{" "}
          {itemCount === 1
            ? copy.itemCountOne
            : interpolate(copy.itemCount, { count: itemCount })}
          <ChevronDown
            size={14}
            strokeWidth={1.4}
            aria-hidden="true"
            className="text-ground-muted transition-transform duration-500 ease-luxury-bezier group-open:rotate-180 motion-reduce:transition-none"
          />
        </span>
        <span dir="ltr" className="font-heading text-base tabular-nums text-ground-accent">
          {total}
        </span>
      </summary>
      <div className="khem-rise">{children}</div>
    </details>
  );
}
