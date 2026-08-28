/**
 * The marketing vocabulary — announcements, house marketing chrome, and
 * promotional pricing.
 *
 * Mirrors `supabase/sql/0035_marketing.sql`. Money is in piastres throughout,
 * the same minor unit `"Product"."priceInCents"` uses.
 *
 * ## Three systems, three sets of types
 *
 * Nothing here describes a discount **code**. Codes live in
 * `src/types/discount.ts` and are typed, granted and counted; a
 * {@link Promotion} is none of those things — it is what a bottle costs while a
 * campaign runs. The two only meet in one place, {@link Promotion.stacksWithCodes},
 * and that meeting is documented at the field.
 *
 * ## Resolved versus raw
 *
 * Storefront types (`Announcement`, `MarketingSettings`) carry **resolved**
 * text: the row mapper has already chosen between the English column and its
 * `_ar` twin, so a component receives a plain `string` and has no idea a
 * translation happened. The dashboard's `Admin*` twins carry both, because an
 * editor is editing both. Same split `src/types/catalog.ts` uses.
 */

// ── Announcements ─────────────────────────────────────────────

/** How the bar cycles through more than one announcement. */
export type AnnouncementMode =
  /** The first live announcement only. */
  | "STATIC"
  /** A continuous, seamless drift. Disabled under `prefers-reduced-motion`. */
  | "MARQUEE"
  /** One at a time, cross-faded on an interval. */
  | "CAROUSEL";

export const ANNOUNCEMENT_MODES: readonly AnnouncementMode[] = [
  "STATIC",
  "MARQUEE",
  "CAROUSEL",
];

/** One announcement, as the bar prints it. */
export interface Announcement {
  id: string;
  /** Already resolved to the active locale. */
  message: string;
  /**
   * An app path, never an absolute URL — the column carries a check constraint
   * saying so, because this value is rendered straight into an anchor.
   */
  href: string | null;
  /** Resolved. Only meaningful beside an `href`. */
  ctaLabel: string | null;
}

/** One announcement, as the dashboard edits it. */
export interface AdminAnnouncement {
  id: string;
  message: string;
  messageAr: string | null;
  href: string | null;
  ctaLabel: string | null;
  ctaLabelAr: string | null;
  isActive: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

// ── House marketing settings ──────────────────────────────────

/** The bar's behaviour and the popup's, resolved for the storefront. */
export interface MarketingSettings {
  announcementsEnabled: boolean;
  announcementMode: AnnouncementMode;
  announcementIntervalMs: number;

  offerPopupEnabled: boolean;
  offerPopupDelayMs: number;
  /**
   * How far down a page counts as engagement, as a percentage of the scrollable
   * height. `0` disables the trigger and leaves the timer to decide alone.
   */
  offerPopupScrollPercent: number;
  /** How long a dismissal is honoured for. */
  offerPopupSnoozeDays: number;

  offerPopupEyebrow: string | null;
  offerPopupHeading: string;
  offerPopupBody: string | null;
  offerPopupImageUrl: string;
  offerPopupImageAlt: string;
}

/** The same row with both languages, for the editor. */
export interface AdminMarketingSettings {
  announcementsEnabled: boolean;
  announcementMode: AnnouncementMode;
  announcementIntervalMs: number;
  offerPopupEnabled: boolean;
  offerPopupDelayMs: number;
  offerPopupScrollPercent: number;
  offerPopupSnoozeDays: number;
  offerPopupEyebrow: string | null;
  offerPopupEyebrowAr: string | null;
  offerPopupHeading: string;
  offerPopupHeadingAr: string | null;
  offerPopupBody: string | null;
  offerPopupBodyAr: string | null;
  offerPopupImageUrl: string;
  offerPopupImageAlt: string;
  offerPopupImageAltAr: string | null;
}

// ── Promotions ────────────────────────────────────────────────

/** A percentage off the list price, or a fixed amount off it. */
export type PromotionKind = "PERCENTAGE" | "FIXED";

/**
 * What a promotion targets.
 *
 * No `ALL` member, unlike {@link import("./discount").DiscountScope}: a
 * house-wide sale is every collection selected, and "everything, forever" is a
 * price change rather than a campaign.
 */
export type PromotionScope = "PRODUCTS" | "COLLECTIONS";

export interface Promotion {
  id: string;
  /** For the desk. Never printed to a customer. */
  name: string;
  description: string | null;
  /**
   * The customer-facing campaign line — "BLACK FRIDAY". Null for a quiet
   * reduction that should carry no banner.
   */
  label: string | null;
  labelAr: string | null;
  kind: PromotionKind;
  /** A percentage 1–100, or an amount in piastres. Read with `kind`. */
  value: number;
  appliesTo: PromotionScope;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /**
   * Whether a discount **code** may also come off a line this promotion has
   * already reduced.
   *
   * False by default. With it off, a promoted line is not part of a code's
   * eligible subtotal at all — see the header of
   * `supabase/sql/0035_marketing.sql`. This is the only field where the two
   * systems touch.
   */
  stacksWithCodes: boolean;
  /** Tie-break when two promotions name the same product. Higher wins. */
  priority: number;
  createdAt: string;
}

/** The target sets, as the editor renders them. */
export interface PromotionTargets {
  productSlugs: readonly string[];
  collectionSlugs: readonly string[];
}

/** A promotion on its own screen, with what it currently reduces. */
export interface PromotionDetail extends Promotion {
  targets: PromotionTargets;
  /** How many live catalog products this promotion is pricing right now. */
  productCount: number;
}

/**
 * The winning promotion for one product, attached to every catalog projection.
 *
 * **A quotation, not a decision.** The figure a card prints comes from
 * `active_product_promotions`; the figure a customer is charged comes from
 * `place_order()` reading that same view inside the order transaction. They are
 * the same rule at two moments, which is the only relationship between a
 * displayed price and a charged one that is safe to have.
 */
export interface ProductPromotion {
  promotionId: string;
  /** Resolved campaign label, or null for a quiet reduction. */
  label: string | null;
  kind: PromotionKind;
  /** What the product costs while this campaign runs, in piastres. */
  priceInCents: number;
  /** What it costs otherwise — `"Product"."priceInCents"`. */
  listPriceInCents: number;
  /** Whole percent off, rounded down. `20` for a 1,800 → 1,440 reduction. */
  percentOff: number;
  /** When the campaign lapses, for a "ends 30 Nov" line. */
  endsAt: string | null;
}

// ── The subscribe / earn-offer popup ──────────────────────────

/**
 * What the popup promises, read from the live welcome offer.
 *
 * Never a constant and never a value from the browser: it is
 * `discounts."isWelcome"` (`supabase/sql/0030_welcome.sql`), so the percentage
 * in the popup and the percentage the checkout honours cannot drift apart. Null
 * when the house is running no welcome offer — the popup then invites people to
 * join the list and promises nothing, rather than not appearing.
 */
export interface WelcomeOfferSummary {
  kind: PromotionKind;
  /** A percentage 1–100, or an amount in piastres. Read with `kind`. */
  value: number;
}

/** What subscribing through the popup produced. */
export type SubscribeOfferResult =
  | {
      ok: true;
      /** The welcome code, when one was granted. Null when none is running. */
      code: string | null;
      /** True when this address was already on the list. */
      alreadySubscribed: boolean;
    }
  | { ok: false; error: "rateLimited" | "validation" | "delivery" };
