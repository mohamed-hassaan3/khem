-- KHEM — a record of every Stripe event we have already acted on.
--
-- Applied by `npm run db:migrate`, after `0016_checkout.sql` (which creates the
-- Stripe columns on `"Order"`) and after `0026_discovery_credits.sql` (whose
-- `settle_order_payment()` is the function this table sits in front of). Every
-- statement is idempotent. Nothing here re-declares an existing function.
--
-- ── What was missing ────────────────────────────────────────
--
-- Idempotency, but only per *order*. `settle_order_payment()` returns true
-- exactly once per order, and that boolean is what stops a redelivered
-- `payment_intent.succeeded` from putting a second receipt in somebody's inbox.
-- It is a good guard and it stays.
--
-- What it cannot do is answer "have we seen this event before?", because it is
-- not asked about events. Two consequences:
--
--  - The other handlers had no equivalent. `charge.refunded` and
--    `payment_intent.payment_failed` were idempotent only by accident of the
--    state they happened to check, and a fourth handler added later would
--    inherit nothing.
--  - A redelivery was invisible. Stripe retries until it gets a 2xx and may
--    deliver twice even after one, so "this order was settled twice" and "this
--    order was settled once and told to us twice" looked identical in the logs
--    — which is exactly the question somebody asks at 2am when a customer says
--    they were charged twice.
--
-- So the fact is stored: one row per Stripe event id, written before the event
-- is dispatched. The route treats the insert as the decision — first delivery
-- or duplicate — rather than reading and then deciding, for the reason
-- `0015_orders.sql` gives about the gap between a read and a write.
--
-- ── Why a table, and not a column ───────────────────────────
--
-- A `lastStripeEventId` on `"Order"` would hold one event per order, and an
-- order's life involves several — an intent that failed, a retry that
-- succeeded, a refund months later. It would also have nowhere to put an event
-- that touches no order at all, which is precisely the class worth keeping: a
-- `succeeded` arriving with no `orderId` in its metadata is the fingerprint of
-- a payment created outside this application.
--
-- ── Not a payment ledger ────────────────────────────────────
--
-- It records that an event was handled. What the event *did* lives where it
-- always did — `"Order"."paymentStatus"`, `"paidAt"`, `"stripePaymentIntentId"`,
-- `"OrderStatusEvent"`. Stripe itself remains the authority on the money, and
-- this table must never become a second, drifting copy of it. Nothing reads
-- from it; it exists to be written to and, occasionally, to be looked at by a
-- person.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Identical to `"Order"` in 0015, and for the same reason: identity is Clerk's,
-- `auth.uid()` is always null, and no RLS policy here could express a useful
-- rule. RLS on, **no policy of any kind**, no grant to the public roles. The
-- only caller is `/api/webhooks/stripe`, behind SUPABASE_SECRET_KEY, and it
-- reaches the table through the function below rather than directly.

-- ── StripeWebhookEvent ──────────────────────────────────────

create table if not exists public."StripeWebhookEvent" (
  -- Stripe's own `evt_…` id, used as the primary key rather than stored beside
  -- one. The uniqueness we care about is Stripe's, so it is the constraint
  -- itself; a surrogate id with a unique index alongside would say the same
  -- thing twice.
  id           text primary key,

  -- `payment_intent.succeeded` and the rest. Kept as text, not an enum: Stripe
  -- adds event types on its own schedule, and a migration is a poor thing to
  -- need before you can record one.
  type         text not null,

  -- The order the event concerned, when it named one. Nullable on purpose — see
  -- the header on events that touch no order.
  --
  -- `on delete set null` rather than `cascade`: the record that an event was
  -- handled outlives the order it was about, which matters most in the one case
  -- where the order is gone and somebody is asking why.
  "orderId"    text references public."Order"(id) on delete set null,

  "receivedAt" timestamptz not null default now()
);

-- The two questions a person actually asks of this table: what happened to this
-- order, and what has arrived recently.
create index if not exists stripe_event_order_idx
  on public."StripeWebhookEvent" ("orderId", "receivedAt" desc);

create index if not exists stripe_event_received_idx
  on public."StripeWebhookEvent" ("receivedAt" desc);

alter table public."StripeWebhookEvent" enable row level security;

revoke all on public."StripeWebhookEvent" from public, anon, authenticated;

-- ── record_stripe_event ─────────────────────────────────────
--
-- Returns **true when this call was the one that recorded the event**, and
-- false when the row was already there. The webhook dispatches only on true, so
-- a redelivery costs one insert attempt and nothing else.
--
-- `on conflict do nothing` and then `found` — not `select` then `insert`. Two
-- concurrent deliveries of the same event are a real occurrence, not a
-- theoretical one, and a read-then-write would let both pass the check and
-- both dispatch. The primary key settles it: exactly one insert wins.
--
-- `order_id` is checked against `"Order"` before it is stored, rather than
-- being allowed to raise. The value comes from a Stripe metadata bag, and while
-- the signature proves Stripe sent it, it does not prove the id still names a
-- row — an order deleted between the intent and the webhook would otherwise
-- turn a foreign key violation into a 500 and an endless retry, over a column
-- that exists only to make the table readable by a human.

create or replace function public.record_stripe_event(
  event_id   text,
  event_type text,
  order_id   text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id text;
begin
  if event_id is null or event_id = '' then
    raise exception 'A Stripe event must have an id.'
      using errcode = 'null_value_not_allowed';
  end if;

  select o.id into v_order_id
    from public."Order" o
   where o.id = order_id;

  insert into public."StripeWebhookEvent" (id, type, "orderId")
  values (event_id, coalesce(event_type, 'unknown'), v_order_id)
  on conflict (id) do nothing;

  return found;
end;
$$;

-- ── The row is a claim that can be withdrawn ────────────────
--
-- Written *before* the event is dispatched, which is what makes two
-- simultaneous deliveries safe — but it means the row can outlive a handler
-- that then failed. `/api/webhooks/stripe` deletes it again on that path,
-- before answering 500, so that Stripe's retry is treated as a first delivery
-- rather than as a duplicate.
--
-- So the row means "handled", not "seen", and the difference matters: a table
-- of events that were *received* would suppress the retries that exist to fix
-- exactly the deliveries that went wrong.

-- ── Retention ───────────────────────────────────────────────
--
-- One row per event, forever, which for a boutique is a few thousand rows a
-- year — small enough that no scheduled pruning is worth the machinery. It is
-- deliberately *not* on a cron: the rows are most useful exactly when an old
-- payment is being disputed, and a job that quietly deletes the evidence would
-- be a poor trade for a kilobyte.
--
-- If it ever needs trimming, this is the statement, run by hand. Ninety days is
-- comfortably beyond Stripe's own retry window, so nothing still in flight can
-- be forgotten by it:
--
--     delete from public."StripeWebhookEvent"
--      where "receivedAt" < now() - interval '90 days';

-- ── Privileges ──────────────────────────────────────────────
--
-- Re-asserted rather than inherited, exactly as `0016_checkout.sql` does it and
-- for the same reason: `0006_privileges.sql` altered the defaults, but this
-- function is created afterwards, and a `security definer` function the anon
-- role may execute is a write path with the door left open.

revoke all on function public.record_stripe_event(text, text, text)
  from public, anon, authenticated;
