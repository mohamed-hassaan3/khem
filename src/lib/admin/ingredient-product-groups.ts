import { isScentItem, type ProductType } from "@/src/lib/product-types";
import type { CollectionKind } from "@/src/types/catalog";

export interface GroupableProductOption {
  slug: string;
  name: string;
  collectionSlug: string;
  productType: ProductType | null;
  collectionKind: CollectionKind;
  selected: boolean;
}

export type IngredientProductGroupKey =
  | "perfumes"
  | "body-mists"
  | "room-sprays";

export interface IngredientProductGroup {
  key: IngredientProductGroupKey;
  label: string;
  products: GroupableProductOption[];
  selectedCount: number;
  total: number;
}

export interface ScentProductFact {
  slug: string;
  productType: ProductType | null;
  collectionKind: CollectionKind;
}

const GROUP_DEFINITIONS: ReadonlyArray<{
  key: IngredientProductGroupKey;
  label: string;
  productType: ProductType | null;
}> = [
  { key: "perfumes", label: "Perfumes", productType: "PERFUME" },
  { key: "body-mists", label: "Body Mists", productType: "BODY_MIST" },
  { key: "room-sprays", label: "Room Sprays", productType: "ROOM_SPRAY" },
];

function groupKeyFor(option: Pick<GroupableProductOption, "productType" | "collectionKind">): IngredientProductGroupKey {
  const { productType, collectionKind } = option;
  if (productType === "PERFUME") return "perfumes";
  if (productType === "BODY_MIST") return "body-mists";
  if (productType === "ROOM_SPRAY") return "room-sprays";
  if (collectionKind === "BODY") return "body-mists";
  if (collectionKind === "HOME") return "room-sprays";
  return "perfumes";
}

/** Search and selected-only views; counts always describe the complete options. */
export function groupProductOptions(
  options: readonly GroupableProductOption[],
  query: string,
  selectedOnly: boolean,
): IngredientProductGroup[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const eligibleOptions = options.filter((option) =>
    isScentItem({
      productType: option.productType,
      collectionKind: option.collectionKind,
    }),
  );

  return GROUP_DEFINITIONS.map((definition) => {
    const completeGroup = eligibleOptions.filter(
      (option) => groupKeyFor(option) === definition.key,
    );

    return {
      key: definition.key,
      label: definition.label,
      selectedCount: completeGroup.filter((option) => option.selected).length,
      total: completeGroup.length,
      products: completeGroup.filter((option) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          option.name.toLocaleLowerCase().includes(normalizedQuery);
        return matchesQuery && (!selectedOnly || option.selected);
      }),
    };
  });
}

/** Whether a name is shared after the picker’s normalized-name comparison. */
export function hasRepeatedProductName(
  name: string,
  options: readonly Pick<GroupableProductOption, "name">[],
): boolean {
  const normalizedName = name.trim().toLocaleLowerCase();
  if (normalizedName.length === 0) return false;
  return (
    options.filter((option) => option.name.trim().toLocaleLowerCase() === normalizedName)
      .length > 1
  );
}

/** Split submitted slugs using only authoritative catalog facts. */
export function partitionScentProductSlugs(
  submittedSlugs: readonly string[],
  facts: readonly ScentProductFact[],
): { eligibleSlugs: string[]; droppedSlugs: string[] } {
  const factsBySlug = new Map(facts.map((fact) => [fact.slug, fact]));
  const eligibleSlugs: string[] = [];
  const droppedSlugs: string[] = [];

  for (const slug of submittedSlugs) {
    const fact = factsBySlug.get(slug);
    if (
      fact &&
      isScentItem({
        productType: fact.productType,
        collectionKind: fact.collectionKind,
      })
    ) {
      eligibleSlugs.push(slug);
    } else {
      droppedSlugs.push(slug);
    }
  }

  return { eligibleSlugs, droppedSlugs };
}
