/**
 * Fixed-window throttle for the public form actions.
 *
 * Same shape as the limiter in `src/app/api/search/route.ts`, kept separate
 * rather than shared: that one guards billed embedding calls at 20 per 10
 * seconds, these guard an inbox a human reads, where the tolerable rate is
 * three orders of magnitude lower. One abstraction over two limits that far
 * apart would be a config object pretending to be a utility.
 *
 * Held in process memory, so it is per-instance and lost on redeploy — stated
 * plainly rather than papered over. It stops a hammering tab or a naive script,
 * not a distributed flood. Upstash or Vercel KV is the upgrade when this app
 * runs on more than a couple of instances.
 */

import { headers } from "next/headers";

interface Window {
  count: number;
  resetAt: number;
}

const hits = new Map<string, Window>();

export interface RateLimit {
  /** Submissions allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Record a hit and report whether the caller has exhausted its window.
 *
 * `scope` namespaces the counters so a newsletter signup does not consume a
 * visitor's contact-form budget.
 */
export function isRateLimited(
  scope: string,
  client: string,
  { limit, windowMs }: RateLimit,
): boolean {
  const now = Date.now();
  const key = `${scope}:${client}`;
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });

    // Opportunistic sweep — without it the map is an unbounded memory leak
    // keyed by anything that can spoof a header.
    if (hits.size > 5_000) {
      for (const [existing, window] of hits) {
        if (now > window.resetAt) hits.delete(existing);
      }
    }

    return false;
  }

  entry.count += 1;
  return entry.count > limit;
}

/**
 * Best-effort client identity for a Server Action.
 *
 * `x-forwarded-for` is spoofable in general; on Vercel the platform sets it and
 * the leftmost entry is the real client. Good enough for a throttle whose worst
 * failure is a limit applied slightly too broadly.
 */
export async function clientKey(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
