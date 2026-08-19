-- KHEM — a collection's card photograph, separate from its banner.
--
-- Applied by `npm run db:migrate`. Idempotent, like every file here.
--
-- `0001_catalog.sql` gave `"Collection"` exactly one image, and the storefront
-- asks it to do two incompatible jobs:
--
--   * `<CollectionCard>` on the home page — portrait, `aspect-3/4`, the title
--     and description sitting over the lower third.
--   * the hero on `/collections/[slug]` and on the four category routes —
--     landscape, 60vh, cropped to a band.
--
-- One file cannot be both crops. A photograph chosen for the banner loses its
-- subject to `object-cover` in the card, and one chosen for the card is a
-- letterboxed sliver in the hero.
--
-- ── Why nullable, and why no back-fill ──────────────────────
--
-- `"bannerUrl"` stays `not null`: every collection has a banner today and the
-- hero has nowhere to fall back to. The card columns are nullable, and
-- `toCollection()` in `src/schemas/db/catalog.ts` reads null as "use the
-- banner". That makes this migration a no-op for a visitor — the grid renders
-- exactly as it did before — and lets the card crops arrive one at a time from
-- the dashboard rather than as a content freeze.
--
-- `"cardAlt_ar"` follows `"bannerAlt_ar"` from `0008_i18n_content.sql`: the alt
-- text is the only translatable half of an image, and it falls back to the
-- banner's Arabic alt before it falls back to English.

alter table public."Collection"
  add column if not exists "cardUrl"    text,
  add column if not exists "cardAlt"    text,
  add column if not exists "cardAlt_ar" text;

-- A card image without alt text is an unlabelled link on the home page; alt
-- text without an image is a value no reader will ever reach. The constraint
-- keeps the pair honest at the level the dashboard cannot be bypassed at.
--
-- Written as a guarded `add constraint` because Postgres has no
-- `add constraint if not exists`.
do $$ begin
  alter table public."Collection"
    add constraint collection_card_image_pair
    check (num_nulls("cardUrl", "cardAlt") <> 1);
exception when duplicate_object then null; end $$;
