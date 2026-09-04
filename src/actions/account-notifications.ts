"use server";

/**
 * What the header bell is allowed to ask.
 *
 * ## Why an action rather than a server prop
 *
 * The bell lives in `<Nav>`, which renders in the layout of every route.
 * Reading the session where it renders would turn all thirty routes dynamic —
 * the cost `src/actions/account.ts` documents at length for exactly the same
 * reason, and the reason `viewerIsAdmin()` exists in that shape. So the bell
 * asks: once on mount for the numeral, and again for the list the first time
 * somebody opens the panel. A visitor who never signs in triggers neither.
 *
 * ## Neither takes an argument
 *
 * A Server Action is a public HTTP endpoint, and one that accepted a user id or
 * an address would be answering questions about other people. Both halves of
 * the owner — the Clerk id and the verified primary address — come from
 * `getViewer()` and from nowhere else, exactly as the notifications panel takes
 * them. A grant issued to an address before the account existed is why the
 * second half is carried at all.
 *
 * Signed out is `0` and `[]`, never an error: the bell is not rendered for a
 * guest, and an action that threw for one would turn a race during sign-out
 * into a console full of failures.
 */

import { getViewer } from "@/src/lib/auth";
import {
  notificationsForUser,
  unreadNotificationCount,
} from "@/src/services/notifications";
import type { CustomerNotification } from "@/src/types/notification";

/** How many are new. The numeral on the bell, and nothing else. */
export async function customerUnreadCount(): Promise<number> {
  const viewer = await getViewer();
  if (viewer === null) return 0;

  return unreadNotificationCount({
    clerkUserId: viewer.id,
    email: viewer.primaryEmail,
  });
}

/** The feed itself, read when the panel is first opened. */
export async function customerNotifications(): Promise<
  readonly CustomerNotification[]
> {
  const viewer = await getViewer();
  if (viewer === null) return [];

  return notificationsForUser({
    clerkUserId: viewer.id,
    email: viewer.primaryEmail,
  });
}
