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
import { useCallback, useState, useTransition } from "react";

import { createProduct, saveProductImages, updateProduct } from "@/src/actions/admin/catalog";
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
import ProductImageEditor, {
  type ProductImageDraftRow,
} from "@/src/components/admin/ProductImageEditor";

import { localizePath, type Locale } from "@/src/lib/i18n/config";
import { generateProductSku } from "@/src/lib/admin/sku";
import {
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPE_VALUES,
  typeHasContents,
  typeIsScented,
  typeTakesVolume,
  isScentItem,
  type ProductType,
} from "@/src/lib/product-types";
import { useUnsavedGuard } from "@/src/hooks/useUnsavedGuard";
import { useAdminToast } from "@/src/providers/admin-toast-provider";
import { useDictionary } from "@/src/providers/i18n-provider";
import type { AdminActionResult } from "@/src/schemas/admin";
import { saveProductImagesSchema } from "@/src/schemas/admin";
import type { AdminCollection, AdminProduct } from "@/src/schemas/db/admin";
import { SCENT_PROFILE_SLUGS } from "@/src/lib/scent-profiles";

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
  scentProfileSlugs = [],
}: {
  /** `null` when creating. */
  product: AdminProduct | null;
  collections: readonly AdminCollection[];
  locale: Locale;
  scentProfileSlugs?: readonly string[];
}) {
  const router = useRouter();
  const dictionary = useDictionary();
  const isEdit = product !== null;

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [subtitle, setSubtitle] = useState(product?.subtitle ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [descriptionAr, setDescriptionAr] = useState(product?.description_ar ?? "");
  const [story, setStory] = useState(product?.story ?? "");
  const [storyAr, setStoryAr] = useState(product?.story_ar ?? "");
  const [collectionSlug, setCollectionSlug] = useState(
    product?.collectionSlug ?? collections[0]?.slug ?? "",
  );
  const [selectedScentProfiles, setSelectedScentProfiles] = useState<string[]>([...scentProfileSlugs]);
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
  const [skuTouched, setSkuTouched] = useState(isEdit);
  const [skuAutoGenerated, setSkuAutoGenerated] = useState(false);
  const [isBestseller, setIsBestseller] = useState(product?.isBestseller ?? false);
  const [sortOrder, setSortOrder] = useState(String(product?.sortOrder ?? 0));
  const [initialInventoryOnline, setInitialInventoryOnline] = useState("0");
  const [initialInventoryOffline, setInitialInventoryOffline] = useState("0");
  const [galleryRows, setGalleryRows] = useState<ProductImageDraftRow[]>([]);
  const [galleryErrors, setGalleryErrors] = useState<Record<string, string>>({});
  const [galleryMessage, setGalleryMessage] = useState<string | undefined>();
  const onGalleryChange = useCallback((rows: ProductImageDraftRow[]) => {
    setGalleryRows(rows);
    setGalleryErrors({});
    setGalleryMessage(undefined);
  }, []);

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
  const selectedCollection = collections.find((collection) => collection.slug === collectionSlug);
  const scentEligible = isScentItem({ productType: asType, collectionKind: selectedCollection?.kind ?? null });
  const takesVolume = typeTakesVolume(asType);
  const isScented = typeIsScented(asType);
  const hasContents = typeHasContents(asType);

  function rebuildSkuIfUntouched(
    next: {
      name?: string;
      collectionSlug?: string;
      volumeMl?: string;
      volumeVisible?: boolean;
    } = {},
  ) {
    if (isEdit || skuTouched) return;

    const generated = generateProductSku({
      collectionSlug: next.collectionSlug ?? collectionSlug,
      name: next.name ?? name,
      volumeMl: next.volumeMl ?? volumeMl,
      volumeVisible: next.volumeVisible ?? takesVolume,
    });
    setSku(generated);
    setSkuAutoGenerated(generated.length > 0);
  }

  function regenerateSkuFromName() {
    if (!isEdit) return;
    const generated = generateProductSku({
      collectionSlug,
      name,
      volumeMl,
      volumeVisible: takesVolume,
    });
    if (generated && generated !== sku) setSku(generated);
  }

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
    const nextTakesVolume = typeTakesVolume(nextType);

    if (!nextTakesVolume) setVolumeMl("");
    rebuildSkuIfUntouched({
      volumeMl: nextTakesVolume ? volumeMl : "",
      volumeVisible: nextTakesVolume,
    });

    if (!typeIsScented(nextType)) {
      setConcentration("");
      setTopNotes([""]);
      setHeartNotes([""]);
      setBaseNotes([""]);
    }

    if (!typeHasContents(nextType)) setIncludes([]);
    if (!isScentItem({ productType: nextType, collectionKind: selectedCollection?.kind ?? null })) setSelectedScentProfiles([]);
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
    description_ar: descriptionAr,
    story,
    story_ar: storyAr,
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
    scentProfiles: scentEligible ? selectedScentProfiles : [],
    sortOrder,
    initialInventoryOnline,
    initialInventoryOffline,
  };

  const { toast } = useAdminToast();

  const { markSaved } = useUnsavedGuard({
    payload: isEdit
      ? payload
      : { ...payload, galleryRows, skuAutoGenerated },
    save: () => persist(),
    pending: isPending,
  });

  /** Saves and reports whether it worked. Awaited by the leave-page dialog. */
  async function persist(): Promise<boolean> {
    setResult(null);

    let imagesToSave: ProductImageDraftRow[] = [];
    if (!isEdit && galleryRows.length > 0) {
      imagesToSave = galleryRows.map((row, index) => ({
        ...row,
        isPrimary: galleryRows.some((image) => image.isPrimary)
          ? row.isPrimary
          : index === 0,
      }));

      const galleryValidation = saveProductImagesSchema.safeParse({
        productSlug: "draft-product",
        images: imagesToSave,
      });
      if (!galleryValidation.success) {
        const nextErrors: Record<string, string> = {};
        let nextMessage: string | undefined;
        for (const issue of galleryValidation.error.issues) {
          const path = issue.path.join(".");
          if (/^images\.\d+\.(url|alt)$/.test(path)) {
            nextErrors[path] = issue.message;
          } else {
            nextMessage ??= issue.message;
          }
        }
        setGalleryErrors(nextErrors);
        setGalleryMessage(nextMessage);
        return false;
      }
    }

    if (!isEdit) {
      const initialErrors: Record<string, string> = {};
      if (!/^(0|[1-9]\d*)$/.test(initialInventoryOnline)) {
        initialErrors.initialInventoryOnline = dictionary.adminInventory.quantityNonNegative;
      }
      if (!/^(0|[1-9]\d*)$/.test(initialInventoryOffline)) {
        initialErrors.initialInventoryOffline = dictionary.adminInventory.quantityNonNegative;
      }
      if (Object.keys(initialErrors).length > 0) {
        setResult({
          ok: false,
          message: "Some fields need attention.",
          fieldErrors: initialErrors,
        });
        return false;
      }
    }

    const outcome = isEdit
      ? await updateProduct(payload)
      : await createProduct({ ...payload, skuAutoGenerated });
    /*
     * Successes leave, failures stay. A receipt has done its job the moment it
     * is read; a refusal names a field and has to be acted on, so it keeps its
     * place above the form. See `admin-toast-provider.tsx`.
     */
    if (outcome.ok) toast(outcome.message);
    setResult(outcome.ok ? null : outcome);

    if (!outcome.ok) return false;

    let gallerySaveFailed = false;
    if (!isEdit && imagesToSave.length > 0) {
      try {
        const galleryOutcome = await saveProductImages({
          productSlug: outcome.slug,
          images: imagesToSave,
        });
        gallerySaveFailed = !galleryOutcome.ok;
      } catch (error) {
        console.error(`[admin] gallery save threw after product create (${outcome.slug})`, error);
        gallerySaveFailed = true;
      }
    }

    // The form now matches the row, so leaving is no longer losing anything.
    markSaved();

    if (!isEdit) {
      const editPath = localizePath(locale, `/admin/products/${outcome.slug}`);
      router.push(
        gallerySaveFailed ? `${editPath}?gallery=save-failed` : editPath,
      );
      return true;
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
              rebuildSkuIfUntouched({ name: value });
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
          onChange={(value) => {
            setCollectionSlug(value);
            const nextCollection = collections.find((collection) => collection.slug === value);
            if (!isScentItem({ productType: asType, collectionKind: nextCollection?.kind ?? null })) setSelectedScentProfiles([]);
            rebuildSkuIfUntouched({ collectionSlug: value });
          }}
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
          id="description_ar"
          label="Description — Arabic"
          rows={4}
          value={descriptionAr}
          error={fieldErrors.description_ar}
          onChange={setDescriptionAr}
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

        <AdminTextarea
          id="story_ar"
          label="Story — Arabic"
          rows={6}
          value={storyAr}
          error={fieldErrors.story_ar}
          hint="The Arabic editorial passage on the detail page. Optional; blank falls back to English."
          onChange={setStoryAr}
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

        {scentEligible ? (
          <fieldset className="space-y-3 border-t border-ground-border pt-5">
            <legend className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-accent">Scent profiles</legend>
            <div className="flex flex-wrap gap-2">
              {SCENT_PROFILE_SLUGS.map((profile) => {
                const active = selectedScentProfiles.includes(profile);
                return (
                  <button
                    key={profile}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedScentProfiles((current) => active ? current.filter((slug) => slug !== profile) : [...current, profile])}
                    className={`border px-3 py-2 font-heading text-[9px] uppercase tracking-[0.18em] transition-colors ${active ? "border-gold/50 bg-gold/10 text-ground-accent" : "border-ground-border text-ground-muted hover:border-gold/30 hover:text-ground"}`}
                  >
                    {profile}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

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
              onChange={(value) => {
                setVolumeMl(value);
                rebuildSkuIfUntouched({ volumeMl: value });
              }}
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

          <div>
            <AdminInput
              id="sku"
              label="SKU"
              required
              value={sku}
              error={fieldErrors.sku}
              hint="Unique across the catalog."
              onChange={(value) => {
                setSkuTouched(true);
                setSkuAutoGenerated(false);
                setSku(value);
              }}
            />
            {isEdit ? (
              <button
                type="button"
                onClick={regenerateSkuFromName}
                className="mt-2 rounded-none border border-ground-border px-3 py-2 font-heading text-[9px] uppercase tracking-[0.16em] text-ground-muted transition-colors duration-300 hover:border-gold/40 hover:text-ground-accent"
              >
                {dictionary.adminProduct.regenerateSku}
              </button>
            ) : null}
            {isEdit && sku !== product.sku ? (
              <p className="mt-2 text-[10px] leading-relaxed text-ground-muted">
                {dictionary.adminProduct.skuChangedWarning}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-ground-subtle">
              {dictionary.adminInventory.initialStock}
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
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminInput
                    id="initialInventoryOnline"
                    label={dictionary.adminInventory.online}
                    type="number"
                    min={0}
                    step="1"
                    value={initialInventoryOnline}
                    error={fieldErrors.initialInventoryOnline}
                    onChange={setInitialInventoryOnline}
                  />
                  <AdminInput
                    id="initialInventoryOffline"
                    label={dictionary.adminInventory.offline}
                    type="number"
                    min={0}
                    step="1"
                    value={initialInventoryOffline}
                    error={fieldErrors.initialInventoryOffline}
                    onChange={setInitialInventoryOffline}
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-ground-muted">
                  {dictionary.adminInventory.initialStockHelper}
                </p>
              </>
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

      {!isEdit ? (
        <section className="mt-10 md:mt-16 max-w-3xl border-t border-ground-border pt-10">
          <h2 className="mb-2 font-heading text-[10px] uppercase tracking-[0.25em] text-ground-accent">
            Gallery
          </h2>
          <p className="mb-6 max-w-xl text-[11px] leading-relaxed text-ground-muted">
            The primary image is what every grid card shows. Order is the order
            the detail page displays them in.
          </p>
          <ProductImageEditor
            images={[]}
            draft
            onChange={onGalleryChange}
            validationErrors={galleryErrors}
            validationMessage={galleryMessage}
          />
        </section>
      ) : null}

      <div className="flex gap-3 border-t border-ground-border pt-8">
        <AdminButton type="submit" disabled={isPending || collections.length === 0}>
          {isPending ? "Saving…" : isEdit ? "Save product" : "Create product"}
        </AdminButton>
      </div>
    </form>
  );
}
