import { z } from "zod";

import { LANDING_SECTION_KEYS } from "@/src/lib/landing-sections";

export type { AdminActionResult } from "@/src/schemas/orders";

/**
 * What the landing screen may ask of the database.
 *
 * The key is narrowed against the registry rather than accepted as text: a
 * section exists because `src/lib/landing-sections.ts` can draw it, so a form
 * field naming anything else is a bug, not a new section.
 */
const sectionKey = z.enum(LANDING_SECTION_KEYS, {
  error: "That is not a section of the home page.",
});

export const toggleSectionSchema = z.object({
  key: sectionKey,
  isEnabled: z.coerce.boolean(),
});

export const moveSectionSchema = z.object({
  key: sectionKey,
  direction: z.enum(["up", "down"], { error: "Up or down." }),
});

/**
 * The New Arrival band, whole.
 *
 * One schema rather than one per field, because the band is saved as a unit and
 * its rules are about combinations: `FILM` needs a film, `IMAGE` needs an image.
 * Splitting them would mean a form that could save half a valid state.
 *
 * Empty strings are normalised to `null` on the way in, so "cleared" and "never
 * set" are the same stored value — and both mean "fall back to the product",
 * which is the behaviour this band had before it was configurable.
 */
const blankToNull = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

const text = (max: number, message: string) =>
  blankToNull.refine((value) => value === null || value === undefined || value.length <= max, {
    error: message,
  });

export const newArrivalSchema = z
  .object({
    mediaType: z.enum(["FEATURED", "IMAGE", "FILM"], {
      error: "Choose the featured product’s media, an image, or a film.",
    }),

    videoUrl: blankToNull,
    imageUrl: blankToNull,
    imageAlt: text(200, "Please shorten that description."),

    showTitle: z.coerce.boolean(),
    title: text(120, "Please shorten the title."),
    showDescription: z.coerce.boolean(),
    description: text(600, "Please shorten the description."),
    showCta: z.coerce.boolean(),
    ctaLabel: text(60, "Please shorten the button label."),
    ctaHref: blankToNull,

    /**
     * Which product the band features.
     *
     * Stored on `"BoutiqueSetting"`, not here — this field is the *editor* for
     * that column, moved onto this screen so the band is configured in one
     * place.
     *
     * Empty is legal and means "this band features no single product": it
     * carries its own banner or film and its own copy. It is *not* how the band
     * is switched off — that is `"LandingSection"."isEnabled"`, and letting this
     * field mean it too was the second visibility system the storefront then
     * disagreed with. The refinement below is the one combination that cannot
     * work: FEATURED media with no product to take the photograph from.
     */
    featuredProductSlug: blankToNull,
  })
  .refine(
    (value) =>
      value.mediaType !== "FEATURED" ||
      (typeof value.featuredProductSlug === "string" &&
        value.featuredProductSlug.length > 0),
    {
      error:
        "Featured media takes the product’s own photograph — choose a product, or switch to Image or Film.",
      path: ["featuredProductSlug"],
    },
  )
  .refine(
    (value) =>
      value.mediaType !== "FILM" ||
      (typeof value.videoUrl === "string" && value.videoUrl.startsWith("https://")),
    { error: "A film needs an https:// address.", path: ["videoUrl"] },
  )
  .refine(
    (value) =>
      value.mediaType !== "IMAGE" ||
      (typeof value.imageUrl === "string" && value.imageUrl.startsWith("https://")),
    { error: "A banner needs an https:// address.", path: ["imageUrl"] },
  )
  .refine(
    (value) =>
      value.ctaHref === null ||
      value.ctaHref === undefined ||
      value.ctaHref.startsWith("/"),
    {
      error: "A link must stay on the site — start it with “/”.",
      path: ["ctaHref"],
    },
  );
