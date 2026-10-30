import assert from "node:assert/strict";
import test from "node:test";

import {
  groupProductOptions,
  partitionScentProductSlugs,
  type GroupableProductOption,
  type ScentProductFact,
} from "../src/lib/admin/ingredient-product-groups";
import { isScentItem } from "../src/lib/product-types";

test("isScentItem accepts scent product types and legacy fragrance rows", () => {
  assert.equal(isScentItem({ productType: "PERFUME", collectionKind: "FRAGRANCE" }), true);
  assert.equal(isScentItem({ productType: "BODY_MIST", collectionKind: "BODY" }), true);
  assert.equal(isScentItem({ productType: "ROOM_SPRAY", collectionKind: "HOME" }), true);
  assert.equal(isScentItem({ productType: null, collectionKind: "FRAGRANCE" }), true);
  assert.equal(isScentItem({ productType: null, collectionKind: "BODY" }), true);
  assert.equal(isScentItem({ productType: null, collectionKind: "HOME" }), true);
});

test("isScentItem rejects boxes, non-scent types and set collection kinds", () => {
  assert.equal(isScentItem({ productType: "BOX", collectionKind: "DISCOVERY" }), false);
  assert.equal(isScentItem({ productType: "GIFT", collectionKind: "GIFT" }), false);
  assert.equal(isScentItem({ productType: "ANTIQUE", collectionKind: "FRAGRANCE" }), false);
  assert.equal(isScentItem({ productType: "DECORATIVE", collectionKind: "HOME" }), false);
  assert.equal(isScentItem({ productType: null, collectionKind: "GIFT" }), false);
  assert.equal(isScentItem({ productType: null, collectionKind: "DISCOVERY" }), false);
  assert.equal(isScentItem({ productType: "PERFUME", collectionKind: "DISCOVERY" }), false);
});

test("groupProductOptions excludes every ineligible option", () => {
  const options: GroupableProductOption[] = [
    {
      slug: "perfume",
      name: "A Perfume",
      collectionSlug: "signature",
      productType: "PERFUME",
      collectionKind: "FRAGRANCE",
      selected: false,
    },
    {
      slug: "box",
      name: "Discovery Box",
      collectionSlug: "discovery-sets",
      productType: "BOX",
      collectionKind: "DISCOVERY",
      selected: false,
    },
    {
      slug: "gift",
      name: "Gift Set",
      collectionSlug: "gift-sets",
      productType: "GIFT",
      collectionKind: "GIFT",
      selected: true,
    },
    {
      slug: "antique",
      name: "Antique Bottle",
      collectionSlug: "decorative-objects",
      productType: "ANTIQUE",
      collectionKind: "HOME",
      selected: false,
    },
    {
      slug: "legacy-gift",
      name: "Legacy Gift",
      collectionSlug: "gift-sets",
      productType: null,
      collectionKind: "GIFT",
      selected: false,
    },
  ];

  assert.deepEqual(
    groupProductOptions(options, "", false)
      .flatMap((group) => group.products.map((product) => product.slug)),
    ["perfume"],
  );
});

test("server-side slug partition keeps eligible products and reports ineligible ones", () => {
  const facts: ScentProductFact[] = [
    { slug: "perfume", productType: "PERFUME", collectionKind: "FRAGRANCE" },
    { slug: "mist", productType: "BODY_MIST", collectionKind: "BODY" },
    { slug: "box", productType: "BOX", collectionKind: "DISCOVERY" },
    { slug: "gift", productType: "GIFT", collectionKind: "GIFT" },
  ];

  assert.deepEqual(partitionScentProductSlugs(["perfume", "box", "gift", "mist"], facts), {
    eligibleSlugs: ["perfume", "mist"],
    droppedSlugs: ["box", "gift"],
  });
});
