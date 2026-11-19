-- KHEM — a separate film for phones on the hero
-- (prompts/mobile-video-hero-loading.md).
--
-- The hero film is the largest thing a phone downloads on the home page
-- (1.15 MB at w_828 on 2026-11-19). Editors can now give a portrait,
-- ~720×1280 film for phones; when they don't, the storefront derives one from
-- the desktop film with a Cloudinary transformation
-- (`f_auto,q_auto:eco,w_720,ac_none`, `src/lib/video-url.ts`), so this column
-- is optional and no existing row needs a value.
--
-- Same rule as "videoUrl" (0037): https only. The New Arrival film's mobile
-- address lives in `LandingSection.settings` (JSON) and needs no migration.
--
-- Additive and idempotent. Applied directly (single transaction), like
-- 0073–0078 — never via `npm run db:migrate` while 0072b is held back
-- (supabase/README.md). The column is read through the Data API, so the
-- PostgREST schema cache is reloaded at the end.

alter table public."HeroSetting"
  add column if not exists "videoMobileUrl" text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'herosetting_videomobileurl_https'
      and conrelid = 'public."HeroSetting"'::regclass
  ) then
    alter table public."HeroSetting"
      add constraint herosetting_videomobileurl_https
      check ("videoMobileUrl" ~ '^https://' and char_length("videoMobileUrl") <= 2048);
  end if;
end $$;

notify pgrst, 'reload schema';
