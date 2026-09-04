import { z } from "zod";

import {
  LANDING_SECTION_KEYS,
  type LandingSection,
} from "@/src/lib/landing-sections";

/**
 * The `"LandingSection"` row, narrowed on the way out of Postgres.
 *
 * `settings` is `jsonb`, which means the database guarantees it is *valid JSON*
 * and nothing else — the shape is this file's job. A row an editor corrupted, or
 * one written before a field existed, parses to a section with empty settings
 * rather than throwing on the home page.
 */
/**
 * The media switch, accepting 0043's vocabulary as well as 0044's.
 *
 * The migration renames the two stored values, so nothing in the database
 * should still say `IMAGES` or `VIDEO`. They are accepted anyway and mapped,
 * because a row restored from a backup taken before 0044 would otherwise fail
 * to parse and take the whole band down — and this is the one place that can
 * absorb that cheaply.
 */
const mediaType = z
  .enum(["FEATURED", "IMAGE", "FILM", "IMAGES", "VIDEO"])
  .transform((value) =>
    value === "IMAGES" ? "FEATURED" : value === "VIDEO" ? "FILM" : value,
  );

/** An asset address the page will actually load. */
const assetUrl = z
  .string()
  .url()
  .startsWith("https://")
  .nullable()
  .optional();

/** Free text an editor typed. Length-capped so a paste cannot break the band. */
const overrideText = (max: number) =>
  z.string().max(max).nullable().optional();

const settingsSchema = z
  .object({
    mediaType: mediaType.optional(),
    // The `https://` rules are also check constraints in 0044; repeated here so
    // a bad value cannot reach a `<video>` or `<Image>` even if a constraint is
    // ever relaxed.
    videoUrl: assetUrl,
    imageUrl: assetUrl,
    imageAlt: overrideText(200),

    /*
     * The eyebrow — the small line above the title.
     *
     * Read-side and write-side must both know a key or it is silently lost:
     * this object strips what it does not name, so a field added to the save
     * action alone would round-trip to nothing and the band would go on showing
     * the house wording.
     */
    showEyebrow: z.boolean().optional(),
    eyebrow: overrideText(60),
    showTitle: z.boolean().optional(),
    title: overrideText(120),
    showDescription: z.boolean().optional(),
    description: overrideText(600),
    showCta: z.boolean().optional(),
    ctaLabel: overrideText(60),
    // Relative, so the band cannot be pointed off-site from the dashboard.
    ctaHref: z.string().max(200).startsWith("/").nullable().optional(),
  })
  .catch({});

const rowSchema = z.object({
  key: z.enum(LANDING_SECTION_KEYS),
  isEnabled: z.boolean(),
  sortOrder: z.number().int(),
  isPinned: z.boolean(),
  settings: settingsSchema.default({}),
});

export const LANDING_SECTION_COLUMNS =
  "key, isEnabled, sortOrder, isPinned, settings";

/** One row, or `null` when it is not a section this build knows how to draw. */
export function toLandingSection(row: unknown): LandingSection | null {
  const parsed = rowSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}
