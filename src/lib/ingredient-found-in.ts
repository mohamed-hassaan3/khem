import { isScentItem } from "@/src/lib/product-types";
import type { IngredientUsage } from "@/src/types/content";

const TYPE_ORDER = ["PERFUME", "BODY_MIST", "ROOM_SPRAY"] as const;

function usageRank(product: IngredientUsage): number {
  if (product.productType !== null) return TYPE_ORDER.indexOf(product.productType as (typeof TYPE_ORDER)[number]);
  if (product.collectionKind === "FRAGRANCE") return 0;
  if (product.collectionKind === "BODY") return 1;
  if (product.collectionKind === "HOME") return 2;
  return 3;
}

export function orderedFoundInProducts(products: readonly IngredientUsage[]): IngredientUsage[] {
  return products
    .filter((product) => isScentItem({ productType: product.productType, collectionKind: product.collectionKind }))
    .map((product, index) => ({ product, index }))
    .sort((a, b) => usageRank(a.product) - usageRank(b.product) || a.index - b.index)
    .map(({ product }) => product);
}

export function visibleFoundInProducts(products: readonly IngredientUsage[], expanded: boolean): IngredientUsage[] {
  return expanded ? [...products] : products.slice(0, 6);
}
