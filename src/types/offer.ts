/**
 * The Offers & Bundles vocabulary.
 *
 * Mirrors `supabase/sql/0060_offers.sql`. Money is in piastres.
 *
 * ## An offer is not a promotion and not a coupon
 *
 * A {@link import("./marketing").Promotion} changes what one bottle costs. A
 * {@link import("./discount").Discount} is a string a customer types. An offer
 * is neither: it is a rule about the *shape of a basket* — buy this many of
 * these, receive that many of those — and it is chosen by the house rather than
 * named by the browser. Nothing in the checkout payload mentions one, which is
 * the whole difference.
 */

/** A free unit, or a percentage off the units the offer selected. */
export type OfferRewardKind = "FREE_ITEM" | "PERCENTAGE";

/**
 * What a trigger or a reward set names.
 *
 * No `ALL` member, for `PromotionScope`'s reason: "buy two of anything" is a
 * house-wide price change rather than a campaign.
 */
export type OfferScope = "PRODUCTS" | "COLLECTIONS";

/**
 * Which unit becomes free.
 *
 * `LOWEST_PRICED` is the default because the opposite is a pricing mistake
 * rather than a marketing decision: a customer who bags two 890 bottles and one
 * 2,200 bottle must not receive the 2,200 for nothing.
 */
export type OfferSelection = "LOWEST_PRICED" | "HIGHEST_PRICED";

/** Who may use an offer. Every member is answerable from a table this schema
 *  already has. */
export type OfferAudience =
  | "EVERYONE"
  | "NEW_CUSTOMERS"
  | "EXISTING_CUSTOMERS"
  | "SUBSCRIBERS"
  | "INVITED";

export const OFFER_REWARD_KINDS: readonly OfferRewardKind[] = [
  "FREE_ITEM",
  "PERCENTAGE",
];
export const OFFER_SCOPES: readonly OfferScope[] = ["PRODUCTS", "COLLECTIONS"];
export const OFFER_SELECTIONS: readonly OfferSelection[] = [
  "LOWEST_PRICED",
  "HIGHEST_PRICED",
];
export const OFFER_AUDIENCES: readonly OfferAudience[] = [
  "EVERYONE",
  "NEW_CUSTOMERS",
  "EXISTING_CUSTOMERS",
  "SUBSCRIBERS",
  "INVITED",
];

/** One offer, as the dashboard lists and edits it. */
export interface Offer {
  id: string;
  /** For the desk. Never printed to a customer — `label` is. */
  name: string;
  description: string | null;
  label: string | null;
  labelAr: string | null;

  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;

  triggerQuantity: number;
  triggerScope: OfferScope;

  rewardQuantity: number;
  rewardKind: OfferRewardKind;
  rewardScope: OfferScope;
  rewardSelection: OfferSelection;
  /** A percentage 1–100. Only meaningful — and always present — for
   *  `PERCENTAGE`. */
  rewardValue: number | null;

  audience: OfferAudience;
  /** The offer applies only to an order carrying this code. Implies
   *  `stacksWithCodes`, which the database enforces. */
  requiresCode: string | null;

  totalUseLimit: number | null;
  perCustomerLimit: number | null;

  stacksWithCodes: boolean;
  stacksWithCredit: boolean;

  priority: number;
  createdAt: string;
}

/** The four target sets, as the editor renders them. */
export interface OfferTargets {
  triggerProductSlugs: readonly string[];
  triggerCollectionSlugs: readonly string[];
  rewardProductSlugs: readonly string[];
  rewardCollectionSlugs: readonly string[];
}

/** An offer on its own screen. */
export interface OfferDetail extends Offer {
  targets: OfferTargets;
  /** Live redemptions — what the caps are counting. */
  redemptionCount: number;
}

/**
 * What an offer would take off the bag in front of the customer.
 *
 * A quotation, not a decision. `place_order()` resolves the same offer again,
 * against the order actually being written, under the lock that makes its caps
 * real. If the two ever disagree, the order is right.
 */
export interface OfferPreview {
  offerId: string;
  /** Already resolved to the active locale. */
  label: string | null;
  amountInCents: number;
  /** Which unit the house is giving. */
  rewardProductSlug: string | null;
  rewardUnitPriceInCents: number | null;
}
