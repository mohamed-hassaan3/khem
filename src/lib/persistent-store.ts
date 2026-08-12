/**
 * A `localStorage`-backed external store, in the shape `useSyncExternalStore`
 * expects.
 *
 * Reading storage inside an effect and calling `setState` with the result works
 * but is the pattern React now warns against: it is a cascading render, and it
 * describes the browser's storage as React state rather than as what it is — an
 * external system React subscribes to. Modelling it as a store instead gives
 * the correct hydration behaviour for free: `getServerSnapshot` returns the
 * empty value, so the server HTML and the first client render agree, and React
 * swaps in the stored value once hydration is done.
 *
 * The snapshot is cached and only ever replaced, never mutated — `getSnapshot`
 * runs on every render and must return a referentially stable value or React
 * will re-render without end.
 */

import { readStored, subscribeToStorage, writeStored } from "./storage";

export interface PersistentStore<T> {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  /** Replace the value; a returned identity is treated as no change. */
  update: (updater: (previous: T) => T) => void;
}

export function createPersistentStore<T>(
  key: string,
  isValid: (value: unknown) => value is T,
  emptyValue: T,
): PersistentStore<T> {
  let snapshot: T = emptyValue;
  let hasLoaded = false;

  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  const load = () => {
    snapshot = readStored(key, isValid, emptyValue);
    hasLoaded = true;
  };

  return {
    subscribe(onStoreChange) {
      listeners.add(onStoreChange);

      // Another tab's write. The `storage` event never fires in the tab that
      // made the change, so this only ever carries other tabs' updates.
      const unsubscribe = subscribeToStorage(key, () => {
        load();
        emit();
      });

      return () => {
        listeners.delete(onStoreChange);
        unsubscribe();
      };
    },

    getSnapshot() {
      if (!hasLoaded) load();
      return snapshot;
    },

    getServerSnapshot() {
      return emptyValue;
    },

    update(updater) {
      if (!hasLoaded) load();

      const next = updater(snapshot);
      if (next === snapshot) return;

      snapshot = next;
      writeStored(key, next);
      emit();
    },
  };
}
