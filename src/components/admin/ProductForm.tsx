"use client";

/**
 * Create or edit a product.
 *
 * The one screen where the schema's shape is genuinely visible to a person, so
 * the grouping does the explaining: identity, then editorial copy, then the
 * fragrance pyramid, then commerce. A single flat column of twenty inputs would
 * be the same fields and a much worse tool.
 *
 * Two rules the storefront depends on and this form has to make legible:
 *
 * - **Concentration or format, never neither.** A fragrance has a strength; a
 *   room spray has a format line. The database enforces it
 *   (`product_strength_or_format`); the hint under the field says which one to
 *   fill in for what.
 * - **Notes are ordered.** The card grids render `topNotes[1]`, so the list
 *   editor never sorts on the editor's behalf.
 *
 * Price is typed in EGP and converted to piastres inside `schemas/admin.ts` —
 * this component never multiplies by 100, which is what keeps a rounding
 * difference from appearing between what was typed and what was stored.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createProduct, updateProduct } from "@/src/actions/admin/catalog";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
  AdminSelect,
  AdminStringList,
  AdminTextarea,
  AdminToggle,
} from "@/src/components/admin/fields";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminCollection, AdminProduct } from "@/src/schemas/db/admin";

const CONCENTRATION_OPTIONS = [
  { value: "", label: "None — this is not a fragrance" },
  { value: "PARFUM", label: "Parfum" },
  { value: "EXTRAIT_DE_PARFUM", label: "Extrait de Parfum" },
  { value: "EAU_DE_PARFUM", label: "Eau de Parfum" },
  { value: "ATTAR_OIL", label: "Attar Oil" },
] as const;

const TAG_OPTIONS = [
  { value: "NEW_ARRIVAL", label: "New arrival", hint: "Appears on /new-arrival." },
] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Piastres back to the EGP string the input shows. */
function toEgpString(priceInCents: number): string {
  return (priceInCents / 100).toFixed(2);
}

/** A spare empty row, so a fresh product does not start with no way to type. */
function withSpare(values: string[]): string[] {
  return values.length > 0 ? values : [""];
}

export default function ProductForm({
  product,
  collections,
  locale,
}: {
  /** `null` when creating. */
  product: AdminProduct | null;
  collections: readonly AdminCollection[];
  locale: Locale;
}) {
  const router = useRouter();
  const isEdit = product !== null;

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [subtitle, setSubtitle] = useState(product?.subtitle ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [story, setStory] = useState(product?.story ?? "");
  const [collectionSlug, setCollectionSlug] = useState(
    product?.collectionSlug ?? collections[0]?.slug ?? "",
  );
  const [concentration, setConcentration] = useState<string>(product?.concentration ?? "");
  const [format, setFormat] = useState(product?.format ?? "");
  const [includes, setIncludes] = useState<string[]>(product?.includes ?? []);
  const [badge, setBadge] = useState(product?.badge ?? "");
  const [tags, setTags] = useState<string[]>(product?.tags ?? []);
  const [topNotes, setTopNotes] = useState<string[]>(withSpare(product?.topNotes ?? []));
  const [heartNotes, setHeartNotes] = useState<string[]>(withSpare(product?.heartNotes ?? []));
  const [baseNotes, setBaseNotes] = useState<string[]>(withSpare(product?.baseNotes ?? []));
  const [volumeMl, setVolumeMl] = useState(String(product?.volumeMl ?? ""));
  const [priceEgp, setPriceEgp] = useState(
    product ? toEgpString(product.priceInCents) : "",
  );
  const [sku, setSku] = useState(product?.sku ?? "");
  const [inventory, setInventory] = useState(String(product?.inventory ?? 0));
  const [isBestseller, setIsBestseller] = useState(product?.isBestseller ?? false);
  const [sortOrder, setSortOrder] = useState(String(product?.sortOrder ?? 0));

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  const collectionOptions = collections.map((collection) => ({
    value: collection.slug,
    label: `${collection.name} — ${collection.kind.toLowerCase()}`,
  }));

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag],
    );
  }

  /*
   * Hoisted out of `submit()` so it can be compared as well as posted. This one
   * object is both what the action receives and what `useUnsavedGuard` watches
   * — which is what makes "has this been edited?" impossible to get wrong: a
   * field that reaches the server necessarily reaches the comparison too.
   */
  const payload = {
    slug,
    name,
    subtitle,
    description,
    story,
    concentration,
    format,
    includes,
    badge,
    tags,
    topNotes,
    heartNotes,
    baseNotes,
    volumeMl,
    priceEgp,
    sku,
    inventory,
    isBestseller,
    collectionSlug,
    sortOrder,
  };

  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload,
    save: () => persist(),
    pending: isPending,
  });

  /** Saves and reports whether it worked. Awaited by the leave-page dialog. */
  async function persist(): Promise<boolean> {
    setResult(null);

    const outcome = isEdit ? await updateProduct(payload) : await createProduct(payload);
    /*
     * Successes leave, failures stay. A receipt has done its job the moment it
     * is read; a refusal names a field and has to be acted on, so it keeps its
     * place above the form. See `admin-toast-provider.tsx`.
     */
    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);

    if (!outcome.ok) return false;

    // The form now matches the row, so leaving is no longer losing anything.
    markSaved();

    if (!isEdit) {
      // The gallery editor lives on the edit screen, and a product with no
      // photograph is not finished — so a successful create hands the editor
      // straight to it.
      router.push(localizePath(locale, `/admin/products/${outcome.slug}`));
    }

    router.refresh();
    return true;
  }

  function submit() {
    /*
     * The callback stays `async` and awaits: React 19 keeps `isPending` true for
     * the life of an async transition, and a synchronous callback that merely
     * *starts* the promise would drop the flag immediately — the save button
     * would stop saying "Saving" the instant it was pressed.
     */
    startTransition(async () => {
      await persist();
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="max-w-3xl space-y-10"
    >
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>{result.message}</AdminNotice>
      ) : null}

      {collections.length === 0 ? (
        <AdminNotice tone="error">
          There are no collections yet. A product must belong to one — create a
          collection first.
        </AdminNotice>
      ) : null}

      {/* ── Identity ─────────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-ground-accent">
          Identity
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="name"
            label="Name"
            required
            value={name}
            error={fieldErrors.name}
            onChange={(value) => {
              setName(value);
              if (!slugTouched) setSlug(slugify(value));
            }}
          />

          <AdminInput
            id="slug"
            label="Slug"
            required
            value={slug}
            readOnly={isEdit}
            error={fieldErrors.slug}
            hint={
              isEdit
                ? "Fixed after creation — stored carts reference this value."
                : "Becomes /perfume/<slug> for fragrances. Choose carefully; it cannot change later."
            }
            onChange={(value) => {
              setSlugTouched(true);
              setSlug(value);
            }}
          />
        </div>

        <AdminSelect
          id="collectionSlug"
          label="Collection"
          required
          value={collectionSlug}
          options={collectionOptions}
          error={fieldErrors.collectionSlug}
          hint="Decides where this product is sold and whether it gets a detail page."
          onChange={setCollectionSlug}
        />

        <AdminInput
          id="subtitle"
          label="Subtitle"
          value={subtitle}
          error={fieldErrors.subtitle}
          hint="The gold line under the name. Optional."
          onChange={setSubtitle}
        />
      </section>

      {/* ── Copy ─────────────────────────────────────────── */}
      <section className="space-y-6 border-t border-ground-border pt-10">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-ground-accent">
          Copy
        </h2>

        <AdminTextarea
          id="description"
          label="Description"
          required
          rows={4}
          value={description}
          error={fieldErrors.description}
          onChange={setDescription}
        />

        <AdminTextarea
          id="story"
          label="Story"
          rows={6}
          value={story}
          error={fieldErrors.story}
          hint="The editorial passage on the detail page. Optional; leave empty for goods with no detail page."
          onChange={setStory}
        />
      </section>

      {/* ── Character ────────────────────────────────────── */}
      <section className="space-y-6 border-t border-ground-border pt-10">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-ground-accent">
          Character
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminSelect
            id="concentration"
            label="Concentration"
            value={concentration}
            options={CONCENTRATION_OPTIONS}
            error={fieldErrors.concentration}
            hint="Fragrances only. Leave as None for body, home and set goods, and fill in a format line instead."
            onChange={setConcentration}
          />

          <AdminInput
            id="format"
            label="Format line"
            value={format}
            error={fieldErrors.format}
            hint='For non-fragrances: "Room Spray", "6 × 3 ML Vials".'
            onChange={setFormat}
          />
        </div>

        <AdminStringList
          label="Top notes"
          values={topNotes}
          onChange={setTopNotes}
          error={fieldErrors.topNotes}
          placeholder="Bergamot"
          addLabel="Add note"
          hint="Order matters — the grid cards print the second entry."
        />

        <AdminStringList
          label="Heart notes"
          values={heartNotes}
          onChange={setHeartNotes}
          error={fieldErrors.heartNotes}
          placeholder="Damask Rose"
          addLabel="Add note"
        />

        <AdminStringList
          label="Base notes"
          values={baseNotes}
          onChange={setBaseNotes}
          error={fieldErrors.baseNotes}
          placeholder="Oud"
          addLabel="Add note"
        />

        <AdminStringList
          label="Set contents"
          values={includes}
          onChange={setIncludes}
          error={fieldErrors.includes}
          placeholder="Onyx Night — 3 ML"
          addLabel="Add item"
          hint="One line per item in a discovery or gift set. Leave empty for a single product."
        />
      </section>

      {/* ── Commerce ─────────────────────────────────────── */}
      <section className="space-y-6 border-t border-ground-border pt-10">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.25em] text-ground-accent">
          Commerce
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="priceEgp"
            label="Price (EGP)"
            required
            type="number"
            step="0.01"
            min={0}
            value={priceEgp}
            error={fieldErrors.priceEgp}
            hint="In pounds, e.g. 1470.00. Stored as piastres; other currencies are converted for display."
            onChange={setPriceEgp}
          />

          <AdminInput
            id="volumeMl"
            label="Volume (ml)"
            required
            type="number"
            min={1}
            value={volumeMl}
            error={fieldErrors.volumeMl}
            onChange={setVolumeMl}
          />

          <AdminInput
            id="sku"
            label="SKU"
            required
            value={sku}
            error={fieldErrors.sku}
            hint="Unique across the catalog."
            onChange={setSku}
          />

          <AdminInput
            id="inventory"
            label="Stock"
            required
            type="number"
            min={0}
            value={inventory}
            error={fieldErrors.inventory}
            onChange={setInventory}
          />

          <AdminInput
            id="badge"
            label="Badge"
            value={badge}
            error={fieldErrors.badge}
            hint='Free editorial text on the card — "Most Popular". Not a filter.'
            onChange={setBadge}
          />

          <AdminInput
            id="sortOrder"
            label="Sort order"
            type="number"
            min={0}
            value={sortOrder}
            error={fieldErrors.sortOrder}
            hint="Position within its collection. Lower sorts first."
            onChange={setSortOrder}
          />
        </div>

        <div className="space-y-3">
          <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-muted">
            Merchandising tags
          </p>
          {TAG_OPTIONS.map((option) => (
            <AdminToggle
              key={option.value}
              id={`tag-${option.value}`}
              label={option.label}
              description={option.hint}
              checked={tags.includes(option.value)}
              onChange={() => toggleTag(option.value)}
            />
          ))}

          <AdminToggle
            id="isBestseller"
            label="Bestseller"
            description="Eligible for the home page rail and the bestseller facet."
            checked={isBestseller}
            onChange={setIsBestseller}
          />
        </div>
      </section>

      <div className="flex gap-3 border-t border-ground-border pt-8">
        <AdminButton type="submit" disabled={isPending || collections.length === 0}>
          {isPending ? "Saving…" : isEdit ? "Save product" : "Create product"}
        </AdminButton>
      </div>
    </form>
  );
}
