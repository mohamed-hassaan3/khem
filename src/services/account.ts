/**
 * Customer portal query layer.
 *
 * The seam between the account UI and the database, in the same shape as
 * `src/services/products.ts`: every function is already `async`, already
 * returns exactly the projection the UI consumes, and already carries the
 * Supabase query it will become. Migrating means replacing a function body
 * here — never a component, never a page.
 *
 * **Nothing in this file returns fabricated data.** `"Order"` arrived in
 * `supabase/sql/0015_orders.sql` and `"Address"` in `0024_customers.sql`, so
 * both panels now render stored rows; a customer with neither still gets the
 * empty state rather than an invention. The page this replaced shipped three
 * invented orders and two invented Cairo addresses, which is exactly what
 * AGENTS.md's "UI must display stored data only" rule forbids.
 *
 * Every function takes `userId` — the Clerk user id, which is the `clerkId`
 * column of the §9 `User` model. It always arrives from `await auth()` on the
 * server and never from a route param, a search param, or a client prop.
 */

import "server-only";

import { getSupabaseAdmin } from "@/src/lib/supabase";
import { parseList } from "@/src/schemas/db/catalog";
import { savedAddressSchema } from "@/src/schemas/db/customers";
import { customerOrderSchema } from "@/src/schemas/db/orders";
import type {
  AccountSummary,
  OrderEvent,
  OrderStatus,
  OrderSummary,
  SavedAddress,
  Viewer,
} from "@/src/types/account";

/**
 * A customer's orders, newest first.
 *
 * ## Why this reads with the secret key
 *
 * `supabase/sql/0015_orders.sql` grants the public roles nothing on `"Order"`:
 * the row holds a name, an email and a phone number, and identity here is
 * Clerk's, so no RLS policy could express "this order is mine" — `auth.uid()`
 * is always null. The filter *is* the access control, which puts two
 * obligations on this function and nowhere else:
 *
 *  - `userId` must arrive from `await auth()` on the server. Never a route
 *    param, never a search param, never a form field. Every caller today does;
 *    it is the one thing to check when a new one appears.
 *  - The projection must stay narrow. A customer's own order is theirs to see,
 *    but the desk's private `note` is not part of it.
 *
 * Walk-in orders recorded at the boutique carry no `clerkUserId`, so they
 * correctly do not appear in anybody's history.
 */
export async function getOrdersForUser(
  userId: string,
): Promise<readonly OrderSummary[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Order")
    .select(
      "id, orderNumber, placedAt, status, totalInCents, trackingCode, " +
        "items:OrderItem(productName, quantity), " +
        "events:OrderStatusEvent(status, occurredAt)",
    )
    .eq("clerkUserId", userId)
    .order("placedAt", { ascending: false })
    .limit(100);

  if (error) {
    console.error(`[account] getOrdersForUser failed: ${error.message}`);
    return [];
  }

  return parseList(data, (row) => {
    const parsed = customerOrderSchema.safeParse(row);
    if (!parsed.success) return null;

    const { items, events, ...order } = parsed.data;
    return {
      ...order,
      lines: items,
      events: firstVisitPerStatus(events),
    } satisfies OrderSummary;
  });
}

/**
 * The rail, oldest first, one station per status.
 *
 * `"OrderStatusEvent"` is append-only, so a desk that corrects SHIPPED back to
 * PROCESSING and forward again leaves three rows and two of them share a
 * status. The station keeps the **earliest** of the two: that is the date the
 * customer was told the parcel had shipped, and a date that walked backwards
 * on a later correction would be worse than no date at all.
 *
 * Sorted here rather than in the query because PostgREST gives no ordering
 * guarantee for an embedded resource, and a rail that depends on one is a rail
 * that scrambles the day the planner changes its mind.
 */
function firstVisitPerStatus(
  events: readonly OrderEvent[],
): readonly OrderEvent[] {
  const earliest = new Map<OrderStatus, OrderEvent>();

  for (const event of events) {
    const seen = earliest.get(event.status);
    if (!seen || event.occurredAt < seen.occurredAt) earliest.set(event.status, event);
  }

  return [...earliest.values()].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt),
  );
}

/**
 * A customer's saved addresses, default first.
 *
 * Reads with the secret key for the same reason `getOrdersForUser` does, and
 * with the same obligation attached: `supabase/sql/0024_customers.sql` grants
 * the public roles nothing on `"Address"`, so **the `clerkId` filter is the
 * access control**. `userId` must arrive from `await auth()` on the server —
 * never a route param, never a search param, never a form field.
 *
 * The join through `"User"` is what keeps that true. Addresses are keyed by the
 * `"User"` row id, and resolving the session's Clerk id to that row here means
 * no caller ever gets to name the row id itself.
 *
 * A customer whose Clerk webhook has not landed yet simply has no row, and
 * therefore no addresses, which is the honest answer rather than an error.
 */
export async function getAddressesForUser(
  userId: string,
): Promise<readonly SavedAddress[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("Address")
    .select(
      "id, label, recipient, line1, line2, city, state, postalCode, " +
        "country, isDefault, user:User!inner(clerkId, deletedAt)",
    )
    .eq("user.clerkId", userId)
    .is("user.deletedAt", null)
    .order("isDefault", { ascending: false })
    .order("createdAt", { ascending: true });

  if (error) {
    console.error(`[account] getAddressesForUser failed: ${error.message}`);
    return [];
  }

  return parseList(data, (row) => {
    const parsed = savedAddressSchema.safeParse(row);
    return parsed.success ? parsed.data : null;
  });
}

/**
 * Order count and lifetime spend for the overview panel.
 *
 * Derived from the same rows the history list renders rather than from a
 * separate aggregate. That is the opposite of what the dashboard does — there,
 * counting in TypeScript would mean fetching every order in the boutique — but
 * here the set is one person's order history, already capped, and a second
 * definition of "lifetime spend" living in SQL is a second thing that can
 * disagree with the list printed above it.
 *
 * Cancelled and refunded orders are excluded from the spend: a refunded order
 * is not money the house kept, and counting it overstates the customer's
 * standing. They still count as orders placed, because they were.
 */
export async function getAccountSummary(
  userId: string,
): Promise<AccountSummary> {
  const orders = await getOrdersForUser(userId);

  return {
    orderCount: orders.length,
    lifetimeSpendInCents: orders
      .filter((order) => order.status !== "CANCELLED" && order.status !== "REFUNDED")
      .reduce((sum, order) => sum + order.totalInCents, 0),
  };
}


/**
 * The `"User"` row id behind a session, created if the house has not met them.
 *
 * `"Address"."userId"` is a foreign key to `"User"(id)`, and `"User"` rows
 * arrive from `sync_clerk_user()` driven by Clerk's `user.created` webhook. A
 * customer whose webhook was never delivered — or who signed up before the
 * endpoint existed — therefore has a Clerk session and no row, and every
 * address insert for them would fail on the constraint with nothing on screen
 * to explain why.
 *
 * So the write path resolves the row and, finding none, syncs it from the
 * session it already holds. That is the "lazy call from the account layout"
 * the note below has always described, arriving where it is actually needed:
 * at the first write, not on every read.
 *
 * `sync_clerk_user()` is reused rather than a bare insert written here. It owns
 * the rules about when `marketingOptInAt` moves, and a second definition of
 * "create a customer" is a second thing that can disagree with the webhook.
 * **It never writes `role`** — that comes from Clerk and the allowlist, so the
 * database can never be the path by which somebody grants themselves ADMIN.
 *
 * Returns `null` when there is no address on the session, because
 * `sync_clerk_user()` refuses a row without one and the caller must report a
 * failure rather than write an orphan.
 */
export async function ensureUserRowId(viewer: Viewer): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("User")
    .select("id")
    .eq("clerkId", viewer.id)
    .is("deletedAt", null)
    .maybeSingle();

  if (error) {
    console.error(`[account] ensureUserRowId lookup failed: ${error.message}`);
    return null;
  }

  if (typeof data?.id === "string") return data.id;

  if (viewer.primaryEmail === null) {
    console.error(`[account] ensureUserRowId: ${viewer.id} has no address`);
    return null;
  }

  // Clerk holds one `fullName`; `"User"` holds two columns. The first word is
  // the given name and the remainder the family name — the same split the
  // overview's greeting makes, and wrong for some names in the same harmless
  // way, since neither column is ever matched on.
  const parts = viewer.fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  const firstName = parts[0] ?? null;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;

  const { data: created, error: syncError } = await supabase.rpc(
    "sync_clerk_user",
    {
      payload: {
        clerkId: viewer.id,
        email: viewer.primaryEmail,
        firstName,
        lastName,
        phone: null,
        // Not a consent event. Somebody saving an address has not agreed to
        // anything, and `false` is the direction that fails closed.
        marketingOptIn: false,
      },
    },
  );

  if (syncError) {
    console.error(`[account] ensureUserRowId sync failed: ${syncError.message}`);
    return null;
  }

  return typeof created === "string" ? created : null;
}


/*
 * NEXT STEP — `syncUser(userId)`.
 *
 * Not written yet because it would have nothing to write to. It is named here
 * so the webhook and the read path agree on where the write lives: an upsert
 * on `clerkId`, driven by Clerk's `user.created` / `user.updated` webhooks
 * (`src/app/api/webhooks/clerk/route.ts`), with a lazy call from the account
 * layout as the fallback for sessions that predate the webhook:
 *
 * ```ts
 * await supabase
 *   .from("User")
 *   .upsert({ clerkId: userId, email, firstName, lastName }, { onConflict: "clerkId" });
 * ```
 *
 * `role` is deliberately not written by that sync: it is set from the Clerk
 * dashboard or the Backend API and read from the session claim, so the
 * database can never be the path by which someone grants themselves `ADMIN`.
 * See `src/lib/auth.ts`.
 */
