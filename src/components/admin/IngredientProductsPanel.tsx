"use client";

/**
 * Which products a material is printed on.
 *
 * Selection is held as a complete slug set. Search, the selected-only view,
 * and collapsed groups affect presentation only and never discard a choice.
 */

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { setIngredientProducts } from "@/src/actions/admin/content";
import {
  AdminButton,
  AdminInput,
  AdminNotice,
} from "@/src/components/admin/fields";
import {
  groupProductOptions,
  hasRepeatedProductName,
  type IngredientProductGroupKey,
} from "@/src/lib/admin/ingredient-product-groups";
import { adminTypeLabel, type ProductType } from "@/src/lib/product-types";
import type { AdminActionResult } from "@/src/schemas/admin";
import type { CollectionKind } from "@/src/types/catalog";

export interface ProductOption {
  slug: string;
  name: string;
  collectionSlug: string;
  productType: ProductType | null;
  collectionKind: CollectionKind;
}

function initialOpenGroups(
  products: readonly ProductOption[],
  selected: readonly string[],
): Record<IngredientProductGroupKey, boolean> {
  const selectedSet = new Set(selected);
  const selectedProducts = products.filter((product) => selectedSet.has(product.slug));

  return {
    perfumes: true,
    "body-mists": selectedProducts.some((product) => product.productType === "BODY_MIST" || (product.productType === null && product.collectionKind === "BODY")),
    "room-sprays": selectedProducts.some((product) => product.productType === "ROOM_SPRAY" || (product.productType === null && product.collectionKind === "HOME")),
  };
}

export default function IngredientProductsPanel({
  ingredientId,
  products,
  selected,
}: {
  ingredientId: string;
  /** Every live product, for the picker. */
  products: readonly ProductOption[];
  /** The slugs currently linked. */
  selected: readonly string[];
}) {
  const router = useRouter();

  const [chosen, setChosen] = useState<string[]>([...selected]);
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [openGroups, setOpenGroups] = useState(() =>
    initialOpenGroups(products, selected),
  );
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Compared as sets so re-ordering does not read as an unsaved change.
  const dirty =
    chosen.length !== selected.length ||
    chosen.some((slug) => !selected.includes(slug));

  const chosenSet = useMemo(() => new Set(chosen), [chosen]);
  const repeatedNames = products;
  const groups = useMemo(
    () =>
      groupProductOptions(
        products.map((product) => ({
          ...product,
          selected: chosenSet.has(product.slug),
        })),
        query,
        selectedOnly,
      ),
    [products, query, selectedOnly, chosenSet],
  );
  const visibleCount = groups.reduce((count, group) => count + group.products.length, 0);

  function toggle(slug: string) {
    setResult(null);
    setChosen((current) =>
      current.includes(slug)
        ? current.filter((value) => value !== slug)
        : [...current, slug],
    );
  }

  function save() {
    setResult(null);

    startTransition(async () => {
      const outcome = await setIngredientProducts({
        ingredientId,
        productSlugs: chosen,
      });

      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  function toggleGroup(key: IngredientProductGroupKey) {
    setOpenGroups((current) => ({ ...current, [key]: !current[key] }));
  }

  const selectedProducts = chosen.map((slug) => ({
    slug,
    product: products.find((option) => option.slug === slug) ?? null,
  }));

  return (
    <div className="space-y-5">
      {result ? (
        <AdminNotice tone={result.ok ? "success" : "error"}>
          {result.message}
        </AdminNotice>
      ) : null}

      {products.length === 0 ? (
        <p className="border border-ground-border px-5 py-10 text-center text-[12px] leading-relaxed text-ground-muted">
          There are no live products to link this material to.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <AdminInput
              id="ingredient-product-search"
              label="Search products"
              value={query}
              onChange={setQuery}
              placeholder="Search by name"
            />
            <button
              type="button"
              aria-pressed={selectedOnly}
              onClick={() => setSelectedOnly((current) => !current)}
              className={`min-h-10 border px-4 py-2 text-[10px] uppercase tracking-[0.16em] transition-colors duration-300 ${
                selectedOnly
                  ? "border-gold/50 bg-gold/10 text-ground-accent"
                  : "border-ground-border text-ground-muted hover:border-gold/30 hover:text-ground"
              }`}
            >
              Selected only
            </button>
          </div>

          {chosen.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Selected products">
              {selectedProducts.map(({ slug, product }) => {
                const name = product?.name ?? slug;
                const label = product
                  ? adminTypeLabel(product.productType, product.collectionSlug)
                  : null;

                return (
                  <li
                    key={slug}
                    className="inline-flex max-w-full items-center gap-2 border border-gold/30 bg-gold/5 px-3 py-2"
                  >
                    <span className="min-w-0 break-words text-[11px] text-ground">
                      <span className="block">{name}</span>
                      {product && hasRepeatedProductName(name, repeatedNames) ? (
                        <span className="mt-0.5 block text-[9px] uppercase tracking-[0.18em] text-ground-accent/60">
                          {label}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${name}${label ? `, ${label}` : ""}`}
                      onClick={() => toggle(slug)}
                      className="flex h-6 w-6 flex-none items-center justify-center text-ground-muted transition-colors hover:text-ground-accent"
                    >
                      <X size={13} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {visibleCount === 0 ? (
            <p className="border border-ground-border px-5 py-8 text-center text-[12px] leading-relaxed text-ground-muted">
              {selectedOnly
                ? "No selected products match these filters."
                : "No products match this search."}
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                if (group.products.length === 0) return null;

                const queryActive = query.trim().length > 0;
                const expanded =
                  (queryActive && group.products.length > 0) || openGroups[group.key];

                return (
                  <section
                    key={group.key}
                    className="border border-ground-border/70"
                  >
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => toggleGroup(group.key)}
                      className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:text-ground-accent"
                    >
                      <span className="font-heading text-[10px] uppercase tracking-[0.18em] text-ground-muted">
                        {group.label}
                      </span>
                      <span className="text-[10px] tabular-nums tracking-wide text-ground-accent/70">
                        {group.selectedCount}/{group.total}
                      </span>
                    </button>

                    {expanded ? (
                      <div className="flex flex-wrap gap-2 border-t border-ground-border/60 p-3">
                        {group.products.map((product) => {
                          const active = chosenSet.has(product.slug);
                          const showType = hasRepeatedProductName(
                            product.name,
                            repeatedNames,
                          );

                          return (
                            <button
                              key={product.slug}
                              type="button"
                              aria-pressed={active}
                              onClick={() => toggle(product.slug)}
                              title={product.collectionSlug}
                              className={`inline-flex max-w-full min-w-0 flex-col items-start whitespace-normal border px-4 py-2 text-left text-[11px] tracking-wide transition-colors duration-300 ${
                                active
                                  ? "border-gold/50 bg-gold/10 text-ground-accent"
                                  : "border-ground-border text-ground-muted hover:border-gold/30 hover:text-ground"
                              }`}
                            >
                              <span className="block max-w-full break-words">
                                {product.name}
                              </span>
                              {showType ? (
                                <span
                                  className={`mt-0.5 block max-w-full break-words text-[9px] uppercase tracking-[0.18em] ${
                                    active
                                      ? "text-ground-accent/80"
                                      : "text-ground-accent/50"
                                  }`}
                                >
                                  {adminTypeLabel(
                                    product.productType,
                                    product.collectionSlug,
                                  )}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <AdminButton disabled={isPending || !dirty} onClick={save}>
          {isPending
            ? "Saving"
            : dirty
              ? "Save products"
              : "No unsaved changes"}
        </AdminButton>

        <span className="text-[11px] tracking-wide text-ground-muted">
          {chosen.length === 0
            ? "Printed on no products"
            : `Printed on ${chosen.length} product${chosen.length === 1 ? "" : "s"}`}
        </span>
      </div>
    </div>
  );
}
