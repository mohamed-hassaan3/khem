-- KHEM — explicit scent-profile membership (stage 1 of 2).
-- Apply this file before deploying code that reads ScentProfileProduct.
-- It is additive and idempotent. Do not run 0072b until the new code is
-- deployed and verified; 0072b removes the legacy family columns.

create table if not exists public."ScentProfileProduct" (
  "profileSlug" text not null references public."ScentProfile"(slug) on delete cascade,
  "productSlug" text not null references public."Product"(slug) on delete cascade,
  "sortOrder" integer not null default 0,
  primary key ("profileSlug", "productSlug")
);

create index if not exists scent_profile_product_product_idx
  on public."ScentProfileProduct" ("productSlug");

alter table public."ScentProfileProduct" enable row level security;

drop policy if exists "Scent profile products are readable with products" on public."ScentProfileProduct";
create policy "Scent profile products are readable with products"
  on public."ScentProfileProduct" for select to anon, authenticated
  using (
    exists (
      select 1
        from public."Product" p
        join public."Collection" c on c.slug = p."collectionSlug"
       where p.slug = "ScentProfileProduct"."productSlug"
         and p."isArchived" = false
         and p."deletedAt" is null
         and c.kind not in ('DISCOVERY', 'GIFT')
         and (
           p."productType" in ('PERFUME', 'BODY_MIST', 'ROOM_SPRAY')
           or (p."productType" is null and c.kind in ('FRAGRANCE', 'BODY', 'HOME'))
         )
    )
  );

grant select on public."ScentProfileProduct" to anon, authenticated;
grant all on public."ScentProfileProduct" to service_role;

-- Preserve the current family-derived assignments as the initial explicit set.
-- Product order is deterministic within each profile and ties by slug.
insert into public."ScentProfileProduct" ("profileSlug", "productSlug", "sortOrder")
select ranked."profileSlug", ranked."productSlug", ranked.position - 1
  from (
    select sp.slug as "profileSlug",
           u."productSlug",
           row_number() over (
             partition by sp.slug
             order by p."sortOrder", p.name, p.slug
           ) as position
      from public."ScentProfile" sp
      join public."Ingredient" i on i.families && sp.families
      join public."IngredientUsage" u on u."ingredientId" = i.id
      join public."Product" p on p.slug = u."productSlug"
      join public."Collection" c on c.slug = p."collectionSlug"
     where c.kind not in ('DISCOVERY', 'GIFT')
       and (
         p."productType" in ('PERFUME', 'BODY_MIST', 'ROOM_SPRAY')
         or (p."productType" is null and c.kind in ('FRAGRANCE', 'BODY', 'HOME'))
       )
     group by sp.slug, u."productSlug", p."sortOrder", p.name, p.slug
  ) ranked
on conflict ("profileSlug", "productSlug") do nothing;

-- Verification: the two counts should match for each profile after the insert.
-- Derived legacy count (the expected value):
-- select sp.slug, count(distinct u."productSlug") as derived_count
--   from public."ScentProfile" sp
--   join public."Ingredient" i on i.families && sp.families
--   join public."IngredientUsage" u on u."ingredientId" = i.id
--   join public."Product" p on p.slug = u."productSlug"
--   join public."Collection" c on c.slug = p."collectionSlug"
--  where c.kind not in ('DISCOVERY', 'GIFT')
--    and (p."productType" in ('PERFUME', 'BODY_MIST', 'ROOM_SPRAY')
--      or (p."productType" is null and c.kind in ('FRAGRANCE', 'BODY', 'HOME')))
--  group by sp.slug order by sp.slug;
-- Stored explicit count (the actual value):
-- select "profileSlug", count(*) as stored_count
--   from public."ScentProfileProduct" group by "profileSlug" order by "profileSlug";

do $$
begin
  if exists (select 1 from public."Category" where slug = 'scent-families')
     or exists (select 1 from public."Collection" where slug = 'scent-families') then
    raise exception '0072a: resolve the existing scent-families category or collection before reserving this slug';
  end if;
end
$$;

create or replace function public.slug_is_reserved(v_slug text)
returns boolean
language sql
immutable
as $$
  select v_slug in ('best-sellers', 'oriental', 'floral', 'fresh', 'woody', 'gourmand', 'scent-families');
$$;

notify pgrst, 'reload schema';
