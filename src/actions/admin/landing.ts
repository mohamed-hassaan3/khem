"use server";

/**
 * The home page's shape.
 *
 * Order and visibility only — the copy inside each band is edited where that
 * band's records live (Collections, Products, Ingredients, Journal), and the
 * headings between them stay in the typed dictionaries. `/admin/content/landing`
 * says which is which, and that honesty is the screen's main job.
 *
 * Same contract as every action in this directory: `requireAdmin()` first, Zod
 * before the query, the provider's message to the log and a sentence to the
 * editor.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import { revalidateHome } from "@/src/lib/admin/revalidate";
import {
  LANDING_SECTION_KEYS,
  SECTION_REGISTRY,
  type LandingSectionKey,
} from "@/src/lib/landing-sections";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  moveSectionSchema,
  newArrivalSchema,
  toggleSectionSchema,
  type AdminActionResult,
} from "@/src/schemas/landing";

import { UNCONFIGURED, fieldErrorsFrom, postgresFailure } from "./shared";

/** Switch a band on or off. */
export async function toggleSection(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = toggleSectionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase
    .from("LandingSection")
    .update({ isEnabled: parsed.data.isEnabled, updatedAt: new Date().toISOString() })
    .eq("key", parsed.data.key);

  if (error) {
    console.error(`[admin] toggleSection failed: ${error.message}`);
    return postgresFailure(error, "section");
  }

  console.info(
    `[admin] ${actor.email} turned ${parsed.data.key} ${parsed.data.isEnabled ? "on" : "off"}`,
  );

  await revalidateHome();

  // `slug` is the result contract's identifier field; a section's is its key.
  return {
    ok: true,
    slug: parsed.data.key,
    message: `${SECTION_REGISTRY[parsed.data.key].name} is ${parsed.data.isEnabled ? "showing" : "hidden"}.`,
  };
}

/**
 * Move a band one position up or down.
 *
 * The whole column is rewritten from the resulting list rather than two rows
 * being swapped, which is how `"HeroSlide"` assigns its `sortOrder` too: after
 * any save the stored numbers are exactly the printed positions, so a gap or a
 * duplicate left by an earlier bug heals on the next move instead of persisting.
 *
 * The pinned band is never part of the movable list, so no reordering can put
 * the header's ground in doubt — see `src/lib/landing-sections.ts`.
 */
export async function moveSection(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = moveSectionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error: readError } = await supabase
    .from("LandingSection")
    .select("key, sortOrder, isPinned")
    .order("sortOrder");

  if (readError) {
    console.error(`[admin] moveSection read failed: ${readError.message}`);
    return postgresFailure(readError, "section");
  }

  const movable = (data ?? [])
    .filter((row) => !(row as { isPinned: boolean }).isPinned)
    .map((row) => (row as { key: string }).key as LandingSectionKey)
    .filter((key) => LANDING_SECTION_KEYS.includes(key));

  const from = movable.indexOf(parsed.data.key);
  if (from === -1) {
    return { ok: false, message: "That section cannot be moved." };
  }

  const to = from + (parsed.data.direction === "up" ? -1 : 1);
  if (to < 0 || to >= movable.length) {
    // Already at the end of its travel. Not an error — the button should have
    // been disabled — so this reports success without writing.
    return { ok: true, slug: parsed.data.key, message: "Already there." };
  }

  const reordered = [...movable];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);

  // Positions start at 1: the pinned hero holds 0 and never moves.
  for (const [index, key] of reordered.entries()) {
    const { error } = await supabase
      .from("LandingSection")
      .update({ sortOrder: index + 1, updatedAt: new Date().toISOString() })
      .eq("key", key);

    if (error) {
      console.error(`[admin] moveSection write failed on ${key}: ${error.message}`);
      return postgresFailure(error, "section");
    }
  }

  console.info(`[admin] ${actor.email} moved ${parsed.data.key} ${parsed.data.direction}`);

  await revalidateHome();

  return {
    ok: true,
    slug: parsed.data.key,
    message: `${SECTION_REGISTRY[parsed.data.key].name} moved ${parsed.data.direction}.`,
  };
}

/**
 * The New Arrival band, saved as one.
 *
 * Two tables, one submit, and deliberately: the featured product lives on
 * `"BoutiqueSetting"` — it is the single answer to "which product is featured"
 * and copying it into the section's settings would create exactly the second
 * source of truth this change exists to avoid. So the column stays put and only
 * its *editor* moved onto this screen. `/admin/settings` no longer offers it.
 *
 * The product is written first. If it fails the band's settings are untouched,
 * which is the harmless order: a saved product with unsaved styling still
 * renders, where saved styling pointing at an unsaved product would not.
 */
export async function updateNewArrival(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = newArrivalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { featuredProductSlug, ...presentation } = parsed.data;

  const { error: productError } = await supabase
    .from("BoutiqueSetting")
    .update({
      featuredProductSlug: featuredProductSlug ?? null,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", "default");

  if (productError) {
    console.error(`[admin] updateNewArrival product failed: ${productError.message}`);
    return postgresFailure(productError, "section");
  }

  /*
   * Only the fields the chosen media actually uses are stored.
   *
   * A film address left behind by a switch back to FEATURED would be invisible
   * configuration — inert until someone chose FILM again and got a URL they did
   * not type. Clearing it is what keeps the stored row and the screen the same
   * thing.
   */
  const settings = {
    mediaType: presentation.mediaType,
    videoUrl: presentation.mediaType === "FILM" ? presentation.videoUrl : null,
    imageUrl: presentation.mediaType === "IMAGE" ? presentation.imageUrl : null,
    imageAlt: presentation.mediaType === "IMAGE" ? presentation.imageAlt : null,
    showTitle: presentation.showTitle,
    title: presentation.title ?? null,
    showDescription: presentation.showDescription,
    description: presentation.description ?? null,
    showCta: presentation.showCta,
    ctaLabel: presentation.ctaLabel ?? null,
    ctaHref: presentation.ctaHref ?? null,
  };

  const { error } = await supabase
    .from("LandingSection")
    .update({ settings, updatedAt: new Date().toISOString() })
    .eq("key", "featured");

  if (error) {
    console.error(`[admin] updateNewArrival failed: ${error.message}`);
    return postgresFailure(error, "section");
  }

  console.info(`[admin] ${actor.email} saved New Arrival (${presentation.mediaType})`);

  await revalidateHome();

  return { ok: true, slug: "featured", message: "New Arrival saved." };
}
