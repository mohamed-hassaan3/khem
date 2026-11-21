"use client";

import { Check } from "lucide-react";

import ProductPrice from "@/src/components/ecommerce/ProductPrice";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductPromotion } from "@/src/types/marketing";

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
  name: string;
  priceInCents: number;
  promotion: ProductPromotion | null;
  /** `formatVolume()` output, or null for products not sold by volume. */
  volumeLine: string | null;
  inventory: number;
  onAddToCart: () => void;
  justAdded: boolean;
  locale: Locale;
}

/**
 * The buy bar that follows the visitor down a product page.
 *
 * Stage 2 (`prompts/storefront-redesign-stage-2.md` D7): a full-width bar on
 * the page's own ground, name and price at the start, one action at the end.
 * Buy now stays in the buy block; two buttons in a 390px bar crowded both.
 * Visibility is decided by `<ProductPurchase>` (controls scrolled away, footer
 * not on screen); the bar only animates in and out.
 */
export default function StickyPurchaseBar({
  isVisible,
  name,
  priceInCents,
  promotion,
  volumeLine,
  inventory,
  onAddToCart,
  justAdded,
  locale,
}: StickyPurchaseBarProps) {
  const dict = useDictionary();
  const isSoldOut = inventory === 0;

  return (
    <div
      aria-hidden={!isVisible}
      inert={!isVisible}
      aria-label={interpolate(dict.product.stickyBar, { name })}
      className={[
        "ground-ivory fixed inset-x-0 bottom-0 z-40 border-t border-ground-border bg-ground-bg/97 backdrop-blur-sm",
        "shadow-[0_-8px_20px_rgba(13,13,13,0.06)]",
        "pb-[max(0.625rem,env(safe-area-inset-bottom))]",
        "transition-[transform,opacity] duration-500 ease-luxury-bezier",
        "motion-reduce:transition-opacity motion-reduce:duration-300",
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0 motion-reduce:translate-y-0",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-3 pt-2.5 sm:gap-6 sm:px-6">
        <div className="min-w-0 flex-1" {...ltrIsland(locale)}>
          <p className="truncate font-heading text-[13px] tracking-wide text-ground rtl:text-right">
            {name}
          </p>
          <p className="mt-0.5 flex items-baseline gap-1.5 text-xs text-ground-accent rtl:justify-end">
            <ProductPrice
              priceInCents={priceInCents}
              promotion={promotion}
              className="text-xs text-ground-accent"
            />
            {volumeLine ? (
              <span className="text-ground-muted">· {volumeLine}</span>
            ) : null}
          </p>
        </div>

        <button
          type="button"
          disabled={isSoldOut}
          onClick={onAddToCart}
          className="btn btn-primary h-[46px] shrink-0 justify-center gap-2 rounded-md px-5 text-[11px] tracking-[0.2em] whitespace-nowrap disabled:pointer-events-none disabled:opacity-40 sm:px-8"
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
      </div>
    </div>
  );
}
