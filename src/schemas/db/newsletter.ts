/**
 * Row schemas for the Inner Circle list.
 *
 * Same rules as its neighbours: rows parsed rather than asserted, one malformed
 * row dropped rather than a blanked screen, and no consumer outside the server —
 * `supabase/sql/0025_newsletter.sql` grants the public roles nothing, because
 * every row is a real person's email address.
 */

import { z } from "zod";

import type {
  NewsletterCounts,
  NewsletterSubscriber,
  SubscribeOutcome,
  UnsubscribeOutcome,
} from "@/src/types/newsletter";

import { parseList } from "./catalog";

export const newsletterStatusSchema = z.enum(["SUBSCRIBED", "UNSUBSCRIBED"]);

/**
 * `.catch("HOME_FORM")` for the same defensive reason `paymentMethodSchema`
 * catches: a deployment running behind a database that has grown a fourth
 * source must not blank the whole list over one unrecognised value.
 */
export const newsletterSourceSchema = z
  .enum(["HOME_FORM", "SIGN_UP", "ADMIN", "POPUP"])
  .catch("HOME_FORM");

const subscriberRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  status: newsletterStatusSchema,
  source: newsletterSourceSchema,
  locale: z.enum(["en", "ar"]).catch("en"),
  clerkUserId: z.string().nullable().default(null),
  consentAt: z.string(),
  unsubscribedAt: z.string().nullable().default(null),
  createdAt: z.string(),
});

const subscriberPageRowSchema = subscriberRowSchema.extend({
  totalCount: z.coerce.number().default(0),
});

/** Returns the row *and* the total, since the total arrives attached to it. */
export function toSubscriberWithTotal(
  row: unknown,
): { subscriber: NewsletterSubscriber; total: number } | null {
  const parsed = subscriberPageRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { totalCount, ...subscriber } = parsed.data;
  return { subscriber, total: totalCount };
}

// ── Function returns ──────────────────────────────────────────

const countsSchema = z.object({
  total: z.coerce.number().default(0),
  subscribed: z.coerce.number().default(0),
  unsubscribed: z.coerce.number().default(0),
});

export function toNewsletterCounts(value: unknown): NewsletterCounts {
  const parsed = countsSchema.safeParse(value);
  // A screen that prints three zeros is wrong; a screen that throws is worse.
  return parsed.success ? parsed.data : { total: 0, subscribed: 0, unsubscribed: 0 };
}

const subscribeOutcomeSchema = z.object({
  id: z.string(),
  token: z.string(),
  isNew: z.boolean().default(false),
  reactivated: z.boolean().default(false),
});

export function toSubscribeOutcome(value: unknown): SubscribeOutcome | null {
  const parsed = subscribeOutcomeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const unsubscribeOutcomeSchema = z.object({
  found: z.boolean().default(false),
  alreadyOff: z.boolean().default(false),
  email: z.string().nullable().default(null),
});

export function toUnsubscribeOutcome(value: unknown): UnsubscribeOutcome {
  const parsed = unsubscribeOutcomeSchema.safeParse(value);
  // An unparseable answer is treated as "that link is not valid", which is the
  // safe direction: it removes nobody and tells the reader nothing.
  return parsed.success
    ? parsed.data
    : { found: false, alreadyOff: false, email: null };
}

export { parseList };
