"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Transient confirmation for the desk.
 *
 * ## The rule this enforces
 *
 * **Successes leave; failures stay.** A success is a receipt — "Saved." — and it
 * has done its whole job the moment it is read, so it belongs in something that
 * disappears. A failure is work: it names a field, or a reason, and the editor
 * has to act on it. `AdminNotice`, rendered inline above the form, keeps that
 * job and always will.
 *
 * This matters more than it sounds. If failures were toasts, an editor who
 * looked away for four seconds would be left with a form that simply did not
 * save and no statement of why — which is the one outcome worse than a save that
 * fails loudly.
 *
 * ## No dependency
 *
 * A toast is a list, a timer, and a live region. A library for that would be
 * weight the dashboard does not need, and AGENTS.md §6 names no toast package.
 */

/** What a toast is. Kept to one kind, because only successes are toasted. */
export interface AdminToast {
  id: number;
  message: string;
}

interface AdminToastValue {
  toasts: readonly AdminToast[];
  /** Raise a transient confirmation. */
  toast: (message: string) => void;
  dismiss: (id: number) => void;
}

const AdminToastContext = createContext<AdminToastValue | null>(null);

/** How long a confirmation stands before it goes. */
const LIFETIME_MS = 4_000;

export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<readonly AdminToast[]>([]);
  // Monotonic, so two identical messages in the same millisecond stay distinct.
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toast = useCallback(
    (message: string) => {
      const id = (nextId.current += 1);
      setToasts((current) => [...current, { id, message }]);

      /*
       * A plain timeout rather than an effect per toast: the toast owns its own
       * lifetime, and tying it to a component's render cycle would restart the
       * clock every time the dashboard re-rendered underneath it.
       */
      setTimeout(() => dismiss(id), LIFETIME_MS);
    },
    [dismiss],
  );

  const value = useMemo<AdminToastValue>(
    () => ({ toasts, toast, dismiss }),
    [toasts, toast, dismiss],
  );

  return (
    <AdminToastContext.Provider value={value}>
      {children}
    </AdminToastContext.Provider>
  );
}

/**
 * The toaster, or a no-op.
 *
 * Not a throw, for the same reason `useUnsavedChanges` is not: an editor
 * rendered outside the shell should lose its confirmation, not crash.
 */
export function useAdminToast(): AdminToastValue {
  return (
    useContext(AdminToastContext) ?? {
      toasts: [],
      toast: () => {},
      dismiss: () => {},
    }
  );
}
