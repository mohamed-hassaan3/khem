/**
 * Row schemas for the stockist directory, the contact details, and the legal
 * documents.
 *
 * Same contract as `catalog.ts` and `content.ts`. The interesting one is
 * {@link legalDocumentRowSchema}: `sections` is a jsonb column, so its contents
 * arrive as arbitrary JSON and the block union has to be validated properly.
 * Nothing here ever reaches `dangerouslySetInnerHTML` — the renderer switches
 * on `kind` — but a block with an unexpected `kind` would render as nothing at
 * all, silently, which is exactly the sort of quiet content loss a schema is
 * for.
 */

import { z } from "zod";

import type { Locale } from "@/src/lib/i18n/config";
import { resolveOptionalText, resolveText } from "@/src/lib/i18n/resolve";

import type { ContactChannel, SocialProfile } from "@/src/types/contact";
import type { LegalDocument } from "@/src/types/legal";
import type { Stockist } from "@/src/types/stockist";

// ── Stockist ──────────────────────────────────────────────────

export const STOCKIST_COLUMNS =
  "id, name, name_ar, city, city_ar, country, country_ar, region, type, status, " +
  "address, address_ar, phone, phoneHref, hours, hours_ar, mapsUrl, " +
  "imageUrl, imageAlt, imageAlt_ar";

const stockistRowSchema = z.object({
  id: z.string(),
  // A boutique name is a proper noun; `name_ar` is set only where the name is
  // genuinely Arabic, and falls back to the Latin one otherwise.
  name: z.string(),
  name_ar: z.string().nullable().default(null),
  city: z.string(),
  city_ar: z.string().nullable().default(null),
  country: z.string(),
  country_ar: z.string().nullable().default(null),
  region: z.enum(["middleEast", "europe", "americas", "asiaPacific"]),
  type: z.enum(["flagship", "boutique", "retailPartner", "departmentStore"]),
  status: z.enum(["open", "comingSoon"]),
  address: z.string().nullable(),
  address_ar: z.string().nullable().default(null),
  // `phone`, `phoneHref`, and `mapsUrl` are targets and Latin data — never
  // localized. See `supabase/sql/0008_i18n_content.sql`.
  phone: z.string().nullable(),
  phoneHref: z.string().nullable(),
  hours: z.string().nullable(),
  hours_ar: z.string().nullable().default(null),
  mapsUrl: z.string().nullable(),
  imageUrl: z.string(),
  imageAlt: z.string(),
  imageAlt_ar: z.string().nullable().default(null),
});

export function toStockist(row: unknown, locale: Locale): Stockist | null {
  const parsed = stockistRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const {
    imageUrl,
    imageAlt,
    imageAlt_ar,
    name_ar,
    city_ar,
    country_ar,
    address_ar,
    hours_ar,
    ...stockist
  } = parsed.data;

  return {
    ...stockist,
    name: resolveText(stockist.name, name_ar, locale),
    city: resolveText(stockist.city, city_ar, locale),
    country: resolveText(stockist.country, country_ar, locale),
    address: resolveOptionalText(stockist.address, address_ar, locale),
    hours: resolveOptionalText(stockist.hours, hours_ar, locale),
    image: { url: imageUrl, alt: resolveText(imageAlt, imageAlt_ar, locale) },
  };
}

// ── Contact ───────────────────────────────────────────────────

export const CONTACT_CHANNEL_COLUMNS =
  "id, label, label_ar, value, value_ar, href";

const contactChannelRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  label_ar: z.string().nullable().default(null),
  value: z.string(),
  // Null where the value is an address or a number — Latin in both trees.
  value_ar: z.string().nullable().default(null),
  // `href` is a `mailto:`/`tel:` target and is never localized.
  href: z.string().nullable(),
});

export function toContactChannel(
  row: unknown,
  locale: Locale,
): ContactChannel | null {
  const parsed = contactChannelRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { label_ar, value_ar, ...channel } = parsed.data;

  return {
    ...channel,
    label: resolveText(channel.label, label_ar, locale),
    value: resolveText(channel.value, value_ar, locale),
  };
}

export const SOCIAL_PROFILE_COLUMNS = "id, platform, handle, url";

const socialProfileRowSchema = z.object({
  id: z.string(),
  platform: z.string(),
  handle: z.string(),
  url: z.string(),
});

export function toSocialProfile(row: unknown): SocialProfile | null {
  const parsed = socialProfileRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

// ── Legal documents ───────────────────────────────────────────

const legalTableSchema = z.object({
  head: z.tuple([z.string(), z.string()]),
  rows: z.array(z.tuple([z.string(), z.string()])),
});

/** The closed discriminated union from `src/types/legal.ts`, at runtime. */
const legalBlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("list"), items: z.array(z.string()) }),
  z.object({ kind: z.literal("note"), text: z.string() }),
  z.object({ kind: z.literal("table"), table: legalTableSchema }),
  z.object({
    kind: z.literal("link"),
    text: z.string(),
    /* Always an in-app route: it renders through `next/link`, and a stored
     * absolute URL here would turn a content edit into an open redirect. */
    href: z.string().startsWith("/"),
    label: z.string(),
  }),
]);

const legalSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  blocks: z.array(legalBlockSchema),
});

export const LEGAL_DOCUMENT_COLUMNS =
  "slug, eyebrow, eyebrow_ar, title, title_ar, lede, lede_ar, updatedAt, " +
  "bannerUrl, bannerAlt, bannerAlt_ar, sections, sections_ar, contactEmail";

export const legalDocumentRowSchema = z.object({
  slug: z.enum([
    "privacy-policy",
    "terms-conditions",
    "return-exchange",
    "cookie-policy",
  ]),
  eyebrow: z.string(),
  eyebrow_ar: z.string().nullable().default(null),
  title: z.string(),
  title_ar: z.string().nullable().default(null),
  lede: z.string(),
  lede_ar: z.string().nullable().default(null),
  updatedAt: z.string(),
  bannerUrl: z.string(),
  bannerAlt: z.string(),
  bannerAlt_ar: z.string().nullable().default(null),
  sections: z.array(legalSectionSchema),
  /* The Arabic body is validated by the *same* block union as the English one,
   * so a malformed translation cannot smuggle an unknown `kind` — or an
   * off-site `href` — past the renderer. Nullable: an untranslated policy falls
   * back to the English sections rather than rendering an empty page. */
  sections_ar: z.array(legalSectionSchema).nullable().default(null),
  contactEmail: z.string(),
});

export function toLegalDocument(
  row: unknown,
  locale: Locale,
): LegalDocument | null {
  const parsed = legalDocumentRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const {
    bannerUrl,
    bannerAlt,
    bannerAlt_ar,
    eyebrow_ar,
    title_ar,
    lede_ar,
    sections_ar,
    ...document
  } = parsed.data;

  const isArabic = locale !== "en";

  return {
    ...document,
    eyebrow: resolveText(document.eyebrow, eyebrow_ar, locale),
    title: resolveText(document.title, title_ar, locale),
    lede: resolveText(document.lede, lede_ar, locale),
    sections: isArabic && sections_ar ? sections_ar : document.sections,
    banner: { url: bannerUrl, alt: resolveText(bannerAlt, bannerAlt_ar, locale) },
  };
}

// ── Boutique settings ─────────────────────────────────────────

export const BOUTIQUE_SETTING_COLUMNS =
  "houseEmail, conciergeEmail, wholesaleEmail, featuredProductSlug";

export const boutiqueSettingRowSchema = z.object({
  houseEmail: z.string(),
  conciergeEmail: z.string(),
  wholesaleEmail: z.string(),
  featuredProductSlug: z.string().nullable(),
});

export type BoutiqueSetting = z.infer<typeof boutiqueSettingRowSchema>;

export function toBoutiqueSetting(row: unknown): BoutiqueSetting | null {
  const parsed = boutiqueSettingRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}
