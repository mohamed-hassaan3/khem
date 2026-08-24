-- KHEM — the day-after letter: which orders are owed one, and the stamp that
-- says one was sent.
--
-- Applied by `npm run db:migrate` after `0015_orders.sql` (the `"Order"` table)
-- and `0017_order_events.sql` (the `"OrderStatusEvent"` trail this reads to
-- learn *when* an order was delivered).
--
-- ── What this is for ────────────────────────────────────────
--
-- Twenty-four hours after a parcel arrives, the customer is asked what they
-- thought of it, with a link per item straight to that product's comment area.
-- `src/app/api/cron/order-feedback/route.ts` is the caller; the mail itself is
-- `customerFeedbackEmail()` in `src/lib/email/order-templates.ts`.
--
-- ── Why the selection lives here ────────────────────────────
--
-- Same reason as `expire_unpaid_orders()`: a reader that fetched candidates,
-- decided in TypeScript, and wrote the stamp back would leave a window in which
-- two runs both see the same order and both send. Selection and the claim are
-- split accordingly: `orders_awaiting_feedback()` merely proposes, and
-- `mark_feedback_requested()` decides, with the `is null` predicate inside the
-- `update` itself. Two callers may both be handed the same id; only one of them
-- gets `true` back, and only that one sends.
--
-- ── Why "delivered" is read from the event trail ────────────
--
-- `"Order"` records that an order *is* DELIVERED, not when it became so —
-- `updatedAt` moves for any edit, including a tracking code typed the next
-- morning. `"OrderStatusEvent"` is append-only and stamps the moment the status
-- was set, which is the only honest answer to "has it been a day?".
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Unchanged from 0015 and 0017: RLS on, no policy, no grant to the public
-- roles, and `execute` on both functions revoked from `anon` and
-- `authenticated`. A `security definer` function reachable by the anon role is
-- a write path with the door left open.

-- ── The stamp ───────────────────────────────────────────────
--
-- Null means "never asked". Set once, and never cleared: a customer who has
-- been asked about an order has been asked, and a second letter about the same
-- parcel is a nuisance rather than a reminder.
alter table public."Order"
  add column if not exists "feedbackRequestedAt" timestamptz;

-- Partial, over exactly the rows the sweep looks at: delivered orders nobody
-- has written to yet. On a healthy database that is a handful of rows a day.
create index if not exists order_awaiting_feedback_idx
  on public."Order" (status)
  where status = 'DELIVERED' and "feedbackRequestedAt" is null;

-- ── orders_awaiting_feedback ────────────────────────────────
--
-- Ids of orders that are DELIVERED, were delivered at least `older_than_hours`
-- ago, have not been written to, and still carry an email address to write to.
--
-- Bounded on both sides. The far edge (30 days) is what stops switching this
-- feature on — or restoring a backup — from mailing a year of old customers at
-- once about parcels they have long since forgotten.
create or replace function public.orders_awaiting_feedback(
  older_than_hours int default 24,
  max_rows         int default 50
)
returns setof text
language sql
security definer
set search_path = public
as $$
  select o.id
    from public."Order" o
   where o.status = 'DELIVERED'
     and o."feedbackRequestedAt" is null
     and o."customerEmail" is not null
     and exists (
       select 1
         from public."OrderStatusEvent" e
        where e."orderId" = o.id
          and e.status = 'DELIVERED'
          and e."occurredAt" <= now() - make_interval(hours => greatest(older_than_hours, 1))
          and e."occurredAt" >= now() - interval '30 days'
     )
   order by o."placedAt"
   limit greatest(max_rows, 0);
$$;

-- ── mark_feedback_requested ─────────────────────────────────
--
-- Claim one order. `true` means this caller is the one that claimed it and may
-- send; `false` means somebody already had it, or there is no such order.
--
-- The claim is made **before** the letter goes out. A send that fails costs one
-- missed letter; a claim that happens afterwards costs a duplicate every time
-- two runs overlap, and of those two failures only the first is invisible to
-- the customer.
create or replace function public.mark_feedback_requested(order_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed int;
begin
  update public."Order"
     set "feedbackRequestedAt" = now(),
         "updatedAt"           = now()
   where id = order_id
     and "feedbackRequestedAt" is null;

  get diagnostics v_claimed = row_count;

  return v_claimed = 1;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────

revoke all on function public.orders_awaiting_feedback(int, int)
  from public, anon, authenticated;
revoke all on function public.mark_feedback_requested(text)
  from public, anon, authenticated;
