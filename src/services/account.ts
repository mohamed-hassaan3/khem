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

// NOTE: once the `server-only` package is installed, add `import "server-only"`
// here so a stray client import of this module fails at build time instead of
// shipping query logic — and later, credentials — to the browser. The same
// note sits at the top of `src/services/products.ts`.

import type {
  AccountSummary,
  OrderSummary,
  SavedAddress,
} from "@/src/types/account";

/**
 * A customer's orders, newest first.
 *
 * Becomes:
 *
 * ```ts
 * const { data, error } = await supabase
 *   .from("Order")
 *   .select(
 *     `id, orderNumber, createdAt, status, totalInCents, trackingCode,
 *      items:OrderItem ( quantity, product:Product ( name ) )`,
 *   )
 *   .eq("user.clerkId", userId)
 *   .order("createdAt", { ascending: false });
 * ```
 *
 * Two things that are easy to get wrong later, so they are written down now:
 * the filter must be on the *session's* user id and never on a value the
 * client supplied, and RLS on `Order` must key on the Clerk JWT's `sub` claim
 * so a leaked service-role key is the only way to read another customer's
 * history.
 */
export async function getOrdersForUser(
  userId: string,
): Promise<readonly OrderSummary[]> {
  void userId;
  return [];
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
 * Becomes a single aggregate rather than counting a fetched list in JS:
 *
 * ```ts
 * const { data } = await supabase
 *   .rpc("account_summary", { clerk_id: userId });
 * ```
 *
 * Cancelled and refunded orders are excluded from lifetime spend by that
 * function — a refunded order is not money the house kept, and printing it as
 * such would overstate every customer's standing.
 */
export async function getAccountSummary(
  userId: string,
): Promise<AccountSummary> {
  void userId;
  return { orderCount: 0, lifetimeSpendInCents: 0 };
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
