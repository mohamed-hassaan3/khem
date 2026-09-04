/**
 * The bands of `/`, as a closed set.
 *
 * `supabase/sql/0043_landing_sections.sql` stores which bands are on and in
 * what order; this file is the other half of that bargain — it says what each
 * key *is*. A row whose key is not here cannot be drawn, and a key here with no
 * row cannot be switched off, so the check constraint in that migration names
 * exactly the keys below and the two are edited together.
 *
 * ## Ground, and why it is declared rather than discovered
 *
 * Each band paints its own ground, and the page alternates ivory and sand so
 * neither runs twice in a row by accident. Recording it here lets the dashboard
 * warn about an ordering that puts two sand bands together — a judgement the
 * renderer cannot make, because by the time it runs the order is already fixed.
 *
 * The hero is the exception that matters: it decides the *header's* ground
 * through `<NavGround>`, so it is pinned first. See the migration's header for
 * what moving it would break.
 */

/** Every band, in the order the page shipped with. */
export const LANDING_SECTION_KEYS = [
  "hero",
  "collections",
  "essences",
  "story",
  "craft",
  "featured",
  "ingredients",
  "journal",
  "testimonials",
  "newsletter",
] as const;

export type LandingSectionKey = (typeof LANDING_SECTION_KEYS)[number];

/** The ground a band paints, for the dashboard's rhythm hint. */
export type SectionGround = "ivory" | "sand" | "photograph";

export interface SectionMeta {
  /** What the dashboard calls it. */
  name: string;
  /** Where its content is edited, when that is somewhere else. */
  source: string;
  ground: SectionGround;
  /** Pinned bands render first and are offered no move control. */
  isPinned: boolean;
}

export const SECTION_REGISTRY: Record<LandingSectionKey, SectionMeta> = {
  hero: {
    name: "Hero",
    source: "The first screen — images or a film, and its overlay. Edited below.",
    ground: "photograph",
    isPinned: true,
  },
  collections: {
    name: "Collections",
    source: "The featured collections rail — Commerce → Collections.",
    ground: "sand",
    isPinned: false,
  },
  essences: {
    name: "Signature fragrances",
    source: "The bestseller rail — Commerce → Products.",
    ground: "ivory",
    isPinned: false,
  },
  story: {
    name: "House story",
    source: "Code-owned copy, in the dictionaries.",
    ground: "sand",
    isPinned: false,
  },
  craft: {
    name: "Craft pillars",
    source: "Edited below.",
    ground: "ivory",
    isPinned: false,
  },
  featured: {
    name: "New Arrival",
    source: "The full-bleed bottle — its product and its media are edited below.",
    ground: "photograph",
    isPinned: false,
  },
  ingredients: {
    name: "Ingredients",
    source: "Content → World of KHEM → Ingredients.",
    ground: "sand",
    isPinned: false,
  },
  journal: {
    name: "Journal",
    source: "Content → World of KHEM → Journal.",
    ground: "ivory",
    isPinned: false,
  },
  testimonials: {
    name: "Testimonials",
    source: "Content → World of KHEM → Testimonials.",
    ground: "ivory",
    isPinned: false,
  },
  newsletter: {
    name: "Newsletter",
    source: "Code-owned copy, in the dictionaries.",
    ground: "sand",
    isPinned: false,
  },
};

/** Narrow an untrusted key — a stored row, or a form field. */
export function parseSectionKey(value: string): LandingSectionKey | null {
  return (
    LANDING_SECTION_KEYS.find((key) => key === value) ?? null
  );
}

/**
 * The New Arrival band's media switch.
 *
 * `FEATURED` is the original behaviour — the featured product's own photograph —
 * and is what an unset row means. The other two are assets belonging to the
 * band rather than to any product; see
 * `supabase/sql/0044_new_arrival_presentation.sql` for why they live here and
 * not on `"Product"`.
 */
export type SectionMediaType = "FEATURED" | "IMAGE" | "FILM";

/**
 * What a band's `settings` may carry.
 *
 * One shape for every band rather than a union, because only New Arrival uses
 * it and a union of one is a worse thing to read. Both fields are optional and
 * the renderer treats a missing `mediaType` as `IMAGES`, which is what the
 * database's check constraint also assumes.
 */
export interface SectionSettings {
  mediaType?: SectionMediaType;
  /** Used when `mediaType` is `FILM`. */
  videoUrl?: string | null;
  /** Used when `mediaType` is `IMAGE` — a banner belonging to this band. */
  imageUrl?: string | null;
  imageAlt?: string | null;

  /*
   * The overrides.
   *
   * Each is a pair: a `show*` flag and an optional value. Hidden means the
   * element is not rendered at all; shown with an empty value means "use the
   * featured product's own", which is what the band did before any of this
   * existed. So a row with none of these set renders exactly what it always
   * rendered — the backward-compatible default is the absence of configuration.
   */
  /**
   * The small line above the title.
   *
   * Shown with an empty value means "use the house wording" — the dictionary's
   * `home.featured.eyebrow`, which is what this line was before it was
   * configurable. Unlike the title and the paragraph it has no product to fall
   * back to: an eyebrow names the *band*, not the bottle.
   */
  showEyebrow?: boolean;
  eyebrow?: string | null;
  showTitle?: boolean;
  title?: string | null;
  showDescription?: boolean;
  description?: string | null;
  showCta?: boolean;
  ctaLabel?: string | null;
  ctaHref?: string | null;
}

/**
 * The band's presentation, with every fallback already applied.
 *
 * Built in one place so the page does not carry nine `??` expressions inline,
 * and so "empty means fall back" is stated once rather than implied nine times.
 */
export interface NewArrivalPresentation {
  mediaType: SectionMediaType;
  videoUrl: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  showEyebrow: boolean;
  /** `null` means the dictionary's house wording — the band has no product
   * eyebrow to inherit. */
  eyebrow: string | null;
  showTitle: boolean;
  title: string | null;
  showDescription: boolean;
  description: string | null;
  showCta: boolean;
  ctaLabel: string | null;
  ctaHref: string | null;
}

/**
 * Resolve the band's settings against the featured product.
 *
 * `product` is what the band falls back to, and may be `null` — a band
 * configured entirely by hand needs no product, though one with no product and
 * no title has nothing to say and the page renders nothing.
 */
export function resolveNewArrival(
  settings: SectionSettings,
  product: { name: string; story: string | null; description: string; slug: string } | null,
): NewArrivalPresentation {
  const trimmed = (value: string | null | undefined) => {
    const text = value?.trim();
    return text ? text : null;
  };

  return {
    // An unset switch is FEATURED, which is what 0043's rows meant by IMAGES.
    mediaType: settings.mediaType ?? "FEATURED",
    videoUrl: trimmed(settings.videoUrl),
    imageUrl: trimmed(settings.imageUrl),
    imageAlt: trimmed(settings.imageAlt),

    showEyebrow: settings.showEyebrow ?? true,
    eyebrow: trimmed(settings.eyebrow),

    showTitle: settings.showTitle ?? true,
    title: trimmed(settings.title) ?? product?.name ?? null,

    showDescription: settings.showDescription ?? true,
    description:
      trimmed(settings.description) ??
      (product ? (product.story ?? product.description) : null),

    showCta: settings.showCta ?? true,
    ctaLabel: trimmed(settings.ctaLabel),
    ctaHref:
      trimmed(settings.ctaHref) ?? (product ? `/perfume/${product.slug}` : null),
  };
}

/** One band, resolved for rendering. */
export interface LandingSection {
  key: LandingSectionKey;
  isEnabled: boolean;
  sortOrder: number;
  isPinned: boolean;
  settings: SectionSettings;
}

/**
 * The order the page renders, given whatever the database returned.
 *
 * Two rules, and both exist so a half-configured table cannot blank the page:
 * a key the registry does not know is dropped, and a registry key with no row
 * is appended as enabled. The pinned band is lifted to the front regardless of
 * its stored position, so no ordering can put the header's ground in doubt.
 */
export function resolveSectionOrder(
  rows: readonly LandingSection[],
): LandingSection[] {
  const byKey = new Map(rows.map((row) => [row.key, row]));

  const resolved = LANDING_SECTION_KEYS.map<LandingSection>((key) => {
    const stored = byKey.get(key);
    const meta = SECTION_REGISTRY[key];

    return (
      stored ?? {
        key,
        isEnabled: true,
        sortOrder: LANDING_SECTION_KEYS.indexOf(key),
        isPinned: meta.isPinned,
        settings: {},
      }
    );
  });

  return resolved.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    // Ties fall back to the shipped order, so a save that assigned the same
    // number twice still renders deterministically.
    return (
      LANDING_SECTION_KEYS.indexOf(a.key) - LANDING_SECTION_KEYS.indexOf(b.key)
    );
  });
}
