/**
 * Close the windows nothing else notices passing.
 *
 * Two instruments, one nightly request: Discovery Credits and KHEM Points. See
 * the note beside the points sweep at the foot of this file for why they share a
 * cron rather than having one each.
 *
 * A Discovery Credit is valid for sixty days from the Set being delivered.
 * Nothing in the ordinary flow of the site notices the moment that passes — no
 * order is placed, no status changes — so a scheduled sweep is what turns the
 * policy into a fact in the ledger.
 *
 * ## Why the work is one SQL call
 *
 * `expire_discovery_credits()` selects the lapsed credits and writes their
 * closing EXPIRED rows inside Postgres. Doing the loop here would mean reading a
 * list, deciding, and writing back — the gap `supabase/sql/0015_orders.sql`
 * exists to close, and the one place a double-run could write two closing rows
 * for one credit.
 *
 * It is idempotent by construction rather than by a guard: the row it writes
 * takes the balance to zero, and the query only selects credits with a positive
 * balance, so a second run finds nothing.
 *
 * ## Why nothing here is urgent
 *
 * A credit that lapsed at midnight and is swept at 03:00 is not a problem: the
 * `credit_balances` view already reports it EXPIRED the instant `expiresAt`
 * passes, so nothing can be spent in the gap. The sweep writes the *transaction*
 * that makes the lapse permanent and auditable — the ledger's record of it, not
 * the enforcement.
 *
 * ## Authentication
 *
 * A bearer token compared in constant time, exactly as
 * `sweep-unpaid-orders` does. Vercel sends `CRON_SECRET` on scheduled
 * invocations; without the guard, anyone on the internet could expire the
 * house's outstanding credits.
 */

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/src/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constant-time comparison. See `sweep-unpaid-orders` for why. */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error("[cron] CRON_SECRET is not configured; credits not swept");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const provided = request.headers.get("authorization") ?? "";
  const token = provided.startsWith("Bearer ") ? provided.slice(7) : "";

  if (!tokenMatches(token, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[cron] Supabase is not configured; credits not swept");
    return NextResponse.json({ error: "Database unavailable." }, { status: 500 });
  }

  const { data, error } = await supabase.rpc("expire_discovery_credits");

  if (error) {
    console.error(`[cron] expire_discovery_credits failed: ${error.message}`);
    return NextResponse.json({ error: "Sweep failed." }, { status: 500 });
  }

  const expired = typeof data === "number" ? data : 0;

  // Counts only. A credit names a customer and a sum of money, and neither
  // belongs in a log line.
  if (expired > 0) {
    console.info(`[cron] expired ${expired} discovery credit(s)`);
  }

  /*
   * ── KHEM Points ────────────────────────────────────────────
   *
   * The same job on the other instrument, in the same request rather than in a
   * cron of its own. Two reasons, and the first is the binding one:
   *
   *  1. **The Hobby plan allows one run per day per cron**, and a more frequent
   *     expression makes Vercel refuse the deployment outright. A fifth entry
   *     would be competing for the same nightly allowance to do a job that is
   *     already being done here.
   *  2. They are the same job. Both close a window that nothing in the ordinary
   *     flow of the site would notice passing, both are idempotent by
   *     construction, and neither is urgent — `reward_balances` and
   *     `credit_balances` already report a lapsed instrument correctly the
   *     instant its date passes. The sweep writes the *transaction* that makes
   *     the lapse permanent and auditable, not the enforcement.
   *
   * Points are swept **after** the credits and never allowed to fail the
   * response the credits earned: a points sweep that errors leaves some rows to
   * be closed tomorrow, and reporting the whole run as failed would hide the
   * work that did land.
   */
  const points = await supabase.rpc("expire_points");

  if (points.error) {
    console.error(`[cron] expire_points failed: ${points.error.message}`);
    return NextResponse.json({ expired, pointsExpired: 0, pointsFailed: true });
  }

  const pointsExpired = typeof points.data === "number" ? points.data : 0;

  if (pointsExpired > 0) {
    console.info(`[cron] closed points for ${pointsExpired} customer(s)`);
  }

  return NextResponse.json({ expired, pointsExpired });
}
