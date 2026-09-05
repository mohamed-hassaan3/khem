/**
 * Put back what nobody paid for.
 *
 * The other half of reserving stock before payment. `src/actions/checkout.ts`
 * creates a card order as PROCESSING with its bottles already off the shelf,
 * because an order and its stock movement are one event and checkout gets no
 * exception from that. The price of that choice is abandoned baskets holding
 * inventory, and this is what pays it: anything still PROCESSING, UNPAID and CARD
 * after thirty minutes is cancelled and restocked.
 *
 * ## The schedule, and why it is only a backstop
 *
 * `vercel.json` runs this **once a day**, because the Hobby plan permits no
 * more than that — a quarter-hourly expression makes Vercel refuse the entire
 * deployment, which is exactly what kept the first version of this feature out
 * of production.
 *
 * Once a day is too slow to be the only sweep, so it is not the only sweep:
 * `sweepStaleHolds()` in `src/actions/checkout.ts` runs the same function
 * before every order, which is both more timely and better targeted. This route
 * exists for the day on which nobody orders anything — the one case the
 * opportunistic sweep cannot cover.
 *
 * On Pro, tighten the schedule to `0,15,30,45 * * * *`; nothing else has to
 * change. (Written the long way rather than with a step: the shorthand for it
 * contains the two characters that end a block comment, and this one is a block
 * comment.)
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

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { revalidateProductsBySlug } from "@/src/actions/admin/shared";
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

/**
 * Re-render the surfaces that print a sold-out badge for the bottles this sweep
 * put back on the shelf.
 *
 * The stock moved and nothing else announced it. `src/actions/checkout.ts`
 * revalidates the lines of the order it just placed; this is the other
 * direction — a cancellation restocking lines nobody is looking at — and
 * without it a card can say sold out for a full ISR window after the bottle is
 * available again. That window used to be five minutes, which is why this was
 * survivable; it is a day now (see `prompts/vercel-usage-reduction.md`), which
 * is why it is not.
 *
 * Two reads rather than an embedded select: the join column is `"orderId"` and
 * naming a PostgREST relationship here would couple this job to a resource name
 * that no migration in `supabase/sql/` guarantees.
 *
 * Failure is logged and swallowed. The sweep already succeeded — the stock is
 * back — and a revalidation that could not run is a stale badge, not a lost
 * write.
 */
async function revalidateRestocked(
  supabase: SupabaseClient,
  orderNumbers: readonly string[],
): Promise<void> {
  const orders = await supabase
    .from("Order")
    .select("id")
    .in("orderNumber", [...orderNumbers]);

  if (orders.error) {
    console.error(`[cron] Could not read swept orders: ${orders.error.message}`);
    return;
  }

  const ids = (orders.data ?? [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string");

  if (ids.length === 0) return;

  const items = await supabase
    .from("OrderItem")
    .select("productSlug")
    .in("orderId", ids);

  if (items.error) {
    console.error(`[cron] Could not read swept lines: ${items.error.message}`);
    return;
  }

  const slugs = (items.data ?? [])
    .map((row) => row.productSlug)
    .filter((slug): slug is string => typeof slug === "string");

  if (slugs.length === 0) return;

  await revalidateProductsBySlug([...new Set(slugs)]);
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

  const numbers = Array.isArray(data)
    ? (data as unknown[]).filter((row): row is string => typeof row === "string")
    : [];
  const cancelled = numbers.length;

  // The numbers are logged, not the customers. A cancellation is worth an audit
  // trail; who it belonged to is not this job's business.
  if (cancelled > 0) {
    console.info(`[cron] Swept ${cancelled} unpaid order(s): ${numbers.join(", ")}`);

    await revalidateRestocked(supabase, numbers);
  }

  return NextResponse.json({ cancelled });
}
