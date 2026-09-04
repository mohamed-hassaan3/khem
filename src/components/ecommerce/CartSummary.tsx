"use client";

import { Check, Truck } from "lucide-react";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import {
  amountToFreeShippingInCents,
  cartTotalInCents,
  shippingInCents,
} from "@/src/lib/cart";
import type { CartPricing } from "@/src/lib/pricing";
import { BASE_CURRENCY } from "@/src/lib/currency";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useCurrency } from "@/src/providers/currency-provider";
import { useDeliveryTerms } from "@/src/providers/delivery-provider";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * Order summary: totals, the free-delivery nudge, and the checkout CTAs.
 *
 * Every figure is derived here from `subtotalInCents` via `src/lib/cart.ts` —
 * the same module `src/actions/checkout.ts` prices the real order with, which is
 * what keeps the total quoted here and the total charged from ever disagreeing.
 *
 * No promo-code field: a code is validated by `resolve_discount()` against the
 * order being written, and the bag is not that order — the field lives one
 * screen later, in `<DiscountStep>`, where the answer can be a real one.
 *
 * ## Why "Subtotal" is the list price here
 *
 * When a campaign is running, this prints the bag at its **undiscounted** worth
 * and shows the reduction on its own line beneath. The alternative — a subtotal
 * already net of the campaign — is arithmetically identical and tells the
 * customer nothing: they see a total, not a saving. Everything that *computes*
 * still uses `pricing.subtotalInCents` (the delivery threshold, the total), so
 * the presentation changes and the money does not.
 */

export interface CartSummaryProps {
  /** The whole breakdown, from `cartPricing()` — never a bare number. */
  pricing: CartPricing;
}

export default function CartSummary({ pricing }: CartSummaryProps) {
  const dict = useDictionary();
  const { currency, formatPrice } = useCurrency();
  // The house's terms, read once in the layout — see `delivery-provider.tsx`.
  const terms = useDeliveryTerms();

  /*
   * Delivery, the nudge and the total are all judged on what the merchandise
   * actually costs — the promoted subtotal — not on the list figure printed in
   * the first row. A threshold measured against list prices would promise
   * complimentary delivery on a bag that never reaches it at the till.
   */
  const shipping = shippingInCents(pricing.subtotalInCents, terms);
  const total = cartTotalInCents(pricing.subtotalInCents, terms);
  const remaining = amountToFreeShippingInCents(pricing.subtotalInCents, terms);

  return (
    <aside className="ground-sand px-4 py-12 transition-[top] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:px-8 lg:sticky lg:top-[var(--chrome-h)] lg:h-fit lg:px-10 lg:py-14">
      <h2 className="mb-9 font-heading text-lg font-normal tracking-[0.1em] text-ground">
        {dict.cart.summary}
      </h2>

      <div className="mb-8 flex flex-col gap-4">
        <Row
          label={dict.cart.subtotal}
          value={formatPrice(pricing.listSubtotalInCents)}
        />

        {/*
          The campaign, as a negative line. Gold rather than the ivory of the
          rows around it: this is the one figure on the panel that is in the
          customer's favour, and the minus sign alone is easy to skim past.
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

        <Row
          label={dict.cart.shipping}
          value={
            shipping === 0 ? (
              <span className="inline-flex items-center gap-1.5 text-ground-accent">
                <Truck size={12} strokeWidth={1.25} aria-hidden="true" />
                {dict.cart.complimentary}
              </span>
            ) : (
              formatPrice(shipping)
            )
          }
        />

        {remaining > 0 ? (
          <p className="text-[11px] leading-relaxed text-ground-accent/50">
            {interpolate(dict.cart.freeShippingNudge, {
              amount: formatPrice(remaining),
            })}
          </p>
        ) : null}
      </div>

      <div className="mb-9 border-t border-ground-border pt-6">
        <div className="flex items-center justify-between">
          <span className="font-heading text-sm tracking-[0.1em] text-ground">
            {dict.cart.total}
          </span>
          <span className="font-heading text-xl tabular-nums text-ground-accent">
            {formatPrice(total)}
          </span>
        </div>
        <p className="mt-2 text-[10px] tracking-[0.05em] text-ground-muted/70">
          {dict.cart.taxNote}
        </p>

        {/*
         * The total above is a conversion; the card is charged in dollars. A
         * shop that shows one currency and bills another without saying so is
         * misleading, and this is the last screen before it happens.
         */}
        {currency !== BASE_CURRENCY ? (
          <p className="mt-1.5 text-[10px] tracking-[0.05em] text-ground-muted/70">
            {interpolate(dict.currencySwitcher.conversionNote, {
              currency: dict.currencySwitcher.names[currency],
            })}
          </p>
        ) : null}
      </div>

      {/*
       * The till is open. This was a disabled button labelled "secure checkout
       * opens shortly" until `/checkout` landed — the honest rendering of a
       * route that did not exist. `dict.cart.checkoutSoon` went with it.
       *
       * A link rather than a button: it navigates, it should be middle-clickable
       * and openable in a new tab, and it needs no JavaScript to work.
       */}
      <LocaleLink
        href="/checkout"
        className="btn btn-primary mb-6 w-full justify-center"
      >
        {dict.cart.checkout}
      </LocaleLink>

      <LocaleLink
        href="/collections"
        className="block text-center font-heading text-[11px] tracking-[0.15em] text-ground-muted/70 no-underline transition-colors duration-300 ease-out hover:text-ground-muted focus-visible:text-ground-accent focus-visible:outline-none"
      >
        {dict.cart.continueShopping}
      </LocaleLink>

      <ul className="mt-6 md:mt-10 flex flex-col gap-3 border-t border-ground-border pt-8">
        {Object.values(dict.product.trust).map((badge) => (
          <li key={badge.title} className="flex items-center gap-2.5">
            <Check
              size={12}
              strokeWidth={1.25}
              aria-hidden="true"
              className="shrink-0 text-ground-accent"
            />
            {/*
              `desc` carries `{amount}` on the delivery badge and nothing on the
              other three — `interpolate` leaves a string without the token
              exactly as it found it, so one call serves all four and no badge
              needs to know which one it is.
            */}
            <span className="text-[11px] tracking-[0.04em] text-ground-muted">
              {badge.title} —{" "}
              {interpolate(badge.desc, {
                amount: formatPrice(terms.freeThresholdInCents),
              })}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs tracking-[0.08em] text-ground-muted">{label}</span>
      <span className="font-heading text-[13px] tabular-nums text-ground">{value}</span>
    </div>
  );
}
