# Campaign scheduling — correctness fixes

## Goal

Make the campaign schedule field mean what it says, on any host. Five items,
scoped by the owner: timezone round-trip, the empty-audience hole, visibility of
the scheduled moment, hosting-agnostic lead-time validation, and a verification
(no rewrite) of the dispatch locking.

**Explicitly out of scope:** the Vercel plan, the cron cadence in `vercel.json`,
any Hostinger cron configuration, and every other part of the campaign/email
stack. The future trigger is `Hostinger Cron → /api/cron/send-campaigns`, wired
separately at migration time; nothing here may assume it.

## Skills read

`.agents/skills/supabase` (migration + PostgREST cache rules, already summarised
in AGENTS.md §9). No AI SDK or Clerk surface is touched.

## Existing code inspected

- `src/components/admin/CampaignDispatch.tsx` — the schedule control.
- `src/actions/admin/campaigns.ts` — `scheduleCampaign`, `unscheduleCampaign`,
  `sendCampaignNow` (which already carries the audience guard).
- `src/schemas/campaigns.ts` — `scheduleCampaignSchema`.
- `src/app/[locale]/admin/campaigns/page.tsx` — the list, which never shows
  `scheduledAt`.
- `supabase/sql/0034_campaign_dispatch.sql`, `0036_campaign_audiences.sql`
  (current `begin_campaign_dispatch`), `0055_campaign_customer_audience.sql`.
- `src/services/admin/campaign-dispatch.ts` — the dispatch loop.

## Decisions

1. **The database stays UTC `timestamptz`.** The bug is presentational: a UTC
   string was sliced into a `datetime-local` input, which reads its value as
   local. Conversion happens in one module and nowhere else.
2. **Local time is a browser fact, not a server one.** Formatting therefore runs
   after mount, with the UTC rendering as the pre-hydration fallback, so there is
   no hydration mismatch and no server guess at the desk's zone.
3. **Lead time is a constant, not a plan.** `MIN_SCHEDULE_LEAD_MS` (5 min) is
   refused outright; `SCHEDULE_SOON_MS` (1 h) is warned about in wording that
   names no host: the dispatcher's cadence is whatever the deployment sets.
4. **The empty campaign is stopped twice** — in the action, like `sendCampaignNow`,
   and in `begin_campaign_dispatch()`, so a campaign whose audience emptied
   between scheduling and dispatch can never claim nothing and be recorded SENT.

## Files to change

- `src/lib/campaign-schedule.ts` — new; the only place UTC ↔ local crosses.
- `src/components/admin/LocalTimestamp.tsx` — new; a mount-gated local stamp.
- `src/components/admin/CampaignDispatch.tsx`
- `src/actions/admin/campaigns.ts`
- `src/schemas/campaigns.ts`
- `src/app/[locale]/admin/campaigns/page.tsx`
- `supabase/sql/0056_campaign_empty_claim.sql` — new.

## Implementation requirements

1. **Timezone.** `toDateTimeLocalValue(iso)` renders a stored UTC instant as the
   `YYYY-MM-DDTHH:mm` the input expects, in the browser's zone;
   `fromDateTimeLocalValue(value)` returns the UTC ISO string. The input's state
   is seeded in an effect keyed on `campaign.scheduledAt`, never during render,
   so SSR emits no zone-dependent value. Round trip must be stable: schedule
   17:00, reload, press Schedule again — still 17:00.
2. **Zone is labelled** wherever a time is shown or typed, using the browser's
   resolved zone and a short zone name.
3. **Empty audience.** `scheduleCampaign()` reads `audienceBreakdown()` and
   refuses `total === 0` with the same sentence `sendCampaignNow()` uses. The
   Schedule button is disabled on the same condition. `begin_campaign_dispatch()`
   returns `ok:false` and leaves the status alone when the claim inserts nothing.
4. **Validation.** Past is still refused. Under `MIN_SCHEDULE_LEAD_MS` is
   refused with its own message. Under `SCHEDULE_SOON_MS` renders a warning that
   describes cadence generically.
5. **Visibility.** A `SCHEDULED` campaign shows its moment in local time with the
   zone, both on the dispatch panel and in the campaigns list.
6. **Dispatch locking** is read and reported on, not rewritten.

## Security requirements

`requireAdmin()` stays the gate on every action. The new SQL function keeps
`security definer`, `set search_path = public`, and the existing revokes; it
returns no address and no token. Nothing new is logged — ids and counts only.

## Acceptance criteria

- Schedule 17:00 local → row holds the equivalent UTC instant → field reloads
  at 17:00 → re-saving does not shift it.
- A campaign with no audience cannot be scheduled, and cannot reach SENT.
- A `SCHEDULED` campaign's moment is legible on the list and the detail screen.
- A moment under five minutes away is refused; one under an hour warns.
- `npx tsc --noEmit` and `npm run lint` clean.

## Checks

`npx tsc --noEmit`, `npm run lint`, `npm run db:migrate` (which signals the
PostgREST reload).

## Manual test steps

1. `npm run dev`, open `/en/admin/campaigns`, create or open a draft.
2. Turn both audience switches off and clear named addresses → Schedule is
   disabled; the action refuses if called anyway.
3. Switch Subscribers on, save, pick a time ~2 hours out, Schedule.
4. Confirm the panel reads "Scheduled for …" in your zone, and the list row
   shows the same moment. Reload; the field still shows the time you chose.
5. Press Schedule again unchanged — the stored instant does not move.
6. Pick a time two minutes out → refused. Thirty minutes out → warned.
7. Withdraw the schedule; status returns to draft and the field clears.
