"use server";

/**
 * Editorial content writes — the heritage timeline and the craft pillars.
 *
 * ## Trust model, restated
 *
 * A Server Action is a public HTTP endpoint. `requireAdmin()` is the first
 * statement of every export, and every input is parsed by `schemas/content.ts`
 * before a value reaches a query.
 *
 * ## Why these are twelve near-identical functions rather than two generic ones
 *
 * A single `saveContentRow(table, payload)` would take the table name from the
 * caller — which, for a Server Action, means from the *browser*. That is a
 * request that can name its own table, and the only thing standing between it
 * and any row in the database would be an allowlist doing by hand what the type
 * system does here for free. The repetition is the boundary.
 *
 * The shared parts — id rules, sort order, the create/update/delete triple —
 * are factored in `schemas/content.ts` instead, where they are data rather than
 * a target.
 *
 * ## Every write revalidates
 *
 * `/heritage` and the home page are both ISR. Which surface reads what is
 * recorded in `revalidateHeritage()` and `revalidateCraftPillars()`.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import {
  revalidateAbout,
  revalidateBrandValues,
  revalidateCraftPillars,
  revalidateCraftsmanship,
  revalidateHeritage,
  revalidateHero,
  revalidateIngredients,
  revalidateHome,
} from "@/src/lib/admin/revalidate";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import type { AdminActionResult } from "@/src/schemas/admin";
import {
  createBrandValueSchema,
  createCraftPillarSchema,
  createCraftQuoteSchema,
  createCraftStatSchema,
  createCraftStepSchema,
  createIngredientSchema,
  createMissionStatementSchema,
  createTimelineEventSchema,
  createTestimonialSchema,
  deleteIngredientSchema,
  setIngredientProductsSchema,
  updateIngredientSchema,
  deleteBrandValueSchema,
  deleteCraftPillarSchema,
  deleteCraftQuoteSchema,
  deleteCraftStatSchema,
  deleteCraftStepSchema,
  deleteMissionStatementSchema,
  deleteTimelineEventSchema,
  deleteTestimonialSchema,
  heroSchema,
  updateBrandValueSchema,
  updateCraftPillarSchema,
  updateCraftQuoteSchema,
  updateCraftStatSchema,
  updateCraftStepSchema,
  updateMissionStatementSchema,
  updateTimelineEventSchema,
  updateTestimonialSchema,
} from "@/src/schemas/content";

import {
  UNCONFIGURED,
  fieldErrorsFrom,
  postgresFailure,
  type PostgresErrorLike,
} from "./shared";

/**
 * The three statements every content row shares.
 *
 * Takes the table as a **literal from this module**, never from a payload —
 * see the header. Each exported action names its own.
 */
async function insertRow(
  table: string,
  values: Record<string, unknown>,
  actor: string,
  revalidate: () => void,
  created: string,
): Promise<AdminActionResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase.from(table).insert(values);

  if (error) {
    console.error(`[admin] create ${table} rejected (${actor}): ${error.message}`);
    return postgresFailure(error as PostgresErrorLike, "collection");
  }

  revalidate();
  console.info(`[admin] ${table} created by ${actor} → ${String(values.id)}`);

  return { ok: true, slug: String(values.id), message: created };
}

async function updateRow(
  table: string,
  id: string,
  values: Record<string, unknown>,
  actor: string,
  revalidate: () => void,
  saved: string,
): Promise<AdminActionResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from(table)
    .update(values)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[admin] update ${table} rejected (${actor}): ${error.message}`);
    return postgresFailure(error as PostgresErrorLike, "collection");
  }

  if (!data) return { ok: false, message: "That row no longer exists." };

  revalidate();
  console.info(`[admin] ${table} updated by ${actor} → ${id}`);

  return { ok: true, slug: id, message: saved };
}

async function deleteRow(
  table: string,
  id: string,
  actor: string,
  revalidate: () => void,
): Promise<AdminActionResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[admin] delete ${table} rejected (${actor}): ${error.message}`);
    return postgresFailure(error as PostgresErrorLike, "collection");
  }

  if (!data) return { ok: false, message: "That row no longer exists." };

  revalidate();
  console.info(`[admin] ${table} deleted by ${actor} → ${id}`);

  return { ok: true, slug: id, message: "Removed." };
}

function invalid(error: Parameters<typeof fieldErrorsFrom>[0]): AdminActionResult {
  return {
    ok: false,
    message: "Some fields need attention.",
    fieldErrors: fieldErrorsFrom(error),
  };
}

// ── Testimonial ──────────────────────────────────────────────

export async function createTestimonial(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();
  const parsed = createTestimonialSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  return insertRow(
    "Testimonial",
    parsed.data,
    actor.email,
    revalidateHome,
    `“${parsed.data.author}” added.`,
  );
}

export async function updateTestimonial(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();
  const parsed = updateTestimonialSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...values } = parsed.data;
  return updateRow(
    "Testimonial",
    id,
    values,
    actor.email,
    revalidateHome,
    `“${parsed.data.author}” saved.`,
  );
}

export async function deleteTestimonial(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();
  const parsed = deleteTestimonialSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid row." };

  return deleteRow("Testimonial", parsed.data.id, actor.email, revalidateHome);
}

// ── TimelineEvent ─────────────────────────────────────────────

export async function createTimelineEvent(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createTimelineEventSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  return insertRow(
    "TimelineEvent",
    parsed.data,
    actor.email,
    revalidateHeritage,
    `“${parsed.data.title}” added to the timeline.`,
  );
}

export async function updateTimelineEvent(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateTimelineEventSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...values } = parsed.data;

  return updateRow(
    "TimelineEvent",
    id,
    values,
    actor.email,
    revalidateHeritage,
    `“${parsed.data.title}” saved.`,
  );
}

export async function deleteTimelineEvent(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = deleteTimelineEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid row." };

  return deleteRow("TimelineEvent", parsed.data.id, actor.email, revalidateHeritage);
}

// ── CraftPillar ───────────────────────────────────────────────

export async function createCraftPillar(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createCraftPillarSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  return insertRow(
    "CraftPillar",
    parsed.data,
    actor.email,
    revalidateCraftPillars,
    `“${parsed.data.title}” added.`,
  );
}

export async function updateCraftPillar(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateCraftPillarSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...values } = parsed.data;

  return updateRow(
    "CraftPillar",
    id,
    values,
    actor.email,
    revalidateCraftPillars,
    `“${parsed.data.title}” saved.`,
  );
}

export async function deleteCraftPillar(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = deleteCraftPillarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid row." };

  return deleteRow(
    "CraftPillar",
    parsed.data.id,
    actor.email,
    revalidateCraftPillars,
  );
}

// ── BrandValue ───────────────────────────────────────────────

export async function createBrandValue(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createBrandValueSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  return insertRow(
    "BrandValue",
    parsed.data,
    actor.email,
    revalidateBrandValues,
    `“${parsed.data.title}” added.`,
  );
}

export async function updateBrandValue(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateBrandValueSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...values } = parsed.data;

  return updateRow(
    "BrandValue",
    id,
    values,
    actor.email,
    revalidateBrandValues,
    `“${parsed.data.title}” saved.`,
  );
}

export async function deleteBrandValue(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = deleteBrandValueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid row." };

  return deleteRow("BrandValue", parsed.data.id, actor.email, revalidateBrandValues);
}

// ── MissionStatement ───────────────────────────────────────────────

export async function createMissionStatement(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createMissionStatementSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  return insertRow(
    "MissionStatement",
    parsed.data,
    actor.email,
    revalidateAbout,
    `“${parsed.data.title}” added.`,
  );
}

export async function updateMissionStatement(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateMissionStatementSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...values } = parsed.data;

  return updateRow(
    "MissionStatement",
    id,
    values,
    actor.email,
    revalidateAbout,
    `“${parsed.data.title}” saved.`,
  );
}

export async function deleteMissionStatement(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = deleteMissionStatementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid row." };

  return deleteRow("MissionStatement", parsed.data.id, actor.email, revalidateAbout);
}

// ── CraftStep ───────────────────────────────────────────────

export async function createCraftStep(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createCraftStepSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  return insertRow(
    "CraftStep",
    parsed.data,
    actor.email,
    revalidateCraftsmanship,
    `“${parsed.data.title}” added.`,
  );
}

export async function updateCraftStep(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateCraftStepSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...values } = parsed.data;

  return updateRow(
    "CraftStep",
    id,
    values,
    actor.email,
    revalidateCraftsmanship,
    `“${parsed.data.title}” saved.`,
  );
}

export async function deleteCraftStep(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = deleteCraftStepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid row." };

  return deleteRow("CraftStep", parsed.data.id, actor.email, revalidateCraftsmanship);
}

// ── CraftStat ───────────────────────────────────────────────

export async function createCraftStat(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createCraftStatSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  return insertRow(
    "CraftStat",
    parsed.data,
    actor.email,
    revalidateCraftsmanship,
    `“${parsed.data.label}” added.`,
  );
}

export async function updateCraftStat(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateCraftStatSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...values } = parsed.data;

  return updateRow(
    "CraftStat",
    id,
    values,
    actor.email,
    revalidateCraftsmanship,
    `“${parsed.data.label}” saved.`,
  );
}

export async function deleteCraftStat(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = deleteCraftStatSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid row." };

  return deleteRow("CraftStat", parsed.data.id, actor.email, revalidateCraftsmanship);
}

// ── CraftQuote ───────────────────────────────────────────────

export async function createCraftQuote(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createCraftQuoteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  return insertRow(
    "CraftQuote",
    parsed.data,
    actor.email,
    revalidateCraftsmanship,
    `“${parsed.data.author}” added.`,
  );
}

export async function updateCraftQuote(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateCraftQuoteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { id, ...values } = parsed.data;

  return updateRow(
    "CraftQuote",
    id,
    values,
    actor.email,
    revalidateCraftsmanship,
    `“${parsed.data.author}” saved.`,
  );
}

export async function deleteCraftQuote(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = deleteCraftQuoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid row." };

  return deleteRow("CraftQuote", parsed.data.id, actor.email, revalidateCraftsmanship);
}

// ── Ingredient ────────────────────────────────────────────

/**
 * Materials are not `insertRow`/`updateRow` like the rows above.
 *
 * Two things make them their own case. The write can fail inside a **trigger**
 * — `assert_ingredient_families()` raises for a family that is not in
 * `"IngredientFamily"` — and that message is written for a developer, not for
 * the desk. And the surfaces to revalidate depend on the row: a material is
 * printed on the detail page of every product it is used in.
 */
function ingredientFailure(error: PostgresErrorLike): AdminActionResult {
  const message = error.message ?? "";

  // Raised by `assert_ingredient_families()` in `0002_content.sql`. The schema
  // restricts the form to the seven known families, so reaching this means the
  // enum and the table have drifted apart — worth saying plainly rather than
  // surfacing "unknown olfactive family: X" from a trigger.
  if (message.includes("unknown olfactive family")) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: {
        families:
          "That olfactive family is not in the database's vocabulary. The seven offered here are the only ones the site can render.",
      },
    };
  }

  if (error.code === "23505") {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: { slug: "Another material already uses that slug." },
    };
  }

  return postgresFailure(error, "collection");
}

/** Which products this material is currently printed on. */
async function productSlugsFor(ingredientId: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data } = await supabase
    .from("IngredientUsage")
    .select("productSlug")
    .eq("ingredientId", ingredientId);

  return (data ?? [])
    .map((row) => (typeof row.productSlug === "string" ? row.productSlug : ""))
    .filter((slug) => slug.length > 0);
}

export async function createIngredient(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createIngredientSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { error } = await supabase.from("Ingredient").insert(parsed.data);

  if (error) {
    console.error(`[admin] createIngredient rejected (${actor.email}): ${error.message}`);
    return ingredientFailure(error as PostgresErrorLike);
  }

  // A new material is in no product yet, so only the two index surfaces change.
  revalidateIngredients();
  console.info(`[admin] ingredient created by ${actor.email} → ${parsed.data.slug}`);

  return {
    ok: true,
    slug: parsed.data.slug,
    message: `${parsed.data.name} added.`,
  };
}

export async function updateIngredient(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateIngredientSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { id, ...values } = parsed.data;

  // Read before writing: the products this material appears on are what decides
  // which detail pages went stale, and the row is about to change.
  const affected = await productSlugsFor(id);

  const { data, error } = await supabase
    .from("Ingredient")
    .update(values)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[admin] updateIngredient rejected (${actor.email}): ${error.message}`);
    return ingredientFailure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "That material no longer exists." };

  revalidateIngredients(affected);
  console.info(`[admin] ingredient updated by ${actor.email} → ${id}`);

  return { ok: true, slug: parsed.data.slug, message: `${parsed.data.name} saved.` };
}

/**
 * Remove a material.
 *
 * Its usage rows go with it — `"IngredientUsage"."ingredientId"` cascades — so
 * the products it was printed on are revalidated too, and they are read before
 * the delete for the same reason as above.
 */
export async function deleteIngredient(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = deleteIngredientSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That is not a valid material." };

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const affected = await productSlugsFor(parsed.data.id);

  const { data, error } = await supabase
    .from("Ingredient")
    .delete()
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[admin] deleteIngredient rejected (${actor.email}): ${error.message}`);
    return ingredientFailure(error as PostgresErrorLike);
  }

  if (!data) return { ok: false, message: "That material no longer exists." };

  revalidateIngredients(affected);
  console.info(`[admin] ingredient deleted by ${actor.email} → ${parsed.data.id}`);

  return { ok: true, slug: parsed.data.id, message: "Material removed." };
}

/**
 * Set which perfumes a material is printed on.
 *
 * A **diff**, not a delete-then-reinsert. Clearing the set and rewriting it
 * would churn every row's id on every save and, more to the point, would leave
 * the material in no product at all if the second half failed.
 *
 * The display name is snapshotted from `"Product"` at the moment of linking —
 * that is what `"IngredientUsage"."name"` is for, so rendering the link never
 * needs the product row. A product renamed later keeps the name it had here
 * until somebody re-links it, which is the same trade `"OrderItem"` makes.
 */
export async function setIngredientProducts(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = setIngredientProductsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That is not a valid set of perfumes." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { ingredientId, productSlugs } = parsed.data;
  const existing = await productSlugsFor(ingredientId);

  const wanted = new Set(productSlugs);
  const held = new Set(existing);

  const toAdd = productSlugs.filter((slug) => !held.has(slug));
  const toRemove = existing.filter((slug) => !wanted.has(slug));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("IngredientUsage")
      .delete()
      .eq("ingredientId", ingredientId)
      .in("productSlug", toRemove);

    if (error) {
      console.error(`[admin] unlink ingredient rejected (${actor.email}): ${error.message}`);
      return postgresFailure(error as PostgresErrorLike, "product");
    }
  }

  if (toAdd.length > 0) {
    // The names come from the catalog, never from the form: a request that
    // could name its own product could print a label for something else.
    const { data: products, error: lookupError } = await supabase
      .from("Product")
      .select("slug, name")
      .in("slug", toAdd);

    if (lookupError) {
      console.error(`[admin] product lookup failed (${actor.email}): ${lookupError.message}`);
      return postgresFailure(lookupError as PostgresErrorLike, "product");
    }

    const rows = (products ?? []).map((product, index) => ({
      id: `${ingredientId}-${String(product.slug)}`,
      ingredientId,
      productSlug: String(product.slug),
      name: String(product.name),
      sortOrder: existing.length + index,
    }));

    if (rows.length !== toAdd.length) {
      return {
        ok: false,
        message: "One of those perfumes no longer exists. Reload and try again.",
      };
    }

    const { error } = await supabase.from("IngredientUsage").insert(rows);

    if (error) {
      console.error(`[admin] link ingredient rejected (${actor.email}): ${error.message}`);
      return postgresFailure(error as PostgresErrorLike, "product");
    }
  }

  // Both the pages it left and the pages it joined are now stale.
  revalidateIngredients([...existing, ...productSlugs]);
  console.info(
    `[admin] ${actor.email} set ${ingredientId} on ${productSlugs.length} product(s)`,
  );

  return {
    ok: true,
    slug: ingredientId,
    message:
      productSlugs.length === 0
        ? "This material is no longer printed on any perfume."
        : `Printed on ${productSlugs.length} perfume${productSlugs.length === 1 ? "" : "s"}.`,
  };
}

// ── The landing-page hero ─────────────────────────────────────

/**
 * The hero, saved as a whole.
 *
 * ## Why one action and not five
 *
 * The settings row and the slides are one decision. A save that wrote the media
 * type but not the images could leave `VIDEO` selected with no film, or an
 * images hero with the previous campaign's photographs — both of which are
 * broken above the fold on the site's most-visited page. So the form submits
 * everything it holds and this writes everything, every time.
 *
 * ## The slides are a set, not rows
 *
 * The editor sends the list it wants to exist. This removes what is no longer in
 * it, updates what stayed, inserts what is new, and assigns `sortOrder` from the
 * array position — so what the dashboard shows top to bottom is exactly what the
 * hero fades through, and re-submitting the same list twice is a no-op.
 *
 * PostgREST gives no transaction across those statements. The order is chosen so
 * that the worst interruption is survivable: settings first, then removals, then
 * updates, then insertions. A failure part-way leaves a hero that still renders
 * — some slides missing, never a slide pointing at nothing — and the editor's
 * next save reconciles it.
 *
 * ## No ceiling
 *
 * One image is a static hero; two or more rotate. Nothing here counts them.
 */
export async function saveHero(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = heroSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const hero = parsed.data;

  const settings = await supabase
    .from("HeroSetting")
    .update({
      mediaType: hero.mediaType,
      contentPosition: hero.contentPosition,
      slideDurationMs: hero.slideDurationMs,
      videoUrl: hero.videoUrl,
      videoPosterUrl: hero.videoPosterUrl,
      videoAlt: hero.videoAlt,
      videoAlt_ar: hero.videoAltAr,
      showHeadline: hero.showHeadline,
      showDescription: hero.showDescription,
      showButton: hero.showButton,
      headline: hero.headline,
      headline_ar: hero.headlineAr,
      description: hero.description,
      description_ar: hero.descriptionAr,
      buttonLabel: hero.buttonLabel,
      buttonLabel_ar: hero.buttonLabelAr,
      buttonHref: hero.buttonHref,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", "default");

  if (settings.error) {
    console.error(`[admin] saveHero rejected (${actor.email}): ${settings.error.message}`);
    return postgresFailure(settings.error as PostgresErrorLike, "hero");
  }

  const keptIds = hero.slides
    .map((slide) => slide.id)
    .filter((id): id is string => id !== null);

  /*
   * `neq("id", "")` when nothing is kept: PostgREST refuses a delete with no
   * filter, and an id is a uuid string, so this matches every row. `not in`
   * with an empty list would be a syntax error rather than "delete everything".
   */
  const removal =
    keptIds.length > 0
      ? await supabase
          .from("HeroSlide")
          .delete()
          .not("id", "in", `(${keptIds.join(",")})`)
      : await supabase.from("HeroSlide").delete().neq("id", "");

  if (removal.error) {
    console.error(`[admin] saveHero slide removal failed (${actor.email}): ${removal.error.message}`);
    return postgresFailure(removal.error as PostgresErrorLike, "hero");
  }

  for (const [index, slide] of hero.slides.entries()) {
    if (slide.id === null) continue;

    const { error } = await supabase
      .from("HeroSlide")
      .update({
        imageUrl: slide.imageUrl,
        alt: slide.alt,
        alt_ar: slide.altAr,
        sortOrder: index,
      })
      .eq("id", slide.id);

    if (error) {
      console.error(`[admin] saveHero slide update failed (${actor.email}): ${error.message}`);
      return postgresFailure(error as PostgresErrorLike, "hero");
    }
  }

  const additions = hero.slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => slide.id === null)
    .map(({ slide, index }) => ({
      imageUrl: slide.imageUrl,
      alt: slide.alt,
      alt_ar: slide.altAr,
      sortOrder: index,
    }));

  if (additions.length > 0) {
    const { error } = await supabase.from("HeroSlide").insert(additions);

    if (error) {
      console.error(`[admin] saveHero slide insert failed (${actor.email}): ${error.message}`);
      return postgresFailure(error as PostgresErrorLike, "hero");
    }
  }

  revalidateHero();
  console.info(`[admin] hero saved by ${actor.email}`);

  // `slug` is the row's identity in `AdminActionResult`; this table holds one
  // row, and "default" is what its primary key says.
  return { ok: true, slug: "default", message: "Hero saved." };
}
