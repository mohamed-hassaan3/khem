"use client";

import { ShoppingBag } from "lucide-react";

import { interpolate } from "@/src/lib/i18n/interpolate";
import { useCartDrawer } from "@/src/providers/cart-drawer-provider";
import { useCart } from "@/src/providers/cart-provider";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * The bag control overlaid on the corner of a product card.
 *
 * `<ProductCard>` is an async **Server** Component whose whole surface is a
 * link to the product, so it can neither hold this handler nor contain the
 * button. Every surface that prints those cards therefore overlays this one on
 * top of them inside a `relative` wrapper — `<CollectionGrid>` on
 * `/collections`, the Signature Fragrances grid on the home page. It lives here
 * rather than in either of them so the two cannot drift into two different
 * controls doing the same thing.
 *
 * Adding opens the cart panel: the confirmation *is* the panel, which is why
 * there is no transient "Added" state here the way `<MerchCard>` has one — that
 * card sells from a full-width button with nowhere else to report.
 */

export interface AddToBagButtonProps {
  productId: string;
  /** Interpolated into the accessible label — the button shows no text. */
  name: string;
  /** Stock. Caps the quantity and disables the control at zero. */
  inventory: number;
}

export default function AddToBagButton({
  productId,
  name,
  inventory,
}: AddToBagButtonProps) {
  const dict = useDictionary();
  const { addLine } = useCart();
  const { open } = useCartDrawer();

  const isSoldOut = inventory === 0;

  return (
    /*
     * Logical inset (`end-5`), so the control mirrors to the top-left of the
     * card on the Arabic tree.
     *
     * It overlays a card whose whole surface is a link to the product. The
     * button is a *sibling* of that anchor rather than a child, so a click here
     * does not navigate — and the two guards keep it that way if a card is ever
     * restructured to wrap this slot. Adding to the bag from a grid must never
     * also leave the grid.
     */
    <button
      type="button"
      disabled={isSoldOut}
      aria-label={interpolate(
        isSoldOut ? dict.collections.soldOut : dict.collections.addToBag,
        { name },
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isSoldOut) return;
        addLine(productId, 1, inventory);
        open();
      }}
      className={`group absolute end-5 top-5 z-2 grid size-9 cursor-pointer place-items-center border border-white/10 bg-background/70 backdrop-blur-sm transition-colors duration-300 ease-out hover:border-gold focus-visible:border-gold focus-visible:outline-none ${
        isSoldOut ? "pointer-events-none opacity-40" : ""
      }`}
    >
      <ShoppingBag
        size={14}
        strokeWidth={1.25}
        aria-hidden="true"
        className="text-ivory/50 transition-colors duration-300 ease-out group-hover:text-gold"
      />
    </button>
  );
}
