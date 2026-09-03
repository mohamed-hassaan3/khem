"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { buyNowPath, clampQuantity } from "@/src/lib/cart";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { useDictionary } from "@/src/providers/i18n-provider";

/**
 * Straight to checkout with this bottle, and this bottle only.
 *
 * ## The bag is not involved
 *
 * This used to call `addLine()` on the way past — "one cart, one source of
 * truth" — and that was wrong twice over. It made a bag that already held the
 * product hold two of it, because `addLine()` increments rather than replaces
 * (correctly: adding a fragrance you already have should not open a second line
 * for the same SKU). And it made the button mean "add this, then check out
 * everything", which is not what it says.
 *
 * Buy Now now means what it says. The item travels in the URL — see
 * `buyNowPath()` in `src/lib/cart.ts` for why a query parameter and not a second
 * client store — the bag is left exactly as it was, and a customer who abandons
 * the payment form still finds their bag holding what they put in it.
 *
 * ## One component, every entry point
 *
 * Every Buy Now on the site is this button: the buy block
 * (`<ProductPurchase>`) and the sticky bar (`<StickyPurchaseBar>`), which
 * between them serve `/perfume/[slug]`, `/set/[slug]` and `/ritual/[slug]`.
 * Product cards offer Add to Bag only. That is deliberate and worth keeping —
 * the behaviour cannot drift between surfaces if there is only one of it.
 *
 * No sign-in gate: `/checkout` supports guest checkout (see that route's
 * header), so this is exactly as available to a stranger as `/cart` is.
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
  const [isPending, startTransition] = useTransition();

  const isDisabled = disabled || inventory === 0 || isPending;

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-busy={isPending}
      onClick={() => {
        if (isDisabled) return;

        /*
         * Clamped here as well as at the checkout, because this is where the
         * number the customer chose meets the stock we know about. The URL is
         * not trusted either way — see `parseBuyNow()`.
         */
        const path = buyNowPath(productId, clampQuantity(quantity, inventory));

        // Inside a transition so the button can report itself busy while the
        // route streams in — a checkout page is the one navigation on this
        // site nobody should wonder whether they triggered.
        startTransition(() => {
          router.push(localizePath(locale, path));
        });
      }}
      className={`btn btn-outline justify-center disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      {dict.product.buyNow}
    </button>
  );
}
