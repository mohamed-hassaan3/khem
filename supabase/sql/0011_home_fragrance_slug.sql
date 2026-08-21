-- KHEM — "Room Fragrance" becomes "Home Fragrances", slug included.
--
-- Applied by `npm run db:migrate`. Idempotent, like every file here: the
-- `where` clause matches nothing on a second run, and nothing on a database
-- seeded from the current `supabase/seed/catalog.json`.
--
-- ── Why the slug moves, and not just the label ──────────────
--
-- The collection has read "Home Fragrance" in the catalogue since it was
-- seeded; only the URL and the dictionary key still said "room". That was
-- tolerable while the category sold from `/room-fragrance`, a path no visitor
-- reads closely. It stopped being tolerable when the category moved under
-- `/collections/[slug]`, where the slug *is* the page's name in the address bar
-- and in the tab bar's link — `/collections/room-fragrance` for a collection
-- called Home Fragrances is a seam a visitor can see.
--
-- ── What follows the rename, and what deliberately does not ──
--
-- `"Product"."collectionSlug"` is a foreign key onto `"Collection"(slug)` with
-- `on update cascade` (`0001_catalog.sql`), so the four products move with the
-- collection in the same statement.
--
-- The products' own slugs (`amber-room-spray`, …) are left alone. They name the
-- object, not the category — a room spray is still a room spray in a house that
-- calls the shelf Home Fragrances — and they are the ids the cart and the
-- wishlist persist to `localStorage`, so renaming them would silently empty
-- every returning visitor's bag. That is the same reasoning that made the ids
-- slugs in the first place; see `0001_catalog.sql`'s header.
--
-- `/room-fragrance` itself keeps answering: the route is a 308 to
-- `/collections/home-fragrance`, so links and indexed results still resolve.

update public."Collection"
   set id = 'home-fragrance',
       slug = 'home-fragrance',
       name = 'Home Fragrances'
 where slug = 'room-fragrance';
