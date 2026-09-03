# Retiring PENDING, forward-only fulfilment, and five smaller fixes

Six requirements (A–F), audited against the shipped code before anything was
written. Two of them turned out to be different problems than the brief assumed;
both are set out below rather than fixed by guesswork.

## Skills read

- `.agents/skills/supabase` — enum alteration, `security definer`, the
  idempotence every file in `supabase/sql/` must have because **every migration
  re-runs on every `npm run db:migrate`**. That fact shapes A more than anything
  else here.
- `.agents/skills/clerk` — `claim_welcome()` is keyed on the Clerk id; grants are
  keyed on the address.
- `ai-sdk` does not apply.

---

## A — Retiring PENDING

### What depends on it today

| Where | What it does |
| :--- | :--- |
| `0015_orders.sql:51,91` | the enum label, and `"Order".status default 'PENDING'` |
| `0042_inventory_channels.sql:429` | `place_order()` writes the opening `PENDING` status event |
| `0016_checkout.sql:113,330` | `expire_unpaid_orders()` sweeps `PENDING` + `UNPAID` + `CARD` |
| `0032_customer_notifications.sql:106` | omits `PENDING` from the customer's status feed |
| `src/app/api/checkout/intent/route.ts:102` | **refuses to mint a payment intent unless the order is `PENDING`** |
| `src/schemas/orders.ts:29,215-216` | the value and two transition rows |
| `src/schemas/db/orders.ts:30`, `src/types/account.ts:17` | the parsed and public unions |
| `src/lib/email/send-order-mail.ts:337` | `mailKindForStatus('PENDING')` → the confirmation letter |
| `src/components/account/OrderTracker.tsx:31` | the customer's four-step journey |
| `src/app/[locale]/admin/orders/page.tsx:39`, `admin/page.tsx:177` | the filter and the dashboard tile's link |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | three labels each — tracker step, status chip, notification line |

The checkout intent guard is the one that must not be got wrong: it is the
reason a card order cannot be re-charged, and it names `PENDING` as the safe
state. It becomes `PROCESSING`, and the guard keeps its other two conditions
(`UNPAID`, `CARD`), which are what actually bound it.

### Decision taken with the user: forbid the label, keep the dead symbol

Postgres cannot drop an enum label that a column or a function signature still
names. `public."OrderStatus"` is named by `set_order_status()`, by the customer
projection in `0024_customers.sql:463`, and by two columns. Dropping the label
means recreating the type and every dependent function — inside a migration that
re-runs from scratch each time, after those functions were created earlier in the
same run. That is where the risk in A lives, and it is all in the last 5%.

**Recommended — forbid it, keep the dead label.**
`0051` migrates every `PENDING` row to `PROCESSING`, changes the column default,
and adds `check (status <> 'PENDING')` to `"Order"` and `"OrderStatusEvent"`.
The database then refuses to store it, no code path can produce it, and nothing
in the state model depends on it. What remains is an unused symbol in `pg_enum`.

**Alternative — the full type swap.** `0051` recreates `public."OrderStatus"`
without the label, which requires dropping and re-declaring `set_order_status()`
and the `0024` projection inside the same file. Genuinely removes the label;
adds a failure mode where a mid-run error leaves the function graph incomplete.

**Chosen: the first.** It satisfies "no workflow depends on `PENDING`" exactly,
and it is the smaller clean change. The label survives only as an unreferenced
symbol in `pg_enum`.

### Changes either way

- `place_order()` re-declared **from its 0042 body** (the current one — 0035 and
  0040 are older) writing `PROCESSING` as the opening event, with the `"Order"`
  default changed to match.
- `expire_unpaid_orders()` sweeps `PROCESSING` + `UNPAID` + `CARD`. The narrowing
  conditions are unchanged, so a cash order still cannot be swept.
- `0032`'s feed omits nothing: with `PENDING` gone, `PROCESSING` is the first
  event, and the confirmation letter already covers it — so the exclusion is
  removed and the feed starts where the order does.
- `mailKindForStatus('PROCESSING')` keeps returning `confirmation`; the `PENDING`
  case is deleted. No template changes: `PENDING` and `PROCESSING` already shared
  `confirmation` copy (`order-copy.ts:28`), so **the letter a customer receives
  is byte-for-byte what it is today** — only its trigger is renamed.
- `OrderTracker`'s journey becomes `PROCESSING → SHIPPED → DELIVERED`; the three
  dictionary entries per language go with it.

## B — The confirmation panel is unreadable

My own regression from the previous task, and the codebase had already written
down why it happens. `globals.css:352` says it in as many words: *"a component
wrote `bg-surface` and inherited `text-ivory` from `body`, which worked only
because every ancestor happened to be dark."*

`OrderStatusControl`'s panel writes `bg-surface/60` — `#1a1a1a` at 60% — and
`text-ground-muted`, which on the admin's ivory ground resolves to `--color-ink-muted`.
Dark ink on a dark panel. **Fix:** drop `bg-surface` entirely and let the panel sit
on the ground it is on, matching the card that contains it
(`bg-ivory/2` in `admin/orders/[orderNumber]/page.tsx:290`): a `bg-ground-bg`
panel with the gold hairline kept, heading in `text-ground-accent`, body in
`text-ground`. Same design, correct on either ground.

## C — Forward-only fulfilment

`TRANSITIONS` currently allows `PROCESSING → PENDING` and `SHIPPED → PROCESSING`.
With `PENDING` gone the table becomes forward-only:

```
PROCESSING → SHIPPED, DELIVERED, CANCELLED
SHIPPED    → DELIVERED, CANCELLED
DELIVERED  → REFUNDED
CANCELLED  → (closed)   REFUNDED → (closed)
```

Enforced twice, as the delivery gate now is: the action refuses with a sentence,
and `set_order_status()` raises `check_violation` on any move that is not forward
— a rank ladder in the function, so `psql` is bound by the same rule. `CANCELLED`
and `REFUNDED` stay reachable from where they are today; the sweeper cancels a
`PROCESSING` order and is unaffected.

## D — Notifications mark themselves read on open

`NotificationBell` (admin) and `NotificationList` (account) both already have a
`markRead` callback and a "Mark as read" button per row. The row's link does not
call it. **Fix:** call `markRead([item])` from the link's `onClick` in both
components and drop the now-redundant per-row button. "Mark all as read" stays —
it is the one action opening cannot replace. Both already `router.refresh()`
after the action, which is what re-syncs the badge, so counts stay correct.

## E — "This code is not available on this account"

**The eligibility logic is correct and is not the bug.** The live data:

| Code | `requiresGrant` | `isWelcome` | grants issued |
| :--- | :--- | :--- | :--- |
| `WELCOME15` | **true** | false | **0** |
| `REFUND890` | **true** | **true** | **0** |
| `KHEM2026`, `SUMMER25` | false | false | n/a |

`discount_grants` is empty across the whole database, and only two things in the
product ever write to it — `claim_welcome()` (0030) and `claim_subscriber_offer()`
(0035) — and **both issue only the single discount flagged `isWelcome`**. So:

- `WELCOME15` is `requiresGrant` with no route to a grant. It is unredeemable by
  construction, for everyone, permanently. `NOT_GRANTED` is the correct answer to
  an impossible code.
- `REFUND890` holds the `isWelcome` flag (there is a trigger,
  `enforce_single_welcome_discount`, permitting only one). A code that reads like
  a refund compensation is currently the house's welcome offer — worth a look;
  it is a data question, not a code one, and I have changed nothing.
- Neither registered account has been welcomed (`"User"."welcomedAt"` is null for
  both), so even the welcome path has issued nothing yet.

The admin screen states the problem and offers no cure — `/admin/discounts/[code]`
prints *"No grants issued. Nobody can redeem this code until one is."* and has no
way to issue one.

**Fix, without weakening anything:** an `issue_discount_grant(code, email, expires)`
`security definer` function and a matching `revokeDiscountGrant`, surfaced as an
"Invite an address" panel on that page. `requireAdmin()` first statement; the
grant is written by the server against a normalised (`lower(btrim(...))`) address;
`resolve_discount()` is **not touched** — an ineligible account is refused by
exactly the code that refuses it today. What changes is that an eligible one can
now exist.

Also: the refusal copy becomes "This code is available by invitation only." in
both languages. Same refusal, same disclosure boundary (`v_public` still gates
every detail), a sentence that tells the customer something true.

## F — The 24-hour letter — I could not find the text

`customerFeedbackEmail()` is the only thing sent 24 hours after an order
(`/api/cron/order-feedback`, `DELAY_HOURS = 24`). It renders intro, item table,
detail, one CTA, signoff — **no payment block and no cash instruction**. The
string you quoted lives in one place only:

- `order-copy.ts:95` — *"Please have {amount} ready for the courier."* — printed by
  `paymentBlock()` in `order-templates.ts:257`, and only when
  `kind === "confirmation" || kind === "shipped"`.

So either the letter you saw was the **shipping notice** for a cash order that
was delivered before it was marked shipped — in which case the fix is to stop
printing the instruction once the order is `DELIVERED`, regardless of `kind` —
or the 24-hour letter should carry the Track Order button it currently lacks (its
CTA is "Explore The Collections", pointing at `/collections`).

**Decision taken with the user: both.** The cash instruction is suppressed on any
order that has reached `DELIVERED`, whichever letter carries it — the condition
becomes a fact about the order rather than about the message — and the 24-hour
letter gets the tracking destination `trackingHref()` already builds for the
delivered message, in place of its "Explore The Collections" CTA.

## Files expected to change

`supabase/sql/0051_retire_pending.sql` (new) · `src/schemas/orders.ts` ·
`src/schemas/db/orders.ts` · `src/types/account.ts` ·
`src/actions/admin/orders.ts` · `src/components/admin/OrderStatusControl.tsx` ·
`src/components/admin/NotificationBell.tsx` ·
`src/components/account/NotificationList.tsx` ·
`src/components/account/OrderTracker.tsx` ·
`src/app/api/checkout/intent/route.ts` ·
`src/app/[locale]/admin/orders/page.tsx` · `src/app/[locale]/admin/page.tsx` ·
`src/lib/email/send-order-mail.ts` · `src/lib/i18n/dictionaries/{en,ar}.ts` ·
`src/app/[locale]/admin/discounts/[code]/page.tsx` ·
`src/actions/admin/discounts.ts` · `src/services/admin/discounts.ts` ·
plus `src/components/admin/DiscountGrantForm.tsx` (new) and F's target once named.

## Security requirements

- `requireAdmin()` first statement of every new admin action; the grant action
  records nothing the caller sends but the address, normalised server-side.
- `issue_discount_grant()` is `security definer`, `search_path` pinned, revoked
  from `public`, `anon`, `authenticated`.
- `resolve_discount()` and its refusal ladder are unchanged. No new code path can
  make an ungranted account eligible.
- The forward-only rule and the existing payment/delivery rules are enforced in
  the database, not only in the action.

## Acceptance criteria

1. No row in `"Order"` or `"OrderStatusEvent"` is `PENDING`, and the database
   refuses a new one.
2. A new order — storefront cash, storefront card, and desk — starts `PROCESSING`.
3. A card order still mints its payment intent and still gets swept when unpaid.
4. The confirmation email is unchanged in content and still sent once, on placement.
5. `PROCESSING → SHIPPED → DELIVERED` works; `SHIPPED → PROCESSING` is refused in
   the UI, the action and the database.
6. `DELIVERED` still requires `PAID`; `PAID` is still one-way; credits still issue,
   activate and cancel as they did — the previous task's 27 checks still pass.
7. The confirmation panel's text is legible on the admin ground.
8. Opening a notification marks it read and the badge decrements without a reload.
9. An admin can issue a grant for `WELCOME15`; that address then redeems it; a
   different address is still refused `NOT_GRANTED`; a used grant is refused
   `ALREADY_USED`.
10. F's letter no longer asks a customer who has their parcel to prepare cash.

## Checks to run

- `npx tsc --noEmit`, `npm run lint`, `npm run build`
- `npm run db:migrate` twice, `npm run db:verify`
- The previous task's payment/credit harness, re-run unchanged.
- A new scripted end-to-end for A, C and E against the live database, creating and
  deleting its own orders, grants and redemptions.

## Manual test steps

Given at delivery as exact clicks, covering: placing an order and seeing
`PROCESSING`; the refused backward move; the grant issued and redeemed at
checkout by the invited address and refused for another; and the notification
badge decrementing on open.
