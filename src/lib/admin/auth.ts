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
 * happens on the server against `currentUser()` — never against a cookie, a
 * header, a route param, or anything the browser sent. What it buys is that the
 * boundary is legible in the repository and cannot drift out of step with a
 * dashboard setting nobody remembers configuring.
 *
 * Adding a second admin is a comma in `ADMIN_EMAILS`. Adding a *role* — an
 * editor who may write journal entries but not prices — is the point at which
 * the metadata route earns its complexity, and this module is where it lands.
 */

import "server-only";

import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

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
export async function getAdminActor(): Promise<AdminActor | null> {
  const user = await currentUser();
  if (user === null) return null;

  const primary = user.primaryEmailAddress;
  if (!primary) return null;
  if (primary.verification?.status !== "verified") return null;
  if (!isAdminEmail(primary.emailAddress)) return null;

  return {
    id: user.id,
    email: primary.emailAddress,
    fullName: user.fullName ?? null,
  };
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
 * Called at the top of `admin/layout.tsx` **and** as the first statement of
 * every admin Server Action. A Server Action is a public HTTP endpoint; it does
 * not inherit the protection of the page that rendered its form.
 */
export async function requireAdmin(): Promise<AdminActor> {
  const actor = await getAdminActor();
  if (actor === null) notFound();
  return actor;
}
