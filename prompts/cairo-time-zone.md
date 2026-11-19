# Cairo time across the admin

## Goal

Make every time the admin **types or reads** a Cairo time:
- stored as UTC (`timestamptz`), as now;
- entered and shown as Africa/Cairo, with Egypt's summer time handled by the time-zone database, not by hand;
- labelled with the zone so it can't be misread.

## What the investigation found (2026-11-19)

The reported "1 hour late" is **not** a storage or dispatch fault.

| Check | Result |
| :--- | :--- |
| `timedatectl` on the VPS | `Time zone: UTC (UTC, +0000)`, not Berlin |
| Node in the app process | `TZ` unset; resolves to `UTC` |
| Owner's Mac | `Africa/Cairo`, EET (UTC+2), so it correctly reflects the end of summer time |
| Form → API | The `datetime-local` value is converted in the **browser** (`fromDateTimeLocalValue`, `src/lib/campaign-schedule.ts`) and sent as an ISO UTC string. `scheduleCampaign` stores it unchanged. |
| Campaign `1ebd3f93` | Stored 08:00 UTC = 10:00 Cairo. Server log: dispatched **08:00:03 UTC**, on time. |
| Test campaign `d5767b34` | Stored **15:10 UTC = 17:10 Cairo**. Correct if 17:10 was entered. No data fix needed. |

Two real problems remain, both about **reading** times rather than sending them:

1. **Admin displays are in UTC, unlabelled.**
   - Pages: `CampaignRecord` ("Sent …" with hours), order detail, customer detail, credit detail, `/admin/search`. Date-only lists also use UTC.
   - Effect: a campaign sent at 10:00 Cairo shows "08:00", and orders placed 00:00–02:00 Cairo show yesterday's date.
2. **The schedule field depends on the device's time zone.**
   - It's correct on the owner's Mac, but wrong on any device set to another zone: a phone abroad, or a browser or VPN that reports Berlin. That's a plausible source of the 1-hour report.
   - The admin should not depend on the device.

Also stale: `DISPATCH_INTERVAL_MINUTES = 5`. The VPS crontab runs every minute, so the UI tells the desk "every 5 minutes" and warns about schedules up to 15 minutes out for no reason.

## Skills read

None beyond the Next.js docs in `node_modules/next/dist/docs/`. No Clerk, Supabase or AI SDK surface changes.

## Existing code inspected

- `src/lib/campaign-schedule.ts`: the only place where form values and instants cross.
- `src/components/admin/LocalTimestamp.tsx`: renders UTC, then the viewer's zone after hydration.
- `src/components/admin/CampaignDispatch.tsx`: the `datetime-local` field, the proximity warning and the stored-time read-back.
- `src/components/admin/CampaignRecord.tsx`, `src/app/[locale]/admin/**/page.tsx`: 15 local `stamp()` helpers with `timeZone: "UTC"`.
- `src/lib/admin/finance.ts`, `src/lib/admin/sales*`, `src/services/admin/search-insights.ts`: report day boundaries are **UTC days**.
- `src/lib/format.ts`, `src/components/account/*`, `src/lib/email/*`: customer-facing dates.

## Decisions

1. **One constant**, `SHOP_TIME_ZONE = "Africa/Cairo"`, in a new `src/lib/shop-time.ts`. It is the only place the zone is named.
2. **Conversion uses `Intl`**, so it picks up the time-zone database (DST rules) on the server and in the browser. No hand-written offsets and no new dependency.
   - `cairoInputToUtcIso("2026-11-19T17:10")` → `"2026-11-19T15:10:00.000Z"`. It finds the offset for that wall-clock time and re-checks it once around transitions.
   - A time that doesn't exist (the skipped hour when summer time starts) is refused with a message.
   - A time that occurs twice (when summer time ends) resolves to the first occurrence.
   - `utcIsoToCairoInput(iso)` → `"YYYY-MM-DDTHH:mm"` in Cairo.
   - `formatShopDateTime(iso, opts)` / `formatShopDate(iso)` format in Cairo and label it "Cairo time" (e.g. "19 Nov 2026, 17:10 Cairo").
3. **Because the zone is fixed, server and client render the same string.**
   - `LocalTimestamp` no longer needs a two-pass render or a "UTC first paint". It becomes a plain server-safe component.
4. **The server is the authority for the schedule.**
   - The field sends the raw wall-clock value plus `timeZone: "Africa/Cairo"`. `scheduleCampaign` converts it on the server with the same helper.
   - The Zod schema accepts the wall-clock format.
   - The ISO path is kept for one release, for an open tab on the old bundle.
5. **Customer-facing pages and emails are out of scope** (account orders, order tracker, confirmation page, emails).
   - They show date only, in UTC, to customers who may be anywhere.
   - Moving them to Cairo is a product choice, not part of this bug.
6. **Report day boundaries: approved by the owner on 2026-11-19, and in scope.**
   - Today and Yesterday, weekly and monthly finance and sales windows, and the search report's daily buckets are cut at **UTC midnight**, which is 02:00 Cairo.
   - Orders placed between 00:00 and 02:00 Cairo count toward the previous day.
   - Moving the cut to Cairo midnight changes historical numbers on those screens.
   - Implementation: `supabase/sql/0077_cairo_report_days.sql` (the views and functions,
     from their live definitions), plus `salesWindow`, `financeWindow`, `monthPace`,
     the targets page, the dashboard chart's day-filling, the inventory history filter
     and the expense form's default date, all on Cairo's calendar.

## Files likely to change

- New: `src/lib/shop-time.ts`, plus `scripts/shop-time.test.ts`.
- `src/lib/campaign-schedule.ts`:
  - delegate to shop-time;
  - drop the browser-zone functions;
  - `DISPATCH_INTERVAL_MINUTES = 1`.
- `src/components/admin/CampaignDispatch.tsx`: field label "Or schedule it (Cairo time)", the read-back in Cairo, sending the wall-clock value.
- `src/components/admin/LocalTimestamp.tsx`: Cairo, single render (rename kept to avoid churn).
- `src/actions/admin/campaigns.ts`, `src/schemas/campaigns.ts`: accept and convert the wall-clock value server-side.
- Admin display helpers that use `timeZone: "UTC"`:
  - `CampaignRecord.tsx`
  - `admin/page.tsx`
  - `orders/page.tsx`, `orders/[orderNumber]/page.tsx`
  - `customers/page.tsx`, `customers/[id]/page.tsx`
  - `credits/page.tsx`, `credits/[id]/page.tsx`
  - `campaigns/page.tsx`
  - `newsletter/page.tsx`
  - `discounts/page.tsx`, `discounts/[code]/page.tsx`
  - `offers/page.tsx`, `promotions/page.tsx`, `announcements/page.tsx`
  - `search/page.tsx`
  - `rewards/page.tsx` (check its 11 uses)
  - `inventory/*`

  Replace each local `stamp()` with the shared formatter.

**Not touched:** date-only *calendar* values such as discount start/end dates and finance `from`/`to` query params, which are days, not instants.

## Implementation requirements

- TypeScript strict, no `any`. Lint and `tsc --noEmit` clean.
- No `TZ` variable on the server: the app must not depend on the host zone.
- Every displayed admin time with hours carries the "Cairo" label. Date-only cells don't need the label.
- Proximity warnings ("too soon", "past") compute from the converted UTC instant.
- Keep the visual style. Copy changes are only the zone wording.

## Security requirements

- `scheduleCampaign` still calls `requireAdmin()` first and validates with Zod.
- An invalid or nonexistent local time returns a typed error, never a 500.

## Acceptance criteria

- Typing 17:10 on 19 Nov 2026 stores `2026-11-19 15:10:00+00`, on a device set to Cairo, Berlin or UTC alike.
- Summer-time cases: typing 10:00 on 15 Jul 2026 stores 07:00 UTC (UTC+3). Typing 10:00 on 19 Nov stores 08:00 UTC (UTC+2).
- The campaign record for `1ebd3f93` shows "Sent 19 November 2026, 10:00 Cairo".
- The order detail time matches the time the order email reports.
- No hydration warnings on the admin pages touched.

## Checks to run

- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- `node --test` on `scripts/shop-time.test.ts`, which covers winter, summer and both transition days.

## Manual test steps

1. Deploy with `deploy/deploy.sh` and wait for the new release to be live.
2. In Admin → Campaigns, create a test campaign to yourself scheduled about 10 minutes ahead in Cairo time. The read-back line should say "… Cairo" with the time you typed.
3. On the server, confirm the cron log shows the dispatch at that minute, in UTC = Cairo − 2h.
4. The email arrives within 1 minute of the time you set.
5. Change the Mac's time zone to Berlin, reload the admin, and schedule again. The stored time is still Cairo-based.
6. Open an order placed after 00:00 Cairo: the date and time match Cairo.
