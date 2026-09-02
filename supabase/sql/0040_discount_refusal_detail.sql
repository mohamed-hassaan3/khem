-- KHEM — telling a customer *why* a real code will not apply.
--
-- Applied by `npm run db:migrate` after `0029_discount_preview.sql`, whose
-- `resolve_discount()` body this re-declares, and after `0028_discounts.sql`,
-- whose `place_order()` body it re-declares. No table, column, policy or grant
-- is added: this file changes what a refusal *says*, never what it decides.
--
-- ── The problem ─────────────────────────────────────────────
--
-- 0029 gave every refusal a `reasonCode`, which is what let the bilingual
-- storefront stop showing English. It did not give the refusal any *specifics*.
-- So a code that is perfectly valid but limited to one collection refuses with
-- "That code does not apply to anything in your bag", and a code that needs a
-- larger order refuses without ever naming the figure — and the customer, who
-- can act on neither sentence, reasonably concludes the code is broken.
--
-- ── What is added ───────────────────────────────────────────
--
-- An optional `detail` object beside the `reason` and the `reasonCode`, on two
-- refusals only:
--
--   BELOW_MINIMUM    { minimumInCents }
--   NOTHING_ELIGIBLE { scope, names: [{ name, nameAr }, … ≤3], more }
--
-- The client renders a fuller sentence when it is present and the existing
-- generic one when it is not — which is also what makes deploying the
-- application ahead of this migration harmless.
--
-- ── Only for a code whose terms are public ──────────────────
--
-- `detail` is attached only when `not "requiresGrant"`. A grant-gated code —
-- the welcome offer, an invitation — has a shared string and a private
-- entitlement, and naming its minimum or its collections to whoever holds the
-- string would publish the campaign. `v_public` below is the single place that
-- rule lives; nothing in TypeScript re-checks it, so the two cannot drift.
--
-- ── Everything else is verbatim ─────────────────────────────
--
-- Both bodies are copied statement for statement from the files named above.
-- That is the same discipline 0029 followed and for the same reason: there is
-- still exactly one definition of what a code is worth and who may use it, and
-- a second one written in a hurry is the failure `0028`'s header exists to
-- prevent. Read a diff of this file against 0028/0029 before editing it.
--
-- ── The raise carries its code now ──────────────────────────
--
-- `place_order()` refuses a bad code with the English sentence and nothing
-- else, so the message beneath the payment button was English on the Arabic
-- tree while the identical refusal at the field was translated. The one changed
-- statement puts `DISCOUNT:<reasonCode>` in the exception's `hint`, which
-- PostgREST surfaces to the caller — so `src/actions/checkout.ts` can look the
-- code up instead of parsing a sentence, which its own header rules out.

-- ── resolve_discount ────────────────────────────────────────
--
-- The 0029 body plus `v_public`, `v_detail`, and the two refusals that now
-- carry detail. No other statement differs.

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
  -- Added by 0040. `v_public` is the disclosure gate; `v_detail` is null for
  -- every refusal that has nothing safe and specific to add.
  v_public   boolean;
  v_detail   jsonb;
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

  -- Whether this code's terms may be named to whoever holds its string.
  v_public := not v_d."requiresGrant";

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
    return jsonb_strip_nulls(jsonb_build_object(
      'ok', false,
      'reason', 'That code needs a larger order.',
      'reasonCode', 'BELOW_MINIMUM',
      'detail', case
                  when v_public
                  then jsonb_build_object('minimumInCents', v_d."minimumOrderInCents")
                  else null
                end
    ));
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
    /*
     * The one refusal a customer most often reads as "this code is fake": the
     * code is real, it is in date, it is within both caps, and it simply covers
     * nothing they are buying. Naming what it covers is the difference between
     * an apology and an instruction.
     *
     * Three sets and a count of the rest — a refusal that recites nine
     * collections has stopped being a message. Ordered by the curated
     * `"sortOrder"` for collections and by name for products, so the same
     * refusal reads the same way twice.
     */
    v_detail := null;

    if v_public and v_d."appliesTo" = 'COLLECTIONS' then
      with eligible as (
        select c.name, c.name_ar, c."sortOrder"
          from public.discount_collections dc
          join public."Collection" c on c.slug = dc."collectionSlug"
         where dc."discountId" = v_d.id
      ),
      named as (
        select * from eligible order by "sortOrder", name limit 3
      )
      select jsonb_build_object(
               'scope', 'COLLECTIONS',
               'names', coalesce(
                          (select jsonb_agg(
                                    jsonb_build_object('name', n.name, 'nameAr', n.name_ar)
                                  )
                             from named n),
                          '[]'::jsonb
                        ),
               'more', greatest((select count(*) from eligible) - 3, 0)
             )
        into v_detail;
    elsif v_public and v_d."appliesTo" = 'PRODUCTS' then
      -- No `nameAr`: a fragrance name is a proper noun and stays in Latin
      -- script on `/ar`. See `supabase/sql/0008_i18n_content.sql`.
      with eligible as (
        select p.name
          from public.discount_products dp
          join public."Product" p on p.slug = dp."productSlug"
         where dp."discountId" = v_d.id
           and not p."isArchived"
      ),
      named as (
        select * from eligible order by name limit 3
      )
      select jsonb_build_object(
               'scope', 'PRODUCTS',
               'names', coalesce(
                          (select jsonb_agg(jsonb_build_object('name', n.name)) from named n),
                          '[]'::jsonb
                        ),
               'more', greatest((select count(*) from eligible) - 3, 0)
             )
        into v_detail;
    end if;

    return jsonb_strip_nulls(jsonb_build_object(
      'ok', false,
      'reason', 'That code does not apply to anything in your bag.',
      'reasonCode', 'NOTHING_ELIGIBLE',
      'detail', v_detail
    ));
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

-- ── place_order ─────────────────────────────────────────────
--
-- The 0028 body with **one** statement changed: the discount refusal now raises
-- with `hint = 'DISCOUNT:<reasonCode>'` beside the customer-facing sentence.
-- Everything else — the stock loop, the credit block, the redemption ledger,
-- the totals — is copied verbatim and must stay that way.

create or replace function public.place_order(payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id   text;
  v_number     text;
  v_subtotal   int := 0;
  v_ship       int := coalesce((payload->>'shipInCents')::int, 0);
  v_channel    public."OrderChannel" :=
                 coalesce((payload->>'channel')::public."OrderChannel", 'OFFLINE');
  v_method     public."PaymentMethod" :=
                 coalesce((payload->>'paymentMethod')::public."PaymentMethod", 'CASH');
  v_locale     text := coalesce(nullif(payload->>'locale', ''), 'en');
  v_item       jsonb;
  v_slug       text;
  v_qty        int;
  v_product    record;
  v_credit_id  text := nullif(payload->>'creditId', '');
  v_owner      text := nullif(payload->>'clerkUserId', '');
  v_credit     record;
  v_applied    int := 0;
  v_eligible   int := 0;
  -- Discounts, added by 0028.
  v_code       text := upper(btrim(coalesce(payload->>'discountCode', '')));
  v_discount   jsonb;
  v_disc_id    text;
  v_disc_code  text;
  v_disc_amt   int := 0;
  v_email      text := lower(nullif(payload->>'customerEmail', ''));
begin
  if jsonb_typeof(payload->'items') <> 'array'
     or jsonb_array_length(payload->'items') = 0 then
    raise exception 'An order needs at least one line.'
      using errcode = 'check_violation';
  end if;

  if v_locale not in ('en', 'ar') then
    v_locale := 'en';
  end if;

  insert into public."Order" (
    "customerName", "customerEmail", "customerPhone", "clerkUserId",
    note, channel, "paymentMethod", locale,
    "shipLine1", "shipLine2", "shipCity", "shipState", "shipPostalCode", "shipCountry",
    "subtotalInCents", "shipInCents", "totalInCents"
  ) values (
    payload->>'customerName',
    nullif(payload->>'customerEmail', ''),
    nullif(payload->>'customerPhone', ''),
    nullif(payload->>'clerkUserId', ''),
    nullif(payload->>'note', ''),
    v_channel,
    v_method,
    v_locale,
    nullif(payload->>'shipLine1', ''),
    nullif(payload->>'shipLine2', ''),
    nullif(payload->>'shipCity', ''),
    nullif(payload->>'shipState', ''),
    nullif(payload->>'shipPostalCode', ''),
    nullif(payload->>'shipCountry', ''),
    0, v_ship, 0
  )
  returning id, "orderNumber" into v_order_id, v_number;

  insert into public."OrderStatusEvent" ("orderId", status)
  values (v_order_id, 'PENDING');

  for v_item in
    select value
    from jsonb_array_elements(payload->'items')
    order by value->>'slug'
  loop
    v_slug := v_item->>'slug';
    v_qty  := (v_item->>'quantity')::int;

    if v_qty is null or v_qty < 1 then
      raise exception 'Quantity must be at least 1.'
        using errcode = 'check_violation';
    end if;

    select slug, name, "priceInCents", inventory, "isArchived"
      into v_product
      from public."Product"
     where slug = v_slug
     for update;

    if not found then
      raise exception 'No product with the slug %.', v_slug
        using errcode = 'foreign_key_violation';
    end if;

    if v_product."isArchived" then
      raise exception '% is archived and cannot be sold.', v_product.name
        using errcode = 'check_violation';
    end if;

    if v_product.inventory < v_qty then
      raise exception '% has only % in stock.', v_product.name, v_product.inventory
        using errcode = 'check_violation';
    end if;

    insert into public."OrderItem" (
      "orderId", "productSlug", "productName", quantity, "priceInCents"
    ) values (
      v_order_id, v_product.slug, v_product.name, v_qty, v_product."priceInCents"
    );

    update public."Product"
       set inventory = inventory - v_qty,
           "updatedAt" = now()
     where slug = v_product.slug;

    v_subtotal := v_subtotal + (v_qty * v_product."priceInCents");
  end loop;

  -- ── Discount ──────────────────────────────────────────────
  --
  -- After the loop, because the eligible-line rule reads the order's items and
  -- the minimum needs the subtotal. `resolve_discount()` holds the lock that
  -- makes the caps real for the rest of this transaction.

  if v_code <> '' then
    v_discount := public.resolve_discount(jsonb_build_object(
      'code', v_code,
      'orderId', v_order_id,
      'email', v_email,
      'clerkUserId', v_owner,
      'subtotalInCents', v_subtotal
    ));

    if not coalesce((v_discount->>'ok')::boolean, false) then
      /*
       * The reason is written for the customer; the caller passes it through.
       * 0040 sends the reason *code* alongside it in `hint`, so a bilingual
       * caller can show the same translated sentence the code field shows
       * rather than this English one.
       */
      raise exception '%', coalesce(v_discount->>'reason', 'That code cannot be used.')
        using errcode = 'check_violation',
              hint = 'DISCOUNT:' || coalesce(v_discount->>'reasonCode', 'UNKNOWN');
    end if;

    v_disc_id   := v_discount->>'discountId';
    v_disc_code := v_discount->>'code';
    v_disc_amt  := (v_discount->>'amountInCents')::int;

    insert into public.discount_redemptions
      ("discountId", "orderId", email, "clerkUserId", "amountInCents")
    values (v_disc_id, v_order_id, v_email, v_owner, v_disc_amt);

    -- Consume the grant, if this code is gated by one.
    update public.discount_grants
       set "usedAt" = now(),
           "usedOrderId" = v_order_id
     where "discountId" = v_disc_id
       and email = v_email
       and "usedAt" is null;
  end if;

  -- ── Redemption ────────────────────────────────────────────

  if v_credit_id is not null then
    if v_owner is null then
      raise exception 'A Discovery Credit belongs to an account. Sign in to use it.'
        using errcode = 'check_violation';
    end if;

    perform 1
      from public.customer_credits c
     where c.id = v_credit_id
       for update;

    if not found then
      raise exception 'That credit does not exist.'
        using errcode = 'foreign_key_violation';
    end if;

    select b."clerkUserId", b.status, b."balanceInCents"
      into v_credit
      from public.credit_balances b
     where b.id = v_credit_id;

    if v_credit."clerkUserId" is distinct from v_owner then
      raise exception 'That credit belongs to another account.'
        using errcode = 'check_violation';
    end if;

    if v_credit.status = 'PENDING_DELIVERY' then
      raise exception 'That credit becomes available when your Discovery Set is delivered.'
        using errcode = 'check_violation';
    end if;

    if v_credit.status = 'EXPIRED' then
      raise exception 'That credit has passed its sixty-day window.'
        using errcode = 'check_violation';
    end if;

    if v_credit.status = 'CANCELLED' then
      raise exception 'That credit was cancelled when its Discovery Set was refunded.'
        using errcode = 'check_violation';
    end if;

    if v_credit.status <> 'AVAILABLE' or v_credit."balanceInCents" <= 0 then
      raise exception 'That credit has already been used.'
        using errcode = 'check_violation';
    end if;

    select count(*)
      into v_eligible
      from public."OrderItem" i
      join public."Product" p on p.slug = i."productSlug"
      join public."Collection" col on col.slug = p."collectionSlug"
     where i."orderId" = v_order_id
       and col.kind = 'FRAGRANCE';

    if v_eligible = 0 then
      raise exception 'A Discovery Credit pays for a full-size fragrance. Add one to your bag.'
        using errcode = 'check_violation';
    end if;

    /*
     * Policy 4, now a real check. 0027 could only look for an amount the client
     * claimed; this reads a discount the server resolved a few statements ago.
     */
    if v_disc_id is not null then
      raise exception 'A Discovery Credit cannot be combined with a promotional discount.'
        using errcode = 'check_violation';
    end if;

    -- Against what is left after any discount, so the two can never together
    -- take off more than the merchandise is worth.
    v_applied := least(v_credit."balanceInCents", v_subtotal - v_disc_amt);

    insert into public.credit_transactions
      ("creditId", kind, "amountInCents", "orderId", note)
    values (
      v_credit_id,
      'USED',
      -v_credit."balanceInCents",
      v_order_id,
      'Redeemed against ' || v_number
    );
  end if;

  update public."Order"
     set "subtotalInCents"      = v_subtotal,
         "creditId"             = v_credit_id,
         "creditAppliedInCents" = v_applied,
         "discountId"           = v_disc_id,
         "discountCode"         = v_disc_code,
         "discountInCents"      = v_disc_amt,
         "totalInCents"         = v_subtotal + v_ship - v_disc_amt - v_applied,
         "updatedAt"            = now()
   where id = v_order_id;

  return v_number;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────
--
-- Same posture as 0028 and 0029: nothing here is reachable without
-- SUPABASE_SECRET_KEY. `create or replace` keeps the existing grants, so these
-- are restated rather than newly required — and restating them is how the file
-- stays readable as the whole story of what it changed.

revoke all on function public.resolve_discount(jsonb) from public, anon, authenticated;
revoke all on function public.place_order(jsonb)      from public, anon, authenticated;
