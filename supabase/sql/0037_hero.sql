-- ── 0037 — The landing-page hero ────────────────────────────
--
-- Two tables that between them answer one question: what does somebody see in
-- the first screen of `/`.
--
--   `"HeroSetting"` — one row, always. Which kind of media the hero is made of,
--                     how long a slide holds, and the optional headline,
--                     description and button that sit over it.
--   `"HeroSlide"`   — the images, in order. Zero, one, or as many as the house
--                     is running.
--
-- ## Why the hero was hard-coded until now, and what changes
--
-- `/` opened on a typographic composition — the wordmark, a rule, a tagline —
-- written directly into `src/app/[locale]/page.tsx`. That composition is not
-- being deleted: it stays in the page as the fallback, and it is what renders
-- while these tables are empty. So this migration inserts a settings row with
-- **no media**, which is a complete and correct configuration meaning "the house
-- has not chosen a campaign image yet" rather than a stub.
--
-- ## Images or video, never both at once
--
-- `"mediaType"` is the switch. `IMAGES` reads `"HeroSlide"` and ignores the
-- video columns; `VIDEO` reads `"videoUrl"` and ignores the slides. The rows are
-- kept either way — an editor who switches to video for a fortnight and back
-- does not lose the campaign images they had lined up.
--
-- There is deliberately no video *list*. A hero video is a single held shot; a
-- rotation of them is a different design, and one that would cost a visitor
-- several megabytes above the fold.
--
-- ## No ceiling on the slides
--
-- One image is a static hero — nothing rotates, no timer is armed, no progress
-- indicator is drawn, because there is nowhere to rotate to. Two or more
-- cross-fade on `"slideDurationMs"`. Beyond that the count is the house's
-- business: only the first slide is fetched on load, so the marginal cost of a
-- fifth image is a request that happens four rotations later, if the visitor is
-- still there.
--
-- ## Trust model
--
-- Public marketing chrome, exactly like `"Announcement"` (0035): `select` for
-- `anon` and `authenticated`, every write service-role behind `requireAdmin()`.
-- The predicates that matter here are not row filters — every row is meant to be
-- read — but the **check constraints**, which restate what
-- `src/schemas/content.ts` refuses: an https media URL, an app-path button link,
-- and lengths that keep the composition from breaking.

-- ── Enum ────────────────────────────────────────────────────

do $$ begin
  create type public."HeroMediaType" as enum ('IMAGES', 'VIDEO');
exception when duplicate_object then null; end $$;

-- ── HeroSetting ─────────────────────────────────────────────
--
-- One row, `id = 'default'`, the same singleton shape `"MarketingSetting"` uses
-- and for the same reason: this is a configuration, not a list, and a table that
-- can hold two of them is a table that will one day disagree with itself.
--
-- The three `show*` booleans are separate from the text columns on purpose. An
-- editor who switches the description off for a campaign and back on next month
-- should not have to retype it, and a storefront that decided visibility from
-- "is the column empty" could never tell those two states apart.

create table if not exists public."HeroSetting" (
  id text primary key default 'default' check (id = 'default'),

  "mediaType" public."HeroMediaType" not null default 'IMAGES',

  -- How long one image holds before the next fades in. Bounded rather than
  -- free: under three seconds nobody finishes reading the headline, over
  -- fifteen the second image is never seen.
  "slideDurationMs" int not null default 6000
    check ("slideDurationMs" between 3000 and 15000),

  -- ── Video ──
  --
  -- Nullable because `IMAGES` is the default and a house with no film should
  -- not have to invent a URL. The cross-field rule — `VIDEO` requires a video —
  -- is the constraint below, not a `not null`.
  "videoUrl"       text check ("videoUrl" ~ '^https://'),
  "videoPosterUrl" text check ("videoPosterUrl" ~ '^https://'),
  "videoAlt"       text check (char_length("videoAlt") <= 160),
  "videoAlt_ar"    text check (char_length("videoAlt_ar") <= 160),

  -- ── Content overlay ──
  "showHeadline"    boolean not null default false,
  "showDescription" boolean not null default false,
  "showButton"      boolean not null default false,

  "headline"       text check (char_length("headline") <= 120),
  "headline_ar"    text check (char_length("headline_ar") <= 120),
  "description"    text check (char_length("description") <= 280),
  "description_ar" text check (char_length("description_ar") <= 280),
  "buttonLabel"    text check (char_length("buttonLabel") <= 40),
  "buttonLabel_ar" text check (char_length("buttonLabel_ar") <= 40),

  -- An app path, never an absolute URL — the same rule `"Announcement"."href"`
  -- carries, for the same reason: this value is rendered straight into an
  -- anchor, and a hero button is not the place to introduce an open redirect.
  "buttonHref" text check ("buttonHref" ~ '^/[A-Za-z0-9/_-]*$'),

  "updatedAt" timestamptz not null default now(),

  -- Video selected means a video exists. Nothing else is required of this row:
  -- `IMAGES` with no slides is the unconfigured state, and the page falls back
  -- to its typographic composition rather than rendering an empty band.
  constraint "HeroSetting_video_present"
    check ("mediaType" <> 'VIDEO' or "videoUrl" is not null),

  -- A label with nowhere to go looks like a link and is not one; a destination
  -- with no label is a button nobody can read. Shown together or not at all.
  constraint "HeroSetting_button_complete"
    check (
      not "showButton"
      or ("buttonLabel" is not null and "buttonHref" is not null)
    )
);

-- The row must exist for the storefront to read anything. Its defaults are the
-- "no campaign configured" state described in the header, which is a working
-- configuration and not a placeholder.
insert into public."HeroSetting" (id) values ('default')
on conflict (id) do nothing;

-- ── HeroSlide ───────────────────────────────────────────────
--
-- `sortOrder` is the rotation order, and it is assigned from the editor's list
-- position on every save — so what the dashboard shows top to bottom is what the
-- hero fades through. `createdAt` breaks a tie between two rows an editor has
-- given the same position.
--
-- `alt` is `not null`: a hero image is the largest thing on the page, and a
-- photograph without a description is the single most expensive accessibility
-- failure a landing page can have. The Arabic twin is nullable — an untranslated
-- alt falls back to the English one, the rule `src/lib/i18n/resolve.ts` sets out.

create table if not exists public."HeroSlide" (
  id text primary key default gen_random_uuid()::text,

  "imageUrl" text not null check ("imageUrl" ~ '^https://'),
  "alt"      text not null check (char_length(btrim("alt")) between 1 and 160),
  "alt_ar"   text check (char_length("alt_ar") <= 160),

  "sortOrder" int not null default 0,
  "createdAt" timestamptz not null default now()
);

create index if not exists "HeroSlide_order_idx"
  on public."HeroSlide" ("sortOrder", "createdAt");

-- ── Row level security ──────────────────────────────────────
--
-- Read-only for the public roles, and unconditionally so: unlike an
-- announcement there is no window and no active flag to hide a row behind. The
-- hero is either configured or it is not, and both tables say only what the
-- first screen of the home page already shows to everybody.
--
-- Every write is service-role, which bypasses RLS — which is why no
-- insert/update/delete policy exists here and none should be added.

alter table public."HeroSetting" enable row level security;
alter table public."HeroSlide"   enable row level security;

drop policy if exists "Hero settings are readable" on public."HeroSetting";
create policy "Hero settings are readable"
  on public."HeroSetting" for select
  to anon, authenticated
  using (true);

drop policy if exists "Hero slides are readable" on public."HeroSlide";
create policy "Hero slides are readable"
  on public."HeroSlide" for select
  to anon, authenticated
  using (true);

-- ── Privileges ──────────────────────────────────────────────
--
-- Written out rather than left to `0006_privileges.sql`'s default privileges, for
-- the reason 0035 gives: a grant that exists by side effect is a grant nobody
-- reviewing this file can see.

grant select on public."HeroSetting" to anon, authenticated;
grant select on public."HeroSlide"   to anon, authenticated;

-- ── Tell PostgREST the schema moved ─────────────────────────
--
-- Same reason as 0035: without this the first request for either relation blocks
-- while the schema cache reloads, and the home page is not a page that may wait
-- tens of seconds for its hero.
notify pgrst, 'reload schema';
