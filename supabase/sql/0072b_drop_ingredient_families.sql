-- IMPORTANT: Run only after the new code is deployed and verified.
-- This is stage 2 of the scent-profile membership change. It is deliberately
-- separate from 0072a so the app can be deployed and checked while both data
-- representations still exist.

do $$
begin
  if exists (
    select 1
      from pg_trigger t
     where not t.tgisinternal
       and t.tgfoid = 'public.assert_ingredient_families()'::regprocedure
       and not (t.tgrelid = 'public."Ingredient"'::regclass and t.tgname = 'ingredient_families_valid')
       and not (t.tgrelid = 'public."ScentProfile"'::regclass and t.tgname = 'scent_profile_families_valid')
  ) then
    raise exception '0072b: another trigger uses assert_ingredient_families(); inspect before continuing';
  end if;
end
$$;

drop trigger if exists ingredient_families_valid on public."Ingredient";
drop trigger if exists scent_profile_families_valid on public."ScentProfile";

do $$
begin
  if exists (
    select 1 from pg_trigger t
     where not t.tgisinternal
       and t.tgfoid = 'public.assert_ingredient_families()'::regprocedure
  ) then
    raise exception '0072b: assert_ingredient_families() is still used by a trigger';
  end if;
end
$$;

drop index if exists public.ingredient_families_idx;
drop index if exists public.scent_profile_families_idx;
drop function public.assert_ingredient_families();

alter table public."Ingredient" drop column if exists families;
alter table public."ScentProfile" drop column if exists families;

notify pgrst, 'reload schema';
