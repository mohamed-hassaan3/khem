"use client";

import { createContext, useContext, type ReactNode } from "react";

import { DEFAULT_DELIVERY_TERMS, type DeliveryTerms } from "@/src/lib/cart";

/**
 * The delivery terms in force, handed down from the server.
 *
 * ## Why a provider and not a fetch
 *
 * Four components price delivery — the cart page, the cart drawer, the checkout
 * review and the checkout view — and all four are client components with no
 * database of their own. Fetching the terms from each would render a wrong total
 * for a frame and then correct it, which on a total is not a flicker but a
 * misquote. Read once in `src/app/[locale]/layout.tsx`, the figures are in the
 * first paint.
 *
 * ## Why this one takes no cookie and no store
 *
 * Unlike `currency-provider.tsx`, nothing here is the visitor's choice. These
 * are the house's terms: the same for everyone, unchanged for the life of the
 * page, and therefore a plain context value rather than a subscribable store.
 *
 * ## The default is the same default
 *
 * A component rendered outside the provider gets {@link DEFAULT_DELIVERY_TERMS}
 * rather than a thrown error — the same fallback `src/services/delivery.ts`
 * returns when the row cannot be read, so the two failure paths quote one figure
 * instead of two.
 */

const DeliveryContext = createContext<DeliveryTerms>(DEFAULT_DELIVERY_TERMS);

export function DeliveryProvider({
  terms,
  children,
}: {
  terms: DeliveryTerms;
  children: ReactNode;
}) {
  /*
   * No `useMemo`: `terms` is a value the server serialised, so it is a new
   * object on every server render and a stable one across every client
   * re-render. Memoising it would guard against a change that cannot happen
   * without a navigation.
   */
  return (
    <DeliveryContext.Provider value={terms}>{children}</DeliveryContext.Provider>
  );
}

/** The fee and the free-delivery minimum, in piastres. */
export function useDeliveryTerms(): DeliveryTerms {
  return useContext(DeliveryContext);
}
