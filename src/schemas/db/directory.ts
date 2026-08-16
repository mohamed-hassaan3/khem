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

import type { ContactChannel, SocialProfile } from "@/src/types/contact";
import type { LegalDocument } from "@/src/types/legal";
import type { Stockist } from "@/src/types/stockist";

// ── Stockist ──────────────────────────────────────────────────

export const STOCKIST_COLUMNS =
  "id, name, city, country, region, type, status, address, phone, phoneHref, " +
  "hours, mapsUrl, imageUrl, imageAlt";

const stockistRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  country: z.string(),
  region: z.enum(["middleEast", "europe", "americas", "asiaPacific"]),
  type: z.enum(["flagship", "boutique", "retailPartner", "departmentStore"]),
  status: z.enum(["open", "comingSoon"]),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  phoneHref: z.string().nullable(),
  hours: z.string().nullable(),
  mapsUrl: z.string().nullable(),
  imageUrl: z.string(),
  imageAlt: z.string(),
});

export function toStockist(row: unknown): Stockist | null {
  const parsed = stockistRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { imageUrl, imageAlt, ...stockist } = parsed.data;
  return { ...stockist, image: { url: imageUrl, alt: imageAlt } };
}

// ── Contact ───────────────────────────────────────────────────

export const CONTACT_CHANNEL_COLUMNS = "id, label, value, href";

const contactChannelRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  href: z.string().nullable(),
});

export function toContactChannel(row: unknown): ContactChannel | null {
  const parsed = contactChannelRowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
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
  "slug, eyebrow, title, lede, updatedAt, bannerUrl, bannerAlt, sections, contactEmail";

export const legalDocumentRowSchema = z.object({
  slug: z.enum([
    "privacy-policy",
    "terms-conditions",
    "return-exchange",
    "cookie-policy",
  ]),
  eyebrow: z.string(),
  title: z.string(),
  lede: z.string(),
  updatedAt: z.string(),
  bannerUrl: z.string(),
  bannerAlt: z.string(),
  sections: z.array(legalSectionSchema),
  contactEmail: z.string(),
});

export function toLegalDocument(row: unknown): LegalDocument | null {
  const parsed = legalDocumentRowSchema.safeParse(row);
  if (!parsed.success) return null;

  const { bannerUrl, bannerAlt, ...document } = parsed.data;
  return { ...document, banner: { url: bannerUrl, alt: bannerAlt } };
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
