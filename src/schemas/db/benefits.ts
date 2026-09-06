/**
 * The `"BenefitSetting"` row.
 *
 * Same rules as its neighbours: an explicit column list, the row parsed rather
 * than asserted, and a **complete fallback** when it cannot be read.
 *
 * ## Why the fallback matters more here than elsewhere
 *
 * Most row mappers in this directory may return null and let a section
 * disappear. This one decides whether the house is paying people. An absent row
 * must therefore fall back to *today's behaviour* — Discovery Credit on, Rewards
 * off, the welcome discount running — and never to a state that starts or stops
 * paying customers because a query timed out.
 */

import { z } from "zod";

import type { BenefitSettings } from "@/src/types/benefits";

export const signupBenefitModeSchema = z.enum([
  "WELCOME_DISCOUNT",
  "REWARD_POINTS",
  "NONE",
]);

export const BENEFIT_SETTING_COLUMNS =
  "discoveryCreditEnabled, rewardsEnabled, earnSpendInCents, earnPoints, " +
  "earnOnDiscoverySets, signupBenefit, signupPoints, firstPurchaseEnabled, " +
  "firstPurchasePoints, reviewEnabled, reviewPoints, redeemPoints, " +
  "redeemValueInCents, minRedeemPoints, maxPointsPerOrder, pointsExpiryMonths, " +
  "pointsStackWithCodes, pointsStackWithPromotions, pointsStackWithOffers, " +
  "pointsStackWithCredit";

/**
 * The defaults `0058_benefit_settings.sql` seeds, restated.
 *
 * Deliberately a duplicate of the SQL defaults rather than a read of them: this
 * value is used when the database *cannot be reached*, so it cannot come from
 * the database. The two are kept in step by the fact that changing either
 * without the other changes what an unreachable-database deployment does, which
 * is a reviewable difference rather than a silent one.
 */
export const BENEFIT_FALLBACK: BenefitSettings = {
  discoveryCreditEnabled: true,
  rewardsEnabled: false,
  earnSpendInCents: 10_000,
  earnPoints: 10,
  earnOnDiscoverySets: true,
  signupBenefit: "WELCOME_DISCOUNT",
  signupPoints: 100,
  firstPurchaseEnabled: false,
  firstPurchasePoints: 200,
  reviewEnabled: false,
  reviewPoints: 50,
  redeemPoints: 100,
  redeemValueInCents: 5_000,
  minRedeemPoints: 100,
  maxPointsPerOrder: null,
  pointsExpiryMonths: null,
  pointsStackWithCodes: false,
  pointsStackWithPromotions: false,
  pointsStackWithOffers: false,
  pointsStackWithCredit: false,
};

const benefitSettingRowSchema = z.object({
  discoveryCreditEnabled: z.boolean(),
  rewardsEnabled: z.boolean(),
  earnSpendInCents: z.coerce.number(),
  earnPoints: z.coerce.number(),
  earnOnDiscoverySets: z.boolean(),
  signupBenefit: signupBenefitModeSchema,
  signupPoints: z.coerce.number(),
  firstPurchaseEnabled: z.boolean(),
  firstPurchasePoints: z.coerce.number(),
  reviewEnabled: z.boolean(),
  reviewPoints: z.coerce.number(),
  redeemPoints: z.coerce.number(),
  redeemValueInCents: z.coerce.number(),
  minRedeemPoints: z.coerce.number(),
  maxPointsPerOrder: z.coerce.number().nullable().default(null),
  pointsExpiryMonths: z.coerce.number().nullable().default(null),
  pointsStackWithCodes: z.boolean(),
  pointsStackWithPromotions: z.boolean(),
  pointsStackWithOffers: z.boolean(),
  pointsStackWithCredit: z.boolean(),
});

export function toBenefitSettings(row: unknown): BenefitSettings | null {
  const parsed = benefitSettingRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}
