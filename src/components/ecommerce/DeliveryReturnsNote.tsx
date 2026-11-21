"use client";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useCurrency } from "@/src/providers/currency-provider";
import { useDeliveryTerms } from "@/src/providers/delivery-provider";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * The body of the product page's "Delivery & returns" row.
 *
 * The house's own delivery and returns promises, restated where the visitor
 * looks for them, plus the way to the full policy. Client-side only because
 * the free-delivery minimum is a stored row (`useDeliveryTerms()`) printed in
 * the visitor's display currency (`useCurrency()`), the same two sources the
 * perks card above reads, so the two can never disagree.
 */
export default function DeliveryReturnsNote() {
  const dict = useDictionary();
  const terms = useDeliveryTerms();
  const { formatPrice } = useCurrency();
  const { delivery, returns } = dict.product.trust;

  return (
    <div className="space-y-3 text-sm leading-relaxed text-ground-muted">
      <p>
        <span className="text-ground">{delivery.title}.</span>{" "}
        {interpolate(delivery.desc, {
          amount: formatPrice(terms.freeThresholdInCents),
        })}
        .
      </p>
      <p>
        <span className="text-ground">{returns.title}.</span> {returns.desc}.
      </p>
      <LocaleLink
        href="/return-exchange"
        className="inline-block text-[11px] uppercase tracking-[0.14em] text-ground-accent underline-offset-4 hover:underline"
      >
        {dict.product.deliveryReturnsLink}
      </LocaleLink>
    </div>
  );
}
