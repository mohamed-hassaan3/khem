# Campaign dispatch — one run at a time

## Goal

Make `dispatchCampaign()` safe to trigger while a previous run is still sending.
Follows `prompts/campaign-schedule-fixes.md`, whose item 5 was a verification and
found this.

Out of scope, as before: the Vercel plan, `vercel.json`, and the Hostinger cron
itself. This is the prerequisite for that migration, not part of it.

## What the verification found

`begin_campaign_dispatch()`'s `for update` guards the **claim** and ends with its
own statement. It does not guard the **send**. A second invocation arriving while
the campaign is SENDING is handed `ok: true` plus the outstanding count and
enters the send loop beside the first; `next_campaign_batch()` is a `stable`
select with no reservation, and rows are only stamped by
`record_campaign_sends()` *after* the provider accepts the batch. So both runs
read the same unstamped rows and both write to them.

Resend's `idempotencyKey` (`campaign:<id>:<batch index>`) covers this only while
the two runs are in lockstep. Offset by one batch, the same key carries a
different payload (refused) or a different key carries the same people (a letter
sent twice).

A daily trigger makes it improbable. Any trigger faster than a run makes it
ordinary, because a campaign past `MAX_BATCHES × 100` recipients spans runs by
design — which is exactly what the Hostinger cron will be.

## Decisions

1. **A lease, not a lock.** A run is several statements across several
   transactions and minutes; no database lock spans that, and PostgREST's pooled
   connections make a session advisory lock unreliable. The mutual exclusion is
   therefore data — a holder and an expiry on the campaign row — written under
   the same `for update`, which makes *taking* it atomic even though *holding*
   it is not.
2. **Expiry, so a crash cannot wedge a campaign.** 15 minutes, against a run
   bounded at ten batches and a five-minute function ceiling. Released
   explicitly on every ordinary path, so the next tick continues a large
   campaign immediately rather than waiting.
3. **Additive SQL.** Two columns and two new functions. `begin_campaign_dispatch`,
   `next_campaign_batch`, `record_campaign_sends` and `finish_campaign` are not
   touched, and neither is the send loop — a per-row reservation would have been
   the bigger rewrite the owner asked to avoid.
4. **Standing down is not a failure.** A declined run is reported as `skipped`,
   logged at info, and excluded from the dispatched count, so a fast scheduler
   does not fill the logs with warnings about the design working.
5. **Fail closed.** If the lease cannot be taken — RPC error, missing function,
   stale PostgREST cache — nothing is sent. The alternative is sending on the
   assumption that nobody else is, which is the one mistake that cannot be
   undone.

## Files changed

- `supabase/sql/0057_campaign_dispatch_lease.sql` — new.
- `src/services/admin/campaign-dispatch.ts`
- `src/app/api/cron/send-campaigns/route.ts`

## Acceptance criteria

- Two concurrent calls to the endpoint for one campaign: one sends, the other
  returns `skipped` and writes nothing.
- A campaign spanning runs is continued by the next trigger, not blocked by a
  stale lease.
- An exception mid-run releases the lease.
- `campaign_sends` holds exactly one row per address, with one `sentAt`.
- `npx tsc --noEmit` and `npm run lint` clean.

## Deploy order — required

`npm run db:migrate` **before** the code ships. The service calls two RPCs that
0057 creates; until they exist the dispatch fails closed and nothing sends. The
migrate script signals the PostgREST reload, without which the functions are
invisible even after the SQL applies (AGENTS.md §9).

## Manual test steps

1. `npm run db:migrate` and confirm the "PostgREST schema cache reload
   signalled" line.
2. Compose a campaign with a handful of named addresses; press Send.
3. While it runs, press Send again in a second tab — expect "already being
   sent", and no second letter.
4. `select id, "dispatchLeaseId", "dispatchLeaseUntil" from campaigns` during a
   run shows a holder; after it, both null.
5. Confirm the letters arrived once each.
