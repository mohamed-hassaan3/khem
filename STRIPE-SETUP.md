# STRIPE-SETUP.md — activating card payments on KHEM

This document is for whoever turns card payments on, and it assumes no
knowledge of how the integration was built or who built it.

**The integration is finished.** Nothing in this document asks you to write
code. Everything below is account configuration, environment variables, and
verification.

Card payments are **off** in this repository today, deliberately and by default.
Cash on delivery works and has always worked; it is unaffected by every step
here, and it keeps working if anything in this document goes wrong.

---

## 1. What is already built

Read this section before changing anything, so that nothing here is rebuilt.

| File | What it does |
| :--- | :--- |
| `src/lib/stripe/server.ts` | The Stripe client, constructed lazily and marked `server-only`. Holds `isCardPaymentAvailable()`, the single question every payment path asks. |
| `src/lib/stripe/client.ts` | Loads Stripe.js in the browser with the publishable key. Never sees a secret. |
| `src/lib/stripe/appearance.ts` | The Payment Element, styled to the house palette. |
| `src/app/api/checkout/intent/route.ts` | Creates the PaymentIntent. Reads the amount from the order row — never from the request. |
| `src/app/api/webhooks/stripe/route.ts` | Stripe's side of the conversation. Verifies the signature, records the event, settles the order, sends the receipt. |
| `src/actions/checkout.ts` | Writes the order and reserves the stock *before* payment. Card orders stay UNPAID with no customer email until Stripe confirms. |
| `src/components/checkout/CardPaymentForm.tsx` | The Payment Element and its submit. |
| `src/components/checkout/PaymentStep.tsx` | The card/cash choice. Hides the card panel when the rail is off. |
| `src/app/api/cron/sweep-unpaid-orders/route.ts` | Cancels and restocks card orders left unpaid for 30 minutes. |
| `supabase/sql/0016_checkout.sql`, `0026_discovery_credits.sql` | `settle_order_payment()` — marks an order paid, exactly once. |
| `supabase/sql/0054_stripe_webhook_events.sql` | The webhook event ledger, `record_stripe_event()`. |

The two rules the whole design rests on, worth knowing before you touch it:

- **The amount always comes from the database**, never from the browser. The
  order is written first, with prices read from the catalog under a row lock;
  the PaymentIntent is then created for whatever that row says it is owed.
- **The browser is never believed about payment.** Only a signed webhook from
  Stripe can mark an order paid, and only that event sends the receipt.

---

## 2. Stripe account configuration

1. **Create the account** at <https://dashboard.stripe.com/register>, or use the
   existing KHEM account if one has been created.
2. **Complete the business profile.** Stripe will not release live keys until
   the legal entity, address, and bank account are supplied and verified. Expect
   this to take days, not minutes — start it before the day you intend to go
   live.
3. **Set the settlement currency to EGP.** KHEM prices, stores, and settles in
   Egyptian pounds. The six display currencies the site offers are a
   presentation transform only and never reach Stripe; the webhook refuses to
   settle any payment that is not in EGP.
4. **Enable the payment methods you want** under Settings → Payment methods.
   Cards are the only one the checkout has been designed and tested around, but
   the integration uses `automatic_payment_methods`, which means **the dashboard
   controls which methods appear** in the Payment Element. Enabling a method
   there makes it appear at checkout with no code change. Enable nothing you are
   not prepared to reconcile and refund.
5. Confirm the account can charge in EGP with the methods you enabled. Stripe
   shows availability per method and per country.

---

## 3. Environment variables

Four variables. All are set on the hosting platform (Vercel: Project →
Settings → Environment Variables) and, for local work, in `.env.local`.

| Variable | Secret? | If absent |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No — it ships to the browser by design | The card form cannot mount; the card option is hidden |
| `STRIPE_SECRET_KEY` | **Yes** — full account access | No PaymentIntent can be created; the card option is hidden |
| `STRIPE_WEBHOOK_SECRET` | **Yes** | The webhook answers 500 and **no card order is ever marked paid** |
| `STRIPE_PAYMENT_ENABLED` | No | Card payments stay off — this is the default |

`STRIPE_PAYMENT_ENABLED` accepts `true` or `1`. **Every other value means off**,
including `false`, an empty string, and a typo. This is intentional: a flag that
failed open on a misspelling would be a flag that starts charging cards by
accident.

Two things it is important to understand about that flag:

- **Keys alone activate nothing.** Both keys *and* the flag are required. Keys
  reach a project long before anybody has tested a real charge, and activation
  should be a decision rather than a side effect of a credential landing.
- **The webhook ignores it.** Turning the flag off stops *new* payments. It does
  not stop a payment already in flight from settling, and it does not stop a
  refund from being recorded. That asymmetry is deliberate — a kill switch that
  also stranded money in flight would be worse than the problem it solves.

`.env.example` documents all four in place, with blank values. It holds names,
never secrets, which is why it is committed.

---

## 4. Development setup

1. Copy the **test** keys from the Stripe dashboard (toggle *Test mode* on;
   Developers → API keys). They begin `pk_test_…` and `sk_test_…`.
2. Put them in `.env.local` along with `STRIPE_PAYMENT_ENABLED=true`.
3. Install the Stripe CLI (<https://stripe.com/docs/stripe-cli>) and sign in
   with `stripe login`.
4. Start forwarding events to your local server:

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

   It prints a signing secret, `whsec_…`. **That is your local
   `STRIPE_WEBHOOK_SECRET`** — put it in `.env.local` and restart `npm run dev`.

5. Apply the database migration if it has not been applied to the database you
   are pointing at:

   ```bash
   npm run db:migrate
   ```

**The development webhook secret is not the production one.** They are different
secrets for different endpoints, and each verifies only its own traffic. Using
the production secret locally — or the reverse — produces `badSignature` on
every event. The CLI's secret also changes each time you start `stripe listen`
unless you pass `--api-key`; if events start failing verification after a
restart, check that first.

---

## 5. Production setup

1. In the Stripe dashboard with *Test mode* **off**, go to Developers →
   Webhooks and add an endpoint:

   ```
   https://khemperfumes.com/api/webhooks/stripe
   ```

2. Subscribe it to exactly the five events in §6.
3. Copy the endpoint's **signing secret** (`whsec_…`). It is shown on the
   endpoint's own page, and it is not the same value as any test secret.
4. Copy the **live** keys from Developers → API keys (`pk_live_…`, `sk_live_…`).
   The live secret key is shown once; store it in the team's password manager at
   the moment you create it.
5. Set all four variables on the hosting platform, for the Production
   environment.
6. **Redeploy.** This step is not optional and it is the one most often
   forgotten: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is inlined into the browser
   bundle at build time, so a running deployment will not pick it up. The three
   server-side variables take effect on the next request, but the publishable
   key requires a fresh build.

---

## 6. Required webhook events, and why each one

Subscribe the endpoint to exactly these five. Everything else is acknowledged
with a 200 and deliberately ignored — subscribing to more is harmless but adds
noise, and answering anything but 200 to an unhandled event would make Stripe
retry it forever.

| Event | Why it is required |
| :--- | :--- |
| `payment_intent.succeeded` | **The only event that marks an order paid.** It settles the order, stamps `paidAt`, issues any Discovery Credits the order earned, and sends the customer's receipt and the house's picking slip. Without this subscription, customers are charged and their orders stay UNPAID forever. |
| `payment_intent.payment_failed` | Marks the payment FAILED. The order stays PROCESSING on purpose — a decline is very often the first of two attempts, and cancelling would return the stock to the shelf while the buyer is still typing. |
| `payment_intent.canceled` | A payment that will not be completed. Marks it FAILED. Stock is left to the sweeper, which owns stock release. |
| `payment_intent.processing` | An asynchronous method accepted but not cleared. Recorded in the logs; the order stays UNPAID, because a payment that has not settled is not a payment. |
| `charge.refunded` | A refund issued from the Stripe dashboard. Moves the order to REFUNDED, returns the stock, withdraws credits, and emails the customer — so that a refund taken in Stripe and one taken in `/admin/orders` have the same consequences. |

**Duplicate deliveries are expected and handled.** Stripe retries until it gets
a 2xx and can deliver the same event more than once even after one. Every event
id is recorded in `"StripeWebhookEvent"` before it is dispatched, and a repeat
is answered 200 and does nothing — so a retry can never produce a second receipt
or a second charge on the order record.

---

## 7. Testing payments safely

Use **test mode** for all of this. Test cards never move real money and are safe
to use as often as you like.

| Card number | What it does |
| :--- | :--- |
| `4242 4242 4242 4242` | Succeeds immediately |
| `4000 0025 0000 3155` | Requires 3-D Secure authentication |
| `4000 0000 0000 9995` | Declined (insufficient funds) |
| `4000 0000 0000 0002` | Declined (generic) |

Any future expiry date, any 3-digit CVC, any postcode.

The full list is at <https://stripe.com/docs/testing>.

**What to verify, in this order:**

1. **The card option appears** at `/checkout` once the keys and the flag are
   set. If it does not, go to §11.
2. **A successful payment.** Pay with `4242…`. Expect: the confirmation page;
   `payment_intent.succeeded` in the `stripe listen` output; the order showing
   PAID in `/admin/orders`; one customer receipt and one house notification.
3. **A duplicate delivery sends nothing.** Take the event id from the CLI output
   and run `stripe events resend <evt_id>`. Expect a 200, a log line saying the
   event was already handled, and **no second email**.
4. **A decline.** Pay with `4000 0000 0000 9995`. Expect the decline shown in
   place on the form, the order still awaiting a retry, and no email. Paying
   again with a good card should settle the same order — not create a second
   one.
5. **3-D Secure.** Pay with `4000 0025 0000 3155` and complete the challenge.
   Expect the same outcome as a plain success.
6. **The sweeper.** Place a card order and abandon it. After 30 minutes — or by
   calling `/api/cron/sweep-unpaid-orders` with the `CRON_SECRET` bearer token —
   expect it cancelled and the stock returned.
7. **A refund.** Refund the test payment in the dashboard. Expect the order
   REFUNDED, stock returned, and the refund notice emailed.

---

## 8. Activating in production

Do this in order. Each step is safe to stop at.

1. Business profile verified and payouts enabled in Stripe.
2. All of §7 verified in **test** mode.
3. Live webhook endpoint created and subscribed to the five events (§5, §6).
4. Live keys and the live webhook secret set on the hosting platform.
5. `STRIPE_PAYMENT_ENABLED=true` set for Production.
6. **Redeploy** (see §5.6 — the publishable key needs a build).
7. **Place one real order** with a real card, for the cheapest item in the
   catalog. Confirm: the order is PAID, the receipt arrives, the payment appears
   in the Stripe dashboard, and the stock decremented.
8. **Refund that order** from the Stripe dashboard. Confirm the order goes
   REFUNDED, the stock returns, and the customer email is sent.

Steps 7 and 8 are the only proof that the live configuration works. Test mode
does not exercise the live keys, the live endpoint, or the live signing secret.

**To turn card payments off again at any time:** set `STRIPE_PAYMENT_ENABLED` to
`false` and redeploy. The card option disappears, cash on delivery continues,
and any payment already in flight still settles.

---

## 9. Security requirements

These are properties of the current code. Preserve them.

- **`STRIPE_SECRET_KEY` never leaves the server.** `src/lib/stripe/server.ts`
  imports `server-only`, which turns any import of it from a Client Component
  into a build error rather than an incident.
- **Never rename a secret to `NEXT_PUBLIC_`.** In Next.js that prefix means
  "inline this into the browser bundle". `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is
  the only Stripe value that belongs there; it can create payment methods and
  confirm intents it already holds the secret for, and nothing else.
- **The charged amount always comes from the `"Order"` row.** No request body
  names a price. The webhook additionally re-compares the intent's amount and
  currency against the order before settling, and refuses on any mismatch.
- **The browser is never believed about payment success.** Only a
  signature-verified webhook settles an order.
- **Unsigned webhook requests are rejected**, and a missing
  `STRIPE_WEBHOOK_SECRET` is a 500, never a bypass. An unconfigured deployment
  must refuse to settle orders rather than settle all of them.
- **Never log a key, a raw webhook body, or a customer's details.** The webhook
  and the checkout action log order numbers, event ids, amounts, and provider
  error messages only.
- **Never commit real credentials.** `.env.example` holds names with blank
  values; `.env.local` is gitignored and stays that way.

---

## 10. Rotating keys safely

**Secret API key** — the order matters, so that no request is ever served with
no valid key:

1. Developers → API keys → Roll the secret key. Stripe issues the new one and
   lets you keep the old one alive for a grace period.
2. Set the new value in the hosting platform's environment variables.
3. Redeploy, and confirm a test payment still works.
4. **Then** expire the old key in the dashboard.

**Publishable key** — same sequence, but remember it is baked into the browser
bundle: it is not live until a fresh build is deployed.

**Webhook signing secret** — a secret belongs to an endpoint, so rotation means
moving endpoints:

1. Create a *second* webhook endpoint pointing at the same URL, subscribed to
   the same five events.
2. Set `STRIPE_WEBHOOK_SECRET` to the new endpoint's secret and redeploy.
3. Confirm events are being verified — send one with `stripe trigger` or watch
   the endpoint's delivery log for 200s.
4. Delete the old endpoint.

During step 2 both endpoints deliver every event. This is safe: the event ledger
means the second copy is recognised and ignored.

**If a key is ever exposed** — committed, pasted into a ticket, in a screenshot
— roll it immediately and expire the old one at once, without the grace period.
A short outage is cheaper than an unauthorised charge.

---

## 11. Troubleshooting

**The card option does not appear at checkout.**
Three things are required, and all three are checked by
`isCardPaymentAvailable()`: `STRIPE_SECRET_KEY`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_PAYMENT_ENABLED=true`. The
most common cause after setting all three is not having redeployed — the
publishable key is inlined at build time. The second most common is a value like
`TRUE ` with a trailing space, which is accepted (the flag is trimmed and
lowercased), against `enabled` or `yes`, which are not.

**`badSignature` in the logs; every event rejected.**
Almost always the wrong secret for the environment — a test `whsec_…` in
production, a production one locally, or a `stripe listen` secret from a
previous run. Confirm the value against the endpoint's own page in the
dashboard. If the secret is definitely right, the other cause is a proxy that
re-serialises the request body; the signature is computed over the exact bytes
Stripe sent.

**Intents are created but orders are never marked paid.**
The webhook is not reaching the application. Check the endpoint's delivery
attempts in the dashboard: 404 means the URL is wrong, a timeout means the
deployment is unreachable, and no attempts at all means the endpoint is not
subscribed to `payment_intent.succeeded`.

**`/api/checkout/intent` answers 503 `unconfigured`.**
The card rail is off — the same three conditions as the first entry.

**`/api/checkout/intent` answers 409 `notPayable`.**
Working as designed. The route only acts on an order that is still PROCESSING,
still UNPAID, still CARD, and less than 30 minutes old. A visitor who left the
payment page open past the window will see this; the order has been swept and
restocked, and they need to place a new one.

**`amount mismatch` in the logs, order not settled.**
The PaymentIntent's amount or currency does not match the order it names. The
order is deliberately left unpaid and the event is not retried, because a
redelivery cannot make the figures agree. This should be unreachable through the
storefront — investigate as a security event, and reconcile the payment by hand
in Stripe before touching the order.

**The customer was charged twice / received two receipts.**
Check `"StripeWebhookEvent"` for the order:

```sql
select * from public."StripeWebhookEvent"
 where "orderId" = '<order id>'
 order by "receivedAt";
```

Two rows with different event ids are two genuinely different events. One row
means one handled event, so a second receipt did not come from here. The
authoritative record of what was actually charged is always Stripe itself.

**A `succeeded` event with no `orderId` in its metadata.**
Logged as an error and not settled. It means a payment was created outside this
application against the same Stripe account. Reconcile it by hand.

**The dashboard says a table is missing, or a payment feature looks broken
immediately after a migration.**
Supabase's API layer serves a cached copy of the schema. `npm run db:migrate`
reloads it and prints `PostgREST schema cache reload signalled`; SQL applied any
other way (the Supabase SQL editor, `psql`) does not. Run
`notify pgrst, 'reload schema';` or restart the Supabase API. See
`supabase/README.md` — the failure is quiet, because the services degrade rather
than throw.

**Which key mode am I actually running?**
The server logs `[stripe] client initialised in test|live mode.` the first time
it constructs the client. A live publishable key beside a test secret key is the
single most common activation mistake and produces confusing failures at
confirmation time rather than at startup.

---

## 12. Activation checklist

```
Stripe account
  [ ] Account created, business profile complete, identity verified
  [ ] Bank account added and payouts enabled
  [ ] Settlement currency is EGP
  [ ] Payment methods enabled (cards at minimum)

Test mode verification
  [ ] Test keys + STRIPE_PAYMENT_ENABLED=true in .env.local
  [ ] `stripe listen` running, its whsec_ in STRIPE_WEBHOOK_SECRET
  [ ] `npm run db:migrate` applied (0054 present)
  [ ] Card option appears at /checkout
  [ ] 4242… pays; order PAID; receipt and picking slip both sent
  [ ] `stripe events resend` sends no second email
  [ ] 4000…9995 declines in place; order awaits retry; no email
  [ ] 3-D Secure card completes and settles
  [ ] Abandoned card order is swept and restocked
  [ ] Refund in dashboard → order REFUNDED, stock returned, email sent

Production configuration
  [ ] Webhook endpoint created at https://khemperfumes.com/api/webhooks/stripe
  [ ] Subscribed to the five events in §6
  [ ] Live pk_live_ / sk_live_ set on the hosting platform
  [ ] Live whsec_ set on the hosting platform
  [ ] STRIPE_PAYMENT_ENABLED=true set for Production
  [ ] Live secret key stored in the team password manager
  [ ] REDEPLOYED (the publishable key is inlined at build time)

Live proof
  [ ] One real order placed with a real card
  [ ] Order shows PAID; receipt received; stock decremented
  [ ] Payment visible in the Stripe dashboard
  [ ] That order refunded; order REFUNDED; stock returned; email sent

  [ ] Card payments are live.
```
