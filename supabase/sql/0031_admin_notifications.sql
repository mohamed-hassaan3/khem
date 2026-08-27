-- KHEM — the desk's notification centre.
--
-- Applied by `npm run db:migrate` after `0030_welcome.sql`. It reads `"Order"`
-- (0015, 0023), `"User"` (0024), `customer_credits` (0026) and
-- `discount_redemptions` (0028), and writes nothing but read-state.
--
-- ── There is no notifications table, and that is the design ─
--
-- The tempting shape is a `notifications` row written whenever something
-- happens. This repository argues against that shape twice already — `0026`
-- ("a counter and a list of uses are two records of one fact") and `0028`
-- ("a ledger, not a counter") — and a notification row per order would be a
-- third instance of exactly it: `"Order"` already records that the order
-- exists, when it arrived, and what it was worth.
--
-- So the **feed is derived** and only the *read* state is stored. An order that
-- is cancelled stops being a notification because the query stops returning it,
-- not because somebody remembered to delete a row.
--
-- ── Read-state, and the one shortcut ────────────────────────
--
-- `admin_notification_reads` is the record: one row per (kind, entity) that
-- somebody has marked read. Nothing else is in it, and it never claims anything
-- about the underlying thing.
--
-- Orders have a second, stronger signal already: `"Order"."firstOpenedAt"`,
-- added by 0023 to answer "has anybody actually looked at this?". An order
-- somebody has opened is self-evidently seen, so the feed treats that stamp as
-- read **as well as** an explicit read row. It is a shortcut, not a duplicate:
-- marking a notification read never writes `firstOpenedAt`, because "I dismissed
-- a bell item" is not "I read the order", and 0023's column would start lying.
--
-- ── Why one function rather than five queries ───────────────
--
-- The panel wants the newest fifty things across four sources, interleaved. Done
-- in the application that is four round trips, four `limit`s that have to be
-- over-fetched to be merged correctly, and a sort in JavaScript over rows that
-- Postgres already had in order. `supabase/AGENTS.md` §23 warns about exactly
-- that shape.
--
-- ── What a notification may say ─────────────────────────────
--
-- A name, a number, an amount, a time. **No email, no phone, no address, no
-- order contents.** The bell is a pointer to a screen that is already behind
-- `requireAdmin()`, not a second place customer data is rendered.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Unchanged from every table it reads: RLS on, no policy of any kind, no grant
-- to the public roles, `execute` revoked. The only caller is
-- `src/services/admin/notifications.ts` behind `requireAdmin()`.

-- ── admin_notification_reads ────────────────────────────────

create table if not exists public.admin_notification_reads (
  -- Matches the `AdminNotificationKind` union in `src/types/notification.ts`.
  -- Deliberately `text` and not an enum: a new source of notifications should
  -- be a query change, not a migration that rewrites a type used by a table.
  kind       text not null check (char_length(kind) between 2 and 32),

  -- Whatever identifies the thing within its kind — an order id, a Clerk user
  -- id, a redemption id, a credit id. Never rendered; only compared.
  "entityId" text not null check (char_length("entityId") <= 128),

  "readAt"   timestamptz not null default now(),

  -- Who dismissed it, as a Clerk user id. Stored for the same reason 0023
  -- stores `firstOpenedBy`: "who saw this first" is answerable later without a
  -- second migration. Nothing renders it today.
  "readBy"   text,

  primary key (kind, "entityId")
);

-- ── mark_notifications_read ─────────────────────────────────
--
-- One or many, in one statement.
--
-- `on conflict do nothing` rather than an upsert: the first person to dismiss a
-- notification is the one who dismissed it, and a second click — or a "mark all
-- read" that includes something already read — must not move the timestamp and
-- rewrite who did it.
--
-- Takes an array so "mark all as read" is one round trip over the fifty items
-- the panel is actually showing, rather than fifty.

create or replace function public.mark_notifications_read(
  items    jsonb,
  actor    text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marked int;
begin
  if jsonb_typeof(items) <> 'array' then
    return 0;
  end if;

  with incoming as (
    select
      item->>'kind'     as kind,
      item->>'entityId' as entity_id
    from jsonb_array_elements(coalesce(items, '[]'::jsonb)) as item
  ),
  inserted as (
    insert into public.admin_notification_reads (kind, "entityId", "readBy")
    select kind, entity_id, nullif(actor, '')
      from incoming
     where kind is not null
       and entity_id is not null
    on conflict (kind, "entityId") do nothing
    returning 1
  )
  select count(*)::int into v_marked from inserted;

  return v_marked;
end;
$$;

-- ── admin_notification_feed ─────────────────────────────────
--
-- The newest things worth a glance, newest first, each already carrying whether
-- it has been read.
--
-- Four sources, unioned. Each contributes only what a notification line prints:
-- a label, a short detail, an amount where money is involved, and a time.
--
-- Note what is **not** here: low stock. A product that goes low, is restocked
-- and goes low again is a *condition*, not an event — and a condition that could
-- be dismissed would hide its second occurrence. The dashboard reads that
-- separately, live, and it clears itself when the shelf is refilled.

create or replace function public.admin_notification_feed(max_items int default 50)
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
  with items as (
    -- A new order. Cancelled ones are excluded: the desk does not need to be
    -- told to look at something that has already been called off.
    select
      'ORDER'::text                as kind,
      o.id                         as entity_id,
      o."orderNumber"              as label,
      o."customerName"             as detail,
      o."totalInCents"             as amount,
      o."createdAt"                as occurred_at,
      -- The 0023 shortcut: an order somebody opened is an order somebody saw.
      (o."firstOpenedAt" is not null) as seen
      from public."Order" o
     where o.status <> 'CANCELLED'

    union all

    -- A new account. The name only — never the address.
    select
      'CUSTOMER',
      u."clerkId",
      coalesce(
        nullif(btrim(concat_ws(' ', u."firstName", u."lastName")), ''),
        'New customer'
      ),
      null,
      null,
      u."createdAt",
      false
      from public."User" u
     where u."deletedAt" is null

    union all

    -- A voucher actually used. Released redemptions (a refunded order) are
    -- excluded, for the same reason they do not count against the caps.
    select
      'VOUCHER',
      r.id,
      d.code,
      o."orderNumber",
      r."amountInCents",
      r."redeemedAt",
      false
      from public.discount_redemptions r
      join public.discounts d on d.id = r."discountId"
      left join public."Order" o on o.id = r."orderId"
     where r."releasedAt" is null

    union all

    -- A Discovery Credit earned. Cancelled ones are not news.
    select
      'CREDIT',
      c.id,
      o."orderNumber",
      null,
      c."amountInCents",
      c."earnedAt",
      false
      from public.customer_credits c
      left join public."Order" o on o.id = c."sourceOrderId"
     where c."cancelledAt" is null
  )
  select
    i.kind,
    i.entity_id,
    i.label,
    i.detail,
    i.amount,
    i.occurred_at,
    (i.seen or r.kind is not null) as is_read
    from items i
    left join public.admin_notification_reads r
           on r.kind = i.kind and r."entityId" = i.entity_id
   order by i.occurred_at desc
   limit greatest(coalesce(max_items, 50), 1);
$$;

-- ── Privileges ──────────────────────────────────────────────

alter table public.admin_notification_reads enable row level security;

revoke all on public.admin_notification_reads from public, anon, authenticated;

revoke all on function public.mark_notifications_read(jsonb, text)
  from public, anon, authenticated;
revoke all on function public.admin_notification_feed(int)
  from public, anon, authenticated;
