-- KHEM — additive stock movements and atomic product opening balances.
-- Apply manually in the Supabase SQL Editor. This migration replaces functions
-- only; it does not update existing products or inventory history.

create or replace function public.add_stock_movement(
  p_slug text,
  p_channel public."OrderChannel",
  p_quantity integer,
  p_reason text default null,
  p_actor text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous integer;
  v_new integer;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Stock additions must be a positive whole number.'
      using errcode = 'check_violation';
  end if;

  if p_channel = 'ONLINE' then
    update public."Product"
       set "inventoryOnline" = "inventoryOnline" + p_quantity,
           "updatedAt" = now()
     where slug = p_slug
     returning "inventoryOnline" - p_quantity, "inventoryOnline"
          into v_previous, v_new;
  else
    update public."Product"
       set "inventoryOffline" = "inventoryOffline" + p_quantity,
           "updatedAt" = now()
     where slug = p_slug
     returning "inventoryOffline" - p_quantity, "inventoryOffline"
          into v_previous, v_new;
  end if;

  if not found then
    raise exception 'No product with the slug %.', p_slug
      using errcode = 'foreign_key_violation';
  end if;

  insert into public."InventoryMovement" (
    "productSlug", channel, action, quantity,
    "previousQuantity", "newQuantity", reason, actor
  ) values (
    p_slug, p_channel, 'RECEIPT', p_quantity,
    v_previous, v_new, p_reason, p_actor
  );

  return v_new;
end;
$$;

-- Create the product at zero in both channels, then call the exact movement
-- function used by inventory restocks. Any error rolls back all three writes.
create or replace function public.create_product_with_initial_stock(
  p_product jsonb,
  p_initial_online integer,
  p_initial_offline integer,
  p_actor text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_online integer := coalesce(p_initial_online, 0);
  v_offline integer := coalesce(p_initial_offline, 0);
begin
  if v_online < 0 or v_offline < 0 then
    raise exception 'Initial stock cannot be negative.'
      using errcode = 'check_violation';
  end if;

  v_slug := p_product->>'slug';
  if v_slug is null or length(v_slug) = 0 then
    raise exception 'A product slug is required.'
      using errcode = 'check_violation';
  end if;

  insert into public."Product" (
    id, slug, name, subtitle, description, description_ar, story, story_ar,
    concentration, format, includes, badge, tags,
    "topNotes", "heartNotes", "baseNotes", "productType", "volumeMl",
    "priceInCents", "costInCents", sku, inventory, "inventoryOnline",
    "inventoryOffline", "isBestseller", "collectionSlug", "sortOrder"
  ) values (
    coalesce(p_product->>'id', v_slug),
    v_slug,
    p_product->>'name',
    nullif(p_product->>'subtitle', ''),
    p_product->>'description',
    nullif(p_product->>'description_ar', ''),
    nullif(p_product->>'story', ''),
    nullif(p_product->>'story_ar', ''),
    nullif(p_product->>'concentration', '')::public."Concentration",
    nullif(p_product->>'format', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'includes', '[]'::jsonb))), '{}'),
    nullif(p_product->>'badge', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'tags', '[]'::jsonb))::public."ProductTag"), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'topNotes', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'heartNotes', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_product->'baseNotes', '[]'::jsonb))), '{}'),
    nullif(p_product->>'productType', '')::public."ProductType",
    nullif(p_product->>'volumeMl', '')::integer,
    (p_product->>'priceInCents')::integer,
    nullif(p_product->>'costInCents', '')::integer,
    p_product->>'sku',
    0, 0, 0,
    coalesce((p_product->>'isBestseller')::boolean, false),
    p_product->>'collectionSlug',
    coalesce(nullif(p_product->>'sortOrder', '')::integer, 0)
  );

  if v_online > 0 then
    perform public.add_stock_movement(v_slug, 'ONLINE', v_online, 'initial stock', p_actor);
  end if;
  if v_offline > 0 then
    perform public.add_stock_movement(v_slug, 'OFFLINE', v_offline, 'initial stock', p_actor);
  end if;

  return v_slug;
end;
$$;

revoke all on function public.add_stock_movement(text, public."OrderChannel", integer, text, text)
  from public, anon, authenticated;
revoke all on function public.create_product_with_initial_stock(jsonb, integer, integer, text)
  from public, anon, authenticated;

grant execute on function public.add_stock_movement(text, public."OrderChannel", integer, text, text)
  to service_role;
grant execute on function public.create_product_with_initial_stock(jsonb, integer, integer, text)
  to service_role;

notify pgrst, 'reload schema';
