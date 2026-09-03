-- KHEM — the Nav and the Footer, as data.
-- Applied by `npm run db:migrate`, after `0047_reserved_slugs.sql`. Every
-- statement is idempotent.
--
-- ## What this is
--
-- The menu has always been `src/constants/navigation-pages.ts`: a hand-written
-- table of `{ key, path }` pairs, where `key` indexes a typed dictionary entry
-- and `path` is a literal string. Nothing in `/admin` could read or write it. So
-- a collection created in the dashboard *had* a page — `/collections/[slug]`
-- resolves it — but could not be linked to from anywhere without a code change
-- and two dictionary edits. That is the brief's actual complaint, and no amount
-- of restructuring the catalogue fixes it.
--
-- ## A link points at a thing, never at a URL
--
-- There is no `href` column here, deliberately. A row names a **category**, a
-- **collection**, or one of a closed set of **static pages**, and the address is
-- derived from that at render time. Three consequences, all of them the point:
--
--   * Nothing can be mistyped into a 404, because nothing is typed.
--   * Renaming a collection's slug moves its menu entry with it — the foreign
--     keys below carry `on update cascade`.
--   * Deleting a collection removes its menu entries rather than leaving a dead
--     row behind — `on delete cascade`.
--
-- It also means the CMS cannot be used to point a menu item at an external
-- address. That is not a limitation to work around later: a free-text `href`
-- reachable from a form is an open redirect wearing a navigation costume.
--
-- ## Labels
--
-- A category or collection row already carries `name` and `name_ar`, so a link
-- to one is bilingual the moment it exists — which is what makes creating a
-- collection in the dashboard a complete act. `label`/`label_ar` and
-- `desc`/`desc_ar` are *overrides*, for when the menu wants different words than
-- the page ("Signature Collection" over "Signature"); null means "use the
-- target's own", exactly as the New Arrival band's overrides work.
--
-- A `PAGE` row has no database row to read a name from, so its copy stays in the
-- dictionaries under `pageKey` — typed, translated, and a build failure if a
-- translation is missing. That guarantee is why the static rows were not moved
-- into text columns here.
--
-- ## The seed reproduces today's menu exactly
--
-- Every row below is one entry of `navigation-pages.ts`, in its printed order,
-- with today's label and description carried across as overrides where they
-- differ from the target's own name. The first deploy after this migration must
-- render a menu nobody can tell apart from yesterday's; only its editability
-- changes. That file stays in the tree as the fallback for an empty or
-- unreachable table — the same posture `resolveSectionOrder()` takes.

-- ── Enums ─────────────────────────────────────────────────────

do $$ begin
  -- The three columns the Nav prints and the Footer flattens.
  create type public."NavColumn" as enum (
    'COLLECTIONS', 'QUICK_ACCESS', 'WORLD'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  -- What a row points at. `GROUP` is the disclosure with nothing behind the
  -- heading — "Scent Profiles" is one: a name for five links, not a place.
  create type public."NavTargetType" as enum (
    'CATEGORY', 'COLLECTION', 'PAGE', 'GROUP'
  );
exception when duplicate_object then null; end $$;

-- ── NavLink ───────────────────────────────────────────────────

create table if not exists public."NavLink" (
  id             text primary key,

  column_key     public."NavColumn" not null,

  -- One level of nesting, and one only — a disclosure and its rows. Enforced by
  -- the trigger below, because a menu that can nest arbitrarily is a menu whose
  -- renderer has to guess how deep to indent.
  "parentId"     text references public."NavLink"(id) on delete cascade,

  "targetType"   public."NavTargetType" not null,

  "categorySlug" text references public."Category"(slug)
                   on update cascade on delete cascade,
  "collectionSlug" text references public."Collection"(slug)
                   on update cascade on delete cascade,

  -- A static page, named by the dictionary key its copy is written under.
  -- Checked against the closed set the code knows how to route; a key the code
  -- cannot turn into a path is a menu row with no destination.
  "pageKey"      text
    constraint nav_link_known_page check (
      "pageKey" is null or "pageKey" in (
        'allProducts', 'bestSellers', 'newArrival',
        'oriental', 'floral', 'fresh', 'woody', 'gourmand',
        'heritage', 'craftsmanship', 'ingredients', 'journal', 'about'
      )
    ),

  -- The heading of a `GROUP`, under `nav.collectionGroups`.
  "groupKey"     text
    constraint nav_link_known_group check (
      "groupKey" is null or "groupKey" in (
        'fragrances', 'scentProfiles', 'bodyCare', 'homeFragrance'
      )
    ),

  label          text,
  label_ar       text,
  "desc"         text,
  desc_ar        text,

  -- The two surfaces, separately switchable. The Footer is a sitemap and the
  -- Nav is a menu; an entry can belong to one without the other.
  "showInNav"    boolean not null default true,
  "showInFooter" boolean not null default true,

  "isEnabled"    boolean not null default true,
  "sortOrder"    int not null default 0,

  "createdAt"    timestamptz not null default now(),
  "updatedAt"    timestamptz not null default now(),

  -- Exactly one target, and the one its type names. Without this a row could
  -- claim to be a COLLECTION while carrying a `pageKey`, and the renderer would
  -- have to decide which half to believe.
  constraint nav_link_target_matches_type check (
    case "targetType"
      when 'CATEGORY'   then "categorySlug" is not null
                         and "collectionSlug" is null
                         and "pageKey" is null
      when 'COLLECTION' then "collectionSlug" is not null
                         and "categorySlug" is null
                         and "pageKey" is null
      when 'PAGE'       then "pageKey" is not null
                         and "categorySlug" is null
                         and "collectionSlug" is null
      when 'GROUP'      then "groupKey" is not null
                         and "categorySlug" is null
                         and "collectionSlug" is null
                         and "pageKey" is null
    end
  )
);

create index if not exists nav_link_order_idx
  on public."NavLink" (column_key, "parentId", "sortOrder");

-- ── One level of nesting ──────────────────────────────────────

create or replace function public.nav_link_depth_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grandparent text;
begin
  if new."parentId" is null then
    return new;
  end if;

  if new."parentId" = new.id then
    raise exception 'A menu row cannot be its own parent.';
  end if;

  select "parentId" into v_grandparent
    from public."NavLink" where id = new."parentId";

  if v_grandparent is not null then
    raise exception 'The menu nests one level. % already sits inside a group.',
      new."parentId";
  end if;

  return new;
end;
$$;

drop trigger if exists nav_link_depth_guard on public."NavLink";
create trigger nav_link_depth_guard
  before insert or update of "parentId" on public."NavLink"
  for each row
  execute function public.nav_link_depth_guard();

-- ── The seed — today's menu, row for row ──────────────────────
--
-- `on conflict do nothing` throughout: the first apply establishes the current
-- menu exactly, and every later apply is a no-op rather than an undo of an
-- editor's work.
--
-- Descriptions are the strings `nav.collectionItems` prints today, carried onto
-- the rows that now own them. Labels are set only where the menu's wording
-- differs from the target's own name — "Signature Collection" for the
-- `signature` collection, "All Body Care" for the `body-care` category — so a
-- collection created tomorrow inherits its name without anyone typing it twice.

-- The columns' own rows first, so every parent is a row before a child names it.
insert into public."NavLink"
  (id, column_key, "parentId", "targetType", "categorySlug", "collectionSlug",
   "pageKey", "groupKey", label, label_ar, "desc", desc_ar, "sortOrder")
values
  -- ── Our Collections ────────────────────────────────────────
  ('nav-all-products', 'COLLECTIONS', null, 'PAGE', null, null,
   'allProducts', null, null, null, null, null, 0),
  ('nav-fragrances', 'COLLECTIONS', null, 'GROUP', null, null,
   null, 'fragrances', null, null, null, null, 1),
  ('nav-scent-profiles', 'COLLECTIONS', null, 'GROUP', null, null,
   null, 'scentProfiles', null, null, null, null, 2),
  ('nav-body-care', 'COLLECTIONS', null, 'GROUP', null, null,
   null, 'bodyCare', null, null, null, null, 3),
  ('nav-home-fragrance', 'COLLECTIONS', null, 'GROUP', null, null,
   null, 'homeFragrance', null, null, null, null, 4),

  -- ── Quick Access ───────────────────────────────────────────
  ('nav-new-arrival', 'QUICK_ACCESS', null, 'PAGE', null, null,
   'newArrival', null, null, null, null, null, 0),
  ('nav-discovery-sets', 'QUICK_ACCESS', null, 'CATEGORY', 'discovery', null,
   null, null, 'Discovery Sets', 'أطقم الاكتشاف', null, null, 1),
  ('nav-gift-sets', 'QUICK_ACCESS', null, 'CATEGORY', 'gift-set', null,
   null, null, 'Gift Sets', 'أطقم الهدايا', null, null, 2),
  ('nav-best-sellers', 'QUICK_ACCESS', null, 'PAGE', null, null,
   'bestSellers', null, null, null, null, null, 3),

  -- ── The World of KHEM ──────────────────────────────────────
  ('nav-heritage', 'WORLD', null, 'PAGE', null, null,
   'heritage', null, null, null, null, null, 0),
  ('nav-craftsmanship', 'WORLD', null, 'PAGE', null, null,
   'craftsmanship', null, null, null, null, null, 1),
  ('nav-ingredients', 'WORLD', null, 'PAGE', null, null,
   'ingredients', null, null, null, null, null, 2),
  ('nav-journal', 'WORLD', null, 'PAGE', null, null,
   'journal', null, null, null, null, null, 3),
  ('nav-about', 'WORLD', null, 'PAGE', null, null,
   'about', null, null, null, null, null, 4)
on conflict (id) do nothing;

-- The rows inside the four disclosures.
insert into public."NavLink"
  (id, column_key, "parentId", "targetType", "categorySlug", "collectionSlug",
   "pageKey", "groupKey", label, label_ar, "desc", desc_ar, "sortOrder")
values
  ('nav-signature', 'COLLECTIONS', 'nav-fragrances', 'COLLECTION', null, 'signature',
   null, null, 'Signature Collection', 'مجموعة سيجنتشر',
   'Timeless expressions of Egyptian heritage', 'تعبيرات خالدة عن التراث المصري', 0),
  ('nav-gemstone', 'COLLECTIONS', 'nav-fragrances', 'COLLECTION', null, 'gemstone',
   null, null, 'Gemstone Collection', 'مجموعة الأحجار الكريمة',
   'Mineral light made wearable', 'ضوء المعادن يُلبس', 1),
  ('nav-noir', 'COLLECTIONS', 'nav-fragrances', 'COLLECTION', null, 'noir',
   null, null, 'Noir Collection', 'مجموعة نوار',
   'A darker, more exclusive chapter', 'فصل أكثر عتمة وخصوصية', 2),

  ('nav-oriental', 'COLLECTIONS', 'nav-scent-profiles', 'PAGE', null, null,
   'oriental', null, null, null, null, null, 0),
  ('nav-floral', 'COLLECTIONS', 'nav-scent-profiles', 'PAGE', null, null,
   'floral', null, null, null, null, null, 1),
  ('nav-fresh', 'COLLECTIONS', 'nav-scent-profiles', 'PAGE', null, null,
   'fresh', null, null, null, null, null, 2),
  ('nav-woody', 'COLLECTIONS', 'nav-scent-profiles', 'PAGE', null, null,
   'woody', null, null, null, null, null, 3),
  ('nav-gourmand', 'COLLECTIONS', 'nav-scent-profiles', 'PAGE', null, null,
   'gourmand', null, null, null, null, null, 4),

  ('nav-body-care-all', 'COLLECTIONS', 'nav-body-care', 'CATEGORY', 'body-care', null,
   null, null, 'All Body Care', 'كل العناية بالجسم',
   'Rituals for the skin', 'طقوس للبشرة', 0),
  ('nav-body-mist', 'COLLECTIONS', 'nav-body-care', 'COLLECTION', null, 'body-mist',
   null, null, null, null,
   'The accords, worn closer and lighter', 'الأنفاس، تُلبس أقرب وأخف', 1),

  ('nav-home-fragrance-all', 'COLLECTIONS', 'nav-home-fragrance', 'CATEGORY', 'home-fragrance', null,
   null, null, 'All Home Fragrances', 'كل عطور المنزل',
   'Scent your sanctuary', 'عطّر ملاذك', 0),
  ('nav-room-spray', 'COLLECTIONS', 'nav-home-fragrance', 'COLLECTION', null, 'room-spray',
   null, null, null, null,
   'The accords, given to a room', 'الأنفاس، تُمنح للغرفة', 1)
on conflict (id) do nothing;

-- ── Row Level Security ────────────────────────────────────────
--
-- The menu is on every page, so `anon` reads it. Writing stays with the service
-- role behind `requireAdmin()`, and a disabled row stays readable for the same
-- reason a disabled category does: the dashboard must still be able to show it.

alter table public."NavLink" enable row level security;

drop policy if exists "NavLink is publicly readable" on public."NavLink";
create policy "NavLink is publicly readable"
  on public."NavLink" for select
  to anon, authenticated
  using (true);

revoke all on public."NavLink" from public;
grant select on public."NavLink" to anon, authenticated;
grant all on public."NavLink" to service_role;
