-- KHEM — whether anybody at the desk has actually looked at an order.
--
-- Applied by `npm run db:migrate` after `0015_orders.sql` (the table), and
-- after `0022_order_feedback.sql`, whose `mark_feedback_requested()` is the
-- idiom the function at the bottom of this file copies.
--
-- ── What this answers, and what `status` does not ───────────
--
-- `status` records what has been *done* to an order: it was prepared, it was
-- shipped. It says nothing about whether a human ever read the thing. A PENDING
-- order that three people have opened and argued about, and a PENDING order
-- that arrived ninety seconds ago and nobody has seen, are the same row on the
-- order book — and the second one is the only one that needs somebody now.
--
-- So: one stamp, written the first time an admin opens the order's own screen.
-- The dashboard counts the rows where it is still null and the order book marks
-- them "New". That is the whole feature.
--
-- ── Two columns, not a table ────────────────────────────────
--
-- This is a single nullable fact about one order — the same shape as
-- `"stockReleasedAt"` and `"feedbackRequestedAt"` in 0015 and 0022. A table
-- would earn its place only if we recorded *every* view by *every* admin, which
-- is a different question ("who has read this") from the one the desk is
-- asking ("has anyone").
--
-- ── Claimed once, in SQL ────────────────────────────────────
--
-- `mark_order_opened()` updates only where the stamp is still null. Two admins
-- opening the same order in the same second therefore produce one stamp and one
-- owner. A service that read the column, decided, and then wrote would leave a
-- gap between the read and the write in which the second request also sees
-- null — the same race that put stock movement inside `place_order()` rather
-- than in an action.
--
-- ── `updatedAt` is deliberately not touched ─────────────────
--
-- That column means "when this order's business state last changed". Reading an
-- order changes nothing, and moving the timestamp would make every order the
-- desk merely glanced at look freshly edited — and would corrupt the one signal
-- `0017_order_events.sql`'s backfill leans on.
--
-- ── Trust model ─────────────────────────────────────────────
--
-- Unchanged from 0015 and for the same reason: identity is Clerk's, so
-- `auth.uid()` is always null and no RLS policy here could express "this order
-- is mine". RLS stays on, there is still no policy of any kind, and the public
-- roles hold no grant. The function below is revoked from them too, so the only
-- caller is code holding SUPABASE_SECRET_KEY — `src/actions/admin/orders.ts`,
-- behind `requireAdmin()`.

-- ── Columns ─────────────────────────────────────────────────

alter table public."Order"
  -- When the first admin opened this order's screen. Null means nobody has.
  add column if not exists "firstOpenedAt" timestamptz,

  -- Who that was — a **Clerk user id**, never an email, name or anything else
  -- that identifies a person in a row. Nothing renders it today; it is stored
  -- so "who saw it first" is answerable later without a second migration.
  add column if not exists "firstOpenedBy" text
    check (char_length("firstOpenedBy") <= 120);

-- The two reads this feature adds — the overview tile's count and the order
-- book's "New" filter — both ask only for rows where the stamp is null, so the
-- index carries only those rows and stays small as the opened ones accumulate.
create index if not exists order_unopened_idx
  on public."Order" ("placedAt" desc)
  where "firstOpenedAt" is null;

-- ── No backfill ─────────────────────────────────────────────
--
-- Every order placed before this file genuinely has no record of being opened,
-- and stamping them now would invent the exact fact the desk came here to
-- check. They will all read "New" on the first run after this migration, and
-- clear as somebody actually works through them. That is correct, not a bug.

-- ── mark_order_opened ───────────────────────────────────────
--
-- Returns true when *this* call was the one that claimed the order, false when
-- it was already open. The caller uses that only to decide whether to write a
-- log line — the outcome is the same either way, which is why nothing here
-- raises.

create or replace function public.mark_order_opened(order_id text, opened_by text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed int;
begin
  update public."Order"
     set "firstOpenedAt" = now(),
         "firstOpenedBy" = nullif(opened_by, '')
   where id = order_id
     and "firstOpenedAt" is null;

  get diagnostics v_claimed = row_count;

  return v_claimed = 1;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────

revoke all on function public.mark_order_opened(text, text)
  from public, anon, authenticated;
