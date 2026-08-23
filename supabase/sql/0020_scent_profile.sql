-- KHEM — the five scent profiles, as editable rows.
--
-- Applied by `npm run db:migrate`, after `0002_content.sql` (which creates
-- `"IngredientFamily"`, `"Ingredient"` and the family-validating trigger
-- function this file reuses). Every statement is idempotent.
--
-- ## What this is
--
-- `/collections/oriental`, `/floral`, `/fresh`, `/woody` and `/gourmand`: five
-- ways into the catalogue that read the way a customer thinks — "I want
-- something woody" — rather than the way the house files its materials. This
-- table stores how each of those pages *presents itself*, and which olfactive
-- families it spans. It stores nothing about which products are in it.
--
-- ## Why membership is derived and not stored
--
-- The relation already exists, twice over: `"Ingredient".families` says what a
-- material smells of, and `"IngredientUsage"` says which perfumes are built on
-- it — a real foreign key to `"Product".slug`. A profile page is therefore the
-- products reachable by
--
--   ScentProfile.families ∩ Ingredient.families → IngredientUsage → Product
--
-- Storing a product ↔ profile list beside that would be a second answer to a
-- question the schema can already answer, and the two would part company the
-- first time an ingredient was recatalogued.
--
-- ## Why this is not a `Collection`
--
-- The `MerchPage` argument, unchanged (`0012_merch_page.sql`): a product points
-- at exactly one collection (`"Product"."collectionSlug"`, `0001_catalog.sql`),
-- so seeding "Woody" as a collection would take those fragrances out of
-- Signature and Noir. A profile crosses every collection at once, body care and
-- the sets included — a candle built on cedar is woody.
--
-- ## Why the slug set is closed
--
-- These pages exist because `SCENT_PROFILE_SLUGS` in `src/lib/scent-profiles.ts`
-- routes them and the Nav links them. A sixth row would be a page with no route
-- and no menu entry; a deleted row would be a live URL with no copy. So the code
-- is the authority on *which* profiles exist and this table on what they say and
-- what they span, and the check constraint keeps the two from drifting.
--
-- The storefront treats a row as an override, never a dependency: with the table
-- empty or unreachable, all five pages still render from the dictionary and the
-- constants in `src/lib/scent-profiles.ts`.

create table if not exists public."ScentProfile" (
  slug            text primary key
    constraint scent_profile_known_slug
    check (slug in ('oriental', 'floral', 'fresh', 'woody', 'gourmand')),

  name            text not null,
  description     text not null,
  "bannerUrl"     text not null,
  "bannerAlt"     text not null,

  -- The olfactive families this profile spans, drawn from `"IngredientFamily"`.
  -- An array rather than a junction table for the reason `"Ingredient".families`
  -- gives: filtering stays a predicate, and every read would otherwise have to
  -- aggregate. Membership of the closed vocabulary is enforced by the trigger
  -- below — a `check` cannot reach another table.
  families        text[] not null default '{}',

  -- Translations, as nullable siblings — the arrangement `0008_i18n_content.sql`
  -- establishes for every translatable column in the schema.
  name_ar         text,
  description_ar  text,
  "bannerAlt_ar"  text,

  "sortOrder"     int not null default 0,
  "updatedAt"     timestamptz not null default now()
);

create index if not exists scent_profile_families_idx
  on public."ScentProfile" using gin (families);

-- The same guard `"Ingredient"` carries, on the same column name.
-- `assert_ingredient_families()` reads `new.families` and nothing else about the
-- row it fires on, so it is reused rather than copied: one definition of "that
-- is not a family we recognise", for both tables.
drop trigger if exists scent_profile_families_valid on public."ScentProfile";
create trigger scent_profile_families_valid
  before insert or update on public."ScentProfile"
  for each row
  execute function public.assert_ingredient_families();

-- ── Seed ────────────────────────────────────────────────────
--
-- The five profiles the Nav lists, in the order it lists them.
--
-- On the family mapping: seven families are catalogued, five profiles are
-- offered. Four map one to one; `fresh` gathers 'Fresh / Citrus', 'Aquatic
-- Aromas' and 'Herbal', which are three perfumer's distinctions for one thing a
-- customer asks for. Nothing is left unreachable.
--
-- `do nothing` rather than `do update`: on a database where an editor has
-- already rewritten a description or changed a hero, a re-run must not put these
-- back.

insert into public."ScentProfile"
  (slug, name, description, "bannerUrl", "bannerAlt", families,
   name_ar, description_ar, "bannerAlt_ar", "sortOrder")
values
  (
    'oriental',
    'Oriental',
    'Warmth with something withheld in it. Resins, amber and incense that settle into the skin and stay there — the register KHEM was founded on, and the one a room notices an hour after you have left it.',
    'https://images.unsplash.com/photo-1667070796007-185faecdf8a1?w=1800&h=900&fit=crop&auto=format',
    'A carved temple relief of offering bearers with their vessels',
    array['Oriental Aromas'],
    'شرقي',
    'دفء يحتفظ بسرّه. راتنجات وعنبر وبخور تستقرّ في البشرة فتبقى — النَفَس الذي قامت عليه خِم، والأثر الذي تنتبه له الغرفة بعد أن تغادرها بساعة.',
    'نقش معبد محفور لحاملي القرابين بأوانيهم',
    0
  ),
  (
    'floral',
    'Floral',
    'Flowers taken seriously. Jasmine picked before dawn, rose distilled the same day it is cut — petals treated as material rather than as decoration, and composed with enough shadow to keep them from turning sweet.',
    'https://images.unsplash.com/photo-1631189944771-466264f05965?w=1800&h=900&fit=crop&auto=format',
    'A single crocus in bloom against deep shadow',
    array['Floral'],
    'زهري',
    'زهور تُؤخذ على محمل الجد. ياسمين يُقطف قبل الفجر، وورد يُقطَّر في يوم قطافه — بتلات تُعامَل كمادة لا كزينة، وتُركَّب مع ما يكفي من الظلّ كي لا تنزلق إلى الحلاوة.',
    'زهرة زعفران متفتّحة في ظلّ عميق',
    1
  ),
  (
    'fresh',
    'Fresh',
    'The first breath of the composition, and the reason you lean in again. Citrus peel, sea air and cut green stems — light, but never thin: every one of these is built over something that holds.',
    'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1800&h=900&fit=crop&auto=format',
    'Turquoise surf breaking over pale sand, seen from above',
    array['Fresh / Citrus', 'Aquatic Aromas', 'Herbal'],
    'منعش',
    'النَفَس الأول في التركيبة، والسبب الذي يجعلك تقترب مرّة أخرى. قشر الحمضيات وهواء البحر والسيقان الخضراء المقطوفة — خفّة، لكنها ليست هشاشة: كلٌّ منها مبنيّ فوق قاعدة تثبت.',
    'موج فيروزي ينكسر على رمل شاحب، مرئيًّا من علٍ',
    2
  ),
  (
    'woody',
    'Woody',
    'The bones of a fragrance. Oud, sandalwood and cedar — the materials the house travels furthest for, and the ones that decide how a perfume behaves in its last hour rather than its first.',
    'https://images.unsplash.com/photo-1425913397330-cf8af2ff40a1?w=1800&h=900&fit=crop&auto=format',
    'Low sunlight through a stand of pines',
    array['Woody Aromas'],
    'خشبي',
    'عظام العطر. عود وصندل وأرز — المواد التي تقطع الدار المسافات الأبعد لأجلها، وهي التي تقرّر كيف يتصرّف العطر في ساعته الأخيرة لا الأولى.',
    'ضوء شمس منخفض يتخلّل غابة صنوبر',
    3
  ),
  (
    'gourmand',
    'Gourmand',
    'Edible in the way a memory is edible. Honey, vanilla, dried fruit and roasted almond, kept dry and kept adult — appetite rather than dessert, and worn closer to the skin than any other register we make.',
    'https://images.unsplash.com/photo-1471943311424-646960669fbc?w=1800&h=900&fit=crop&auto=format',
    'A glass of honey beside blossom and dried fruit in low light',
    array['Gourmand'],
    'حلواني',
    'شهيّ بالمعنى الذي تكون به الذكرى شهيّة. عسل وفانيليا وفاكهة مجفّفة ولوز محمّص، تُبقى جافّة وتُبقى ناضجة — شهيّة لا حلوى، وتُلبس أقرب إلى البشرة من أي نَفَس آخر نصنعه.',
    'كوب عسل إلى جانب زهر وفاكهة مجفّفة في ضوء خافت',
    4
  )
on conflict (slug) do nothing;

-- ── Row Level Security ──────────────────────────────────────
--
-- Public reading, service-role writing — the arrangement `0001_catalog.sql`
-- sets up and `0006_privileges.sql` argues for. No insert/update/delete policy
-- for `anon` or `authenticated` exists here, and none should be added.
--
-- The `grant select` is stated rather than left to the narrowed default
-- privileges from `0006_privileges.sql`: that file runs *before* this one in
-- filename order, so relying on its default would make this table's readability
-- depend on migration ordering rather than on a line in the file that creates it.

alter table public."ScentProfile" enable row level security;

drop policy if exists "ScentProfile is publicly readable" on public."ScentProfile";
create policy "ScentProfile is publicly readable"
  on public."ScentProfile" for select
  to anon, authenticated
  using (true);

grant select on public."ScentProfile" to anon, authenticated;

-- ── Hero correction ─────────────────────────────────────────
--
-- Earlier revisions of this file seeded heroes chosen from descriptions rather
-- than by looking at the photographs. Two generations of them were wrong: the
-- first gave "Fresh" a pair of gift boxes and "Woody" an iris; the second
-- borrowed `"Ingredient"."imageUrl"`, which turns out to carry *branded
-- competitor bottles* behind material alt text for several materials — a fault
-- in that seed, not in this one, and the reason nothing here reads an image out
-- of that table.
--
-- Scoped to rows still carrying one of the known stale URLs, so an editor who
-- has replaced a hero keeps theirs, and a database seeded from the corrected
-- `values` above matches nothing and is left untouched.

update public."ScentProfile" as sp
   set "bannerUrl" = v.url,
       "bannerAlt" = v.alt,
       "bannerAlt_ar" = v.alt_ar,
       "updatedAt" = now()
  from (values
    ('oriental',
     'https://images.unsplash.com/photo-1667070796007-185faecdf8a1?w=1800&h=900&fit=crop&auto=format',
     'A carved temple relief of offering bearers with their vessels',
     'نقش معبد محفور لحاملي القرابين بأوانيهم',
     array['photo-1643797517714-a273548abc3c']),
    ('floral',
     'https://images.unsplash.com/photo-1631189944771-466264f05965?w=1800&h=900&fit=crop&auto=format',
     'A single crocus in bloom against deep shadow',
     'زهرة زعفران متفتّحة في ظلّ عميق',
     array['photo-1615885108069-7d5bef9a7e22', 'photo-1676950933747-5f886cadf014']),
    ('fresh',
     'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1800&h=900&fit=crop&auto=format',
     'Turquoise surf breaking over pale sand, seen from above',
     'موج فيروزي ينكسر على رمل شاحب، مرئيًّا من علٍ',
     array['photo-1674620213535-9b2a2553ef40', 'photo-1533603208986-24fd819e718a']),
    ('woody',
     'https://images.unsplash.com/photo-1425913397330-cf8af2ff40a1?w=1800&h=900&fit=crop&auto=format',
     'Low sunlight through a stand of pines',
     'ضوء شمس منخفض يتخلّل غابة صنوبر',
     array['photo-1631189944771-466264f05965', 'photo-1607506740211-ff3d6b933dda']),
    ('gourmand',
     'https://images.unsplash.com/photo-1471943311424-646960669fbc?w=1800&h=900&fit=crop&auto=format',
     'A glass of honey beside blossom and dried fruit in low light',
     'كوب عسل إلى جانب زهر وفاكهة مجفّفة في ضوء خافت',
     array['photo-1613549026666-73c9c9083c62', 'photo-1640975972263-1f73398e943b'])
  ) as v(slug, url, alt, alt_ar, stale)
 where sp.slug = v.slug
   and exists (
     select 1 from unnest(v.stale) as stale_id
      where sp."bannerUrl" like '%' || stale_id || '%'
   );
