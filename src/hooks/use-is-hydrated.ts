"use client";

import { useSyncExternalStore } from "react";

/** A store that never changes, so React never re-subscribes or re-reads. */
const subscribe = () => () => {};

/**
 * `false` during SSR and the hydration render, `true` from the first client
 * render after it.
 *
 * Surfaces that depend on browser-only state — the cart — must not
 * paint their "nothing here" answer until they have actually looked. The server
 * cannot know what a visitor saved, so a returning visitor would otherwise see
 * "your cart is empty" flash before their items appeared.
 *
 * Expressed through `useSyncExternalStore` rather than a mount effect: the two
 * snapshot functions say exactly what is meant — the server's answer is
 * `false`, the client's is `true` — with no cascading render in between.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
