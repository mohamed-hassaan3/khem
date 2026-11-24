/**
 * Refresh the shop when a sale or an offer starts or ends on its own schedule.
 *
 * An admin save already revalidates the whole locale tree
 * (`revalidatePromotions()` / `revalidateOffers()`), but a promotion that
 * *begins* at its `startsAt` or *lapses* at its `endsAt` involves no save — the
 * database view `active_product_promotions` simply starts or stops returning it.
 * Without this job, product pages (ISR 1 h), collections and the home page
 * (24 h) went on quoting the old price for that long, while checkout — dynamic,
 * priced by `place_order()` from the same view — charged the new one. Nobody
 * paid a price they were not shown at review, but the grid and the review
 * disagreed (prompts/admin-audit-and-performance-stage-7.md, F4).
 *
 * ## Stateless by design
 *
 * Runs every five minutes (`deploy/cron/khem.crontab`) and asks one question:
 * did any **active** promotion or offer cross a boundary in the last
 * {@link LOOKBACK_MINUTES} minutes? The window is three runs wide, so one missed
 * or slow run is still caught; the overlap means a boundary can be revalidated
 * twice, which costs a handful of re-renders and nothing else. No table records
 * the last run, so there is nothing to migrate and nothing to drift.
 *
 * Inactive rows are ignored: switching one off is an admin save, which has
 * already revalidated.
 *
 * Revalidation is per process; the VPS runs exactly one Next process
 * (`deploy/ecosystem.config.cjs`), which is what makes this sufficient.
 */

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { revalidatePromotions } from "@/src/lib/admin/revalidate";
import { getSupabaseAdmin } from "@/src/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOOKBACK_MINUTES = 15;

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error("[cron] CRON_SECRET is not configured; promotion boundaries not checked");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const provided = request.headers.get("authorization") ?? "";
  const token = provided.startsWith("Bearer ") ? provided.slice(7) : "";

  if (!tokenMatches(token, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[cron] Supabase is not configured; promotion boundaries not checked");
    return NextResponse.json({ error: "Database unavailable." }, { status: 500 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_MINUTES * 60_000).toISOString();
  const until = now.toISOString();

  /*
   * Four head-only counts — each table, each boundary — with plain column
   * filters rather than one hand-built `or()` string. A boundary is crossed
   * when it lies in (since, now].
   */
  const checks = (["promotions", "offers"] as const).flatMap((table) =>
    (["startsAt", "endsAt"] as const).map((column) =>
      supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("isActive", true)
        .gt(column, since)
        .lte(column, until),
    ),
  );

  const results = await Promise.all(checks);
  const failed = results.find((result) => result.error);

  if (failed?.error) {
    console.error(`[cron] promotion boundary check failed: ${failed.error.message}`);
    return NextResponse.json({ error: "Check failed." }, { status: 500 });
  }

  const crossed = results.reduce((sum, result) => sum + (result.count ?? 0), 0);

  if (crossed > 0) {
    revalidatePromotions();
    console.info(`[cron] ${crossed} promotion/offer boundary(ies) crossed; shop revalidated`);
  }

  return NextResponse.json({ crossed, revalidated: crossed > 0 });
}
