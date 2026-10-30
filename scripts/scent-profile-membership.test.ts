import assert from "node:assert/strict";
import test from "node:test";

import { createCategorySchema, createProductSchema, updateProductSchema } from "../src/schemas/admin";
import { orderedFoundInProducts, visibleFoundInProducts } from "../src/lib/ingredient-found-in";
import { isExactProfileOrder, diffScentProfileMemberships } from "../src/lib/scent-profile-membership";
import { isScentItem } from "../src/lib/product-types";
import type { IngredientUsage } from "../src/types/content";

test("scent item eligibility follows product type and collection kind", () => {
  assert.equal(isScentItem({ productType: "PERFUME", collectionKind: "FRAGRANCE" }), true);
  assert.equal(isScentItem({ productType: "BODY_MIST", collectionKind: "BODY" }), true);
  assert.equal(isScentItem({ productType: "ROOM_SPRAY", collectionKind: "HOME" }), true);
  assert.equal(isScentItem({ productType: null, collectionKind: "FRAGRANCE" }), true);
  assert.equal(isScentItem({ productType: "BOX", collectionKind: "DISCOVERY" }), false);
  assert.equal(isScentItem({ productType: "GIFT", collectionKind: "GIFT" }), false);
  assert.equal(isScentItem({ productType: "ANTIQUE", collectionKind: "FRAGRANCE" }), false);
  assert.equal(isScentItem({ productType: "DECORATIVE", collectionKind: "HOME" }), false);
  assert.equal(isScentItem({ productType: null, collectionKind: "GIFT" }), false);
  assert.equal(isScentItem({ productType: null, collectionKind: "DISCOVERY" }), false);
});

test("membership diff identifies additions, removals, unchanged and ineligible clearing", () => {
  assert.deepEqual(diffScentProfileMemberships(["fresh", "woody"], ["fresh", "floral"], true), { add: ["floral"], remove: ["woody"] });
  assert.deepEqual(diffScentProfileMemberships(["fresh"], ["fresh"], true), { add: [], remove: [] });
  assert.deepEqual(diffScentProfileMemberships(["fresh", "woody"], ["floral"], false), { add: [], remove: ["fresh", "woody"] });
});

test("profile reorder requires exactly the stored members", () => {
  assert.equal(isExactProfileOrder(["a", "b", "c"], ["c", "a", "b"]), true);
  assert.equal(isExactProfileOrder(["a", "b"], ["a"]), false);
  assert.equal(isExactProfileOrder(["a", "b"], ["a", "b", "extra"]), false);
  assert.equal(isExactProfileOrder(["a", "b"], ["a", "a"]), false);
});

test("product schemas reject an unknown profile slug", () => {
  const values = {
    slug: "nile-perfume",
    name: "Nile Perfume",
    description: "A fragrance with a long enough description.",
    concentration: "EAU_DE_PARFUM",
    format: "",
    productType: "PERFUME",
    volumeMl: "50",
    priceEgp: "100",
    costEgp: "",
    sku: "NILE-50",
    collectionSlug: "signature",
    scentProfiles: ["fresh"],
  };
  assert.equal(createProductSchema.safeParse(values).success, true);
  assert.equal(updateProductSchema.safeParse(values).success, true);
  const invalid = { ...values, scentProfiles: ["unknown"] };
  assert.equal(createProductSchema.safeParse(invalid).success, false);
  assert.equal(updateProductSchema.safeParse(invalid).success, false);
});

test("category validation reserves scent-families", () => {
  assert.equal(createCategorySchema.shape.slug.safeParse("scent-families").success, false);
});

function usage(slug: string, productType: IngredientUsage["productType"], collectionKind: IngredientUsage["collectionKind"]): IngredientUsage {
  return { slug, name: slug, productType, collectionKind };
}

test("Found in orders scent types, filters boxes, and limits collapsed lists to six", () => {
  const products = [
    usage("spray", "ROOM_SPRAY", "HOME"),
    usage("legacy-home", null, "HOME"),
    usage("mist", "BODY_MIST", "BODY"),
    usage("legacy-body", null, "BODY"),
    usage("perfume", "PERFUME", "FRAGRANCE"),
    usage("legacy-fragrance", null, "FRAGRANCE"),
    usage("box", "BOX", "DISCOVERY"),
  ];
  const ordered = orderedFoundInProducts(products);
  assert.deepEqual(ordered.map((product) => product.slug), ["perfume", "legacy-fragrance", "mist", "legacy-body", "spray", "legacy-home"]);
  assert.equal(visibleFoundInProducts(ordered, false).length, 6);
  const seven = [...ordered, usage("second-spray", "ROOM_SPRAY", "HOME")];
  assert.equal(visibleFoundInProducts(seven, false).length, 6);
  assert.equal(visibleFoundInProducts(seven, true).length, 7);
});
