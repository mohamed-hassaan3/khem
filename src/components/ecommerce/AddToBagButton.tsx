"use client";

import { ShoppingBag } from "lucide-react";

import { interpolate } from "@/src/lib/i18n/interpolate";
import { useCartDrawer } from "@/src/providers/cart-drawer-provider";
import { useCart } from "@/src/providers/cart-provider";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * The bag control on a product card — §9's replacement for the words "Add to
 * Cart".
 *
 * ## It no longer positions itself
 *
 * This used to be `absolute end-5 top-5`, and every surface that printed a card
 * had to wrap it in a `relative` div and overlay this on top — because
 * `<ProductCard>` was one big `<a>`, and a `<button>` cannot live inside an
 * anchor. Three grids and the home page each carried that wrapper, and
 * `<RelatedProducts>` carried none, which is why a product in the related rail
 * could not be added to the bag at all.
 *
 * The cards now use a stretched link instead (see `<ProductCard>`), so this is
 * a genuine sibling of the anchor and the card can simply place it. Position is
 * the card's business; this renders a button and nothing else.
 *
 * ## 44px
 *
 * Up from 36. The old size was below the touch-target floor, on the one control
 * in the catalogue that a phone user is most likely to aim at.
 *
 * Adding opens the cart panel: the confirmation *is* the panel, which is why
 * there is no transient "Added" state here.
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
     * The two guards stay even though the button is now a sibling of the card's
     * anchor rather than nested inside it. They cost nothing, and they are what
     * keeps "add to bag" from also navigating if a card is ever restructured to
     * wrap this slot again. Adding from a grid must never leave the grid.
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
      /*
       * Ground-relative: the chip is a veil over whatever the card sits on, so
       * it reads on an obsidian editorial grid and on an ivory shop grid
       * without the button being told which it is on. `bg-white/10` and
       * `bg-background/70` could only ever be right on one of them.
       */
      className={`group grid size-11 shrink-0 cursor-pointer place-items-center rounded-sm border border-ground-border bg-ground-bg/70 transition-colors duration-300 ease-out hover:border-gold focus-visible:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
        isSoldOut ? "pointer-events-none opacity-40" : ""
      }`}
    >
      <ShoppingBag
        size={16}
        strokeWidth={1.25}
        aria-hidden="true"
        className="text-ground-muted transition-colors duration-300 ease-out group-hover:text-ground-accent"
      />
    </button>
  );
}
