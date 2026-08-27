"use client";

/**
 * The sticky column: what is being bought, and what it comes to.
 *
 * Every figure is derived here from `src/lib/cart.ts` — the same module
 * `CartSummary` uses and, more importantly, the same module
 * `src/actions/checkout.ts` computes the delivery fee with on the server. That
 * is the promise the file opens with: "a total shown to a visitor and a total
 * charged to a card must come from one implementation."
 *
 * The prices *displayed* here may be converted (a visitor browsing in dollars
 * sees dollars, via `useFormatPrice`), while the order settles in Egyptian
 * pounds. `PaymentStep` states that in the sentence directly beneath.
 */

import Image from "next/image";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import { cartTotalInCents, shippingInCents } from "@/src/lib/cart";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductCardData } from "@/src/types/catalog";

export interface ReviewLine {
  product: ProductCardData;
  quantity: number;
}

export interface OrderReviewProps {
  lines: readonly ReviewLine[];
  subtotalInCents: number;
  /**
   * What a selected Discovery Credit would take off. Zero when none is chosen.
   *
   * An estimate computed with the same rule the server applies — the order row
   * is what the customer is actually charged. See `CreditStep`.
   */
  creditAppliedInCents?: number;
  /**
   * What an applied discount code would take off. Zero when none is applied.
   *
   * Also an estimate, and one the client never computes: it is the figure
   * `resolve_discount()` returned for this exact bag. The two are mutually
   * exclusive — `place_order()` refuses an order carrying both — so in practice
   * only one of these rows is ever non-zero.
   */
  discountInCents?: number;
}

export default function OrderReview({
  lines,
  subtotalInCents,
  creditAppliedInCents = 0,
  discountInCents = 0,
}: OrderReviewProps) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();
  const copy = dict.checkout.review;

  /*
   * Delivery is charged on the **undiscounted** subtotal, deliberately: the
   * free-delivery threshold in `src/lib/cart.ts` is a rule about what the
   * customer bought, and `place_order()` is handed this same fee computed the
   * same way. A discount that also bought free delivery would put two rules in
   * charge of one number — which is the reason `0028` gives for never
   * discounting delivery at all.
   */
  const shipping = shippingInCents(subtotalInCents);
  // Never below the delivery fee: neither instrument pays the courier.
  const total =
    cartTotalInCents(subtotalInCents) - discountInCents - creditAppliedInCents;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <aside className="border-border bg-surface px-4 py-10 sm:px-8 lg:sticky lg:top-20 lg:h-fit lg:border-s lg:px-10 lg:py-14">
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <h2 className="font-heading text-lg font-normal tracking-[0.1em] text-ivory">
          {copy.heading}
        </h2>

        {/* The one way back to the bag. Without it, correcting a quantity means
            using the browser's back button and hoping the form survives. */}
        <LocaleLink
          href="/cart"
          className="text-[11px] tracking-[0.1em] text-gold/60 underline-offset-4 transition-colors duration-300 ease-out hover:text-gold hover:underline focus-visible:text-gold focus-visible:outline-none"
        >
          {copy.edit}
        </LocaleLink>
      </div>

      <p className="mb-6 text-[11px] tracking-[0.08em] text-ivory/25">
        {itemCount === 1
          ? copy.itemCountOne
          : interpolate(copy.itemCount, { count: itemCount })}
      </p>

      <ul className="mb-8 flex flex-col gap-5 border-b border-border pb-8">
        {lines.map(({ product, quantity }) => (
          <li key={product.id} className="flex gap-4">
            <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-background">
              <Image
                src={product.primaryImage.url}
                alt=""
                fill
                sizes="64px"
                className="object-cover brightness-75"
              />

              {/*
               * The quantity badge sits on the image rather than in its own
               * column: it keeps the line to two columns at 360px, where a
               * third would wrap the price under the name.
               */}
              <span className="absolute end-0 top-0 flex h-5 min-w-5 items-center justify-center bg-gold px-1 font-heading text-[10px] tabular-nums text-background">
                {quantity}
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <p className="truncate font-heading text-[13px] tracking-[0.04em] text-ivory">
                {product.name}
              </p>
              <p className="text-[11px] tabular-nums text-ivory/35">
                {formatPrice(product.priceInCents * quantity)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-4">
        <Row label={copy.subtotal} value={formatPrice(subtotalInCents)} />
        {discountInCents > 0 ? (
          <Row
            label={copy.discount}
            value={
              <span className="text-gold">−{formatPrice(discountInCents)}</span>
            }
          />
        ) : null}
        <Row
          label={copy.delivery}
          value={
            shipping === 0 ? (
              <span className="text-gold">{copy.complimentary}</span>
            ) : (
              formatPrice(shipping)
            )
          }
        />
        {creditAppliedInCents > 0 ? (
          <Row
            label={dict.checkout.credit.applied}
            value={
              <span className="text-gold">
                −{formatPrice(creditAppliedInCents)}
              </span>
            }
          />
        ) : null}
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <span className="font-heading text-sm tracking-[0.1em] text-ivory">
            {copy.total}
          </span>
          <span className="font-heading text-xl tabular-nums text-gold">
            {formatPrice(total)}
          </span>
        </div>
        <p className="mt-2 text-[10px] tracking-[0.05em] text-ivory/25">
          {copy.taxNote}
        </p>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs tracking-[0.08em] text-ivory/40">{label}</span>
      <span className="font-heading text-[13px] tabular-nums text-ivory">
        {value}
      </span>
    </div>
  );
}
