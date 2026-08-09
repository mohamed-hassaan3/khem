/**
 * Contact detail query layer.
 *
 * Same contract as `content.ts`: the UI awaits these functions, so swapping the
 * source (Supabase table or CMS globals) is a change of function bodies only.
 */

// NOTE: add `import "server-only"` here once that package is installed.

import {
  CONCIERGE_EMAIL,
  CONTACT_CHANNELS,
  ENQUIRY_SUBJECTS,
  SOCIAL_PROFILES,
} from "@/src/data/contact";
import type { ContactChannel, SocialProfile } from "@/src/types/contact";

/** → supabase.from('ContactChannel').select('*').order('sortOrder') */
export async function getContactChannels(): Promise<ContactChannel[]> {
  return CONTACT_CHANNELS;
}

/** → supabase.from('SocialProfile').select('*').order('sortOrder') */
export async function getSocialProfiles(): Promise<SocialProfile[]> {
  return SOCIAL_PROFILES;
}

/** → supabase.from('EnquirySubject').select('label').order('sortOrder') */
export async function getEnquirySubjects(): Promise<string[]> {
  return ENQUIRY_SUBJECTS;
}

/** → supabase.from('BoutiqueSetting').select('conciergeEmail').single() */
export async function getConciergeEmail(): Promise<string> {
  return CONCIERGE_EMAIL;
}
