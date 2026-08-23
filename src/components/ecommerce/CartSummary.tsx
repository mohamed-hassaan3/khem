"use client";

import { Check, Truck } from "lucide-react";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import {
  amountToFreeShippingInCents,
  cartTotalInCents,
  shippingInCents,
} from "@/src/lib/cart";
import { BASE_CURRENCY } from "@/src/lib/currency";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useCurrency } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * Order summary: totals, the free-delivery nudge, and the checkout CTAs.
 *
 * Every figure is derived here from `subtotalInCents` via `src/lib/cart.ts` —
 * the same module `src/actions/checkout.ts` prices the real order with, which is
 * what keeps the total quoted here and the total charged from ever disagreeing.
 *
 * No promo-code field: there is no `Discount` model and no endpoint behind it,
 * and a field that silently does nothing is worse than its absence
 * (AGENTS.md §1.4). It returns with the schema.
 */

export interface CartSummaryProps {
  subtotalInCents: number;
}

export default function CartSummary({ subtotalInCents }: CartSummaryProps) {
  const dict = useDictionary();
  const { currency, formatPrice } = useCurrency();

  const shipping = shippingInCents(subtotalInCents);
  const total = cartTotalInCents(subtotalInCents);
  const remaining = amountToFreeShippingInCents(subtotalInCents);

  return (
    <aside className="bg-surface px-4 py-12 sm:px-8 lg:sticky lg:top-20 lg:h-fit lg:px-10 lg:py-14">
      <h2 className="mb-9 font-heading text-lg font-normal tracking-[0.1em] text-ivory">
        {dict.cart.summary}
      </h2>

      <div className="mb-8 flex flex-col gap-4">
        <Row label={dict.cart.subtotal} value={formatPrice(subtotalInCents)} />

        <Row
          label={dict.cart.shipping}
          value={
            shipping === 0 ? (
              <span className="inline-flex items-center gap-1.5 text-gold">
                <Truck size={12} strokeWidth={1.25} aria-hidden="true" />
                {dict.cart.complimentary}
              </span>
            ) : (
              formatPrice(shipping)
            )
          }
        />

        {remaining > 0 ? (
          <p className="text-[11px] leading-relaxed text-gold/50">
            {interpolate(dict.cart.freeShippingNudge, {
              amount: formatPrice(remaining),
            })}
          </p>
        ) : null}
      </div>

      <div className="mb-9 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <span className="font-heading text-sm tracking-[0.1em] text-ivory">
            {dict.cart.total}
          </span>
          <span className="font-heading text-xl tabular-nums text-gold">
            {formatPrice(total)}
          </span>
        </div>
        <p className="mt-2 text-[10px] tracking-[0.05em] text-ivory/25">
          {dict.cart.taxNote}
        </p>

        {/*
         * The total above is a conversion; the card is charged in dollars. A
         * shop that shows one currency and bills another without saying so is
         * misleading, and this is the last screen before it happens.
         */}
        {currency !== BASE_CURRENCY ? (
          <p className="mt-1.5 text-[10px] tracking-[0.05em] text-ivory/25">
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
        className="btn-luxury btn-luxury-fill mb-6 w-full justify-center"
      >
        {dict.cart.checkout}
      </LocaleLink>

      <LocaleLink
        href="/collections"
        className="block text-center font-heading text-[11px] tracking-[0.15em] text-ivory/30 no-underline transition-colors duration-300 ease-out hover:text-ivory/60 focus-visible:text-gold focus-visible:outline-none"
      >
        {dict.cart.continueShopping}
      </LocaleLink>

      <ul className="mt-6 md:mt-10 flex flex-col gap-3 border-t border-border pt-8">
        {Object.values(dict.product.trust).map((badge) => (
          <li key={badge.title} className="flex items-center gap-2.5">
            <Check
              size={12}
              strokeWidth={1.25}
              aria-hidden="true"
              className="shrink-0 text-gold"
            />
            <span className="text-[11px] tracking-[0.04em] text-ivory/35">
              {badge.title} — {badge.desc}
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
      <span className="text-xs tracking-[0.08em] text-ivory/40">{label}</span>
      <span className="font-heading text-[13px] tabular-nums text-ivory">{value}</span>
    </div>
  );
}
