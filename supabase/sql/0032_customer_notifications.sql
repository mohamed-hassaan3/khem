-- KHEM — what the house has to tell one customer, and what they let it send.
--
-- Applied by `npm run db:migrate` after `0031_admin_notifications.sql`. It reads
-- `"OrderStatusEvent"` (0017), `"User"` (0024), `customer_credits` (0026) and
-- `discount_grants` (0028), and writes read-state and one consent flag.
--
-- ── The feed is derived, exactly as the desk's is ───────────
--
-- 0031 argued this for the dashboard and it holds identically here: an order
-- reaching SHIPPED is already recorded by `"OrderStatusEvent"`, and a
-- notification row saying so would be a second record of one fact. So the feed
-- is a query, and `customer_notification_reads` holds nothing but which
-- (owner, kind, entity) somebody has dismissed.
--
-- The difference from 0031 is the owner. The desk's feed is the house's, seen by
-- whoever is at it; this one belongs to one person, so **every row is filtered
-- by `clerkUserId` inside the function** rather than by whoever calls it.
--
-- ── One notification per station, not per order ─────────────
--
-- An order that reaches PROCESSING, then SHIPPED, then DELIVERED produces three.
-- The alternative — one row per order, rewritten as it moves — would show a
-- customer that their parcel is delivered and erase the fact they were ever told
-- it had shipped. `"OrderStatusEvent"` exists precisely so that history is kept,
-- and PENDING is skipped because "your order was placed" is what the
-- confirmation email already said.
--
-- ── Consent lives in three places, and this keeps two honest ─
--
-- The customer's choice is held by Clerk (`unsafeMetadata.marketingOptIn`),
-- because that is what sign-up writes and what the webhook reads.
-- `"User"."marketingOptIn"` and `"NewsletterSubscriber"` are mirrors of it.
-- `set_marketing_opt_in()` below is how the first mirror is moved without
-- restating 0024's rule at the call site: **`marketingOptInAt` moves only when
-- the value actually changes**, so re-saving an unchanged preference does not
-- rewrite the date consent was given.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Unchanged: RLS on, no policy, nothing granted to the public roles, `execute`
-- revoked. The callers hold `SUPABASE_SECRET_KEY` and pass an owner that came
-- from a verified Clerk session — never from a route param or a form field.

-- ── customer_notification_reads ─────────────────────────────

create table if not exists public.customer_notification_reads (
  -- The owner. No foreign key, for the reason 0026 gives about `"Order"`:
  -- identity is Clerk's, and a read row must not depend on a webhook having
  -- already created the mirror row in `"User"`.
  "clerkUserId" text not null,

  -- Matches `CustomerNotificationKind` in `src/types/notification.ts`.
  kind          text not null check (char_length(kind) between 2 and 32),

  -- The event, credit or grant id. Compared, never rendered.
  "entityId"    text not null check (char_length("entityId") <= 128),

  "readAt"      timestamptz not null default now(),

  primary key ("clerkUserId", kind, "entityId")
);

-- ── customer_notification_feed ──────────────────────────────
--
-- One customer's own notifications, newest first, each carrying whether they
-- have read it.
--
-- `owner` and `owner_email` are both taken because a voucher grant may predate
-- the account: `discount_grants` is keyed by address and back-fills the Clerk id
-- later, which is the same pairing `src/services/vouchers.ts` already handles.
-- Everything else is keyed by the Clerk id alone.

create or replace function public.customer_notification_feed(
  owner       text,
  owner_email text default null,
  max_items   int default 50
)
returns table (
  kind            text,
  "entityId"      text,
  label           text,
  detail          text,
  "amountInCents" int,
  "occurredAt"    timestamptz,
  "isRead"        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with owner_email_lc as (select lower(nullif(owner_email, '')) as email),
  items as (
    -- Where the parcel has got to. PENDING is omitted: the confirmation letter
    -- already said the order was placed, and repeating it here is noise.
    select
      'ORDER_STATUS'::text as kind,
      e.id                 as entity_id,
      o."orderNumber"      as label,
      e.status::text       as detail,
      null::int            as amount,
      e."occurredAt"       as occurred_at
      from public."OrderStatusEvent" e
      join public."Order" o on o.id = e."orderId"
     where o."clerkUserId" = owner
       and e.status <> 'PENDING'

    union all

    -- A Discovery Credit earned. Cancelled ones are not news.
    select
      'CREDIT_EARNED',
      c.id,
      coalesce(o."orderNumber", ''),
      null,
      c."amountInCents",
      c."earnedAt"
      from public.customer_credits c
      left join public."Order" o on o.id = c."sourceOrderId"
     where c."clerkUserId" = owner
       and c."cancelledAt" is null

    union all

    -- A privilege addressed to them. Matched by account *or* address, since a
    -- grant may have been issued before they ever registered.
    select
      'VOUCHER_GRANTED',
      g.id,
      d.code,
      null,
      null,
      g."issuedAt"
      from public.discount_grants g
      join public.discounts d on d.id = g."discountId"
     where g."clerkUserId" = owner
        or g.email = (select email from owner_email_lc)
  )
  select
    i.kind,
    i.entity_id,
    i.label,
    i.detail,
    i.amount,
    i.occurred_at,
    (r."clerkUserId" is not null) as is_read
    from items i
    left join public.customer_notification_reads r
           on r."clerkUserId" = owner
          and r.kind = i.kind
          and r."entityId" = i.entity_id
   order by i.occurred_at desc
   limit greatest(coalesce(max_items, 50), 1);
$$;

-- ── mark_customer_notifications_read ────────────────────────
--
-- The owner is a parameter and never comes from the payload: a caller may say
-- *what* was read, never *whose*.

create or replace function public.mark_customer_notifications_read(
  owner text,
  items jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marked int;
begin
  if owner is null or owner = '' or jsonb_typeof(items) <> 'array' then
    return 0;
  end if;

  with incoming as (
    select item->>'kind' as kind, item->>'entityId' as entity_id
      from jsonb_array_elements(coalesce(items, '[]'::jsonb)) as item
  ),
  inserted as (
    insert into public.customer_notification_reads ("clerkUserId", kind, "entityId")
    select owner, kind, entity_id
      from incoming
     where kind is not null and entity_id is not null
    -- The first dismissal is the one that happened; a second click must not
    -- move the timestamp.
    on conflict ("clerkUserId", kind, "entityId") do nothing
    returning 1
  )
  select count(*)::int into v_marked from inserted;

  return v_marked;
end;
$$;

-- ── set_marketing_opt_in ────────────────────────────────────
--
-- Moves the mirror in `"User"`, keeping 0024's rule where 0024 wrote it: the
-- consent *date* moves only when the value actually changes, so saving an
-- unchanged preference does not rewrite when consent was given.
--
-- Returns the row's state afterwards, so the caller can report the truth rather
-- than echoing what it asked for.

create or replace function public.set_marketing_opt_in(
  clerk_id text,
  opted_in boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  update public."User"
     set "marketingOptIn"   = opted_in,
         "marketingOptInAt" = case
                                when "marketingOptIn" is distinct from opted_in
                                then now()
                                else "marketingOptInAt"
                              end,
         "updatedAt"        = now()
   where "clerkId" = clerk_id
     and "deletedAt" is null
  returning email, "marketingOptIn" into v_row;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'email', v_row.email,
    'marketingOptIn', v_row."marketingOptIn"
  );
end;
$$;

-- ── Privileges ──────────────────────────────────────────────

alter table public.customer_notification_reads enable row level security;

revoke all on public.customer_notification_reads from public, anon, authenticated;

revoke all on function public.customer_notification_feed(text, text, int)
  from public, anon, authenticated;
revoke all on function public.mark_customer_notifications_read(text, jsonb)
  from public, anon, authenticated;
revoke all on function public.set_marketing_opt_in(text, boolean)
  from public, anon, authenticated;
