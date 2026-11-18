/**
 * Delete search-tracking rows older than 90 days.
 *
 * `search_events` (supabase/sql/0074_search_events.sql) promises a 90-day
 * retention, and this is what keeps it: the VPS crontab
 * (`deploy/cron/khem.crontab`) calls it daily at 04:00 UTC through
 * `deploy/cron/khem-cron.sh`, which sends `CRON_SECRET`.
 *
 * ## Authentication
 *
 * A bearer token compared in constant time, exactly as the other cron routes
 * do. Without the guard anyone could trigger the purge — harmless in effect,
 * since it deletes only what policy already says must go, but the endpoint
 * should not answer strangers at all.
 */

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/src/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The retention the admin page and the privacy note promise. */
const KEEP_DAYS = 90;

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.error("[cron] CRON_SECRET is not configured; search events not purged");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const provided = request.headers.get("authorization") ?? "";
  const token = provided.startsWith("Bearer ") ? provided.slice(7) : "";

  if (!tokenMatches(token, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[cron] Supabase is not configured; search events not purged");
    return NextResponse.json({ error: "Database unavailable." }, { status: 500 });
  }

  const { data, error } = await supabase.rpc("purge_search_events", {
    keep_days: KEEP_DAYS,
  });

  if (error) {
    console.error(`[cron] purge_search_events failed: ${error.message}`);
    return NextResponse.json({ error: "Purge failed." }, { status: 500 });
  }

  const deleted = typeof data === "number" ? data : 0;
  if (deleted > 0) console.info(`[cron] purged ${deleted} search event(s)`);

  return NextResponse.json({ deleted });
}
