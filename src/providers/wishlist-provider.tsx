"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";

import { useIsHydrated } from "@/src/hooks/use-is-hydrated";
import { createPersistentStore } from "@/src/lib/persistent-store";
import {
  MAX_STORED_ENTRIES,
  WISHLIST_STORAGE_KEY,
  isProductId,
} from "@/src/lib/storage";

/**
 * Saved fragrances — browser state, persisted to `localStorage`.
 *
 * Stores product ids and nothing else, mirroring `WishlistItem` (AGENTS.md §9);
 * every displayed field is resolved from the catalog. See `cart-provider.tsx`
 * for the reasoning, which is identical.
 *
 * Order is insertion order, oldest first — the wishlist page reverses it so the
 * newest save appears at the top of the grid.
 */

export interface WishlistContextValue {
  ids: readonly string[];
  count: number;
  /** `false` until the browser store has been read — see `useIsHydrated`. */
  isHydrated: boolean;
  has: (productId: string) => boolean;
  toggle: (productId: string) => void;
  remove: (productId: string) => void;
}

function isStoredWishlist(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_STORED_ENTRIES &&
    value.every(isProductId)
  );
}

const EMPTY_WISHLIST: string[] = [];

const wishlistStore = createPersistentStore(
  WISHLIST_STORAGE_KEY,
  isStoredWishlist,
  EMPTY_WISHLIST,
);

// Stable by construction — see the note in `cart-provider.tsx`.

function remove(productId: string): void {
  wishlistStore.update((previous) => {
    const next = previous.filter((id) => id !== productId);
    return next.length === previous.length ? previous : next;
  });
}

function toggle(productId: string): void {
  wishlistStore.update((previous) => {
    if (previous.includes(productId)) {
      return previous.filter((id) => id !== productId);
    }

    if (previous.length >= MAX_STORED_ENTRIES) return previous;

    return [...previous, productId];
  });
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const ids = useSyncExternalStore(
    wishlistStore.subscribe,
    wishlistStore.getSnapshot,
    wishlistStore.getServerSnapshot,
  );
  const isHydrated = useIsHydrated();

  /*
   * A Set for membership: the heart on every card in a collection grid asks
   * this question once per card on every render.
   */
  const idSet = useMemo(() => new Set(ids), [ids]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      ids,
      count: ids.length,
      isHydrated,
      has: (productId: string) => idSet.has(productId),
      toggle,
      remove,
    }),
    [ids, idSet, isHydrated],
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);

  if (context === null) {
    throw new Error("useWishlist must be used within a <WishlistProvider>.");
  }

  return context;
}
