"use server";

/**
 * What the account menu may show this visitor.
 *
 * One question, asked about the caller and nobody else: is the session holding
 * this request an administrator? It exists so `<AccountMenu>` can offer the
 * dashboard link to the handful of people who have a dashboard, without the
 * header learning anything about the session at render time.
 *
 * ## Why an action rather than a route handler or a prop
 *
 * **Not a prop.** The menu renders in the header of every route. Passing the
 * answer down would mean reading `currentUser()` in `[locale]/layout.tsx`, and
 * that layout's own comment records the cost: auth state read across that
 * subtree turns all thirty routes dynamic, an invocation per view on pages with
 * no session data on them. A link in a dropdown is not worth the site's static
 * rendering.
 *
 * **Not `app/api/…`.** `src/proxy.ts` excludes `api` from its matcher, so
 * `clerkMiddleware()` never runs for those paths and `currentUser()` cannot be
 * called there at all. A Server Action posts to the current route, which the
 * matcher does cover — the same reason every action under `src/actions/admin/`
 * can call `requireAdmin()`.
 *
 * ## What this is not
 *
 * **Not a boundary.** It decides whether a menu item is drawn, and nothing
 * else. `/admin` is guarded by `requireAdmin()` in `app/[locale]/admin/layout.tsx`
 * and again at the top of every action under `src/actions/admin/`; a customer
 * who forges a `true` out of this in their own browser gets a link that leads to
 * a 404. Authorization is decided where the data is, never in a dropdown.
 *
 * It takes no arguments — a Server Action is a public HTTP endpoint, and one
 * that accepted a user id would be answering questions about other people. The
 * identity comes from the session and from nowhere else, and the reply is a
 * bare boolean: never the actor's address, never the allowlist.
 */

import { getAdminActor } from "@/src/lib/admin/auth";

/**
 * Whether the caller is an administrator.
 *
 * `getAdminActor()` is the existing rule — a session, a *verified* primary
 * address, and that address on the allowlist — reused rather than restated, so
 * the menu and the dashboard cannot come to different conclusions about who is
 * an admin.
 */
export async function viewerIsAdmin(): Promise<boolean> {
  return (await getAdminActor()) !== null;
}
