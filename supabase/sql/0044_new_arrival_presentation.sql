-- KHEM — the New Arrival band's own presentation.
-- Applied by `npm run db:migrate`, after `0043_landing_sections.sql`. Every
-- statement is idempotent.
--
-- ## What changes
--
-- 0043 gave the band a two-way media switch: the featured product's photograph,
-- or a film. That made the band's *media* configurable while everything else it
-- says — its title, its paragraph, its button — was still read off the featured
-- product and could not be overridden.
--
-- This widens the switch to three and adds optional overrides for the rest:
--
--   FEATURED  the featured product's own photograph, exactly as before
--   IMAGE     a banner asset belonging to this band and nothing else
--   FILM      a film belonging to this band
--
-- Plus `title`, `description`, `ctaLabel`, `ctaHref` and `imageUrl`/`imageAlt`,
-- each optional and each with a `show*` flag. Empty means "fall back to the
-- product", which is what the band did before this file existed — so a row that
-- sets none of them renders byte-for-byte what it rendered yesterday.
--
-- ## Why here and not on `"Product"`
--
-- None of this is a fact about a perfume. It is a fact about one band of one
-- page, and putting a `homepageBannerUrl` on `"Product"` would mean every
-- product carried a column that only matters while it happens to be featured.
-- The band's settings already exist; this extends them.
--
-- ## The featured product itself does not move
--
-- `"BoutiqueSetting"."featuredProductSlug"` stays exactly where it is. It is
-- already the single answer to "which product is featured", and copying it into
-- this table would create the second source of truth the brief rules out. What
-- moves is the *editor*: the dashboard now offers that field on the New Arrival
-- screen instead of under System → Settings, so one column is edited in one
-- place — just a different place.
--
-- ## Migrating the two existing values
--
-- 0043 stored `IMAGES` and `VIDEO`. Those are renamed in place below, so a band
-- already set to a film stays a film.

-- ── Drop the old constraint before rewriting the values it guards ──

alter table public."LandingSection"
  drop constraint if exists landing_section_media_complete;

-- ── Rename the two existing values ────────────────────────────

update public."LandingSection"
   set settings = jsonb_set(settings, '{mediaType}', '"FEATURED"')
 where key = 'featured'
   and settings->>'mediaType' = 'IMAGES';

update public."LandingSection"
   set settings = jsonb_set(settings, '{mediaType}', '"FILM"')
 where key = 'featured'
   and settings->>'mediaType' = 'VIDEO';

-- ── The new rule ──────────────────────────────────────────────
--
-- Three states, and each one names what it needs. A band set to FILM without a
-- film, or to IMAGE without an image, is not a band with a missing field — it is
-- a band that cannot be drawn, and the storefront would fall back silently to
-- the product photograph while the dashboard showed a saved setting. Refusing
-- the write is what keeps those two honest.
--
-- FEATURED needs nothing: the product supplies the media, and a band with no
-- featured product simply does not render, exactly as before.

-- Every branch is wrapped in `is true`, and that is not defensive noise — it is
-- the difference between this constraint working and not working.
--
-- A `check` fails only on FALSE. It *passes* on NULL. With `{"mediaType":"FILM"}`
-- and no film, `settings->>'videoUrl'` is NULL, so `NULL ~ '^https://'` is NULL,
-- `true and NULL` is NULL, and the whole disjunction evaluates to NULL — which
-- Postgres accepts. The first version of this constraint therefore allowed
-- exactly the two rows it was written to forbid, silently.
--
-- `is true` collapses NULL to FALSE and the rule means what it reads as.

alter table public."LandingSection"
  add constraint landing_section_media_complete check (
    key <> 'featured'
    or (coalesce(settings->>'mediaType', 'FEATURED') = 'FEATURED') is true
    or (settings->>'mediaType' = 'FILM'  and (settings->>'videoUrl') ~ '^https://') is true
    or (settings->>'mediaType' = 'IMAGE' and (settings->>'imageUrl') ~ '^https://') is true
  );
