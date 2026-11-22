"use client";

import { amountToFreeShippingInCents } from "@/src/lib/cart";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDeliveryTerms } from "@/src/providers/delivery-provider";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * How close the bag is to complimentary delivery: one line and a 3px bar.
 *
 * Shared by the bag drawer and the `/cart` page (Stage 3), so both say the
 * same thing from the same stored terms. Judged on the promoted subtotal, as
 * `<CartSummary>` and the checkout judge delivery. Display only.
 */
export default function DeliveryProgress({
  subtotalInCents,
  className = "",
}: {
  subtotalInCents: number;
  className?: string;
}) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();
  const terms = useDeliveryTerms();

  const remaining = amountToFreeShippingInCents(subtotalInCents, terms);
  const progress =
    terms.freeThresholdInCents > 0
      ? Math.min(1, subtotalInCents / terms.freeThresholdInCents)
      : 1;

  return (
    <div className={`ground-stone bg-ground-bg ${className}`}>
      <p className="text-xs text-ground">
        {remaining > 0 ? (
          interpolate(dict.cart.freeShippingNudge, {
            amount: formatPrice(remaining),
          })
        ) : (
          <>
            {dict.cart.drawer.unlockedLead}{" "}
            <span className="text-ground-accent">
              {dict.cart.drawer.unlockedPerk}
            </span>
          </>
        )}
      </p>
      <div
        aria-hidden="true"
        className="mt-2 h-[3px] overflow-hidden rounded-full bg-ground-border"
      >
        <div
          className="h-full rounded-full bg-ground-accent transition-[width] duration-500 ease-luxury-bezier motion-reduce:transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
