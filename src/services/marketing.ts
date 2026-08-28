import "server-only";

/**
 * Marketing reads for the storefront — the bar, the popup, and the promotion map.
 *
 * ## Two keys, for two different reasons
 *
 * Announcements, the marketing settings row and the promotion view are read
 * through {@link getSupabasePublic}, the **publishable** key, like every other
 * storefront read: `supabase/sql/0035_marketing.sql` publishes only live rows,
 * and reading through a key that ignored those policies would mean a policy
 * mistake — next month's campaign visible today — never surfaces.
 *
 * The welcome offer behind the popup is read through the same publishable key,
 * from the `welcome_offer` view — two columns of one row, and deliberately not
 * the code. It used to be a secret-key read of `discounts` directly, and that
 * was wrong twice over: it put a privileged client in the render path of every
 * **prerendered** page in the site (the popup lives in the root layout), and it
 * reached for RLS-bypassing authority to fetch a number the site prints to
 * anybody who visits. See the view's header in
 * `supabase/sql/0035_marketing.sql` for what it does and does not publish.

 * `claimSubscriberOffer()` below is the one thing here that genuinely needs the
 * secret key: it *writes* an entitlement.
 *
 * ## Nothing here may hang the site
 *
 * These four reads are awaited by the **root layout**, which means they sit in
 * front of every page on the site — and a promise that never settles there does
 * not degrade a page, it replaces the whole app with `loading.tsx` forever. That
 * is not hypothetical: it is what a stale PostgREST schema cache did to this
 * build, and the reason `notify pgrst` now ends the migration.
 *
 * So every read here is bounded by {@link withTimeout}. A slow or unreachable
 * database costs the visitor a missing announcement bar, never a page that will
 * not paint. This is the same bargain `isSupabaseConfigured()` strikes for a
 * missing key, extended from "absent" to "not answering" — the two failures look
 * identical to somebody looking at the screen.
 *
 * ## Request-scoped memoisation
 *
 * `getProductPromotions()` is wrapped in React's `cache()`. A collection page
 * asks for it once per grid, once per related rail and once for its hero; the
 * wrapper turns that into one query per request. It is keyed by locale because
 * the labels it resolves are.
 */

import { cache } from "react";

import type { Locale } from "@/src/lib/i18n/config";
import { getSupabaseAdmin, getSupabasePublic } from "@/src/lib/supabase";
import {
  ANNOUNCEMENT_COLUMNS,
  MARKETING_SETTING_COLUMNS,
  PRODUCT_PROMOTION_COLUMNS,
  parseList,
  toAnnouncement,
  toMarketingSettings,
  toProductPromotion,
  toSubscriberOffer,
  toWelcomeOfferSummary,
} from "@/src/schemas/db/marketing";
import type {
  Announcement,
  MarketingSettings,
  ProductPromotion,
  WelcomeOfferSummary,
} from "@/src/types/marketing";

function logFailure(query: string, message: string): void {
  console.error(`[marketing] ${query} failed: ${message}`);
}

/**
 * How long the chrome may hold up a page. Generous enough that a cold pooler
 * connection still wins, short enough that nobody watches a spinner over it.
 *
 * Relaxed during `next build` for the reason `src/lib/supabase.ts` gives at
 * length: giving up quickly is right for one visitor and wrong for a prerender,
 * which would bake the missing bar into static HTML for everybody.
 */
const READ_TIMEOUT_MS =
  process.env.NEXT_PHASE === "phase-production-build" ? 60_000 : 4_000;

/**
 * What every read below hands back — the two fields supabase-js settles with.
 *
 * Narrower than the client's own generics on purpose: this module only ever asks
 * "did it answer, and with what", and a shape that small is one every caller
 * already knows how to fall back from.
 */
interface ReadResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/** What a read that never answered looks like: no data, and nothing to log twice. */
const NO_ANSWER: ReadResult<never> = { data: null, error: null };

/**
 * Resolve to an empty result if `work` has not settled in {@link READ_TIMEOUT_MS}.
 *
 * Takes a `PromiseLike` rather than a `Promise` because a supabase-js query
 * builder is a thenable, not a promise — it has no `.catch()` of its own, which
 * is exactly why the raw builder cannot be handed to `Promise.race()` and
 * expected to behave.
 *
 * The losing promise is **not** cancelled — supabase-js exposes no way to, and
 * an in-flight request nobody is waiting for costs a socket and nothing else.
 * What matters is that the render stops waiting.
 *
 * A rejection is caught here too. Every caller already turns an `error` field
 * into a fallback, but a client that *throws* — a DNS failure, an aborted socket
 * — would otherwise propagate out of the root layout and take the page with it.
 */
async function withTimeout<T>(
  label: string,
  work: PromiseLike<ReadResult<T>>,
): Promise<ReadResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const expiry = new Promise<ReadResult<T>>((resolve) => {
    timer = setTimeout(() => {
      console.error(`[marketing] ${label} timed out after ${READ_TIMEOUT_MS}ms`);
      resolve(NO_ANSWER);
    }, READ_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      Promise.resolve(work).catch((cause: unknown) => {
        console.error(
          `[marketing] ${label} threw: ${cause instanceof Error ? cause.message : "unknown error"}`,
        );
        return NO_ANSWER;
      }),
      expiry,
    ]);
  } finally {
    // Without this the timer keeps the event loop alive for the full window on
    // every render that answered quickly — four seconds of held handle per page.
    clearTimeout(timer);
  }
}

/**
 * The house defaults, used when the database cannot be reached.
 *
 * The bar disappears (there are no announcements to print anyway) and the popup
 * stays off. Failing toward *silence* is right for both: an unconfigured or
 * unreachable deployment should render a quieter site, never a modal over it.
 */
const FALLBACK_SETTINGS: MarketingSettings = {
  announcementsEnabled: false,
  announcementMode: "CAROUSEL",
  announcementIntervalMs: 5000,
  offerPopupEnabled: false,
  offerPopupDelayMs: 18000,
  offerPopupScrollPercent: 25,
  offerPopupSnoozeDays: 30,
  offerPopupEyebrow: null,
  offerPopupHeading: "Enter the World of KHEM",
  offerPopupBody: null,
  offerPopupImageUrl: "",
  offerPopupImageAlt: "",
};

export const getMarketingSettings = cache(async function getMarketingSettings(
  locale: Locale,
): Promise<MarketingSettings> {
  const supabase = getSupabasePublic();
  if (!supabase) return FALLBACK_SETTINGS;

  const { data, error } = await withTimeout(
    "getMarketingSettings",
    supabase
      .from("MarketingSetting")
      .select(MARKETING_SETTING_COLUMNS)
      .eq("id", "default")
      .maybeSingle(),
  );

  if (error) {
    logFailure("getMarketingSettings", error.message);
    return FALLBACK_SETTINGS;
  }

  return toMarketingSettings(data, locale) ?? FALLBACK_SETTINGS;
});

/**
 * Announcements that are live *now*, in display order.
 *
 * The window is in the query as well as in the row policy. Neither is trusted
 * alone: the policy is the access control and this is the ordering, and a
 * scheduled campaign must not appear because one of them was edited.
 */
export const getLiveAnnouncements = cache(async function getLiveAnnouncements(
  locale: Locale,
): Promise<Announcement[]> {
  const supabase = getSupabasePublic();
  if (!supabase) return [];

  const now = new Date().toISOString();

  const { data, error } = await withTimeout(
    "getLiveAnnouncements",
    supabase
      .from("Announcement")
      .select(ANNOUNCEMENT_COLUMNS)
      .eq("isActive", true)
      .or(`startsAt.is.null,startsAt.lte.${now}`)
      .or(`endsAt.is.null,endsAt.gt.${now}`)
      .order("sortOrder")
      .order("createdAt")
      // A bar is chrome, not a feed. Twenty is far beyond what anybody would
      // read and is here to bound the payload rather than to be reached.
      .limit(20),
  );

  if (error) {
    logFailure("getLiveAnnouncements", error.message);
    return [];
  }

  return parseList(data, (row) => toAnnouncement(row, locale));
});

/**
 * Every product currently under a promotion, keyed by slug.
 *
 * One query for the whole catalog rather than a join per grid: promotions are
 * campaign-shaped — a handful of rows covering at most the catalog — so the map
 * is small, and fetching it once per request is cheaper than a correlated
 * subquery on every list read. `src/services/products.ts` attaches it.
 *
 * An empty map is the correct answer to every failure here. A missing promotion
 * shows the list price, which is a real price the house will honour; the
 * opposite failure — showing a reduction the checkout does not apply — is the
 * one worth engineering against.
 */
export const getProductPromotions = cache(async function getProductPromotions(
  locale: Locale,
): Promise<ReadonlyMap<string, ProductPromotion>> {
  const empty = new Map<string, ProductPromotion>();

  const supabase = getSupabasePublic();
  if (!supabase) return empty;

  const { data, error } = await withTimeout(
    "getProductPromotions",
    supabase.from("active_product_promotions").select(PRODUCT_PROMOTION_COLUMNS),
  );

  if (error) {
    logFailure("getProductPromotions", error.message);
    return empty;
  }

  const entries = parseList(data, (row) => toProductPromotion(row, locale));

  return new Map(entries.map((entry) => [entry.slug, entry.promotion]));
});

/**
 * The promotional unit price of every promoted product, keyed by slug.
 *
 * The order path's counterpart to {@link getProductPromotions}. Two differences,
 * both deliberate:
 *
 *  - it reads through the **secret** client, because its caller is pricing a bag
 *    on the way to an order rather than rendering a page for a visitor;
 *  - it returns bare numbers, because nothing downstream prints a label.
 *
 * Still not authoritative. `place_order()` re-reads the same view under a row
 * lock inside the transaction that writes the order — this exists so the
 * delivery fee is computed against the prices the customer will actually be
 * charged, and a stale answer here costs at most a wrong delivery line on a
 * checkout that has not been submitted.
 */
export async function promotionalPricesBySlug(): Promise<
  ReadonlyMap<string, number>
> {
  const empty = new Map<string, number>();

  const supabase = getSupabaseAdmin();
  if (!supabase) return empty;

  /*
   * Bounded like its storefront twin, but the consequence of the fallback is
   * different and worth naming: an empty map here means the **delivery fee** is
   * computed against list prices. `place_order()` still charges the promotional
   * ones — it reads the view itself, under a lock — so the worst case is a
   * delivery line that is wrong in the customer's favour, never a wrong price.
   */
  const { data, error } = await withTimeout(
    "promotionalPricesBySlug",
    supabase
      .from("active_product_promotions")
      .select("productSlug, priceInCents, listPriceInCents"),
  );

  if (error) {
    logFailure("promotionalPricesBySlug", error.message);
    return empty;
  }

  const prices = new Map<string, number>();

  for (const row of data ?? []) {
    const slug = (row as { productSlug?: unknown }).productSlug;
    const price = (row as { priceInCents?: unknown }).priceInCents;
    const list = (row as { listPriceInCents?: unknown }).listPriceInCents;

    // Same guard `toProductPromotion()` applies: a "promotion" that does not
    // reduce anything must not become a price at all.
    if (
      typeof slug !== "string" ||
      typeof price !== "number" ||
      typeof list !== "number" ||
      price < 0 ||
      price >= list
    ) {
      continue;
    }

    prices.set(slug, price);
  }

  return prices;
}

/**
 * What the popup may promise — the live welcome offer, or nothing.
 *
 * Never a constant. The percentage printed in the popup is the value on
 * `discounts."isWelcome"`, judged the same way `resolve_discount()` judges any
 * code, so the popup cannot advertise a campaign the checkout would refuse.
 */
export const getWelcomeOffer = cache(async function getWelcomeOffer(): Promise<
  WelcomeOfferSummary | null
> {
  const supabase = getSupabasePublic();
  if (!supabase) return null;

  /*
   * The window is judged by the function, not here. One definition of "is this
   * offer running", shared with `claim_subscriber_offer()` and
   * `resolve_discount()`, so the popup cannot promise a campaign the checkout
   * refuses.
   *
   * `welcome_offer()` returns a set — zero rows when no offer is running — so
   * the result is an array and the first row is the answer.
   */
  const { data, error } = await withTimeout(
    "getWelcomeOffer",
    supabase.rpc("welcome_offer"),
  );

  if (error) {
    logFailure("getWelcomeOffer", error.message);
    return null;
  }

  return toWelcomeOfferSummary(Array.isArray(data) ? data[0] : data);
});

/**
 * Issue the welcome entitlement to an address that has just subscribed.
 *
 * A thin pair over `claim_subscriber_offer()`, which does all the deciding —
 * see `supabase/sql/0035_marketing.sql`. Returns null when nothing was granted,
 * which the action reports as a plain successful subscription rather than as a
 * failure: being on the list is the thing that was asked for.
 *
 * The address is never logged. Same rule as `src/services/newsletter.ts`.
 */
export async function claimSubscriberOffer(
  email: string,
  clerkUserId: string | null = null,
): Promise<{ code: string | null; expiresAt: string | null } | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("claim_subscriber_offer", {
    payload: { email, clerkUserId },
  });

  if (error) {
    logFailure("claimSubscriberOffer", error.message);
    return null;
  }

  const parsed = toSubscriberOffer(data);

  return parsed ? { code: parsed.code, expiresAt: parsed.expiresAt } : null;
}
