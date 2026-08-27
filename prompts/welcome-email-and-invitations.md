# Welcome Email, Welcome Voucher & Invitations (Priority 3)

## Goal

Deliver **Priority 3** of `src/docs/customer-experience.md` §7–9: a branded welcome
letter sent once when an account becomes real, carrying a voucher code that is
actually valid because the grant behind it was written in the same transaction
that claimed the right to send the letter — plus an admin invitation flow whose
invitation email is KHEM's, not a third party's.

## Skills read

- `AGENTS.md` §1–2, §6 (Resend + React Email row, and what this repo does instead),
  §10 (Clerk), §11–12.
- `src/docs/customer-experience.md` §7 (welcome email), §8 (invited user),
  §9 (transactional vs marketing), §19 Priority 3, §20.
- `.agents/skills/clerk` → `clerk-backend-api`. The invitation endpoint was read
  from the **live spec** (`bapi/2026-05-12.yml`) and cross-checked against the
  installed SDK types in `node_modules/@clerk/backend/dist/api/endpoints/InvitationApi.d.ts`.
  Confirmed: `notify`, `redirectUrl`, `publicMetadata`, `expiresInDays`,
  `ignoreExisting`, and an `Invitation.url` on the response.

## Existing code inspected

**Already built — Priority 3 items 1, 2 and 7 are done**
- `src/lib/email/client.ts` — lazy Resend client, `isEmailConfigured()`, fails closed.
- `src/lib/email/layout.ts` — `luxuryShell`, `ctaButton`, `paragraph`, `signoff`,
  `spacer`, `markedList`: the house's dark/gold email kit.
- `src/lib/email/copy.ts` — per-locale prose, typed `Record<Locale, …>` so a missing
  translation is a compile error. Already holds an unrelated `WELCOME_COPY` for the
  **newsletter** ("Inner Circle"); the account welcome is a different letter and
  needs a different name.
- `src/lib/email/escape.ts`, `headers.ts`, `addresses.ts`, `logo.ts`.
- `src/lib/email/order-templates.ts` + `send-order-mail.ts` — order confirmation
  infrastructure, already sending on both the cash and webhook paths. §19's
  "prepare order confirmation email infrastructure" is **already true**; nothing
  in this phase touches it.
- `src/lib/email/rate-limit.ts`.

**The trigger point**
- `src/app/api/webhooks/clerk/route.ts` — signature-verified, idempotent,
  `user.created` / `user.updated` / `user.deleted`. Already syncs `"User"` and
  reconciles the newsletter list. It logs the Clerk id and never the address.
- `supabase/sql/0024_customers.sql` — `sync_clerk_user()` upserts on `clerkId`;
  `soft_delete_clerk_user()` "claims once", which is the exact pattern this phase
  reuses for the welcome.

**The voucher machinery**
- `supabase/sql/0028_discounts.sql` — `discount_grants` with `unique (discountId, email)`;
  `requiresGrant` on `discounts`; `resolve_discount()` gate; `place_order()` consumption.
- `src/services/vouchers.ts` (Priority 1) already surfaces grants in the portal, and
  Priority 2 already offers them at checkout. **A grant written here appears in both
  with no further work.**

**Sign-up**
- `src/components/auth/SignUpForm.tsx` — Clerk's prebuilt `<SignUp>` plus a marketing
  checkbox written through `unsafeMetadata`. Prebuilt `<SignUp>` handles the
  `__clerk_ticket` invitation flow itself, so an invitation link needs **no change**
  to the sign-up UI.

## Decisions and assumptions

1. **`user.created` is the activation signal, for both paths.** A self-registering
   customer and an invited one who accepts both produce exactly one `user.created`.
   One trigger, one letter, no second code path to keep in step. `user.updated`
   never sends.
2. **Duplicate prevention is an atomic claim, not a check.** A new
   `"User"."welcomedAt"`, claimed by `update … where "welcomedAt" is null returning`.
   Whoever gets a row won the right to send; a redelivery gets nothing back and
   sends nothing. Same mechanism `soft_delete_clerk_user()` already uses, and the
   reason both exist: a check-then-send has a gap, an atomic claim does not.
3. **Existing accounts are backfilled once.** The column is added inside a
   `do $$ … end $$` guarded on `information_schema`, and the backfill runs only in
   that branch. Otherwise re-running the migration — which `npm run db:migrate`
   does with every file, every time — would stamp accounts created since and
   silently suppress their welcome.
4. **The welcome campaign is chosen by a flag on `discounts`, not an env var.**
   A new `isWelcome boolean` with a **partial unique index** so at most one row can
   hold it. `supabase/sql/0003_directory.sql` states the doctrine this follows:
   merchandising "belongs in the database rather than in a constant a marketer
   cannot reach". The desk toggles it in the existing discount editor.
5. **The letter does not depend on the voucher.** If no campaign is flagged, or the
   grant cannot be written, the welcome still sends — without the voucher block. A
   house that stops welcoming people because a marketing campaign lapsed is worse
   than one that welcomes them warmly and offers nothing.
6. **The code in the letter is real by construction.** `claim_welcome()` claims the
   welcome and writes the grant in **one transaction**, and returns the code it
   wrote. There is no path where the letter names a code the database does not
   honour — which is precisely what §7.2 asks for.
7. **A failed send releases the claim and answers 500.** Clerk retries on a
   non-2xx, and everything the event does is idempotent — the sync upserts, the
   grant re-resolves to the row already there, the claim is re-taken. The
   alternative, swallowing the failure, means one Resend blip costs a customer
   their welcome permanently. Bounded by Clerk's own retry schedule.
8. **Locale comes from metadata, validated against `LOCALES`.** Clerk carries no
   locale of its own. `SignUpForm` starts writing one into `unsafeMetadata`
   beside the marketing flag, and invitations carry one in `publicMetadata`. Both
   are untrusted input and are checked against the two-value allowlist before use,
   so the worst a forged value can do is pick the other supported language.
9. **Invitations are sent by KHEM, not by Clerk.** `notify: false` on
   `createInvitation`, and the returned `invitation.url` goes into a house-branded
   letter. Clerk still owns the invitation, the ticket and its expiry — this
   changes the envelope, not the mechanism. `redirectUrl` points at our localized
   `/sign-up`, which is Clerk's prebuilt component and consumes the ticket itself.
10. **The welcome is transactional (§9.1) and ignores marketing consent.** It is
    sent to somebody who just created an account, about that account. The
    newsletter reconciliation already in the webhook is untouched and stays the
    only thing consent governs.
11. **No invitation records are stored.** Clerk is the register; a second copy in
    Postgres would be a second truth about who has been invited.

## Files likely to change

**New**
- `supabase/sql/0030_welcome.sql` — `"User"."welcomedAt"` (+ guarded backfill),
  `discounts."isWelcome"` (+ partial unique index), `claim_welcome(payload jsonb)`.
- `src/lib/email/welcome-copy.ts` — per-locale prose for the welcome and the
  invitation. Separate from `copy.ts` only because that file's `WELCOME_COPY` is
  the newsletter's; two letters called welcome in one file is a trap.
- `src/lib/email/welcome-templates.ts` — `welcomeEmail()`, `invitationEmail()`,
  built from the existing `layout.ts` kit.
- `src/lib/email/send-welcome-mail.ts` — the senders. Returns whether the send
  succeeded, unlike `send-order-mail.ts`'s deliberate `void`, because decision 7
  needs the answer.
- `src/services/welcome.ts` — `claimWelcome()` / `releaseWelcome()` over the RPC.
- `src/actions/admin/invitations.ts` — `inviteCustomer()`, behind `requireAdmin()`.
- `src/components/admin/InviteCustomerForm.tsx` — one field, one button, on the
  customers screen.

**Modified**
- `src/app/api/webhooks/clerk/route.ts` — the welcome branch on `user.created`.
- `src/components/auth/SignUpForm.tsx` — writes `locale` into `unsafeMetadata`.
- `src/app/[locale]/admin/customers/page.tsx` — renders the invite form.
- `src/components/admin/DiscountForm.tsx` + its action/schema — the
  "use as the welcome offer" toggle.
- `src/types/discount.ts`, `src/schemas/db/discounts.ts` — `isWelcome`.
- `src/lib/i18n/dictionaries/*` — admin invite copy only. The letters' prose lives
  in `welcome-copy.ts`, never in the browser bundle.

## Implementation requirements

**`claim_welcome(payload)`** — `{ clerkId }` in, `{ claimed, email, firstName, code,
expiresAt }` out.
- Claims `"User"."welcomedAt"` atomically; returns `claimed: false` and nothing else
  when the claim fails.
- Finds the single `discounts` row with `isWelcome` and `isActive`, inside its window.
- Inserts the grant with `on conflict ("discountId", email) do nothing`, then reads
  the row back, so a retry after a released claim reuses the grant rather than failing.
- Grant expiry: sixty days, matching the window `0028`'s header names for the
  welcome offer.
- `security definer`, `set search_path = public`, `execute` revoked from the public
  roles — as every function in `0026`–`0029`.

**The letters**
- Built with `luxuryShell`, the wordmark, a gold rule, the same dark/gold register as
  the order mail. Table layout, inline styles, `text` alternative always.
- Every interpolated value through `escape.ts`. The customer's first name is the
  only visitor-supplied string in either letter, and it is escaped.
- Welcome: logo → welcome line → what KHEM House is, briefly → the private benefit,
  its code, its terms and expiry → one CTA into the collections. The voucher block is
  omitted entirely when there is no code, rather than rendering an empty frame.
- Invitation: logo → who invited them, in the house's voice → **ACCEPT INVITATION**
  → when the link lapses.
- `AUTO_REPLY_HEADERS` where the existing letters use them.

**The webhook**
- Only on `user.created`, and only after the sync has succeeded.
- Claim → send → on failure release and return 500. On success, log the Clerk id and
  whether a voucher rode along. **Never the address, the name, or the code.**
- An unconfigured mailer (`isEmailConfigured()` false) does not claim and does not
  500 — a deployment with no Resend key is not a failing deployment, and a claim
  taken there would silently burn the one chance to welcome that customer.

**The invitation action**
- `requireAdmin()` first, as every action under `src/actions/admin/`.
- Zod-validated address; `ignoreExisting: false` so re-inviting an existing customer
  is refused by Clerk rather than papered over; `expiresInDays: 30`.
- `notify: false`, then send the house letter with `invitation.url`. If our send
  fails, **revoke the invitation** — an invitation nobody was told about is a dead
  row that blocks re-inviting that address.
- Returns a translated result for the form; logs the outcome, never the address.

## Security requirements

- The webhook's authentication remains Clerk's signature over the raw body; nothing
  in this phase reads the body before `verifyWebhook`.
- `claim_welcome()` is reachable only with the secret key; no new grant to public roles.
- Metadata is untrusted: only `locale`, only against the `LOCALES` allowlist.
- The invitation action is admin-only and takes an address, never a user id or a role.
- No email address, name, phone or voucher code in any log line, in either path.
- The welcome grant is written for the address Clerk verified, and `resolve_discount()`
  still gates redemption on it — this phase issues an entitlement, it does not widen
  who may redeem one.
- No secret reaches the client: Resend and Clerk secret keys stay server-side, and
  the invite form posts to an action rather than an API route.

## Acceptance criteria

- [ ] A new sign-up receives exactly one welcome letter, in their language.
- [ ] Its voucher code exists in `discounts`, has a grant for that address, and
      applies successfully at checkout through the Priority 2 flow.
- [ ] The same code appears in `/account/vouchers` from the Priority 1 panel.
- [ ] A redelivered `user.created` sends nothing further.
- [ ] With no `isWelcome` campaign, the letter still arrives, without a voucher.
- [ ] An invited address receives KHEM's invitation letter and no Clerk letter;
      accepting it lands on `/sign-up`, creates the account, and produces the
      welcome letter.
- [ ] Accounts that existed before this migration are never welcomed retroactively,
      including after `npm run db:migrate` is run twice.
- [ ] Marketing consent has no effect on either letter.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.

## Checks to run

```bash
npm run db:migrate
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run db:migrate`, then `npm run dev`.
2. In `/admin/discounts`, create `WELCOME10` — 10%, active, `requiresGrant` on —
   and tick **use as the welcome offer**. Confirm ticking it on a second code
   clears it from the first.
3. Point a Clerk webhook at the dev server (`clerk webhooks listen`, per
   `.agents/skills/clerk-cli`) and register a fresh address.
4. Confirm: one welcome letter, the code inside it, and a `discount_grants` row for
   that address. Confirm `"User"."welcomedAt"` is stamped.
5. Replay the same `user.created` from the Clerk dashboard → no second letter.
6. Sign in as that account → the voucher is in `/account/vouchers`, and applies at
   `/checkout`.
7. Clear the `isWelcome` flag, register another address → letter arrives with no
   voucher block.
8. In `/admin/customers`, invite an address → the KHEM invitation letter arrives and
   no Clerk one does. Follow the link, complete sign-up → welcome letter follows.
9. Invite an address that already has an account → refused, with a legible message.
10. Register with `/ar/sign-up` → the welcome letter is in Arabic and lays out RTL.
11. Run `npm run db:migrate` a second time, register nobody, and confirm no existing
    account's `welcomedAt` changed.

## Open questions for the user

1. **Welcome offer terms.** I will not invent them. The plan's example is 15% off a
   first order with a sixty-day window; the code, the percentage and any minimum are
   yours to set in `/admin/discounts` — I will ship the flag and the machinery, and
   create no campaign row.
2. **The 500-on-send-failure trade** (decision 7). It buys "nobody silently loses
   their welcome" at the cost of Clerk retrying the event while Resend is down.
   The alternative is best-effort like the order mail. I recommend the retry.
3. **Invitation letter voice.** I will write it in the house register, saying an
   invitation to KHEM House awaits. If a specific person or occasion should be
   named ("invited by the concierge"), say so and it becomes a field.
