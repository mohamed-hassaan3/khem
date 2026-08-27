import "server-only";

/**
 * One customer's own notifications, and their marketing preference.
 *
 * Split from `src/services/admin/notifications.ts` for the reason
 * `src/services/credits.ts` is split from its admin twin: that file sits behind
 * `requireAdmin()` and reads the whole house, this one is reached by the person
 * whose notifications they are.
 *
 * **The owner must arrive from `getViewer()` on the server** — never a route
 * param, a search param, or a form field. `0032` grants the public roles nothing
 * and has no RLS policy, so that argument *is* the access control, and it is
 * passed into the SQL function rather than applied by the caller afterwards: a
 * filter inside the query cannot be forgotten by a future reader of this file.
 */

import { cache } from "react";

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  parseList,
  toCustomerNotification,
} from "@/src/schemas/db/customer-notifications";
import { CUSTOMER_NOTIFICATION_LIMIT } from "@/src/schemas/preferences";
import type { CustomerNotification } from "@/src/types/notification";

/** Who is asking. Both halves come from the Clerk session, or from nowhere. */
export interface NotificationOwner {
  clerkUserId: string;
  /** A voucher grant may predate the account, and is keyed by address. */
  email: string | null;
}

/**
 * The read itself, memoised per request.
 *
 * `cache()` keys on the *arguments*, so these are two primitives rather than the
 * owner object the exported functions take: an object literal is a new identity
 * on every call and would miss the cache every time.
 *
 * This matters because two callers want the same rows in one render — the
 * account layout, for the rail's unread numeral, and the notifications panel
 * beneath it, for the list. Without the memo, opening that panel would run the
 * feed twice for one page.
 */
const readFeed = cache(
  async (
    clerkUserId: string,
    email: string | null,
  ): Promise<CustomerNotification[]> => {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];

    const { data, error } = await supabase.rpc("customer_notification_feed", {
      owner: clerkUserId,
      owner_email: email,
      max_items: CUSTOMER_NOTIFICATION_LIMIT,
    });

    if (error) {
      console.error(`[notifications] feed failed: ${error.message}`);
      return [];
    }

    return parseList(data, toCustomerNotification);
  },
);

export async function notificationsForUser(
  owner: NotificationOwner,
): Promise<CustomerNotification[]> {
  return readFeed(owner.clerkUserId, owner.email ?? null);
}

/** How many of them are new. Used for the quiet numeral on the account rail. */
export async function unreadNotificationCount(
  owner: NotificationOwner,
): Promise<number> {
  const items = await readFeed(owner.clerkUserId, owner.email ?? null);
  return items.filter((item) => !item.isRead).length;
}

/**
 * Whether this customer has agreed to marketing.
 *
 * Read from `"User"` rather than from Clerk's metadata, even though Clerk holds
 * the choice: this is a server render, the mirror is already in Postgres beside
 * everything else the page reads, and asking an identity API for one boolean per
 * page load is a network round trip to learn something we already store.
 *
 * The two cannot drift, because the only writer — `src/actions/preferences.ts` —
 * moves both in the same request, and the Clerk webhook reconciles anything
 * changed elsewhere.
 *
 * Defaults to `false` when the row cannot be read. Failing closed is the correct
 * direction for consent: showing somebody as subscribed when we do not know is
 * how a house ends up mailing people who never agreed.
 */
export async function marketingOptInForUser(
  clerkUserId: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("User")
    .select("marketingOptIn")
    .eq("clerkId", clerkUserId)
    .is("deletedAt", null)
    .maybeSingle();

  if (error) {
    console.error(`[notifications] marketingOptInForUser failed: ${error.message}`);
    return false;
  }

  return data?.marketingOptIn === true;
}
