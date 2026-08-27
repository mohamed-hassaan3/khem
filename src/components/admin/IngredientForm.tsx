"use client";

/**
 * Create or edit a raw material.
 *
 * Not a `ContentRowsEditor` row, and the three reasons are the whole shape of
 * this screen:
 *
 *  - **`families` is a closed multi-select.** Seven checkboxes, and only seven.
 *    A material carrying a family outside `ingredientFamilySchema` fails the
 *    read parse and is dropped from `/ingredients` entirely — the material
 *    disappears with nothing to say why. A free-text field could produce that;
 *    checkboxes cannot.
 *  - **`facts` and `facts_ar` are lists.** They fall back *as a whole* through
 *    `resolveList()`, so the form says so: a half-translated list would render
 *    half in each script.
 *  - **`priceTier` is 1–5**, checked by the database as well as here.
 *
 * The perfumes a material is printed on live in their own panel on the edit
 * page — see `IngredientProductsPanel`. They cannot be set while creating,
 * because the usage rows need an id that does not exist yet.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createIngredient,
  deleteIngredient,
  updateIngredient,
} from "@/src/actions/admin/content";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminNotice,
  AdminStringList,
  AdminTextarea,
} from "@/src/components/admin/fields";
import { localizePath, type Locale } from "@/src/lib/i18n/config";
import type { AdminActionResult } from "@/src/schemas/admin";
import { ingredientFamilyValues } from "@/src/schemas/content";
import type { AdminIngredient } from "@/src/schemas/db/content";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export default function IngredientForm({
  ingredient,
  locale,
}: {
  /** `null` when creating. */
  ingredient: AdminIngredient | null;
  locale: Locale;
}) {
  const router = useRouter();
  const isEdit = ingredient !== null;

  const [name, setName] = useState(ingredient?.name ?? "");
  const [nameAr, setNameAr] = useState(ingredient?.name_ar ?? "");
  const [slug, setSlug] = useState(ingredient?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [latinName, setLatinName] = useState(ingredient?.latinName ?? "");
  const [origin, setOrigin] = useState(ingredient?.origin ?? "");
  const [originAr, setOriginAr] = useState(ingredient?.origin_ar ?? "");
  const [families, setFamilies] = useState<string[]>(ingredient?.families ?? []);
  const [rarity, setRarity] = useState(ingredient?.rarity ?? "");
  const [rarityAr, setRarityAr] = useState(ingredient?.rarity_ar ?? "");
  const [priceTier, setPriceTier] = useState(String(ingredient?.priceTier ?? 3));
  const [description, setDescription] = useState(ingredient?.description ?? "");
  const [descriptionAr, setDescriptionAr] = useState(
    ingredient?.description_ar ?? "",
  );
  const [facts, setFacts] = useState<string[]>(ingredient?.facts ?? []);
  const [factsAr, setFactsAr] = useState<string[]>(ingredient?.facts_ar ?? []);
  const [imageUrl, setImageUrl] = useState(ingredient?.imageUrl ?? "");
  const [imageAlt, setImageAlt] = useState(ingredient?.imageAlt ?? "");
  const [imageAltAr, setImageAltAr] = useState(ingredient?.imageAlt_ar ?? "");
  const [sortOrder, setSortOrder] = useState(String(ingredient?.sortOrder ?? 0));

  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  /** The Arabic list is all-or-nothing, so a partial one is worth flagging. */
  const factsMismatch =
    factsAr.filter((fact) => fact.trim().length > 0).length > 0 &&
    factsAr.filter((fact) => fact.trim().length > 0).length !==
      facts.filter((fact) => fact.trim().length > 0).length;

  function toggleFamily(family: string) {
    setFamilies((current) =>
      current.includes(family)
        ? current.filter((value) => value !== family)
        : [...current, family],
    );
  }

  function submit() {
    setResult(null);

    startTransition(async () => {
      const payload = {
        id: ingredient?.id ?? slug,
        name,
        name_ar: nameAr,
        slug,
        latinName,
        origin,
        origin_ar: originAr,
        families,
        rarity,
        rarity_ar: rarityAr,
        priceTier,
        description,
        description_ar: descriptionAr,
        facts,
        facts_ar: factsAr,
        imageUrl,
        imageAlt,
        imageAlt_ar: imageAltAr,
        sortOrder,
      };

      const outcome = isEdit
        ? await updateIngredient(payload)
        : await createIngredient(payload);

      setResult(outcome);

      if (outcome.ok && !isEdit) {
        // Straight into the edit screen, because the next thing an editor does
        // — saying which perfumes use this — needs the row to exist.
        router.push(
          localizePath(locale, `/admin/content/ingredients/${outcome.slug}`),
        );
        router.refresh();
      } else if (outcome.ok) {
        router.refresh();
      }
    });
  }

  function remove() {
    if (!isEdit) return;

    startTransition(async () => {
      const outcome = await deleteIngredient({ id: ingredient.id });

      if (outcome.ok) {
        router.push(localizePath(locale, "/admin/content/ingredients"));
        router.refresh();
        return;
      }

      setArmed(false);
      setResult(outcome);
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="max-w-3xl space-y-8"
    >
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      {/* ── The material ─────────────────────────────────── */}
      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
          The material
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="name"
            label="Name"
            value={name}
            onChange={(value) => {
              setName(value);
              if (!slugTouched) setSlug(slugify(value));
            }}
            error={fieldErrors.name}
          />
          <AdminInput
            id="name_ar"
            label="Name — Arabic"
            value={nameAr}
            onChange={setNameAr}
            error={fieldErrors.name_ar}
          />

          <AdminInput
            id="slug"
            label="Slug"
            value={slug}
            onChange={(value) => {
              setSlugTouched(true);
              setSlug(value);
            }}
            error={fieldErrors.slug}
          />
          <AdminInput
            id="latinName"
            label="Binomial"
            value={latinName}
            onChange={setLatinName}
            error={fieldErrors.latinName}
            hint="Aquilaria malaccensis. Latin in both trees — no Arabic field."
          />

          <AdminInput
            id="origin"
            label="Origin"
            value={origin}
            onChange={setOrigin}
            error={fieldErrors.origin}
            hint="Laos &amp; Cambodia"
          />
          <AdminInput
            id="origin_ar"
            label="Origin — Arabic"
            value={originAr}
            onChange={setOriginAr}
            error={fieldErrors.origin_ar}
          />

          <AdminInput
            id="rarity"
            label="Rarity"
            value={rarity}
            onChange={setRarity}
            error={fieldErrors.rarity}
            hint="Extremely Rare"
          />
          <AdminInput
            id="rarity_ar"
            label="Rarity — Arabic"
            value={rarityAr}
            onChange={setRarityAr}
            error={fieldErrors.rarity_ar}
          />

          <AdminInput
            id="priceTier"
            type="number"
            min={1}
            label="Price tier"
            value={priceTier}
            onChange={setPriceTier}
            error={fieldErrors.priceTier}
            hint="1 to 5. Rendered as that many $ signs."
          />
          <AdminInput
            id="sortOrder"
            label="Sort order"
            value={sortOrder}
            onChange={setSortOrder}
            error={fieldErrors.sortOrder}
          />
        </div>

        <AdminField
          label="Olfactive families"
          error={fieldErrors.families}
          hint="At least one. These seven are the only families the site can filter or render."
          required
        >
          <div className="flex flex-wrap gap-2">
            {ingredientFamilyValues.map((family) => {
              const active = families.includes(family);

              return (
                <button
                  key={family}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleFamily(family)}
                  className={`border px-4 py-2 font-heading text-[9px] uppercase tracking-[0.2em] transition-colors duration-300 ${
                    active
                      ? "border-gold/50 bg-gold/10 text-gold"
                      : "border-border text-ivory/35 hover:border-gold/30 hover:text-ivory"
                  }`}
                >
                  {family}
                </button>
              );
            })}
          </div>
        </AdminField>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminTextarea
            id="description"
            label="Description"
            value={description}
            onChange={setDescription}
            error={fieldErrors.description}
          />
          <AdminTextarea
            id="description_ar"
            label="Description — Arabic"
            value={descriptionAr}
            onChange={setDescriptionAr}
            error={fieldErrors.description_ar}
          />
        </div>
      </section>

      {/* ── Provenance notes ─────────────────────────────── */}
      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
          Provenance notes
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminStringList
            label="Facts"
            values={facts}
            onChange={setFacts}
            error={fieldErrors.facts}
            addLabel="Add a fact"
          />
          <AdminStringList
            label="Facts — Arabic"
            values={factsAr}
            onChange={setFactsAr}
            error={fieldErrors.facts_ar}
            hint="All or nothing: the Arabic list is used only when it has the same number of entries as the English one."
            addLabel="Add a fact"
          />
        </div>

        {factsMismatch ? (
          <p className="border border-warning/30 bg-warning/5 px-4 py-3 text-[12px] leading-relaxed text-warning">
            The Arabic list has a different number of entries from the English
            one, so the Arabic page will show the English facts. Match the counts
            or leave the Arabic list empty.
          </p>
        ) : null}
      </section>

      {/* ── Photograph ───────────────────────────────────── */}
      <section className="space-y-4 md:space-y-6">
        <h2 className="font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35">
          Photograph
        </h2>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <AdminInput
            id="imageUrl"
            label="Image URL"
            value={imageUrl}
            onChange={setImageUrl}
            error={fieldErrors.imageUrl}
          />
          <AdminInput
            id="imageAlt"
            label="Alt text"
            value={imageAlt}
            onChange={setImageAlt}
            error={fieldErrors.imageAlt}
          />
          <AdminInput
            id="imageAlt_ar"
            label="Alt text — Arabic"
            value={imageAltAr}
            onChange={setImageAltAr}
            error={fieldErrors.imageAlt_ar}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <AdminButton type="submit" disabled={isPending}>
          {isPending ? "Saving" : isEdit ? "Save material" : "Add material"}
        </AdminButton>

        {isEdit ? (
          <AdminButton
            variant={armed ? "danger" : "ghost"}
            disabled={isPending}
            onClick={() => (armed ? remove() : setArmed(true))}
          >
            {armed ? "Confirm — remove permanently" : "Remove"}
          </AdminButton>
        ) : null}
      </div>

      {armed ? (
        <p className="text-[11px] leading-relaxed text-ivory/35">
          Removing deletes the material and unlinks it from every perfume it is
          printed on.
        </p>
      ) : null}
    </form>
  );
}
