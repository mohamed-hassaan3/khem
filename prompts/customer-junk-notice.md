# Customer “Not junk” notice

## Goal
Add one shared, translated “mark as Not junk” notice to customer emails built with `luxuryShell()`, and add a translated reminder beneath the confirmation email status on the order confirmed page.

## Skills read
None. This is a small copy and existing component/layout change; the repository permits existing project patterns for these files.

## Existing code inspected
- `src/lib/email/copy.ts` — locale-typed customer email prose and `SignatureCopy`.
- `src/lib/email/layout.ts` — `luxuryShell()`, `mutedParagraph()`, and its body/signature table rows.
- `src/lib/email/order-templates.ts` — customer order email and internal `newOrderNotificationEmail()`.
- `src/lib/i18n/dictionaries/en.ts` and `ar.ts` — checkout confirmation strings; Arabic is typed as `Dictionary` from English.
- `src/components/checkout/OrderCelebration.tsx` — the current email status text and visual treatment.

## Decisions and assumptions
- Use `HOUSE_EMAIL` from `src/constants/contact` in the localized email prose if it can be incorporated cleanly without changing the trusted-copy escaping model. Otherwise use the requested literal address.
- Place the shared email notice in `luxuryShell()` between the customer body and signature rows. `newOrderNotificationEmail()` uses the separate internal `shell()` and therefore will not receive it.
- The confirmation page notice is a separate dictionary sentence below the existing email status, using the supplied English wording and a natural equivalent in Arabic.
- No headers, DNS, Resend settings, sending logic, existing copy, logo, or unrelated behavior will change.

## Files likely to change
- `src/lib/email/copy.ts`
- `src/lib/email/layout.ts`
- `src/lib/i18n/dictionaries/en.ts`
- `src/lib/i18n/dictionaries/ar.ts`
- `src/components/checkout/OrderCelebration.tsx`

## Implementation requirements
- Add `junkNotice: string` to `SignatureCopy` and both locale entries, with the user-supplied translated email wording.
- Render `mutedParagraph(SIGNATURE_COPY[locale].junkNotice, align)` in a new table row between the body and signature, using `padding:0 40px`.
- Add `checkout.confirmed.junkNotice` in both dictionaries. English: `A confirmation email is on its way. If you don't see it, check your Junk or Spam folder and mark it as “Not junk”.` Arabic should convey the same meaning naturally.
- Render the confirmation notice as small muted text under the existing email status line, preserving the existing direction-aware behavior and styling conventions.
- Keep the diff small and add no components or dependencies.

## Security requirements
- Only author-written translated copy is introduced; never interpolate customer input into the notice.
- Continue escaping email copy through `mutedParagraph()`.

## Acceptance criteria
- Each customer email rendered through `luxuryShell()` contains the shared notice once in its selected locale.
- `newOrderNotificationEmail()` remains on the internal shell and contains no shared customer notice.
- The confirmed order page displays the additional notice once beneath its existing email status in English and Arabic.
- No unrelated copy, headers, logo, or sending behavior changes.

## Checks to run
- `npx tsc --noEmit`
- `npm run lint`
- Inspect generated/rendered email template output or existing template call sites to confirm the shared notice occurs once for each customer email path and is absent from the internal notification.
- Review the diff to confirm only the listed files and requested content changed.

## Manual test steps
1. Render representative customer order, welcome, newsletter, and campaign email templates with `locale: "en"`; confirm each has one English notice between the body and signature.
2. Render the same customer email paths with `locale: "ar"`; confirm each has one Arabic notice, right aligned with the RTL layout.
3. Render `newOrderNotificationEmail()` and confirm the customer notice is absent.
4. Open the confirmed order page in English and Arabic and confirm the new small muted sentence appears below the email status text.
