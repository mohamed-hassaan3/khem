"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Whether the cart panel is on screen.
 *
 * Deliberately *not* folded into `cart-provider.tsx`. That provider holds
 * persisted domain state — the lines a visitor will be charged for — and it
 * survives a reload by design. This one holds a boolean about the current
 * viewport that must not survive anything. Keeping them apart also keeps the
 * cart store free of React state entirely, which is what lets its mutators be
 * stable module functions.
 *
 * It exists as a provider rather than `useState` inside `<Nav>` because two
 * unrelated subtrees open the same panel: the bag button in the header, and
 * the add-to-bag control overlaid on every card in `<CollectionGrid>`.
 */

export interface CartDrawerContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const CartDrawerContext = createContext<CartDrawerContextValue | null>(null);

export function CartDrawerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [requested, setRequested] = useState(false);
  /** The path the panel was opened on. */
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const pathname = usePathname();

  /*
   * A navigation dismisses the panel: "View Bag" and every product link inside
   * it lead somewhere else, and a modal dialog still hanging over the page it
   * sent you to is a trap.
   *
   * Derived during render rather than reset from an effect — the pattern
   * `Nav.tsx` uses for its own drawer and mega menus. An effect that called
   * `setIsOpen(false)` on every path change would paint the panel over the new
   * page for one frame and then cascade a second render to take it away.
   */
  const isOpen = requested && openedOn === pathname;

  const open = useCallback(() => {
    setOpenedOn(pathname);
    setRequested(true);
  }, [pathname]);

  const close = useCallback(() => setRequested(false), []);

  const value = useMemo<CartDrawerContextValue>(
    () => ({ isOpen, open, close }),
    [isOpen, open, close],
  );

  return (
    <CartDrawerContext.Provider value={value}>
      {children}
    </CartDrawerContext.Provider>
  );
}

export function useCartDrawer(): CartDrawerContextValue {
  const context = useContext(CartDrawerContext);

  if (context === null) {
    throw new Error("useCartDrawer must be used within a <CartDrawerProvider>.");
  }

  return context;
}
