"use client";

import { Check, Truck } from "lucide-react";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import {
  amountToFreeShippingInCents,
  cartTotalInCents,
  shippingInCents,
} from "@/src/lib/cart";
import { formatPrice } from "@/src/lib/format";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * Order summary: totals, the free-delivery nudge, and the checkout CTAs.
 *
 * Every figure is derived here from `subtotalInCents` via `src/lib/cart.ts` —
 * the same module the checkout Server Action will price the real order with.
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

  const shipping = shippingInCents(subtotalInCents);
  const total = cartTotalInCents(subtotalInCents);
  const remaining = amountToFreeShippingInCents(subtotalInCents);

  return (
    <aside className="bg-surface px-6 py-12 sm:px-8 lg:sticky lg:top-20 lg:h-fit lg:px-10 lg:py-14">
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
          <span className="font-heading text-xl text-gold">
            {formatPrice(total)}
          </span>
        </div>
        <p className="mt-2 text-[10px] tracking-[0.05em] text-ivory/25">
          {dict.cart.taxNote}
        </p>
      </div>

      {/*
       * `/checkout` does not exist yet (AGENTS.md §8 has it planned). Sending
       * the primary conversion CTA to the 404 page would be worse than saying
       * plainly that it is not open — so the button is disabled and labelled.
       */}
      <button
        type="button"
        disabled
        className="btn-luxury btn-luxury-fill w-full cursor-not-allowed justify-center opacity-45"
      >
        {dict.cart.checkout}
      </button>
      <p className="mb-6 mt-3 text-center text-[10px] tracking-[0.05em] text-ivory/25">
        {dict.cart.checkoutSoon}
      </p>

      <LocaleLink
        href="/collections"
        className="block text-center font-heading text-[11px] tracking-[0.15em] text-ivory/30 no-underline transition-colors duration-300 ease-out hover:text-ivory/60 focus-visible:text-gold focus-visible:outline-none"
      >
        {dict.cart.continueShopping}
      </LocaleLink>

      <ul className="mt-10 flex flex-col gap-3 border-t border-border pt-8">
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
      <span className="font-heading text-[13px] text-ivory">{value}</span>
    </div>
  );
}
