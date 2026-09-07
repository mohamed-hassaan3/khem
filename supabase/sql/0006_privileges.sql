-- KHEM — take back the write privileges Supabase hands out by default.
--
-- Applied **sixth of sixty-four**, not last: `scripts/db-migrate.ts` sorts by
-- filename. That matters for reading this file correctly, and it is fine —
-- but for a reason worth stating rather than assuming.
--
-- The blanket `revoke` below only reaches tables that exist when it runs, i.e.
-- those from `0001`–`0005`. Every table created afterwards — the orders,
-- customers, credits, discounts, campaigns and finance schemas, some
-- fifty-seven of them — is covered instead by the `alter default privileges`
-- clauses at the bottom, which apply to tables created *later* by the same
-- role. The audit in `src/docs/SECURITY-AUDIT-STAGE-1.md` §3.2 confirmed the
-- outcome against the live catalog: all 71 tables have RLS on, and not one
-- holds a write grant for `anon` or `authenticated`.
--
-- ⚠ So do not "fix" a later table by adding it to the `revoke` at line 27 —
-- that statement has already run by then. A table needing narrower access than
-- the default `select` revokes it in its own migration, as `0015`, `0024`,
-- `0025` and `0026` do.
--
-- ## The problem this fixes
--
-- A stock Supabase project ships with
--
--     alter default privileges in schema public grant all on tables to anon, authenticated;
--
-- so *every* table created in `public` — including all of ours — arrives with
-- INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER already granted to
-- the two roles the browser can authenticate as.
--
-- Row level security still refuses those writes: a table with RLS enabled and
-- no permissive policy for a command denies it, and `0001`–`0005` deliberately
-- create select policies and nothing else. So this is not an open door today.
-- It is the hinge the door hangs on. One `for insert … with check (true)`
-- policy added later — by a migration, by the dashboard, by a well-meaning
-- "let visitors submit reviews" change — and the grant that was already there
-- turns into a writable table. Removing the grant means such a policy would
-- still write nothing until somebody also, explicitly, grants the privilege.
--
-- Defence in depth, and `scripts/db-verify.ts` asserts it: the check named
-- "the public roles hold no write grant" fails if anything regresses.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on all tables in schema public to anon, authenticated;

-- And for tables created after this file runs — the default that produced the
-- problem, narrowed. Default privileges are recorded per creating role, and
-- migrations run as `postgres`, which is the role that matters here.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  grant select on tables to anon, authenticated;

alter default privileges in schema public
  revoke all on sequences from anon, authenticated;

-- `service_role` keeps everything: it is the key `src/actions/comments.ts` and
-- the `scripts/db-*` tooling hold, it bypasses RLS by design, and it never
-- reaches the browser.
