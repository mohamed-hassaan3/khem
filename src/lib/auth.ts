/**
 * Session access for Server Components.
 *
 * One module owns the question "who is this?", so no route re-derives it and
 * no route can be tricked into answering it from user input. Every account
 * page calls `requireViewer()`; nothing else reads `auth()` or `currentUser()`
 * directly.
 *
 * `src/proxy.ts` already redirects an unauthenticated request away from
 * `/account/*` before it reaches a page. The check here is not redundant with
 * that — it is what makes each page's `userId` a value the page *observed*
 * rather than one it assumed, and it is what keeps the page correct if the
 * matcher is ever edited.
 */

import { auth, currentUser } from "@clerk/nextjs/server";

import type { Viewer } from "@/src/types/account";

/**
 * The signed-in Clerk user id.
 *
 * Returns `null` rather than throwing so a caller can render a signed-out
 * branch; the account routes never take that branch, because the proxy has
 * already redirected.
 */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** Uppercase initial for the avatar, from the name or else the email. */
function initialFor(fullName: string | null, email: string | null): string {
  const source = fullName?.trim() || email?.trim() || "";
  return source.charAt(0).toUpperCase() || "K";
}

/**
 * The session's customer, assembled for display.
 *
 * Identity comes from Clerk and from nowhere else — there is no database read
 * here and no route param involved, so no request can render a customer other
 * than the one holding the session.
 *
 * Returns `null` when there is no session. Account pages treat that as
 * unreachable and redirect, which is a second belt beside the proxy's braces.
 */
export async function getViewer(): Promise<Viewer | null> {
  const user = await currentUser();
  if (user === null) return null;

  const fullName = user.fullName ?? null;
  const primaryEmail = user.primaryEmailAddress?.emailAddress ?? null;

  return {
    id: user.id,
    fullName,
    primaryEmail,
    imageUrl: user.imageUrl ?? null,
    initial: initialFor(fullName, primaryEmail),
  };
}

/*
 * ADMIN — see `src/lib/admin/auth.ts`.
 *
 * `/admin` now exists, and authorization for it deliberately does **not** live
 * here. It is an allowlist of verified email addresses, checked server-side in
 * the dashboard layout and again in every admin Server Action. That module's
 * header explains why the `publicMetadata.role` route sketched in AGENTS.md §10
 * was the wrong first step: it cannot pass until a Clerk dashboard setting and
 * a JWT claims customization both exist, so a fresh Clerk instance locks the
 * house out of its own dashboard with no way back in short of a code change.
 *
 * The role route is still the right answer for a *team* — an editor who may
 * write journal entries but not prices. When that day comes:
 *
 *   1. Set `publicMetadata.role` on the Clerk user (dashboard or Backend API).
 *   2. Add it to the session token via Clerk's JWT customization, so it can be
 *      read without a network call.
 *   3. Declare the claim shape in a `types/globals.d.ts` `CustomJwtSessionClaims`
 *      so `sessionClaims.metadata.role` is typed rather than `any`.
 *   4. Extend `src/lib/admin/auth.ts` to accept either signal — the allowlist
 *      stays as the break-glass path for the owner.
 *
 * The role is never read from the database for authorization — a compromised
 * row must not be able to grant `ADMIN`. The database column, when it exists,
 * is a mirror for querying, not the source of truth.
 */
