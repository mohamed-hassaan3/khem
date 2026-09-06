/**
 * The five things that can reduce an order, named apart.
 *
 * Mirrors `supabase/sql/0058_benefit_settings.sql` and the ladder in
 * `supabase/sql/0061_benefit_resolution.sql`.
 *
 * ## Why this file exists at all
 *
 * A promotion, an offer, a coupon, a reward and a credit are five different
 * instruments, and the loyalty specification is explicit that they must not be
 * "accidentally treated as the same thing". They already had four separate type
 * files; what they did not have was a name for the *category* or a single place
 * to read what the house currently offers. Both are here.
 *
 * | Instrument | What it is | Chosen by | Applies to |
 * | --- | --- | --- | --- |
 * | promotion | a **price** | the house | one line |
 * | offer | a **benefit** | the house | the order |
 * | coupon | a **discount** | the customer types a code | the order |
 * | points | a **reward** | the customer spends a balance | the order |
 * | credit | a **credit** | the customer picks a voucher | the order |
 *
 * Money is in piastres throughout, the same minor unit as
 * `Product.priceInCents`.
 */

/**
 * What a new subscriber or a new account is offered.
 *
 * Three states rather than two booleans, for the reason
 * `supabase/sql/0058_benefit_settings.sql` gives at the enum: "welcome discount
 * on?" and "signup earns points?" as separate switches admits a fourth state the
 * house has never wanted and the popup has no way to say.
 */
export type SignupBenefitMode =
  /** The `discounts."isWelcome"` campaign, as it has always run. */
  | "WELCOME_DISCOUNT"
  /** KHEM Points instead. No grant is issued. */
  | "REWARD_POINTS"
  /** Nothing is promised. The popup still invites people to the list. */
  | "NONE";

export const SIGNUP_BENEFIT_MODES: readonly SignupBenefitMode[] = [
  "WELCOME_DISCOUNT",
  "REWARD_POINTS",
  "NONE",
];

/**
 * The whole `"BenefitSetting"` row, as the dashboard edits it.
 *
 * One row rather than three, because a second singleton for Rewards and a third
 * for the signup benefit would be three answers to "what does the house
 * currently offer" — and the day they disagree there is no way to tell which is
 * lying.
 */
export interface BenefitSettings {
  /** Whether a Discovery Set purchase creates a credit, and whether the
   *  storefront says so. Does **not** govern spending one already held. */
  discoveryCreditEnabled: boolean;

  rewardsEnabled: boolean;

  /** "Spend `earnSpendInCents` → earn `earnPoints`". Two fields, so the
   *  sentence reads back exactly as the desk typed it. */
  earnSpendInCents: number;
  earnPoints: number;
  /** Whether a Discovery Set is itself points-eligible. */
  earnOnDiscoverySets: boolean;

  signupBenefit: SignupBenefitMode;
  /** Awarded on registration, under `REWARD_POINTS` only. */
  signupPoints: number;

  firstPurchaseEnabled: boolean;
  firstPurchasePoints: number;

  reviewEnabled: boolean;
  reviewPoints: number;

  /** "`redeemPoints` points → `redeemValueInCents`". */
  redeemPoints: number;
  redeemValueInCents: number;
  minRedeemPoints: number;
  /** Null is unlimited. */
  maxPointsPerOrder: number | null;
  /** Null never expires. Counted from the row that earned the points. */
  pointsExpiryMonths: number | null;

  pointsStackWithCodes: boolean;
  pointsStackWithPromotions: boolean;
  pointsStackWithOffers: boolean;
  pointsStackWithCredit: boolean;
}

/**
 * What the storefront needs to know about the signup benefit.
 *
 * A discriminated union so the popup cannot render the wrong branch: under
 * `NONE` there is no field to print, which is what makes "no stale 20% OFF
 * messaging" a type error rather than a thing to remember.
 *
 * Assembled by `getSignupBenefit()` in `src/services/benefits.ts`. The
 * percentage under `WELCOME_DISCOUNT` still comes from `welcome_offer()`, which
 * `supabase/sql/0059_rewards.sql` gates on this same mode — so a component
 * cannot print a campaign the checkout would refuse, and cannot print one the
 * house has switched away from.
 */
export type SignupBenefit =
  | {
      mode: "WELCOME_DISCOUNT";
      /** Null when the house is running no welcome campaign. */
      offer: { kind: "PERCENTAGE" | "FIXED"; value: number } | null;
    }
  | { mode: "REWARD_POINTS"; points: number }
  | { mode: "NONE" };
