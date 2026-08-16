/**
 * Supabase access, server side only.
 *
 * Two clients, deliberately, because they carry different authority:
 *
 *   {@link getSupabasePublic}  — publishable key. **RLS applies.** Every read
 *                                path in `src/services/` uses this one.
 *   {@link getSupabaseAdmin}   — secret key. **RLS is bypassed.** The comment
 *                                write action, the admin dashboard, and the
 *                                `scripts/db-*` tooling. Nothing else.
 *
 * Why reads go through the weaker key: the tables in `supabase/sql/` publish
 * only what is meant to be public — non-archived products, published stockists,
 * published comments — and reading through a key that ignores those policies
 * would mean a policy mistake never surfaces. Reading through the publishable
 * key makes RLS the thing that actually protects the data rather than a second
 * copy of the `where` clause, and `scripts/db-verify.ts` proves both halves.
 *
 * ⚠ `SUPABASE_SECRET_KEY` must never be renamed into a `NEXT_PUBLIC_` variable
 * — anything prefixed that way is compiled into the browser bundle. The
 * `server-only` import below is the compile-time guard: a Client Component that
 * reaches this module fails the build instead of shipping either key.
 *
 * Identity here is Clerk's, so `auth.uid()` is always null in Postgres and no
 * RLS policy can express "this comment is mine". `supabase/sql/0005_comments.sql`
 * therefore grants the public roles `select` and nothing else, and every write
 * goes through a Server Action that stamps the author from the session. See
 * that file's trust model comment.
 *
 * NOTE ON NODE: `createClient()` builds its Realtime half eagerly and needs a
 * global `WebSocket`, which Node only has from 22 onward — hence
 * `engines.node: "24.x"` in `package.json` and the `.nvmrc` beside it. On an
 * older runtime this module throws at construction and takes every page that
 * reads the catalog with it, rather than failing in some quiet corner.
 */

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * There is no end-user session on either client — both act as the service,
 * never as a person. Persisting or refreshing one would be meaningless on the
 * server and, in a warm shared instance, would be a leak between requests.
 */
const CLIENT_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

/**
 * Whether the database is reachable for reads at all.
 *
 * Callers use this to disappear rather than to fail: an unconfigured checkout
 * of the repository builds and renders empty states instead of throwing. That
 * keeps preview deploys and `npm run build` green without credentials, the same
 * bargain `getEmailClient()` strikes for Resend.
 */
export function isSupabaseConfigured(): boolean {
  return (
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").length > 0 &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").length > 0
  );
}

/** Whether the privileged client can be built — writes, not reads. */
export function isSupabaseAdminConfigured(): boolean {
  return (
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").length > 0 &&
    (process.env.SUPABASE_SECRET_KEY ?? "").length > 0
  );
}

/** Memoised across invocations in a warm serverless instance. */
let publicClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

/**
 * The read client, or `null` when unconfigured.
 *
 * Sees exactly what an anonymous visitor's browser would see, which is the
 * point: the policies in `supabase/sql/` are the access control, and this
 * client is subject to them.
 *
 * Returns rather than throws: a missing key is a deployment state, not a bug
 * the visitor should see as a 500.
 */
export function getSupabasePublic(): SupabaseClient | null {
  if (publicClient) return publicClient;
  if (!isSupabaseConfigured()) return null;

  publicClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
    CLIENT_OPTIONS,
  );

  return publicClient;
}

/**
 * The privileged client, or `null` when unconfigured.
 *
 * ⚠ Bypasses row level security. Reach for {@link getSupabasePublic} unless the
 * caller is writing — today that is `src/actions/comments.ts` alone.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (adminClient) return adminClient;
  if (!isSupabaseAdminConfigured()) return null;

  adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SECRET_KEY as string,
    CLIENT_OPTIONS,
  );

  return adminClient;
}
