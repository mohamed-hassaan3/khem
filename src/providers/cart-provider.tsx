"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";

import { useIsHydrated } from "@/src/hooks/use-is-hydrated";
import { MAX_QUANTITY_PER_LINE, quantityCeiling } from "@/src/lib/cart";
import { createPersistentStore } from "@/src/lib/persistent-store";
import {
  CART_STORAGE_KEY,
  MAX_STORED_ENTRIES,
  isPositiveInteger,
  isProductId,
} from "@/src/lib/storage";

/**
 * The shopping bag — browser state, persisted to `localStorage`.
 *
 * Lines carry **identity only**: a product id and a quantity, which is exactly
 * what an `OrderItem` row holds (AGENTS.md §9). Names, prices, images, and
 * volumes are never stored — every surface resolves its ids against the catalog
 * projection its page fetched from `src/services/products.ts`, so a price edit
 * moves the total on the next render with nothing to re-sync and no stale money
 * anywhere in the browser.
 *
 * When Clerk and Supabase land, each mutator below becomes a Server Action call
 * (`addToCart`, `updateCartLine`, `removeCartLine`) and no consumer changes.
 */

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface CartContextValue {
  lines: readonly CartLine[];
  /** Total units across all lines — what the Nav badge shows. */
  count: number;
  /**
   * `false` until the browser store has been read. Consumers must not render an
   * empty state or a count while it is false; see `useIsHydrated`.
   */
  isHydrated: boolean;
  addLine: (productId: string, quantity?: number, maxQuantity?: number) => void;
  setQuantity: (
    productId: string,
    quantity: number,
    maxQuantity?: number,
  ) => void;
  removeLine: (productId: string) => void;
  clear: () => void;
}

/** Type guard for the persisted blob — see `src/lib/storage.ts`. */
function isStoredCart(value: unknown): value is CartLine[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_STORED_ENTRIES &&
    value.every(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        isProductId((entry as CartLine).productId) &&
        isPositiveInteger((entry as CartLine).quantity) &&
        (entry as CartLine).quantity <= MAX_QUANTITY_PER_LINE,
    )
  );
}

const EMPTY_CART: CartLine[] = [];

const cartStore = createPersistentStore(
  CART_STORAGE_KEY,
  isStoredCart,
  EMPTY_CART,
);

/*
 * The mutators live outside the component: they close over the module store,
 * not over render state, so they are stable by construction and need neither
 * `useCallback` nor a dependency list.
 */

function removeLine(productId: string): void {
  cartStore.update((previous) => {
    const next = previous.filter((line) => line.productId !== productId);
    return next.length === previous.length ? previous : next;
  });
}

function addLine(
  productId: string,
  quantity = 1,
  maxQuantity = MAX_QUANTITY_PER_LINE,
): void {
  const ceiling = quantityCeiling(maxQuantity);
  const requested = Math.max(1, Math.trunc(quantity));

  cartStore.update((previous) => {
    const existing = previous.find((line) => line.productId === productId);

    // A fragrance already in the bag increments rather than opening a second
    // line for the same SKU.
    if (existing) {
      return previous.map((line) =>
        line.productId === productId
          ? { ...line, quantity: Math.min(line.quantity + requested, ceiling) }
          : line,
      );
    }

    if (previous.length >= MAX_STORED_ENTRIES) return previous;

    return [...previous, { productId, quantity: Math.min(requested, ceiling) }];
  });
}

function setQuantity(
  productId: string,
  quantity: number,
  maxQuantity = MAX_QUANTITY_PER_LINE,
): void {
  const next = Math.trunc(quantity);

  // Stepping below one is how a line is removed from the cart page.
  if (next < 1) {
    removeLine(productId);
    return;
  }

  const ceiling = quantityCeiling(maxQuantity);

  cartStore.update((previous) =>
    previous.map((line) =>
      line.productId === productId
        ? { ...line, quantity: Math.min(next, ceiling) }
        : line,
    ),
  );
}

function clear(): void {
  cartStore.update((previous) => (previous.length === 0 ? previous : []));
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const lines = useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    cartStore.getServerSnapshot,
  );
  const isHydrated = useIsHydrated();

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      isHydrated,
      addLine,
      setQuantity,
      removeLine,
      clear,
    }),
    [lines, isHydrated],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (context === null) {
    throw new Error("useCart must be used within a <CartProvider>.");
  }

  return context;
}
