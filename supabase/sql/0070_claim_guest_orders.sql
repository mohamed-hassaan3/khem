-- Link guest online orders after Clerk has verified the account's primary email.
--
-- The application calls this only from the signed Clerk webhook and
-- authenticated server-rendered account pages, after explicitly checking
-- Clerk's primary-email verification status. This function is an atomic,
-- idempotent ownership update; NULL ownership is part of the UPDATE predicate
-- so a retry or race can never replace an existing owner.
--
-- SECURITY INVOKER is deliberate: the caller must be service_role, which is
-- already the server-only key used for private order writes. Do not grant this
-- function to anon or authenticated.

create or replace function public.claim_guest_orders(
  p_clerk_user_id text,
  p_verified_email text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_verified_email));
  v_claimed integer;
begin
  if nullif(btrim(p_clerk_user_id), '') is null or nullif(v_email, '') is null then
    return 0;
  end if;

  update public."Order"
     set "clerkUserId" = btrim(p_clerk_user_id),
         "updatedAt" = pg_catalog.now()
   where "clerkUserId" is null
     and channel = 'ONLINE'
     and lower(btrim("customerEmail")) = v_email;

  get diagnostics v_claimed = row_count;
  return v_claimed;
end;
$$;

revoke all on function public.claim_guest_orders(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_guest_orders(text, text) to service_role;
