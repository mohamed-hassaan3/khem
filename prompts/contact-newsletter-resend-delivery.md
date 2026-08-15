# Prompt — Deliver contact enquiries and newsletter signups to the house mailbox via Resend

Closes the two standing TODOs that both say the same thing in different words: `ContactForm.tsx` ("nothing typed here is transmitted, logged, or stored") and `NewsletterForm.tsx` ("the email is validated and then discarded"). After this, both forms deliver real mail to `info@khemperfumes.com`, and the success copy's *"we will respond within 24 hours"* is backed by a message that actually arrives.

## Goal

Wire both public forms to Resend through Server Actions, with server-side Zod validation, per-IP rate limiting, and HTML-escaped, KHEM-branded emails whose `Reply-To` is the visitor — so a reply from the house inbox goes straight back to them, no copy-paste.

---

## Skills read

None of `.agents/skills/{clerk,supabase,ai-sdk}` applies: these forms are public (no auth), store nothing (no Supabase), and call no model. The session hooks suggested `vercel-services` and `verification` on a lexical match; neither concerns transactional email, and neither is invoked. Resend + React Email are named in AGENTS.md §6 but ship no skill, so the implementation follows the existing repo patterns cited below.

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/components/contact/ContactForm.tsx` | Client component. Holds `name`, `email`, `subject`, `message` in state, validates client-side against `EMAIL_PATTERN`, focuses the first invalid field, then flips `isSent` — the header comment states plainly that this is UX affordance, not a boundary. `subjects: string[]` arrives as a prop. Styling constants `FIELD_CLASS`, `LABEL_CLASS`, `ERROR_CLASS` are local. |
| `src/components/home/NewsletterForm.tsx` | Same shape, one field, `motion/react` reveal on success, `useReducedMotion` respected. |
| `src/app/[locale]/contact/page.tsx` | Server component, `revalidate = 3600`. Resolves `subjects` via `getEnquirySubjects()` and passes them down. Untouched by this change. |
| `src/data/contact.ts` | `HOUSE_EMAIL = "info@khemperfumes.com"`, and a long comment explaining why six purpose-specific aliases collapsed into one: an address that silently drops mail must never be published. `CONCIERGE_EMAIL` re-exports it. |
| `src/services/contact.ts` | Query layer, `getConciergeEmail()` already exists and is the recipient lookup. Note its "add `import \"server-only\"` once installed" comment. |
| `src/app/api/search/route.ts` | The repo's rate-limit pattern: fixed window in a module-level `Map`, opportunistic sweep above 5 000 keys, `clientKey()` reading the leftmost `x-forwarded-for` entry, with a comment stating honestly that it is per-instance and lost on redeploy. This is the pattern to reuse, not reinvent. |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | `forms` already has `sending`, `errorMessage`, `successMessage`, `invalidEmail`; `contactForm` has the three field-level errors; `newsletter` has the success pair. Only the genuinely new strings get added. |
| `package.json` | **No `resend`, no `zod`, no `react-email`.** Both must be installed. Next 16.2.12, React 19.2.4. |
| `.env.local` | `RESEND_API_KEY` is present. No from/to override keys yet. |
| `src/lib/search/semantic.ts:66` | Precedent for a boolean env-presence guard rather than a throw at import time. |

---

## Decisions and assumptions

1. **Server Actions in `src/actions/`, not route handlers.** AGENTS.md §6 reserves `app/api` for thin handlers and puts mutations in Server Actions. The directory does not exist yet; this creates it (`src/actions/contact.ts`, `src/actions/newsletter.ts`) matching the `src/`-prefixed import alias used everywhere (`@/src/...`).
2. **The domain is verified in Resend** (confirmed by the user). Mail is sent **From `KHEM Website <noreply@khemperfumes.com>` → To `info@khemperfumes.com`**, with `replyTo` set to the visitor's address. `noreply@` rather than `info@` sending to itself: self-addressed mail scores worse in spam filters, and `Reply-To` already delivers the actual convenience. Both addresses are env-overridable (`RESEND_FROM_EMAIL`, `CONTACT_INBOX_EMAIL`) with the values above as fallbacks, so a mail-host change is a dashboard edit rather than a deploy.
3. **The recipient still resolves through `getConciergeEmail()`** when no env override is set, keeping `src/data/contact.ts` the single place the house address is written.
4. **Zod is added.** AGENTS.md §12 requires Zod-validated inputs; the alternative — hand-rolled checks — would be the only unvalidated mutation surface in the app. Schemas live in `src/schemas/contact.ts` and `src/schemas/newsletter.ts` (new directory, mirroring the repo's `src/`-rooted layout).
5. **Emails are hand-built HTML strings, not React Email.** AGENTS.md §6 lists React Email, but these are two internal notification emails read by the KHEM team — adding `@react-email/components` + `@react-email/render` to render two templates nobody outside the company sees is weight without payoff. The HTML is a small branded template in `src/lib/email/templates.ts` (obsidian ground `#0d0d0d`, gold `#c8a96a` rules, Cinzel-style serif stack with web-safe fallbacks since custom fonts do not load in mail clients), plus a `text` alternative for deliverability. If a customer-facing email lands later (order confirmation, shipping), React Email is the right call *then* and this file is not in its way.
6. **Every interpolated value is HTML-escaped.** The message body is attacker-controlled text arriving in an inbox that KHEM staff will open — `&<>"'` are escaped, and newlines become `<br>` only after escaping. This is the single most important line in the change.
7. **Rate limiting is copied from the search route, not abstracted out of it.** Two call sites do not justify a shared module, and the search route's limiter is tuned to a different cost (billed embeddings). The contact limiter is stricter and slower: **3 submissions per 10 minutes per IP**; newsletter **5 per 10 minutes**. The honest per-instance caveat is restated in the comment, not quietly dropped.
8. **A honeypot field, not a CAPTCHA.** A visually hidden, `tabindex="-1"`, `autocomplete="off"` input named `company`; any submission that fills it is accepted at the UI (silent success) and dropped server-side. It costs nothing in UX or bundle size and removes the bulk of naive bot traffic. Turnstile/reCAPTCHA is a separate decision with a third-party script cost, out of scope here.
9. **Both actions return a discriminated result**, never throw across the boundary: `{ ok: true } | { ok: false; error: "validation" | "rateLimited" | "delivery"; fieldErrors?: Record<string, string> }`. The client maps the code to a dictionary string, so no server-authored English text reaches an Arabic page.
10. **The client keeps its existing client-side validation** and adds `isPending` (via `useTransition`) plus a server-error region. The success state, styling constants, focus management, and `noValidate` behaviour are untouched — this is a delivery change, not a redesign.
11. **Never log the message body or the visitor's address.** On a Resend failure, log the Resend error and a request marker only. A contact form is the one place where a debug `console.log` becomes a privacy incident.
12. **Newsletter sends a notification email, not a list subscription.** No Resend Audience, no double opt-in, no persistence — the signup arrives in the house inbox and a human adds it. Stated explicitly because the success copy says *"you will receive a confirmation shortly"*, which remains a human action. Real list management is a later, larger piece of work (and a consent/GDPR question, given `src/lib/consent.ts` exists).
13. **No Prisma model, no migration.** Nothing is persisted. If enquiry history is wanted later it becomes an `Enquiry` model; today the inbox is the store.

---

## Files likely to change

| File | Change |
| :--- | :--- |
| `package.json` | `+ resend`, `+ zod` |
| `src/lib/email/client.ts` | **new** — Resend singleton, lazily constructed; `isEmailConfigured()` presence guard mirroring `semantic.ts:66` |
| `src/lib/email/addresses.ts` | **new** — `fromAddress()` / `inboxAddress()` resolving env → `getConciergeEmail()` → `HOUSE_EMAIL` |
| `src/lib/email/escape.ts` | **new** — `escapeHtml()`, `escapeMultiline()` |
| `src/lib/email/templates.ts` | **new** — `enquiryEmail()`, `newsletterEmail()` → `{ subject, html, text }` |
| `src/lib/email/rate-limit.ts` | **new** — fixed-window limiter + `clientKey()` from headers, per the search-route pattern |
| `src/schemas/contact.ts` | **new** — `contactEnquirySchema` (name 2–80, email, subject ∈ `ENQUIRY_SUBJECTS`, message 10–4000, honeypot empty) |
| `src/schemas/newsletter.ts` | **new** — `newsletterSchema` (email, honeypot) |
| `src/actions/contact.ts` | **new** — `"use server"`, `sendContactEnquiry(input)` |
| `src/actions/newsletter.ts` | **new** — `"use server"`, `subscribeToNewsletter(input)` |
| `src/types/contact.ts` | `+ ContactActionResult` (shared result union) |
| `src/components/contact/ContactForm.tsx` | `useTransition`, calls the action, honeypot field, pending + server-error UI |
| `src/components/home/NewsletterForm.tsx` | Same, single field |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | `+ forms.rateLimited`, `+ forms.deliveryFailed` (EN + AR) |
| `.env.local` | `+ RESEND_FROM_EMAIL`, `+ CONTACT_INBOX_EMAIL` (documented, optional) |

---

## Implementation requirements

- **Server boundary.** `src/actions/*.ts` start with `"use server"`. Nothing in `src/lib/email/*` is importable from a client component; the Resend client is constructed inside the action, never at module top level in a shared path.
- **Validation runs twice, authoritatively once.** The action re-validates every field with Zod regardless of what the client checked. Zod `flatten()` field errors map to error *codes*, not messages.
- **Subject is validated against `ENQUIRY_SUBJECTS`**, not accepted as free text — a `<select>` is trivially bypassed and an unvalidated subject lands in an email header.
- **Order of checks:** honeypot → rate limit → Zod → send. Cheapest and most abusive-traffic-shedding first; nothing metered runs before the throttle.
- **Missing `RESEND_API_KEY` fails closed** with `error: "delivery"` and a server-side warning. It must never fall through to a fake success — that is the exact failure mode this change exists to remove.
- **Strict TypeScript, zero `any`.** Zod-inferred input types (`z.infer<>`) on both actions.
- **The Resend call is wrapped in try/catch**, and Resend's `{ data, error }` return is checked — an SDK that returns an error object rather than throwing is the classic silent-drop bug here.

## Security requirements

1. HTML-escape every interpolated value in both templates; escape *before* newline→`<br>` conversion.
2. Never place user input in the `From` header. `Reply-To` carries the visitor address, and only after Zod's email validation.
3. Strip CR/LF from `subject` and any header-bound value (header-injection guard) even though it is enum-validated — defence in depth.
4. Do not log message bodies, names, or email addresses on any path, success or failure.
5. `RESEND_API_KEY` is server-only; it must never appear in a `NEXT_PUBLIC_*` var or reach a client component.
6. Rate limit before the metered call, keyed on the leftmost `x-forwarded-for` entry, with the map swept so it cannot grow unbounded on spoofed headers.
7. Message length is capped at 4 000 characters server-side, independent of any client `maxlength`.

## Acceptance criteria

- [ ] Submitting the contact form delivers an email to `info@khemperfumes.com` containing the name, email, chosen subject, and message, with `Reply-To` set to the sender.
- [ ] Replying in the mail client addresses the visitor, not `noreply@`.
- [ ] A message containing `<script>alert(1)</script>` and `<b>x</b>` arrives as literal visible text; no markup executes or renders as markup.
- [ ] A 4th contact submission within 10 minutes from one IP returns the rate-limited state, and no email is sent.
- [ ] A filled honeypot shows the success state to the client and sends no email.
- [ ] With `RESEND_API_KEY` removed, the form shows the delivery-failure message — never the success state.
- [ ] Newsletter signup delivers a notification email with the address.
- [ ] Error and pending states render in Arabic on `/ar/contact` — no English leaks from the server.
- [ ] Existing client-side validation, first-invalid-field focus, and the success panel are visually unchanged.
- [ ] The submit button is disabled and reads `forms.sending` while in flight; double-clicking sends one email.
- [ ] `npx tsc --noEmit` and `npm run lint` are clean.

## Checks to run

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/en/contact`.
2. Submit empty → three field errors, focus lands on Name. (Unchanged behaviour.)
3. Fill valid values, use a real address you control as the sender, submit → button shows *Sending*, then the success panel.
4. Check `info@khemperfumes.com` — the email is there, branded, with the subject line naming the enquiry type. Hit reply; the To field is your address.
5. Submit again with `<img src=x onerror=alert(1)>` in the message → arrives as visible text in the inbox.
6. Submit three more times in a row → the fourth shows the rate-limited message; confirm no fourth email lands.
7. In devtools, unhide the honeypot input, type into it, submit → success state shown, no email arrives.
8. Comment out `RESEND_API_KEY` in `.env.local`, restart, submit → the delivery-error message appears and the success panel does not.
9. Restore the key. Open `/ar/contact`, repeat steps 2 and 6 → all messages render in Arabic.
10. On the home page, submit the newsletter form → success reveal, and the signup email lands in the house inbox.
