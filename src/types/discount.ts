/**
 * The discount vocabulary.
 *
 * Mirrors `supabase/sql/0028_discounts.sql`. Money is in piastres throughout.
 *
 * Nothing here is ever assembled from a browser. The client sends a **code
 * string**; the amount, the eligibility and the caps are decided in SQL, inside
 * the transaction that writes the order.
 */

/** A percentage of the eligible lines, or a fixed amount off them. */
export type DiscountKind = "PERCENTAGE" | "FIXED";

/**
 * What a discount may come off.
 *
 * A restricted discount reduces **eligible lines only** — a 20%-off-Noir code on
 * a bag holding one Noir and one Signature reduces the Noir line alone.
 */
export type DiscountScope = "ALL" | "PRODUCTS" | "COLLECTIONS";

export interface Discount {
  id: string;
  /** Stored uppercased, so `welcome10` and `WELCOME10` are one code. */
  code: string;
  kind: DiscountKind;
  /** A percentage 1–100, or an amount in piastres. Read with `kind`. */
  value: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** Null means unlimited. */
  totalUseLimit: number | null;
  /** Null means unlimited. */
  perCustomerLimit: number | null;
  /** Judged on the subtotal *before* any reduction. */
  minimumOrderInCents: number;
  appliesTo: DiscountScope;
  /**
   * Whether redemption needs a grant addressed to this customer.
   *
   * True for the welcome offer, whose code string is shared but whose
   * entitlement is not — which is what stops a shared string leaking into a
   * permanent public discount.
   */
  requiresGrant: boolean;
  /**
   * The welcome offer, granted to every new account by `claim_welcome()`.
   *
   * At most one row may carry it — a partial unique index and a trigger in
   * `supabase/sql/0030_welcome.sql` see to that, so nothing in TypeScript has to
   * remember the rule.
   */
  isWelcome: boolean;
  description: string | null;
  createdAt: string;
}

/** A discount with the figures §12 asks for, counted from the redemption ledger. */
export interface DiscountWithUsage extends Discount {
  /** Live redemptions — released ones do not count against either cap. */
  timesUsed: number;
  /** Null when there is no total cap. */
  remainingUses: number | null;
  /** What the house has given away through this code. */
  discountedInCents: number;
  /** Revenue on the orders that used it, after the discount. */
  revenueInCents: number;
}

/** The restriction sets, as the editor renders them. */
export interface DiscountRestrictions {
  productSlugs: readonly string[];
  collectionSlugs: readonly string[];
}

/** One entitlement to a grant-gated code. */
export interface DiscountGrant {
  id: string;
  discountId: string;
  email: string;
  clerkUserId: string | null;
  issuedAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  usedOrderId: string | null;
}

/** One use, live or released. */
export interface DiscountRedemption {
  id: string;
  orderId: string;
  orderNumber: string | null;
  email: string | null;
  amountInCents: number;
  redeemedAt: string;
  /** Set when the order was refunded and the use returned to both caps. */
  releasedAt: string | null;
}

/** A discount on its own screen. */
export interface DiscountDetail extends DiscountWithUsage {
  restrictions: DiscountRestrictions;
  grants: readonly DiscountGrant[];
  redemptions: readonly DiscountRedemption[];
}

/**
 * Why `resolve_discount()` refused a code, as something a bilingual client can
 * translate.
 *
 * The sentences that function returns are English and are written for the
 * customer — which is enough at the desk and not enough on a storefront that
 * ships in two languages. `src/actions/checkout.ts` states the rule this
 * follows: a checkout that guesses at the shape of an error string shows the
 * wrong one. So `supabase/sql/0029_discount_preview.sql` names each refusal, the
 * client looks the name up, and the English sentence remains the fallback for a
 * name this build has not seen.
 */
export type DiscountRefusalCode =
  | "NO_CODE"
  | "NOT_RECOGNISED"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "BELOW_MINIMUM"
  /** Grant-gated, and this address holds no grant for it. */
  | "NOT_GRANTED"
  | "ALREADY_USED"
  | "FULLY_REDEEMED"
  | "CUSTOMER_LIMIT"
  | "NOTHING_ELIGIBLE"
  | "ZERO_AMOUNT";

/** One eligible set a restricted code names in its refusal. */
export interface DiscountRefusalName {
  name: string;
  /**
   * The Arabic name, where the row carries one. Null on a product — a fragrance
   * name is a proper noun and stays in Latin script on `/ar`, per
   * `supabase/sql/0008_i18n_content.sql`.
   */
  nameAr?: string | null;
}

/**
 * The specifics behind a refusal, when there are any that may be said aloud.
 *
 * Attached by `supabase/sql/0040_discount_refusal_detail.sql` to two refusals
 * only — `BELOW_MINIMUM` and `NOTHING_ELIGIBLE` — and only for a code that is
 * not grant-gated. Its **absence is normal**: an invitation-only code, a
 * refusal with nothing specific to add, or a database that has not yet applied
 * `0040`. Every message must read correctly without it.
 *
 * Nothing here is ever computed in TypeScript. The figure and the names are
 * read from rows inside `resolve_discount()`, which is what keeps the sentence
 * the customer reads and the rule that refused them from ever disagreeing.
 */
export interface DiscountRefusalDetail {
  /** Piastres. The order this code applies from. */
  minimumInCents?: number;
  /** What the code is restricted to. Absent when it applies to everything. */
  scope?: "PRODUCTS" | "COLLECTIONS";
  /** At most three — a refusal that recites nine sets is not a message. */
  names?: readonly DiscountRefusalName[];
  /** Eligible sets beyond the named three. */
  more?: number;
}

/**
 * What a code would be worth against the bag as it stands.
 *
 * **An estimate, and never a permission.** It is resolved without a lock and
 * binds nothing: `place_order()` resolves the same code again, under a lock,
 * inside the transaction that writes the order, and what that decides is what
 * the customer is charged. The estimate exists so a refusal arrives at the
 * field instead of at the payment button.
 */
export type DiscountPreview =
  | {
      ok: true;
      /** As stored — uppercase — not as typed. */
      code: string;
      /** What it would take off this bag, in piastres. */
      amountInCents: number;
    }
  | {
      ok: false;
      reasonCode: DiscountRefusalCode | "UNKNOWN";
      /** The English sentence, for a `reasonCode` the client cannot name. */
      reason: string;
      /** Specifics, where the code's terms are public. Often absent. */
      detail?: DiscountRefusalDetail;
    };
