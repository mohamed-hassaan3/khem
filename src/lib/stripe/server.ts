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
 *
 * ## The activation flag
 *
 * Keys alone do not turn card payments on. `STRIPE_PAYMENT_ENABLED` does, and
 * it exists for two reasons that key presence cannot serve:
 *
 *  - **Activation is a decision.** Keys reach a project long before anyone has
 *    tested a real charge — pasted into Vercel to try the intent route, copied
 *    into a preview branch. Inferring "the house is taking card payments" from
 *    "a credential exists" makes that decision a side effect of an env var
 *    landing, which is exactly what `STRIPE-SETUP.md` is written to prevent.
 *  - **It is a kill switch.** Turning the rail off by deleting the secret key
 *    would also blind the webhook, stranding every payment already in flight.
 *    A flag stops new charges while leaving settlement intact.
 *
 * Which is the asymmetry to hold on to: **the webhook never consults this
 * flag.** `src/app/api/webhooks/stripe/route.ts` records money that has already
 * moved and refunds that have already been issued, and both remain true facts
 * about the business regardless of whether the storefront is still selling. The
 * flag gates *taking* payments, never *recording* them.
 */

import Stripe from "stripe";

let client: Stripe | null = null;

/** True when the server can talk to Stripe at all. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Whether the house has switched card payments on.
 *
 * Off is the default, and every value that is not an explicit yes means off —
 * absent, empty, `"false"`, `"no"`, a typo. A flag that failed open on a
 * misspelling would be a flag that turns a payment rail on by accident, and the
 * cost of the two readings is not symmetrical: refusing to sell for an hour is
 * a support ticket, charging cards nobody meant to charge is an incident.
 */
export function isStripePaymentEnabled(): boolean {
  const flag = process.env.STRIPE_PAYMENT_ENABLED?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}

/**
 * Which account the keys point at, read from the key's own prefix.
 *
 * `null` when there is no key, or when it is neither `sk_test_` nor `sk_live_`
 * — a restricted key (`rk_…`) reads as unknown rather than being guessed at.
 *
 * Only ever used to *say* which mode is active, in a log line and in
 * `STRIPE-SETUP.md`'s troubleshooting section, because the single most common
 * activation failure is a live publishable key sitting beside a test secret
 * key. The prefix is not the key and is safe to print; the key itself never is.
 */
export function stripeMode(): "test" | "live" | null {
  const key = process.env.STRIPE_SECRET_KEY;

  if (key?.startsWith("sk_test_")) return "test";
  if (key?.startsWith("sk_live_")) return "live";
  return null;
}

/**
 * True when the *whole* card path is usable — both keys, and the flag.
 *
 * Checked before the checkout page offers the card option. A publishable key
 * with no secret key mounts an Elements form whose intent request will fail;
 * a secret key with no publishable key cannot mount the form at all. Neither
 * half is worth showing on its own, so the storefront asks this question and
 * hides the option, leaving cash on delivery working.
 *
 * The flag is the third term rather than a separate question, so that no caller
 * can check configuration and forget activation. Every place that decides
 * whether a card may be charged asks this one function — the checkout page, the
 * Server Action that writes the order, and the route that creates the intent.
 *
 * It is not, on its own, authorisation to *record* a payment. See the header.
 */
export function isCardPaymentAvailable(): boolean {
  return (
    isStripeConfigured() &&
    Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) &&
    isStripePaymentEnabled()
  );
}

/** The shared Stripe instance, or `null` when unconfigured. */
export function getStripe(): Stripe | null {
  if (!isStripeConfigured()) return null;

  if (!client) {
    // Once per server instance, at the moment the key is first used. Names the
    // mode and nothing else — enough to catch a live key on a preview
    // deployment from the logs alone, without putting a credential in them.
    console.info(
      `[stripe] client initialised in ${stripeMode() ?? "unknown"} mode.`,
    );
  }

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
