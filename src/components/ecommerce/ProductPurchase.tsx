"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import BuyNowButton from "@/src/components/ecommerce/BuyNowButton";
import QuantityStepper from "@/src/components/ecommerce/QuantityStepper";
import StickyPurchaseBar from "@/src/components/ecommerce/StickyPurchaseBar";
import { quantityCeiling } from "@/src/lib/cart";
import { BASE_CURRENCY } from "@/src/lib/currency";
import { formatProductType, formatVolume } from "@/src/lib/format";
import { LOW_STOCK_THRESHOLD } from "@/src/lib/inventory";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useCart } from "@/src/providers/cart-provider";
import { useCurrency } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { Product } from "@/src/types/catalog";

/**
 * The buy block on a product detail page.
 *
 * Two controls, side by side at every width: Add to Cart, and Buy Now — which
 * adds the same line and goes straight to `/checkout`. Once the pair scrolls
 * off the top, `<StickyPurchaseBar>` puts it back at the foot of the viewport,
 * driven by the observer below and carrying the quantity chosen here.
 *
 * There is NO size selector: bottle format is a property of the collection
 * (Signature and Noir at 100 ML, Gemstone at 50 ML), so a fragrance has one
 * volume, one price, and one SKU — which is exactly what `Product` stores. The
 * format is stated beside the price rather than chosen.
 *
 * Cart writes go to the `localStorage`-backed store in `src/providers/`, which
 * persists a product id and a quantity — exactly what an `OrderItem` holds
 * (AGENTS.md §9). There is no cart service yet; when one lands, the handler
 * below becomes a Server Action call (`addToCart`) and the markup is
 * unchanged.
 */

export type PurchasableProduct = Pick<
  Product,
  | "id"
  | "name"
  | "subtitle"
  | "concentration"
  | "format"
  | "volumeMl"
  | "priceInCents"
  | "inventory"
>;

export interface ProductPurchaseProps {
  product: PurchasableProduct;
  collectionName: string;
  locale: Locale;
}

const CONFIRMATION_MS = 2500;

export default function ProductPurchase({
  product,
  collectionName,
  locale,
}: ProductPurchaseProps) {
  const dict = useDictionary();
  const { currency, formatPrice } = useCurrency();
  const { addLine } = useCart();
  // Product name and subtitle come from the database — English in both trees.
  const island = ltrIsland(locale);

  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** The controls row, watched so the sticky bar knows when it is needed. */
  const controlsRef = useRef<HTMLDivElement>(null);
  const [isBarVisible, setIsBarVisible] = useState(false);

  // Clearing on unmount, and before each restart, keeps a fast double-click
  // from leaving the button stuck in its confirmed state.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  /*
   * The bar appears only when the real controls have been scrolled *past* —
   * `isIntersecting` alone would also raise it while the visitor is still above
   * the block, on the breadcrumb, where nothing has scrolled off anything.
   * `boundingClientRect.top < 0` is the half that says which side they left by.
   */
  useEffect(() => {
    const node = controlsRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsBarVisible(
          !entry.isIntersecting && entry.boundingClientRect.top < 0,
        );
      },
      { threshold: 0 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const isSoldOut = product.inventory === 0;
  const maxQuantity = quantityCeiling(product.inventory);

  const handleAddToCart = () => {
    addLine(product.id, quantity, product.inventory);
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    setJustAdded(true);
    timeoutRef.current = setTimeout(() => setJustAdded(false), CONFIRMATION_MS);
  };

  // The threshold lives in `src/lib/inventory.ts` so this line and the
  // dashboard's low-stock warning are answering the same question. It used to
  // be a local `6`, which meant the boutique was never told about the products
  // this page was already describing as nearly gone.
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
      <div className="mb-3 flex flex-wrap items-baseline gap-4">
        <span className="font-heading text-3xl tabular-nums text-gold">
          {formatPrice(product.priceInCents)}
        </span>
        <span className="text-xs tracking-[0.1em] text-ivory/35">
          {formatVolume(product.volumeMl)} ·{" "}
          {formatProductType(product, dict.product.concentrations)}
        </span>
      </div>

      {/*
       * A converted price says what the bottle costs, not what the card is
       * charged. The visitor is told which is which, here and in the bag.
       *
       * The paragraph is always in the document and only its text is
       * conditional, because the currency is not known until after hydration:
       * a line that appears at that moment would push the whole buy block down
       * and put a CLS penalty on the product page (AGENTS.md §12). Reserving
       * one line costs a few pixels of extra breathing room in USD.
       */}
      <p className="mb-7 min-h-3.5 text-[10px] tracking-[0.05em] text-ivory/25">
        {currency === BASE_CURRENCY
          ? null
          : interpolate(dict.currencySwitcher.conversionNote, {
              currency: dict.currencySwitcher.names[currency],
            })}
      </p>

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

      {/*
        Two equal columns at *every* breakpoint, phone included: these are the
        two ways to buy the same bottle, and stacking them on a narrow screen
        would make one of them look like an afterthought. Add to Cart keeps the
        filled treatment so the primary action still reads as primary.
      */}
      <div ref={controlsRef} className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={isSoldOut}
          onClick={handleAddToCart}
          className="btn-luxury btn-luxury-fill justify-center px-4 text-[10px] tracking-[0.15em] whitespace-nowrap disabled:pointer-events-none disabled:opacity-40 sm:px-8 sm:text-[11px] sm:tracking-[0.2em]"
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

        <BuyNowButton
          productId={product.id}
          quantity={quantity}
          inventory={product.inventory}
          locale={locale}
          className="px-4 text-[10px] tracking-[0.15em] whitespace-nowrap sm:px-8 sm:text-[11px] sm:tracking-[0.2em]"
        />
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

      <StickyPurchaseBar
        isVisible={isBarVisible}
        productId={product.id}
        name={product.name}
        priceInCents={product.priceInCents}
        inventory={product.inventory}
        quantity={quantity}
        onAddToCart={handleAddToCart}
        justAdded={justAdded}
        locale={locale}
      />
    </section>
  );
}
