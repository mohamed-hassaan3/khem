# Vercel usage reduction — ISR writes and image transformations

## Goal

Bring two metered resources back under the Vercel free-tier allowance without
changing hosting, DNS, Clerk, Supabase, or any production infrastructure:

- **ISR Writes — 265K / 200K** (over budget; the priority)
- **Image Optimization Transformations — 3.8K / 5K** (approaching the cap)

Everything below is a code/config change inside this repository. Nothing here
touches the platform.

## Skills read

None of the three approved skills (`clerk`, `supabase`, `ai-sdk`) govern this
work. The authority used is `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`
(image config defaults) plus the project's own routing matrix in AGENTS.md §8.

## Existing code inspected

- Every `export const revalidate` in `src/app/**` (20 routes).
- `src/lib/admin/revalidate.ts` — the on-demand invalidation map.
- `src/actions/admin/shared.ts` (`revalidateProductsBySlug`) and its caller in
  `src/actions/checkout.ts`.
- `src/actions/comments.ts` (visitor-triggered `revalidatePath`).
- `src/actions/admin/campaigns.ts`, `src/actions/admin/notifications.ts`.
- `src/app/[locale]/[...rest]/page.tsx`, `src/proxy.ts`, `src/app/sitemap.ts`.
- `next.config.ts` (`images`), all `next/image` call sites (45 files).
- Production evidence: `sitemap.xml` (140 URLs), live cache headers, and the
  Vercel deployments API (68 deployments in the last 30 days).

## Findings

### F1 — Short revalidate windows against low traffic (dominant cause)

102 of ~150 prerendered pages carry a 5- or 10-minute window:

| Window | Routes | Pages (both locales) |
| --- | --- | --- |
| 300s | `/perfume/[slug]`, `/ritual/[slug]`, `/set/[slug]`, `/cart` | 62 |
| 600s | `/collections/[slug]` | 40 |
| 3600s | home, journal, marketing, contact, stockists, … | ~38 |
| 86400s | legal | 8 |

Reported traffic is ~169K edge requests/month ≈ 5.6K/day. Spread over 150
pages, a given page is requested roughly once every 30–40 minutes — which is
*always* past a 5- or 10-minute window. The cache therefore never serves a
fresh hit: **nearly every request to those pages triggers a regeneration and a
write.** Short windows only pay for themselves under traffic dense enough to
amortise them; at this volume they convert page views 1:1 into ISR writes.

This is consistent with ISR writes (265K) exceeding total edge requests (169K),
since a single regeneration writes more than one cache entry (HTML plus the RSC
payload).

Confirmed live: `/perfume/sunlit-citrine` answers `x-vercel-cache: PRERENDER`,
`x-nextjs-stale-time: 300`.

### F2 — Every order re-renders the whole storefront

`src/actions/checkout.ts:392` calls `revalidateProductsBySlug()` for each line
of every order placed. That routes into `revalidateProduct()`, which invalidates
per product: home ×2, `/collections` ×2, the collection page ×2, the category
page ×2, the detail page ×2, `/collections/best-sellers` ×2, `/new-arrival` ×2
when tagged, and `/sitemap.xml` — **12–16 pages purged per line item**, for a
change that only alters a stock count. A three-line order purges up to 48 page
entries, each of which is rewritten the next time anyone (or any crawler)
touches it.

### F3 — Whole-tree invalidation on marketing and promotion saves

`revalidateMarketing()` and `revalidatePromotions()` call
`revalidatePath('/en'|'/ar', 'layout')`, which invalidates every one of the ~150
prerendered pages. Correct in intent — the announcement bar is in the layout —
but each save schedules a full-site regeneration, and an editor iterating on
announcement copy pays that several times in a sitting.

### F4 — Build-time prerendering: ~10K writes/month (minor)

68 deployments × ~150 prerendered pages ≈ 10K page prerenders, under 5% of the
overage. Not worth acting on.

### F5 — `revalidatePath` no-ops (cosmetic)

`src/actions/admin/campaigns.ts` and `admin/notifications.ts` revalidate paths
under `/admin`, which is `force-dynamic` throughout. Harmless, zero cost, but
misleading.

### F6 — Catch-all answers 200, not 404 (out of scope, flagged)

`/zz-probe-154821561` returns **HTTP 200** with `x-matched-path:
/[locale]/[...rest]` and `cache-control: private, no-cache, no-store`. It is
rendered dynamically per request, so it costs function invocations rather than
ISR writes — but a soft 200 on an unknown URL is an SEO defect and invites
crawlers to keep probing. Not part of this change unless approved separately.

### F7 — Images: `minimumCacheTTL` defaults to 4 hours

`next.config.ts` sets `formats: ["image/avif", "image/webp"]` and nothing else.
Under Next 16 the optimized-image cache expires after **4 hours**, after which
the next request re-optimizes the same image — a billed transformation. For a
catalogue whose photographs change rarely, that is the whole explanation for
3.8K transformations against a few hundred source images.

Two multipliers sit on top: 15 candidate widths (8 `deviceSizes` + 7
`imageSizes`, including 2048 and 3840 which no `sizes` prop on this site can
select on a real device) and 2 formats, since AVIF and WebP are separate
transformations of the same source.

### F8 — `quality={85}` / `quality={80}` props are inert

Ten call sites pass a non-default `quality`. Next 16 defaults
`images.qualities` to `[75]` and requires the allowlist; values outside it are
not served. The props neither improve the images nor multiply transformations —
they are dead code that reads as an intentional setting.

## Decisions and assumptions

- **On-demand revalidation is already comprehensive.** `src/lib/admin/revalidate.ts`
  covers catalog, collections, categories, journal, stockists, settings,
  heritage, craft, ingredients, marketing, promotions, navigation, delivery and
  landing; comments revalidate their own product page; checkout revalidates
  stock. Time-based windows are therefore a redundant second mechanism, and the
  long window is a safety net, not the primary freshness guarantee.
- **One gap found:** the unpaid-order sweeper (`/api/cron/sweep-unpaid-orders`)
  restocks through `set_order_status()` without revalidating, so a sold-out
  badge could outlive its truth by a full window. Product pages therefore keep
  a one-hour window rather than going to `false`, and the sweeper gains a
  revalidation call.
- Stock is authoritative at `place_order()`, so a stale "in stock" badge cannot
  oversell — it can only disappoint at the bag.
- Dropping AVIF is held back as a second stage: `minimumCacheTTL` alone should
  clear the cap, and AVIF is worth real bytes on Fast Origin Transfer (3.19 GB
  of 10 GB used).

## Files likely to change

| File | Change |
| --- | --- |
| `src/app/[locale]/perfume/[slug]/page.tsx` | `revalidate` 300 → 3600 |
| `src/app/[locale]/ritual/[slug]/page.tsx` | 300 → 3600 |
| `src/app/[locale]/set/[slug]/page.tsx` | 300 → 3600 |
| `src/app/[locale]/cart/page.tsx` | 300 → 3600 |
| `src/app/[locale]/collections/[slug]/page.tsx` | 600 → 3600 |
| `src/app/[locale]/page.tsx`, `journal/*`, `contact`, `stockists`, `heritage`, `about`, `craftsmanship`, `ingredients`, `collections`, `new-arrival` | 3600 → 86400 |
| `src/app/[locale]/{privacy-policy,terms-conditions,cookie-policy,return-exchange}/page.tsx` | 86400 → 604800 |
| `src/actions/admin/shared.ts` | new stock-only revalidation path |
| `src/actions/checkout.ts` | call the stock-only path |
| `src/app/api/cron/sweep-unpaid-orders/route.ts` | revalidate restocked products |
| `next.config.ts` | `minimumCacheTTL`, `deviceSizes`, `imageSizes`, `qualities` |
| 10 `.tsx` files with `quality={85\|80}` | remove the inert prop |
| AGENTS.md §8 | routing matrix updated to the new windows |

## Implementation requirements

1. **Lengthen the windows** exactly as tabulated. Each `revalidate` export
   carries a comment citing AGENTS.md §8; update the comment to say what the
   window is now for — a backstop behind on-demand invalidation, not the
   freshness mechanism.
2. **Add `revalidateProductStock(slugs)`** to `src/actions/admin/shared.ts`:
   the product detail page and its collection page, both locales, and nothing
   else. No home page, no `/collections`, no best-sellers, no sitemap — a stock
   count changes none of those. Keep `revalidateProductsBySlug()` for the
   inventory screen, where an editor is watching for the change.
3. **Point `src/actions/checkout.ts` at the new function.**
4. **Revalidate on restock** in the sweeper cron, using the same function, for
   the slugs the sweep actually restocked. If the RPC does not return them,
   leave the cron alone and say so rather than inventing a return shape.
5. **`next.config.ts` images:**
   - `minimumCacheTTL: 2678400` (31 days), with a comment recording that there
     is no invalidation mechanism, so a replaced photograph needs a new URL —
     which is how Cloudinary and the Supabase bucket already work.
   - `deviceSizes: [640, 750, 828, 1080, 1200, 1920]` — 2048 and 3840 are
     unreachable from every `sizes` prop in the codebase at any real viewport.
   - `imageSizes: [64, 96, 128, 256, 384]` — the widths the `sizes` props
     actually resolve to; verify against the `56px`/`64px`/`72px`/`80px` call
     sites before dropping 32 and 48.
   - `qualities: [75]` stated explicitly, so the default is a decision.
6. **Delete the `quality` props** at the ten call sites, since 75 is what is
   being served regardless.
7. **Do not** touch DNS, Clerk, Supabase, Stripe, the deployment settings, or
   any environment variable.

## Security requirements

No change to auth, no new route, no new input surface. The cron edit runs
inside the existing `CRON_SECRET` gate; do not relax it. Image config changes
must not widen `remotePatterns`.

## Acceptance criteria

- `npm run build` succeeds; the build output shows the same set of prerendered
  routes as before, with the new revalidate values.
- No route changes its rendering mode (nothing static becomes dynamic).
- An admin save still updates the storefront immediately — verified by hand for
  a product edit, an announcement, and a promotion.
- Placing an order still updates the sold-out state on the product page.
- `npx tsc --noEmit` and `npm run lint` clean.
- AGENTS.md §8 matches the code.

## Checks to run

```
npm run lint
npx tsc --noEmit
npm run build
```

## Manual test steps

1. `npm run dev`. Load `/perfume/<slug>`, `/collections/<slug>`, `/` and
   `/ar/perfume/<slug>` — all render as before.
2. In `/admin`, edit a product's price. Reload the storefront page: the new
   price is there immediately (this is on-demand revalidation, not the window).
3. Edit an announcement. Reload any page: the bar changes immediately.
4. Place a test order that empties a product's stock. Reload its detail page:
   sold out.
5. After deploying, re-probe headers:
   `curl -sI https://khemperfumes.com/perfume/<slug> | grep -i x-nextjs-stale-time`
   → `3600`.
6. Watch the Vercel usage panel for 48 hours; ISR writes/day should fall from
   ~8.8K to the low hundreds outside admin activity.

## Expected effect

- **ISR writes:** decoupled from page views. Writes become a function of
  content changes plus one regeneration per page per day, i.e. an order of
  magnitude below the current rate — comfortably inside 200K.
- **Transformations:** each optimized variant is billed once per 31 days
  instead of once per 4 hours, and the candidate-width list drops from 15 to
  11. Expected well under 1K/month at this catalogue size.

---

## Outcome — what was actually implemented

Executed on 2026-09-05. `npm run lint`, `npx tsc --noEmit` and `npm run build`
all clean; 245 pages prerendered, every route in the same rendering mode as
before.

Done as written: the revalidate windows (PDP/ritual/set/cart 300s → 3600s,
`/collections/[slug]` 600s → 3600s, editorial 3600s → 86400s, legal 86400s →
604800s), the sweeper cron revalidation, the `next.config.ts` image settings,
the removal of the ten inert `quality` props, and AGENTS.md §8.

### Not done: narrowing the checkout revalidation (items 2 and 3)

The premise of finding F2 was wrong, and the code says so:
`src/components/ecommerce/ProductCard.tsx:126` renders the sold-out badge on
**every card**, not only on the detail page. A stock movement therefore really
does change the home page, `/collections`, the collection page, the category
page, best-sellers, `/new-arrival` and the bag — which is exactly the list
`revalidateProduct()` already invalidates, and exactly why
`revalidateProductsBySlug()` reuses it rather than keeping a shorter list.

Narrowing it to the detail page would have traded a small, fixed, order-rate
cost for sold-out badges that stay wrong for a day on every grid — the failure
the longer windows make severe rather than survivable. The per-order fan-out is
also not what caused the overage: at this order volume it is a few hundred
regenerations a day against the ~8.8K/day the time-based churn was producing.

`src/actions/checkout.ts` is therefore unchanged and no `revalidateProductStock`
exists. If the order rate grows enough for this to matter, the honest fix is a
narrower *stock* projection on the cards, not a narrower revalidation list.

### Added beyond the prompt — freshness the longer windows require

Both are gaps that a five-minute window hid and a one-hour/one-day window does
not:

1. **`revalidateProduct()` now revalidates the product's own page through
   `productHref()`** instead of `/perfume/[slug]` under a `FRAGRANCE` check.
   `/ritual/[slug]` and `/set/[slug]` — body care, home fragrance, discovery and
   gift sets — were never revalidated by a catalog write at all.
2. **`/cart` joined the paths a product write re-renders.** The bag renders the
   catalog projection server-side, so it quotes prices like any grid.

### Still open, deliberately

- **F6, the soft 404.** `/[locale]/[...rest]` answers HTTP 200 on an unknown
  URL. It costs function invocations rather than ISR writes, so it was left
  alone — but it is an SEO defect and worth its own change.
- **Dropping AVIF**, held as a second stage if transformations do not fall far
  enough once the 31-day cache is in effect.
- **`sweepStaleHolds()`** in `src/actions/checkout.ts` restocks without
  revalidating, the same gap the cron just closed. It runs immediately before an
  order that revalidates its own lines, so the exposure is narrow; closing it
  properly means the sweep returning what it restocked.
