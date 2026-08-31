"use server";

/**
 * Catalog writes — collections, products, product galleries.
 *
 * ## The trust model, restated because this is the file it matters in
 *
 * A Server Action is a public HTTP endpoint. It does not inherit the protection
 * of the page that rendered its form, and an attacker who knows the action id
 * never sees that page at all. So `requireAdmin()` is the **first statement of
 * every exported function here**, not something the layout did earlier — and
 * the input is parsed by `schemas/admin.ts` before a single value reaches a
 * query, no matter what the form already checked.
 *
 * These are the first writes in the repository to touch the catalog. They use
 * `getSupabaseAdmin()` because `supabase/sql/0006_privileges.sql` deliberately
 * leaves `anon` and `authenticated` with no write grant at all; the service key
 * is the only way in, which is exactly the arrangement that file argues for.
 * **No RLS policy or grant was added to make this work, and none should be.**
 *
 * ## What is never written
 *
 * `search_document` and `search_vector` are generated columns — Postgres
 * composes them and PostgREST rejects an attempt to set them. `embedding` is
 * written only by {@link refreshProductEmbedding}, after the row is already
 * saved, and only ever as a follow-up update.
 *
 * ## Logging
 *
 * Actor, action, slug. Never a row body, never a key, never the editor's draft
 * text. Failures carry the provider's message because that is what makes a
 * constraint violation diagnosable.
 */

import { requireAdmin } from "@/src/lib/admin/auth";
import {
  revalidateCollection,
  revalidateMerchPage,
  revalidateProduct,
} from "@/src/lib/admin/revalidate";
import { embedDocument, toVectorLiteral } from "@/src/lib/search/embed";
import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  createCollectionSchema,
  createProductSchema,
  saveProductImagesSchema,
  setProductArchivedSchema,
  updateCollectionSchema,
  updateMerchPageSchema,
  updateProductSchema,
  type AdminActionResult,
} from "@/src/schemas/admin";
import { getAdminCollection } from "@/src/services/admin/catalog";
import type { CollectionKind, ProductTag } from "@/src/types/catalog";

import {
  UNCONFIGURED,
  fieldErrorsFrom,
  postgresFailure,
  type PostgresErrorLike,
} from "./shared";

/**
 * Look up the parent collection so a product write knows which public routes to
 * revalidate — and, on create, whether the collection exists at all.
 *
 * The foreign key would catch a missing collection anyway; catching it here
 * turns a constraint code into a sentence naming the field.
 */
async function resolveCollectionKind(
  collectionSlug: string,
): Promise<CollectionKind | null> {
  const collection = await getAdminCollection(collectionSlug);
  return collection?.kind ?? null;
}

/**
 * Give a saved product a vector, best effort.
 *
 * `search_document` is a generated column, so the text that gets embedded has
 * to be read back from the database rather than rebuilt here — that is the
 * whole point of the column, and rebuilding it in TypeScript is the drift the
 * search schema was written to eliminate.
 *
 * Every failure path is a warning and a return, never a thrown error: the row
 * is already saved. A product with no vector is ranked lexically, which is the
 * normal state of every product on a database where `npm run embed` has not run
 * — the dashboard shows the backlog and the script clears it.
 */
async function refreshProductEmbedding(slug: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("Product")
    .select("search_document")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    console.warn(
      `[admin] Could not read search_document for ${slug}: ${error?.message ?? "no row"}`,
    );
    return;
  }

  const document = (data as { search_document: string | null }).search_document;
  if (typeof document !== "string") return;

  const vector = await embedDocument(document);
  if (vector === null) return;

  /*
   * ⚠ KNOWN BLOCKER — this write currently does not stick, and the fault is in
   * the schema rather than here.
   *
   * `product_embedding_invalidation` (supabase/sql/0004_search.sql) is a BEFORE
   * UPDATE trigger comparing `new.search_document` with `old.search_document`.
   * Postgres computes STORED generated columns *after* BEFORE triggers run, so
   * `new.search_document` is always NULL inside it — the comparison is
   * therefore always "distinct", and every update nulls the embedding,
   * including this one, which changes nothing the document is built from.
   *
   * Verified against the live database: the same statement succeeds with the
   * trigger disabled and stores nothing with it enabled. `npm run embed` runs
   * the identical UPDATE and is affected identically; it has simply never been
   * observed, because the AI Gateway account has issued no vectors yet.
   *
   * The fix is one line in that trigger — guard on
   * `tg_op = 'UPDATE' and new.embedding is not distinct from old.embedding`, or
   * make it an AFTER trigger — and it is deliberately not made here: this pass
   * changes no SQL. Until then this call is a no-op and the product stays on
   * the dashboard's "awaiting an embedding" list, which is the same state as a
   * database where the embed script has not run.
   */
  const { error: writeError } = await supabase
    .from("Product")
    .update({ embedding: toVectorLiteral(vector) })
    .eq("slug", slug);

  if (writeError) {
    console.warn(
      `[admin] Embedding not stored for ${slug}: ${writeError.message}. ` +
        "Run `npm run embed` to fill it in.",
    );
  }
}

// ── Collections ───────────────────────────────────────────────

export async function createCollection(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createCollectionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { slug, ...rest } = parsed.data;

  const { error } = await supabase.from("Collection").insert({
    // Ids are the slug throughout this catalog — see the header of
    // `supabase/sql/0001_catalog.sql` for why they are not uuids.
    id: slug,
    slug,
    ...rest,
  });

  if (error) {
    console.error(`[admin] createCollection rejected (${actor.email}): ${error.message}`);
    return postgresFailure(error as PostgresErrorLike, "collection");
  }

  revalidateCollection(slug, parsed.data.kind);
  console.log(`[admin] collection created by ${actor.email} → ${slug}`);

  return { ok: true, slug, message: `Collection "${parsed.data.name}" created.` };
}

export async function updateCollection(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateCollectionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  // The slug identifies the row; it is never in the payload. Renaming one would
  // break every stored cart line and every indexed URL.
  const { slug, ...rest } = parsed.data;

  const { data, error } = await supabase
    .from("Collection")
    .update({ ...rest, updatedAt: new Date().toISOString() })
    .eq("slug", slug)
    .select("slug")
    .maybeSingle();

  if (error) {
    console.error(`[admin] updateCollection rejected (${actor.email}): ${error.message}`);
    return postgresFailure(error as PostgresErrorLike, "collection");
  }

  // supabase-js resolves happily when the filter matched nothing. Without this
  // the form would report success for a row that does not exist.
  if (!data) {
    return { ok: false, message: "That collection no longer exists." };
  }

  revalidateCollection(slug, parsed.data.kind);
  console.log(`[admin] collection updated by ${actor.email} → ${slug}`);

  return { ok: true, slug, message: `Collection "${parsed.data.name}" saved.` };
}

/**
 * Delete a collection.
 *
 * Only ever succeeds for an empty one. `"Product"."collectionSlug"` is a real
 * foreign key, so the database is the authority here; the count is checked
 * first purely so the editor gets a sentence rather than error 23503.
 */
export async function deleteCollection(
  slug: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  if (typeof slug !== "string" || slug.length === 0) {
    return { ok: false, message: "No collection was named." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const collection = await getAdminCollection(slug);
  if (!collection) {
    return { ok: false, message: "That collection no longer exists." };
  }

  const { error } = await supabase.from("Collection").delete().eq("slug", slug);

  if (error) {
    console.error(`[admin] deleteCollection rejected (${actor.email}): ${error.message}`);
    return postgresFailure(error as PostgresErrorLike, "collection");
  }

  revalidateCollection(slug, collection.kind);
  console.log(`[admin] collection deleted by ${actor.email} → ${slug}`);

  return { ok: true, slug, message: `Collection "${collection.name}" deleted.` };
}

// ── Merchandising pages ───────────────────────────────────────

/**
 * Edit the copy and the hero of `/collections/best-sellers`.
 *
 * Update only. The page exists because `MERCH_PAGE_FACETS` routes it, so there
 * is nothing to create and nothing that may be deleted — a missing row would
 * leave the route rendering its dictionary fallback, and an unrouted row would
 * be a page with no URL. The schema and a check constraint both say so.
 *
 * What is *in* the page is not edited here: membership follows each product's
 * own Bestseller toggle, which is why the form says so and why this action
 * revalidates one path rather than a catalogue's worth.
 */
export async function updateMerchPage(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateMerchPageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  // The slug identifies the row and is never a value: it is the page's URL.
  const { slug, ...rest } = parsed.data;

  const { data, error } = await supabase
    .from("MerchPage")
    .update({ ...rest, updatedAt: new Date().toISOString() })
    .eq("slug", slug)
    .select("slug")
    .maybeSingle();

  if (error) {
    console.error(`[admin] updateMerchPage rejected (${actor.email}): ${error.message}`);
    return postgresFailure(error as PostgresErrorLike, "merchandising page");
  }

  if (!data) {
    // The row was never seeded, or somebody removed it. The page still renders
    // from the dictionary, so this is a recoverable state rather than a 404 —
    // and saying so is more useful than "saved" over a write that hit nothing.
    return {
      ok: false,
      message:
        "There is no stored row for this page yet, so nothing was saved. Run the migrations, then try again.",
    };
  }

  revalidateMerchPage(slug);
  console.log(`[admin] merchandising page updated by ${actor.email} → ${slug}`);

  return { ok: true, slug, message: `“${parsed.data.name}” saved.` };
}

// ── Products ──────────────────────────────────────────────────

export async function createProduct(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const kind = await resolveCollectionKind(parsed.data.collectionSlug);
  if (kind === null) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: { collectionSlug: "That collection does not exist." },
    };
  }

  const { slug, priceEgp, ...rest } = parsed.data;

  const { error } = await supabase.from("Product").insert({
    id: slug,
    slug,
    // The schema has already converted EGP to piastres; the field is renamed
    // here and nowhere else.
    priceInCents: priceEgp,
    ...rest,
  });

  if (error) {
    console.error(`[admin] createProduct rejected (${actor.email}): ${error.message}`);
    return postgresFailure(error as PostgresErrorLike, "product");
  }

  await refreshProductEmbedding(slug);

  revalidateProduct({
    slug,
    collectionSlug: parsed.data.collectionSlug,
    collectionKind: kind,
    tags: parsed.data.tags as ProductTag[],
  });
  console.log(`[admin] product created by ${actor.email} → ${slug}`);

  return { ok: true, slug, message: `"${parsed.data.name}" created.` };
}

export async function updateProduct(input: unknown): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const kind = await resolveCollectionKind(parsed.data.collectionSlug);
  if (kind === null) {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: { collectionSlug: "That collection does not exist." },
    };
  }

  const { slug, priceEgp, ...rest } = parsed.data;

  const { data, error } = await supabase
    .from("Product")
    .update({
      priceInCents: priceEgp,
      ...rest,
      updatedAt: new Date().toISOString(),
    })
    .eq("slug", slug)
    .select("slug")
    .maybeSingle();

  if (error) {
    console.error(`[admin] updateProduct rejected (${actor.email}): ${error.message}`);
    return postgresFailure(error as PostgresErrorLike, "product");
  }

  if (!data) {
    return { ok: false, message: "That product no longer exists." };
  }

  /*
   * The trigger in `0004_search.sql` has just nulled the vector if any embedded
   * field changed. Re-embedding here is what keeps an edited product findable
   * by meaning rather than dropping it to lexical-only until the next script
   * run.
   */
  await refreshProductEmbedding(slug);

  revalidateProduct({
    slug,
    collectionSlug: parsed.data.collectionSlug,
    collectionKind: kind,
    tags: parsed.data.tags as ProductTag[],
  });
  console.log(`[admin] product updated by ${actor.email} → ${slug}`);

  return { ok: true, slug, message: `"${parsed.data.name}" saved.` };
}

/**
 * Archive or restore a product.
 *
 * There is no hard delete, deliberately: `"OrderItem"` will point at these rows,
 * and `isArchived` is the column every public policy and query already filters
 * on — so flipping it removes the product from the storefront completely while
 * leaving its history intact.
 */
export async function setProductArchived(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = setProductArchivedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That request was not understood." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { slug, isArchived } = parsed.data;

  const { data, error } = await supabase
    .from("Product")
    .update({ isArchived, updatedAt: new Date().toISOString() })
    .eq("slug", slug)
    .select("slug, collectionSlug, tags")
    .maybeSingle();

  if (error) {
    console.error(`[admin] setProductArchived rejected (${actor.email}): ${error.message}`);
    return postgresFailure(error as PostgresErrorLike, "product");
  }

  if (!data) {
    return { ok: false, message: "That product no longer exists." };
  }

  const row = data as { collectionSlug: string; tags: ProductTag[] | null };
  const kind = await resolveCollectionKind(row.collectionSlug);

  revalidateProduct({
    slug,
    collectionSlug: row.collectionSlug,
    // A collection that vanished under us should still not stop the storefront
    // being refreshed for the paths we can name.
    collectionKind: kind ?? "FRAGRANCE",
    tags: row.tags ?? [],
  });
  console.log(
    `[admin] product ${isArchived ? "archived" : "restored"} by ${actor.email} → ${slug}`,
  );

  return {
    ok: true,
    slug,
    message: isArchived
      ? "Archived — it no longer appears anywhere on the storefront."
      : "Restored to the storefront.",
  };
}

// ── Product gallery ───────────────────────────────────────────

/**
 * Replace a product's gallery with the submitted set.
 *
 * Delete-then-insert rather than a per-row diff. Reordering and re-designating
 * the primary are the two commonest edits, and both are *relative* changes: a
 * row-at-a-time update passes through states the schema forbids (two primaries,
 * or a duplicate `sortOrder`) and leaves the gallery mangled if it half-fails.
 * Replacing the set means the invariants are satisfied by construction.
 *
 * The two statements are not one transaction — PostgREST offers no way to make
 * them one without an RPC, and adding a database function for a single-editor
 * dashboard is more machinery than the risk deserves. The failure mode is
 * bounded and visible: if the insert fails, the gallery is empty, the card
 * falls back to `PLACEHOLDER_IMAGE`, and the editor is told to try again.
 *
 * ## Why the previous rows are read first
 *
 * A replace writes every column, but this form only *owns* four of them: the
 * url, the alt text, which row is primary, and the order. `"ProductImage"` also
 * carries `alt_ar`, `caption` and `caption_ar`, which are edited elsewhere and
 * are not on this screen at all. Building the new rows from the submitted
 * fields alone therefore inserted `null` into all three — so reordering a
 * gallery, or swapping one photograph, silently erased the Arabic alt text and
 * both captions of every row in it. That is exactly what happened to the Amber
 * body mist: three rows lost their `alt_ar`, two lost their captions, and
 * nothing reported an error because nothing had failed.
 *
 * So the prior rows are read first and each submitted row is merged **onto** the
 * one it replaces, keyed by id. The spread is deliberately whole-row rather
 * than a list of the three columns to rescue: a column added to this table
 * later is preserved by default, instead of being lost until somebody notices
 * and adds its name here too. The owned fields are written last and always win.
 *
 * The read is also a **precondition**: if it fails, nothing is deleted. A
 * replace that cannot see what it is replacing is the one case where doing
 * nothing is unambiguously better than proceeding.
 */
export async function saveProductImages(
  input: unknown,
): Promise<AdminActionResult> {
  const actor = await requireAdmin();

  const parsed = saveProductImagesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Some images need attention.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return UNCONFIGURED;

  const { productSlug, images } = parsed.data;

  /*
   * Exactly one primary, always. The schema has already rejected two; this
   * handles the other end — an editor who cleared them all. Without it the
   * grid would silently fall back to `sortOrder` and then to a placeholder,
   * which reads as "my photograph did not save".
   */
  /*
   * What is about to be replaced. Read before the delete so the columns this
   * form does not own survive it — see the header.
   */
  const { data: previous, error: previousError } = await supabase
    .from("ProductImage")
    .select("*")
    .eq("productSlug", productSlug);

  if (previousError) {
    console.error(
      `[admin] gallery read rejected (${actor.email}): ${previousError.message}`,
    );
    return {
      ok: false,
      message: "The existing photographs could not be read, so nothing was changed.",
    };
  }

  /*
   * Keyed by id, never by url. The editor sends the id of every row it did not
   * invent this session, so the match is exact; matching on url would carry one
   * row's caption onto another whenever a gallery repeats a photograph.
   */
  const carried = new Map<string, Record<string, unknown>>(
    (previous ?? []).flatMap((row) => {
      const record = row as Record<string, unknown>;
      return typeof record.id === "string" ? [[record.id, record] as const] : [];
    }),
  );

  const hasPrimary = images.some((image) => image.isPrimary);
  const rows = images.map((image, index) => ({
    // Whatever the replaced row held, including columns this screen has never
    // heard of. The owned fields below overwrite their own keys and only those.
    ...(image.id ? (carried.get(image.id) ?? {}) : {}),
    id: image.id ?? crypto.randomUUID(),
    productSlug,
    url: image.url,
    alt: image.alt,
    isPrimary: hasPrimary ? image.isPrimary : index === 0,
    sortOrder: index,
  }));

  const { error: deleteError } = await supabase
    .from("ProductImage")
    .delete()
    .eq("productSlug", productSlug);

  if (deleteError) {
    console.error(`[admin] gallery clear rejected (${actor.email}): ${deleteError.message}`);
    return postgresFailure(deleteError as PostgresErrorLike, "image");
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("ProductImage").insert(rows);

    if (insertError) {
      console.error(`[admin] gallery write rejected (${actor.email}): ${insertError.message}`);
      return postgresFailure(insertError as PostgresErrorLike, "image");
    }
  }

  const product = await supabase
    .from("Product")
    .select("collectionSlug, tags")
    .eq("slug", productSlug)
    .maybeSingle();

  const row = product.data as { collectionSlug: string; tags: ProductTag[] | null } | null;

  if (row) {
    const kind = await resolveCollectionKind(row.collectionSlug);
    revalidateProduct({
      slug: productSlug,
      collectionSlug: row.collectionSlug,
      collectionKind: kind ?? "FRAGRANCE",
      tags: row.tags ?? [],
    });
  }

  console.log(
    `[admin] gallery saved by ${actor.email} → ${productSlug} (${rows.length} image(s))`,
  );

  return {
    ok: true,
    slug: productSlug,
    message: rows.length === 0 ? "Gallery cleared." : "Gallery saved.",
  };
}
