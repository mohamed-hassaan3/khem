# Stripe Payment Readiness — activation-ready, inactive by default

Source brief: `src/docs/STRIPE-PAYMENT-READLINES.md`.

## Goal

Bring the card rail to the state the brief describes: **technically complete,
secure, and dormant** — so that activating card payments later is four
operational steps (create the account, add the keys, follow a checklist, flip a
flag) and *zero* engineering.

The finding that shapes this task: **most of the integration already exists and
is well built.** `src/lib/stripe/*`, `/api/checkout/intent`,
`/api/webhooks/stripe`, `CardPaymentForm`, `PaymentStep`, and
`settle_order_payment()` already implement server-side intent creation, a
signature-verified webhook, and idempotent settlement. This is therefore **not a
rebuild**. It is closing the specific gaps between what is here and what the
brief requires, and writing the activation manual that does not exist.

Cash on delivery must keep working untouched at every point.

## Skills read

- `.agents/skills/supabase` — schema/migration rules, `SECURITY DEFINER`
  discipline, RLS on every `public` table, revoking `anon`/`authenticated`,
  and the PostgREST schema-cache reload after a migration.
- `supabase/README.md` + `supabase/AGENTS.md` — migration file ordering,
  `npm run db:migrate` idempotency, the schema-cache warning in AGENTS.md §9.
- Not read, and deliberately: the session hook suggested `vercel-plugin:ai-sdk`
  and `vercel-plugin:auth`. Both are lexical false positives — this task
  touches neither the AI SDK nor the auth provider — and AGENTS.md §4 permits
  only `clerk`, `supabase`, `ai-sdk` in any case.

## Existing code inspected

| File | What it already does |
| :--- | :--- |
| `src/lib/stripe/server.ts` | Lazy `Stripe` client behind `server-only`; `isStripeConfigured()`, `isCardPaymentAvailable()` |
| `src/lib/stripe/client.ts` | `loadStripe` once at module scope; publishable key only |
| `src/lib/stripe/appearance.ts` | Payment Element themed to §3.2 tokens |
| `src/app/api/checkout/intent/route.ts` | Amount read from the `"Order"` row, never the body; four payability guards; intent reuse; stamps `stripePaymentIntentId` |
| `src/app/api/webhooks/stripe/route.ts` | Raw-body `constructEvent`; fails closed with no secret; handles `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` |
| `src/actions/checkout.ts` | Writes the order before payment; card orders stay UNPAID; no customer mail until the webhook confirms |
| `src/components/checkout/{CheckoutView,PaymentStep,CardPaymentForm}.tsx` | Card panel hidden when unavailable; Elements mounted only after a client secret exists |
| `supabase/sql/0016_checkout.sql`, `0017_order_events.sql` | `settle_order_payment()` — returns `true` exactly once per order, which is what gates the receipt email |
| `supabase/sql/0050_payment_authority.sql` | `set_order_payment_status()`, PAID is one-way, delivery requires payment |
| `src/app/api/cron/sweep-unpaid-orders/route.ts` | Constant-time bearer check; releases stock from unpaid card orders after 30 minutes |
| `.env.example` | Documented placeholders for the three Stripe variables already present |

## Gaps this prompt closes

1. **No activation flag.** Card availability is inferred purely from key
   presence. The brief requires an explicit enabled/configuration flag so
   activation is a deliberate act and so there is a kill switch that does not
   require deleting credentials.
2. **`placeCustomerOrder` never checks whether the card rail is on.** The method
   arrives in the request body and is written straight through. With Stripe off,
   a crafted POST creates a `CARD` order that can never be paid and holds stock
   for thirty minutes. The client hides the panel; nothing enforces it.
3. **Cancelled and pending payments are unhandled.** The brief names four
   outcomes. `payment_intent.canceled` and `payment_intent.processing` fall
   through to the default branch.
4. **Webhook idempotency is per-order, not per-event.** `settle_order_payment()`
   is correctly once-only, but `charge.refunded` and `payment_failed` rely on
   state checks alone, and there is no record that an event was seen — so a
   redelivery is invisible and unauditable.
5. **The settled amount is never compared to the order.** Settlement trusts
   `metadata.orderId` alone. Signature verification makes forgery infeasible, but
   confirming amount and currency against the row is the check that makes
   "verified payment confirmation" literally true.
6. **`STRIPE-SETUP.md` does not exist.** This is the brief's headline
   deliverable and the whole point of the task.

## Decisions and assumptions

- **Flag name and semantics:** `STRIPE_PAYMENT_ENABLED`. The card rail requires
  **both keys AND `STRIPE_PAYMENT_ENABLED=true`**. Anything else — absent,
  empty, `false`, `0` — means off. Off is the default, which is correct today
  (no keys exist) and makes the brief's step 4, "enable the payment method", a
  real step rather than a side effect of pasting a key.
- **Server-only, not `NEXT_PUBLIC_`.** The browser never decides this; the
  checkout page passes `cardAvailable` as a prop, as it already does.
- **The webhook deliberately ignores the flag.** Turning card payments off must
  not strand money that is already in flight: an intent created a minute before
  the switch still has to settle, and a refund issued next month still has to
  land. The flag gates *taking new payments*, never *recording ones already
  taken*. This asymmetry is intentional and must be commented as such.
- **`STRIPE-SETUP.md` lives at the repository root**, the path the brief names
  literally, with a one-line pointer added from `src/docs/STRIPE-PAYMENT-READLINES.md`.
- **Event ledger over event-id-in-a-column.** A `"StripeWebhookEvent"` table
  keyed on Stripe's event id gives both idempotency and an audit trail; a column
  on `"Order"` gives neither for events that touch no order.
- **No new i18n strings.** `checkout.payment.cardUnavailable` already covers the
  only visitor-facing state this adds.
- **No Stripe account exists yet**, so nothing here is verifiable against the
  live API. Verification is typecheck, lint, and the cash path — stated honestly
  rather than claimed as an end-to-end test.

## Files likely to change

**New**
- `STRIPE-SETUP.md` — the activation manual.
- `supabase/sql/0054_stripe_webhook_events.sql` — the event ledger and
  `record_stripe_event()`.

**Modified**
- `src/lib/stripe/server.ts` — the flag; `isCardPaymentAvailable()` honours it;
  a `stripeMode()` helper reporting `"test" | "live" | null` from the key prefix.
- `src/actions/checkout.ts` — refuse `CARD` when the rail is off.
- `src/app/api/checkout/intent/route.ts` — same refusal, plus the flag check.
- `src/app/api/webhooks/stripe/route.ts` — event ledger, `canceled` and
  `processing` handlers, amount/currency verification.
- `.env.example` — `STRIPE_PAYMENT_ENABLED` documented like its neighbours.
- `supabase/README.md` — the new file in the layout table.
- `src/docs/STRIPE-PAYMENT-READLINES.md` — pointer to `STRIPE-SETUP.md`.

**Explicitly unchanged**
- `src/lib/stripe/appearance.ts`, `CardPaymentForm.tsx`, `PaymentStep.tsx`,
  `CheckoutView.tsx` — the client half is already correct and already degrades.
- Every cash-on-delivery path.
- `settle_order_payment()`, `set_order_payment_status()`, `place_order()` — the
  ledger is additive and does not re-declare them.

## Implementation requirements

### 1. `src/lib/stripe/server.ts`

- `isStripePaymentEnabled(): boolean` — `process.env.STRIPE_PAYMENT_ENABLED`
  trimmed and lowercased, true only for `"true"` or `"1"`.
- `isCardPaymentAvailable()` becomes secret key AND publishable key AND
  `isStripePaymentEnabled()`.
- `stripeMode(): "test" | "live" | null` from the secret key prefix
  (`sk_test_` / `sk_live_`), for the setup document and for a one-time
  `console.info` on first client construction — never the key itself.
- Header comment explains why the flag exists and why the webhook does not
  consult it.

### 2. `src/actions/checkout.ts`

After the schema parse and before any database work, refuse a `CARD` order when
`isCardPaymentAvailable()` is false, returning the existing
`{ ok: false, formError: "unconfigured" }` shape. Reuse an existing
`CheckoutResult` error key — do **not** invent a new one or a new dictionary
string. Comment it as the boundary the hidden panel is only an affordance for.

### 3. `src/app/api/checkout/intent/route.ts`

Refuse with the existing 503 `"unconfigured"` when `isCardPaymentAvailable()` is
false, before the body is read. One shape for every refusal, as now.

### 4. `supabase/sql/0054_stripe_webhook_events.sql`

```
"StripeWebhookEvent"
  id          text primary key      -- Stripe's own evt_… id
  type        text not null
  "orderId"   text null references "Order"(id) on delete set null
  "receivedAt" timestamptz not null default now()
```

- `record_stripe_event(event_id text, event_type text, order_id text)` returns
  `boolean` — `true` when this call inserted the row (first delivery), `false`
  when it was already present. `insert … on conflict (id) do nothing` and report
  from `found`; no read-then-write.
- `security definer`, `set search_path = public`, RLS enabled, **no policy**,
  `revoke all … from public, anon, authenticated` on both table and function —
  matching `"Order"` and every other order-system object.
- Retention note in the header: the table grows one row per event and is safe to
  prune beyond ninety days; a pruning statement is documented, not scheduled.
- File header in the house style: what was wrong, why a table, the trust model.

### 5. `src/app/api/webhooks/stripe/route.ts`

- After `constructEvent` and before dispatch, call `record_stripe_event()`. A
  `false` return means this event has already been handled: log at info and
  return `200 { received: true, duplicate: true }` without dispatching.
- If the ledger call itself errors, **process the event anyway** and log loudly.
  A ledger outage must not stop money being recorded; the per-order guards
  underneath remain the real safety net. Comment this precedence explicitly.
- `handleSucceeded` verifies before settling: read `totalInCents` and
  `paymentStatus` for the order and require `intent.amount === totalInCents` and
  `intent.currency === "egp"`. A mismatch logs an error naming the order and
  both figures, and **does not settle** — 200 so Stripe stops retrying, because
  a redelivery cannot fix a mismatch.
- `payment_intent.canceled` → set `paymentStatus` to `FAILED` where it is not
  already `PAID`, same guard as the failure path. Do not cancel the order or
  restock: the sweeper owns stock release, and duplicating it here risks a
  double restock.
- `payment_intent.processing` → log, and leave the row UNPAID. An asynchronous
  method that has not cleared is not a payment. Present so the outcome is
  handled deliberately rather than by falling through the default branch.
- All four handlers stay `200`-on-handled, per the existing header.

### 6. `.env.example`

Add `STRIPE_PAYMENT_ENABLED=` to the Stripe block in the file's established
voice: what it does, that off is the default, that keys alone are not enough,
that it does not gate the webhook, and blank as every value in that file is.

### 7. `STRIPE-SETUP.md`

Written for an operations team with no access to this conversation and no Claude.
Every section the brief lists, in this order:

1. **What is already built** — the file map above, so nobody rebuilds it.
2. **Stripe account configuration** — business profile, EGP as settlement
   currency, enabling card payments, why `automatic_payment_methods` means the
   dashboard controls the method list.
3. **Environment variables** — all four, with which are secret and which is
   public, and the exact effect of each being absent.
4. **Development setup** — test keys, `stripe listen --forward-to
   localhost:3000/api/webhooks/stripe`, where the `whsec_…` comes from, why the
   development secret differs from production's.
5. **Production setup** — creating the endpoint at
   `https://khemperfumes.com/api/webhooks/stripe`, copying its signing secret,
   setting the variables on Vercel, and the redeploy that inlines
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
6. **Required webhook events, and why each one** —
   `payment_intent.succeeded` (the only event that marks an order paid and sends
   the receipt), `payment_intent.payment_failed`, `payment_intent.canceled`,
   `payment_intent.processing`, `charge.refunded`. State that anything else is
   acknowledged and ignored on purpose.
7. **Testing safely** — `4242…` approval, `4000 0025 0000 3155` for 3-D Secure,
   `4000 0000 0000 9995` for a decline; verifying the order flips to PAID, the
   receipt sends, the sweeper restocks an abandoned card order, and that a
   duplicate delivery produces exactly one email.
8. **Activating in production** — the ordered switch: live keys → live webhook
   secret → `STRIPE_PAYMENT_ENABLED=true` → redeploy → one real low-value order
   → refund it.
9. **Security requirements** — the secret key never leaves the server, the
   `server-only` import is what enforces it, never rename a secret to
   `NEXT_PUBLIC_`, the amount always comes from the `"Order"` row, the browser is
   never believed about payment success, unsigned webhooks are rejected.
10. **Key rotation** — roll the secret key in the dashboard, set the new value,
    redeploy, then revoke the old one (that order, so no request is served with
    no valid key); webhook secrets rotate by adding a second endpoint, cutting
    over, and deleting the first.
11. **Troubleshooting** — the card option not appearing (flag or keys),
    `badSignature` (body re-serialised, or the wrong secret for the environment),
    intents created but orders never paid (endpoint unreachable or unsubscribed),
    `notPayable` 409 (the thirty-minute window closed), duplicate emails, the
    PostgREST schema-cache trap after applying `0054`, and the amount-mismatch
    log line.
12. **Activation checklist** — a single tick-box list ending in a verified live
    payment and its refund.

Voice: the house's own — the prose in `src/actions/checkout.ts` and
`.env.example` is the model. Explain *why*, not only *what*. No marketing, no
emoji, no invented dashboard paths; where a Stripe UI label may have moved, name
what is being looked for rather than a click path.

## Security requirements

- No key, secret, endpoint secret, or account identifier anywhere in the
  repository — placeholders only, and `.env.example` stays blank-valued.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are read only in modules that
  are `server-only` or are route handlers. Nothing new is added to
  `src/lib/stripe/client.ts`.
- The charged amount continues to come from `"Order"."totalInCents"` and never
  from a request body, and is now additionally re-verified at settlement.
- Signature verification stays mandatory; a missing secret remains a 500.
- New SQL objects: RLS on, no policy, grants revoked from `public`, `anon`,
  `authenticated`.
- Logging keeps the module's existing rule — order numbers, event ids, event
  types, amounts, provider error messages. Never a name, email, phone, address,
  note, card detail, or raw webhook body.
- The flag can disable new payments but can never prevent an in-flight payment or
  a refund from being recorded.

## Acceptance criteria

- With no Stripe variables set (today's state): the checkout offers cash only,
  shows the existing unavailable note, cash orders place and email exactly as
  now, and a forged `CARD` POST is refused by the server.
- With keys set but `STRIPE_PAYMENT_ENABLED` unset or false: identical to the
  above. Keys alone activate nothing.
- With keys set and the flag true: the card panel appears, `/api/checkout/intent`
  returns a client secret for a payable order and refuses everything else, and
  the Payment Element mounts in KHEM's styling.
- A `payment_intent.succeeded` whose amount matches settles the order once, sends
  one customer email and one house email; a redelivery of the same event is
  recorded as a duplicate, sends nothing, and answers 200.
- A `succeeded` event whose amount does not match the order settles nothing and
  logs the mismatch.
- Failed, cancelled, processing and refunded events each take their own branch;
  none can un-pay a PAID order.
- `npm run db:migrate` applies `0054` and is safe to run twice.
- `STRIPE-SETUP.md` covers all twelve sections and contains no real credentials.
- Zero `any`, no new ESLint errors, no new dictionary keys.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build          # confirms nothing new breaks the production compile
```

`npm run db:migrate` and `npm run db:verify` are **not** run as part of this
task — they write to the live Supabase project and `0054` should be applied
deliberately, by the user, when they choose. The SQL will be reviewed by reading
rather than by executing, and this limitation will be stated plainly in the
final report rather than glossed over.

## Manual test steps after implementation

**A — the current, unconfigured state (the one that matters most)**

1. `npm run dev` with no Stripe variables in `.env.local`.
2. Add a fragrance to the bag, open `/checkout`. Expect: cash panel only, and
   the "Card payment is temporarily unavailable" note in the card's place.
3. Complete a cash order. Expect: `/checkout/confirmed`, a house notification
   and a customer email, stock decremented, the order visible in `/admin/orders`.
4. From the browser console on `/checkout`, submit the checkout Server Action
   with `paymentMethod: "CARD"` (or `curl -X POST /api/checkout/intent` with any
   order id). Expect: refused, no order written, no intent created.

**B — the flag, without a Stripe account**

5. Set `STRIPE_PAYMENT_ENABLED=true` with the key variables still blank. Restart.
   Expect: no change at all — the card panel stays hidden.

**C — with test keys, once an account exists**

6. Set all three key variables plus the flag; run `stripe listen --forward-to
   localhost:3000/api/webhooks/stripe` and use the `whsec_…` it prints.
7. Reload `/checkout`: the card panel appears. Pay with `4242 4242 4242 4242`,
   any future expiry, any CVC.
8. Expect: the confirmation page, `payment_intent.succeeded` in the `stripe
   listen` output, the order PAID in `/admin/orders`, one customer receipt.
9. `stripe events resend <evt_id>` for that same event. Expect: `200`, the
   `duplicate` log line, and **no second email**.
10. `4000 0000 0000 9995`. Expect: the decline shown in place, the order still
    PROCESSING/UNPAID awaiting a retry, no email.
11. Refund the payment in the Stripe dashboard. Expect: `charge.refunded`, the
    order REFUNDED, stock returned, the refund notice emailed.
12. Place a card order, abandon it, wait thirty minutes (or call the sweep with
    the `CRON_SECRET` bearer). Expect: cancelled and restocked.
13. Set `STRIPE_PAYMENT_ENABLED=false` and restart. Expect: the card panel is
    gone, and a refund issued afterwards in the dashboard still updates the
    order.
