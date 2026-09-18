-- KHEM — short collection copy for portrait cards.
--
-- The banner description remains the long editorial introduction. This field is
-- intentionally separate so card copy can stay concise without changing the
-- collection page hero.

alter table public."Collection"
  add column if not exists subdescription text,
  add column if not exists subdescription_ar text;