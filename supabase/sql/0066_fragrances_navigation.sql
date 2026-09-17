-- KHEM — expose the complete fragrance catalogue from the database-backed menu.
--
-- The `/collections/fragrances` category route already exists. This only adds
-- its missing child link beneath the existing Fragrances disclosure.

insert into public."NavLink"
  (id, column_key, "parentId", "targetType", "categorySlug", "collectionSlug",
   "pageKey", "groupKey", label, label_ar, "desc", desc_ar,
   "showInNav", "showInFooter", "isEnabled", "sortOrder")
values
  ('nav-fragrances-all', 'COLLECTIONS', 'nav-fragrances', 'CATEGORY', 'fragrances',
   null, null, null, 'All Fragrances', 'كل العطور',
   'The complete KHEM fragrance collection', 'مجموعة عطور كيم الكاملة',
   true, true, true, 0)
on conflict (id) do update set
  "parentId" = excluded."parentId",
  "targetType" = excluded."targetType",
  "categorySlug" = excluded."categorySlug",
  label = excluded.label,
  label_ar = excluded.label_ar,
  "desc" = excluded."desc",
  desc_ar = excluded.desc_ar,
  "showInNav" = excluded."showInNav",
  "showInFooter" = excluded."showInFooter",
  "isEnabled" = excluded."isEnabled",
  "sortOrder" = excluded."sortOrder";