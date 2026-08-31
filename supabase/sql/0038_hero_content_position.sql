-- ── 0038 — Where the hero's words sit ───────────────────────
--
-- One column on `"HeroSetting"`: whether the headline, description and button
-- are centred in the frame or gathered into its lower corner.
--
-- ## Why this is a setting and not a decision
--
-- A campaign photograph decides it. A bottle shot centred on a plain ground
-- wants type over the middle; a wide editorial frame with the subject on one
-- side wants the words in the opposite corner, where they are not standing on
-- the picture. The desk changes the image far more often than a developer
-- changes this file, so the composition has to move with the image.
--
-- ## `BOTTOM_LEFT`, and what it means in Arabic
--
-- The member is named for the Latin-script reading because that is what the
-- editor is choosing — but the storefront places the block with **logical**
-- properties, so under `dir="rtl"` it lands in the bottom *right*: the corner an
-- Arabic reader's eye finishes on. A physically-left block in an RTL layout
-- would be the mirror of what the editor asked for, not a translation of it.
--
-- `CENTER` is the default, so every hero configured before this migration keeps
-- the composition it already had.

do $$ begin
  create type public."HeroContentPosition" as enum ('CENTER', 'BOTTOM_LEFT');
exception when duplicate_object then null; end $$;

alter table public."HeroSetting"
  add column if not exists "contentPosition"
    public."HeroContentPosition" not null default 'CENTER';

-- Same reason as 0037: the first request for a column PostgREST has not seen
-- blocks while the schema cache reloads, and the home page reads this one.
notify pgrst, 'reload schema';
