"use client";

import { Check, Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import QuantityStepper from "@/src/components/ecommerce/QuantityStepper";
import { quantityCeiling } from "@/src/lib/cart";
import { formatPrice, formatVolume } from "@/src/lib/format";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useCart } from "@/src/providers/cart-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import { useWishlist } from "@/src/providers/wishlist-provider";
import type { Product } from "@/src/types/catalog";

/**
 * The buy block on a product detail page.
 *
 * There is NO size selector: bottle format is a property of the collection
 * (Signature and Noir at 100 ML, Gemstone at 50 ML), so a fragrance has one
 * volume, one price, and one SKU — which is exactly what `Product` stores. The
 * format is stated beside the price rather than chosen.
 *
 * Cart and wishlist writes go to the `localStorage`-backed stores in
 * `src/providers/`, which persist a product id and a quantity — exactly what
 * `OrderItem` and `WishlistItem` hold (AGENTS.md §9). There is no cart service
 * and no Clerk session yet; when those land, the two handlers below become
 * Server Action calls (`addToCart`, `toggleWishlist`) and the markup is
 * unchanged.
 */

export type PurchasableProduct = Pick<
  Product,
  | "id"
  | "name"
  | "subtitle"
  | "concentration"
  | "volumeMl"
  | "priceInCents"
  | "inventory"
>;

export interface ProductPurchaseProps {
  product: PurchasableProduct;
  collectionName: string;
  locale: Locale;
}

const LOW_STOCK_THRESHOLD = 6;
const CONFIRMATION_MS = 2500;

export default function ProductPurchase({
  product,
  collectionName,
  locale,
}: ProductPurchaseProps) {
  const dict = useDictionary();
  const { addLine } = useCart();
  const wishlist = useWishlist();
  // Product name and subtitle come from `src/data` — English in both trees.
  const island = ltrIsland(locale);

  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Derived, not local: the store is the single source of truth, so the heart
   * is already filled when a visitor returns to a fragrance they saved — and it
   * stays in step with the same product's heart on `/collections`.
   *
   * `isHydrated` gates it because the server render cannot know what is saved;
   * showing an unfilled heart until the store is read matches that HTML.
   */
  const wishlisted = wishlist.isHydrated && wishlist.has(product.id);

  // Clearing on unmount, and before each restart, keeps a fast double-click
  // from leaving the button stuck in its confirmed state.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  const isSoldOut = product.inventory === 0;
  const maxQuantity = quantityCeiling(product.inventory);

  const handleAddToCart = () => {
    addLine(product.id, quantity, product.inventory);
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    setJustAdded(true);
    timeoutRef.current = setTimeout(() => setJustAdded(false), CONFIRMATION_MS);
  };

  const stockLabel = isSoldOut
    ? dict.product.soldOut
    : product.inventory < LOW_STOCK_THRESHOLD
      ? interpolate(dict.product.lowStock, { count: product.inventory })
      : dict.product.inStock;

  return (
    <section>
      <p className="eyebrow mb-4">
        {interpolate(dict.product.collectionLabel, { name: collectionName })}
      </p>

      <div {...island}>
        <h1 className="mb-3 font-heading text-4xl font-normal text-ivory sm:text-5xl lg:text-6xl">
          {product.name}
        </h1>
        {product.subtitle ? (
          <p className="text-[15px] italic tracking-wide text-gold/70">
            {product.subtitle}
          </p>
        ) : null}
      </div>

      <div className="gold-line my-9" />

      {/* Price and bottle format. The format is a spec, not a choice. */}
      <div className="mb-10 flex flex-wrap items-baseline gap-4">
        <span className="font-heading text-3xl text-gold">
          {formatPrice(product.priceInCents)}
        </span>
        <span className="text-xs tracking-[0.1em] text-ivory/35">
          {formatVolume(product.volumeMl)} ·{" "}
          {dict.product.concentrations[product.concentration]}
        </span>
      </div>

      <div className="mb-10">
        <p className="mb-4 text-[10px] uppercase tracking-[0.25em] text-ivory/40">
          {dict.product.quantity}
        </p>
        <QuantityStepper
          value={quantity}
          max={maxQuantity}
          onChange={setQuantity}
          decreaseLabel={dict.product.decreaseQuantity}
          increaseLabel={dict.product.increaseQuantity}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={isSoldOut}
          onClick={handleAddToCart}
          className="btn-luxury btn-luxury-fill flex-1 justify-center disabled:pointer-events-none disabled:opacity-40"
        >
          {isSoldOut ? (
            dict.product.soldOut
          ) : justAdded ? (
            <>
              <Check size={14} strokeWidth={1.25} aria-hidden="true" />
              {dict.product.added}
            </>
          ) : (
            dict.product.addToCart
          )}
        </button>

        <button
          type="button"
          aria-pressed={wishlisted}
          aria-label={interpolate(
            wishlisted ? dict.product.wishlistRemove : dict.product.wishlistAdd,
            { name: product.name },
          )}
          onClick={() => wishlist.toggle(product.id)}
          className={`grid size-13 shrink-0 place-items-center border transition-colors duration-300 ease-out hover:border-gold focus-visible:border-gold focus-visible:outline-none ${
            wishlisted ? "border-gold" : "border-white/12"
          }`}
        >
          <Heart
            size={16}
            strokeWidth={1.25}
            aria-hidden="true"
            className={wishlisted ? "fill-current text-gold" : "text-ivory/50"}
          />
        </button>
      </div>

      <p aria-live="polite" className="mt-4 text-[11px] text-ivory/35">
        {stockLabel}
      </p>

      <div className="mt-12 grid grid-cols-1 gap-6 border-t border-border pt-7 sm:grid-cols-3">
        {Object.values(dict.product.trust).map((badge) => (
          <div key={badge.title}>
            <p className="mb-1 font-heading text-[10px] tracking-[0.1em] text-gold">
              {badge.title}
            </p>
            <p className="text-[10px] leading-relaxed text-ivory/35">
              {badge.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
