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

import OrderTotals from "@/src/components/checkout/OrderTotals";
import LocaleLink from "@/src/components/i18n/LocaleLink";
import { unitPriceInCents, type CartPricing } from "@/src/lib/pricing";
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
  /**
   * The bag's breakdown — list worth, campaign reduction, and what that leaves.
   *
   * The same `cartPricing()` result the bag page prints, so the two screens
   * cannot describe one bag two ways. Everything that computes — delivery, the
   * credit cap, the total — uses `pricing.subtotalInCents`; the list figure is
   * printed so the reductions beneath it have something to subtract from.
   */
  pricing: CartPricing;
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
  /**
   * What an offer takes off, and what the house is calling it.
   *
   * Also an estimate, and also one the client never computes: it is the figure
   * `resolve_offer()` returned for this exact bag. The label is the campaign's
   * own customer-facing line, already resolved to the reading language, so a
   * "Choose 3, Pay for 2" order says so on its own row rather than showing an
   * unexplained reduction.
   */
  offerInCents?: number;
  offerLabel?: string | null;
  /**
   * What redeemed KHEM Points take off. Zero when none are being spent.
   *
   * Priced by the same conversion `resolve_points_redemption()` applies, and
   * shown on its own row for the reason the three below it each get one: a
   * customer who loses a benefit needs to know which one it was.
   */
  pointsInCents?: number;
  /**
   * `aside`: the desktop sidebar (lines, totals). `lines`: the body of the
   * phone summary bar, which already states the total in its own row.
   */
  variant?: "aside" | "lines";
}

export default function OrderReview({
  lines,
  pricing,
  creditAppliedInCents = 0,
  discountInCents = 0,
  offerInCents = 0,
  offerLabel = null,
  pointsInCents = 0,
  variant = "aside",
}: OrderReviewProps) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();
  const copy = dict.checkout.review;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  const list = (
    <ul className="flex flex-col gap-3 lg:gap-5">
      {lines.map(({ product, quantity }) => (
        <li key={product.id} className="flex gap-3.5 lg:gap-4">
          <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-sm bg-ivory lg:h-20 lg:w-16">
            <Image
              src={product.primaryImage.url}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
            <span className="absolute end-0 top-0 flex h-5 min-w-5 items-center justify-center bg-ink px-1 text-[10px] tabular-nums text-ivory">
              {quantity}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <p dir="ltr" className="truncate font-heading text-[13px] tracking-[0.04em] text-ground">
              {product.name}
            </p>
            <p className="shrink-0 text-xs tabular-nums text-ground">
              {formatPrice(unitPriceInCents(product) * quantity)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );

  if (variant === "lines") {
    return (
      <div className="px-4 pb-4">
        {list}
        <LocaleLink
          href="/cart"
          className="mt-3 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.12em] text-ground-accent underline-offset-4 hover:underline"
        >
          {copy.edit}
        </LocaleLink>
      </div>
    );
  }

  return (
    <aside className="border-ground-border bg-stone px-4 py-10 transition-[top] duration-500 ease-luxury-bezier motion-reduce:transition-none sm:px-8 lg:sticky lg:top-[var(--chrome-h)] lg:h-fit lg:border-s lg:px-10 lg:py-14">
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <h2 className="font-heading text-lg font-normal tracking-[0.1em] text-ground">
          {copy.heading}
        </h2>
        {/* Back to the bag to change it: the review is a summary, not an editor. */}
        <LocaleLink
          href="/cart"
          className="text-[11px] tracking-[0.1em] text-ground-accent underline-offset-4 transition-colors duration-300 ease-out hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
        >
          {copy.edit}
        </LocaleLink>
      </div>

      <p className="mb-6 text-[11px] tracking-[0.08em] text-ground-muted">
        {itemCount === 1
          ? copy.itemCountOne
          : interpolate(copy.itemCount, { count: itemCount })}
      </p>

      <div className="mb-8 border-b border-ground-border pb-8">{list}</div>

      <OrderTotals
        pricing={pricing}
        creditAppliedInCents={creditAppliedInCents}
        discountInCents={discountInCents}
        offerInCents={offerInCents}
        offerLabel={offerLabel}
        pointsInCents={pointsInCents}
      />
    </aside>
  );
}
