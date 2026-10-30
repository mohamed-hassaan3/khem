import { matchesTerm } from "@/src/lib/admin/filter";
import type { AdminCategory } from "@/src/schemas/db/admin";

export interface ScentFamiliesRow {
  type: "scent-families";
  name: "Scent Families";
  slug: "scent-families";
  kind: "Scent profiles";
}

export type AdminCategoryListRow =
  | { type: "category"; category: AdminCategory }
  | ScentFamiliesRow;

const SCENT_FAMILIES_ROW: ScentFamiliesRow = {
  type: "scent-families",
  name: "Scent Families",
  slug: "scent-families",
  kind: "Scent profiles",
};

/** Keep the fixed profile shortcut first and filter only real categories. */
export function withScentFamiliesRow(
  categories: readonly AdminCategory[],
  term: string,
): AdminCategoryListRow[] {
  return [
    SCENT_FAMILIES_ROW,
    ...categories
      .filter((category) => matchesTerm(term, [category.name, category.slug, category.kind]))
      .map((category) => ({ type: "category" as const, category })),
  ];
}
