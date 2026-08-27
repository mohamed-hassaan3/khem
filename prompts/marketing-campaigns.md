# Marketing Campaigns (Priority 6)

## Goal

Deliver **Priority 6** of `src/docs/customer-experience.md` §11 and §19: an
admin-managed campaign system — compose a branded letter, attach a voucher,
choose when it goes, and send it to the Inner Circle — in two stages:

**Stage 1 — compose and prove.** Campaign records, the editor, a live preview,
the audience count, and a **test send to the desk**. Nothing reaches a customer.

**Stage 2 — dispatch.** Sending to the list, once per recipient, with scheduling.

Stage 1 is delivered and verified before Stage 2 begins.

## Skills read

- `AGENTS.md` §1–2, §3, §6 (Resend), §11–12.
- `src/docs/customer-experience.md` §9.2 (marketing mail), §11 (campaigns),
  §19 Priority 6, §20.
- **The installed Resend SDK**, read from `node_modules/resend/dist/index.d.mts`
  rather than from memory. Three facts it settled, all load-bearing below:
  `resend.batch.send()` exists; every request accepts an `idempotencyKey`;
  and **the batch API does not support attachments**.

## Existing code inspected

**The list, and its consent record**
- `supabase/sql/0025_newsletter.sql` — `"NewsletterSubscriber"`, one row per
  address, `status`, `locale`, a random `unsubscribeToken` per row, and
  `newsletter_list()` for the dashboard. Withdrawal flips the status and keeps
  the row.
- `src/services/newsletter.ts`, `src/services/admin/newsletter.ts`,
  `/admin/newsletter` — the list already has a screen.
- Priority 5's `/account/preferences` — the customer's own switch, and
  `src/actions/preferences.ts`, which keeps Clerk, `"User"` and the list in step.

**The letter kit**
- `src/lib/email/layout.ts` — `luxuryShell`, `ctaButton`, `paragraph`,
  `mutedParagraph`, `mutedLink`, `signoff`, `spacer`, `signatureBlock`.
- `src/lib/email/welcome-templates.ts` — the gold voucher frame, built for the
  welcome letter and exactly what a discount campaign needs.
- `src/lib/email/copy.ts` — the newsletter welcome, including its `unsubscribe`
  and `unsubscribeLink` lines and how a token becomes an anchor.
- `src/lib/email/logo.ts` — `logoAttachment()` / `logoSrc()`, and the note that
  `logoSrc(null)` falls back to an absolute URL.

**Delivery and scheduling**
- `vercel.json` — three crons, each **once a day**. `src/actions/checkout.ts`
  records why: the plan permits no finer schedule, which is why its sweep also
  runs inline on checkout.
- `src/app/api/cron/*` — the shape a cron route takes here, `CRON_SECRET` and all.

**The discount engine** — `discounts` rows and `resolve_discount()`, so a
campaign's voucher code can be a real one rather than a string in a template.

## Decisions and assumptions

1. **The audience stays ours; Resend Broadcasts is not used.** The SDK also
   offers `resend.broadcasts` with audiences held at Resend. Adopting it would
   put the consent record in two places — `"NewsletterSubscriber"` and Resend —
   and `0025`'s header is explicit that a withdrawal must be one fact in one
   place. So campaigns send over our own list, through `batch.send()`.
2. **One letter per recipient, not one letter to many.** Every campaign email
   carries that subscriber's own unsubscribe link, built from their row's token.
   That is what makes the letter lawful and what makes withdrawal work; it also
   means the recipient list is never in a `To:` header.
3. **Delivery is claimed per recipient, before it is attempted.** A
   `campaign_sends` row with `unique (campaignId, subscriberId)`, written first.
   A retry — a crashed dispatch, a re-run cron, a double-clicked button — finds
   the row and sends nothing. This is the same claim discipline as
   `claim_welcome()` and `issue_discovery_credits()`, and it is the only thing
   standing between a bug and mailing the house's customers twice.
4. **`idempotencyKey` per chunk, as a second belt.** Derived from the campaign id
   and the chunk index, so even a retry that got past the claim cannot duplicate
   at Resend's end.
5. **Campaign mail carries no inline logo.** The batch API refuses attachments,
   so the signature's mark comes from `logoSrc(null)` — the absolute URL fallback
   that already exists for exactly this. Stated here because it is a real
   difference from every other letter the house sends.
6. **A campaign names a locale, and goes only to that locale's subscribers.**
   `0025` stores `locale` per subscriber and says why: "a letter in the wrong
   language is a letter nobody reads". Two campaigns, two audiences, no
   translation guesswork at send time.
7. **A voucher on a campaign is a real `discounts` row.** The editor takes a
   code, and it is validated against the table when the campaign is saved *and*
   again at dispatch — §7.2's lesson from the welcome letter, which the plan
   states as a general rule: never hard-code a voucher into a template.
8. **Scheduling is honest about its granularity.** A daily cron dispatches
   anything due. A campaign scheduled for 14:00 goes out at the next cron run,
   not at 14:00, and **the editor says so** rather than implying a precision the
   plan cannot buy. "Send now" exists for when the moment matters.
9. **Audience targeting is deferred**, as §19 itself defers it. The audience is
   "subscribed, in this locale". No segments in this phase.
10. **Marketing only.** Nothing in this phase can send to an unsubscribed
    address, and nothing in it touches a transactional sender.

## Files likely to change

### Stage 1
**New**
- `supabase/sql/0033_campaigns.sql` — `campaigns`, `campaign_sends`,
  `campaign_audience_count()`, and the status enum.
- `src/types/campaign.ts`, `src/schemas/campaigns.ts`, `src/schemas/db/campaigns.ts`.
- `src/services/admin/campaigns.ts` — list, read, audience count.
- `src/actions/admin/campaigns.ts` — create, update, delete, **send test**.
- `src/lib/email/campaign-copy.ts`, `src/lib/email/campaign-template.ts`.
- `src/lib/email/send-campaign-mail.ts` — the test send only, in this stage.
- `src/app/[locale]/admin/campaigns/page.tsx`, `new/page.tsx`, `[id]/page.tsx`.
- `src/components/admin/CampaignForm.tsx`, `CampaignPreview.tsx`.

**Modified**
- `src/components/admin/AdminShell.tsx` — a Campaigns entry in the rail.

### Stage 2
**New**
- `src/app/api/cron/send-campaigns/route.ts` — the daily dispatch.
- `src/services/admin/campaign-dispatch.ts` — claim, chunk, send, record.

**Modified**
- `vercel.json` — a fourth daily cron.
- `src/actions/admin/campaigns.ts` — schedule, send now, cancel.

## Implementation requirements

### The record
Per §11.1: name, type (`NEW_ARRIVAL` / `DISCOUNT` / `NEW_COLLECTION` /
`EXCLUSIVE_OFFER` / `SEASONAL` / `CUSTOM`), subject, preview text, body, hero
image URL and alt, CTA label, CTA destination, optional voucher code, locale,
`scheduledAt`, and status (`DRAFT`, `SCHEDULED`, `SENDING`, `SENT`, `CANCELLED`).

A campaign is editable only while `DRAFT` or `SCHEDULED`. Once it is `SENDING` or
`SENT` it is a record of what went out, and editing it would make the archive
describe a letter nobody received.

### The letter
Built from `luxuryShell` with the same register as every other KHEM email: hero
image, headline, body, the gold voucher frame when a code is attached, one CTA,
and the unsubscribe line at the foot carrying that recipient's token. Plain-text
alternative always. Every interpolated value escaped — the body is
**admin-authored**, which makes it trusted prose, and the comment must say so.

### Test send
To the signed-in administrator's own verified address, and nowhere else. It is
the only send in Stage 1, and it is what makes "does this look right?" answerable
without risking the list.

### Dispatch (Stage 2)
- Claim rows for the whole audience in one statement, then send in chunks of
  100 — Resend's documented batch limit.
- `batchValidation: 'permissive'`, so one bad address does not fail 99 good ones;
  the per-index errors are recorded against their `campaign_sends` rows.
- The campaign moves to `SENDING` before the first chunk and `SENT` after the
  last, so a crash mid-dispatch is visible rather than silently half-done.
- The cron route is guarded by `CRON_SECRET` exactly as its three neighbours.

## Security requirements

- Every campaign read and write is behind `requireAdmin()`; the cron route is
  behind `CRON_SECRET` and takes no input.
- The audience query selects `status = 'SUBSCRIBED'` and the campaign's locale,
  and nothing else can widen it — there is no "send to everyone" parameter.
- Unsubscribe tokens are used to build one link per letter and are **never**
  logged, never rendered in the dashboard, and never returned to the browser.
- Logs carry a campaign id and counts. Never an address.
- New tables: RLS on, no policy, no grant to the public roles, `execute` revoked
  on every function.
- The hero image is a URL the admin supplies; it is escaped into the letter and
  never fetched or proxied by us.

## Acceptance criteria

### Stage 1
- [ ] A campaign can be created, edited, and deleted while draft.
- [ ] The editor shows the audience size for its locale before anything is sent.
- [ ] The preview renders the exact letter, including the voucher frame.
- [ ] A test send reaches the administrator's own address and nobody else.
- [ ] An invalid or inactive voucher code is refused at save with a clear reason.
- [ ] A sent campaign cannot be edited.

### Stage 2
- [ ] "Send now" delivers to every subscribed address in that locale, once.
- [ ] Running the dispatch twice sends nothing the second time.
- [ ] Each letter's unsubscribe link works and withdraws that address only.
- [ ] A scheduled campaign goes out on the next cron run after its time.
- [ ] An unsubscribed address receives nothing.
- [ ] `npm run db:migrate`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Manual test steps (Stage 1)

1. `npm run db:migrate`, `npm run dev`, open `/admin/campaigns`.
2. Create a campaign: type Exclusive Offer, English, subject, body, CTA.
3. Confirm the audience count matches `/admin/newsletter` filtered to subscribed.
4. Attach `WELCOME15` → saves. Attach `NOPE` → refused, with the reason.
5. Open the preview → the letter renders with the gold voucher frame.
6. Send a test → it arrives at your own address. Check the unsubscribe line is
   present and the mark renders from its URL (no attachment).
7. Confirm a `SENT` campaign's fields are read-only.

## Open questions for the user

1. **Stage 1 first?** That is how this is written and what I recommend: the
   composer and the test send are useful on their own, and dispatch is the half
   that can go wrong in front of customers.
2. **Scheduling granularity.** Daily, from a cron, for the reason
   `src/actions/checkout.ts` already documents. If campaigns need to go out at a
   named hour, that is a Vercel plan change rather than a code change — tell me
   and I will wire the finer schedule instead.
3. **Body format.** I propose plain paragraphs — the editor writes text, blank
   lines separate paragraphs, and the template styles them. The alternative is
   accepting HTML from the editor, which I would rather not: it is an injection
   surface, and it makes every letter's typography somebody's improvisation.
4. **Who a campaign is from.** `houseFromAddress()`, like the welcome letter,
   with replies going to the house inbox. Say if campaigns should come from a
   different sender.
