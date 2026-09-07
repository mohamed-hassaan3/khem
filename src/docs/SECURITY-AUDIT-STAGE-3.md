# KHEM — Audit Stage 3: Public Surface, SEO & Code Quality (Phases 18–21 + 19.5)

> Executed 2026-09-06 on branch `security-audit-stage-1`.
> Prompt: `prompts/security-audit-stage-2-fixes.md` (Stage 3 scope defined there).
> Nothing committed or pushed. No production write.

---

## Headline

**Stage 3 found the most damaging defect in the whole audit, and it is not a
security one.** Two customer-facing features have been silently broken in
production since migration `0062`:

| Feature | State | Visible symptom |
|---|---|---|
| **Site search** (hybrid full-text + pgvector) | **Degraded to a fallback** | Works, but ranks the whole catalogue in JavaScript. pgvector and the AI Gateway are **entirely unused**. |
| **"You may also like" rail** | **Completely broken** | Renders empty on every product page. |

Both fail with `permission denied for table Product`. Both degrade quietly —
one to a fallback, one to an empty array — so nothing ever surfaced. The build
log has been printing **60 failures per build** and the site looked fine.

This is finding **F15**, below. It is also an SEO finding: the related-products
rail is the site's primary internal linking between product pages, which
Phase 19.5.8 asks about directly.

### Stage 3 findings

| # | Severity | Finding | Status |
|---|---|---|---|
| F15 | **HIGH (functional)** | `related_products()` and `hybrid_search_products()` 401 for anon since `0062` | **Documented, not fixed** — see why |
| F13 | MEDIUM (SEO) | Soft 404 — unknown URLs return `200` | **Mitigated** (`noindex`), root fix documented |
| F14 | LOW | `/account/addresses` + `/account/preferences` lacked `noindex` | **Fixed** |
| F16 | LOW (SEO) | No `Product`/`Organization`/`Breadcrumb` structured data | **Fixed** |

---

## F15 — search and related products are broken in production

### Evidence

Live, with the publishable key — the exact credential a browser holds:

```
POST /rest/v1/rpc/related_products        → 401  permission denied for table Product
POST /rest/v1/rpc/hybrid_search_products  → 401  permission denied for table Product
```

Build log, every build including the one taken **before any audit change**:

```
build.log   getRelatedProductCards failed: permission denied for table Product   × 60
build2.log  × 60      build3.log  × 60      build4.log  × 60
```

Sixty identical failures per build, unchanged across every build in this audit.
**Pre-existing** — not introduced by Stage 2.

### Root cause

`supabase/sql/0062_sales_ledger.sql` added `"Product"."costInCents"` — the
house's unit cost — and correctly decided the browser must not read it. Because
Postgres will not let a column-level revoke undercut a table-level grant, it did
the documented thing (`0062:1643-1658`): revoke `select` on the table, then
re-grant every column *except* `costInCents`, building the list dynamically so
future columns are not missed.

That reasoning is sound and the comment explaining it is excellent. What it
missed is that **four functions return `setof public."Product"`**:

```
supabase/sql/0004_search.sql:131   hybrid_search_products
supabase/sql/0004_search.sql:195   related_products
supabase/sql/0008_i18n_content.sql:269   hybrid_search_products (redefined)
supabase/sql/0014_ritual_detail_parity.sql:56   related_products (redefined)
```

All four are `SECURITY INVOKER` (confirmed against `pg_proc` in Stage 1). An
invoker function returning the whole row type must read **every** column as the
calling role — and `anon` no longer holds `costInCents`. So the function raises
before it returns anything.

### Why it was invisible

Both call sites degrade gracefully, which is normally a virtue:

- `src/services/search.ts:146-148` — on RPC error, calls `fallbackSearch()`,
  an in-memory lexical ranking over the entire catalogue. Search keeps working,
  so nobody reported it. But it has been running in permanent fallback: no
  Postgres full-text ranking, no semantic search, and the whole pgvector
  investment (`npm run embed`, `AI_GATEWAY_API_KEY`, the embedding columns)
  contributes **nothing** to production results.
- `src/services/products.ts:950` — `toCards()` on an error returns `[]`, and the
  rail renders nothing rather than an error.

Verified end to end: `/api/search?q=amber` returns results (via the fallback),
while the RPC itself 401s.

### Why I did not fix it

Three candidate fixes, and each has a trap:

1. **`SECURITY DEFINER` on both functions.** Makes them work immediately. But
   the result is a set of `"Product"` composites, and PostgREST lets the caller
   project any field of a function result — column privileges apply to *tables*,
   not to function output. So `?select=costInCents` would very likely read the
   margin data straight back out, defeating the entire purpose of `0062`. I
   could not test this without applying a migration to production.
2. **Narrow the return type** to an explicit column list excluding
   `costInCents`. Safe from the leak — but it **breaks the cards**.
   `PRODUCT_CARD_COLUMNS` (`src/schemas/db/catalog.ts:514`) relies on PostgREST
   *embedding*: `collection:Collection!inner(...)` and `images:ProductImage(...)`.
   Embedding requires the RPC to return a real table type so PostgREST can
   follow the foreign keys. A composite `returns table(...)` loses that.
3. **Switch the two call sites to `getSupabaseAdmin()`.** Works, but bypasses
   RLS on the storefront's two most-used reads — so the `isArchived = false`
   policy would stop applying, and archived products could surface in search.
   It also expands service-role usage from 7 modules to 9, against the trust
   model in `src/lib/supabase.ts`.

Shipping (1) blind risks publishing the house's cost prices. Shipping (2) blind
breaks every product card. Neither belongs in an unreviewed diff, and this is
outside the F1–F11 scope that was approved.

### RESOLVED — see `supabase/sql/0065_restore_catalog_rpcs.sql`

> **Correction.** This section originally said *"Option 1 is almost certainly
> right"*. **That was wrong.** The test below was run — inside a rolled-back
> transaction against production, so nothing was persisted — and Option 1
> **leaks the cost**:
>
> ```
> as anon:  select slug, "costInCents" from <definer probe>()
>        → {"slug":"sunlit-citrine","costInCents":60000}
> ```
>
> A fourth option neither this report nor Stage 4 originally considered is the
> one that works: keep `setof "Product"` (so PostgREST embedding survives), take
> `security definer` (so the function can read the row), and **strip the cost
> from the returned rows by name**:
>
> ```sql
> jsonb_populate_record(null::public."Product", to_jsonb(p) - 'costInCents')
> ```
>
> Verified in a rolled-back dry run of the real migration: both RPCs answer for
> `anon`, the cost comes back `null` even for the one product that carries one,
> archived products stay hidden, and public columns are intact. The analysis of
> Options 1–3 below stands as the reasoning that led there.

### The original test, for the record

```sql
-- Apply to a STAGING database only:
alter function public.related_products(text, int, public."CollectionKind"[])
  security definer;
alter function public.related_products(text, int, public."CollectionKind"[])
  set search_path = public;
```

then, as `anon`:

```
POST /rest/v1/rpc/related_products?select=slug,costInCents
     {"product_slug":"amber","match_limit":1,"kinds":["FRAGRANCE"]}
```

- **`costInCents` is null or absent** → Option 1 is safe. Apply to both
  functions, in all four definitions, and the features come back.
- **`costInCents` returns a number** → Option 1 leaks. Take Option 2 and
  restructure the card query to fetch `Collection` and `ProductImage`
  separately rather than by embedding.

Either way, add a regression check to `scripts/db-verify.ts` asserting that both
RPCs answer 200 for `anon` — the absence of one is why this survived a year.

---

## Phase 19.5 — SEO

### 19.5.1 / 19.5.2 Sitemap — **PASS**

`src/app/sitemap.ts` (231 lines) is genuinely well built and needed no change.

- **Database-driven**, not hand-maintained: categories, collections, product
  slugs, ritual slugs, set slugs, journal articles and legal documents are all
  read at generation time (`sitemap.ts:120-139`), so publishing a product adds
  its URL with no code change — exactly what 19.5.1 requires.
- **Unpublished content is excluded structurally**, not by a filter that could
  be forgotten: `getJournalArticles()` reads through the *publishable* key, so
  the RLS policy on `"Article"` decides what is listed (`sitemap.ts:213-216`).
  The same is true of products, via the `isArchived = false` policy Stage 1
  proved empirically.
- **Both locales, with full `hreflang`**: every entry carries an
  `alternates.languages` map built by the same `localizePath()` the pages use
  for their canonicals, so sitemap and `<link rel="alternate">` cannot disagree.
- **Absolute URLs on the production origin** — `SITE_URL` is a constant
  (`src/lib/i18n/metadata.ts:14`) pinned to `https://khemperfumes.com`, with a
  comment explaining that pointing it at a deployment URL would split ranking
  signals. No localhost, no `*.vercel.app`.
- **No private URLs**: no `/admin`, `/account`, `/cart`, `/checkout`, `/search`,
  `/api`, `/prelaunch`, and — since Stage 2 — no `/design-preview`.
- **No duplicates**: `0047_reserved_slugs.sql` forbids a slug being both a
  category and a collection, so the two loops cannot emit the same URL.

Sitemap indexes are not needed — the URL count is in the low hundreds, far
under the 50,000 threshold.

### 19.5.3 Robots — **PASS**

`src/app/robots.ts` disallows `/api/`, `/account`, `/admin`, `/cart`,
`/sign-in`, `/sign-up`, `/prelaunch` — each in **both** locale trees, because
`robots.txt` matches literal paths and a rule for `/cart` says nothing about
`/ar/cart`. It references the sitemap and names the canonical host.

It deliberately does **not** block `/search`, and the reasoning written there is
correct: `robots.txt` governs crawling, not indexing, so a disallowed URL can
still be indexed from external links as a bare URL — and because the crawler was
never allowed to fetch it, it never sees the `noindex` that would have kept it
out. `/search` sends `noindex, follow` instead, which is the right mechanism.
Nothing needed changing.

CSS, JS and images are not blocked.

### 19.5.4 / 19.5.5 Metadata & canonicals — **PASS**

38 files define metadata. `metadataBase` is set once
(`app/[locale]/layout.tsx:111`) and every canonical flows from `localizePath()`
via `localeAlternates()` (`src/lib/i18n/config.ts:127`), where each locale is
canonical for its own URL — the correct choice for a genuinely bilingual site.

`localeMetadata()` (`src/lib/i18n/metadata.ts:41`) exists specifically because
Next merges `metadata` field-by-field rather than deeply: a page declaring its
own `openGraph` would silently drop `og:locale`, which is the signal that tells
a crawler the two trees are translations rather than duplicates. Every page
builds a complete block through it. That is a subtle trap, already avoided.

Trailing-slash and case consistency are handled by Next's defaults; the four
legacy category paths answer **308** from `next.config.ts` `redirects()` rather
than a client-side redirect, with the reasoning written out.

### 19.5.6 Structured data — **F16, FIXED**

Before Stage 3, JSON-LD existed on exactly **one** route (journal articles). No
`Product`, `Offer`, `Brand`, `Organization`, `WebSite` or `BreadcrumbList`
anywhere — for a fragrance retailer, the single largest SEO gap on the site.

Added `src/lib/structured-data.ts` and wired it into four routes:

| Route | Emits |
|---|---|
| every page (root layout) | `Organization` + `WebSite` (+ `SearchAction`) |
| `/perfume/[slug]` | `Product` + `Offer` + `Brand` + `BreadcrumbList` |
| `/ritual/[slug]` | same |
| `/set/[slug]` | same |

**Verified on a live response:**

```json
{"@type":"Organization","@id":"https://khemperfumes.com/#organization",
 "name":"KHEM Perfumes","alternateName":"KHEM",
 "sameAs":["https://www.instagram.com/khemperfumes/",
           "https://www.pinterest.com/khemperfumes/",
           "https://www.facebook.com/khemperfumes/"]}

{"@type":"Product","@id":"https://khemperfumes.com/perfume/amber#product",
 "name":"Amber","sku":"KHEM-GEM-AMB-050",
 "brand":{"@id":"https://khemperfumes.com/#organization"}, …}
```

Decisions worth recording, all of them constraints the brief imposes:

- **`sameAs` comes from the `"SocialProfile"` table**, not from constants —
  19.5.7 forbids inventing social profiles. Three real accounts, read at render.
  Retire the row and the claim disappears with it.
- **No `aggregateRating` or `review`.** The site has product comments, but they
  are not a moderated corpus with verified purchase ratings, and manufacturing
  star markup from them is exactly the "fake reviews, fake ratings" the brief
  prohibits. Left as the attachment point for a real review system.
- **Price is the stored EGP figure**, never one of the six display-currency
  conversions. A converted price in markup is a price the checkout will not
  honour — a consumer-protection problem before it is an SEO one.
- **`priceValidUntil` omitted.** The house publishes no price expiry; inventing
  one would make every product look like a lapsed offer.
- **Stable `@id`s** with `Organization` referenced by `@id` from every `Product`
  — which is what makes a crawler resolve "the brand of this perfume" to "the
  organisation behind this site" instead of two same-named entities.
- **One `@graph` per page** rather than several script tags, so the entities
  cross-reference within one document.
- Everything is serialised through `jsonLdHtml()` (the Stage 2 F1 fix), so the
  five new blocks cannot reintroduce the `</script>` breakout. **This is why F1
  was fixed first.**

### 19.5.7 Entity / brand — **PASS**

One name ("KHEM Perfumes", `alternateName` "KHEM"), one canonical origin, one
logo, one description, real social profiles, and every product bound to the
Organization by `@id`. Business contact details live in `"BoutiqueSetting"` and
`"ContactChannel"` and are rendered on `/contact`; they are deliberately **not**
asserted as `PostalAddress` in the markup, because the house has no verified
public retail address to claim and inventing one is precisely what 19.5.7
forbids. Add it when a boutique address is genuinely published.

### 19.5.8 Internal linking — **BLOCKED BY F15**

The structure is sound on paper: Home → Collections → collection → product, with
a rendered breadcrumb, a nav tree from `"NavLink"`, related articles on the
journal, and a related-products rail on every product page.

**But the related-products rail is the primary product-to-product link path, and
F15 means it renders nothing.** Every product page is therefore closer to an
orphan than the design intends — reachable from its collection, but linking on
to no sibling. Fixing F15 restores the internal-linking graph; no amount of
markup compensates for it. `related_articles()` is unaffected and works
(verified: HTTP 200).

### 19.5.9 / 19.5.10 Product & image SEO — **PASS with one note**

Titles and descriptions are per-product from the database
(`perfume/[slug]/page.tsx:79-86`), so they are unique by construction. Images
carry real `alt` text from `"ProductImage".alt`, use `next/image` with AVIF/WebP
negotiation, explicit `deviceSizes`/`imageSizes`, and a 31-day
`minimumCacheTTL`.

Note: several catalogue images are still `images.unsplash.com` placeholders
(visible in the `Product` markup above). Not a defect in the code — a content
task before launch, and worth naming because those URLs now also appear in
structured data.

### 19.5.11 Headings & semantics — **PASS**

Server-rendered content throughout; the catalogue is in the HTML, not assembled
client-side. `not-found.tsx` marks its decorative "404" numeral `aria-hidden`
and carries the real `<h1>` on the message.

### 19.5.12 / 19.5.13 AI search readiness & intent — **PASS (structural)**

The additions above are what an answer engine consumes: a named entity with a
description and stable identity, products bound to that brand with explicit
price, availability, SKU and volume, and breadcrumbs describing the hierarchy.
The editorial surfaces (`/heritage`, `/craftsmanship`, `/ingredients`,
`/journal`) already answer "what is KHEM", "what is Essence of Heritage" and
"what ingredients are used" in prose.

No AI-targeted pages were generated, no keywords stuffed, no thin pages created
— all four explicitly forbidden by 19.5.12.

### 19.5.14 / 19.5.15 Crawlability & indexability — **F13, mitigated**

| Route | Public | Crawlable | Indexable | Canonical | Sitemap |
|---|---|---|---|---|---|
| `/`, `/collections`, `/collections/[slug]` | yes | yes | yes | self | yes |
| `/perfume\|ritual\|set/[slug]` | yes | yes | yes | self | yes |
| `/journal`, `/journal/[slug]` | yes | yes | yes | self | yes |
| `/heritage`, `/craftsmanship`, `/ingredients`, `/about`, `/stockists`, `/contact` | yes | yes | yes | self | yes |
| legal pages | yes | yes | `index, follow:false` | self | yes |
| `/search` | yes | yes | **no** (`noindex, follow`) | — | no |
| `/cart`, `/checkout` | yes | disallowed | **no** | — | no |
| `/account/*` | **auth** | disallowed | **no** — now via layout | — | no |
| `/admin/*` | **auth** | disallowed | **no** | — | no |
| `/unsubscribe` | token | — | **no** | — | no |
| `/prelaunch` | flag | disallowed | — | `/` | no |
| **unknown URLs** | — | yes | **no — as of this stage** | — | no |

**F13 mitigated.** `src/app/[locale]/not-found.tsx` now renders
`<meta name="robots" content="noindex, follow">`, hoisted into `<head>` by
React 19.

**The status code is still 200**, and I did not change that. Cause proven by
experiment: with `src/app/[locale]/loading.tsx` removed and the app rebuilt,

```
/definitely-not-real → 404      /design-preview → 404      /heritage → 200
```

The Suspense boundary that `loading.tsx` puts over the whole locale tree starts
streaming — committing the status — before `notFound()` resolves. `/api/*`, which
has no loading boundary, returns a correct 404 today.

The cure is to move that boundary down to the segments that need it. That
changes how **every** route on the site loads and would remove the arrival
loading screen, which is a deliberate part of the brand experience — a design
decision, not a bug fix, so it is yours to make. The `noindex` removes the
indexing harm in the meantime, which is the part that actually costs anything.

### 19.5.16 Core Web Vitals — reviewed, not measured

Favourable by construction: AVIF/WebP, a 31-day image cache, restricted
`deviceSizes`, `qualities: [75]` stated rather than inherited, server components
by default, and ISR with `revalidate` backstops plus write-time revalidation
(`src/lib/admin/revalidate.ts`). Field data needs a deployed URL and is out of
scope here.

One genuine cost is now on record: **search runs `fallbackSearch()` on every
query**, loading the whole catalogue and ranking it in JavaScript (F15). That is
a real INP and server-cost regression as well as a quality one.

### 19.5.17 Search Console readiness — **PASS**

Canonical domain constant, sitemap at `/sitemap.xml`, robots at `/robots.txt`,
HTTPS, 308 redirects for moved paths, no staging URLs in output. **Search
Console verification was not performed** — the brief forbids claiming it, and I
have no access to the property.

### 19.5.18 SEO regression protection — **PASS**

Production build succeeds; sitemap and robots both generate (`○ /robots.txt`,
`○ /sitemap.xml` in the route table); all product routes prerender; structured
data verified on live responses.

---

## Phase 18 — Mobile QA

**Partially verifiable.** No real device available, so this is a code-level
review, stated as such rather than dressed up as device testing.

| Check | Status | Evidence |
|---|---|---|
| Viewport meta | PASS | `viewport` export, `app/[locale]/layout.tsx:237` |
| Responsive styling | PASS | 117 of 195 components carry `sm:`/`md:`/`lg:` variants |
| Mobile navigation | PASS | Dedicated mobile nav components; `AdminMobileBar` for the dashboard |
| RTL | PASS | `dir` on `<html>`, `backArrow()` helper, `dir="auto"` on names |
| Safe-area / dynamic viewport | PASS | `min-h-[calc(100svh-…)]` uses `svh`, not `vh` |
| Real-device pass | **NOT DONE** | Needs a deployed preview |

Recommend a real-device pass on the preview deployment covering: mobile nav,
product cards, PDP gallery, cart drawer, **card checkout**, and the announcement
bar.

---

## Phase 20 — Architecture & code quality — **PASS**

Swept for every item the brief lists:

| Item | Result |
|---|---|
| Hardcoded prices | **none** — no numeric `priceInCents` literal outside types/schemas |
| Hardcoded admin emails | **one**, correct — `DEFAULT_ADMIN_EMAILS`, `src/lib/admin/auth.ts:41`, deliberate so an empty env cannot mean "everybody" |
| Hardcoded IDs | none found |
| `any` at security boundaries | **none** — every hit was the English word "any" in prose |
| TODO/FIXME security debt | **none** — the only matches are prose |
| Duplicated Supabase clients | none — two, by authority, in one module |
| Client-side business rules | none — pricing, discounts, credits and stock all decided in SQL under locks |
| Swallowed errors | present but **deliberate and documented** (`checkout.ts:109`, `shared.ts:290`); each explains why failing loudly would be worse |
| Unnecessary service-role usage | 7 call sites, each justified (Stage 1 §3.4) |
| Inconsistent authorization | none — `requireAdmin()` on every admin action |
| Dead security code | none |

The one real code-quality finding is **F15**, above: a graceful-degradation
pattern so thorough that a total feature failure produced no visible signal.
That is the lesson worth carrying — degrade quietly, but *alert* loudly.

---

## Phase 21 — Hardcoded / CMS / environment inventory

> "If a future developer wants to change this, exactly where do they go?"

### Database / CMS controlled — change in `/admin`, no deploy

| Thing | Table | Admin screen |
|---|---|---|
| Products, prices, stock, images | `Product`, `ProductImage` | `/admin/products` |
| Collections, categories | `Collection`, `Category` | `/admin/collections`, `/admin/categories` |
| Landing page sections | `LandingSection` | `/admin/content` |
| Hero slides | `HeroSetting`, `HeroSlide` | `/admin/content` |
| Announcement bar | `Announcement`, `MarketingSetting` | `/admin/announcements` |
| Navigation menu | `NavLink` | `/admin/navigation` |
| World of KHEM (heritage, craft, ingredients, about) | `TimelineEvent`, `CraftPillar`, `CraftStep`, `CraftStat`, `CraftQuote`, `Ingredient`, `IngredientFamily`, `IngredientUsage`, `BrandValue`, `MissionStatement` | `/admin/content/*` |
| Journal | `Article` | `/admin/journal` |
| Stockists | `Stockist` | `/admin/stockists` |
| Legal pages | `LegalDocument` | `/admin/content` |
| Discounts, promotions, offers | `discounts`, `promotions`, `offers` + join tables | `/admin/discounts`, `/admin/promotions`, `/admin/offers` |
| Campaigns | `campaigns`, `campaign_recipients` | `/admin/campaigns` |
| Delivery fee & free-shipping threshold | `DeliverySetting` | `/admin/settings` |
| Contact details, social links | `BoutiqueSetting`, `ContactChannel`, `SocialProfile` | `/admin/settings` |
| Rewards & benefits | `BenefitSetting`, `points_transactions` | `/admin/rewards` |
| Finance & expenses | `expenses`, `expense_categories`, `financial_targets` | `/admin/finance` |

### Code controlled — needs a deploy

Layout and components (`src/components/`), design tokens (`src/app/globals.css`),
routing (`src/app/`), validation (`src/schemas/`), business rules
(`src/actions/`, `src/services/`), checkout flow (`src/actions/checkout.ts`),
auth (`src/lib/auth.ts`, `src/lib/admin/auth.ts`), integrations (`src/lib/`),
translations (`src/lib/i18n/dictionaries/`), structured data
(`src/lib/structured-data.ts`), sitemap and robots (`src/app/sitemap.ts`,
`src/app/robots.ts`).

### Environment controlled — Vercel project settings

See the README's variable table. Note that **Vercel binds env vars at build**,
so changing one takes effect on the next deploy, not immediately.

### SQL controlled — `supabase/sql/`, applied by `npm run db:migrate`

Schema, RLS, policies, functions, triggers, indexes, constraints. Numbered
migrations applied in filename order; `0006_privileges.sql` owns the public-role
grant model, `0062_sales_ledger.sql` owns the `Product` column grants.

---

## Files changed in Stage 3

| File | Change | Finding |
|---|---|---|
| `src/lib/structured-data.ts` | **new** — Organization, WebSite, Product, Offer, Breadcrumb, CollectionPage | F16 |
| `src/app/[locale]/layout.tsx` | fetch `getSocialProfiles()`; emit the org graph | F16 |
| `src/app/[locale]/perfume/[slug]/page.tsx` | Product graph + crumbs | F16 |
| `src/app/[locale]/ritual/[slug]/page.tsx` | Product graph + crumbs | F16 |
| `src/app/[locale]/set/[slug]/page.tsx` | Product graph + crumbs | F16 |
| `src/app/[locale]/account/layout.tsx` | subtree `noindex` | F14 |
| `src/app/[locale]/not-found.tsx` | `noindex` meta + cause documented | F13 |

## Verification

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npm run lint` | **exit 0** |
| `npm run build` | **exit 0** |
| `curl /` → Organization JSON-LD | present, real `sameAs` from the database |
| `curl /perfume/amber` → Product JSON-LD | present, correct SKU and `@id` |
| Experiment: remove `loading.tsx`, rebuild | unknown URLs → **404** (proves F13's cause) |
| Live anon RPC probes | `related_products` **401**, `hybrid_search_products` **401**, `related_articles` 200 |

## Open after Stage 3

| Severity | Finding | Owner |
|---|---|---|
| **HIGH** | **F15** search + related products broken | needs the staging test above |
| MEDIUM | F13 soft 404 status (indexing harm mitigated) | design decision |
| LOW | Unsplash placeholder imagery in the catalogue | content task |
| — | Phase 18 real-device pass | needs a preview deploy |
| — | 4 × `UNVERIFIED — requires staging` from Stage 1 | needs a staging DB |
