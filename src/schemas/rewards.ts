/**
 * Rewards write validation — the settings, and the one manual lever.
 *
 * Every rule here has a twin in `supabase/sql/0058_benefit_settings.sql`. The
 * database keeps the authoritative constraint, because a check that exists only
 * in TypeScript is one a script or a psql session walks straight past. What
 * these add is a readable failure, and one rule the column checks cannot express
 * on their own: a redemption floor below the conversion step is a rate that
 * reads as an offer and behaves as a refusal.
 *
 * Sentences rather than codes, like every other admin schema: the dashboard is
 * English by construction and has exactly one reader.
 */

import { z } from "zod";

import { SIGNUP_BENEFIT_MODES } from "@/src/types/benefits";

/** A million pounds of points in one adjustment is a typo, not a goodwill gesture. */
const MAX_ADJUSTMENT = 1_000_000;

/** Ten thousand pounds a step. Above this the rate is a mistake. */
const MAX_MONEY = 1_000_000;

export const benefitSettingsSchema = z
  .object({
    discoveryCreditEnabled: z.coerce.boolean(),

    rewardsEnabled: z.coerce.boolean(),

    earnSpendInCents: z.coerce
      .number({ error: "Enter an amount to spend." })
      .int("Whole piastres only.")
      .min(1, "The spend step must be more than nothing.")
      .max(MAX_MONEY, "That spend step is larger than any KHEM order."),
    earnPoints: z.coerce
      .number({ error: "Enter the points earned." })
      .int("Whole points only.")
      .min(1, "Earning must be at least one point.")
      .max(100_000, "That is more points than the house intends to give."),
    earnOnDiscoverySets: z.coerce.boolean(),

    signupBenefit: z.enum(
      SIGNUP_BENEFIT_MODES as unknown as [string, ...string[]],
      { error: "Choose what signing up is worth." },
    ),
    signupPoints: z.coerce
      .number({ error: "Enter the signup points." })
      .int("Whole points only.")
      .min(1, "A signup bonus of nothing is the Off setting."),

    firstPurchaseEnabled: z.coerce.boolean(),
    firstPurchasePoints: z.coerce
      .number({ error: "Enter the first-purchase points." })
      .int("Whole points only.")
      .min(1, "A bonus of nothing is the Off setting."),

    reviewEnabled: z.coerce.boolean(),
    reviewPoints: z.coerce
      .number({ error: "Enter the review points." })
      .int("Whole points only.")
      .min(1, "A bonus of nothing is the Off setting."),

    redeemPoints: z.coerce
      .number({ error: "Enter the points in a redemption step." })
      .int("Whole points only.")
      .min(1, "A redemption step must be at least one point."),
    redeemValueInCents: z.coerce
      .number({ error: "Enter what that step is worth." })
      .int("Whole piastres only.")
      .min(1, "A step worth nothing is not a reward.")
      .max(MAX_MONEY, "That is more than the house intends to give back."),
    minRedeemPoints: z.coerce
      .number({ error: "Enter the redemption minimum." })
      .int("Whole points only.")
      .min(1, "The minimum must be at least one point."),

    /** Empty means unlimited, which is why this is a string on the way in. */
    maxPointsPerOrder: z
      .union([z.literal(""), z.coerce.number().int().min(1)])
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),

    pointsExpiryMonths: z
      .union([z.literal(""), z.coerce.number().int().min(1).max(120)])
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),

    pointsStackWithCodes: z.coerce.boolean(),
    pointsStackWithPromotions: z.coerce.boolean(),
    pointsStackWithOffers: z.coerce.boolean(),
    pointsStackWithCredit: z.coerce.boolean(),
  })
  .refine((data) => data.minRedeemPoints >= data.redeemPoints, {
    // `benefit_minimum_reachable` in 0058 says the same thing; this says it
    // beside the field the editor is looking at.
    path: ["minRedeemPoints"],
    message:
      "The minimum cannot be below one redemption step — nobody could ever reach it.",
  });

export type BenefitSettingsInput = z.input<typeof benefitSettingsSchema>;

/**
 * The manual lever, shaped exactly like `adjustCreditSchema`: a signed amount, a
 * required reason, and the administrator taken from the session rather than the
 * form.
 */
export const adjustPointsSchema = z.object({
  clerkUserId: z.string().trim().min(1, "Which customer?"),
  points: z.coerce
    .number({ error: "Enter an amount." })
    .int("Whole points only.")
    .refine((value) => value !== 0, "An adjustment of zero records nothing.")
    .refine(
      (value) => Math.abs(value) <= MAX_ADJUSTMENT,
      "That is larger than any adjustment the house makes.",
    ),
  note: z
    .string()
    .trim()
    .min(3, "Say why — an unexplained adjustment cannot be audited later.")
    .max(500, "That note is too long."),
});
