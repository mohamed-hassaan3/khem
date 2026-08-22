"use client";

/**
 * Stripe.js loader for the browser.
 *
 * `loadStripe()` injects a script tag and resolves once Stripe.js has
 * initialised. Calling it inside a component body would re-run that on every
 * render, so it is called **once at module scope** and the promise is reused —
 * the pattern Stripe's own React documentation prescribes, and the reason this
 * is a module rather than a hook.
 *
 * Returns `null` when the publishable key is absent, which `<Elements>` treats
 * as "not ready yet" rather than as an error. That never happens in practice:
 * `src/components/checkout/PaymentStep.tsx` only renders the card branch when
 * the server told it the key exists.
 *
 * The publishable key is the one Stripe credential that belongs in the browser
 * — it can create payment methods and confirm intents it already holds the
 * secret for, and nothing else. The secret key lives in
 * `src/lib/stripe/server.ts`, behind `server-only`.
 */

import { loadStripe, type Stripe } from "@stripe/stripe-js";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/**
 * Resolved once, shared by every mount of the payment step.
 *
 * `NEXT_PUBLIC_*` is inlined at build time, so the ternary is resolved by the
 * bundler and an unconfigured build ships no loader call at all.
 */
export const stripePromise: Promise<Stripe | null> = publishableKey
  ? loadStripe(publishableKey)
  : Promise.resolve(null);
