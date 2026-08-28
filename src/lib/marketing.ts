/**
 * The offer popup's memory of a visitor.
 *
 * ## What is stored, and why it is not a choice
 *
 * One small record under `khem.offer.v1`: whether the person subscribed or
 * dismissed, and when. It is written **whether or not** optional cookies were
 * accepted, and that is deliberate — the record exists to honour a "no". A
 * visitor who closes the popup and is shown it again on the next page has been
 * ignored, and declining analytics is not a request to be interrupted more
 * often. It carries no identifier, never leaves the browser, and is the
 * narrowest thing that can implement "do not repeatedly annoy the same visitor".
 *
 * The popup is nonetheless held back until the cookie banner has been answered
 * (`src/components/marketing/OfferPopup.tsx`), because two modals arriving
 * together is the behaviour the specification calls aggressive.
 *
 * ## Untrusted input
 *
 * Everything in `localStorage` is untrusted — `src/lib/storage.ts` says so at
 * length — so the record is read through a type guard. Anything that fails it is
 * treated as absent, which shows the popup rather than suppressing it: failing
 * toward *asking* is recoverable, failing toward silence is not.
 */

/** Versioned key, matching the `khem.*.v1` convention in `storage.ts`. */
export const OFFER_STORAGE_KEY = "khem.offer.v1";

/** Bump to re-approach every visitor — a new campaign, a new offer. */
export const OFFER_VERSION = 1;

export type OfferOutcome = "dismissed" | "subscribed";

export interface OfferRecord {
  version: number;
  outcome: OfferOutcome;
  /** Epoch ms. */
  at: number;
}

export function isStoredOffer(value: unknown): value is OfferRecord {
  if (typeof value !== "object" || value === null) return false;

  const record = value as Record<string, unknown>;

  return (
    record.version === OFFER_VERSION &&
    (record.outcome === "dismissed" || record.outcome === "subscribed") &&
    typeof record.at === "number" &&
    Number.isFinite(record.at) &&
    record.at > 0
  );
}

export function toOfferRecord(outcome: OfferOutcome): OfferRecord {
  return { version: OFFER_VERSION, outcome, at: Date.now() };
}

/**
 * Whether the popup may be shown again.
 *
 * Subscribing is permanent: somebody already on the list has nothing left to be
 * offered, and asking again would be the house forgetting them. A dismissal
 * lapses after the configured window, so a seasonal campaign can reach a visitor
 * who said "not now" in the spring.
 *
 * A record from the future — a clock that moved backwards, a hand-edited blob —
 * is treated as a live dismissal rather than an expired one. The failure mode of
 * being too quiet for a month is smaller than the failure mode of a popup on
 * every page load.
 */
export function mayShowOffer(
  record: OfferRecord | null,
  snoozeDays: number,
): boolean {
  if (record === null) return true;
  if (record.outcome === "subscribed") return false;

  const elapsed = Date.now() - record.at;
  if (elapsed < 0) return false;

  return elapsed >= snoozeDays * 24 * 60 * 60 * 1_000;
}
