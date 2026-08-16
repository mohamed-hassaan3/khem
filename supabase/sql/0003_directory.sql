-- KHEM — stockist directory, contact details, and legal documents.
--
-- Applied by `npm run db:migrate`. Idempotent, like every file here.
--
-- The tables `src/services/stockists.ts`, `contact.ts`, and `legal.ts` name in
-- their migration comments, created under exactly those names.

-- ── Enums ───────────────────────────────────────────────────
--
-- Mirrors of the closed unions in `src/types/stockist.ts`. The labels live in
-- `dict.stockists.*`, keyed by these members, which is what makes adding a
-- region without translating it a compile error on the TypeScript side.

do $$ begin
  create type public."StockistRegion" as enum (
    'middleEast', 'europe', 'americas', 'asiaPacific'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public."StockistType" as enum (
    'flagship', 'boutique', 'retailPartner', 'departmentStore'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public."StockistStatus" as enum ('open', 'comingSoon');
exception when duplicate_object then null; end $$;

-- ── Stockist ────────────────────────────────────────────────

create table if not exists public."Stockist" (
  id            text primary key,
  name          text not null,
  city          text not null,
  country       text not null,
  region        public."StockistRegion" not null,
  type          public."StockistType" not null,

  -- Whether the location is trading today. An explicit field rather than
  -- something inferred from empty contact details: "is this store open" is a
  -- fact about the store, and deriving it from whether someone remembered to
  -- leave `phone` blank would let a data-entry slip change how a real boutique
  -- renders.
  status        public."StockistStatus" not null,

  -- English-only, rendered in an LTR island. All four are null on an announced
  -- location whose details are not public yet.
  address       text,
  phone         text,
  -- `tel:` target — leading `+` and digits only, no spaces.
  "phoneHref"   text,
  hours         text,
  -- Stored rather than assembled at render time, so the link target is
  -- reviewable alongside the address it points at.
  "mapsUrl"     text,

  "imageUrl"    text not null,
  "imageAlt"    text not null,
  "isPublished" boolean not null default true,
  "sortOrder"   int not null default 0,

  -- The invariant the page renders against: an announced location is an
  -- announcement, not a destination. Without this, a half-filled row would
  -- render a phone number for a shop nobody can visit.
  constraint stockist_coming_soon_has_no_details check (
    status <> 'comingSoon' or (
      address is null and phone is null and "phoneHref" is null
      and hours is null and "mapsUrl" is null
    )
  ),

  -- And the mirror: an open store publishes a way to reach it.
  constraint stockist_open_has_address check (
    status <> 'open' or address is not null
  )
);

create index if not exists stockist_region_idx
  on public."Stockist" (region, "sortOrder")
  where "isPublished";

-- ── Contact ─────────────────────────────────────────────────

create table if not exists public."ContactChannel" (
  id          text primary key,
  -- Uppercase label shown beside the value, e.g. "Telephone".
  label       text not null,
  -- May contain newlines; rendered with `whitespace-pre-line`.
  value       text not null,
  -- `mailto:` / `tel:` target, or null when the value is not actionable.
  href        text,
  "sortOrder" int not null default 0
);

create table if not exists public."SocialProfile" (
  id          text primary key,
  platform    text not null,
  -- Public handle, e.g. "@khemperfumes".
  handle      text not null,
  url         text not null,
  "sortOrder" int not null default 0
);

-- The enquiry `<select>` options.
--
-- ⚠ This table is display copy, not the validation boundary. `subject` is
-- checked in the Server Action against `ENQUIRY_SUBJECTS` in
-- `src/constants/contact.ts`, because a value that lands in a mail header must
-- be validated against something that cannot change without a deploy and a
-- review. `npm run db:verify` fails if the two lists drift apart.
create table if not exists public."EnquirySubject" (
  label       text primary key,
  "sortOrder" int not null default 0
);

-- House-wide settings. A single row, constrained to be single: these are three
-- values the whole site quotes, not a collection.
create table if not exists public."BoutiqueSetting" (
  id               text primary key default 'default' check (id = 'default'),
  "houseEmail"     text not null,
  "conciergeEmail" text not null,
  "wholesaleEmail" text not null,
  "updatedAt"      timestamptz not null default now()
);

-- Which fragrance gets the full-bleed feature section on the home page.
-- Merchandising, so it belongs in the database rather than in a constant a
-- marketer cannot reach — this was `FEATURED_PRODUCT_SLUG` in
-- `src/data/products.ts`. Added by `alter` rather than folded into the `create`
-- above so the statement also lands on a database created before this column
-- existed.
alter table public."BoutiqueSetting"
  add column if not exists "featuredProductSlug" text
    references public."Product"(slug) on update cascade on delete set null;

-- ── LegalDocument ───────────────────────────────────────────
--
-- `sections` is jsonb holding the `LegalSection[]` shape from
-- `src/types/legal.ts`: a closed discriminated union of text / list / note /
-- table / link blocks. Stored as documents rather than shredded into
-- `Section` + `Block` tables because nothing queries *inside* a policy — the
-- page renders the whole document or none of it — and because the union is
-- validated by Zod on read, which a relational split would not improve.
--
-- Nothing here ever reaches `dangerouslySetInnerHTML`; the blocks are rendered
-- by typed React components.

create table if not exists public."LegalDocument" (
  slug           text primary key check (
    slug in ('privacy-policy', 'terms-conditions', 'return-exchange', 'cookie-policy')
  ),
  -- Uppercase kicker above the title, e.g. "Legal".
  eyebrow        text not null,
  title          text not null,
  -- One-sentence plain-language summary, reused verbatim as the meta description.
  lede           text not null,
  -- A date; `formatLegalDate` owns the display form.
  "updatedAt"    date not null,
  "bannerUrl"    text not null,
  "bannerAlt"    text not null,
  sections       jsonb not null,
  "contactEmail" text not null,
  "sortOrder"    int not null default 0,

  constraint legal_sections_is_array check (jsonb_typeof(sections) = 'array')
);

-- ── Row Level Security ──────────────────────────────────────

alter table public."Stockist"        enable row level security;
alter table public."ContactChannel"  enable row level security;
alter table public."SocialProfile"   enable row level security;
alter table public."EnquirySubject"  enable row level security;
alter table public."BoutiqueSetting" enable row level security;
alter table public."LegalDocument"   enable row level security;

drop policy if exists "Published stockists are readable" on public."Stockist";
create policy "Published stockists are readable"
  on public."Stockist" for select to anon, authenticated using ("isPublished");

do $$
declare
  t text;
begin
  foreach t in array array[
    'ContactChannel', 'SocialProfile', 'EnquirySubject', 'BoutiqueSetting',
    'LegalDocument'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || ' is readable', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || ' is readable', t
    );
  end loop;
end $$;

grant select on public."Stockist"        to anon, authenticated;
grant select on public."ContactChannel"  to anon, authenticated;
grant select on public."SocialProfile"   to anon, authenticated;
grant select on public."EnquirySubject"  to anon, authenticated;
grant select on public."BoutiqueSetting" to anon, authenticated;
grant select on public."LegalDocument"   to anon, authenticated;
