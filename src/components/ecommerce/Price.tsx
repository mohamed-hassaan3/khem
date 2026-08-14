"use client";

import { useFormatPrice } from "@/src/providers/currency-provider";

/**
 * A price, in the visitor's display currency.
 *
 * What a Server Component renders instead of calling `formatPrice` itself. It
 * is a Client Component, so it server-renders the USD base into the static HTML
 * and re-formats on the first client render once the currency cookie has been
 * read — which is what lets a fully prerendered catalog carry a per-visitor
 * currency without any route going dynamic.
 *
 * `tabular-nums` is not decorative: it fixes the digit advance so the
 * post-hydration swap, and every quantity change in the bag, resize the price
 * without shifting what sits beside it.
 *
 * There is deliberately **no transition on the swap**. A price that fades or
 * slides reads as a price that is changing; this is the same price, said in
 * another currency. It changes instantly or it lies.
 */
export default function Price({
  cents,
  className = "",
}: {
  /** The stored USD amount, in cents. */
  cents: number;
  className?: string;
}) {
  const formatPrice = useFormatPrice();

  return (
    <span className={`tabular-nums ${className}`.trim()}>
      {formatPrice(cents)}
    </span>
  );
}
