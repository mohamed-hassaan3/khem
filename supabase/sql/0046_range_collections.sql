-- KHEM — the ranges become categories, and their contents become collections.
-- Applied by `npm run db:migrate`, after `0045_category.sql`. Every statement is
-- idempotent.
--
-- ## What changes
--
-- Before this file, "Body Care" was a `"Collection"` row holding four body
-- mists, and "Body Mist" was `"Product"."productType" = 'BODY_MIST'` — a value
-- routed to a page by a hand-written table in `src/lib/product-types.ts`. The
-- hierarchy the brief asks for could not be expressed: Body Care and Body Mist
-- sat at two different *kinds* of level, and adding "Body Cream" meant an
-- `alter type` migration plus four code edits.
--
-- 0045 made Body Care a `"Category"`. This file makes Body Mist a
-- `"Collection"` beneath it. After both, the shape is uniform:
--
--     Category  body-care        →  Collection  body-mist       →  4 products
--     Category  home-fragrance   →  Collection  room-spray      →  4 products
--     Category  discovery        →  Collection  discovery-sets  →  3 products
--     Category  gift-set         →  Collection  gift-sets       →  3 products
--     Category  fragrances       →  Collections signature, gemstone, noir
--
-- and "Body Cream" is one row in the dashboard.
--
-- ## Why rename rather than create-and-delete
--
-- This file moves no product and deletes no row. Each range collection is
-- **renamed** into the collection it always was underneath — `body-care`
-- becomes `body-mist` — and `on update cascade` carries every referent with it
-- in the same statement: `"Product"."collectionSlug"`, `discount_collections`
-- (`0028`) and `promotion_collections` (`0035`).
--
-- That last pair is the reason. Both reference `"Collection"(slug)` with
-- `on delete cascade`, so deleting the Body Care row would have silently
-- deleted the targeting of any live discount or promotion aimed at it — a
-- campaign that keeps running against the wrong set of products, with nothing
-- in the logs to say so. A rename cannot lose them.
--
-- `0011_home_fragrance_slug.sql` renamed a collection slug this way already;
-- this is the same move, with the same reasoning about what may not move: the
-- *products'* slugs are untouched, because they are the ids the cart persists to
-- `localStorage` (`0001_catalog.sql`).
--
-- ## The URLs
--
-- `/collections/body-care` keeps answering — as the **category** page 0045
-- seeded at that slug, which lists the same products through the collections
-- beneath it. Same for `/collections/home-fragrance`, `/collections/discovery`
-- and `/collections/gift-set`, and so the four legacy 308s in `next.config.ts`
-- still land on live pages.
--
-- `/collections/body-mist` and `/collections/room-spray` also keep answering,
-- and are now real collections rather than code-routed product-type pages —
-- which is what lets `src/lib/product-types.ts` stop owning routes.
-- `/collections/discovery-sets` and `/collections/gift-sets` are new.
--
-- ## `"productType"` is kept
--
-- The column, its enum and `product_type_matches_kind()` all stay: they still
-- describe what an object *is*, they are still correct, and the trigger still
-- passes — a `BODY_MIST` now sits in the `body-mist` collection, whose `kind`
-- is copied down from the `body-care` category and is still `BODY`. What stops
-- is routing on it.

-- ── The four renames ──────────────────────────────────────────
--
-- Guarded on the *old* slug, so a second apply matches nothing. The name and
-- copy are rewritten in the same statement: a row called "Body Care" living at
-- `/collections/body-mist` would be the confusing half-state the brief's last
-- point is about.
--
-- The Body Mist and Room Spray wording is the copy those pages already carry in
-- `src/lib/i18n/dictionaries/{en,ar}.ts` under `collections.productTypes`, moved
-- into the row that now owns the page. Discovery and Gift Sets keep theirs.

update public."Collection"
   set id             = 'body-mist',
       slug           = 'body-mist',
       name           = 'Body Mist',
       name_ar        = 'بخّاخ الجسم',
       description    = 'The Gemstone accords, made to be worn closer and lighter. A fine mist for skin and hair that can be worn alone through the day or layered beneath the eau de parfum it shares its heart with.',
       description_ar = 'أنفاس مجموعة الأحجار الكريمة، أخفّ وأقرب إلى البشرة. رذاذ ناعم للجسم والشعر يُلبس وحده طوال اليوم، أو يُضاف تحت العطر الذي يشاركه قلبه.',
       "updatedAt"    = now()
 where slug = 'body-care';

update public."Collection"
   set id             = 'room-spray',
       slug           = 'room-spray',
       name           = 'Room Spray',
       name_ar        = 'بخّاخ الغرفة',
       description    = 'The same accords, given to a room instead of to skin. Five pumps into the air and it holds at head height for hours, without settling into anything heavy.',
       description_ar = 'الأنفاس نفسها، تُمنح للغرفة لا للبشرة. خمس بخّات في الهواء تبقى ساعات على ارتفاع النظر، دون أن تثقل.',
       "updatedAt"    = now()
 where slug = 'home-fragrance';

-- Discovery and Gift keep their name and copy: the category above them was
-- seeded *from* these rows, so the two read alike, and that is correct — a
-- category of one collection is the honest shape for a range the house sells as
-- a single shelf. Only the address moves, to free the old one for the category.

update public."Collection"
   set id          = 'discovery-sets',
       slug        = 'discovery-sets',
       "updatedAt" = now()
 where slug = 'discovery';

update public."Collection"
   set id          = 'gift-sets',
       slug        = 'gift-sets',
       "updatedAt" = now()
 where slug = 'gift-set';

-- ── Verification ──────────────────────────────────────────────
--
-- Raised rather than logged: a half-applied restructure that leaves a product
-- pointing at a collection that no longer exists is not something to discover
-- from a 404 later. `on update cascade` makes this unreachable — which is
-- exactly why it is cheap to assert.

do $$
declare
  v_orphans int;
begin
  select count(*) into v_orphans
    from public."Product" p
   where not exists (
     select 1 from public."Collection" c where c.slug = p."collectionSlug"
   );

  if v_orphans > 0 then
    raise exception '0046: % product(s) lost their collection.', v_orphans;
  end if;

  select count(*) into v_orphans
    from public."Collection" c
   where not exists (
     select 1 from public."Category" cat where cat.slug = c."categorySlug"
   );

  if v_orphans > 0 then
    raise exception '0046: % collection(s) lost their category.', v_orphans;
  end if;
end
$$;
