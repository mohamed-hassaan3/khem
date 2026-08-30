"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { useCart } from "@/src/providers/cart-provider";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * Straight to checkout with this bottle.
 *
 * The line still goes through the bag — one cart, one source of truth, and a
 * visitor who changes their mind on the checkout page finds it there
 * afterwards. What "Buy Now" removes is the two clicks between the product and
 * the payment form, not the bag itself.
 *
 * No sign-in gate: `/checkout` supports guest checkout (see that route's
 * header), so this is exactly as available to a stranger as `/cart` is.
 *
 * Rendered twice on a product page — in the buy block and in
 * `<StickyPurchaseBar>` — which is why it owns the navigation rather than
 * either of them.
 */

export interface BuyNowButtonProps {
  productId: string;
  quantity: number;
  /** Stock. Caps the added quantity and disables the control at zero. */
  inventory: number;
  locale: Locale;
  disabled?: boolean;
  className?: string;
}

export default function BuyNowButton({
  productId,
  quantity,
  inventory,
  locale,
  disabled = false,
  className = "",
}: BuyNowButtonProps) {
  const dict = useDictionary();
  const router = useRouter();
  const { addLine } = useCart();
  const [isPending, startTransition] = useTransition();

  const isDisabled = disabled || inventory === 0 || isPending;

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-busy={isPending}
      onClick={() => {
        if (isDisabled) return;
        addLine(productId, quantity, inventory);
        // Inside a transition so the button can report itself busy while the
        // route streams in — a checkout page is the one navigation on this
        // site nobody should wonder whether they triggered.
        startTransition(() => {
          router.push(localizePath(locale, "/checkout"));
        });
      }}
      className={`btn btn-outline justify-center disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      {dict.product.buyNow}
    </button>
  );
}
