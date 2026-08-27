-- KHEM — checking a discount code before the order exists.
--
-- Applied by `npm run db:migrate` after `0028_discounts.sql`, whose
-- `resolve_discount()` body this re-declares. Nothing else in 0028 changes:
-- `place_order()` still calls this function by name and still gets, statement
-- for statement, the behaviour it had before.
--
-- ── The problem ─────────────────────────────────────────────
--
-- A customer must be told whether their code works *before* they pay. 0028
-- could not answer that: `resolve_discount()` reads the eligible lines through
-- `discount_eligible_subtotal(order_id, …)`, and at the moment the question is
-- asked there is no order — there is a bag in somebody's browser.
--
-- The tempting answer is to reimplement the rules in the application: the
-- window, both caps, the grant gate, the eligible-line rule, the rounding. That
-- is the drift 0028 was written to prevent, and it would put the checkout's
-- estimate and the charge on two separate implementations that agree only until
-- somebody edits one of them.
--
-- So the *bag* becomes describable two ways and the rules stay in one place.
-- `resolve_discount()` now accepts either:
--
--   'orderId'  — the order being written, as `place_order()` has always passed
--   'items'    — [{ slug, quantity }, …], a bag that does not exist yet
--
-- Every other line of the function is untouched, which is the point: there is
-- still exactly one definition of what a code is worth and who may use it.
--
-- ── Prices still come from rows ─────────────────────────────
--
-- An `items` entry carries a slug and a quantity and nothing else. A price in
-- that payload is not read, because `supabase/AGENTS.md` §12's "never calculate
-- final order prices on the client" is not satisfied by validating a number the
-- client sent — only by never asking it for one. Both the eligible subtotal and
-- the minimum-order subtotal are summed here from `"Product"`.
--
-- ── The lock ────────────────────────────────────────────────
--
-- 0028 takes `for update` on the discount row before counting, and that lock is
-- what makes the caps real: two checkouts racing for the last use serialise on
-- it. A *preview* must not hold a write lock on a popular code every time
-- somebody clicks Apply — it is answering a question, not consuming anything.
--
-- So the payload carries `lock`, defaulting to **true**. `place_order()` says
-- nothing and therefore keeps the lock. The preview passes false and reads
-- without one, which is correct precisely because its answer binds nothing: the
-- code is resolved again, under the lock, inside the transaction that writes
-- the order. A preview that went stale in the seconds before payment costs a
-- customer one refusal at the button; a preview that held a lock would cost
-- every other customer their checkout.
--
-- ── What this file does not add ─────────────────────────────
--
-- No table, no column, no policy, no grant. The preview reads what 0028 already
-- holds, through a function the public roles still cannot execute — the caller
-- is a Server Action holding the secret key, and it is rate-limited there.

-- ── discount_cart_subtotal ──────────────────────────────────
--
-- What a bag is worth, before any reduction. The counterpart of summing
-- `"OrderItem"` for an order that exists.
--
-- Quantities are clamped at zero and a slug that names no product contributes
-- nothing, so a malformed payload can only ever *understate* the bag — which
-- costs its sender a refusal for being under the minimum, never a discount they
-- were not entitled to.

create or replace function public.discount_cart_subtotal(items jsonb)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
           greatest(coalesce((item->>'quantity')::int, 0), 0) * p."priceInCents"
         ), 0)::int
    from jsonb_array_elements(coalesce(items, '[]'::jsonb)) as item
    join public."Product" p on p.slug = item->>'slug'
   where not p."isArchived";
$$;

-- ── discount_eligible_cart_subtotal ─────────────────────────
--
-- What a discount is allowed to come off, for a bag.
--
-- Deliberately the same three-branch rule as `discount_eligible_subtotal`,
-- written against `items` instead of `"OrderItem"`. The two are not one function
-- because the row sources genuinely differ — an order's lines carry a *price
-- snapshot*, a bag does not — but they must agree on the rule, and any change to
-- one is a change to both.

create or replace function public.discount_eligible_cart_subtotal(
  items       jsonb,
  discount_id text
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
           greatest(coalesce((item->>'quantity')::int, 0), 0) * p."priceInCents"
         ), 0)::int
    from jsonb_array_elements(coalesce(items, '[]'::jsonb)) as item
    join public."Product" p on p.slug = item->>'slug'
    join public.discounts d on d.id = discount_id
   where not p."isArchived"
     and (
       d."appliesTo" = 'ALL'
       or (
         d."appliesTo" = 'PRODUCTS'
         and exists (
           select 1 from public.discount_products dp
            where dp."discountId" = d.id and dp."productSlug" = p.slug
         )
       )
       or (
         d."appliesTo" = 'COLLECTIONS'
         and exists (
           select 1 from public.discount_collections dc
            where dc."discountId" = d.id
              and dc."collectionSlug" = p."collectionSlug"
         )
       )
     );
$$;

-- ── resolve_discount ────────────────────────────────────────
--
-- The 0028 body with three changes and no others:
--
--   1. `items` is accepted as an alternative to `orderId`;
--   2. when `items` is given, the subtotal is derived from it rather than read
--      from the payload — one fewer number anybody outside this file names;
--   3. the two `for update` reads become conditional on `lock`;
--   4. every refusal carries a `reasonCode` beside its sentence.
--
-- (4) is additive and `place_order()` never reads it. It exists because the
-- storefront is bilingual and the sentences are English: `src/actions/checkout.ts`
-- says outright that a checkout guessing at the shape of an error string shows
-- the wrong one, so the code is what the client translates and the sentence is
-- the fallback for one this build has not seen. Both keep coming from here,
-- which is what stops the two drifting.
--
-- Same return shape otherwise, same refusal sentences. The reasons are written for the
-- customer and are shown to them verbatim, at the field now as well as at the
-- button.

create or replace function public.resolve_discount(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code     text := upper(btrim(coalesce(payload->>'code', '')));
  v_order_id text := payload->>'orderId';
  v_items    jsonb := case
                        when jsonb_typeof(payload->'items') = 'array'
                        then payload->'items'
                        else null
                      end;
  -- Defaults to true, so `place_order()`'s existing call keeps the lock that
  -- makes the caps real.
  v_lock     boolean := coalesce((payload->>'lock')::boolean, true);
  v_email    text := lower(nullif(payload->>'email', ''));
  v_user     text := nullif(payload->>'clerkUserId', '');
  v_subtotal int;
  v_d        record;
  v_grant    record;
  v_eligible int;
  v_used     int;
  v_amount   int;
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'reason', 'No code was given.', 'reasonCode', 'NO_CODE');
  end if;

  -- A bag is priced from rows; an order's subtotal still arrives from
  -- `place_order()`, which summed it from rows it had already locked.
  if v_items is not null then
    v_subtotal := public.discount_cart_subtotal(v_items);
  else
    v_subtotal := coalesce((payload->>'subtotalInCents')::int, 0);
  end if;

  if v_lock then
    select * into v_d from public.discounts where code = v_code for update;
  else
    select * into v_d from public.discounts where code = v_code;
  end if;

  -- An unknown code and an inactive one are told apart, because an editor
  -- testing a code they just deactivated needs to know which it was. Both are
  -- refusals either way.
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That code is not recognised.', 'reasonCode', 'NOT_RECOGNISED');
  end if;

  if not v_d."isActive" then
    return jsonb_build_object('ok', false, 'reason', 'That code is no longer active.', 'reasonCode', 'INACTIVE');
  end if;

  if v_d."startsAt" is not null and v_d."startsAt" > now() then
    return jsonb_build_object('ok', false, 'reason', 'That code is not available yet.', 'reasonCode', 'NOT_STARTED');
  end if;

  if v_d."endsAt" is not null and v_d."endsAt" <= now() then
    return jsonb_build_object('ok', false, 'reason', 'That code has expired.', 'reasonCode', 'EXPIRED');
  end if;

  -- Judged on the subtotal before any reduction. See the 0028 header.
  if v_subtotal < v_d."minimumOrderInCents" then
    return jsonb_build_object(
      'ok', false,
      'reason', 'That code needs a larger order.',
      'reasonCode', 'BELOW_MINIMUM'
    );
  end if;

  -- ── The grant gate ──────────────────────────────────────
  --
  -- For a code whose string is shared but whose entitlement is not. Without
  -- this, `WELCOME10` would work for anybody who ever saw it.
  if v_d."requiresGrant" then
    if v_email is null then
      return jsonb_build_object('ok', false, 'reason', 'That code is not available on this order.', 'reasonCode', 'NOT_GRANTED');
    end if;

    if v_lock then
      select * into v_grant
        from public.discount_grants g
       where g."discountId" = v_d.id and g.email = v_email
         for update;
    else
      select * into v_grant
        from public.discount_grants g
       where g."discountId" = v_d.id and g.email = v_email;
    end if;

    if not found then
      return jsonb_build_object('ok', false, 'reason', 'That code is not available on this order.', 'reasonCode', 'NOT_GRANTED');
    end if;

    if v_grant."usedAt" is not null then
      return jsonb_build_object('ok', false, 'reason', 'That code has already been used.', 'reasonCode', 'ALREADY_USED');
    end if;

    if v_grant."expiresAt" is not null and v_grant."expiresAt" <= now() then
      return jsonb_build_object('ok', false, 'reason', 'That code has expired.', 'reasonCode', 'EXPIRED');
    end if;
  end if;

  -- ── The caps, counted from the ledger ───────────────────

  if v_d."totalUseLimit" is not null then
    select count(*) into v_used
      from public.discount_redemptions r
     where r."discountId" = v_d.id and r."releasedAt" is null;

    if v_used >= v_d."totalUseLimit" then
      return jsonb_build_object('ok', false, 'reason', 'That code has been fully redeemed.', 'reasonCode', 'FULLY_REDEEMED');
    end if;
  end if;

  if v_d."perCustomerLimit" is not null then
    -- Identity is the Clerk id when there is one and the email otherwise, so a
    -- guest cannot reset their own count by not signing in.
    select count(*) into v_used
      from public.discount_redemptions r
     where r."discountId" = v_d.id
       and r."releasedAt" is null
       and (
         (v_user is not null and r."clerkUserId" = v_user)
         or (v_user is null and v_email is not null and r.email = v_email)
       );

    if v_used >= v_d."perCustomerLimit" then
      return jsonb_build_object('ok', false, 'reason', 'You have already used that code.', 'reasonCode', 'CUSTOMER_LIMIT');
    end if;
  end if;

  -- ── The amount ──────────────────────────────────────────

  if v_items is not null then
    v_eligible := public.discount_eligible_cart_subtotal(v_items, v_d.id);
  else
    v_eligible := public.discount_eligible_subtotal(v_order_id, v_d.id);
  end if;

  if v_eligible <= 0 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'That code does not apply to anything in your bag.',
      'reasonCode', 'NOTHING_ELIGIBLE'
    );
  end if;

  if v_d.kind = 'PERCENTAGE' then
    -- Rounded down, so the house never gives away a piastre it did not mean to.
    v_amount := (v_eligible * v_d.value) / 100;
  else
    -- Capped at what it may come off, so an order can never go negative.
    v_amount := least(v_d.value, v_eligible);
  end if;

  if v_amount <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'That code takes nothing off this order.', 'reasonCode', 'ZERO_AMOUNT');
  end if;

  return jsonb_build_object(
    'ok', true,
    'discountId', v_d.id,
    'code', v_d.code,
    'amountInCents', v_amount
  );
end;
$$;

-- ── Privileges ──────────────────────────────────────────────
--
-- Same posture as everything in 0028: nothing here is reachable without
-- SUPABASE_SECRET_KEY. The preview is a Server Action, throttled there.

revoke all on function public.discount_cart_subtotal(jsonb)
  from public, anon, authenticated;
revoke all on function public.discount_eligible_cart_subtotal(jsonb, text)
  from public, anon, authenticated;
revoke all on function public.resolve_discount(jsonb)
  from public, anon, authenticated;
