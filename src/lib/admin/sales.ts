/**
 * Reading the sales screens' URL, and the two bits of arithmetic they do.
 *
 * Everything that adds up money happens in Postgres — see
 * `supabase/sql/0062_sales_ledger.sql`. What is left for TypeScript is turning
 * `?period=month` into two timestamps, and dividing one integer by another
 * without ever dividing by zero.
 *
 * ## Why the windows are calendar windows, and why they are UTC
 *
 * "This month" means the month, not thirty days: a desk closing the books asks
 * for September, not for the last four and a bit weeks. `/admin/analytics` asks
 * the other question — a rolling 7/30/90 — and both are legitimate, which is
 * why the two screens are separate rather than one with an overloaded switch.
 *
 * UTC because every other date boundary in this repository is UTC:
 * `daily_sales()` casts `at time zone 'UTC'`, and a report whose "today"
 * disagreed with the chart beside it would be worse than one that is two hours
 * out from Cairo. When the boutique wants Africa/Cairo it is one constant here
 * and one cast there, changed together.
 */

import type { DiscountSource, SaleStatus } from "@/src/types/sales";

/** The windows the period switch offers. Anything else is not a valid URL. */
export const SALES_PERIODS = ["today", "week", "month", "year", "all"] as const;

export type SalesPeriod = (typeof SALES_PERIODS)[number];

export const DEFAULT_PERIOD: SalesPeriod = "month";

export const SALES_PERIOD_LABEL: Record<SalesPeriod, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
  all: "All time",
};

/** Read `?period=` without trusting it — an unknown value is the default. */
export function parseSalesPeriod(
  value: string | string[] | undefined,
): SalesPeriod {
  const raw = Array.isArray(value) ? value[0] : value;
  return (SALES_PERIODS as readonly string[]).includes(raw ?? "")
    ? (raw as SalesPeriod)
    : DEFAULT_PERIOD;
}

/** `YYYY-MM-DD`, or nothing. Anything else is ignored rather than queried. */
export function parseIsoDate(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? raw
    : undefined;
}

export interface SalesWindow {
  /** Inclusive lower bound as an ISO timestamp, or null for "since the first sale". */
  from: string | null;
  /** Inclusive upper bound as an ISO timestamp, or null for "up to now". */
  to: string | null;
}

/**
 * The window a request is asking for.
 *
 * A custom range wins over the period, and either end of it may be given alone
 * — "everything since March" is a question a desk asks. When neither is given
 * the period decides, and `all` is the one window with no bounds at all.
 */
export function salesWindow(
  period: SalesPeriod,
  from?: string,
  to?: string,
): SalesWindow {
  if (from || to) {
    return {
      from: from ? `${from}T00:00:00.000Z` : null,
      // Inclusive of the whole closing day, which is what a date picker means
      // by it — the alternative silently drops everything sold that afternoon.
      to: to ? `${to}T23:59:59.999Z` : null,
    };
  }

  if (period === "all") return { from: null, to: null };

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  if (period === "week") {
    // Monday, because a retail week does. `getUTCDay()` is 0 on Sunday, which
    // is six days into the week rather than the start of one.
    const weekday = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - weekday);
  } else if (period === "month") {
    start.setUTCDate(1);
  } else if (period === "year") {
    start.setUTCMonth(0, 1);
  }

  return { from: start.toISOString(), to: null };
}

/**
 * Gross margin as a percentage, or `null` when the question cannot be answered.
 *
 * Two ways it cannot: nothing was costed (`profit` is null), or nothing was
 * paid (a window of entirely free goods). Both return null rather than zero,
 * because a margin of 0% is a claim and "we do not know" is not.
 */
export function marginPercent(
  profitInCents: number | null,
  revenueInCents: number,
): number | null {
  if (profitInCents === null) return null;
  if (revenueInCents <= 0) return null;
  return (profitInCents / revenueInCents) * 100;
}

/** `48.9%`, or an em dash when there is no margin to state. */
export function formatMargin(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export const DISCOUNT_SOURCE_LABEL: Record<DiscountSource, string> = {
  PROMOTION: "Promotion",
  OFFER: "Offer",
  COUPON: "Coupon",
  REWARDS: "Rewards",
  DISCOVERY_CREDIT: "Discovery Credit",
};

export const DISCOUNT_SOURCES = [
  "PROMOTION",
  "OFFER",
  "COUPON",
  "REWARDS",
  "DISCOVERY_CREDIT",
] as const satisfies readonly DiscountSource[];

export function parseDiscountSource(value: string): DiscountSource | null {
  return (DISCOUNT_SOURCES as readonly string[]).includes(value)
    ? (value as DiscountSource)
    : null;
}

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  SOLD: "Sold",
  PAID: "Paid",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

export const SALE_STATUSES = [
  "SOLD",
  "PAID",
  "REFUNDED",
  "CANCELLED",
] as const satisfies readonly SaleStatus[];

export function parseSaleStatus(value: string): SaleStatus | null {
  return (SALE_STATUSES as readonly string[]).includes(value)
    ? (value as SaleStatus)
    : null;
}

/** What the "free / paid" switch on Items Sold may be set to. */
export type GiveawayFilter = "free" | "paid";

export function parseGiveaway(value: string): GiveawayFilter | null {
  return value === "free" || value === "paid" ? value : null;
}
