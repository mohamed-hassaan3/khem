/**
 * Put back what nobody paid for.
 *
 * The other half of reserving stock before payment. `src/actions/checkout.ts`
 * creates a card order as PENDING with its bottles already off the shelf,
 * because an order and its stock movement are one event and checkout gets no
 * exception from that. The price of that choice is abandoned baskets holding
 * inventory, and this is what pays it: anything still PENDING, UNPAID and CARD
 * after thirty minutes is cancelled and restocked.
 *
 * Scheduled every fifteen minutes by `vercel.json`, so nothing waits longer
 * than about forty-five.
 *
 * ## Why the work is one SQL call
 *
 * `expire_unpaid_orders()` selects, cancels via `set_order_status()`, and
 * restocks via `restock_order()` — all inside Postgres, all under the same
 * locks the rest of the order system uses. Doing the loop here would mean
 * reading a list, deciding, and writing back, which is the gap
 * `supabase/sql/0015_orders.sql` exists to close. It is also idempotent:
 * `restock_order()` is guarded by `"stockReleasedAt"`, so a double run restocks
 * once.
 *
 * ## Authentication
 *
 * A bearer token compared in constant time. Vercel sends `CRON_SECRET`
 * automatically on scheduled invocations; without the guard this endpoint would
 * let anyone on the internet cancel orders that are mid-payment.
 */

import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/src/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How long a visitor gets to finish paying.
 *
 * Must stay at or above `PAYMENT_WINDOW_MINUTES` in
 * `src/app/api/checkout/intent/route.ts`, or the sweeper cancels orders the
 * payment step still considers payable and somebody pays for a cancelled order.
 */
const GRACE_MINUTES = 30;

/**
 * Constant-time comparison.
 *
 * `===` on secrets leaks their length and their matching prefix through timing.
 * The length check first is deliberate — `timingSafeEqual` throws on mismatched
 * lengths — and leaks only the length, which is not the secret.
 */
function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    // Fail closed. An unguarded sweeper is a public "cancel orders" button.
    console.error("[cron] CRON_SECRET is not set; sweep refused.");
    return NextResponse.json({ error: "unconfigured" }, { status: 500 });
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!tokenMatches(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("expire_unpaid_orders", {
    older_than_minutes: GRACE_MINUTES,
  });

  if (error) {
    console.error(`[cron] expire_unpaid_orders failed: ${error.message}`);
    return NextResponse.json({ error: "server" }, { status: 503 });
  }

  const cancelled = Array.isArray(data) ? data.length : 0;

  // The numbers are logged, not the customers. A cancellation is worth an audit
  // trail; who it belonged to is not this job's business.
  if (cancelled > 0) {
    console.info(`[cron] Swept ${cancelled} unpaid order(s): ${(data as string[]).join(", ")}`);
  }

  return NextResponse.json({ cancelled });
}
