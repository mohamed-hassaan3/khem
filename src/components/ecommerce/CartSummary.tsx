"use client";

import { FlaskConical, Gift, RotateCcw, Truck } from "lucide-react";

import { useSiteFooterInView } from "@/src/hooks/use-site-footer-in-view";

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
  /**
   * The offer the house is giving on this bag, as `resolve_offer()` priced it.
   *
   * Null is the ordinary answer, not a failure: most baskets earn none. The
   * label is the campaign's own customer-facing line, already resolved to the
   * reading language, so the row says "Choose 3, Pay for 2" rather than showing
   * an unexplained reduction.
   *
   * An estimate, like every other figure on this panel — `place_order()` prices
   * the offer again against the order it writes, and that is what is charged.
   */
  offer?: { label: string | null; amountInCents: number } | null;
}

export default function CartSummary({ pricing, offer = null }: CartSummaryProps) {
  const dict = useDictionary();
  const { currency, formatPrice } = useCurrency();
  // The house's terms, read once in the layout — see `delivery-provider.tsx`.
  const terms = useDeliveryTerms();
  const footerInView = useSiteFooterInView();

  /*
   * Delivery, the nudge and the total are all judged on what the merchandise
   * actually costs — the promoted subtotal — not on the list figure printed in
   * the first row. A threshold measured against list prices would promise
   * complimentary delivery on a bag that never reaches it at the till.
   */
  const shipping = shippingInCents(pricing.subtotalInCents, terms);
  const remaining = amountToFreeShippingInCents(pricing.subtotalInCents, terms);

  /*
   * The offer comes off the merchandise, never the courier — the rule every
   * benefit in this system follows — and is capped at the merchandise so the
   * total can never fall below the delivery fee.
   */
  const offerInCents = Math.min(
    offer?.amountInCents ?? 0,
    pricing.subtotalInCents,
  );
  const total = cartTotalInCents(pricing.subtotalInCents, terms) - offerInCents;

  return (
    <aside className="ground-sand px-4 pb-28 pt-8 transition-[top] duration-500 ease-luxury-bezier motion-reduce:transition-none sm:px-8 lg:sticky lg:top-[var(--chrome-h)] lg:h-fit lg:px-10 lg:py-14">
      <h2 className="mb-5 font-heading text-lg font-normal tracking-[0.1em] text-ground lg:mb-9">
        {dict.cart.summary}
      </h2>

      <div className="mb-5 flex flex-col gap-3 lg:mb-8 lg:gap-4">
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

        {offerInCents > 0 ? (
          <Row
            label={offer?.label ?? dict.cart.offer}
            value={
              <span className="text-ground-accent">
                −{formatPrice(offerInCents)}
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
          <p className="text-xs leading-relaxed text-ground-muted">
            {interpolate(dict.cart.freeShippingNudge, {
              amount: formatPrice(remaining),
            })}
          </p>
        ) : null}
      </div>

      <div className="mb-6 border-t border-ground-border pt-4 lg:mb-9 lg:pt-6">
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
        className="btn btn-primary mb-2 h-[50px] w-full justify-center rounded-md max-lg:hidden"
      >
        {dict.cart.checkout}
      </LocaleLink>

      <LocaleLink
        href="/collections"
        className="flex min-h-11 items-center justify-center text-[11px] uppercase tracking-[0.14em] text-ground-muted no-underline transition-colors duration-300 ease-out hover:text-ground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
      >
        {dict.cart.continueShopping}
      </LocaleLink>

      {/* The house's four promises, with the same icons as the product page. */}
      <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3.5 border-t border-ground-border pt-5 lg:mt-8 lg:pt-7">
        {(
          [
            { key: "delivery", Icon: Truck, badge: dict.product.trust.delivery },
            { key: "packaging", Icon: Gift, badge: dict.product.trust.packaging },
            { key: "noBlindBuy", Icon: FlaskConical, badge: dict.product.trust.noBlindBuy },
            { key: "returns", Icon: RotateCcw, badge: dict.product.trust.returns },
          ] as const
        ).map(({ key, Icon, badge }) => (
          <li key={key} className="flex items-start gap-2.5">
            <Icon size={17} strokeWidth={1.25} aria-hidden="true" className="mt-px shrink-0 text-ground-accent" />
            <span className="min-w-0">
              <span className="block text-xs leading-snug text-ground">{badge.title}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-ground-muted">
                {interpolate(badge.desc, {
                  amount: formatPrice(terms.freeThresholdInCents),
                })}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {/*
        Phone: the action rides at the bottom of the screen with the total,
        and steps aside while the footer is in view. From `lg` it is the
        in-flow button above.
      */}
      <div
        className={`ground-ivory fixed inset-x-0 bottom-0 z-40 border-t border-ground-border bg-ground-bg/97 px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-sm transition-transform duration-500 ease-luxury-bezier motion-reduce:transition-none lg:hidden ${
          footerInView ? "translate-y-full" : "translate-y-0"
        }`}
      >
        <LocaleLink
          href="/checkout"
          className="btn btn-primary h-13 w-full justify-center rounded-md"
        >
          {interpolate(dict.cart.drawer.checkoutTotal, {
            amount: formatPrice(total),
          })}
        </LocaleLink>
      </div>
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
