# IMPORTANT: Stripe Payment Readiness

> **Status: implemented.** The activation manual this brief asks for is
> [`STRIPE-SETUP.md`](../../STRIPE-SETUP.md) at the repository root, and it is
> the document to follow when the time comes — this file is the requirement, not
> the procedure. Card payments are off by default and are switched on with
> `STRIPE_PAYMENT_ENABLED`; see `.env.example`.

Prepare the entire application for a future **Stripe card payment activation**, but do not require Stripe to be active now.

## Goal

When we decide to activate Stripe later, the remaining work from our side should only be:

1. Create/configure the Stripe account.
2. Add the required Stripe keys and webhook secrets to environment variables.
3. Follow a clear setup checklist.
4. Enable the payment method.

The application should already contain all necessary secure integration architecture and code.

## Requirements

* Implement Stripe using secure server-side architecture only.
* Never expose secret keys to the client.
* Use Stripe's official SDK and recommended integration patterns.
* Keep all payment creation, verification, and sensitive operations on the server.
* Validate payment status securely with Stripe webhooks.
* Never trust payment success information sent directly from the frontend.
* Implement proper webhook signature verification.
* Make webhook processing idempotent to prevent duplicate orders or duplicate payment processing.
* Ensure order status changes only after verified payment confirmation.
* Handle failed, cancelled, pending, and successful payments correctly.
* Keep the existing payment/order system working while Stripe is inactive.
* Make Stripe activation configurable through environment variables and feature flags/configuration.
* Do not hardcode API keys, secrets, URLs, or production settings.

## Environment

Prepare the required environment variables with placeholders only, for example:

* Stripe publishable key
* Stripe secret key
* Stripe webhook secret
* Stripe payment enabled/configuration flag

Do not include real credentials anywhere in the repository.

## Activation Documentation

Create a detailed file:

`STRIPE-SETUP.md`

This file is for the future development/operations team, when Claude will no longer be used.

It must clearly explain:

* Required Stripe account configuration.
* Required environment variables.
* Development vs production setup.
* How to configure Stripe webhooks.
* Which webhook events are required and why.
* How to test payments safely.
* How to activate Stripe in production.
* Security requirements.
* How to rotate keys safely.
* How to troubleshoot common payment and webhook issues.
* A final activation checklist.

## Final Goal

After this implementation, Stripe should be technically ready and secure.

Later, the team should only need to provide the correct Stripe configuration, environment variables, webhook setup, and follow `STRIPE-SETUP.md` to activate card payments without needing to redesign or rebuild the payment integration.
