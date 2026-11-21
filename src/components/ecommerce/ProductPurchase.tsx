"use client";

import { Check, FlaskConical, Gift, RotateCcw, Star, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import BuyNowButton from "@/src/components/ecommerce/BuyNowButton";
import QuantityStepper from "@/src/components/ecommerce/QuantityStepper";
import StickyPurchaseBar from "@/src/components/ecommerce/StickyPurchaseBar";
import ProductPrice from "@/src/components/ecommerce/ProductPrice";
import { quantityCeiling } from "@/src/lib/cart";
import { BASE_CURRENCY } from "@/src/lib/currency";
import {
  formatCount,
  formatProductType,
  formatRating,
  formatVolume,
  joinTokens,
} from "@/src/lib/format";
import { LOW_STOCK_THRESHOLD } from "@/src/lib/inventory";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useCart } from "@/src/providers/cart-provider";
import { useCurrency } from "@/src/providers/currency-provider";
import { useDeliveryTerms } from "@/src/providers/delivery-provider";
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
  | "promotion"
>;

export interface ProductPurchaseProps {
  product: PurchasableProduct;
  collectionName: string;
  locale: Locale;
  /**
   * The product's rating summary, for the link beside the eyebrow. Omitted or
   * zero-count renders nothing (the PDP reads it through the memoised
   * `getProductRatingSummary`, so it costs no second query).
   */
  rating?: { average: number; count: number };
}

const CONFIRMATION_MS = 2500;

export default function ProductPurchase({
  product,
  collectionName,
  locale,
  rating,
}: ProductPurchaseProps) {
  const dict = useDictionary();
  const { currency, formatPrice } = useCurrency();
  // The free-delivery minimum the trust badge promises, from the stored terms.
  const deliveryTerms = useDeliveryTerms();
  const { addLine } = useCart();
  // Product name and subtitle come from the database — English in both trees.
  const island = ltrIsland(locale);

  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** The controls row, watched so the sticky bar knows when it is needed. */
  const controlsRef = useRef<HTMLDivElement>(null);
  /*
   * The sticky bar shows once the buy controls have scrolled up out of view,
   * and steps aside again while the site footer is on screen, so it never
   * covers the footer's last lines. Two observed targets, one effect.
   */
  const [controlsGone, setControlsGone] = useState(false);
  const [footerInView, setFooterInView] = useState(false);
  const isBarVisible = controlsGone && !footerInView;

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const node = controlsRef.current;
    if (!node) return;
    const footer = document.querySelector("[data-site-footer]");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === node) {
            setControlsGone(
              !entry.isIntersecting && entry.boundingClientRect.top < 0,
            );
          } else {
            setFooterInView(entry.isIntersecting);
          }
        }
      },
      { threshold: 0 },
    );

    observer.observe(node);
    if (footer) observer.observe(footer);

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

  const stockTone = isSoldOut
    ? "bg-ground-muted/50"
    : product.inventory < LOW_STOCK_THRESHOLD
      ? "bg-warning"
      : "bg-success";

  const volumeLine = joinTokens(
    formatVolume(product.volumeMl),
    formatProductType(product, dict.product.concentrations),
  );

  const perks = [
    { key: "delivery", Icon: Truck, badge: dict.product.trust.delivery },
    { key: "packaging", Icon: Gift, badge: dict.product.trust.packaging },
    { key: "noBlindBuy", Icon: FlaskConical, badge: dict.product.trust.noBlindBuy },
    { key: "returns", Icon: RotateCcw, badge: dict.product.trust.returns },
  ] as const;

  const ratingText =
    rating && rating.count > 0
      ? `${formatRating(rating.average, locale)} (${formatCount(rating.count, locale)})`
      : null;

  return (
    <section>
      {/*
        Stage 2 (`prompts/storefront-redesign-stage-2.md` D7): everything a
        visitor needs to decide, in one screen on a phone. Eyebrow and rating
        share a row; no gold rule; price and the volume line share a baseline.
      */}
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow">
          {interpolate(dict.product.collectionLabel, { name: collectionName })}
        </p>
        {ratingText ? (
          <a
            href="#comments"
            className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-ground-muted no-underline transition-colors duration-300 hover:text-ground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground-accent"
            aria-label={interpolate(dict.product.ratingLink, {
              rating: formatRating(rating?.average ?? 0, locale),
              count: formatCount(rating?.count ?? 0, locale),
            })}
          >
            <Star
              size={12}
              strokeWidth={1.25}
              aria-hidden="true"
              className="fill-ground-accent text-ground-accent"
            />
            <span {...island}>{ratingText}</span>
          </a>
        ) : null}
      </div>

      <div {...island} className="mt-2 lg:mt-3">
        <h1 className="font-heading text-[30px] font-normal leading-[1.1] text-ground sm:text-4xl lg:text-[44px] lg:leading-[1.05] rtl:text-right">
          {product.name}
        </h1>
      </div>
      {product.subtitle ? (
        <p
          dir="auto"
          className="mt-1.5 text-sm italic tracking-wide text-ground-accent lg:mt-2 lg:text-base"
        >
          {product.subtitle}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 lg:mt-6">
        {/*
          No percentage badge here, unlike the grid: the two figures are
          already side by side, and a third element saying the same thing in
          smaller type is the marketplace treatment the brief rules out.
        */}
        <ProductPrice
          priceInCents={product.priceInCents}
          promotion={product.promotion}
          className="font-heading text-2xl text-ground-accent lg:text-[28px]"
        />
        {volumeLine ? (
          <span className="text-xs text-ground-muted lg:text-[13px]">
            {volumeLine}
          </span>
        ) : null}
      </div>

      {/*
        The offer, stated once and quietly — only when the campaign carries a
        label, so a promotion the house set without naming stays a price change.
      */}
      {product.promotion !== null ? (
        <p
          dir="auto"
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.08em] text-ground-muted"
        >
          {product.promotion.label ? (
            <span className="border border-ground-accent/30 px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.2em] text-ground-accent">
              {product.promotion.label}
            </span>
          ) : null}
          <span>
            {interpolate(dict.product.promotion.saving, {
              amount: formatPrice(
                product.promotion.listPriceInCents -
                  product.promotion.priceInCents,
              ),
              percent: String(product.promotion.percentOff),
            })}
          </span>
        </p>
      ) : null}

      {currency === BASE_CURRENCY ? null : (
        <p className="mt-2 text-[10px] tracking-[0.05em] text-ground-muted">
          {interpolate(dict.currencySwitcher.conversionNote, {
            currency: dict.currencySwitcher.names[currency],
          })}
        </p>
      )}

      {/*
        Quantity inline with Add to bag, Buy now full width beneath on a phone;
        one row of three from `lg`. The stepper's visible label became the
        group's accessible name: the − 1 + control explains itself.
      */}
      <div
        ref={controlsRef}
        className="mt-4 grid grid-cols-[auto_1fr] gap-2.5 lg:mt-6 lg:grid-cols-[auto_1fr_1fr]"
      >
        <QuantityStepper
          value={quantity}
          max={maxQuantity}
          onChange={setQuantity}
          decreaseLabel={dict.product.decreaseQuantity}
          increaseLabel={dict.product.increaseQuantity}
          groupLabel={dict.product.quantity}
          className="h-12 lg:h-[50px]"
        />
        {/*
          Buy now leads (filled) and Add to bag follows (outline): the house
          chose the direct path as the primary action. Same two controls,
          same behaviour, only the emphasis swapped.
        */}
        <BuyNowButton
          productId={product.id}
          quantity={quantity}
          inventory={product.inventory}
          locale={locale}
          variant="primary"
          className="h-12 rounded-md px-4 text-[11px] tracking-[0.2em] whitespace-nowrap lg:h-[50px]"
        />
        <button
          type="button"
          disabled={isSoldOut}
          onClick={handleAddToCart}
          className="btn btn-outline col-span-2 h-[46px] justify-center rounded-md px-4 text-[11px] tracking-[0.2em] whitespace-nowrap disabled:pointer-events-none disabled:opacity-40 lg:col-span-1 lg:h-[50px]"
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
      </div>

      <p
        aria-live="polite"
        className="mt-2.5 flex items-center gap-2 text-xs text-ground-muted lg:mt-3"
      >
        <span
          aria-hidden="true"
          className={`size-1.5 shrink-0 rounded-full ${stockTone}`}
        />
        {stockLabel}
      </p>

      {/*
        The four house promises as a 2×2 card with icons. `desc` carries
        `{amount}` on the delivery badge only; `interpolate` leaves the others
        exactly as it found them.
      */}
      <ul className="ground-stone mt-5 grid grid-cols-2 gap-x-3 gap-y-3.5 rounded-lg border border-ground-border bg-ground-bg p-3.5 lg:mt-6 lg:gap-3.5 lg:p-4">
        {perks.map(({ key, Icon, badge }) => (
          <li key={key} className="flex items-start gap-2.5">
            <Icon
              size={18}
              strokeWidth={1.25}
              aria-hidden="true"
              className="mt-px shrink-0 text-ground-accent"
            />
            <div className="min-w-0">
              <p className="text-xs leading-snug text-ground">{badge.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-ground-muted">
                {interpolate(badge.desc, {
                  amount: formatPrice(deliveryTerms.freeThresholdInCents),
                })}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <StickyPurchaseBar
        isVisible={isBarVisible}
        productId={product.id}
        quantity={quantity}
        name={product.name}
        priceInCents={product.priceInCents}
        promotion={product.promotion}
        volumeLine={formatVolume(product.volumeMl)}
        inventory={product.inventory}
        onAddToCart={handleAddToCart}
        justAdded={justAdded}
        locale={locale}
      />
    </section>
  );
}
