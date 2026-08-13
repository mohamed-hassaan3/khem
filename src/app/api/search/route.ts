/**
 * `GET /api/search?q=…` — suggestions for the overlay panel.
 *
 * A thin handler (AGENTS.md §6): validate, throttle, delegate to
 * `src/services/search.ts`, project. No business logic lives here.
 *
 * It sits outside `app/[locale]/` on purpose — `src/proxy.ts` excludes `api`
 * from its matcher, so this route is neither locale-rewritten nor auth-gated,
 * and a static `api` segment wins over the sibling `[locale]` dynamic segment.
 *
 * The response is locale-agnostic: the panel holds the dictionary and resolves
 * the format line itself, so one cache-free payload serves both trees.
 */

import { NextResponse, type NextRequest } from "next/server";

import {
  COLLECTION_SUGGESTION_LIMIT,
  SEARCH_PARAM,
  SUGGESTION_LIMIT,
} from "@/src/lib/search/config";
import { isSearchable, normalizeQuery } from "@/src/lib/search/text";
import { productHref } from "@/src/lib/routes";
import { searchCatalog, searchCollections } from "@/src/services/search";
import type { SearchSuggestionsPayload } from "@/src/types/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY: SearchSuggestionsPayload = {
  products: [],
  collections: [],
  mode: "lexical",
};

/*
 * ── Rate limiting ───────────────────────────────────────────
 *
 * Not abuse-prevention theatre: a cache miss here is a billed embedding call,
 * so an unthrottled public endpoint is a billing incident waiting to happen —
 * and a free embedding API for anyone who finds it.
 *
 * A fixed window per client, held in process memory. Per-instance and lost on
 * redeploy, which is stated plainly rather than papered over: it stops a
 * hammering browser tab, not a distributed one. Vercel KV or Upstash is the
 * upgrade when this app runs on more than a couple of instances.
 */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(client: string): boolean {
  const now = Date.now();
  const entry = hits.get(client);

  if (!entry || now > entry.resetAt) {
    hits.set(client, { count: 1, resetAt: now + RATE_WINDOW_MS });

    // Opportunistic sweep — without it the map is an unbounded memory leak
    // keyed by anything that can spoof a header.
    if (hits.size > 5_000) {
      for (const [key, value] of hits) {
        if (now > value.resetAt) hits.delete(key);
      }
    }

    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

/**
 * Best-effort client identity.
 *
 * `x-forwarded-for` is spoofable in general; on Vercel the platform sets it and
 * the leftmost entry is the real client. Good enough for a throttle whose worst
 * failure is a limit applied slightly too broadly.
 */
function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function GET(request: NextRequest) {
  if (isRateLimited(clientKey(request))) {
    return NextResponse.json(EMPTY, {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": "10" },
    });
  }

  const query = normalizeQuery(request.nextUrl.searchParams.get(SEARCH_PARAM));

  /*
   * A too-short query is an in-flight keystroke, not a client error — 200 with
   * an empty payload, and crucially without reaching the metered provider.
   */
  if (!isSearchable(query)) {
    return NextResponse.json(EMPTY, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const [result, collections] = await Promise.all([
      searchCatalog(query, { limit: SUGGESTION_LIMIT }),
      searchCollections(query),
    ]);

    const payload: SearchSuggestionsPayload = {
      // Only what a suggestion row draws. Inventory, SKU, and the note pyramid
      // stay on the server — a list endpoint should never select them.
      products: result.products.map((product) => ({
        id: product.id,
        name: product.name,
        href: productHref(product),
        collectionName: product.collectionName,
        collectionKind: product.collectionKind,
        concentration: product.concentration,
        format: product.format,
        priceInCents: product.priceInCents,
        image: product.primaryImage,
      })),
      collections: collections.slice(0, COLLECTION_SUGGESTION_LIMIT).map((collection) => ({
        id: collection.id,
        name: collection.name,
        href: `/collections/${collection.slug}`,
        description: collection.description,
      })),
      mode: result.mode,
    };

    // No shared cache should retain a visitor's query string.
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[search] Suggestion request failed.", error);
    return NextResponse.json(EMPTY, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
