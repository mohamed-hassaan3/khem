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
  /** Whether the Inner Circle list in this campaign's language is included. */
  toSubscribers: boolean;
  /** Whether consenting customers are included. Never anybody who declined. */
  toCustomers: boolean;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  /** How many addresses were claimed at dispatch. A snapshot. */
  audienceCount: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Which list a claimed recipient came from. */
export type CampaignRecipientKind = "SUBSCRIBER" | "CUSTOMER" | "SPECIFIC";

/**
 * Who a campaign would reach if it went now.
 *
 * `total` is **not** the sum of the other three. An address that is both a
 * subscriber and a consenting customer is counted once, under the source it was
 * attributed to — which is exactly the number of letters that would leave,
 * because `campaign_sends` is keyed on the address and the second claim
 * conflicts. The screen shows both figures for that reason: the sources explain
 * where the audience came from, the total says what will happen.
 */
export interface AudienceBreakdown {
  subscribers: number;
  customers: number;
  specific: number;
  /** Deduplicated. The number of letters. */
  total: number;
}

/** A campaign with what has become of it. */
export interface CampaignWithProgress extends Campaign {
  /** Letters claimed for it. Zero until dispatch begins. */
  claimed: number;
  /** Of those, how many the provider accepted. */
  delivered: number;
  /** Who it would reach if sent now. */
  audience: AudienceBreakdown;
  /** The addresses somebody typed for this campaign, lowercased. */
  recipients: string[];
}

/** True while a campaign may still be edited. */
export function isEditable(status: CampaignStatus): boolean {
  return status === "DRAFT" || status === "SCHEDULED";
}
