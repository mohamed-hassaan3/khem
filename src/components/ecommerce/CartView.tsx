"use client";

import { ShoppingBag } from "lucide-react";
import { useMemo } from "react";

import CartLine from "@/src/components/ecommerce/CartLine";
import CartSummary from "@/src/components/ecommerce/CartSummary";
import EmptyState from "@/src/components/ecommerce/EmptyState";
import PageHeader from "@/src/components/ecommerce/PageHeader";
import { cartSubtotalInCents } from "@/src/lib/cart";
import type { Locale } from "@/src/lib/i18n/config";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { useCart } from "@/src/providers/cart-provider";
import { useFormatPrice } from "@/src/providers/currency-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { ProductCardData } from "@/src/types/catalog";

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

  const subtotal = cartSubtotalInCents(
    resolved.map(({ product, quantity }) => ({
      priceInCents: product.priceInCents,
      quantity,
    })),
  );

  const itemCount = resolved.reduce((sum, line) => sum + line.quantity, 0);

  /*
   * Before hydration the browser's cart is unknown — the server rendered this
   * page without it. Showing the empty state here would flash "your cart is
   * empty" at every returning visitor, so the page holds its height instead.
   */
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background pt-20 text-ivory">
        <PageHeader eyebrow={dict.cart.eyebrow} heading={dict.cart.heading} />
        <div className="min-h-[60vh]" aria-hidden="true" />
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className="min-h-screen bg-background pt-20 text-ivory">
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
    <div className="min-h-screen bg-background pt-20 text-ivory">
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
        <section className="border-border px-4 py-10 sm:px-8 lg:border-e lg:px-14 lg:py-14 xl:px-20">
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

        <CartSummary subtotalInCents={subtotal} />
      </div>
    </div>
  );
}
