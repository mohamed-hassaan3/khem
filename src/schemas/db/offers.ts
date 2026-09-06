/**
 * Row schemas for Offers & Bundles.
 *
 * `offers` and its four target sets are publicly readable *while live*, exactly
 * as `promotions` is — the storefront prints "Choose 3, Pay for 2" on a
 * collection page. `offer_grants` and `offer_redemptions` are not: they name
 * people, and `supabase/sql/0060_offers.sql` grants the public roles nothing on
 * either.
 */

import { z } from "zod";

import type { Offer, OfferPreview } from "@/src/types/offer";

import { parseList } from "./catalog";

export const offerRewardKindSchema = z.enum(["FREE_ITEM", "PERCENTAGE"]);
export const offerScopeSchema = z.enum(["PRODUCTS", "COLLECTIONS"]);
export const offerSelectionSchema = z.enum(["LOWEST_PRICED", "HIGHEST_PRICED"]);
export const offerAudienceSchema = z.enum([
  "EVERYONE",
  "NEW_CUSTOMERS",
  "EXISTING_CUSTOMERS",
  "SUBSCRIBERS",
  "INVITED",
]);

export const OFFER_COLUMNS =
  "id, name, description, label, label_ar, isActive, startsAt, endsAt, " +
  "triggerQuantity, triggerScope, rewardQuantity, rewardKind, rewardScope, " +
  "rewardSelection, rewardValue, audience, requiresCode, totalUseLimit, " +
  "perCustomerLimit, stacksWithCodes, stacksWithCredit, priority, createdAt";

const offerRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().default(null),
  label: z.string().nullable().default(null),
  label_ar: z.string().nullable().default(null),
  isActive: z.boolean(),
  startsAt: z.string().nullable().default(null),
  endsAt: z.string().nullable().default(null),
  triggerQuantity: z.coerce.number(),
  triggerScope: offerScopeSchema,
  rewardQuantity: z.coerce.number(),
  rewardKind: offerRewardKindSchema,
  rewardScope: offerScopeSchema,
  rewardSelection: offerSelectionSchema,
  rewardValue: z.coerce.number().nullable().default(null),
  audience: offerAudienceSchema,
  requiresCode: z.string().nullable().default(null),
  totalUseLimit: z.coerce.number().nullable().default(null),
  perCustomerLimit: z.coerce.number().nullable().default(null),
  stacksWithCodes: z.boolean(),
  stacksWithCredit: z.boolean(),
  priority: z.coerce.number().default(0),
  createdAt: z.string(),
});

export function toOffer(row: unknown): Offer | null {
  const parsed = offerRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { label_ar: labelAr, ...rest } = parsed.data;
  return { ...rest, labelAr };
}

/** What `resolve_offer()` answers with. */
const offerResolutionSchema = z.object({
  ok: z.boolean(),
  offerId: z.string().optional(),
  label: z.string().nullable().optional(),
  labelAr: z.string().nullable().optional(),
  amountInCents: z.coerce.number().optional(),
  rewardProductSlug: z.string().nullable().optional(),
  rewardUnitPriceInCents: z.coerce.number().nullable().optional(),
});

/**
 * Resolved to one locale here rather than in the component, matching every
 * other storefront mapper in this directory: a component receives a plain
 * `string | null` and has no idea a translation happened.
 */
export function toOfferPreview(
  row: unknown,
  locale: string,
): OfferPreview | null {
  const parsed = offerResolutionSchema.safeParse(row);

  if (!parsed.success || !parsed.data.ok) return null;

  const { offerId, amountInCents } = parsed.data;
  if (offerId === undefined || amountInCents === undefined) return null;
  // An offer worth nothing is not an offer that applies.
  if (amountInCents <= 0) return null;

  const arabic = parsed.data.labelAr ?? null;

  return {
    offerId,
    label:
      locale === "ar" && arabic !== null && arabic.length > 0
        ? arabic
        : (parsed.data.label ?? null),
    amountInCents,
    rewardProductSlug: parsed.data.rewardProductSlug ?? null,
    rewardUnitPriceInCents: parsed.data.rewardUnitPriceInCents ?? null,
  };
}

export { parseList };
