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
 * How long a **read** may take before it is abandoned.
 *
 * ## Why this exists
 *
 * Supabase's REST endpoint occasionally accepts a request and then never
 * answers — not slowly, but never. Measured on this project against a trivial
 * `select slug from "Collection" limit 1`: the same query over a direct SQL
 * connection returned in 194–249ms eight times out of eight, while the REST path
 * stalled indefinitely on roughly one request in five. It is not a query, a
 * policy, or a table: it is the HTTP path in front of them.
 *
 * Without a bound, one such stall does not slow a page down — it stops it
 * existing. The render never resolves, `loading.tsx` stays on screen, and
 * because these routes are cached the stalled render can be the one every later
 * visitor is waiting behind. That is the "infinite loading" this constant exists
 * to end.
 *
 * Ten seconds is far beyond any healthy query here (the slowest measured is
 * about a second) and well short of a visitor's patience. When it fires,
 * supabase-js reports a normal `error`, which every function in `src/services/`
 * already turns into `[]` or `null` — so a stalled read degrades a page to the
 * empty state it was always written to handle, exactly as this module's header
 * promises for a missing key. The failure becomes the one the code was designed
 * for instead of one nothing anticipated.
 */
const READ_TIMEOUT_MS = 10_000;

/**
 * `fetch` with a deadline, for the read client only.
 *
 * A caller's own `signal` is honoured alongside the deadline — `AbortSignal.any`
 * aborts on whichever fires first — so this adds a limit without taking one
 * away.
 *
 * ## Not during `next build`
 *
 * Degrading to an empty state is the right answer for **one visitor's request**
 * and the wrong one for a prerender: a page built from a stalled read would bake
 * an empty grid into static HTML and serve it to everybody for the length of its
 * revalidate window. Next already handles a hung build page correctly — it times
 * it out and retries it up to three times — so during the build the deadline is
 * removed and that retry is allowed to do its job.
 *
 * ⚠ Deliberately **not** applied to the privileged client at all. That one
 * places orders, redeems credits and issues grants; aborting a write
 * client-side while the transaction commits server-side would leave the caller
 * believing an order failed that in fact exists. A write that is slow must be
 * waited for.
 */
function timeoutFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return fetch(input, init);
  }

  const deadline = AbortSignal.timeout(READ_TIMEOUT_MS);

  return fetch(input, {
    ...init,
    signal: init?.signal
      ? AbortSignal.any([init.signal, deadline])
      : deadline,
  });
}

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
    // The deadline is attached here, at the one place every storefront read
    // passes through, rather than at each of the forty-odd call sites — a bound
    // a service can forget to apply is a bound that will be forgotten.
    { ...CLIENT_OPTIONS, global: { fetch: timeoutFetch } },
  );

  return publicClient;
}

/**
 * The privileged client, or `null` when unconfigured.
 *
 * ⚠ Bypasses row level security. Reach for {@link getSupabasePublic} unless the
 * caller genuinely needs to write, or to read something no policy publishes.
 *
 * ## Who holds it, and what authorises each one
 *
 * Seven modules, and the list is deliberately short enough to audit. Every one
 * establishes authority *before* the client is used — none of them infers it
 * from having been reached:
 *
 *   `actions/admin/*` (21 modules, via `./shared`)
 *        `requireAdmin()` as the first statement of every exported action.
 *   `actions/checkout.ts`
 *        Rate limit, then Zod, then identity from `getUserId()` — never from
 *        the request body. Calls `place_order()`, which is revoked from the
 *        public roles.
 *   `app/api/webhooks/stripe/route.ts`
 *        Stripe signature verified against the raw body first.
 *   `services/discounts.ts`, `services/offers.ts`, `services/rewards.ts`
 *        Reached only through rate-limited actions that pass a session-derived
 *        `clerkUserId`; the SQL re-checks ownership under a row lock.
 *   `services/welcome.ts`
 *        Reached only from the signature-verified Clerk webhook.
 *
 * ⚠ Adding an eighth is a security decision, not a convenience one. If a read
 * can go through {@link getSupabasePublic}, it should — that is what keeps the
 * policies in `supabase/sql/` load-bearing rather than decorative.
 *
 * (This list previously named `src/actions/comments.ts` as the only caller,
 * which stopped being true some time ago. Corrected by the pre-launch audit,
 * finding F9 — see `src/docs/SECURITY-AUDIT-STAGE-1.md` §3.4.)
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
