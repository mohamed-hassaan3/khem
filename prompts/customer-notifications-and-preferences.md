# Customer Notifications & Marketing Preferences (Priority 5)

## Goal

Deliver **Priority 5** of `src/docs/customer-experience.md` §10, §16 and §19:

1. **Customer notifications** — the `/account/notifications` placeholder becomes
   real: order progress, credits earned, vouchers granted, each with read state.
2. **Marketing preferences** — the `/account/preferences` placeholder becomes a
   working consent switch, and unsubscribing is possible from inside the account
   rather than only from a link in a letter.

Priority 6 (campaign management) is not started.

## Skills read

- `AGENTS.md` §1–2, §3, §8 (`/account/*` is protected and dynamic), §11–12.
- `src/docs/customer-experience.md` §10 (marketing preferences), §16 (customer
  notifications — *"optional and non-intrusive"*), §19 Priority 5, §20.

## Existing code inspected

**The consent pipeline already exists, end to end.** This is the single most
important finding, and the phase is mostly about giving it a surface:

- `supabase/sql/0025_newsletter.sql` — `"NewsletterSubscriber"` with a random
  `unsubscribeToken`, `consentAt`/`unsubscribedAt` as a pair that "never
  describes two states at once", and `subscribe_newsletter()` /
  `unsubscribe_newsletter()`, both idempotent.
- `supabase/sql/0024_customers.sql` — `"User"."marketingOptIn"` and
  `"marketingOptInAt"`, written by `sync_clerk_user()` and moved "only when the
  flag actually changes, so editing a surname does not silently restamp a
  consent date".
- `src/services/newsletter.ts` — `subscribe()`, `unsubscribeByToken()`,
  `unsubscribeByClerkUser()`.
- `src/app/api/webhooks/clerk/route.ts` — already reconciles the list against
  the flag on every `user.created`/`user.updated`, with the comment explaining
  why: otherwise the flag and the list "are two records of the same consent that
  drift apart".
- `src/components/auth/SignUpForm.tsx` — writes `marketingOptIn` (and now
  `locale`) into Clerk's `unsafeMetadata` at sign-up.
- `src/app/[locale]/unsubscribe/` + `src/actions/unsubscribe.ts` — the
  token-authorised withdrawal, working today.

**The two placeholder panels** — `src/app/[locale]/account/notifications/page.tsx`
and `preferences/page.tsx`, written in Priority 1 with honest empty states and
headers that say a query lands here later. This is that later.

**The notification sources**, all already keyed to a customer:
- `"OrderStatusEvent"` (0017) — one row per station an order reached, joined to
  `"Order"."clerkUserId"`.
- `customer_credits` (0026) — `clerkUserId`, `earnedAt`, `amountInCents`.
- `discount_grants` (0028) — matched by `clerkUserId` **or** lowercased email,
  exactly as `src/services/vouchers.ts` already does.

**The admin precedent from Priority 4** — `0031_admin_notifications.sql`: a
derived feed plus a reads table holding nothing but `(kind, entityId)`. The
customer feed follows the same shape, keyed additionally by owner.

## Decisions and assumptions

1. **No bell on the storefront.** §16 says the customer notification experience
   "should remain optional and non-intrusive", and a badge in the header of a
   perfume boutique is neither. Notifications live in the account dashboard,
   where the rail already has a Notifications entry, and the rail may carry a
   quiet unread count. Nothing appears over the shop.
2. **The feed is derived; only read-state is stored.** Same argument as `0031`,
   `0028` and `0026`: an order's progress is already recorded by
   `"OrderStatusEvent"`, and a notification row per station would be a second
   record of it. A `customer_notification_reads` table keyed by
   `(clerkUserId, kind, entityId)` and nothing else.
3. **A customer sees only their own.** The owner is a parameter of the query, and
   it comes from `getViewer()` — never a route param, never a form field. Same
   rule and same reason as every other read under `/account`.
4. **Consent has one source of truth and two mirrors, and the action writes all
   three.** Clerk's `unsafeMetadata.marketingOptIn` is where the customer's
   choice lives (it is what sign-up writes, and what the webhook reads).
   `"User"."marketingOptIn"` and `"NewsletterSubscriber"` are mirrors of it.
   The preferences action updates Clerk **and** reconciles both mirrors in the
   same request, rather than writing to Clerk and waiting for the webhook —
   because a preference that appears not to have saved until a webhook arrives is
   a preference the customer will toggle twice. The webhook stays exactly as it
   is: idempotent, and still the backstop for changes made anywhere else.
5. **Unsubscribing from the account does not consume the token.** The token
   remains the credential for somebody reading a letter; the account route is
   authorised by the session instead. Both end at `unsubscribe_newsletter()`.
6. **Transactional mail is untouched.** Turning marketing off must not stop an
   order confirmation, a welcome, or a shipping note — §9.1, and already how the
   senders are built. Nothing in this phase reads the flag.
7. **A new SQL function for the flag, rather than a hand-written update.**
   `set_marketing_opt_in()` keeps 0024's rule — `marketingOptInAt` moves only
   when the value actually changes — in the same place the rule was written.

## Files likely to change

**New**
- `supabase/sql/0032_customer_notifications.sql` — `customer_notification_reads`,
  `customer_notification_feed(owner, email, max_items)`,
  `mark_customer_notifications_read()`, `set_marketing_opt_in()`.
- `src/services/notifications.ts` — the customer's feed (server-only).
- `src/actions/notifications.ts` — mark read / mark all read, session-scoped.
- `src/actions/preferences.ts` — set marketing consent.
- `src/components/account/NotificationList.tsx`, `NotificationRow.tsx`.
- `src/components/account/MarketingPreference.tsx` — the switch.
- `src/types/notification.ts` — extended with the customer shapes.
- `src/schemas/db/customer-notifications.ts`, `src/schemas/preferences.ts`.

**Modified**
- `src/app/[locale]/account/notifications/page.tsx` — the real panel.
- `src/app/[locale]/account/preferences/page.tsx` — the real panel.
- `src/components/account/AccountSidebar.tsx` — optional unread count.
- `src/lib/i18n/dictionaries/en.ts` + `ar.ts` — both panels' copy, replacing the
  placeholder keys.

## Implementation requirements

**The feed** — newest first, capped at 50, each item carrying `kind`,
`entityId`, a label, a detail line, an amount where money is involved, a
timestamp, and read state. Kinds:
- `ORDER_STATUS` — one per station reached, so "Your order is on its way" is a
  notification and the order having been *placed* is not repeated at every step.
- `CREDIT_EARNED` — a Discovery Credit, with its amount.
- `VOUCHER_GRANTED` — a privilege addressed to them, with its code.

**What a notification may say**: the customer's own order number, their own
voucher code, their own amounts. Nothing about anybody else, and no email
address in the body — they know their own.

**Marking read**: one, or all fifty on screen, through a session-scoped action.
`on conflict do nothing`, so a second click does not move the timestamp.

**The preference switch**: a labelled toggle, its current state read on the
server, saved through an action that reports success or failure. It says plainly
what it governs — private offers and new arrivals — and states that order and
account letters arrive regardless. Turning it off is an unsubscribe; turning it
on is a fresh act of consent and moves `consentAt`.

**Both panels** keep the existing gate, `force-dynamic`, and
`robots: { index: false, follow: false }`, exactly as their neighbours.

## Security requirements

- Every read and write is scoped by the Clerk id from `getViewer()` / `auth()`.
  `0025`, `0026`, `0028` and the new table grant the public roles nothing, so
  that filter *is* the access control.
- The preferences action takes a **boolean and nothing else** — no email, no
  user id, no token. A schema that accepted an address would be one that lets a
  signed-in customer unsubscribe somebody else.
- Marking read takes `(kind, entityId)` pairs, and the owner is added
  server-side; a forged pair can at worst write a read row for something not in
  that customer's feed.
- No PII in any log line, unchanged from every other module.
- `execute` revoked from the public roles on every new function; RLS on with no
  policy on the new table.

## Acceptance criteria

- [ ] `/account/notifications` lists the customer's own order progress, credits
      and vouchers, newest first, and nobody else's.
- [ ] Marking one, and marking all, persist across a reload.
- [ ] An account with no history sees the composed empty state, not a blank.
- [ ] `/account/preferences` shows the current consent state and saves a change.
- [ ] Turning marketing off leaves the address on the list as UNSUBSCRIBED —
      never deleted — and turning it back on reactivates it with a fresh
      `consentAt`.
- [ ] `"User"."marketingOptIn"`, Clerk's metadata and the subscriber row all
      agree immediately after a change, without waiting for a webhook.
- [ ] A subsequent `user.updated` webhook changes nothing (it is idempotent).
- [ ] Order confirmation and welcome letters still send with marketing off.
- [ ] Both panels work in Arabic and at 320px.
- [ ] `npm run db:migrate`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Manual test steps

1. `npm run db:migrate`, `npm run dev`, sign in as an account with orders.
2. `/account/notifications` → the order's stations, any credits, any vouchers.
3. Mark one read → it dims. Reload → still read.
4. Mark all as read → the count clears. Reload → still clear.
5. `/account/preferences` → toggle marketing **off** → success.
6. Check the database: `"User"."marketingOptIn"` false, subscriber row
   `UNSUBSCRIBED` with `unsubscribedAt` set, Clerk metadata false.
7. Toggle back **on** → subscriber `SUBSCRIBED`, `consentAt` moved,
   `unsubscribedAt` cleared.
8. Place a cash order → the confirmation still arrives with marketing off.
9. Repeat 2–7 under `/ar/account/…`.
10. Sign in as a second account → its notifications show only its own rows.

## Open questions for the user

1. **Unread count in the account rail** (decision 1). I propose a quiet numeral
   beside "Notifications" and nothing anywhere else on the storefront. Say if you
   would rather it were entirely silent.
2. **Order-status notifications are per station.** An order that reaches
   PROCESSING, SHIPPED and DELIVERED produces three. The alternative is one
   notification per order that updates in place, which loses the history. I
   recommend per station.
3. **Marketing copy.** I will write the switch's label and explanation in the
   house register — "news, private offers and new arrivals" — matching the
   Inner Circle wording already in the footer. Tell me if the wording is settled
   elsewhere and I should match it exactly.
