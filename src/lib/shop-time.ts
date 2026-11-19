/**
 * The boutique's clock — Africa/Cairo — and the only place it is named.
 *
 * The database stores instants (`timestamptz`, UTC) and that does not change.
 * What this module decides is how a *person* at the house reads and writes
 * them: every admin time is typed as Cairo wall-clock time, shown as Cairo
 * time with the zone said out loud, and every report day runs from Cairo
 * midnight to Cairo midnight (prompts/cairo-time-zone.md).
 *
 * ## Why not the viewer's own zone
 *
 * The admin used to read schedules in the *browser's* zone. That is right only
 * while the browser happens to be in Cairo: a phone abroad, a VPN, or a laptop
 * still set to Berlin silently moved every campaign by the difference. The shop
 * keeps one clock, and so a fixed zone also renders the same string on the
 * server and in the browser — no hydration pass, no "UTC until mounted".
 *
 * ## Why `Intl` and no hand-written offset
 *
 * Egypt observes summer time (UTC+3 from late April to late October, UTC+2
 * otherwise), and has changed the rule more than once. The platform's tz
 * database knows each transition; a `+02:00` constant would be wrong for half
 * the year. Everything below asks `Intl.DateTimeFormat` with
 * `timeZone: "Africa/Cairo"` — the same database Postgres uses for
 * `at time zone 'Africa/Cairo'` in `supabase/sql/0077_cairo_report_days.sql`.
 *
 * Isomorphic and dependency-free: used by server components, server actions
 * and the schedule field alike.
 */

/** The boutique's time zone. */
export const SHOP_TIME_ZONE = "Africa/Cairo";

/** What the admin prints after a time, so it can never be misread. */
export const SHOP_ZONE_LABEL = "Cairo";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The Cairo wall clock at an instant. */
function wallClockAt(instantMs: number): WallClock {
  const out: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(new Date(instantMs))) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return {
    year: out.year ?? 0,
    month: out.month ?? 0,
    day: out.day ?? 0,
    // Some engines still print midnight as "24" under h23; it is hour 0.
    hour: (out.hour ?? 0) % 24,
    minute: out.minute ?? 0,
  };
}

/** Cairo's offset from UTC at an instant, in milliseconds (+2h → 7_200_000). */
function offsetAt(instantMs: number): number {
  const w = wallClockAt(instantMs);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  // Seconds are not in the parts; drop them from the instant too.
  return asUtc - Math.floor(instantMs / MINUTE_MS) * MINUTE_MS;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function sameWallClock(a: WallClock, b: WallClock): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute
  );
}

const WALL_CLOCK_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Every instant whose Cairo wall clock reads `wall`, earliest first.
 *
 * Usually one. None for the hour skipped when summer time begins; two for the
 * hour repeated when it ends. Candidates are built from the offsets in force a
 * day either side, which covers any single transition.
 */
function instantsFor(wall: WallClock): number[] {
  const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  const offsets = new Set([offsetAt(naive - DAY_MS), offsetAt(naive), offsetAt(naive + DAY_MS)]);

  const found = new Set<number>();
  for (const offset of offsets) {
    const candidate = naive - offset;
    if (sameWallClock(wallClockAt(candidate), wall)) found.add(candidate);
  }
  return [...found].sort((a, b) => a - b);
}

function parseWallClock(value: string): WallClock | null {
  const match = WALL_CLOCK_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const wall: WallClock = {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: Number(h),
    minute: Number(mi),
  };
  // Reject 2026-02-31 and 25:00 rather than letting Date.UTC roll them over.
  const check = new Date(Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute));
  if (
    check.getUTCFullYear() !== wall.year ||
    check.getUTCMonth() !== wall.month - 1 ||
    check.getUTCDate() !== wall.day ||
    check.getUTCHours() !== wall.hour ||
    check.getUTCMinutes() !== wall.minute
  ) {
    return null;
  }
  return wall;
}

export type ShopTimeResult =
  | { ok: true; iso: string }
  | { ok: false; reason: "invalid" | "nonexistent" };

/**
 * A Cairo wall-clock reading (`YYYY-MM-DDTHH:mm`, what a `datetime-local`
 * input holds) as the UTC instant to store.
 *
 * - The skipped hour when summer time begins does not exist in Cairo and is
 *   refused as `nonexistent` — the desk is asked to pick a real time rather
 *   than having one silently chosen for them.
 * - The repeated hour when it ends resolves to its first occurrence.
 */
export function shopWallClockToUtc(value: string): ShopTimeResult {
  const wall = parseWallClock(value);
  if (!wall) return { ok: false, reason: "invalid" };

  const [first] = instantsFor(wall);
  if (first === undefined) return { ok: false, reason: "nonexistent" };
  return { ok: true, iso: new Date(first).toISOString() };
}

/** A stored instant as a Cairo `YYYY-MM-DDTHH:mm`, for a `datetime-local` field. */
export function utcToShopWallClock(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const w = wallClockAt(ms);
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/** The Cairo calendar date (`YYYY-MM-DD`) at an instant — "now" by default. */
export function shopDate(instant: Date | string | number = Date.now()): string {
  const ms = instant instanceof Date ? instant.getTime() : typeof instant === "string" ? Date.parse(instant) : instant;
  const w = wallClockAt(ms);
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`;
}

/**
 * The first instant of a Cairo calendar day, as an ISO string.
 *
 * Usually 22:00 UTC the evening before (21:00 in summer). On the day summer
 * time begins Cairo skips from 00:00 straight to 01:00, so midnight does not
 * exist; the day then starts at the transition itself.
 */
export function shopDayStartUtc(day: string): string | null {
  const match = DAY_PATTERN.exec(day.trim());
  if (!match) return null;
  const [, y, mo, d] = match;
  const year = Number(y);
  const month = Number(mo);
  const date = Number(d);

  const midnight = instantsFor({ year, month, day: date, hour: 0, minute: 0 });
  if (midnight[0] !== undefined) return new Date(midnight[0]).toISOString();

  // Midnight skipped: the earliest instant whose Cairo date is this day.
  const naive = Date.UTC(year, month - 1, date);
  const offsets = [offsetAt(naive - DAY_MS), offsetAt(naive + DAY_MS)];
  const starts = offsets
    .map((offset) => naive - offset)
    .filter((candidate) => shopDate(candidate) === day.trim())
    .sort((a, b) => a - b);
  return starts[0] === undefined ? null : new Date(starts[0]).toISOString();
}

/** The last millisecond of a Cairo calendar day, as an ISO string. */
export function shopDayEndUtc(day: string): string | null {
  const match = DAY_PATTERN.exec(day.trim());
  if (!match) return null;
  const next = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1));
  const nextStart = shopDayStartUtc(next.toISOString().slice(0, 10));
  return nextStart === null ? null : new Date(Date.parse(nextStart) - 1).toISOString();
}

/**
 * Today in Cairo as a `Date` at **UTC midnight of that calendar date** — the
 * shape the finance and sales window arithmetic walks with UTC getters, where
 * a `Date` stands for a calendar day rather than an instant.
 */
export function shopTodayAsCalendarDate(now: number = Date.now()): Date {
  return new Date(`${shopDate(now)}T00:00:00.000Z`);
}

type DateStyle = "short" | "long";

/**
 * A stored instant with its time, in Cairo, labelled:
 * "19 Nov 2026, 17:10 Cairo".
 */
export function formatShopDateTime(
  iso: string | null | undefined,
  { month = "short" as DateStyle, zone = true } = {},
): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const text = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month,
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: SHOP_TIME_ZONE,
  }).format(ms);
  return zone ? `${text} ${SHOP_ZONE_LABEL}` : text;
}

/** A stored instant's Cairo calendar date: "19 Nov 2026". */
export function formatShopDate(
  iso: string | null | undefined,
  { month = "short" as DateStyle } = {},
): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month,
    year: "numeric",
    timeZone: SHOP_TIME_ZONE,
  }).format(ms);
}
