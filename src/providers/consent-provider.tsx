"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { useIsHydrated } from "@/src/hooks/use-is-hydrated";
import {
  ACCEPT_ALL,
  CONSENT_STORAGE_KEY,
  DECLINE_ALL,
  isStoredConsent,
  toConsentRecord,
  type ConsentChoices,
  type ConsentRecord,
} from "@/src/lib/consent";
import { createPersistentStore } from "@/src/lib/persistent-store";

/**
 * Cookie consent — browser state, persisted to `localStorage`.
 *
 * Structurally identical to `wishlist-provider.tsx`: a module-level store in
 * the `useSyncExternalStore` shape, module-level mutators so the context value
 * stays referentially stable, and a throwing hook.
 *
 * Two things come free from that shape and are worth naming, because they are
 * the parts a hand-rolled effect would get wrong:
 *
 * - **Hydration.** `getServerSnapshot` returns `null`, so the server HTML and
 *   the first client render agree that no decision is known. The banner is
 *   additionally gated on `useIsHydrated()`, so it can never flash on a visitor
 *   who already decided.
 * - **Cross-tab.** Accepting in one tab fires `storage` in the others, which
 *   re-reads the record and dismisses their banners without a reload.
 *
 * Nothing reads `record.analytics` / `record.preferences` yet — there is no
 * analytics tag on the site. This provider is the gate that a future one must
 * pass through, rather than being wired to a script that does not exist.
 */

export interface ConsentContextValue {
  /** The stored decision, or `null` when none has been made. */
  record: ConsentRecord | null;
  /** `true` once a valid, current-version decision exists. */
  hasDecided: boolean;
  /** `false` until the browser store has been read — see `useIsHydrated`. */
  isHydrated: boolean;
  /** Whether the banner should be on screen. */
  isOpen: boolean;
  /** `true` when the visitor reopened it deliberately, rather than on arrival. */
  isReopened: boolean;
  acceptAll: () => void;
  declineAll: () => void;
  save: (choices: ConsentChoices) => void;
  /** Reopen from the footer's "Cookie Settings". */
  open: () => void;
  /** Dismiss a reopened panel without changing the stored decision. */
  close: () => void;
}

const consentStore = createPersistentStore<ConsentRecord | null>(
  CONSENT_STORAGE_KEY,
  // `null` is the empty value, so the guard must admit it as well as a record.
  (value): value is ConsentRecord | null =>
    value === null || isStoredConsent(value),
  null,
);

// Stable by construction — defined once at module scope, never re-created per
// render, so they can sit in the context value without memoisation.
function commit(choices: ConsentChoices): void {
  consentStore.update(() => toConsentRecord(choices));
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const record = useSyncExternalStore(
    consentStore.subscribe,
    consentStore.getSnapshot,
    consentStore.getServerSnapshot,
  );
  const isHydrated = useIsHydrated();

  /*
   * Reopening is session state, not persisted state: it says "the visitor asked
   * to see this again", which must not survive a reload the way the decision
   * itself does.
   */
  const [isReopened, setIsReopened] = useState(false);

  const hasDecided = record !== null;

  const open = useCallback(() => setIsReopened(true), []);
  const close = useCallback(() => setIsReopened(false), []);

  /*
   * Every commit also closes a reopened panel, so the three exits behave
   * identically whether the banner was raised on arrival or from the footer.
   */
  const acceptAll = useCallback(() => {
    commit(ACCEPT_ALL);
    setIsReopened(false);
  }, []);

  const declineAll = useCallback(() => {
    commit(DECLINE_ALL);
    setIsReopened(false);
  }, []);

  const save = useCallback((choices: ConsentChoices) => {
    commit(choices);
    setIsReopened(false);
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      record,
      hasDecided,
      isHydrated,
      // Never before hydration: the server cannot know what a returning visitor
      // already answered, so it must not render the banner into the HTML.
      isOpen: isHydrated && (!hasDecided || isReopened),
      isReopened,
      acceptAll,
      declineAll,
      save,
      open,
      close,
    }),
    [
      record,
      hasDecided,
      isHydrated,
      isReopened,
      acceptAll,
      declineAll,
      save,
      open,
      close,
    ],
  );

  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const context = useContext(ConsentContext);

  if (context === null) {
    throw new Error("useConsent must be used within a <ConsentProvider>.");
  }

  return context;
}
