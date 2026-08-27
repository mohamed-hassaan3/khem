import "server-only";

/**
 * Inner Circle reads for the dashboard.
 *
 * Same authority and same failure posture as `./customers.ts`: the secret key,
 * behind `requireAdmin()`, returning an empty projection and logging the
 * provider's message rather than throwing into a page.
 *
 * The unsubscribe token is not in any projection here. Nothing on a dashboard
 * screen needs it, and a value that can remove somebody from a list has no
 * business travelling into a page payload.
 */

import { getSupabaseAdmin } from "@/src/lib/supabase";
import {
  parseList,
  toNewsletterCounts,
  toSubscriberWithTotal,
} from "@/src/schemas/db/newsletter";
import type {
  NewsletterCounts,
  NewsletterPage,
  NewsletterStatus,
} from "@/src/types/newsletter";

function logFailure(query: string, message: string): void {
  console.error(`[admin] ${query} failed: ${message}`);
}

/** A desk screen's worth. The RPC caps it at 200 whatever is asked for. */
export const SUBSCRIBERS_PER_PAGE = 50;

export interface NewsletterListFilter {
  search?: string;
  status?: NewsletterStatus;
  offset?: number;
  limit?: number;
}

const EMPTY_PAGE: NewsletterPage = { subscribers: [], total: 0 };

/** One page of the list, newest first. */
export async function listSubscribers(
  filter: NewsletterListFilter = {},
): Promise<NewsletterPage> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return EMPTY_PAGE;

  const { data, error } = await supabase.rpc("newsletter_list", {
    search_term: filter.search ?? "",
    status_filter: filter.status ?? "",
    limit_count: filter.limit ?? SUBSCRIBERS_PER_PAGE,
    offset_count: filter.offset ?? 0,
  });

  if (error) {
    logFailure("listSubscribers", error.message);
    return EMPTY_PAGE;
  }

  const rows = parseList(Array.isArray(data) ? data : [], toSubscriberWithTotal);

  return {
    subscribers: rows.map((row) => row.subscriber),
    total: rows[0]?.total ?? 0,
  };
}

/**
 * The three figures above the list.
 *
 * Counted over the whole table rather than the page: a number that changed when
 * you turned the page would be describing the page, not the list.
 */
export async function getNewsletterCounts(): Promise<NewsletterCounts> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { total: 0, subscribed: 0, unsubscribed: 0 };

  const { data, error } = await supabase.rpc("newsletter_counts");

  if (error) {
    logFailure("getNewsletterCounts", error.message);
    return { total: 0, subscribed: 0, unsubscribed: 0 };
  }

  return toNewsletterCounts(data);
}
