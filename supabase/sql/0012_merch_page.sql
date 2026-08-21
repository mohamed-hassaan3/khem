-- KHEM — the two merchandising pages, as editable rows.
--
-- Applied by `npm run db:migrate`. Every statement is idempotent.
--
-- ## What this is
--
-- `/collections/best-sellers` and `/collections/limited-edition` have been real
-- pages since the merchandising round, but their name, description and hero
-- photograph lived in `src/lib/i18n/dictionaries/*` and a `MERCH_PAGE_BANNERS`
-- constant in the route. That made the one thing an editor most wants to change
-- — the hero — a deploy. This table is that copy, and nothing else.
--
-- ## Why this is not a `Collection`
--
-- A product points at exactly one collection (`"Product"."collectionSlug"`,
-- `0001_catalog.sql`), so seeding "best sellers" as a collection would take
-- those fragrances out of Signature and Noir. Membership stays *derived* —
-- `productFacets()` in `src/lib/facets.ts` reads `"isBestseller"` and the
-- `LIMITED_EDITION` tag — and this table stores only how the page presents
-- itself.
--
-- ## Why the slug is a closed set
--
-- These pages exist because `MERCH_PAGE_FACETS` routes them. A third row would
-- be a page with no route; a deleted row would be a live URL with no copy. So
-- the code is the authority on *which* pages exist and this table on what they
-- say, and the check constraint keeps the two from drifting. The dashboard
-- offers no create and no delete for the same reason.
--
-- The storefront treats a row as an override, never a dependency: with the
-- table empty, both pages still render from the dictionary and the constants.

create table if not exists public."MerchPage" (
  slug            text primary key
    constraint merch_page_known_slug
    check (slug in ('best-sellers', 'limited-edition')),

  name            text not null,
  description     text not null,
  "bannerUrl"     text not null,
  "bannerAlt"     text not null,

  -- Translations, as nullable siblings — the arrangement `0008_i18n_content.sql`
  -- establishes for every translatable column in the schema.
  name_ar         text,
  description_ar  text,
  "bannerAlt_ar"  text,

  "updatedAt"     timestamptz not null default now()
);

-- ── Seed ────────────────────────────────────────────────────
--
-- Exactly the copy and the photographs the two pages render today, so applying
-- this migration changes nothing a visitor sees. `do nothing` rather than
-- `do update`: on a database where an editor has already changed the hero, a
-- re-run must not put the Unsplash placeholder back.

insert into public."MerchPage"
  (slug, name, description, "bannerUrl", "bannerAlt", name_ar, description_ar, "bannerAlt_ar")
values
  (
    'best-sellers',
    'Best Sellers',
    'The pieces the house cannot keep on the shelf — chosen by our customers rather than by us, and drawn from every collection we make.',
    'https://images.unsplash.com/photo-1738664926458-d8ca7f56549f?w=1800&h=900&fit=crop&auto=format',
    'Black marble lit from one side, veined with pale gold',
    'الأكثر مبيعًا',
    'القطع التي لا تبقى على الرفّ طويلًا — اختارها عملاؤنا لا نحن، وهي مستقاة من كل مجموعة نصنعها.',
    'رخام أسود يضيئه ضوء جانبي، تتخلله عروق ذهبية شاحبة'
  ),
  (
    'limited-edition',
    'Limited Edition',
    'Small runs, made once. Rare materials and short harvests decide how many bottles exist, and when they are gone the composition is retired.',
    'https://images.unsplash.com/photo-1709662217788-6a8a1b31562a?w=1800&h=900&fit=crop&auto=format',
    'A single flacon in low light, gold leaf catching the edge',
    'إصدار محدود',
    'إصدارات صغيرة تُصنع مرّة واحدة. ندرة المواد وقِصَر موسم الحصاد هما ما يحدّد عدد الزجاجات، وحين تنفد يُطوى العطر.',
    'زجاجة واحدة في ضوء خافت، تلتمع حوافها بورق الذهب'
  )
on conflict (slug) do nothing;

-- ── Row Level Security ──────────────────────────────────────
--
-- Public reading, service-role writing — the arrangement `0001_catalog.sql`
-- sets up and `0006_privileges.sql` argues for. No insert/update/delete policy
-- for `anon` or `authenticated` exists here, and none should be added: the
-- dashboard writes with the service key, which bypasses RLS by design.

alter table public."MerchPage" enable row level security;

drop policy if exists "MerchPage is publicly readable" on public."MerchPage";
create policy "MerchPage is publicly readable"
  on public."MerchPage" for select
  to anon, authenticated
  using (true);

grant select on public."MerchPage" to anon, authenticated;
