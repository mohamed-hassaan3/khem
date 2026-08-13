/**
 * Recent searches, persisted locally.
 *
 * Read back through the guarded `localStorage` helpers with a type guard, for
 * the same reason the cart is: `localStorage` is attacker-writable, so anything
 * coming out of it is untrusted input until it has been validated.
 */

import { useSyncExternalStore } from "react";

import { MAX_QUERY_LENGTH } from "@/src/lib/search/config";
import { normalizeQuery } from "@/src/lib/search/text";
import { readStored, subscribeToStorage, writeStored } from "@/src/lib/storage";

/** Versioned, so a shape change never needs a migration. */
export const RECENT_SEARCHES_KEY = "khem.search.recent.v1";

/** How many are kept — and, more to the point, how many are ever rendered. */
export const MAX_RECENT_SEARCHES = 6;

function isRecentList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_RECENT_SEARCHES &&
    value.every(
      (entry) =>
        typeof entry === "string" &&
        entry.length > 0 &&
        entry.length <= MAX_QUERY_LENGTH,
    )
  );
}

export function readRecentSearches(): string[] {
  return readStored(RECENT_SEARCHES_KEY, isRecentList, []);
}

/* ── Reading it from React ────────────────────────────────────
 *
 * `localStorage` is an external store, so it is read through
 * `useSyncExternalStore` rather than copied into state by an effect. Three
 * things fall out of that: the server snapshot is empty so there is no
 * hydration mismatch, another tab's search appears without a listener of our
 * own, and no `setState` runs in an effect body.
 *
 * The snapshot must be referentially stable between changes or React re-renders
 * forever, so the parsed array is memoised against the raw string it came from.
 */

const SERVER_SNAPSHOT: string[] = [];

let cachedRaw: string | null = null;
let cachedValue: string[] = SERVER_SNAPSHOT;
/** Bumped by our own writes, which the `storage` event does not report back. */
let localRevision = 0;
let cachedRevision = -1;

function snapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
  } catch {
    // Storage disabled — `readRecentSearches()` degrades to the empty list.
  }

  if (raw !== cachedRaw || localRevision !== cachedRevision) {
    cachedRaw = raw;
    cachedRevision = localRevision;
    cachedValue = readRecentSearches();
  }

  return cachedValue;
}

function subscribe(onChange: () => void): () => void {
  const unsubscribeOtherTabs = subscribeToStorage(RECENT_SEARCHES_KEY, onChange);
  listeners.add(onChange);

  return () => {
    listeners.delete(onChange);
    unsubscribeOtherTabs();
  };
}

const listeners = new Set<() => void>();

function notify(): void {
  localRevision += 1;
  for (const listener of listeners) listener();
}

/** The recent searches, live. Empty on the server and on the first paint. */
export function useRecentSearches(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT);
}

/** Prepend a query, de-duplicated case-insensitively and capped. */
export function addRecentSearch(query: string): void {
  const normalized = normalizeQuery(query);
  if (normalized.length === 0) return;

  const next = [
    normalized,
    ...readRecentSearches().filter(
      (entry) => entry.toLowerCase() !== normalized.toLowerCase(),
    ),
  ].slice(0, MAX_RECENT_SEARCHES);

  writeStored(RECENT_SEARCHES_KEY, next);
  notify();
}

export function clearRecentSearches(): void {
  writeStored(RECENT_SEARCHES_KEY, []);
  notify();
}
