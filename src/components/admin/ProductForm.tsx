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
import Link from "next/link";

import { localizePath, type Locale } from "@/src/lib/i18n/config";
import {
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPE_VALUES,
  typeHasContents,
  typeIsScented,
  typeTakesVolume,
  type ProductType,
} from "@/src/lib/product-types";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { AdminCollection, AdminProduct } from "@/src/schemas/db/admin";

/**
 * What the object is, in the order an editor is most likely to want.
 *
 * Blank first, and it stays a real choice rather than a placeholder: the
 * catalogue predates this column, so an existing fragrance opens with no type
 * and must be able to be saved that way. `typeTakesVolume(null)` reads a blank
 * as "measured in millilitres", which is what every product written before today
 * actually is.
 */
const PRODUCT_TYPE_OPTIONS = [
  { value: "", label: "Not stated" },
  ...PRODUCT_TYPE_VALUES.map((value) => ({
    value,
    label: PRODUCT_TYPE_LABELS[value],
  })),
] as const;

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
  const [productType, setProductTypeState] = useState<string>(
    product?.productType ?? "",
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
  /*
   * Blank when the desk has never stated one, and blank is a real answer.
   *
   * `?? ""` rather than a zero: the ledger reads a missing cost as unknown and
   * prints "Cost unavailable", which is honest, whereas a zero would report the
   * next sale of this bottle as pure profit.
   */
  const [costEgp, setCostEgp] = useState(
    product?.costInCents != null ? toEgpString(product.costInCents) : "",
  );
  const [sku, setSku] = useState(product?.sku ?? "");
  const [isBestseller, setIsBestseller] = useState(product?.isBestseller ?? false);
  const [sortOrder, setSortOrder] = useState(String(product?.sortOrder ?? 0));

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  const collectionOptions = collections.map((collection) => ({
    value: collection.slug,
    label: `${collection.name} — ${collection.kind.toLowerCase()}`,
  }));

  /*
   * What this type of object has, restated from `src/lib/product-types.ts` so
   * the form and `checkProductRules` in `schemas/admin.ts` cannot disagree about
   * which fields apply. The schema is what refuses a save; these decide what is
   * worth asking for in the first place.
   */
  const asType = (productType === "" ? null : productType) as ProductType | null;
  const takesVolume = typeTakesVolume(asType);
  const isScented = typeIsScented(asType);
  const hasContents = typeHasContents(asType);

  /**
   * Change the type, and empty what the new type does not have.
   *
   * Clearing here rather than only on the server is what keeps the screen
   * honest: a hidden input still holding "100 ML" from before the type changed
   * would be a value the editor cannot see, cannot correct, and would not expect
   * to be discarded. The schema clears the same fields again on the way in —
   * this is the courtesy, that is the guarantee.
   */
  function setProductType(next: string) {
    setProductTypeState(next);

    const nextType = (next === "" ? null : next) as ProductType | null;

    if (!typeTakesVolume(nextType)) setVolumeMl("");

    if (!typeIsScented(nextType)) {
      setConcentration("");
      setTopNotes([""]);
      setHeartNotes([""]);
      setBaseNotes([""]);
    }

    if (!typeHasContents(nextType)) setIncludes([]);
  }

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
    productType,
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
    costEgp,
    sku,
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

        {/*
          The type comes first because everything under it follows from the
          answer: an antique has no concentration, no pyramid and no volume, and
          the fields for those disappear rather than sitting there inviting a
          figure somebody has to invent.
        */}
        <AdminSelect
          id="productType"
          label="Type"
          value={productType}
          options={PRODUCT_TYPE_OPTIONS}
          error={fieldErrors.productType}
          hint="What the object is. A Perfume, Body Mist or Room Spray states a volume; a Gift, Box, Antique or Decorative item does not. Body Mist and Room Spray also decide which range page lists it."
          onChange={setProductType}
        />

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          {isScented ? (
            <AdminSelect
              id="concentration"
              label="Concentration"
              value={concentration}
              options={CONCENTRATION_OPTIONS}
              error={fieldErrors.concentration}
              hint="Fragrances only. Leave as None for body, home and set goods, and fill in a format line instead."
              onChange={setConcentration}
            />
          ) : null}

          <AdminInput
            id="format"
            label="Format line"
            required={!isScented}
            value={format}
            error={fieldErrors.format}
            hint={
              isScented
                ? 'For non-fragrances: "Room Spray", "6 × 3 ML Vials".'
                : 'Required for this type — it stands where a fragrance states its concentration: "Alabaster Sphinx", "Gift Box — 3 Vials".'
            }
            onChange={setFormat}
          />
        </div>

        {isScented ? (
          <>
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
          </>
        ) : null}

        {hasContents ? (
          <AdminStringList
            label="Set contents"
            values={includes}
            onChange={setIncludes}
            error={fieldErrors.includes}
            placeholder="Onyx Night — 3 ML"
            addLabel="Add item"
            hint="One line per item in a discovery or gift set. Leave empty for a single product."
          />
        ) : null}
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

          {/*
            Absent, not merely optional, for the types that are not measured in
            millilitres. An input left blank is still an invitation to fill it
            in, and the figure somebody invents to satisfy it is the one the
            cards then print.
          */}
          {takesVolume ? (
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
          ) : null}

          {/*
            What the bottle costs the house — never shown to a visitor.
            Optional, and left blank it stays blank: `/admin/sales` prints
            "Cost unavailable" against a product with no cost rather than
            claiming a margin nobody has supplied the figures for.
          */}
          <AdminInput
            id="costEgp"
            label="Cost (EGP)"
            type="number"
            step="0.01"
            min={0}
            value={costEgp}
            error={fieldErrors.costEgp}
            hint="What this costs KHEM, not what it sells for. Snapshotted onto every sale for the profit reports. Leave blank if unknown."
            onChange={setCostEgp}
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

          {/*
            Stock is read-only here, and deliberately.

            It used to be an editable "Stock" field writing `"Product".inventory`.
            Since `supabase/sql/0042_inventory_channels.sql` that column is a
            trigger-maintained total of two counters, so the field wrote to
            something the database immediately recomputed — it reported success,
            changed nothing, and left no ledger row. A control that lies is worse
            than no control.

            Stock now moves only where the movement can be named and recorded:
            a sale through an order, a delivery through Restock, a correction
            through Adjustment, or units moved with Transfer. All of them live on
            the Inventory screen, which this links to.
          */}
          <div className="flex flex-col gap-2">
            <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-subtle">
              Inventory
            </span>

            {product ? (
              <>
                <p className="text-[12px] text-ground">
                  Online {product.inventoryOnline} · Offline{" "}
                  {product.inventoryOffline}
                </p>
                <div className="flex gap-4">
                  <Link
                    href={localizePath(locale, "/admin/inventory")}
                    className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
                  >
                    Manage inventory
                  </Link>
                  <Link
                    href={localizePath(
                      locale,
                      `/admin/inventory/${product.slug}`,
                    )}
                    className="font-heading text-[9px] uppercase tracking-[0.2em] text-ground-muted transition-colors duration-300 hover:text-ground-accent"
                  >
                    Stock history
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-[11px] leading-relaxed text-ground-muted">
                A new product opens at zero in both counters. Add its first
                stock from Inventory once it is saved, so the arrival is
                recorded as a movement rather than appearing from nowhere.
              </p>
            )}
          </div>

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
