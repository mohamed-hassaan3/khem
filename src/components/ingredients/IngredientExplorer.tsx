"use client";

import Image from "next/image";
import { useState } from "react";

import LocaleLink from "@/src/components/i18n/LocaleLink";
import { interpolate } from "@/src/lib/i18n/interpolate";
import { ltrIsland } from "@/src/lib/i18n/rtl";
import { useDictionary, useLocale } from "@/src/providers/i18n-provider";
import type { Ingredient } from "@/src/types/content";

/**
 * Ingredient catalog with an olfactive-family filter and an expandable detail
 * panel.
 *
 * The client boundary stops here: the page stays a Server Component and passes
 * already-queried records in, so `src/services/content.ts` is never pulled into
 * the browser bundle.
 */

const DETAIL_PANEL_ID = "ingredient-detail";
const MAX_PRICE_TIER = 5;

export interface IngredientExplorerProps {
  ingredients: Ingredient[];
  /** Filter options, `"All"` first. Derived server-side from the records. */
  families: string[];
}

/** `$$$$` — the tier as a glyph run, with the numeric value exposed to AT. */
function PriceTier({ tier, label }: { tier: number; label: string }) {
  const clamped = Math.min(Math.max(tier, 1), MAX_PRICE_TIER);

  return (
    <span className="text-[10px] tracking-wider text-gold" aria-label={label}>
      {"$".repeat(clamped)}
    </span>
  );
}

export default function IngredientExplorer({
  ingredients,
  families,
}: IngredientExplorerProps) {
  const dict = useDictionary();
  const locale = useLocale();
  const island = ltrIsland(locale);
  const [activeFamily, setActiveFamily] = useState(families[0] ?? "All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const matchesFamily = (ingredient: Ingredient, family: string) =>
    family === families[0] ||
    ingredient.families.some(
      (candidate) => candidate.toLowerCase() === family.toLowerCase(),
    );

  const filtered = ingredients.filter((ingredient) =>
    matchesFamily(ingredient, activeFamily),
  );
  const selected = filtered.find((ingredient) => ingredient.id === selectedId);

  function handleFamilyChange(family: string) {
    setActiveFamily(family);

    // Drop a selection the new filter would hide, so the panel never shows an
    // ingredient that is no longer in the grid.
    const stillVisible = ingredients.some(
      (ingredient) =>
        ingredient.id === selectedId && matchesFamily(ingredient, family),
    );
    if (!stillVisible) setSelectedId(null);
  }

  return (
    <>
      {/* ── FILTER BAR ──────────────────────────────── */}
      <div className="sticky top-20 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-350 items-center gap-8 overflow-x-auto px-6 md:px-20">
          <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-ivory/30">
            {dict.ingredientsExplorer.filterByFamily}
          </span>
          {families.map((family) => (
            <button
              key={family}
              type="button"
              aria-pressed={activeFamily === family}
              onClick={() => handleFamilyChange(family)}
              className={`whitespace-nowrap border-b-2 py-5 font-heading text-[11px] tracking-[0.15em] transition-colors duration-300 ease-out ${
                activeFamily === family
                  ? "border-gold text-gold"
                  : "border-transparent text-ivory/35 hover:text-ivory/70"
              }`}
            >
              {family}
            </button>
          ))}
        </div>
      </div>

      {/* ── GRID + DETAIL ───────────────────────────── */}
      <section className="bg-background px-6 py-16 md:px-20 md:py-20">
        <div className="mx-auto grid max-w-350 grid-cols-1 gap-0.5 bg-border sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((ingredient) => {
            const isSelected = ingredient.id === selectedId;

            return (
              <button
                key={ingredient.id}
                type="button"
                aria-expanded={isSelected}
                aria-controls={DETAIL_PANEL_ID}
                onClick={() => setSelectedId(isSelected ? null : ingredient.id)}
                className={`img-zoom block overflow-hidden border text-start transition-colors duration-500 ease-out ${
                  isSelected
                    ? "border-gold/35 bg-gold/5"
                    : "border-transparent bg-surface hover:border-gold/20"
                }`}
              >
                <div className="relative h-65 overflow-hidden bg-card">
                  <Image
                    src={ingredient.image.url}
                    alt={ingredient.image.alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover brightness-60 saturate-50"
                  />
                </div>

                <div className="px-6 pb-7 pt-6" {...island}>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="font-heading text-base font-normal tracking-wide text-ivory">
                      {ingredient.name}
                    </h3>
                    <PriceTier
                      tier={ingredient.priceTier}
                      label={interpolate(dict.ingredientsExplorer.priceTier, {
                        tier: Math.min(
                          Math.max(ingredient.priceTier, 1),
                          MAX_PRICE_TIER,
                        ),
                        max: MAX_PRICE_TIER,
                      })}
                    />
                  </div>
                  <p className="mb-2 text-[10px] italic tracking-[0.12em] text-gold/50">
                    {ingredient.latinName}
                  </p>
                  <p className="mb-3 text-[11px] tracking-wide text-ivory/35">
                    {interpolate(dict.home.ingredients.from, {
                      origin: ingredient.origin,
                    })}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ingredient.families.map((family) => (
                      <span
                        key={family}
                        className="border border-gold/15 px-2 py-0.5 text-[9px] tracking-widest text-gold/45"
                      >
                        {family}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selected ? (
          <div
            id={DETAIL_PANEL_ID}
            className="mx-auto mt-0.5 grid max-w-350 grid-cols-1 border border-gold/20 bg-gold/5 lg:grid-cols-[400px_1fr]"
          >
            <div className="relative min-h-70 lg:min-h-120">
              <Image
                src={selected.image.url}
                alt={selected.image.alt}
                fill
                sizes="(min-width: 1024px) 400px, 100vw"
                className="object-cover brightness-55 saturate-50"
              />
            </div>

            <div className="flex flex-col justify-center p-8 md:p-14">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="eyebrow mb-2.5">{selected.rarity}</p>
                  <h2 className="mb-1 font-heading text-2xl font-normal text-ivory md:text-4xl">
                    {selected.name}
                  </h2>
                  <p className="mb-1 text-xs italic tracking-wider text-gold/55">
                    {selected.latinName}
                  </p>
                  <p className="text-[11px] tracking-widest text-ivory/35">
                    Origin: {selected.origin}
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="Close ingredient details"
                  onClick={() => setSelectedId(null)}
                  className="flex h-9 w-9 flex-none items-center justify-center border border-ivory/12 text-sm text-ivory/40 transition-colors duration-300 hover:border-gold hover:text-gold"
                >
                  ✕
                </button>
              </div>

              <div className="gold-line my-6" />

              <p className="mb-8 text-[13px] leading-loose text-ivory/50">
                {selected.description}
              </p>

              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <div>
                  <p className="mb-3 font-heading text-[10px] uppercase tracking-[0.2em] text-gold/50">
                    {dict.ingredientsExplorer.foundIn}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {selected.usedIn.map((perfume) => (
                      <li key={perfume.slug}>
                        <LocaleLink
                          href={`/perfume/${perfume.slug}`}
                          className="flex items-center gap-2 text-xs text-ivory/60 no-underline transition-colors duration-300 hover:text-gold"
                        >
                          <span
                            className="h-px w-4 bg-current"
                            aria-hidden="true"
                          />
                          {perfume.name}
                        </LocaleLink>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-3 font-heading text-[10px] uppercase tracking-[0.2em] text-gold/50">
                    {dict.ingredientsExplorer.rareFacts}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {selected.facts.map((fact) => (
                      <li
                        key={fact}
                        className="flex items-start gap-2 text-[11px] leading-relaxed text-ivory/40"
                      >
                        <span className="flex-none text-gold" aria-hidden="true">
                          —
                        </span>
                        {fact}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
