"use client";

import { Check } from "lucide-react";

import BuyNowButton from "@/src/components/ecommerce/BuyNowButton";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useCurrency } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * The buy controls, following the visitor down the page.
 *
 * A product page is long — story, pyramid, ingredients, a thread of comments —
 * and the only two controls that matter scroll off the top of it within a
 * screen. This puts them back, centred at the foot of the viewport, in a panel
 * narrow enough to read as an accessory to the page rather than a second one.
 *
 * ## Why it is always mounted
 *
 * Rendering it conditionally would skip the exit transition, so it stays in the
 * tree and goes `inert` when hidden — which also takes it out of the tab order
 * and the accessibility tree, as `<CartDrawer>` documents. It sits at `z-40`,
 * far below that drawer's `z-1051`, so opening the bag covers it rather than
 * fighting it.
 *
 * ## What it does not do
 *
 * No quantity stepper, no stock line, no thumbnail. Those belong to the block
 * upstairs; repeating them here would make a bar the height of a card. The
 * quantity it adds is whatever the block is showing, which is why that state
 * lives in `<ProductPurchase>` and is handed down.
 */

export interface StickyPurchaseBarProps {
  isVisible: boolean;
  productId: string;
  name: string;
  priceInCents: number;
  inventory: number;
  quantity: number;
  onAddToCart: () => void;
  /** Mirrors the buy block's transient confirmation, so both read the same. */
  justAdded: boolean;
  locale: Locale;
}

export default function StickyPurchaseBar({
  isVisible,
  productId,
  name,
  priceInCents,
  inventory,
  quantity,
  onAddToCart,
  justAdded,
  locale,
}: StickyPurchaseBarProps) {
  const dict = useDictionary();
  const { formatPrice } = useCurrency();

  const isSoldOut = inventory === 0;

  return (
    <div
      aria-hidden={!isVisible}
      inert={!isVisible}
      aria-label={interpolate(dict.product.stickyBar, { name })}
      className={[
        "fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
        // Sharp corners and a dark glass panel — §3.2. No spring, no bounce:
        // one translate and one fade on the luxury bezier.
        "transition-[transform,opacity] duration-500 ease-luxury-bezier",
        "motion-reduce:transition-opacity motion-reduce:duration-300",
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0 motion-reduce:translate-y-0",
      ].join(" ")}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-4 border border-border-gold/40 bg-[color-mix(in_srgb,var(--color-background)_88%,transparent)] px-4 py-3 shadow-luxury backdrop-blur-md sm:gap-6 sm:px-6">
        {/*
          The identity half. Hidden below `sm`, where the two controls need the
          whole width to sit side by side — the visitor is on that product's
          page and does not need to be told which one it is.
        */}
        <div className="hidden min-w-0 flex-1 sm:block" {...ltrIsland(locale)}>
          <p className="truncate font-heading text-[13px] tracking-wide text-ivory">
            {name}
          </p>
          <p className="mt-0.5 text-[12px] tabular-nums text-gold">
            {formatPrice(priceInCents)}
          </p>
        </div>

        {/* Below `sm` the price stands alone, ahead of the controls. */}
        <p className="text-[13px] tabular-nums text-gold sm:hidden">
          {formatPrice(priceInCents)}
        </p>

        {/* Side by side at every width, including the narrowest phone. */}
        <div className="flex flex-1 items-stretch gap-2 sm:flex-none sm:gap-3">
          <button
            type="button"
            disabled={isSoldOut}
            onClick={onAddToCart}
            className="btn-luxury btn-luxury-fill flex-1 justify-center gap-2 px-4 py-3 text-[10px] tracking-[0.15em] whitespace-nowrap disabled:pointer-events-none disabled:opacity-40 sm:flex-none sm:px-7"
          >
            {isSoldOut ? (
              dict.product.soldOut
            ) : justAdded ? (
              <>
                <Check size={13} strokeWidth={1.25} aria-hidden="true" />
                {dict.product.added}
              </>
            ) : (
              dict.product.addToCart
            )}
          </button>

          <BuyNowButton
            productId={productId}
            quantity={quantity}
            inventory={inventory}
            locale={locale}
            className="flex-1 px-4 py-3 text-[10px] tracking-[0.15em] whitespace-nowrap sm:flex-none sm:px-7"
          />
        </div>
      </div>
    </div>
  );
}
