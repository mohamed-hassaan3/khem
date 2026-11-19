/**
 * When a campaign is due, in the two forms it has to take.
 *
 * The database holds an instant — `timestamptz`, always UTC. The desk types a
 * wall-clock reading into a `datetime-local` input, which has no zone at all.
 * Those are different kinds of value: an earlier version sliced the UTC string
 * straight into the field, so a letter scheduled for 17:00 redisplayed as 14:00
 * and moved earlier every time it was saved again.
 *
 * **This module is the only place the two forms cross.** Nothing else may slice
 * an ISO string for a form field, and nothing else may turn a form field's value
 * into an instant without passing it through here (or `src/lib/shop-time.ts`,
 * which it delegates to).
 *
 * ## The field is read on Cairo's clock, not the device's
 *
 * It used to be read in the browser's own zone — right only while the browser
 * happened to be in Cairo, and silently an hour or more off on a device set
 * anywhere else. The boutique keeps one clock (prompts/cairo-time-zone.md), so
 * the field is Cairo time on every device, the conversion gives the same answer
 * on the server and in the browser, and the server repeats it rather than
 * trusting the browser's.
 *
 * ## The lead time is not a hosting limit
 *
 * `MIN_SCHEDULE_LEAD_MS` describes how far ahead a human should be asked to
 * plan. It is a floor on what may be *asked for*, and it does not move when the
 * trigger does.
 */

import { formatShopDateTime, shopWallClockToUtc, utcToShopWallClock } from "@/src/lib/shop-time";

/** Nearer than this is refused: nothing can be relied on to run in the gap. */
export const MIN_SCHEDULE_LEAD_MS = 5 * 60 * 1000;

/**
 * How often the dispatcher is actually triggered, in minutes.
 *
 * The application cannot discover this. The trigger lives outside it — today an
 * VPS crontab calling `/api/cron/send-campaigns` every minute
 * (`deploy/cron/khem.crontab`) — so this number is a
 * statement *about* the deployment, kept in one place because three pieces of
 * copy are derived from it rather than each restating it.
 *
 * **Raise it whenever the trigger becomes less frequent, and never guess it
 * downwards.** Promising a precision nothing delivers is the exact failure this
 * scheduling work was undertaken to fix: a campaign set for 10:00 that went at
 * 14:09, because the only thing looking at the queue looked once a day.
 *
 * One, because one is what runs. The VPS crontab (`deploy/cron/khem.crontab`)
 * calls the dispatcher every minute, and the server log on 2026-11-19 shows a
 * campaign scheduled for 15:10:00 UTC dispatched at 15:10:02. The 5 it replaced
 * was observed under the old external trigger, which no longer exists.
 */
// Typed `number`, not the literal `5`: the cadence phrase compares against 1,
// and a literal type would make that comparison a compile error every time this
// value is edited — which is a change this constant exists to invite.
export const DISPATCH_INTERVAL_MINUTES: number = 1;

/**
 * Nearer than this is allowed, but warned about.
 *
 * Derived, so the warning tracks the trigger instead of contradicting it. While
 * the dispatcher runs every minute this collapses onto the floor and the
 * warning never fires — correctly, because a campaign twenty minutes out will
 * go twenty minutes out. Set the interval to 60 and it starts warning about
 * anything inside three hours again, without anybody having to remember to.
 */
export const SCHEDULE_SOON_MS = Math.max(
  MIN_SCHEDULE_LEAD_MS,
  DISPATCH_INTERVAL_MINUTES * 3 * 60 * 1000,
);

/** "every minute" / "every 15 minutes", for the copy the desk reads. */
export function dispatchCadencePhrase(): string {
  return DISPATCH_INTERVAL_MINUTES === 1
    ? "every minute"
    : `every ${DISPATCH_INTERVAL_MINUTES} minutes`;
}

/**
 * A stored instant, as the `datetime-local` input expects to read it:
 * `YYYY-MM-DDTHH:mm` on **Cairo's** clock, whatever zone the device is in.
 */
export function toDateTimeLocalValue(iso: string): string {
  return utcToShopWallClock(iso);
}

/**
 * What the input holds — a Cairo wall-clock reading — as the UTC instant it
 * names, or null when it is empty, malformed, or falls in the hour Cairo skips
 * when summer time begins. The server repeats this conversion on its own; this
 * copy exists so the field can warn before the button is pressed.
 */
export function fromDateTimeLocalValue(value: string): string | null {
  const result = shopWallClockToUtc(value);
  return result.ok ? result.iso : null;
}

/** A stored instant, printed for a person: "19 Nov 2026, 17:10 Cairo". */
export function formatScheduledAt(iso: string): string {
  return formatShopDateTime(iso);
}

/** How a chosen moment sits against the floor and the warning threshold. */
export type ScheduleProximity = "past" | "too-soon" | "soon" | "fine";

/**
 * Where a `datetime-local` value falls, for the UI to say so before the server
 * has to. The server refuses the first two regardless — this is the courtesy,
 * not the guard.
 */
export function scheduleProximity(
  value: string,
  now: number = Date.now(),
): ScheduleProximity {
  const iso = fromDateTimeLocalValue(value);
  if (!iso) return "fine";

  const ahead = Date.parse(iso) - now;

  if (ahead <= 0) return "past";
  if (ahead < MIN_SCHEDULE_LEAD_MS) return "too-soon";
  if (ahead < SCHEDULE_SOON_MS) return "soon";
  return "fine";
}
