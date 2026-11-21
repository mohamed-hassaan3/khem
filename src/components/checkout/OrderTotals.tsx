"use client";

import { cartTotalInCents, shippingInCents, type DeliveryTerms } from "@/src/lib/cart";
import type { CartPricing } from "@/src/lib/pricing";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDeliveryTerms } from "@/src/providers/delivery-provider";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * The checkout's totals rows, in one place.
 *
 * Extracted from `<OrderReview>` (Stage 2, `prompts/storefront-redesign-stage-2.md`
 * D10) so the desktop sidebar, the phone summary bar and the phone totals card
 * print the same figure from the same arithmetic. Nothing here prices anything:
 * it is the display the review always showed, and the server reprices the order
 * it writes.
 */
export interface OrderAdjustments {
  creditAppliedInCents?: number;
  discountInCents?: number;
  offerInCents?: number;
  offerLabel?: string | null;
  pointsInCents?: number;
}

/** The review's total: never below the delivery fee, as it always was. */
export function reviewTotalInCents(
  pricing: CartPricing,
  terms: DeliveryTerms,
  {
    creditAppliedInCents = 0,
    discountInCents = 0,
    offerInCents = 0,
    pointsInCents = 0,
  }: OrderAdjustments,
): number {
  const subtotalInCents = pricing.subtotalInCents;
  const shipping = shippingInCents(subtotalInCents, terms);
  return Math.max(
    shipping,
    cartTotalInCents(subtotalInCents, terms) -
      offerInCents -
      discountInCents -
      pointsInCents -
      creditAppliedInCents,
  );
}

export default function OrderTotals({
  pricing,
  creditAppliedInCents = 0,
  discountInCents = 0,
  offerInCents = 0,
  offerLabel = null,
  pointsInCents = 0,
}: OrderAdjustments & { pricing: CartPricing }) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();
  const terms = useDeliveryTerms();
  const copy = dict.checkout.review;

  const shipping = shippingInCents(pricing.subtotalInCents, terms);
  const total = reviewTotalInCents(pricing, terms, {
    creditAppliedInCents,
    discountInCents,
    offerInCents,
    pointsInCents,
  });

  return (
    <div>
      <div className="flex flex-col gap-2 lg:gap-4">
        <Row
          label={copy.subtotal}
          value={formatPrice(pricing.listSubtotalInCents)}
        />

        {/*
          Five reductions can apply to one order and each gets its own line: the
          campaign that repriced the goods, an offer the house is running, a code
          the customer entered, KHEM Points they chose to spend, and a Discovery
          Credit. Collapsing them into one "Discount" row would hide which is
          doing the work — and they are governed by different rules, so a
          customer who loses one needs to know which.

          In practice most orders show at most one: `place_order()` refuses the
          combinations the house has not explicitly permitted.
        */}
        {pricing.promotionSavingsInCents > 0 ? (
          <Row
            label={dict.cart.promotion}
            value={
              <span className="text-ground-accent">
                −{formatPrice(pricing.promotionSavingsInCents)}
              </span>
            }
          />
        ) : null}

        {offerInCents > 0 ? (
          <Row
            label={offerLabel ?? copy.offer}
            value={
              <span className="text-ground-accent">−{formatPrice(offerInCents)}</span>
            }
          />
        ) : null}

        {discountInCents > 0 ? (
          <Row
            label={copy.discount}
            value={
              <span className="text-ground-accent">−{formatPrice(discountInCents)}</span>
            }
          />
        ) : null}
        <Row
          label={copy.delivery}
          value={
            shipping === 0 ? (
              <span className="text-ground-accent">{copy.complimentary}</span>
            ) : (
              formatPrice(shipping)
            )
          }
        />
        {pointsInCents > 0 ? (
          <Row
            label={dict.checkout.points.applied}
            value={
              <span className="text-ground-accent">−{formatPrice(pointsInCents)}</span>
            }
          />
        ) : null}
        {creditAppliedInCents > 0 ? (
          <Row
            label={dict.checkout.credit.applied}
            value={
              <span className="text-ground-accent">
                −{formatPrice(creditAppliedInCents)}
              </span>
            }
          />
        ) : null}
      </div>

      <div className="mt-3 border-t border-ground-border pt-3 lg:mt-6 lg:pt-6">
        <div className="flex items-center justify-between">
          <span className="font-heading text-sm tracking-[0.1em] text-ground">
            {copy.total}
          </span>
          <span className="font-heading text-xl tabular-nums text-ground-accent">
            {formatPrice(total)}
          </span>
        </div>
        <p className="mt-2 text-[10px] tracking-[0.05em] text-ground-muted/70">
          {copy.taxNote}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs tracking-[0.08em] text-ground-muted">{label}</span>
      <span className="font-heading text-[13px] tabular-nums text-ground">
        {value}
      </span>
    </div>
  );
}
