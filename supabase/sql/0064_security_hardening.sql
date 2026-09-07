-- KHEM — pre-launch security hardening.
--
-- Three unrelated tidyings from the Stage 1 audit
-- (`src/docs/SECURITY-AUDIT-STAGE-1.md`, findings F4, F10, F11). None of them
-- closes a hole that is open today; all three close a way one could be opened
-- later without anybody noticing.
--
-- ⚠ Nothing in this file changes what any current query returns. That is the
-- point, and it is what makes it safe to apply — see the reasoning under each
-- heading.


-- ── F4 — three views bypass row level security ──────────────
--
-- A Postgres view runs with its *creator's* privileges unless it is declared
-- `security_invoker`, which means RLS on the tables underneath is not applied
-- to the person querying the view. Four of this schema's seven views already
-- set it; these three were created before the convention and never got it.
--
-- They are not exposed today. `0024_customers.sql:522` and
-- `0026_discovery_credits.sql:606` revoke them from `public`, `anon` and
-- `authenticated`, and the audit confirmed both refusals live — a request with
-- the publishable key is answered `permission denied for view`.
--
-- So why change them at all? Because the grant is currently the *only* thing
-- standing between these three views and every customer's credit balance,
-- email address and points total. A future migration adding
--
--     grant select on public.customer_directory to authenticated;
--
-- for a perfectly reasonable "let a customer see their own profile" feature
-- would expose **every** row to **every** signed-in visitor, and RLS would not
-- stop it, because a definer view never consults RLS. With `security_invoker`
-- on, that same grant exposes only what the caller's own policies allow —
-- which, for these tables, is nothing.
--
-- Safe to apply because every reader of all three goes through the service
-- role, which bypasses RLS either way:
--
--   credit_balances    → src/services/credits.ts:40      (getSupabaseAdmin)
--   reward_balances    → src/services/rewards.ts:58      (getSupabaseAdmin)
--   customer_directory → src/services/admin/customers.ts:74,
--                        src/services/admin/campaigns.ts:41  (getSupabaseAdmin)
--
-- There is no anon or authenticated read path to break.

alter view public.credit_balances    set (security_invoker = on);
alter view public.customer_directory set (security_invoker = on);
alter view public.reward_balances    set (security_invoker = on);


-- ── F10 — five trigger functions kept the default EXECUTE ───
--
-- Postgres grants EXECUTE on every new function to the pseudo-role PUBLIC, and
-- `anon`/`authenticated` inherit from it. Eighty-nine functions in this schema
-- revoke it explicitly; these five were missed.
--
-- **They are not exploitable.** All five `returns trigger`, so PostgREST does
-- not expose them as RPC, and calling one directly raises
--
--     trigger functions can only be called as triggers
--
-- This is therefore consistency, not a fix. It is worth doing anyway: the
-- revoke discipline in this schema is close to total, and an unexplained
-- exception is how a convention stops being one — the next person to add a
-- function copies whichever neighbour they happen to open.

revoke all on function public.category_kind_cascade()          from public, anon, authenticated;
revoke all on function public.collection_kind_from_category()  from public, anon, authenticated;
revoke all on function public.nav_link_depth_guard()           from public, anon, authenticated;
revoke all on function public.product_type_matches_kind()      from public, anon, authenticated;
revoke all on function public.slug_unique_across_namespace()   from public, anon, authenticated;

-- Revoking EXECUTE does **not** stop these firing as triggers. A trigger runs
-- as the table's owner, not as the statement's caller, so the constraint
-- behaviour they enforce (`0045`, `0047`, `0048`, `0052`) is untouched.


-- ── F11 — one function without a pinned search_path ─────────
--
-- `slug_is_reserved()` is the only function in the schema with no
-- `set search_path`. It is `security invoker` and `immutable`, so there is no
-- privilege to escalate — an unpinned invoker function runs as the caller and
-- gains them nothing they did not already have. This is hygiene.
--
-- It matters slightly more than usual because the function is called from two
-- CHECK constraints (`Collection` and `Category`, `0047_reserved_slugs.sql`),
-- and a constraint that resolves its function through a mutable search_path is
-- a constraint whose meaning depends on the session that writes the row.
--
-- Recreated rather than `alter function … set search_path`, because the body
-- must qualify nothing for an empty path to be correct — and it does not
-- reference a single object, only literals.

create or replace function public.slug_is_reserved(v_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select v_slug in (
    -- Merchandising pages — `MERCH_PAGE_FACETS`.
    'best-sellers',
    -- Scent profiles — `SCENT_PROFILE_SLUGS`.
    'oriental', 'floral', 'fresh', 'woody', 'gourmand'
  );
$$;

-- `create or replace` preserves existing grants, and this function is meant to
-- stay callable — the CHECK constraints depend on it. Stated so nobody adds a
-- revoke here by symmetry with the block above.
