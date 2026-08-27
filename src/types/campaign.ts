/**
 * The campaign vocabulary.
 *
 * Mirrors `supabase/sql/0033_campaigns.sql`. A campaign is the only thing in
 * this house that, once acted on, cannot be corrected — so the type carries the
 * distinction between a draft (editable) and a record (frozen) rather than
 * leaving it to the screens.
 */

/** §11's campaign types, in the order the editor offers them. */
export type CampaignType =
  | "NEW_ARRIVAL"
  | "DISCOUNT"
  | "NEW_COLLECTION"
  | "EXCLUSIVE_OFFER"
  | "SEASONAL"
  | "CUSTOM";

/**
 * Where a campaign is in its life.
 *
 * `DRAFT` and `SCHEDULED` are editable; `SENDING` and `SENT` are history and the
 * database refuses to change their content. `CANCELLED` is a schedule withdrawn
 * before it ran.
 */
export type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "SENDING"
  | "SENT"
  | "CANCELLED";

export interface Campaign {
  id: string;
  /** The desk's own name for it. Never sent. */
  name: string;
  type: CampaignType;
  /** Which list it speaks to. One language, one audience. */
  locale: "en" | "ar";
  subject: string;
  preheader: string;
  /** Plain paragraphs, separated by blank lines. Never HTML. */
  body: string;
  heroUrl: string | null;
  heroAlt: string | null;
  ctaLabel: string;
  ctaHref: string;
  /** A real `discounts.code`, guaranteed by a foreign key. */
  discountCode: string | null;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  /** How many addresses were claimed at dispatch. A snapshot. */
  audienceCount: number | null;
  createdAt: string;
  updatedAt: string;
}

/** A campaign with what has become of it. */
export interface CampaignWithProgress extends Campaign {
  /** Letters claimed for it. Zero until dispatch begins. */
  claimed: number;
  /** Of those, how many the provider accepted. */
  delivered: number;
  /** How many addresses it would reach if sent now. */
  audienceNow: number;
}

/** True while a campaign may still be edited. */
export function isEditable(status: CampaignStatus): boolean {
  return status === "DRAFT" || status === "SCHEDULED";
}
