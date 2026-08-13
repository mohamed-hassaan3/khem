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
 * NEXT STEP — roles.
 *
 * AGENTS.md §9 defines a `Role` enum and §10 an `/admin` matcher that reads
 * `sessionClaims.metadata.role`. Neither is wired here: `/admin` does not
 * exist yet and there is no `User` table to hold the role, so a check written
 * today would be a check nothing could fail. When it lands:
 *
 *   1. Set `publicMetadata.role` on the Clerk user (dashboard or Backend API).
 *   2. Add it to the session token via Clerk's JWT customization, so the
 *      middleware can read it without a network call.
 *   3. Declare the claim shape in a `types/globals.d.ts` `CustomJwtSessionClaims`
 *      so `sessionClaims.metadata.role` is typed rather than `any`.
 *   4. Gate `/admin(.*)` in `src/proxy.ts` beside the existing account matcher.
 *
 * The role is never read from the database for authorization — a compromised
 * row must not be able to grant `ADMIN`. The database column, when it exists,
 * is a mirror for querying, not the source of truth.
 */
