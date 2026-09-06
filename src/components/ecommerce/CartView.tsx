"use client";

import { ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { previewCartOffer } from "@/src/actions/offers";
import CartLine from "@/src/components/ecommerce/CartLine";
import CartSummary from "@/src/components/ecommerce/CartSummary";
import EmptyState from "@/src/components/ecommerce/EmptyState";
import NavGround from "@/src/components/NavGround";
import PageHeader from "@/src/components/ecommerce/PageHeader";
import { cartPricing } from "@/src/lib/pricing";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useCart } from "@/src/providers/cart-provider";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductCardData } from "@/src/types/catalog";
import type { OfferPreview } from "@/src/types/offer";

/**
 * The shopping bag — the one client island on `/cart`.
 *
 * The persisted cart holds ids and quantities only, so this component receives
 * the whole catalog projection from the server and resolves its lines against
 * it. Three consequences, all deliberate:
 *
 *  - prices, names, and images are always the live catalog values;
 *  - a stored id with no matching product (archived, deleted, or forged in
 *    devtools) silently drops out instead of rendering a ghost line;
 *  - nothing from `localStorage` is ever rendered as text.
 */

export interface CartViewProps {
  locale: Locale;
  /** Every sellable product, for id resolution. */
  catalog: readonly ProductCardData[];
}

export default function CartView({ locale, catalog }: CartViewProps) {
  const dict = useDictionary();
  const formatPrice = useFormatPrice();
  const { lines, isHydrated, setQuantity, removeLine } = useCart();

  const productsById = useMemo(
    () => new Map(catalog.map((product) => [product.id, product])),
    [catalog],
  );

  const resolved = useMemo(
    () =>
      lines.flatMap((line) => {
        const product = productsById.get(line.productId);
        return product ? [{ product, quantity: line.quantity }] : [];
      }),
    [lines, productsById],
  );

  /*
   * One breakdown for the whole screen: what the bag lists at, what campaigns
   * take off, and what that leaves. `<CartSummary>` prints all three; everything
   * that computes uses the third. `place_order()` sums the same rule from the
   * same view, so the figure here and the figure charged differ only in
   * freshness.
   */
  /*
   * What the house is giving away on this bag.
   *
   * Asked of the server rather than computed here, for `src/services/offers.ts`'s
   * reason: a TypeScript re-implementation of the group arithmetic would be a
   * second definition of what a customer is owed. The bag lives in the browser,
   * so an action is the only way to put the question to the rule that decides it.
   *
   * `cancelled` guards against a slower earlier request landing after a faster
   * later one and re-showing an offer the current bag no longer earns.
   */
  const [offer, setOffer] = useState<OfferPreview | null>(null);

  const offerSignature = resolved
    .map(({ product, quantity }) => `${product.id}:${quantity}`)
    .sort()
    .join(",");

  useEffect(() => {
    let cancelled = false;

    // The empty bag resolves through the same `.then` rather than clearing the
    // state outright: a synchronous `setState` in an effect body is the
    // cascading render `react-hooks/set-state-in-effect` warns about.
    const request =
      offerSignature === ""
        ? Promise.resolve(null)
        : previewCartOffer({
            items: offerSignature.split(",").map((entry) => {
              const [productId, quantity] = entry.split(":");
              return { productId, quantity: Number(quantity) };
            }),
            locale,
          });

    void request.then((result) => {
      if (!cancelled) setOffer(result);
    });

    return () => {
      cancelled = true;
    };
  }, [offerSignature, locale]);

  const pricing = cartPricing(resolved);
  const subtotal = pricing.subtotalInCents;

  const itemCount = resolved.reduce((sum, line) => sum + line.quantity, 0);

  /*
   * Before hydration the browser's cart is unknown — the server rendered this
   * page without it. Showing the empty state here would flash "your cart is
   * empty" at every returning visitor, so the page holds its height instead.
   */
  if (!isHydrated) {
    return (
      <div className="ground-ivory min-h-screen">
      <NavGround ground="ivory" />
        <PageHeader eyebrow={dict.cart.eyebrow} heading={dict.cart.heading} />
        <div className="min-h-[60vh]" aria-hidden="true" />
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className="ground-ivory min-h-screen">
      <NavGround ground="ivory" />
        <PageHeader eyebrow={dict.cart.eyebrow} heading={dict.cart.heading} />
        <EmptyState
          icon={ShoppingBag}
          heading={dict.cart.empty.heading}
          body={dict.cart.empty.body}
          cta={dict.cart.empty.cta}
          href="/collections"
        />
      </div>
    );
  }

  return (
    <div className="ground-ivory min-h-screen">
      <NavGround ground="ivory" />
      <PageHeader
        eyebrow={dict.cart.eyebrow}
        heading={dict.cart.heading}
        meta={
          itemCount === 1
            ? dict.cart.itemCountOne
            : interpolate(dict.cart.itemCount, { count: itemCount })
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px]">
        <section className="border-ground-border px-4 py-10 sm:px-8 lg:border-e lg:px-14 lg:py-14 xl:px-20">
          {resolved.map(({ product, quantity }) => (
            <CartLine
              key={product.id}
              product={product}
              quantity={quantity}
              locale={locale}
              onQuantityChange={(next) =>
                setQuantity(product.id, next, product.inventory)
              }
              onRemove={() => removeLine(product.id)}
            />
          ))}

          {/* One live region for the whole bag — a per-line one would announce
              every neighbouring total on each step. */}
          <p aria-live="polite" className="sr-only">
            {interpolate(dict.cart.updated, {
              count: itemCount,
              total: formatPrice(subtotal),
            })}
          </p>
        </section>

        <CartSummary pricing={pricing} offer={offer} />
      </div>
    </div>
  );
}
