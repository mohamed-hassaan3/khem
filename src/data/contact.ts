/**
 * Local seed data for contact details.
 *
 * Same contract as `content.ts` and `products.ts`: the only place these values
 * are hardcoded, shaped for a straight insert into Supabase (or a CMS) later.
 */

import type { ContactChannel, SocialProfile } from "@/src/types/contact";

/**
 * The house mailbox — the one address that actually receives mail.
 *
 * Every "write to us" surface in the app resolves to this: the contact page,
 * the concierge request, wholesale enquiries, and the three legal contacts in
 * `src/data/legal.ts`. They used to be six purpose-specific addresses
 * (`enquiries@`, `concierge@`, `wholesale@`, `privacy@`, `legal@`, `care@`),
 * none of which exist on the domain — so every one of them bounced, including
 * the two a privacy regulator would expect to work.
 *
 * They are still six *named constants*, so splitting them apart again is one
 * line each once the aliases exist at the mail host. What must never happen is
 * the app publishing an address that silently drops mail.
 */
export const HOUSE_EMAIL = "info@khemperfumes.com";

export const CONTACT_CHANNELS: ContactChannel[] = [
  {
    id: "boutique",
    label: "Boutique",
    value: "New Cairo City, Cairo Governorate, Egypt.",
    href: null,
  },
  {
    id: "email",
    label: "Email",
    value: HOUSE_EMAIL,
    href: `mailto:${HOUSE_EMAIL}`,
  },
  {
    id: "telephone",
    label: "Telephone",
    value: "+20 11 234 5678",
    href: "tel:+201123456789",
  },
  {
    id: "hours",
    label: "Hours",
    value: "10:00 AM – 10:00 PM (GMT+2)",
    href: null,
  },
];

/** Address the private-consultation request is sent to. */
export const CONCIERGE_EMAIL = HOUSE_EMAIL;

/**
 * Subject options on the contact form.
 *
 * NOTE: `Footer.tsx` keeps its own, shorter platform list. Unifying the two is a
 * content decision, not a refactor — see `prompts/contact-page-nextjs-transform.md`.
 */
export const ENQUIRY_SUBJECTS: string[] = [
  "General Enquiry",
  "Order Support",
  "Bespoke Commission",
  "Press & Media",
  "Wholesale & Stockists",
  "Private Consultation",
  "Other",
];

export const SOCIAL_PROFILES: SocialProfile[] = [
  {
    id: "instagram",
    platform: "Instagram",
    handle: "@khemperfumes",
    // TODO: replace with the real profile URL; external links then need
    // target="_blank" rel="noopener noreferrer".
    url: "https://www.instagram.com/khemperfumes/",
  },
  {
    id: "pinterest",
    platform: "Pinterest",
    handle: "khemperfumes",
    url: "https://www.pinterest.com/khemperfumes/",
  },
  {
    id: "facebook",
    platform: "Facebook",
    handle: "@khemperfumes",
    url: "https://www.facebook.com/khemperfumes/",
  },
];
