/**
 * Contact constants that are code, not content.
 *
 * Everything else that used to live in `src/data/contact.ts` — the channels,
 * the social profiles, the concierge and wholesale addresses — is now rows in
 * Postgres, read through `src/services/contact.ts`. These two survived the move
 * because they are load-bearing at module scope, where an `await` cannot reach:
 *
 *   {@link HOUSE_EMAIL}      builds the `From:` header in `src/lib/email/addresses.ts`.
 *   {@link ENQUIRY_SUBJECTS} is the allow-list `src/schemas/contact.ts` validates against.
 *
 * The second one is a security boundary as much as a convenience. A submitted
 * subject lands in a mail header, so it must be checked against a list that
 * cannot change without a deploy and a code review — not against a table row an
 * account with write access could edit into a header injection. The database
 * holds the same seven strings for display, and `npm run db:verify` fails if
 * the two ever drift apart.
 */

/**
 * The house mailbox — the one address that actually receives mail.
 *
 * Every "write to us" surface resolves to this: the contact page, the concierge
 * request, wholesale enquiries, and the three legal contacts. They used to be
 * six purpose-specific addresses (`enquiries@`, `concierge@`, `wholesale@`,
 * `privacy@`, `legal@`, `care@`), none of which exist on the domain — so every
 * one of them bounced, including the two a privacy regulator would expect to
 * work.
 *
 * The `"BoutiqueSetting"` row stores the same address three times under its
 * three names, so splitting them apart again is a data edit once the aliases
 * exist at the mail host. What must never happen is the app publishing an
 * address that silently drops mail.
 */
export const HOUSE_EMAIL = "info@khemperfumes.com";

/**
 * Subject options on the contact form — the validation allow-list.
 *
 * Seeded into `"EnquirySubject"` for display; `getEnquirySubjects()` reads the
 * table so the `<select>` and the rest of the copy come from one place.
 */
export const ENQUIRY_SUBJECTS: readonly string[] = [
  "General Enquiry",
  "Order Support",
  "Bespoke Commission",
  "Press & Media",
  "Wholesale & Stockists",
  "Private Consultation",
  "Other",
];
