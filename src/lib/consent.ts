/**
 * Cookie consent — the stored record and its validation.
 *
 * ## Why `localStorage` rather than a cookie
 *
 * Nothing on the server reads consent today: KHEM ships no marketing pixel and
 * no cookie-setting analytics tag (Umami is cookieless and is deliberately not
 * gated), so there is no script to gate during SSR. A cookie would
 * therefore be sent on every request to buy nothing, while `localStorage` gets
 * the hydration-safe read, the type-guarded parse, and the cross-tab sync for
 * free from `persistent-store.ts`. If a server-gated script ever lands, this is
 * the file that has to change first — the storage mechanism is deliberately
 * confined here and in the provider.
 *
 * ## Categories
 *
 * The published policy (the `"LegalDocument"` row for `cookie-policy`) names
 * two cookie categories: Essential and Preferences. Essential is not
 * represented in the record at all — it is not a choice, so storing a boolean
 * for it would imply it could be `false`. KHEM runs no advertising cookies, so
 * there is deliberately no marketing category to consent to.
 *
 * The record also carries `analytics`, which the banner no longer offers — see
 * `BANNER_CATEGORIES`. It was kept rather than removed so that removing a
 * toggle did not invalidate every stored decision: dropping a category asks
 * nothing new of anyone, so it is not a reason to re-prompt.
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

/**
 * The categories the banner offers a toggle for — a subset of what is stored.
 *
 * `analytics` is stored but no longer shown. Its only reader was the Umami
 * tracker, which is cookieless and now counts every visit regardless of
 * consent (`prompts/umami-count-every-visitor.md`); a switch that controls
 * nothing would misdescribe the site. The field stays in the record, and
 * `CONSENT_VERSION` stays put, so no stored decision is invalidated and no
 * visitor is asked again. It is reserved for a future tool that *does* set
 * cookies: such a tool would add `"analytics"` back here and bump the version,
 * so every visitor is asked about it afresh.
 */
export const BANNER_CATEGORIES = ["preferences"] as const satisfies readonly ConsentCategory[];

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
