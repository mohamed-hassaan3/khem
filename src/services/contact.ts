/**
 * Contact detail query layer.
 *
 * Same contract as `content.ts`. Note {@link getEnquirySubjects}: the table it
 * reads is display copy, and the *validation* list is the constant in
 * `src/constants/contact.ts`. Two lists on purpose — see the comment there.
 */

import "server-only";

import type { Locale } from "@/src/lib/i18n/config";
import { getSupabasePublic } from "@/src/lib/supabase";
import { parseList } from "@/src/schemas/db/catalog";
import {
  CONTACT_CHANNEL_COLUMNS,
  SOCIAL_PROFILE_COLUMNS,
  toContactChannel,
  toSocialProfile,
} from "@/src/schemas/db/directory";
import { getBoutiqueSettings } from "@/src/services/settings";
import { ENQUIRY_SUBJECTS } from "@/src/constants/contact";
import type { ContactChannel, SocialProfile } from "@/src/types/contact";

function logFailure(query: string, message: string): void {
  console.error(`[contact] ${query} failed: ${message}`);
}

export async function getContactChannels(
  locale: Locale,
): Promise<ContactChannel[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("ContactChannel")
    .select(CONTACT_CHANNEL_COLUMNS)
    .order("sortOrder");

  if (error) {
    logFailure("getContactChannels", error.message);
    return [];
  }

  return parseList(data as unknown[] | null, (row) => toContactChannel(row, locale));
}

export async function getSocialProfiles(): Promise<SocialProfile[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("SocialProfile")
    .select(SOCIAL_PROFILE_COLUMNS)
    .order("sortOrder");

  if (error) {
    logFailure("getSocialProfiles", error.message);
    return [];
  }

  return parseList(data as unknown[] | null, toSocialProfile);
}

/**
 * The `<select>` options on the contact form.
 *
 * Falls back to the constant rather than to an empty list: an enquiry form with
 * no subjects is a form nobody can submit, and the constant is the list the
 * Server Action validates against anyway.
 */
export async function getEnquirySubjects(): Promise<string[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [...ENQUIRY_SUBJECTS];

  const { data, error } = await supabase
    .from("EnquirySubject")
    .select("label")
    .order("sortOrder");

  if (error) {
    logFailure("getEnquirySubjects", error.message);
    return [...ENQUIRY_SUBJECTS];
  }

  const labels = (data ?? [])
    .map((row) => (typeof row.label === "string" ? row.label : null))
    .filter((label): label is string => label !== null);

  return labels.length > 0 ? labels : [...ENQUIRY_SUBJECTS];
}

/** Address the private-consultation request is sent to. */
export async function getConciergeEmail(): Promise<string> {
  return (await getBoutiqueSettings()).conciergeEmail;
}
