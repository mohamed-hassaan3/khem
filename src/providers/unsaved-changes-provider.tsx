"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * One question, asked at the moment somebody tries to leave: does the editor on
 * this screen have work nobody has saved?
 *
 * Mounted once in `AdminShell`, so every rail link and the storefront link can
 * consult it, and so the dialog has one place to live rather than one per form.
 *
 * ## Many editors, not one
 *
 * The registry is a map, not a slot. Three screens in this dashboard — social
 * profiles, contact channels, content rows — are a *list* of small independent
 * editors, each with its own save button, and a single slot would let whichever
 * row rendered last speak for all of them. So each registers under its own key,
 * "is anything unsaved?" is `some`, and the dialog's Save is `all` — in turn,
 * stopping at the first refusal, because a half-saved screen that then navigated
 * away would be the exact loss this feature exists to prevent.
 *
 * ## The guard lives in a ref, not in state
 *
 * A form's dirtiness changes on **every keystroke**. Holding it in provider
 * state would re-render the entire dashboard chrome — rail, header, panel —
 * once per character typed into a product description. So the active editor
 * registers a small object in a ref, and the two things that need to know
 * consult it at the moment they need to: the `beforeunload` handler, and
 * `requestNavigation()`.
 *
 * State is used for exactly one thing — whether the dialog is open — because
 * that is the only fact anybody has to *render*.
 *
 * ## One `beforeunload` listener, attached for the life of the provider
 *
 * The obvious alternative is to attach it only while dirty, which would need
 * dirtiness in state and bring the per-keystroke re-render back with it. A
 * single listener that reads the ref and returns without calling
 * `preventDefault()` prompts nothing at all — the browser only shows its dialog
 * when the event is actually cancelled — so the two are equivalent where it
 * matters, and this one costs nothing per keystroke.
 *
 * ## What this cannot do
 *
 * **Browser Back and Forward.** A `popstate` has already happened by the time
 * anything hears about it, and it cannot be cancelled. The usual workaround —
 * pushing a sentinel entry and re-pushing it on every popstate — corrupts the
 * history stack and traps somebody who genuinely wants to leave. It is not worth
 * it, and §12.3 of the plan says "where technically appropriate" for exactly
 * this kind of case. Back leaves the page; the edits are lost.
 *
 * **A hard reload or a closed tab** get the browser's own dialog, whose wording
 * every browser fixed years ago. Ours is for navigation inside the dashboard.
 */

/** What an editor tells the provider about itself. */
export interface UnsavedGuard {
  /** Whether the form differs from what it was loaded with. */
  dirty: boolean;
  /** True while a save is already in flight. */
  pending: boolean;
  /** Saves, and reports whether it worked. The dialog leaves only on `true`. */
  save: () => Promise<boolean>;
}

interface UnsavedChangesValue {
  /**
   * Called by each editor after every render, and with `null` when it unmounts
   * — so leaving a form always leaves the dashboard clean, and a screen full of
   * row editors is counted once per row rather than once in total.
   */
  setGuard: (key: string, guard: UnsavedGuard | null) => void;
  /**
   * Ask permission to navigate.
   *
   * Returns `true` when the caller must **stop** — the dialog is now open and
   * will run `proceed` if the answer is yes. Returns `false` when there is
   * nothing to protect and the navigation should carry on untouched.
   */
  requestNavigation: (proceed: () => void) => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesValue | null>(null);

/** The dialog's view of the world. Read only while it is open. */
export interface PendingNavigation {
  proceed: () => void;
  /** Saves every dirty editor on the screen; false if any refused. */
  save: () => Promise<boolean>;
  /** True while any of them is already saving. */
  pending: boolean;
}

export function UnsavedChangesProvider({
  children,
  renderDialog,
}: {
  children: React.ReactNode;
  /**
   * The dialog, given the pending navigation and a way to close.
   *
   * Injected rather than imported so this provider stays free of KHEM's admin
   * styling — it is a mechanism, and the dialog is a design.
   */
  renderDialog: (
    pending: PendingNavigation | null,
    close: () => void,
  ) => React.ReactNode;
}) {
  const guardsRef = useRef(new Map<string, UnsavedGuard>());
  const [pending, setPending] = useState<PendingNavigation | null>(null);

  const setGuard = useCallback((key: string, guard: UnsavedGuard | null) => {
    if (guard === null) guardsRef.current.delete(key);
    else guardsRef.current.set(key, guard);
  }, []);

  const requestNavigation = useCallback((proceed: () => void) => {
    // Snapshotted here: the editors keep re-registering as they render, and the
    // dialog must act on the set that existed when the question was asked.
    const dirty = [...guardsRef.current.values()].filter((guard) => guard.dirty);
    if (dirty.length === 0) return false;

    setPending({
      proceed,
      pending: dirty.some((guard) => guard.pending),
      save: async () => {
        for (const guard of dirty) {
          // Sequential, and stops at the first refusal: a screen half-saved and
          // then navigated away from is the loss this exists to prevent.
          if (!(await guard.save())) return false;
        }
        return true;
      },
    });

    return true;
  }, []);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      const anyDirty = [...guardsRef.current.values()].some((g) => g.dirty);
      if (!anyDirty) return;

      // Both are required across browsers, and neither controls the wording:
      // the text has been fixed by the browser for years.
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const value = useMemo<UnsavedChangesValue>(
    () => ({ setGuard, requestNavigation }),
    [setGuard, requestNavigation],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      {renderDialog(pending, () => setPending(null))}
    </UnsavedChangesContext.Provider>
  );
}

/**
 * The provider, or a no-op.
 *
 * Deliberately **not** a throw. The editors are also rendered in places the
 * shell does not wrap — and a form that crashes because nothing is listening for
 * its dirty state would be a guard that makes the dashboard worse. Absent a
 * provider, navigation simply is not intercepted.
 */
export function useUnsavedChanges(): UnsavedChangesValue {
  return (
    useContext(UnsavedChangesContext) ?? {
      setGuard: () => {},
      requestNavigation: () => false,
    }
  );
}
