# Campaigns — the Customers audience must reach everyone who has bought

## Goal

A customer who has placed an order and left an email address must be reachable
by a campaign, whether or not they ever ticked a marketing box. Today the
Customers toggle on `/admin/campaigns/[id]` reports **0 addresses** with three
buyers in the directory, and there is no path by which that number can ever
become non-zero for a person who bought once and never opened their account
settings.

## Skills read

- `.agents/skills/supabase` — schema, migrations, service-role usage, PostgREST
  schema cache reload after DDL.
- No Clerk or AI SDK work in this task; those skills were not needed.

## Existing code inspected

- `supabase/sql/0036_campaign_audiences.sql` — `campaign_audience()`,
  `campaign_audience_breakdown()`, `email_suppressions`, `campaign_sends`
  re-keyed on `(campaignId, email)`, `unsubscribe_by_campaign_token()`.
- `supabase/sql/0024_customers.sql` — the `customer_directory` view and its
  keying rules.
- `supabase/sql/0032_customer_notifications.sql` — where `marketingOptIn` moves.
- `src/actions/admin/campaigns.ts` — `setCampaignAudience`, and the doc comment
  above it that states the consent rule.
- `src/components/admin/CampaignDispatch.tsx` — the Audience section copy and
  the two `AdminToggle`s.
- `src/app/[locale]/admin/campaigns/[id]/page.tsx`, `src/services/admin/campaigns.ts`,
  `src/services/admin/campaign-dispatch.ts`, `src/types/campaign.ts`,
  `src/schemas/campaigns.ts`, `src/schemas/db/campaigns.ts`.

## The diagnosis, stated once

`campaign_audience()` selects customers as:

```sql
from public.customer_directory d, campaign c
where c."toCustomers"
  and d."marketingOptIn"
  and d.email is not null
  and coalesce((select s.locale from "NewsletterSubscriber" s
                 where lower(s.email) = d.email limit 1), 'en') = c.locale
```

Two predicates each independently reduce the live audience to zero:

1. **`d."marketingOptIn"`.** The view computes it as
   `coalesce(a."marketingOptIn", false)` from the `"User"` row. It is written in
   exactly two places — the sign-up checkbox (`SignUpForm.tsx`) and the account
   profile toggle (`MarketingPreference.tsx`). **Checkout never asks.** A guest
   or a walk-in has no `"User"` row at all, so the value is `false` by
   construction. Verified against the live database: 3 customers, 3 buyers, **0
   opted in**.
2. **The locale predicate.** A customer who is not on the newsletter list is
   assumed to speak English. An Arabic campaign therefore reaches no customers
   at all, ever, regardless of consent.

## Decision

Owner's call, taken 2026-09-04: **soft opt-in.** The Customers audience is every
person in `customer_directory` who has an email address. Consent is no longer a
condition of membership; the unsubscribe link and `email_suppressions` are what
carry the refusal, and they already work for `CUSTOMER`-kind sends —
`campaign_sends` is keyed by address with its own `unsubscribeToken`, and
`unsubscribe_by_campaign_token()` writes a suppression that `campaign_audience()`
subtracts from every source.

Walk-in rows with no email stay out; there is nothing to send to. No warning UI
was asked for.

## Assumptions

- Customers whose only orders are CANCELLED or REFUNDED are still customers and
  stay in the audience. `customer_directory` already includes them (the status
  filter applies to lifetime spend, not to membership) and this change does not
  touch that.
- `marketingOptIn` keeps its current meaning everywhere else — the customers
  list, the customer detail screen, the account profile toggle. It stops being a
  *send* condition; it does not stop being a recorded preference.

## Files likely to change

- `supabase/sql/0055_campaign_customer_audience.sql` — **new.** Rewrites
  `public.customer_directory` to expose a `locale`, and rewrites
  `public.campaign_audience()`. `campaign_audience_breakdown()` needs no change;
  it reads the function.
- `src/components/admin/CampaignDispatch.tsx` — Audience section copy.
- `src/actions/admin/campaigns.ts` — the doc comment above `setCampaignAudience`
  that asserts the old rule.
- `src/types/customer.ts`, `src/schemas/db/customers.ts` — only if the new
  `locale` column is selected by the customers services; prefer **not** to add
  it to the directory's select lists, so the app-facing shape is unchanged.

## Implementation requirements

### 1. `customer_directory` gains a locale

Add one column to the view, after `"marketingOptInAt"`:

- the locale of the customer's **most recent order** (`"Order".locale`, carried
  through `order_customer`/`order_rollup` as
  `(array_agg(k.locale order by k.placed_at desc))[1]`),
- falling back to `'en'`.

Reason it belongs in the view and not in `campaign_audience()`: the directory is
already the one place that reconciles a person's orders into a person, and the
audience query should not re-derive that join. Keep the column named `locale`.

Re-create the view with `create or replace view` where possible. **A view cannot
gain a column in the middle of its select list via `create or replace`** — append
the new column at the end of the select list, or `drop view ... cascade` and
re-create along with the dependents `customer_search` / whatever 0024 declares on
top of it. Read 0024 in full before choosing; if a drop is required, re-create
every dependent object in the same file and in the same transaction, and re-issue
the grants and `revoke all ... from public, anon, authenticated` at the end
exactly as 0024 does.

### 2. `campaign_audience()` — the customers CTE

```sql
customers as (
  select d.email, null::text as subscriber_id,
         'CUSTOMER'::public."CampaignRecipientKind" as kind, 2 as rank
    from public.customer_directory d, campaign c
   where c."toCustomers"
     and d.email is not null
     and coalesce(
           (select s.locale from public."NewsletterSubscriber" s
             where lower(s.email) = d.email limit 1),
           d.locale
         ) = c.locale
)
```

- The `d."marketingOptIn"` predicate is **removed**.
- The locale fallback becomes the customer's own order locale rather than a flat
  `'en'`. A subscriber row still wins, because a stated list preference beats an
  inferred one.
- Everything else — the suppression `not exists`, the `distinct on (e.email)`
  with `order by e.email, e.rank`, the rank ordering subscriber → customer →
  specific — is unchanged. Dedup stays the primary key's job.

Rewrite the whole function with `create or replace function`, preserving
`language sql stable security definer set search_path = public` and the existing
`revoke all on function ... from public, anon, authenticated`.

### 3. Comments in the SQL file

Follow the house style of `supabase/sql/`: the file explains **why** the consent
predicate came off and what now carries the refusal, so that a future reader does
not "restore" the filter as a bug fix. State plainly that unsubscribe and
`email_suppressions` are the consent mechanism for this audience, and that
`marketingOptIn` remains a recorded preference shown in the admin.

### 4. Admin copy

`CampaignDispatch.tsx`, Audience section:

- Section paragraph: replace "…and a customer who never ticked the marketing box
  is never in the second one." with wording that says the second list is everyone
  who has ordered and left an address, and that anybody who unsubscribes is left
  out of both permanently.
- Customers toggle description: replace "Customers who agreed to hear from the
  house" with something like "Everyone who has ordered and left an address" —
  keep the existing `— ${audience.customers} address/addresses not already
  counted above.` suffix and its singular/plural logic verbatim.

Typography, spacing, tokens: unchanged. No new components, no layout change.

### 5. Action doc comment

`setCampaignAudience` in `src/actions/admin/campaigns.ts` — the paragraph
beginning "Two booleans, and neither of them is who: **consent is not decided
here.**" is now wrong in its second sentence. Rewrite it to say the Customers
audience is every customer with an address, and that the suppression list is
still subtracted from every source in `campaign_audience()` where no form can
reach it. The claim about editable-campaigns-only stays.

## Security requirements

- No change to the trust model. RLS stays on, no policies added, `execute` stays
  revoked from `public`, `anon`, `authenticated` on every function touched, and
  `revoke all on public.customer_directory from public, anon, authenticated`
  must survive any drop/re-create.
- `security definer` + `set search_path = public` preserved on both functions.
- The audience is still only reachable through service-role calls made by
  admin-guarded Server Actions. `requireAdmin()` in `setCampaignAudience` is
  untouched.
- Every letter continues to carry a working per-address unsubscribe token.
  Do not weaken, bypass, or make optional the `email_suppressions` subtraction —
  it is now the only thing standing between a customer and a letter they have
  refused.

## Acceptance criteria

- With `toCustomers` on, an `en` campaign's breakdown counts every
  `customer_directory` row that has an email and whose resolved locale is `en`,
  minus suppressions, minus anyone already claimed as a subscriber.
- Against the current data that number is **2**, not 0 (the two rows with an
  email; the third has none).
- An `ar` campaign resolves customer locale from the most recent order, so an
  Arabic-speaking buyer who is not a subscriber is reachable.
- A suppressed address is in no audience, from any source, including a
  hand-typed one.
- `campaign_audience_breakdown()` total equals the row count of
  `campaign_audience()` — the confirmation figure and the send are one query.
- The customers admin screens still render `marketingOptIn` as before; nothing
  about the account profile toggle changes.
- `npx tsc --noEmit` clean, `npm run lint` clean, zero `any`.

## Checks to run

```
npm run db:migrate      # must print "PostgREST schema cache reload signalled"
npm run db:verify
npx tsc --noEmit
npm run lint
```

`db:migrate` runs `supabase/sql/*.sql` in filename order inside one transaction;
do not apply this SQL through the Supabase editor or `psql`, or the PostgREST
cache will serve a stale schema and the page will silently render a fallback.

## Manual test steps

1. `npm run db:migrate`, confirm the schema-cache line, then `npm run dev`.
2. Open `/admin/campaigns/<draft id>` (currently
   `c0279a71-643d-4971-b36d-03d114830fb8`).
3. The Audience section reads **Customers — 2 addresses not already counted
   above**. Subscribers still reads 0, correctly: the only `en` subscriber is
   `UNSUBSCRIBED`.
4. Toggle Customers off, Save audience — the Sending panel says it will write to
   0 addresses. Toggle back on, Save — it says 2, and the red "save the change
   above before sending" warning clears once saved.
5. Send the campaign to a test draft. Both `khem.official@outlook.com` and
   `m_hassaan1@outlook.com` receive one letter each, `recipientKind = 'CUSTOMER'`,
   each with a distinct unsubscribe link.
6. Follow one unsubscribe link. Confirm a row lands in `email_suppressions`, and
   that a new draft campaign with Customers on now counts **1**.
7. Confirm the unsubscribed customer's account profile still shows their own
   stated preference — the suppression stops the sending side, it does not
   rewrite what they told us.
8. Create an `ar` campaign with Customers on and confirm the count follows the
   most recent order's locale rather than being flatly 0.
