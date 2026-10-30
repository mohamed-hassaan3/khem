import assert from "node:assert/strict";
import test from "node:test";

import {
  groupProductOptions,
  hasRepeatedProductName,
  type GroupableProductOption,
} from "../src/lib/admin/ingredient-product-groups";

const options: GroupableProductOption[] = [
  {
    slug: "nile-perfume",
    name: "Nile",
    collectionSlug: "signature",
    productType: "PERFUME",
    collectionKind: "FRAGRANCE",
    selected: true,
  },
  {
    slug: "nile-mist",
    name: " Nile ",
    collectionSlug: "body-mist",
    productType: "BODY_MIST",
    collectionKind: "BODY",
    selected: false,
  },
  {
    slug: "nile-spray",
    name: "Nile",
    collectionSlug: "room-spray",
    productType: "ROOM_SPRAY",
    collectionKind: "HOME",
    selected: true,
  },
  {
    slug: "discovery-box",
    name: "Discovery Box",
    collectionSlug: "discovery-sets",
    productType: "BOX",
    collectionKind: "DISCOVERY",
    selected: false,
  },
  {
    slug: "legacy",
    name: "Legacy Scent",
    collectionSlug: "signature",
    productType: null,
    collectionKind: "FRAGRANCE",
    selected: false,
  },
];

test("groupProductOptions places types and null types in their groups", () => {
  const groups = groupProductOptions(options, "", false);

  assert.deepEqual(
    groups.map((group) => [group.key, group.products.map((product) => product.slug)]),
    [
      ["perfumes", ["nile-perfume", "legacy"]],
      ["body-mists", ["nile-mist"]],
      ["room-sprays", ["nile-spray"]],
    ],
  );
});

test("groupProductOptions searches names without case sensitivity", () => {
  const groups = groupProductOptions(options, "nIlE", false);
  assert.deepEqual(
    groups.flatMap((group) => group.products.map((product) => product.slug)),
    ["nile-perfume", "nile-mist", "nile-spray"],
  );
});

test("selected-only filters visible products but preserves selection and counts", () => {
  const all = groupProductOptions(options, "", false);
  const selectedOnly = groupProductOptions(options, "", true);

  assert.deepEqual(
    selectedOnly.flatMap((group) => group.products.map((product) => product.slug)),
    ["nile-perfume", "nile-spray"],
  );
  assert.deepEqual(
    selectedOnly.map(({ key, selectedCount, total }) => [key, selectedCount, total]),
    all.map(({ key, selectedCount, total }) => [key, selectedCount, total]),
  );
  assert.deepEqual(
    options.filter((product) => product.selected).map((product) => product.slug),
    ["nile-perfume", "nile-spray"],
  );
});

test("group counts are unchanged by search and selected-only filtering", () => {
  const all = groupProductOptions(options, "", false);
  const filtered = groupProductOptions(options, "legacy", true);

  assert.deepEqual(
    filtered.map(({ key, selectedCount, total }) => [key, selectedCount, total]),
    all.map(({ key, selectedCount, total }) => [key, selectedCount, total]),
  );
});

test("same names after trim and lowercase are repeated", () => {
  assert.equal(hasRepeatedProductName("Nile", options), true);
  assert.equal(hasRepeatedProductName(" unmatched ", options), false);
});
