-- KHEM — ratings and photographs on product comments.
--
-- Applied by `npm run db:migrate`, after `0005_comments.sql` created the table
-- this file extends.
--
-- ── What changes ────────────────────────────────────────────
--
-- 1. `rating` — a 1–5 star score. A visitor who wants to say only "five stars"
--    should not have to compose a paragraph to do it, so `body` becomes
--    nullable and a row is now valid when it carries a rating, a body, or both.
--    The floor is a table check, not a convention: a row with neither is not a
--    comment, it is an empty insert.
--
-- 2. `product_comment_image` — up to three photographs per comment. Only the
--    object *path* is stored; the public URL is composed in
--    `src/lib/comment-images.ts` so a bucket rename is one edit, not a data
--    migration.
--
-- The `Review` model sketched in AGENTS.md §9 is deliberately **not** created.
-- Like `Wishlist` it was never migrated, and a rating and the sentence beside
-- it are one act by one visitor — splitting them across two tables would mean a
-- join to render a single row.
--
-- ── Trust model: unchanged ──────────────────────────────────
--
-- Identity is still Clerk's, so `auth.uid()` is null here and RLS still cannot
-- express "this row is mine". Reads stay open to `anon`/`authenticated` through
-- the Data API, published rows only; writes stay the exclusive business of
-- `src/actions/comments.ts` holding SUPABASE_SECRET_KEY. There is deliberately
-- no insert/update/delete grant below — including for the image table, and
-- including for the storage bucket, whose objects are written by that same
-- server-side key and never by a browser.

-- ── 1. Rating ───────────────────────────────────────────────

alter table public.product_comment
  add column if not exists rating smallint;

-- Named rather than inline, so re-running this file replaces a known
-- constraint instead of accumulating anonymous ones.
alter table public.product_comment
  drop constraint if exists product_comment_rating_range;

alter table public.product_comment
  add constraint product_comment_rating_range
  check (rating is null or rating between 1 and 5);

-- ── 2. Body becomes optional ────────────────────────────────

alter table public.product_comment
  alter column body drop not null;

-- The original bound arrived as an inline `check` in `0005`, which Postgres
-- named for us. Both names are dropped: the generated one on a database that
-- has only ever seen `0005`, ours on a re-run of this file.
alter table public.product_comment
  drop constraint if exists product_comment_body_check;

alter table public.product_comment
  drop constraint if exists product_comment_body_length;

-- Bound mirrored by COMMENT_MAX_LENGTH in `src/schemas/comments.ts`.
alter table public.product_comment
  add constraint product_comment_body_length
  check (body is null or char_length(body) between 2 and 1200);

alter table public.product_comment
  drop constraint if exists product_comment_has_content;

alter table public.product_comment
  add constraint product_comment_has_content
  check (rating is not null or body is not null);

-- Exactly the rows `getProductRatingSummary()` aggregates: one slug, published,
-- scored. Partial, because an unscored comment is never counted.
create index if not exists product_comment_slug_rating_idx
  on public.product_comment (product_slug, rating)
  where is_published and rating is not null;

-- ── 3. Photographs ──────────────────────────────────────────

create table if not exists public.product_comment_image (
  id uuid primary key default gen_random_uuid(),

  -- Cascade: hiding a comment is an update, but deleting one must not leave
  -- orphaned rows pointing at objects nothing will ever render.
  comment_id uuid not null
    references public.product_comment(id) on delete cascade,

  -- Object path inside the `comment-images` bucket, never a full URL. Written
  -- as `<product-slug>/<comment-id>/<index>.<ext>` by the Server Action — every
  -- segment server-generated, so an uploaded filename can never steer it.
  storage_path text not null,

  -- Intrinsic pixel size, so `next/image` can reserve the box before the file
  -- arrives. Nullable: a photograph whose dimensions could not be read is still
  -- worth showing.
  width int,
  height int,

  sort_order int not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists product_comment_image_comment_idx
  on public.product_comment_image (comment_id, sort_order);

alter table public.product_comment_image enable row level security;

-- Visibility is inherited, not duplicated: an image is readable exactly when
-- the comment it belongs to is published. Writing the `is_published` flag onto
-- this table as well would be two truths that can disagree.
drop policy if exists "product_comment_image_public_read" on public.product_comment_image;
create policy "product_comment_image_public_read"
  on public.product_comment_image for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.product_comment as parent
      where parent.id = product_comment_image.comment_id
        and parent.is_published
    )
  );

grant select on public.product_comment_image to anon, authenticated;

-- ── 4. Storage bucket ───────────────────────────────────────
--
-- Public, so reads are served from `/storage/v1/object/public/…` without an RLS
-- policy on `storage.objects` and without a signed URL on a page that is
-- otherwise fully cacheable. Uploads are unaffected by `public`: they still
-- require a key, and the only key that has one is the server's.
--
-- Wrapped in a handler because `storage.buckets` may not be writable by the
-- role running the migration, and a permissions error here must not take the
-- rest of the transaction down with it — every other statement in this file is
-- schema the app cannot start without. The NOTICE tells the operator what to
-- create by hand.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'comment-images',
    'comment-images',
    true,
    5242880, -- 5 MB, mirrored by COMMENT_MAX_IMAGE_BYTES.
    array['image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when insufficient_privilege or undefined_table or undefined_column then
    raise notice
      'Could not create the "comment-images" bucket (%). Create it in the Supabase dashboard: public, 5 MB limit, image/jpeg + image/png + image/webp.',
      sqlerrm;
end;
$$;
