/**
 * Row schema for campaigns.
 *
 * Rows parsed rather than asserted, like every neighbour. It matters more here
 * than usual in one direction: a campaign row is what a letter to the whole list
 * is built from, and a malformed one must fail to load rather than be sent as
 * whatever survived the cast.
 */

import { z } from "zod";

import type { Campaign } from "@/src/types/campaign";

import { parseList } from "./catalog";

export const campaignTypeSchema = z.enum([
  "NEW_ARRIVAL",
  "DISCOUNT",
  "NEW_COLLECTION",
  "EXCLUSIVE_OFFER",
  "SEASONAL",
  "CUSTOM",
]);

export const campaignStatusSchema = z.enum([
  "DRAFT",
  "SCHEDULED",
  "SENDING",
  "SENT",
  "CANCELLED",
]);

export const CAMPAIGN_COLUMNS =
  "id, name, type, locale, subject, preheader, body, heroUrl, heroAlt, " +
  "ctaLabel, ctaHref, discountCode, status, scheduledAt, sentAt, " +
  "audienceCount, createdAt, updatedAt";

const campaignRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: campaignTypeSchema.catch("CUSTOM"),
  locale: z.enum(["en", "ar"]).catch("en"),
  subject: z.string(),
  preheader: z.string().default(""),
  body: z.string(),
  heroUrl: z.string().nullable().default(null),
  heroAlt: z.string().nullable().default(null),
  ctaLabel: z.string().default(""),
  ctaHref: z.string().default(""),
  discountCode: z.string().nullable().default(null),
  status: campaignStatusSchema.catch("DRAFT"),
  scheduledAt: z.string().nullable().default(null),
  sentAt: z.string().nullable().default(null),
  audienceCount: z.coerce.number().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export function toCampaign(row: unknown): Campaign | null {
  const parsed = campaignRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

export { parseList };
