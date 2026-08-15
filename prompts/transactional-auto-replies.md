# Prompt — Auto-reply emails for enquiries and Inner Circle signups

Follow-on to `prompts/contact-newsletter-resend-delivery.md`, which is implemented and shipped. That change made mail reach the house mailbox. This one makes the *visitor* hear back immediately — a branded acknowledgement for a contact enquiry, and a welcome for a newsletter signup.

## Goal

Two customer-facing emails, sent from the same Server Actions, in the visitor's own locale, with a presentation that matches the site rather than the plain internal notification: dark obsidian ground, gold rules, Cinzel-register serif, generous spacing.

An auto-reply is the first email KHEM ever sends a customer. It is a brand surface, not a receipt.

---

## Skills read

None applies. `.agents/skills/{clerk,supabase,ai-sdk}` are unrelated to transactional mail; the hooks suggested `ai-sdk` and `chat-sdk` on a lexical match with "auto reply", and neither concerns email. Follows the patterns established in `src/lib/email/*` last change.

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/lib/email/templates.ts` | `shell()` builds the dark table layout; `row()` builds a label/value pair. Both are internal-notification shaped — dense, no prose, no call to action. The customer-facing emails need a different composition, not a reuse of `row()`. |
| `src/lib/email/escape.ts` | `escapeHtml` / `escapeMultiline` / `stripHeaderBreaks`. Unchanged and used identically — the visitor's own message is quoted back to them, so it is still untrusted input in an HTML document. |
| `src/lib/email/addresses.ts` | `fromAddress()` returns `noreply@`. Customer-facing mail wants a *different* From — see decision 2. |
| `src/actions/contact.ts` | Order is honeypot → throttle → Zod → send. The house notification is the send; the auto-reply is a second one that must not endanger the first. |
| `src/actions/newsletter.ts` | Same shape, one field. |
| `src/providers/i18n-provider.tsx` | `useLocale()` gives the client the active locale — how the action learns which language to write in. |
| `src/lib/i18n/config.ts` | `LOCALES = ["en","ar"]`, `LOCALE_DIRECTION`, `LOCALE_HTML_TAG`. The Arabic email needs `dir="rtl"` on the body and `lang` set. |
| `src/data/contact.ts` | `HOUSE_EMAIL`, `CONTACT_CHANNELS` (boutique address, telephone, hours) — the material for the email footer, already written and already the published truth. |
| Resend API (`GET /domains`) | `khemperfumes.com` → `status: verified`, `capabilities.sending: enabled`, region `ap-northeast-1`. Both prior sends returned `last_event: "delivered"`. |

---

## Decisions and assumptions

1. **The auto-reply must never break the enquiry.** The house notification is sent first and its result decides what the visitor sees. The auto-reply is best-effort: sent after, wrapped in its own try/catch, and a failure is logged and swallowed. Reversing this would mean a bounced customer address (a typo in their own email) discards an enquiry KHEM could otherwise have answered.
2. **Customer-facing mail comes From `KHEM <info@khemperfumes.com>`**, not `noreply@`. The internal notification keeps `noreply@` — nobody replies to it — but an acknowledgement that says "reply to this message" must come from an address that reads mail. `fromAddress()` gains a variant rather than being changed: `houseFromAddress()`.
3. **Localised, in the visitor's language.** The actions take `locale: Locale` and pick the template copy; the Arabic version sets `dir="rtl"` and `lang="ar"` on the body and mirrors the padding. An English confirmation for someone who filled an Arabic form is the kind of detail this codebase already refuses elsewhere (`ltrIsland`, `readingArrow`).
4. **Email copy lives in `src/lib/email/copy.ts`, not the UI dictionaries.** The `en.ts`/`ar.ts` dictionaries are shipped to the browser; email prose is server-only and would be dead weight in every page bundle. It is a separate `Record<Locale, …>` object, typed so a missing Arabic string is a compile error.
5. **The enquiry is quoted back.** The acknowledgement includes the subject and the message the visitor sent, in a muted bordered block — it is the proof that KHEM received what they think they sent, and it is the single most reassuring element such an email can carry. Escaped through `escapeMultiline` exactly as the internal one is.
6. **Mail-loop suppression headers.** `Auto-Submitted: auto-replied` (RFC 3834) and `X-Auto-Response-Suppress: All` on both auto-replies, via Resend's `headers` option. Without them, a submission from an address whose own vacation responder is on can start a ping-pong. The existing 3-per-10-minute throttle caps the blast radius; the headers are what actually stop well-behaved responders.
7. **No unsubscribe link on the enquiry acknowledgement** — it is a transactional reply to a message the person just sent, not marketing. The newsletter welcome **does** carry one: a `mailto:info@khemperfumes.com?subject=Unsubscribe` line, honest about the fact that removal is currently a human action, matching what `actions/newsletter.ts` already documents. A fake one-click link that does nothing would be worse than none.
8. **Both templates share a new `luxuryShell()`**, distinct from the internal `shell()`: wider padding, a centred wordmark with a gold hairline, a headline in the serif stack, body prose at 15px/1.9, an optional bordered quote block, a call-to-action link styled as a gold-bordered button (a table cell, since `<button>` and flexbox do not survive Outlook), and a footer with the boutique address, hours, and telephone drawn from `CONTACT_CHANNELS`.
9. **Outlook-safe markup throughout**, because the recipient list includes the house mailbox read in the Outlook mobile app: nested tables, inline styles, no flexbox/grid, no background images, no web fonts, explicit `width` attributes, and a `<!--[if mso]>` fallback around the CTA cell so it does not collapse in Word-rendered Outlook.
10. **Dark-background caveat, stated rather than discovered later:** some clients (Outlook light mode, Gmail's mobile dark-mode inversion) recolour backgrounds. Text colours are set explicitly on every element so nothing can end up ivory-on-ivory, and the layout is legible if the dark ground is dropped entirely.
11. **No new dependency.** Still hand-built HTML, for the reasons given in the previous prompt.

---

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/lib/email/addresses.ts` | `+ houseFromAddress()` (`KHEM <info@…>`), env-overridable |
| `src/lib/email/copy.ts` | **new** — `Record<Locale, …>` prose for both auto-replies |
| `src/lib/email/layout.ts` | **new** — `luxuryShell()`, `quoteBlock()`, `ctaButton()`, `footerBlock()` |
| `src/lib/email/templates.ts` | `+ enquiryAcknowledgementEmail(input, locale)`, `+ newsletterWelcomeEmail(email, locale)` |
| `src/actions/contact.ts` | `+ locale` on the input; best-effort acknowledgement after the notification |
| `src/actions/newsletter.ts` | Same, welcome email |
| `src/components/contact/ContactForm.tsx` | Pass `useLocale()` through |
| `src/components/home/NewsletterForm.tsx` | Same |

---

## Implementation requirements

- `locale` arriving from the client is untrusted: validate with `isLocale()` and fall back to `"en"` rather than indexing a record with an arbitrary string.
- The acknowledgement send happens **after** a successful house notification, never before, and never in a way that can change the returned `FormActionResult`.
- Auto-reply failures log the Resend error message only — never the recipient address, per the privacy rule already in both actions.
- `replyTo` on the acknowledgement is `info@khemperfumes.com`, so a customer replying to the acknowledgement reaches the house inbox.
- Every interpolated value escaped; the quoted message uses `escapeMultiline`.
- Strict TypeScript, zero `any`. `Record<Locale, X>` for all copy, so adding a locale fails the build until translated.
- The Arabic template sets `dir="rtl"` and `lang="ar"` on `<body>` and uses `text-align:right` on prose blocks; the wordmark and the CTA stay centred.

## Security requirements

1. The visitor's message is quoted back into an HTML email — escape before anything else, same as the internal template.
2. Never interpolate user input into `From`, `Subject`, or any header. The acknowledgement subject is fixed copy per locale.
3. `Auto-Submitted: auto-replied` on both, to prevent loops.
4. An address that fails validation never receives an auto-reply — the send happens after Zod, using `parsed.data.email`, not the raw input.
5. No tracking pixels, no open/click tracking (the Resend domain has both disabled; keep it that way).

## Acceptance criteria

- [ ] Submitting the contact form delivers **two** emails: the internal notification to `info@`, and an acknowledgement to the visitor.
- [ ] The acknowledgement quotes the subject and message the visitor sent, with any HTML in it shown as literal text.
- [ ] Replying to the acknowledgement addresses `info@khemperfumes.com`.
- [ ] Submitting from `/ar/contact` produces an Arabic, right-to-left acknowledgement.
- [ ] Newsletter signup delivers a welcome email carrying an honest `mailto:` unsubscribe line.
- [ ] With an address that hard-bounces, the internal notification still arrives and the form still shows success.
- [ ] Both emails render legibly in the Outlook mobile app, Gmail, and Apple Mail — no collapsed layout, no invisible text.
- [ ] Headers include `Auto-Submitted: auto-replied` (visible in the raw source).
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.

## Checks to run

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Manual test steps

1. `npm run dev`, `/en/contact`, submit using a personal address you can read.
2. That inbox receives the acknowledgement; `info@` receives the notification. Two emails, different designs.
3. In the acknowledgement, confirm your message is quoted and any `<b>` you typed appears literally.
4. Hit reply on the acknowledgement → To is `info@khemperfumes.com`.
5. View raw source → `Auto-Submitted: auto-replied` present.
6. `/ar/contact`, submit → the acknowledgement is Arabic and right-to-left.
7. Home page newsletter, submit → welcome email with the unsubscribe line.
8. Open both on the Outlook mobile app and check nothing collapses or turns invisible.
