import assert from "node:assert/strict";
import test from "node:test";

import { adminTypeLabel } from "../src/lib/product-types";

test("admin type labels distinguish same-named product types", () => {
  const products = [
    { name: "Nile", productType: "PERFUME" as const, collectionSlug: "signature" },
    { name: "Nile", productType: "BODY_MIST" as const, collectionSlug: "body-mist" },
    { name: "Nile", productType: "ROOM_SPRAY" as const, collectionSlug: "room-spray" },
  ];
  const labels = products.map((product) =>
    adminTypeLabel(product.productType, product.collectionSlug),
  );

  assert.deepEqual(labels, ["Perfume", "Body Mist", "Room Spray"]);
  assert.equal(new Set(labels).size, 3);
});

test("admin type label falls back to the collection slug for a null type", () => {
  assert.equal(adminTypeLabel(null, "body-care"), "body-care");
  assert.equal(adminTypeLabel(null, "   "), "Unknown collection");
});
