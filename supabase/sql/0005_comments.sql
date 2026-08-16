-- KHEM — product comments (visitor reflections on the PDP), for Postgres/Supabase.
--
-- Applied by `npm run db:migrate`, last in the sequence because it now carries
-- a foreign key onto the catalog created in `0001_catalog.sql`.
--
-- `src/services/comments.ts` reads this table and `src/actions/comments.ts`
-- writes it. Until it exists, `<ProductComments>` renders nothing at all.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Identity is Clerk's, not Supabase Auth's, so `auth.uid()` is always null here
-- and RLS cannot express "this row is mine". The access model is therefore
-- split by transport rather than by policy:
--
--   reads  — anyone, through the Data API, of published rows only.
--   writes — only `src/actions/comments.ts`, on the server, holding
--            SUPABASE_SECRET_KEY. That key bypasses RLS, which is exactly why
--            it must never reach a NEXT_PUBLIC_ variable or a Client Component.
--
-- Consequently there is deliberately **no** insert/update/delete policy for
-- `anon` or `authenticated`: a browser holding the publishable key can read
-- comments and cannot write one. Author identity is stamped server-side from
-- the Clerk session, so it is not a field a client can forge.

create table if not exists public.product_comment (
  id uuid primary key default gen_random_uuid(),

  -- The catalog now lives in Postgres, so this is a real foreign key rather
  -- than a slug the Server Action has to vouch for. It still validates the slug
  -- against `getProductBySlug()` first — that check is what returns a clean
  -- error to the visitor instead of a constraint violation — but the database
  -- is now the thing that makes an orphan impossible.
  product_slug text not null
    references public."Product"(slug) on delete cascade on update cascade,

  -- Null for a guest. Never selected into a client payload — it is here for
  -- moderation and for the ownership checks an edit/delete feature would need.
  author_clerk_id text,

  -- Snapshot of the Clerk display name at post time, so rendering a page never
  -- fans out to the Clerk Backend API. Null for a guest; the UI substitutes the
  -- translated "Guest" label, which is why the word itself is not stored.
  author_name text,

  -- Bound mirrored by COMMENT_MAX_LENGTH in `src/schemas/comments.ts`. Both
  -- exist on purpose: Zod is the boundary the app enforces, this is the one the
  -- database enforces regardless of which client wrote the row.
  body text not null check (char_length(body) between 2 and 1200),

  -- Moderation switch. Hiding a comment is an update to false, never a delete,
  -- so a removal is reversible and auditable.
  is_published boolean not null default true,

  created_at timestamptz not null default now()
);

-- Exactly the query `getCommentsForProduct()` runs: one slug, newest first,
-- published only. Partial, because unpublished rows are never listed.
create index if not exists product_comment_slug_created_idx
  on public.product_comment (product_slug, created_at desc)
  where is_published;

alter table public.product_comment enable row level security;

-- Public read of published rows. `to anon, authenticated` rather than the
-- deprecated `auth.role()` check, which anonymous sign-ins would defeat.
drop policy if exists "product_comment_public_read" on public.product_comment;
create policy "product_comment_public_read"
  on public.product_comment for select
  to anon, authenticated
  using (is_published);

-- RLS decides which rows are visible; this decides whether the table is
-- reachable through the Data API at all. Separate concerns, both required.
-- Note there is no `grant insert/update/delete` — see the trust model above.
grant select on public.product_comment to anon, authenticated;
