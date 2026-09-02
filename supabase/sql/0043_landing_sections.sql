-- KHEM — the home page, as ordered rows.
-- Applied by `npm run db:migrate`, after `0037_hero.sql` (whose `"HeroSetting"`
-- pattern the media columns below copy). Every statement is idempotent.
--
-- ## What this is
--
-- `/` was a fixed sequence of bands written into `src/app/[locale]/page.tsx`.
-- This table makes that sequence data: which bands appear, in what order, and
-- the few settings a band owns. The *copy* stays where it is — roughly 3,500
-- lines of typed, interpolated, RTL-aware strings in
-- `src/lib/i18n/dictionaries/{en,ar}.ts` — because the `Dictionary` type is what
-- makes a missing Arabic string a build failure rather than an English word
-- leaking into the Arabic tree. Moving it here would trade that guarantee for a
-- textarea, and it is deliberately out of scope.
--
-- ## Why the key is a check constraint and not free text
--
-- A section exists because `SECTION_REGISTRY` in `src/lib/landing-sections.ts`
-- knows how to render it. A row with a key the registry does not know is a band
-- that cannot be drawn; a registry entry with no row is a band nobody can turn
-- off. The constraint below names exactly the keys the registry does, so the two
-- halves are edited together — the same bargain `"ScentProfile"` and
-- `SCENT_PROFILE_SLUGS` strike in `0020`.
--
-- ## Why the hero is pinned
--
-- The hero decides the header's ground: `<NavGround>` is `obsidian` over a
-- photograph or a film and `ivory` over the typographic composition. If the hero
-- could be moved down the page, the band that landed first would be under a
-- header coloured for something else — charcoal links over a dark photograph,
-- which is the illegible case `providers/nav-ground-provider.tsx` exists to
-- prevent. So the hero is present here, and can be switched off, but
-- `"isPinned"` keeps it first and the dashboard offers it no move control.
--
-- ## The settings column
--
-- Deliberately small. Only the New Arrival band uses it today, to choose between
-- a photograph and a film. It is validated by Zod at both edges
-- (`src/schemas/db/landing.ts`), never trusted as it comes out.

create table if not exists public."LandingSection" (
  key         text primary key
    constraint landing_section_known_key check (key in (
      'hero', 'collections', 'essences', 'story', 'craft',
      'featured', 'ingredients', 'journal', 'testimonials', 'newsletter'
    )),

  "isEnabled" boolean not null default true,

  -- Contiguity is not enforced: the dashboard rewrites every row's position on
  -- save, exactly as `"HeroSlide"` does, so gaps are transient rather than a
  -- state anything has to survive.
  "sortOrder" int not null default 0 check ("sortOrder" >= 0),

  -- A pinned section renders first and cannot be moved. Only the hero is one,
  -- and the check keeps it that way rather than leaving it to the dashboard.
  "isPinned"  boolean not null default false
    constraint landing_section_only_hero_pinned
    check ("isPinned" = false or key = 'hero'),

  settings    jsonb not null default '{}'::jsonb,

  "updatedAt" timestamptz not null default now()
);

-- ── Seed, in the order the page renders today ─────────────────
--
-- `on conflict do nothing`: re-running must not undo an editor's ordering. The
-- first apply establishes today's page exactly; every later apply is a no-op.

insert into public."LandingSection" (key, "sortOrder", "isPinned") values
  ('hero',         0, true),
  ('collections',  1, false),
  ('essences',     2, false),
  ('story',        3, false),
  ('craft',        4, false),
  ('featured',     5, false),
  ('ingredients',  6, false),
  ('journal',      7, false),
  ('testimonials', 8, false),
  ('newsletter',   9, false)
on conflict (key) do nothing;

-- ── The New Arrival band's media ──────────────────────────────
--
-- The `"HeroSetting"` shape (`0037_hero.sql`), applied to one band's settings
-- rather than to its own table: `mediaType` is the switch, `videoUrl` is read
-- only when it says VIDEO, and a VIDEO with no URL must be impossible rather
-- than merely discouraged. `"HeroSetting"` gets that from a table-level check;
-- a jsonb column needs the same rule written as one.

alter table public."LandingSection"
  drop constraint if exists landing_section_media_complete;

alter table public."LandingSection"
  add constraint landing_section_media_complete check (
    coalesce(settings->>'mediaType', 'IMAGES') <> 'VIDEO'
    or (settings->>'videoUrl') ~ '^https://'
  );

-- ── Privileges ────────────────────────────────────────────────
--
-- The storefront reads this table on every render of `/`, so unlike the order
-- tables it is readable by `anon`. It is page structure, not customer data.
-- Writing stays with the service role, behind `requireAdmin()`.

alter table public."LandingSection" enable row level security;

drop policy if exists "LandingSection readable" on public."LandingSection";
create policy "LandingSection readable"
  on public."LandingSection" for select
  to anon, authenticated
  using (true);

revoke all on public."LandingSection" from public;
grant select on public."LandingSection" to anon, authenticated;
grant all on public."LandingSection" to service_role;
