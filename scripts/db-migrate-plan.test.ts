import assert from "node:assert/strict";
import test from "node:test";

import {
  getBaselineFiles,
  getPendingFiles,
  parseMigrationOptions,
  validateAppliedFiles,
} from "./db-migrate-plan";

const files = [
  "0001_catalog.sql",
  "0002_content.sql",
  "0003_directory.sql",
  "0071_stock_movements.sql",
  "0072_future_change.sql",
];

test("pending file selection preserves migration filename order", () => {
  assert.deepEqual(getPendingFiles(files, ["0001_catalog.sql", "0002_content.sql"]), [
    "0003_directory.sql",
    "0071_stock_movements.sql",
    "0072_future_change.sql",
  ]);
});

test("baseline through 0071 includes all available files up to and including 0071", () => {
  assert.deepEqual(getBaselineFiles(files, "0071"), files.slice(0, 4));
});

test("baseline refuses a missing endpoint or a different range", () => {
  assert.throws(() => getBaselineFiles(files, "0070"), /Only baseline through 0071/);
  assert.throws(
    () => getBaselineFiles(files.filter((name) => !name.startsWith("0071_")), "0071"),
    /migration file is missing/,
  );
});

test("dry-run options list pending migrations without changing the plan", () => {
  assert.deepEqual(parseMigrationOptions(["--dry-run"]), {
    dryRun: true,
    applyFromStart: false,
  });
  assert.deepEqual(getPendingFiles(files, ["0001_catalog.sql"]), files.slice(1));
  assert.throws(
    () => parseMigrationOptions(["--dry-run", "--apply-from-start"]),
    /cannot be combined/,
  );
});

test("history must be an exact contiguous prefix of current files", () => {
  assert.doesNotThrow(() => validateAppliedFiles(files, files.slice(0, 2)));
  assert.throws(
    () => validateAppliedFiles(files, ["0001_catalog.sql", "0071_stock_movements.sql"]),
    /history is unexpected/,
  );
  assert.throws(
    () => validateAppliedFiles(files, ["old_migration.sql"]),
    /history is unexpected/,
  );
});
