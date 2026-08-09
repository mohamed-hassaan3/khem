/**
 * Local seed data for contact details.
 *
 * Same contract as `content.ts` and `products.ts`: the only place these values
 * are hardcoded, shaped for a straight insert into Supabase (or a CMS) later.
 */

import type { ContactChannel, SocialProfile } from "@/src/types/contact";

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
    value: "enquiries@khemperfumes.com",
    href: "mailto:enquiries@khemperfumes.com",
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
export const CONCIERGE_EMAIL = "concierge@khemperfumes.com";

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
    url: "#",
  },
  {
    id: "pinterest",
    platform: "Pinterest",
    handle: "khem.perfumes",
    url: "#",
  },
  {
    id: "facebook",
    platform: "Facebook",
    handle: "@khemperfumes",
    url: "#",
  },
];
