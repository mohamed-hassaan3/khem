/**
 * Row schemas for the marketing tables.
 *
 * Same rules as `src/schemas/db/catalog.ts`: explicit column lists, rows parsed
 * rather than asserted, one malformed row dropped rather than a blanked bar. The
 * `_ar` columns are `.nullable()` and defaulted for the reason that file gives —
 * Postgres sends an explicit `null` for an untranslated field, and a schema that
 * rejected it would drop the whole row and remove the announcement entirely.
 *
 * Storefront mappers take the active locale and return **resolved** records.
 * The `Admin*` mappers do not: an editor edits both languages, so both survive.
 */

import { z } from "zod";

import type { Locale } from "@/src/lib/i18n/config";
import { resolveOptionalText, resolveText } from "@/src/lib/i18n/resolve";
import type {
  AdminAnnouncement,
  AdminMarketingSettings,
  Announcement,
  MarketingSettings,
  ProductPromotion,
  Promotion,
  WelcomeOfferSummary,
} from "@/src/types/marketing";

import { parseList } from "./catalog";

export { parseList };

// ── Announcement ──────────────────────────────────────────────

export const ANNOUNCEMENT_COLUMNS =
  "id, message, message_ar, href, ctaLabel, ctaLabel_ar, isActive, sortOrder, " +
  "startsAt, endsAt, createdAt";

const announcementRowSchema = z.object({
  id: z.string(),
  message: z.string(),
  message_ar: z.string().nullable().default(null),
  href: z.string().nullable().default(null),
  ctaLabel: z.string().nullable().default(null),
  ctaLabel_ar: z.string().nullable().default(null),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().default(0),
  startsAt: z.string().nullable().default(null),
  endsAt: z.string().nullable().default(null),
  createdAt: z.string(),
});

/**
 * The storefront projection.
 *
 * `href` survives only when it is an app path. The column has the same check
 * constraint, and this is the belt to its braces: the value is rendered into an
 * anchor, so a row written before that constraint existed — or by anything that
 * bypasses it — must not become an off-site link in the site header.
 */
export function toAnnouncement(row: unknown, locale: Locale): Announcement | null {
  const parsed = announcementRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { data } = parsed;
  const href =
    data.href !== null && /^\/[A-Za-z0-9/_-]*$/.test(data.href) ? data.href : null;

  return {
    id: data.id,
    message: resolveText(data.message, data.message_ar, locale),
    href,
    ctaLabel:
      href === null
        ? null
        : resolveOptionalText(data.ctaLabel, data.ctaLabel_ar, locale),
  };
}

export function toAdminAnnouncement(row: unknown): AdminAnnouncement | null {
  const parsed = announcementRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { data } = parsed;

  return {
    id: data.id,
    message: data.message,
    messageAr: data.message_ar,
    href: data.href,
    ctaLabel: data.ctaLabel,
    ctaLabelAr: data.ctaLabel_ar,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    createdAt: data.createdAt,
  };
}

// ── MarketingSetting ──────────────────────────────────────────

const announcementModeSchema = z.enum(["STATIC", "MARQUEE", "CAROUSEL"]);

export const MARKETING_SETTING_COLUMNS =
  "announcementsEnabled, announcementMode, announcementIntervalMs, " +
  "offerPopupEnabled, offerPopupDelayMs, offerPopupScrollPercent, " +
  "offerPopupSnoozeDays, offerPopupEyebrow, offerPopupEyebrow_ar, " +
  "offerPopupHeading, offerPopupHeading_ar, offerPopupBody, offerPopupBody_ar, " +
  "offerPopupImageUrl, offerPopupImageAlt, offerPopupImageAlt_ar";

const marketingSettingRowSchema = z.object({
  announcementsEnabled: z.boolean().default(true),
  announcementMode: announcementModeSchema.catch("CAROUSEL"),
  announcementIntervalMs: z.coerce.number().default(5000),
  offerPopupEnabled: z.boolean().default(true),
  offerPopupDelayMs: z.coerce.number().default(18000),
  offerPopupScrollPercent: z.coerce.number().default(25),
  offerPopupSnoozeDays: z.coerce.number().default(30),
  offerPopupEyebrow: z.string().nullable().default(null),
  offerPopupEyebrow_ar: z.string().nullable().default(null),
  offerPopupHeading: z.string(),
  offerPopupHeading_ar: z.string().nullable().default(null),
  offerPopupBody: z.string().nullable().default(null),
  offerPopupBody_ar: z.string().nullable().default(null),
  offerPopupImageUrl: z.string(),
  offerPopupImageAlt: z.string(),
  offerPopupImageAlt_ar: z.string().nullable().default(null),
});

export function toMarketingSettings(
  row: unknown,
  locale: Locale,
): MarketingSettings | null {
  const parsed = marketingSettingRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { data } = parsed;

  return {
    announcementsEnabled: data.announcementsEnabled,
    announcementMode: data.announcementMode,
    announcementIntervalMs: data.announcementIntervalMs,
    offerPopupEnabled: data.offerPopupEnabled,
    offerPopupDelayMs: data.offerPopupDelayMs,
    offerPopupScrollPercent: data.offerPopupScrollPercent,
    offerPopupSnoozeDays: data.offerPopupSnoozeDays,
    offerPopupEyebrow: resolveOptionalText(
      data.offerPopupEyebrow,
      data.offerPopupEyebrow_ar,
      locale,
    ),
    offerPopupHeading: resolveText(
      data.offerPopupHeading,
      data.offerPopupHeading_ar,
      locale,
    ),
    offerPopupBody: resolveOptionalText(
      data.offerPopupBody,
      data.offerPopupBody_ar,
      locale,
    ),
    offerPopupImageUrl: data.offerPopupImageUrl,
    offerPopupImageAlt: resolveText(
      data.offerPopupImageAlt,
      data.offerPopupImageAlt_ar,
      locale,
    ),
  };
}

export function toAdminMarketingSettings(
  row: unknown,
): AdminMarketingSettings | null {
  const parsed = marketingSettingRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { data } = parsed;

  return {
    announcementsEnabled: data.announcementsEnabled,
    announcementMode: data.announcementMode,
    announcementIntervalMs: data.announcementIntervalMs,
    offerPopupEnabled: data.offerPopupEnabled,
    offerPopupDelayMs: data.offerPopupDelayMs,
    offerPopupScrollPercent: data.offerPopupScrollPercent,
    offerPopupSnoozeDays: data.offerPopupSnoozeDays,
    offerPopupEyebrow: data.offerPopupEyebrow,
    offerPopupEyebrowAr: data.offerPopupEyebrow_ar,
    offerPopupHeading: data.offerPopupHeading,
    offerPopupHeadingAr: data.offerPopupHeading_ar,
    offerPopupBody: data.offerPopupBody,
    offerPopupBodyAr: data.offerPopupBody_ar,
    offerPopupImageUrl: data.offerPopupImageUrl,
    offerPopupImageAlt: data.offerPopupImageAlt,
    offerPopupImageAltAr: data.offerPopupImageAlt_ar,
  };
}

// ── Promotion ─────────────────────────────────────────────────

const promotionKindSchema = z.enum(["PERCENTAGE", "FIXED"]);
const promotionScopeSchema = z.enum(["PRODUCTS", "COLLECTIONS"]);

export const PROMOTION_COLUMNS =
  "id, name, description, label, label_ar, kind, value, appliesTo, isActive, " +
  "startsAt, endsAt, stacksWithCodes, priority, createdAt";

const promotionRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().default(null),
  label: z.string().nullable().default(null),
  label_ar: z.string().nullable().default(null),
  kind: promotionKindSchema,
  value: z.coerce.number(),
  appliesTo: promotionScopeSchema.catch("PRODUCTS"),
  isActive: z.boolean().default(true),
  startsAt: z.string().nullable().default(null),
  endsAt: z.string().nullable().default(null),
  stacksWithCodes: z.boolean().default(false),
  priority: z.coerce.number().default(0),
  createdAt: z.string(),
});

export function toPromotion(row: unknown): Promotion | null {
  const parsed = promotionRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { label_ar, ...rest } = parsed.data;
  return { ...rest, labelAr: label_ar };
}

// ── active_product_promotions ─────────────────────────────────

export const PRODUCT_PROMOTION_COLUMNS =
  'productSlug, promotionId, label, label_ar, kind, priceInCents, ' +
  'listPriceInCents, endsAt';

const productPromotionRowSchema = z.object({
  productSlug: z.string(),
  promotionId: z.string(),
  label: z.string().nullable().default(null),
  label_ar: z.string().nullable().default(null),
  kind: promotionKindSchema,
  priceInCents: z.coerce.number(),
  listPriceInCents: z.coerce.number(),
  endsAt: z.string().nullable().default(null),
});

/**
 * One view row, as a slug and the promotion attached to every projection of that
 * product.
 *
 * `percentOff` is computed here rather than stored, from the two prices the view
 * already returns — so a percentage badge on a card and a fixed-amount campaign
 * both print something true, and the badge can never disagree with the numbers
 * beside it. Rounded **down**, matching how the price itself was rounded.
 *
 * A row whose promotional price is not actually lower is dropped. The view's own
 * predicate already excludes those; this is the belt to its braces, because the
 * one thing this projection must never produce is a struck-through price beside
 * an identical one.
 */
export function toProductPromotion(
  row: unknown,
  locale: Locale,
): { slug: string; promotion: ProductPromotion } | null {
  const parsed = productPromotionRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { data } = parsed;
  if (data.listPriceInCents <= 0) return null;
  if (data.priceInCents >= data.listPriceInCents) return null;

  return {
    slug: data.productSlug,
    promotion: {
      promotionId: data.promotionId,
      label: resolveOptionalText(data.label, data.label_ar, locale),
      kind: data.kind,
      priceInCents: data.priceInCents,
      listPriceInCents: data.listPriceInCents,
      percentOff: Math.floor(
        ((data.listPriceInCents - data.priceInCents) * 100) /
          data.listPriceInCents,
      ),
      endsAt: data.endsAt,
    },
  };
}

// ── The welcome offer behind the popup ────────────────────────

const welcomeOfferRowSchema = z.object({
  kind: promotionKindSchema,
  value: z.coerce.number(),
});

export function toWelcomeOfferSummary(row: unknown): WelcomeOfferSummary | null {
  const parsed = welcomeOfferRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

/** What `claim_subscriber_offer()` returns. */
const subscriberOfferSchema = z.object({
  code: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
  issued: z.boolean().default(false),
});

export function toSubscriberOffer(
  row: unknown,
): { code: string | null; expiresAt: string | null; issued: boolean } | null {
  const parsed = subscriberOfferSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}
