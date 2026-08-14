/**
 * Cookie consent — the stored record and its validation.
 *
 * ## Why `localStorage` rather than a cookie
 *
 * Nothing on the server reads consent today: KHEM ships no analytics tag and no
 * marketing pixel, so there is no script to gate during SSR. A cookie would
 * therefore be sent on every request to buy nothing, while `localStorage` gets
 * the hydration-safe read, the type-guarded parse, and the cross-tab sync for
 * free from `persistent-store.ts`. If a server-gated script ever lands, this is
 * the file that has to change first — the storage mechanism is deliberately
 * confined here and in the provider.
 *
 * ## Categories
 *
 * Exactly the three the published policy names (`src/data/legal.ts`,
 * "cookie-policy"): Essential, Preferences, Analytics. Essential is not
 * represented in the record at all — it is not a choice, so storing a boolean
 * for it would imply it could be `false`. KHEM runs no advertising cookies, so
 * there is deliberately no marketing category to consent to.
 *
 * ## Versioning
 *
 * A record carries the version of the policy it answers. Bumping
 * `CONSENT_VERSION` invalidates every stored decision, which is exactly what a
 * material change to the policy requires: the banner returns and asks again.
 */

/** Versioned key, matching the `khem.*.v1` convention in `storage.ts`. */
export const CONSENT_STORAGE_KEY = "khem.consent.v1";

/** Bump when the policy changes materially, to re-prompt every visitor. */
export const CONSENT_VERSION = 1;

/** The categories a visitor can actually decide on. Essential is not one. */
export type ConsentCategory = "preferences" | "analytics";

export const CONSENT_CATEGORIES: readonly ConsentCategory[] = [
  "preferences",
  "analytics",
];

/** A visitor's decision on each optional category. */
export type ConsentChoices = Record<ConsentCategory, boolean>;

export interface ConsentRecord extends ConsentChoices {
  /** The `CONSENT_VERSION` this decision answers. */
  version: number;
  /** Epoch ms of the decision — shown when the panel is reopened. */
  decidedAt: number;
}

export const ACCEPT_ALL: ConsentChoices = {
  preferences: true,
  analytics: true,
};

export const DECLINE_ALL: ConsentChoices = {
  preferences: false,
  analytics: false,
};

/**
 * Narrow an unknown blob from `localStorage` to a *current* consent record.
 *
 * Stored values are untrusted input (`storage.ts`). A malformed record, or one
 * written against an older `CONSENT_VERSION`, fails here and is treated as
 * absent — which surfaces as "no decision yet" and re-opens the banner, rather
 * than as a crash or a silently honoured stale choice.
 */
export function isStoredConsent(value: unknown): value is ConsentRecord {
  if (typeof value !== "object" || value === null) return false;

  const record = value as Record<string, unknown>;

  return (
    record.version === CONSENT_VERSION &&
    typeof record.decidedAt === "number" &&
    Number.isFinite(record.decidedAt) &&
    record.decidedAt > 0 &&
    typeof record.preferences === "boolean" &&
    typeof record.analytics === "boolean"
  );
}

/** Build a record from a set of choices, stamped with version and time. */
export function toConsentRecord(choices: ConsentChoices): ConsentRecord {
  return {
    version: CONSENT_VERSION,
    decidedAt: Date.now(),
    preferences: choices.preferences,
    analytics: choices.analytics,
  };
}

/** The choices a record represents, without its bookkeeping fields. */
export function toConsentChoices(record: ConsentRecord | null): ConsentChoices {
  if (record === null) return DECLINE_ALL;
  return { preferences: record.preferences, analytics: record.analytics };
}
