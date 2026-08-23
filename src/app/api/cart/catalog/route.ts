/**
 * `GET /api/cart/catalog?locale=…` — the projection the cart panel resolves
 * its stored lines against.
 *
 * A thin handler (AGENTS.md §6): validate the locale, delegate to
 * `src/services/products.ts`, return. No business logic lives here.
 *
 * ## Why the panel fetches instead of being handed the catalog
 *
 * The persisted bag holds ids and quantities only, so *something* has to turn
 * them into names, prices, and images. `/cart` does it by fetching the catalog
 * in its page and passing it to `<CartView>`; the panel cannot, because it is
 * mounted in `[locale]/layout.tsx` and therefore lives on every route. Fetching
 * it there would push the whole projection into the RSC payload of every page
 * on the site — heritage, journal, the legal pages — to serve a panel most
 * visits never open. So it is fetched lazily, on the first open, and held for
 * the rest of the session.
 *
 * It sits outside `app/[locale]/` for the reason `api/search` documents:
 * `src/proxy.ts` excludes `api` from its matcher, so the route is neither
 * locale-rewritten nor auth-gated, and the static `api` segment wins over the
 * sibling `[locale]` dynamic one.
 *
 * ## Caching
 *
 * Reading `searchParams` opts a route handler into dynamic rendering, so a
 * `revalidate` export here would be inert — the cache is asked for over the
 * response instead, with a five-minute shared window that matches `/cart`.
 * Both surfaces show live catalog prices and neither renders anything
 * per-visitor, so it is the same trade-off, and the CDN keys it by the full
 * URL, which is what makes one entry per locale rather than one shared entry
 * in the wrong language.
 *
 * There is no rate limiter, unlike `api/search`: a hit costs one cached
 * Supabase read of exactly the public catalog `/collections` already renders
 * server-side, not a billed embedding call.
 */

import { NextResponse, type NextRequest } from "next/server";

import { isLocale } from "@/src/lib/i18n/config";
import { getProductCardsByCollection } from "@/src/services/products";
import type { ProductCardData } from "@/src/types/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Five minutes fresh, then served stale while the next read lands. */
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

export interface CartCatalogPayload {
  catalog: ProductCardData[];
}

export async function GET(request: NextRequest) {
  // Anything that is not a real locale falls back to English rather than
  // reaching the query layer — the parameter picks a translation column, and
  // an unvalidated one has no business being anywhere near it.
  const requested = request.nextUrl.searchParams.get("locale") ?? "";
  const locale = isLocale(requested) ? requested : "en";

  try {
    const catalog = await getProductCardsByCollection(locale);

    return NextResponse.json<CartCatalogPayload>(
      { catalog },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch (error) {
    console.error("[api/cart/catalog] failed", error);

    /*
     * An empty catalog and a 500, not a thrown error: the panel degrades to its
     * "we cannot show the bag right now" copy with a link out to `/cart`, which
     * is server-rendered and unaffected. A rejected fetch inside a modal dialog
     * would leave the visitor looking at a skeleton forever. The failure is
     * explicitly not cached.
     */
    return NextResponse.json<CartCatalogPayload>(
      { catalog: [] },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
