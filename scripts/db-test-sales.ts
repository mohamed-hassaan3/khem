/**
 * Run the sales-ledger scenarios, then throw the whole thing away.
 *
 *     npm run db:test:sales
 *
 * `supabase/tests/sales_ledger_scenarios.sql` places real orders through
 * `place_order()` — a coupon, a promotion, a Buy 2 Get 1, a Discovery Credit, a
 * points redemption, a refund — and asserts what the ledger recorded for each.
 * Going through the real function is the point: a fixture that wrote ledger
 * rows directly would happily agree with a bug in the thing it was testing.
 *
 * ## It always rolls back
 *
 * The file runs inside one transaction which this script rolls back whether it
 * passed or failed. Nothing it writes — orders, discounts, promotions, offers,
 * credits, points, the prices and costs it edits on real products — survives
 * the run. It is therefore safe against a live database, with one caveat worth
 * stating rather than burying: `order_number_seq` is a sequence, and sequences
 * do not roll back. A run leaves a gap in the order numbering and nothing else.
 *
 * ## Output
 *
 * The scenarios speak through `raise notice`, which `pg` delivers as a `notice`
 * event rather than in the result — so the handler below is what makes a pass
 * visible. A failed assertion raises, which aborts the transaction and exits
 * non-zero, so this is safe to put in CI beside `db:verify`.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { connect, redactUrl, connectionString } from "./db";

const FILE = path.join(
  process.cwd(),
  "supabase",
  "tests",
  "sales_ledger_scenarios.sql",
);

async function main(): Promise<void> {
  const sql = await readFile(FILE, "utf8");
  const client = await connect();

  console.log(`Sales ledger scenarios against ${redactUrl(connectionString())}`);
  console.log("Every write below is rolled back.\n");

  // `notice` carries the scenario log. Without this handler a passing run is
  // silent, which is indistinguishable from a run that did nothing.
  client.on("notice", (notice) => {
    if (notice.message) console.log(notice.message);
  });

  let failure: unknown = null;

  try {
    await client.query("begin");
    await client.query(sql);
  } catch (cause) {
    failure = cause;
  } finally {
    // Rolled back on the way out, always — including after a pass. This script
    // proves behaviour; it does not leave test orders in the book.
    try {
      await client.query("rollback");
    } finally {
      await client.end();
    }
  }

  if (failure) {
    console.error(
      `\n✗ ${failure instanceof Error ? failure.message : "unknown error"}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log("\n✓ Sales ledger scenarios passed. Transaction rolled back.");
}

main().catch((cause: unknown) => {
  console.error(
    `Scenarios failed to run: ${cause instanceof Error ? cause.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
