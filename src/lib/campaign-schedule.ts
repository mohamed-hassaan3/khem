/**
 * When a campaign is due, in the two forms it has to take.
 *
 * The database holds an instant — `timestamptz`, always UTC. The desk types a
 * wall-clock reading into a `datetime-local` input, which has no zone at all and
 * is interpreted by the browser as *local*. Those are different kinds of value,
 * and the whole of the scheduling timezone bug was one line that treated them as
 * the same kind: `scheduledAt.slice(0, 16)` handed the UTC digits to a field
 * that reads them as Cairo, so a letter scheduled for 17:00 redisplayed as 14:00
 * and moved three hours earlier every time it was saved again.
 *
 * **This module is the only place the two forms cross.** Nothing else may slice
 * an ISO string for a form field, and nothing else may hand a form field's value
 * to the server without passing it through here.
 *
 * ## Why every function here is browser-side
 *
 * "Local" is a fact about the person looking, not about the machine rendering.
 * On a server it is whatever zone the host happens to run in — UTC on most
 * platforms — so a value computed during SSR would be a different string from
 * the one the browser computes, which is both wrong and a hydration mismatch.
 * Callers seed these values in an effect after mount, never during render.
 *
 * ## The lead time is not a hosting limit
 *
 * `MIN_SCHEDULE_LEAD_MS` describes how far ahead a human should be asked to
 * plan. It is a floor on what may be *asked for*, and it does not move when the
 * trigger does.
 */

/** Nearer than this is refused: nothing can be relied on to run in the gap. */
export const MIN_SCHEDULE_LEAD_MS = 5 * 60 * 1000;

/**
 * How often the dispatcher is actually triggered, in minutes.
 *
 * The application cannot discover this. The trigger lives outside it — today an
 * external scheduler calling `/api/cron/send-campaigns` every minute, with
 * `vercel.json`'s daily run behind it as a backstop — so this number is a
 * statement *about* the deployment, kept in one place because three pieces of
 * copy are derived from it rather than each restating it.
 *
 * **Raise it whenever the trigger becomes less frequent, and never guess it
 * downwards.** Promising a precision nothing delivers is the exact failure this
 * scheduling work was undertaken to fix: a campaign set for 10:00 that went at
 * 14:09, because the only thing looking at the queue looked once a day.
 *
 * Five, not one, because five is what was observed. Production logs on 5 Sep
 * 2026 showed authenticated dispatch requests 196 seconds apart, and one alone
 * in a five-minute window — real evidence of a several-minute cadence, against
 * an assumption of sixty seconds. If the external schedule is later confirmed
 * to run every minute, this is the one line to change.
 */
// Typed `number`, not the literal `5`: the cadence phrase compares against 1,
// and a literal type would make that comparison a compile error every time this
// value is edited — which is a change this constant exists to invite.
export const DISPATCH_INTERVAL_MINUTES: number = 5;

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

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * A stored instant, as the `datetime-local` input expects to read it.
 *
 * `YYYY-MM-DDTHH:mm` in the viewer's own zone. The getters used here are the
 * local ones deliberately — `getUTCHours()` and friends would reproduce exactly
 * the bug this replaces.
 */
export function toDateTimeLocalValue(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";

  return (
    `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}` +
    `T${pad(when.getHours())}:${pad(when.getMinutes())}`
  );
}

/**
 * What the input holds, as the instant to store.
 *
 * A `datetime-local` value carries no offset, so `new Date()` resolves it
 * against the browser's zone — which is the reading the person intended — and
 * `toISOString()` states that same instant in UTC for the column.
 *
 * Returns null for an empty or unparseable field rather than an Invalid Date,
 * so a caller cannot send `"Invalid Date"` to the server by accident.
 */
export function fromDateTimeLocalValue(value: string): string | null {
  if (value.trim() === "") return null;

  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return null;

  return when.toISOString();
}

/** The zone the browser resolved to, e.g. `Africa/Cairo`. Empty on failure. */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

/**
 * A stored instant, printed for a person.
 *
 * The zone name is not decoration: a time without one is the ambiguity that
 * caused the original bug, and the desk has to be able to check the reading
 * against the clock on their wall. `timeZone` is left undefined so the platform
 * uses the viewer's own — pass "UTC" for the pre-hydration rendering, where the
 * viewer's zone is not yet known.
 */
export function formatScheduledAt(iso: string, timeZone?: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(when);
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
