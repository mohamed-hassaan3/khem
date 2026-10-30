import assert from "node:assert/strict";
import test from "node:test";

import { withScentFamiliesRow } from "../src/lib/admin/category-rows";
import type { AdminCategory } from "../src/schemas/db/admin";

const categories: AdminCategory[] = [
  {
    id: "fragrances",
    name: "Fragrances",
    slug: "fragrances",
    description: "Fragrance category description.",
    bannerUrl: "https://images.unsplash.com/fragrances",
    bannerAlt: "Fragrance display",
    kind: "FRAGRANCE",
    isEnabled: true,
    sortOrder: 0,
  },
  {
    id: "body-care",
    name: "Body Care",
    slug: "body-care",
    description: "Body care category description.",
    bannerUrl: "https://images.unsplash.com/body-care",
    bannerAlt: "Body care display",
    kind: "BODY",
    isEnabled: true,
    sortOrder: 1,
  },
];

function rowSlugs(rows: ReturnType<typeof withScentFamiliesRow>): string[] {
  return rows.map((row) => row.type === "scent-families" ? row.slug : row.category.slug);
}

test("pinned Scent Families row is first for an empty search and preserves category order", () => {
  assert.deepEqual(rowSlugs(withScentFamiliesRow(categories, "")), [
    "scent-families",
    "fragrances",
    "body-care",
  ]);
});

test("pinned row stays first when a search term matches a real category", () => {
  assert.deepEqual(rowSlugs(withScentFamiliesRow(categories, "body")), [
    "scent-families",
    "body-care",
  ]);
});

test("pinned row remains when the search term matches no real category", () => {
  assert.deepEqual(rowSlugs(withScentFamiliesRow(categories, "missing")), [
    "scent-families",
  ]);
});

test("pinned row is present when the real category list is empty", () => {
  assert.deepEqual(rowSlugs(withScentFamiliesRow([], "")), ["scent-families"]);
});

test("helper never mutates its category input", () => {
  const original = structuredClone(categories);
  const originalReferences = [...categories];
  withScentFamiliesRow(categories, "body");
  assert.deepEqual(categories, original);
  assert.equal(categories[0], originalReferences[0]);
  assert.equal(categories[1], originalReferences[1]);
});
