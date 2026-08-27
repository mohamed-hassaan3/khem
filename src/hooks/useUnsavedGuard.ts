"use client";

import { useCallback, useEffect, useId, useState } from "react";

import { useUnsavedChanges } from "@/src/providers/unsaved-changes-provider";

/**
 * Tells the dashboard whether this editor has work nobody has saved.
 *
 * ## Dirtiness is derived, never declared
 *
 * Every admin editor already builds one `payload` object — the thing it posts to
 * its action. This hook takes that object and compares it against the value it
 * had on first render. Nothing has to remember to set a flag when a field
 * changes, which is the failure mode a hand-maintained `dirty` boolean always
 * eventually has: the one field somebody forgot to wire is the one whose loss
 * nobody notices until an editor has retyped a description twice.
 *
 * The comparison is a **key-sorted** serialisation, so a payload whose keys are
 * assembled in a different order is not mistaken for an edit.
 *
 * ## The baseline moves on a successful save
 *
 * After a save the form *is* what the database holds, so `markSaved()` takes a
 * fresh snapshot. Without it, saving and then navigating would still prompt —
 * which teaches an editor to click through the dialog without reading it, and a
 * dialog nobody reads protects nothing.
 *
 * ## `save` must report the truth
 *
 * The dialog's "Save Changes" awaits it and leaves the page only on `true`. A
 * save that reported success on a validation failure would navigate away from
 * the error, which is worse than not offering the button at all.
 */

/** Stable regardless of key order, so key order cannot read as an edit. */
function fingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => {
    if (inner === null || typeof inner !== "object" || Array.isArray(inner)) {
      return inner;
    }

    const entries = Object.entries(inner as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b),
    );

    return Object.fromEntries(entries);
  });
}

export interface UnsavedGuardInput<T> {
  /** Exactly the object the form submits. */
  payload: T;
  /** Performs the save and reports whether it succeeded. */
  save: () => Promise<boolean>;
  /** True while a save is already in flight. */
  pending: boolean;
}

export interface UnsavedGuardResult {
  /** Whether the form currently differs from its last saved state. */
  isDirty: boolean;
  /** Call after a successful save, to re-baseline. */
  markSaved: () => void;
}

export function useUnsavedGuard<T>({
  payload,
  save,
  pending,
}: UnsavedGuardInput<T>): UnsavedGuardResult {
  const { setGuard } = useUnsavedChanges();
  /*
   * One key per mounted editor. Screens like the social-profile list hold many
   * of these at once, and each must be counted — and cleared — on its own.
   */
  const key = useId();

  const current = fingerprint(payload);

  /*
   * State, not a ref. The baseline is read during render to decide dirtiness,
   * and a ref read during render is a value React has not promised to re-render
   * for — so `markSaved()` would flip the underlying fact without the form ever
   * being told. Here the re-baseline is a real state change, which is exactly
   * what "this form is now clean" is.
   */
  const [baseline, setBaseline] = useState<string>(current);
  const isDirty = current !== baseline;

  /*
   * `save` and `pending` change identity on most renders, so the guard is
   * rewritten after each one. It is a ref write in the provider, not a state
   * update — see that file's header for why this costs nothing.
   *
   * No dependency array: the point is to publish the *latest* closure, and a
   * stale one would save the values the form held when the dialog opened.
   */
  useEffect(() => {
    setGuard(key, { dirty: isDirty, pending, save });
  });

  // Registration is per-editor: unmounting must leave the dashboard clean, or a
  // form that has been navigated away from keeps guarding the screen behind it.
  useEffect(() => () => setGuard(key, null), [setGuard, key]);

  /*
   * Called from a save's continuation, so it re-baselines against the payload as
   * it was when that save was posted — which is what the database now holds.
   */
  const markSaved = useCallback(() => {
    setBaseline(current);
  }, [current]);

  return { isDirty, markSaved };
}
