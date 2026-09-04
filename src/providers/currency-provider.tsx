"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

import { useIsHydrated } from "@/src/hooks/use-is-hydrated";
import { readCookie, writeCookie } from "@/src/lib/cookies";
import {
  BASE_CURRENCY,
  COUNTRY_COOKIE,
  CURRENCY_COOKIE,
  CURRENCY_COOKIE_MAX_AGE,
  currencyForRegion,
  isCurrency,
  isRegion,
  resolveCurrencyForCountry,
  type Currency,
  type Region,
} from "@/src/lib/currency";
import { formatPrice as formatPriceIn } from "@/src/lib/format";

/**
 * The display currency — browser state, persisted to a cookie.
 *
 * Structurally the same shape as `consent-provider.tsx`: a module-level store
 * in the `useSyncExternalStore` form, module-level mutators so the context
 * value stays referentially stable, and a throwing hook.
 *
 * ## Why the server always renders USD
 *
 * `getServerSnapshot()` returns `BASE_CURRENCY`, so the prerendered HTML and
 * the hydration render agree on the stored price, and React swaps in the
 * visitor's currency on the first client render after that. This is the whole
 * reason the feature does not cost the site its static generation: reading the
 * cookie in the layout would opt every price-bearing route out of prerendering
 * for a symbol change. The price a crawler sees, and the price in the cached
 * document, is the real USD one.
 *
 * ## Cookie, not `localStorage`
 *
 * The opposite choice from `consent.ts`, and for the reason that file names:
 * something on the server *does* write this one. `src/proxy.ts` resolves the
 * currency from the request's country header, which it can only hand to the
 * browser through a cookie.
 *
 * ## No cross-tab sync
 *
 * Cookies fire no `storage` event, so a currency change in one tab does not
 * reach the others until they navigate. Polling `document.cookie` to close that
 * gap would cost a timer on every page for a case that barely occurs — a
 * visitor changing currency in one of two open tabs.
 */

interface CurrencyContextValue {
  /** The active display currency. `USD` until hydration completes. */
  currency: Currency;
  /** Persist a deliberate choice; it outranks geo detection from then on. */
  setCurrency: (next: Currency) => void;
  /** `false` until the cookie has been read — see `useIsHydrated`. */
  isHydrated: boolean;
  /** `formatPrice` bound to the active currency. */
  formatPrice: (priceInCents: number) => string;
  /**
   * The region the visitor chose, or `null` when they never have.
   *
   * `null` is not a missing value to be papered over: it is the difference
   * between a stated preference and a currency that was detected. The switcher
   * shows the country the *currency* implies in that case
   * (`representativeCountry`), which says as much as is actually known.
   */
  region: Region | null;
  /**
   * Persist a chosen region, and move the currency with it.
   *
   * One call rather than two, because a country and the currency it is priced
   * in are one decision to the visitor — and letting them be set separately is
   * how a shopper ends up in Egypt paying in riyals.
   */
  setRegion: (next: Region) => void;
}

/**
 * Best guess at a currency without a server-supplied country.
 *
 * Only reached when the proxy wrote no cookie, which means no
 * `x-vercel-ip-country` header: local development, or a non-Vercel host. The
 * IANA timezone is the better of the two signals — it reflects where the device
 * is, not what language it was configured in — so it is tried first, with the
 * locale's region subtag behind it.
 *
 * Every branch is wrapped: a browser that throws on either API gets USD.
 */
function detectCurrencyFromBrowser(): Currency {
  const zoneCountry: Record<string, string> = {
    "Africa/Cairo": "EG",
    "Europe/London": "GB",
    "Asia/Dubai": "AE",
    "Asia/Riyadh": "SA",
    "Europe/Paris": "FR",
    "Europe/Berlin": "DE",
    "Europe/Madrid": "ES",
    "Europe/Rome": "IT",
    "Europe/Amsterdam": "NL",
    "Europe/Brussels": "BE",
    "Europe/Vienna": "AT",
    "Europe/Lisbon": "PT",
    "Europe/Dublin": "IE",
    "Europe/Athens": "GR",
    "Europe/Helsinki": "FI",
  };

  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fromZone = zoneCountry[zone];
    if (fromZone !== undefined) return resolveCurrencyForCountry(fromZone);

    // "ar-EG" → "EG". A bare language tag ("en") has no region and falls
    // through to the base currency, which is the right answer for it.
    const region = new Intl.Locale(navigator.language).region;
    return resolveCurrencyForCountry(region ?? null);
  } catch {
    return BASE_CURRENCY;
  }
}

/*
 * The store. `snapshot` is cached rather than recomputed, because `getSnapshot`
 * runs on every render and must return a referentially stable value — a fresh
 * read each time would be fine for a string, but the caching is also what stops
 * the browser detection from running dozens of times.
 */
let snapshot: Currency = BASE_CURRENCY;
let hasLoaded = false;

const listeners = new Set<() => void>();

function load(): void {
  // `null` rather than `BASE_CURRENCY` as the fallback, so a visitor who chose
  // USD deliberately is told apart from one with no cookie at all — only the
  // latter should be re-detected.
  const stored = readCookie<Currency, null>(CURRENCY_COOKIE, isCurrency, null);
  snapshot = stored ?? detectCurrencyFromBrowser();
  hasLoaded = true;
}

const currencyStore = {
  subscribe(onStoreChange: () => void) {
    listeners.add(onStoreChange);
    return () => {
      listeners.delete(onStoreChange);
    };
  },

  getSnapshot(): Currency {
    if (!hasLoaded) load();
    return snapshot;
  },

  getServerSnapshot(): Currency {
    return BASE_CURRENCY;
  },
};

/** Stable by construction: defined once at module scope, never re-created. */
function commit(next: Currency): void {
  if (!hasLoaded) load();
  if (next === snapshot) return;

  snapshot = next;
  writeCookie(CURRENCY_COOKIE, next, CURRENCY_COOKIE_MAX_AGE);

  for (const listener of listeners) listener();
}

/*
 * The region store — the same shape as the currency one above, and separate
 * from it on purpose.
 *
 * The two are not one value: the currency is what every price is drawn in and
 * may have been detected at the edge, while the region is only ever something
 * the visitor said. Merging them would mean either inventing a country for a
 * detected currency or discarding a stated one, and both are worse than
 * carrying two.
 */
let regionSnapshot: Region | null = null;
let regionLoaded = false;

const regionListeners = new Set<() => void>();

function loadRegion(): void {
  regionSnapshot = readCookie<Region, null>(COUNTRY_COOKIE, isRegion, null);
  regionLoaded = true;
}

const regionStore = {
  subscribe(onStoreChange: () => void) {
    regionListeners.add(onStoreChange);
    return () => {
      regionListeners.delete(onStoreChange);
    };
  },

  getSnapshot(): Region | null {
    if (!regionLoaded) loadRegion();
    return regionSnapshot;
  },

  /** Nothing is known about the visitor's region in the prerendered HTML. */
  getServerSnapshot(): Region | null {
    return null;
  },
};

function commitRegion(next: Region): void {
  if (!regionLoaded) loadRegion();

  if (next !== regionSnapshot) {
    regionSnapshot = next;
    writeCookie(COUNTRY_COOKIE, next, CURRENCY_COOKIE_MAX_AGE);

    for (const listener of regionListeners) listener();
  }

  // Always, even when the region is unchanged: a visitor re-picking their own
  // country after overruling the currency by hand means "put it back".
  commit(currencyForRegion(next));
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const currency = useSyncExternalStore(
    currencyStore.subscribe,
    currencyStore.getSnapshot,
    currencyStore.getServerSnapshot,
  );
  const isHydrated = useIsHydrated();

  const region = useSyncExternalStore(
    regionStore.subscribe,
    regionStore.getSnapshot,
    regionStore.getServerSnapshot,
  );

  const setCurrency = useCallback((next: Currency) => commit(next), []);
  const setRegion = useCallback((next: Region) => commitRegion(next), []);

  const formatPrice = useCallback(
    (priceInCents: number) => formatPriceIn(priceInCents, currency),
    [currency],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({ currency, setCurrency, isHydrated, formatPrice, region, setRegion }),
    [currency, setCurrency, isHydrated, formatPrice, region, setRegion],
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);

  if (context === null) {
    throw new Error("useCurrency must be used within a <CurrencyProvider>.");
  }

  return context;
}

/**
 * The formatter every Client Component should use.
 *
 * Same call shape as importing `formatPrice` from `src/lib/format` directly —
 * which is exactly why nothing outside this file and `Price.tsx` may do that.
 * A direct import compiles, renders, and silently shows USD forever.
 */
export function useFormatPrice(): (priceInCents: number) => string {
  return useCurrency().formatPrice;
}
