import "server-only";

/**
 * Stripe client access.
 *
 * Same shape as `src/lib/email/client.ts`, for the same reasons: constructed
 * lazily rather than at module load, so importing this file in an environment
 * without `STRIPE_SECRET_KEY` — a preview branch, CI, a fresh clone — does not
 * throw and take a whole route down. Presence is reported separately so callers
 * fail **closed** with a clear error rather than falling through to a fake
 * success.
 *
 * `server-only` is not decoration. `STRIPE_SECRET_KEY` can create charges and
 * read every customer the account has; a stray import from a `'use client'`
 * module would bundle it into JavaScript served to the browser. This import
 * makes that a build error instead of an incident. The browser's half of the
 * integration is `src/lib/stripe/client.ts`, which holds only the publishable
 * key.
 *
 * ## No pinned `apiVersion`
 *
 * Deliberate. The SDK's TypeScript definitions describe exactly one version —
 * the one the installed package ships with (`2026-07-29.dahlia` at the time of
 * writing) — and it sends that version by default. Writing the string out here
 * as well adds a second place to edit on every upgrade and buys nothing: the
 * types would already have changed underneath it. The account's dashboard
 * default is irrelevant while the SDK sends an explicit version, which it does.
 */

import Stripe from "stripe";

let client: Stripe | null = null;

/** True when the server can talk to Stripe at all. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * True when the *whole* card path is usable — server key and browser key both.
 *
 * Checked before the checkout page offers the card option. A publishable key
 * with no secret key mounts an Elements form whose intent request will fail;
 * a secret key with no publishable key cannot mount the form at all. Neither
 * half is worth showing on its own, so the storefront asks this question and
 * hides the option, leaving cash on delivery working.
 */
export function isCardPaymentAvailable(): boolean {
  return (
    isStripeConfigured() &&
    Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  );
}

/** The shared Stripe instance, or `null` when unconfigured. */
export function getStripe(): Stripe | null {
  if (!isStripeConfigured()) return null;

  client ??= new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    // Surfaces KHEM in the Stripe dashboard's request logs, which is what
    // makes an unexpected charge traceable to a deploy rather than to a guess.
    appInfo: {
      name: "KHEM Perfumes",
      url: "https://khemperfumes.com",
    },
  });

  return client;
}
