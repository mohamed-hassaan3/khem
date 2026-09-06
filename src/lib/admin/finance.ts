/**
 * Reading the finance screens' URL, and the arithmetic they do in TypeScript.
 *
 * Everything that adds up money happens in Postgres — see
 * `supabase/sql/0063_finance.sql`. What is left here is turning
 * `?period=last-month` into two dates, dividing integers without ever dividing
 * by zero, and working out how much has to be sold per remaining day.
 *
 * ## Why this is a second period vocabulary rather than a change to sales
 *
 * `src/lib/admin/sales.ts` offers today / week / month / year / all. Finance
 * needs two the brief names that sales does not have — *yesterday* and
 * *previous month* — and every one of its windows is a pair of **dates**
 * (`YYYY-MM-DD`) rather than timestamps, because an expense is recorded against
 * a day and not an instant. Widening the sales vocabulary would have changed the
 * URLs of two working screens to serve a third; `parseIsoDate`, `marginPercent`
 * and `formatMargin` are imported from there rather than restated.
 *
 * UTC, for that module's reason: every other date boundary in this repository
 * is UTC, and a Finance "September" that disagreed with the Sales & Profit
 * September beside it would be worse than one that is two hours out from Cairo.
 */

export { marginPercent, parseIsoDate, formatMargin } from "./sales";

/** The windows the period switch offers. Anything else is not a valid URL. */
export const FINANCE_PERIODS = [
  "today",
  "yesterday",
  "week",
  "month",
  "last-month",
  "year",
  "all",
] as const;

export type FinancePeriod = (typeof FINANCE_PERIODS)[number];

export const DEFAULT_FINANCE_PERIOD: FinancePeriod = "month";

export const FINANCE_PERIOD_LABEL: Record<FinancePeriod, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  month: "This month",
  "last-month": "Previous month",
  year: "This year",
  all: "All time",
};

export function parseFinancePeriod(
  value: string | string[] | undefined,
): FinancePeriod {
  const raw = Array.isArray(value) ? value[0] : value;
  return (FINANCE_PERIODS as readonly string[]).includes(raw ?? "")
    ? (raw as FinancePeriod)
    : DEFAULT_FINANCE_PERIOD;
}

/** A window of whole days, inclusive at both ends. Null means unbounded. */
export interface FinanceWindow {
  /** `YYYY-MM-DD`, or null for "since the first thing that happened". */
  from: string | null;
  /** `YYYY-MM-DD`, or null for "up to today". */
  to: string | null;
}

/** `YYYY-MM-DD` in UTC — the form every finance function takes and returns. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Midnight UTC today, as a `Date` that can be walked backwards safely. */
function utcToday(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

/**
 * The window a request is asking for.
 *
 * A custom range wins over the period, and either end of it may be given alone
 * — "everything since March" is a question a desk asks. When neither is given
 * the period decides, and `all` is the one window with no bounds at all.
 *
 * Every period except `all` closes at **today**, not at some point in the
 * future: a month-to-date figure that quietly included an empty rest-of-month
 * would make every average wrong.
 */
export function financeWindow(
  period: FinancePeriod,
  from?: string,
  to?: string,
): FinanceWindow {
  if (from || to) {
    return { from: from ?? null, to: to ?? null };
  }

  if (period === "all") return { from: null, to: null };

  const today = utcToday();

  if (period === "today") {
    return { from: isoDay(today), to: isoDay(today) };
  }

  if (period === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return { from: isoDay(yesterday), to: isoDay(yesterday) };
  }

  if (period === "week") {
    // Monday, because a retail week does. `getUTCDay()` is 0 on Sunday, which
    // is six days into the week rather than the start of one.
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    return { from: isoDay(start), to: isoDay(today) };
  }

  if (period === "last-month") {
    const start = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
    );
    // Day zero of this month is the last day of the previous one, whatever its
    // length — no month-length table, and February is not a special case.
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
    return { from: isoDay(start), to: isoDay(end) };
  }

  if (period === "year") {
    return {
      from: isoDay(new Date(Date.UTC(today.getUTCFullYear(), 0, 1))),
      to: isoDay(today),
    };
  }

  // `month`, the default.
  return {
    from: isoDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))),
    to: isoDay(today),
  };
}

/**
 * The period immediately before this one, of the same length.
 *
 * What the comparison block measures against. A calendar month compares against
 * the calendar month before it — 31 days against 28 is what "September vs
 * August" means to a desk — and any other window compares against the same
 * number of days ending the day before it starts.
 *
 * Returns null for an unbounded window: "all time" has nothing before it.
 */
export function previousWindow(window: FinanceWindow): FinanceWindow | null {
  if (!window.from || !window.to) return null;

  const from = new Date(`${window.from}T00:00:00.000Z`);
  const to = new Date(`${window.to}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;

  const isWholeMonth =
    from.getUTCDate() === 1 &&
    to.getUTCMonth() === from.getUTCMonth() &&
    to.getUTCFullYear() === from.getUTCFullYear() &&
    to.getUTCDate() ===
      new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0)).getUTCDate();

  if (isWholeMonth) {
    return {
      from: isoDay(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1))),
      to: isoDay(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 0))),
    };
  }

  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

  const prevTo = new Date(from);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1));

  return { from: isoDay(prevFrom), to: isoDay(prevTo) };
}

/**
 * The month whose targets a window is about.
 *
 * The month containing the window's start — so choosing *Previous month* shows
 * August's target beside August's actuals, and a custom range starting in July
 * shows July's. An unbounded window has no month, and falls back to the current
 * one, which is the only month a desk could mean by "all time".
 */
export function targetMonthOf(window: FinanceWindow): string {
  const anchor = window.from ? new Date(`${window.from}T00:00:00.000Z`) : new Date();
  const safe = Number.isNaN(anchor.getTime()) ? new Date() : anchor;
  return isoDay(new Date(Date.UTC(safe.getUTCFullYear(), safe.getUTCMonth(), 1)));
}

/**
 * The whole of one month, as a window.
 *
 * Day zero of the next month is the last day of this one, whatever its length —
 * so February needs no special case and a leap year needs no table.
 */
export function monthBounds(periodMonth: string): FinanceWindow {
  const start = new Date(`${periodMonth}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return { from: null, to: null };

  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();

  return {
    from: isoDay(new Date(Date.UTC(year, month, 1))),
    to: isoDay(new Date(Date.UTC(year, month + 1, 0))),
  };
}

/** `September 2026`, from a `YYYY-MM-DD` first-of-month. */
export function monthLabel(periodMonth: string): string {
  const date = new Date(`${periodMonth}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return periodMonth;
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** `6 Sep 2026`, from a `YYYY-MM-DD`. */
export function dayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** How a target is doing. Every field null-safe, nothing invented. */
export interface TargetProgress {
  targetInCents: number;
  actualInCents: number | null;
  /** What is still to be earned. Zero once the target is met, never negative. */
  remainingInCents: number | null;
  /** Percent of the target achieved, or null when the actual is unknown. */
  achievement: number | null;
}

/**
 * Target versus actual.
 *
 * `actual` is nullable because gross and net profit are: a month whose sales
 * carry no cost has an unknown profit, and reporting 0% achievement against a
 * profit target would be a claim rather than an absence.
 */
export function targetProgress(
  targetInCents: number | null,
  actualInCents: number | null,
): TargetProgress | null {
  if (targetInCents === null || targetInCents <= 0) return null;

  if (actualInCents === null) {
    return {
      targetInCents,
      actualInCents: null,
      remainingInCents: null,
      achievement: null,
    };
  }

  return {
    targetInCents,
    actualInCents,
    remainingInCents: Math.max(targetInCents - actualInCents, 0),
    achievement: (actualInCents / targetInCents) * 100,
  };
}

/** How a month is progressing against the clock. */
export interface MonthPace {
  /** Days in the month, whatever its length. */
  daysInMonth: number;
  /** Days already spent, including today. Equal to `daysInMonth` once past. */
  daysElapsed: number;
  daysRemaining: number;
  /** Target ÷ days in the month — the flat pace the month was set at. */
  averageDailyTargetInCents: number;
  /**
   * What must now be earned per remaining day.
   *
   * Null when the target is already met (nothing is required) or when the month
   * is over (there is no day left to earn it in) — both of which are answers a
   * division would have turned into an infinity or a negative.
   */
  requiredPerRemainingDayInCents: number | null;
}

/**
 * The pace line, for the month a window is about.
 *
 * `asOf` is passed rather than read from the clock so a server render and the
 * figures beside it agree on what "today" is, and so this stays a pure function.
 */
export function monthPace(
  periodMonth: string,
  targetInCents: number,
  actualInCents: number,
  asOf: Date = new Date(),
): MonthPace | null {
  const start = new Date(`${periodMonth}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || targetInCents <= 0) return null;

  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const today = new Date(asOf);
  today.setUTCHours(0, 0, 0, 0);

  const isSameMonth =
    today.getUTCFullYear() === year && today.getUTCMonth() === month;
  const isPast =
    today.getUTCFullYear() > year ||
    (today.getUTCFullYear() === year && today.getUTCMonth() > month);

  // A month still ahead of us has spent none of itself; one behind us has spent
  // all of it. Only the current month asks the clock.
  const daysElapsed = isSameMonth
    ? today.getUTCDate()
    : isPast
      ? daysInMonth
      : 0;

  const daysRemaining = daysInMonth - daysElapsed;
  const shortfall = targetInCents - actualInCents;

  return {
    daysInMonth,
    daysElapsed,
    daysRemaining,
    averageDailyTargetInCents: Math.round(targetInCents / daysInMonth),
    requiredPerRemainingDayInCents:
      shortfall <= 0 || daysRemaining <= 0
        ? null
        : Math.ceil(shortfall / daysRemaining),
  };
}

/**
 * Period-over-period change, as a percentage.
 *
 * Null when the question cannot be answered: either side unknown, or a previous
 * period of zero. Growth from nothing is not "+100%" and is not infinite — it is
 * a comparison that does not exist, and the screen prints an em dash for it.
 */
export function changePercent(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** `+18.4%`, `−6.2%`, or an em dash. */
export function formatChange(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

/** `115%` — an achievement, which is never negative and is often over 100. */
export function formatAchievement(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

export const EXPENSE_STATUS_LABEL = {
  PENDING: "Unpaid",
  PAID: "Paid",
  VOID: "Void",
} as const;

export const EXPENSE_STATUSES = ["PENDING", "PAID", "VOID"] as const;

export function parseExpenseStatus(
  value: string,
): "PENDING" | "PAID" | "VOID" | null {
  return (EXPENSE_STATUSES as readonly string[]).includes(value)
    ? (value as "PENDING" | "PAID" | "VOID")
    : null;
}

export const EXPENSE_GROUP_LABEL = {
  OPERATIONS: "Operations",
  PEOPLE: "People",
  BUSINESS: "Business",
  MARKETING: "Marketing",
  PRODUCTION: "Production / Packaging",
  OTHER: "Other",
} as const;

export const EXPENSE_GROUPS = [
  "OPERATIONS",
  "PEOPLE",
  "BUSINESS",
  "MARKETING",
  "PRODUCTION",
  "OTHER",
] as const;

export const EXPENSE_CADENCE_LABEL = {
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
} as const;

/** What the recurring filter on the Expenses table may be set to. */
export type RecurrenceFilter = "recurring" | "one-time";

export function parseRecurrence(value: string): RecurrenceFilter | null {
  return value === "recurring" || value === "one-time" ? value : null;
}

/**
 * Daily or monthly, on the reports screen.
 *
 * A daily series over three years is 1,095 points on a 900px canvas, which is
 * not a chart anybody can read — `resolveGranularity` below quietly promotes a
 * long window to months, and the screen says it did.
 */
export const GRANULARITIES = ["daily", "monthly"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export function parseGranularity(value: string | string[] | undefined): Granularity {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "monthly" ? "monthly" : "daily";
}

/** Beyond this many days, a daily chart stops being legible. */
const DAILY_LIMIT_DAYS = 120;

/** How many whole days a window spans, or null when it is unbounded. */
export function windowDays(window: FinanceWindow): number | null {
  if (!window.from || !window.to) return null;
  const from = new Date(`${window.from}T00:00:00.000Z`).getTime();
  const to = new Date(`${window.to}T00:00:00.000Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86_400_000) + 1;
}

/** The granularity actually used, which may not be the one that was asked for. */
export function resolveGranularity(
  asked: Granularity,
  window: FinanceWindow,
): Granularity {
  if (asked === "monthly") return "monthly";
  const days = windowDays(window);
  return days === null || days > DAILY_LIMIT_DAYS ? "monthly" : "daily";
}
