/**
 * Run the finance scenarios, then throw the whole thing away.
 *
 *     npm run db:test:finance
 *
 * Two halves, because Finance's arithmetic lives in two places and both have to
 * be right:
 *
 *   · `supabase/tests/finance_scenarios.sql` — everything Postgres computes.
 *     It places a real order through `place_order()`, records real expenses,
 *     generates a real recurring rule and refunds a real order, then asserts
 *     what moved. Going through the real functions is the point: fixtures that
 *     wrote rows directly would happily agree with a bug in the thing they were
 *     testing.
 *
 *   · The pace and comparison arithmetic in `src/lib/admin/finance.ts`, checked
 *     against the worked examples in `src/docs/Finance-Expenses.md` §7, §8 and
 *     §11. Those functions are pure, take an explicit `asOf`, and never touch
 *     the database — so they are asserted here directly rather than through a
 *     screen.
 *
 * ## The SQL half always rolls back
 *
 * It runs inside one transaction which this script rolls back whether it passed
 * or failed. Nothing it writes — the order, the expenses, the recurring rule,
 * the target, the prices and costs it edits on real products — survives. It is
 * therefore safe against a live database, with one caveat worth stating rather
 * than burying: `order_number_seq` is a sequence, and sequences do not roll
 * back. A run leaves a gap in the order numbering and nothing else.
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

import {
  changePercent,
  financeWindow,
  monthPace,
  previousWindow,
  targetProgress,
} from "../src/lib/admin/finance";

import { connect, redactUrl, connectionString } from "./db";

const FILE = path.join(process.cwd(), "supabase", "tests", "finance_scenarios.sql");

const failures: string[] = [];

function check(ok: boolean, description: string, detail = ""): void {
  if (ok) {
    console.log(`  ok  ${description}`);
    return;
  }
  failures.push(detail ? `${description} — ${detail}` : description);
  console.log(`  ✗   ${description}${detail ? ` — ${detail}` : ""}`);
}

/**
 * The pure arithmetic, against the brief's own worked examples.
 *
 * Every number below is copied from `src/docs/Finance-Expenses.md`. If one of
 * these fails, the dashboard is telling the desk to sell the wrong amount per
 * day — which is the kind of wrong that gets acted on.
 */
function verifyPace(): void {
  console.log("\nPace and comparison arithmetic");

  // §7 — Net Profit Target 100,000 · Actual 72,000 · Remaining 28,000 · 72%.
  const progress = targetProgress(10_000_000, 7_200_000);
  check(
    progress?.remainingInCents === 2_800_000 &&
      Math.round(progress.achievement ?? 0) === 72,
    "§7 target progress: 100,000 target, 72,000 actual → 28,000 remaining, 72%",
    `got ${progress?.remainingInCents} and ${progress?.achievement}`,
  );

  // Over-achievement is reported as it is, not capped at 100%.
  const beaten = targetProgress(10_000_000, 11_500_000);
  check(
    beaten?.remainingInCents === 0 && Math.round(beaten.achievement ?? 0) === 115,
    "§19 achievement above target reads 115%, with nothing remaining",
    `got ${beaten?.remainingInCents} and ${beaten?.achievement}`,
  );

  // An unknown actual — a month whose sales carry no cost — is not 0%.
  const unknown = targetProgress(10_000_000, null);
  check(
    unknown?.achievement === null && unknown.remainingInCents === null,
    "an unknown actual reports no achievement rather than 0%",
  );

  check(targetProgress(null, 5_000) === null, "no target means no meter");

  /*
   * §8 — target 300,000, actual 120,000, 12 days remaining → 15,000 a day.
   *
   * A 30-day month with 18 days elapsed leaves 12. Asked as of the 18th of
   * September 2026, which is what `asOf` exists for: the function stays pure and
   * the assertion does not depend on the day this test happens to run.
   */
  const pace = monthPace(
    "2026-09-01",
    30_000_000,
    12_000_000,
    new Date("2026-09-18T09:00:00.000Z"),
  );
  check(
    pace?.daysInMonth === 30 &&
      pace.daysElapsed === 18 &&
      pace.daysRemaining === 12 &&
      pace.requiredPerRemainingDayInCents === 1_500_000,
    "§8 required pace: 300,000 target, 120,000 actual, 12 days left → 15,000/day",
    `got ${pace?.daysRemaining} days and ${pace?.requiredPerRemainingDayInCents}`,
  );

  check(
    pace?.averageDailyTargetInCents === 1_000_000,
    "§8 a flat 300,000 month is 10,000 a day",
    `got ${pace?.averageDailyTargetInCents}`,
  );

  // Target met: nothing is required, and the answer is not a negative number.
  const met = monthPace(
    "2026-09-01",
    30_000_000,
    31_000_000,
    new Date("2026-09-18T09:00:00.000Z"),
  );
  check(
    met?.requiredPerRemainingDayInCents === null,
    "a met target requires nothing per day rather than a negative figure",
  );

  // The month is over: there is no day left to earn it in, and dividing by
  // zero is not the answer.
  const over = monthPace(
    "2026-08-01",
    30_000_000,
    12_000_000,
    new Date("2026-09-18T09:00:00.000Z"),
  );
  check(
    over?.daysRemaining === 0 && over.requiredPerRemainingDayInCents === null,
    "a finished month reports no required pace",
  );

  // February, and a leap February, are not special cases anywhere.
  check(
    monthPace("2024-02-01", 2_800_000, 0, new Date("2024-02-10T00:00:00.000Z"))
      ?.daysInMonth === 29,
    "February 2024 is 29 days long",
  );

  // §11 — Revenue +18.4%.
  check(
    Math.round((changePercent(23_680_000, 20_000_000) ?? 0) * 10) / 10 === 18.4,
    "§11 comparison: 200,000 → 236,800 is +18.4%",
    `got ${changePercent(23_680_000, 20_000_000)}`,
  );

  check(
    changePercent(5_000, 0) === null,
    "growth from a previous period of zero is no comparison, not +100%",
  );

  check(
    changePercent(null, 5_000) === null,
    "an unknown figure produces no comparison",
  );

  // A whole calendar month compares against the whole month before it — 31 days
  // against 30, which is what "October vs September" means to a desk.
  const monthBefore = previousWindow({ from: "2026-10-01", to: "2026-10-31" });
  check(
    monthBefore?.from === "2026-09-01" && monthBefore.to === "2026-09-30",
    "a calendar month compares against the calendar month before it",
    `got ${monthBefore?.from} → ${monthBefore?.to}`,
  );

  // Any other window compares against the same number of days ending the day
  // before it starts.
  const weekBefore = previousWindow({ from: "2026-09-14", to: "2026-09-20" });
  check(
    weekBefore?.from === "2026-09-07" && weekBefore.to === "2026-09-13",
    "a seven-day window compares against the seven days before it",
    `got ${weekBefore?.from} → ${weekBefore?.to}`,
  );

  check(
    previousWindow({ from: null, to: null }) === null,
    "an unbounded window has nothing before it",
  );

  // Yesterday is one whole day, not a rolling 24 hours.
  const yesterday = financeWindow("yesterday");
  check(
    yesterday.from === yesterday.to && yesterday.from !== null,
    "the yesterday window is exactly one day",
  );

  const all = financeWindow("all");
  check(
    all.from === null && all.to === null,
    "the all-time window is unbounded at both ends",
  );
}

async function main(): Promise<void> {
  const sql = await readFile(FILE, "utf8");
  const client = await connect();

  console.log(`Finance scenarios against ${redactUrl(connectionString())}`);
  console.log("Every database write below is rolled back.\n");

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
    // proves behaviour; it does not leave test expenses in the books.
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

  verifyPace();

  if (failures.length > 0) {
    console.error(`\n${failures.length} arithmetic check(s) failed:`);
    for (const entry of failures) console.error(`  ✗ ${entry}`);
    process.exitCode = 1;
    return;
  }

  console.log("\n✓ Finance scenarios passed. Transaction rolled back.");
}

main().catch((cause: unknown) => {
  console.error(
    `Scenarios failed to run: ${cause instanceof Error ? cause.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
