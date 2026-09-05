-- KHEM — one dispatch run per campaign at a time.
--
-- Applied by `npm run db:migrate` after `0056_campaign_empty_claim.sql`. Two
-- columns and two functions, all additive: no existing function is replaced and
-- the send loop is untouched.
--
-- ── The gap this closes ─────────────────────────────────────
--
-- `begin_campaign_dispatch()` takes `for update` on the campaign row, and that
-- lock is genuine — but it lives and dies inside that one statement. It stops
-- two runs *claiming* the same audience. It does not stop two runs *sending* it.
--
-- Once a campaign is SENDING, a second invocation is handed `ok: true` with the
-- outstanding count and walks straight into the send loop beside the first. And
-- `next_campaign_batch()` reserves nothing: it is a `stable` select of rows with
-- no `sentAt`, and a row is only stamped by `record_campaign_sends()` *after*
-- the provider has accepted the letter. So for the whole width of a batch call,
-- both runs can read the same hundred addresses and both can send to them.
--
-- Resend's `idempotencyKey` is `campaign:<id>:<batch index>`, which saves this
-- only while the two runs stay in lockstep. The moment they are offset — one
-- resuming at batch three while the other starts at batch zero — the same key
-- carries a different payload, or a different key carries the same people. One
-- of those is refused by the provider; the other is a letter sent twice, which
-- is the single failure this whole subsystem was built to make impossible.
--
-- Today's daily cron makes the overlap improbable. A per-minute cron on any host
-- makes it ordinary: every campaign over `MAX_BATCHES × 100` recipients spans
-- runs by design, so the next tick arrives while the last one is still sending.
-- **This must be in place before the dispatch is triggered more often than a
-- run can finish.**
--
-- ── Why a lease, and not a lock ─────────────────────────────
--
-- A run is several statements over several minutes — claim, batch, record,
-- batch, record, finish — in separate transactions, and a database lock cannot
-- span them: PostgREST hands out pooled connections, so a session-level advisory
-- lock is not reliably the same session twice.
--
-- So the mutual exclusion is data, not a lock: a holder and an expiry, written
-- under the row lock, which makes taking it atomic even though holding it is
-- not. A second run reads a live lease held by somebody else and declines.
--
-- The expiry is what keeps a crash from wedging the campaign for ever. A run
-- killed by a function timeout leaves its lease behind; the campaign is skipped
-- until it lapses, then picked up normally. That is the right way round — a
-- little late is recoverable, twice is not.
--
-- **The lease must outlast the longest run the host permits.** It is 15 minutes
-- by default against a 5-minute function ceiling and a run bounded at ten
-- batches. If `MAX_BATCHES` in `src/services/admin/campaign-dispatch.ts` rises,
-- or a host allows longer invocations, raise this with it — a lease that expires
-- mid-send re-opens exactly the hole it was added to close.
--
-- The normal path does not wait for the expiry: the service releases the lease
-- on its way out, including on failure, so the next tick can continue a large
-- campaign immediately.

-- ── Columns ─────────────────────────────────────────────────
--
-- Deliberately absent from `CAMPAIGN_COLUMNS` in `src/schemas/db/campaigns.ts`.
-- This is bookkeeping for the dispatch, not a fact about the campaign, and no
-- screen has any business reading it.

alter table public.campaigns
  add column if not exists "dispatchLeaseId" text;

alter table public.campaigns
  add column if not exists "dispatchLeaseUntil" timestamptz;

-- ── acquire_campaign_dispatch ───────────────────────────────
--
-- Take the run lease, or report who holds it. Called before
-- `begin_campaign_dispatch()`, so a declined run touches nothing at all.
--
-- Re-entrant for its own holder: a run that already holds the lease renews it
-- rather than refusing itself.
--
-- Returns `{ ok, reason, leaseId, heldUntil }`.

create or replace function public.acquire_campaign_dispatch(
  campaign_id   text,
  lease_id      text,
  lease_seconds int default 900
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign record;
  v_now      timestamptz := now();
  v_until    timestamptz;
begin
  if lease_id is null or btrim(lease_id) = '' then
    return jsonb_build_object('ok', false, 'reason', 'A dispatch run needs an identity.');
  end if;

  -- The same lock `begin_campaign_dispatch()` takes, for the same reason: two
  -- runs arriving together serialise here, and only one reads an empty lease.
  select * into v_campaign
    from public.campaigns
   where id = campaign_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'No such campaign.');
  end if;

  if v_campaign."dispatchLeaseUntil" is not null
     and v_campaign."dispatchLeaseUntil" > v_now
     and v_campaign."dispatchLeaseId" is distinct from lease_id then
    return jsonb_build_object(
      'ok', false,
      'reason', 'That campaign is already being sent. The run in progress will continue it.',
      'heldUntil', v_campaign."dispatchLeaseUntil"
    );
  end if;

  -- Bounded either side: too short re-opens the overlap, too long turns a
  -- crashed run into a campaign nobody can send for hours.
  v_until := v_now + make_interval(
    secs => greatest(60, least(coalesce(lease_seconds, 900), 3600))
  );

  update public.campaigns
     set "dispatchLeaseId"    = lease_id,
         "dispatchLeaseUntil" = v_until
   where id = campaign_id;

  -- `"updatedAt"` is left alone on purpose. A lease is not an edit of the
  -- campaign, and the desk's "last changed" should not move because a cron ran.

  return jsonb_build_object('ok', true, 'leaseId', lease_id, 'heldUntil', v_until);
end;
$$;

-- ── release_campaign_dispatch ───────────────────────────────
--
-- Hand the lease back. Matched on the holder, so a run that overran its lease
-- and was superseded cannot release the lease of the run that replaced it —
-- which would put two senders back on the same campaign, the exact outcome this
-- file exists to prevent.
--
-- Returns true when this caller's lease was the one cleared.

create or replace function public.release_campaign_dispatch(
  campaign_id text,
  lease_id    text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if lease_id is null or btrim(lease_id) = '' then
    return false;
  end if;

  update public.campaigns
     set "dispatchLeaseId"    = null,
         "dispatchLeaseUntil" = null
   where id = campaign_id
     and "dispatchLeaseId" = lease_id;

  return found;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────
--
-- Service-role only, as every function in this subsystem is. A lease reachable
-- from a browser would let anyone hold a campaign hostage, or release a lease
-- out from under a run that is mid-send.

revoke all on function public.acquire_campaign_dispatch(text, text, int)
  from public, anon, authenticated;
revoke all on function public.release_campaign_dispatch(text, text)
  from public, anon, authenticated;

-- Both functions are new, so PostgREST will not answer to them until its schema
-- cache is reloaded. `npm run db:migrate` signals that; applying this file by
-- any other route does not, and the dispatch would degrade silently — see
-- AGENTS.md §9 and `supabase/README.md`.
