/**
 * Customer portal query layer.
 *
 * The seam between the account UI and the database, in the same shape as
 * `src/services/products.ts`: every function is already `async`, already
 * returns exactly the projection the UI consumes, and already carries the
 * Supabase query it will become. Migrating means replacing a function body
 * here — never a component, never a page.
 *
 * **Nothing in this file returns fabricated data.** There is no `Order` and no
 * `Address` table yet (AGENTS.md §9 defines both; `prisma/` holds no schema),
 * so orders and addresses are empty and the panels render their empty states.
 * That is the honest rendering of "no store yet" — the page this replaced
 * shipped three invented orders and two invented Cairo addresses, which is
 * exactly what AGENTS.md's "UI must display stored data only" rule forbids.
 *
 * Every function takes `userId` — the Clerk user id, which is the `clerkId`
 * column of the §9 `User` model. It always arrives from `await auth()` on the
 * server and never from a route param, a search param, or a client prop.
 */

import "server-only";

import { getSupabaseAdmin } from "@/src/lib/supabase";
import { parseList } from "@/src/schemas/db/catalog";
import { customerOrderSchema } from "@/src/schemas/db/orders";
import type {
  AccountSummary,
  OrderSummary,
  SavedAddress,
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
        "items:OrderItem(productName, quantity)",
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

    const { items, ...order } = parsed.data;
    return { ...order, lines: items } satisfies OrderSummary;
  });
}

/**
 * A customer's saved addresses, default first.
 *
 * Becomes:
 *
 * ```ts
 * const { data, error } = await supabase
 *   .from("Address")
 *   .select("id, label, recipient, line1, line2, city, state, postalCode, country, isDefault")
 *   .eq("user.clerkId", userId)
 *   .order("isDefault", { ascending: false });
 * ```
 *
 * `Address` in §9 has no `label` or `recipient` column yet — both are added in
 * the same migration, since an address book with neither is unusable.
 */
export async function getAddressesForUser(
  userId: string,
): Promise<readonly SavedAddress[]> {
  void userId;
  return [];
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

/*
 * NEXT STEP — marketing opt-in → the admin dashboard.
 *
 * `/sign-up` writes the "Email me with news and offers" checkbox to the Clerk
 * user's `unsafeMetadata.marketingOptIn` at creation (see
 * `src/components/auth/SignUpForm.tsx`). It is *not* read anywhere yet.
 *
 * When the `User` table lands it becomes a column on that row, written by the
 * same `user.created` / `user.updated` webhook that syncs the rest:
 *
 * ```ts
 * await supabase.from("User").upsert(
 *   { clerkId: userId, email, marketingOptIn: Boolean(unsafeMetadata.marketingOptIn) },
 *   { onConflict: "clerkId" },
 * );
 * ```
 *
 * Two things to carry across, because both are easy to lose between here and
 * there:
 *
 *  - **`unsafeMetadata` is writable by the user it belongs to.** That is
 *    correct for a preference they own, and it means the webhook must treat
 *    the value as untrusted input — coerce it to a boolean, never read
 *    anything else out of that object, and never let it influence a role or a
 *    price.
 *  - **Consent needs a timestamp to be worth anything.** Store
 *    `marketingOptInAt` alongside the flag; a bare boolean cannot answer "when
 *    did they agree?", which is the only question that matters if the opt-in
 *    is ever challenged. The unsubscribe path writes `false` and a new
 *    timestamp rather than deleting the row.
 */

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
