/**
 * Who may write to the catalog.
 *
 * One module owns the question, exactly as `src/lib/auth.ts` owns "who is
 * this?". Nothing else compares an email against the allowlist, and no admin
 * page or action derives authority from having been rendered.
 *
 * ## Why an email allowlist rather than a role claim
 *
 * `src/lib/auth.ts` sketched a `publicMetadata.role` route, and that remains
 * the right answer for a *team*. It is the wrong answer for the first admin:
 * the role has to be set in the Clerk dashboard and then surfaced through a JWT
 * claims customization before the check can ever pass, so a fresh Clerk
 * instance — a new environment, a restored project, a second developer's keys —
 * locks the house out of its own dashboard with a 404 and no way in short of a
 * code change.
 *
 * The address is not a weaker fact. Clerk has already verified ownership of it,
 * this module refuses to accept one that is *unverified*, and the comparison
 * happens on the server against Clerk's user record — never against a cookie, a
 * header, a route param, or anything the browser sent. What it buys is that the
 * boundary is legible in the repository and cannot drift out of step with a
 * dashboard setting nobody remembers configuring.
 *
 * Adding a second admin is a comma in `ADMIN_EMAILS`. Adding a *role* — an
 * editor who may write journal entries but not prices — is the point at which
 * the metadata route earns its complexity, and this module is where it lands.
 */

import "server-only";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { cache } from "react";

/**
 * The house account, used when `ADMIN_EMAILS` is unset.
 *
 * Hard-coded on purpose: an empty environment variable must not silently mean
 * "no admins" (locking the owner out) or "everyone" (far worse).
 */
const DEFAULT_ADMIN_EMAILS = ["khem.official@outlook.com"] as const;

/** The signed-in administrator, as the shell renders them. */
export interface AdminActor {
  /** Clerk user id. Written to the action logs, never to a row. */
  id: string;
  /** Verified primary email — the value that granted access. */
  email: string;
  fullName: string | null;
}

/**
 * The allowlist, lowercased and de-duplicated.
 *
 * Read on each call rather than memoised at module load: in development the
 * variable can change between requests, and the parse is a string split.
 */
function allowedEmails(): readonly string[] {
  const configured = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return configured.length > 0 ? configured : DEFAULT_ADMIN_EMAILS;
}

/**
 * Whether an address is on the allowlist.
 *
 * Says nothing about whether the address has been *verified* — that is
 * {@link getAdminActor}'s job, and the two are kept separate so this half stays
 * a pure function.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (typeof email !== "string" || email.length === 0) return false;
  return allowedEmails().includes(email.trim().toLowerCase());
}

/**
 * The administrator holding this session, or `null`.
 *
 * Three conditions, all required: there is a session, its primary email is
 * verified, and that email is on the allowlist. The verification check is not
 * ceremony — an unverified address is an address somebody *typed*, and treating
 * it as identity would turn the allowlist into a self-service door.
 */
export const getAdminActor = cache(async function getAdminActor(): Promise<AdminActor | null> {
  // The session itself: Clerk verifies the JWT locally, no network. A signed
  // out visitor, a revoked session or a deleted user all stop here.
  const { userId } = await auth();
  if (!userId) return null;

  const user = await lookupUser(userId);
  if (user === null) return null;
  if (user.email === null || !user.emailVerified) return null;
  // Read per call, never cached: the allowlist is the env var, as it always was.
  if (!isAdminEmail(user.email)) return null;

  return { id: user.id, email: user.email, fullName: user.fullName };
});

/**
 * What the gate needs from Clerk's user record — never more is kept.
 *
 * ## Why it is remembered for a minute
 *
 * Every admin page calls the gate (see {@link requireAdmin}), so every click
 * on the desk would otherwise pay a round trip to Clerk's API — measured at
 * 310–1600 ms (prompts/admin-audit-and-performance-stage-7.md, F1). The
 * session is still verified on every call by `auth()` above; only the primary
 * email and its verification state are reused, for at most
 * {@link USER_LOOKUP_TTL_MS}, in this process only. A changed or unverified
 * primary email therefore takes effect within a minute; removing an address
 * from `ADMIN_EMAILS` takes effect at the restart that applies it, as before.
 *
 * Failures are not remembered: a Clerk error throws, as `currentUser()` did.
 */
interface GateUser {
  id: string;
  email: string | null;
  emailVerified: boolean;
  fullName: string | null;
}

const USER_LOOKUP_TTL_MS = 60_000;
/** Bounded: the desk has a handful of users; anything beyond is pruned. */
const USER_LOOKUP_MAX = 200;
const userLookups = new Map<string, { at: number; user: GateUser }>();

async function lookupUser(userId: string): Promise<GateUser | null> {
  const now = Date.now();
  const hit = userLookups.get(userId);
  if (hit && now - hit.at < USER_LOOKUP_TTL_MS) return hit.user;

  const record = await (await clerkClient()).users.getUser(userId);
  const primary = record.primaryEmailAddress;
  const user: GateUser = {
    id: record.id,
    email: primary?.emailAddress ?? null,
    emailVerified: primary?.verification?.status === "verified",
    fullName: record.fullName ?? null,
  };

  if (userLookups.size >= USER_LOOKUP_MAX) {
    for (const [key, entry] of userLookups) {
      if (now - entry.at >= USER_LOOKUP_TTL_MS) userLookups.delete(key);
    }
    if (userLookups.size >= USER_LOOKUP_MAX) userLookups.clear();
  }
  userLookups.set(userId, { at: now, user });

  return user;
}

/**
 * The administrator, or a 404.
 *
 * `notFound()` rather than a redirect, and the same answer for a signed-out
 * visitor, a signed-in customer, and a URL that does not exist: a redirect to
 * sign-in would confirm that `/admin` is a real address worth returning to with
 * better credentials. `src/proxy.ts` still redirects an *anonymous* request
 * early, which is a cost optimisation for the common case and not a boundary.
 *
 * Called at the top of `admin/layout.tsx`, as the first statement of **every
 * admin page**, and as the first statement of every admin Server Action.
 *
 * - A Server Action is a public HTTP endpoint; it does not inherit the
 *   protection of the page that rendered its form.
 * - A page does not inherit the layout's either. Next does not re-run a layout
 *   on client navigation, and a layout does not stop its child segment from
 *   rendering into the RSC payload — so a signed-in customer could request an
 *   admin page's payload directly and the layout's check would never run
 *   (verified: prompts/admin-audit-and-performance-stage-7.md, F1).
 *
 * `cache()`d per request, so the layout and the page share one check.
 */
export async function requireAdmin(): Promise<AdminActor> {
  const actor = await getAdminActor();
  if (actor === null) notFound();
  return actor;
}
