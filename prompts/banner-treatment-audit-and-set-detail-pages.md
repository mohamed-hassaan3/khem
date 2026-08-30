# Banner Treatment Audit & Set Detail Pages

Two corrections, audited below. Sources of truth: `AGENTS.md`,
`src/docs/KHEM-REDESIGN-AND-PERFORMANCE.md` (§14 banner system, §26 Discovery
Sets, §27 Gift Sets), `src/docs/khem-ui-design-system.md` (§4a as rewritten).

---

## Goal

1. **One image treatment across every customer-facing banner and card.** The
   four pages named — Body Care, Home Fragrances, Gift Sets, Discovery Sets —
   are the visible symptom; the audit found the same class of problem on
   fourteen other surfaces.

2. **Discovery Sets and Gift Sets become real products** with detail pages, by
   extending the existing detail system rather than adding a parallel one.

No new design direction, no schema change, no new dependency.

---

## Skills read

- `node_modules/next/dist/docs/` + `vercel-plugin:nextjs` — App Router route
  segments, `generateStaticParams`, ISR config, metadata.
- `.agents/skills/supabase` — the query layer for the new detail read.

---

## Existing code inspected

`src/lib/routes.ts` · `src/services/products.ts` · `src/types/catalog.ts` ·
`supabase/sql/0001_catalog.sql` + `0008_i18n_content.sql` ·
`app/[locale]/collections/[slug]/page.tsx` · `app/[locale]/ritual/[slug]/page.tsx` ·
`app/[locale]/perfume/[slug]/page.tsx` · `components/ecommerce/CategoryView.tsx`,
`CategoryHero.tsx`, `CollectionView.tsx`, `NewArrivalHero.tsx`, `MerchCard.tsx`,
`MerchGrid.tsx`, `DiscoverySetCard.tsx`, `ProductCard.tsx`, `ProductGallery.tsx`,
`ProductPurchase.tsx`, `ProductStory.tsx`, `RelatedProducts.tsx`,
`ProductBreadcrumb.tsx` · `components/journal/ArticleHero.tsx`, `ArticleCard.tsx` ·
`components/legal/LegalHero.tsx` · `components/home/CollectionCard.tsx`,
`JournalCard.tsx`, `IngredientCard.tsx` · `app/sitemap.ts`.

---

## Part 1 — Audit findings: image treatment

### 1.1 The named four fail because the scrim runs the wrong way

All four render through `<CategoryHero>`, which lays an **ivory gradient
horizontally** (`bg-linear-to-e from-ivory via-ivory/85 to-transparent`).
Every other redesigned banner anchors its scrim to the **bottom**.

A horizontal scrim only works when the photograph's leading edge is light.
Verified on `/collections/body-care` at 1440×900: the "THE RITUAL" eyebrow and
the three-line lede sit directly on a dark vase and a busy mid-ground, with the
gradient already faded out beneath them. The type is charcoal, so where the
photograph is dark the contrast collapses — the same failure the collection
banners had before the bottom scrim was introduced, in the one component that
never received it.

Same defect, same component family:

| Surface | Scrim | Direction |
| --- | --- | --- |
| `CategoryHero` (the four) | `from-ivory via-ivory/85` | horizontal `to-e` |
| `heritage`, `about` | `from-ivory via-ivory/85` | horizontal `to-r` |
| `ingredients` | `from-ivory via-ivory/85 to-ivory/35` | diagonal `to-br` |
| `craftsmanship` | `from-ivory/45 to-ivory/85` | vertical, both ends |
| `CollectionView` | `from-ivory via-ivory/80` | **bottom 62%** ✅ |
| `ArticleHero` | `from-ivory via-ivory/85` | bottom (inset-0) ✅ |
| `LegalHero` | `from-ivory via-ivory/88` | bottom (inset-0) ✅ |
| `NewArrivalHero` | two layers + radial | its own thing |

Five different treatments for one job.

### 1.2 Cards still carry the dark system's dimming

Every card below dims its photograph so that *ivory* type could read on it. The
type on all of them is charcoal on an ivory card now, so the dimming makes the
image worse and the caption no better. §41 of the brief also asks that images
not be needlessly degraded.

| Component | Current filter |
| --- | --- |
| `home/CollectionCard` | `brightness-[0.55]`/`[0.4]` **+ `from-background/90` scrim** — the last fully dark treatment in the customer app |
| `home/IngredientCard` | `brightness-50 saturate-[0.7]` |
| `home/JournalCard` | `brightness-[0.6] saturate-[0.7]` |
| `journal/ArticleCard` | `brightness-55 saturate-60` |
| `journal/page.tsx` | `brightness-60 saturate-70` |
| `MerchCard` | `brightness-65 saturate-60` |
| `DiscoverySetCard` | `brightness-65 saturate-50` |
| `ProductCard` | `brightness-75` (both images) |
| `ArrivalShowcase` | `brightness-75 saturate-75` |
| `IngredientExplorer` | `brightness-60 saturate-50` |
| `stockists/page.tsx` | `brightness-55 saturate-65`, `brightness-[0.45] saturate-50` |
| `StockistDirectory` | `brightness-[0.15] saturate-0 sepia-[0.3]` — 15% luminance, desaturated, sepia'd |
| `heritage`, `craftsmanship` quote bands | `brightness-80` |

`ProductCard`'s `brightness-75` is deliberate and documented (both gallery
images graded identically so the hover cross-fade does not flicker) — it will be
*kept* as a treatment but re-tuned to a value chosen for a light card.

### 1.3 What this part will do

Introduce **one scrim primitive** in `globals.css` — `.banner-scrim` with the
small set of variants §14 actually calls for (bottom, reading-column, and the
centred case `NewArrivalHero` needs) — and route every banner through it. §14
says "do not create one identical banner component for every page", so this is a
shared *treatment*, not a shared component: each banner keeps its own layout and
declares which scrim it takes.

Then remove the dark-system dimming from the cards in 1.2, replacing it with a
single restrained grade appropriate to a light card, verified against the
darkest and lightest photography in the catalogue.

---

## Part 2 — Audit findings: Discovery & Gift set detail pages

### 2.1 Current state

`productHref()` routes `DISCOVERY` and `GIFT` to the **category page**, not to a
product. `hasDetailPage()` returns `false` for both. `DETAIL_PAGE_KINDS` in
`services/products.ts` excludes them, which also means a set slug is rejected by
`getDetailPageTarget()` — so sets cannot carry comments either.

`<DiscoverySetCard>` is, alone among the three cards, **not a link**. Its own
header says so, and predicts this change:

> "It gains one when those routes land, at which point this component and
> `<MerchCard>` become very hard to justify keeping apart."

### 2.2 The data already exists — no migration

`supabase/sql/0001_catalog.sql` already carries everything a set page needs:

- `includes text[]` — "What a set contains, one line per item", with `includes_ar`
  for the Arabic tree (`0008_i18n_content.sql`)
- `format text` — stands in for `concentration` on non-fragrance goods, with a
  DB check constraint enforcing one or the other
- `story`, `volumeMl`, `priceInCents`, `inventory`, `badge`, the `ProductImage`
  relation, promotions

**This part requires no schema change and no migration.** That is the main
reason it can be an extension rather than a build.

### 2.3 The detail system is already reusable

`/ritual/[slug]` is a thin composition of shared parts —
`<ProductBreadcrumb>`, `<ProductGallery>`, `<ProductPurchase>`, `<ProductStory>`,
`<ProductIngredients>`, `<ProductComments>`, `<RelatedProducts>` — differing
from `/perfume/[slug]` only in which blocks it includes. A set page is the same
composition with `<ProductPyramid>` and `<ProductIngredients>` omitted and one
new block added.

---

## Decisions and assumptions

1. **A new route `/set/[slug]`, not a widened `/ritual/[slug]`.** "Ritual" is
   the body-care and home-fragrance register; a gift set is not a ritual. The
   route is a thin `page.tsx` composing the existing components — the same shape
   `/ritual/[slug]` already is — so it duplicates a composition, not a system.
   *Flagging this as the one place reasonable people could differ: the
   alternative is `/ritual/[slug]` gaining two more kinds and a third eyebrow.*
2. **One new component, `<ProductIncludes>`**, rendering `product.includes` in
   the register `<ProductPyramid>` and `<ProductIngredients>` already establish.
   Nothing else on the page is new.
3. **`<DiscoverySetCard>` gains the stretched anchor** the other two cards have,
   via the existing `productHref()`. Merging it into `<MerchCard>` is *not* in
   scope — its own header calls that out as a follow-up, and doing both at once
   would make a card regression indistinguishable from a routing one.
4. **`RELATED_KINDS` for sets**: a set's rail draws from the fragrances it
   contains plus the other sets. Sets are added to `DETAIL_PAGE_KINDS`, so
   existing rails may now link to them — which is the point.
5. **Cards keep a grade, they do not lose one.** The fix is one grade tuned for
   a light card, not `filter: none` everywhere; `ProductCard`'s two-image parity
   requirement is preserved.
6. **ISR unchanged**: `/set/[slug]` takes `revalidate = 300`, matching
   `/perfume/[slug]` and `/ritual/[slug]` per AGENTS.md §8.

---

## Files likely to change

**Part 1 — treatment**
- `src/app/globals.css` — the `.banner-scrim` variants
- `CategoryHero.tsx`, `CollectionView.tsx`, `NewArrivalHero.tsx`,
  `journal/ArticleHero.tsx`, `legal/LegalHero.tsx`
- `heritage`, `about`, `craftsmanship`, `ingredients` page heroes
- `home/CollectionCard.tsx`, `home/IngredientCard.tsx`, `home/JournalCard.tsx`,
  `journal/ArticleCard.tsx`, `journal/page.tsx`, `MerchCard.tsx`,
  `DiscoverySetCard.tsx`, `ProductCard.tsx`, `ArrivalShowcase.tsx`,
  `IngredientExplorer.tsx`, `stockists/page.tsx`, `StockistDirectory.tsx`,
  `Nav.tsx` featured tiles
- `src/docs/khem-ui-design-system.md` §4a — record the treatment

**Part 2 — set detail**
- New: `src/app/[locale]/set/[slug]/page.tsx`,
  `src/components/ecommerce/ProductIncludes.tsx`
- `src/lib/routes.ts` — `productHref()`, `hasDetailPage()`
- `src/services/products.ts` — `SET_KINDS`, `DETAIL_PAGE_KINDS`,
  `getSetProductBySlug()`, `getSetProductSlugs()`, `SET_RELATED_KINDS`
- `src/components/ecommerce/DiscoverySetCard.tsx` — stretched anchor
- `src/app/sitemap.ts` — set URLs
- `src/lib/i18n/dictionaries/en.ts` + `ar.ts` — the set page's copy

**Not changed:** `supabase/**` (no migration), cart/checkout/discount/voucher
logic, `actions/**`, `app/api/**`, `proxy.ts`, any existing `revalidate` value,
`generateStaticParams` on existing routes.

---

## Implementation requirements

### Part 1
- Every banner scrim anchored so the *reading area* is guaranteed light,
  whatever the photograph does there. Contrast measured, not eyeballed.
- No blanket `brightness` below ~0.9 on a banner photograph; the scrim does the
  work (§13: a dark overlay is not the automatic answer).
- Cards: one grade, applied consistently, tuned on a light card.
- `NewArrivalHero`'s radial and `LegalHero`'s `.grain` are kept if they still
  earn their place after the scrim is unified; removed if they do not.

### Part 2
- `/set/[slug]` renders: breadcrumb, gallery, name, collection, price
  (promotion-aware), format/size, availability, quantity, add-to-cart, sticky
  buy bar, `includes` list, story, comments, related rail.
- The query is scoped by `SET_KINDS` the way `getRitualProductBySlug` is scoped
  by `RITUAL_KINDS`: `/perfume` must not render a set and `/set` must not render
  a perfume.
- `generateStaticParams` over set slugs × locales; `generateMetadata` with
  canonical + `localeAlternates`, matching the perfume page.
- Arabic parity: `includes_ar` read on the `ar` tree, RTL verified.

---

## Security requirements

- No change to `proxy.ts` matching, admin RBAC, or Server Action authorization.
- The new route is public and read-only; it uses the anon Supabase client via
  the existing `services/products.ts` helpers — no service-role key reaches it.
- No `auth()`/`currentUser()` on the new route, which would turn it dynamic.
- `includes` is catalog text rendered as text; no `dangerouslySetInnerHTML`.

---

## Acceptance criteria

**Treatment**
- No customer-facing banner uses a horizontal-only scrim; every one guarantees
  a light field under its type at 375 / 768 / 1440 px.
- Nav links and banner type meet AA against the darkest banner in the catalogue,
  measured.
- No card photograph is graded below the agreed light-card value; the
  `brightness-[0.15]` stockist image is gone.
- Images are not visibly degraded — no image ends up darker than it is today.

**Set pages**
- Every Discovery and Gift set card navigates to a working detail page.
- `/set/<perfume-slug>` 404s; `/perfume/<set-slug>` 404s.
- Sets appear in `sitemap.xml`; canonical and `hreflang` correct in both trees.
- Add-to-cart from a set detail page produces a cart line identical to the one
  the card produces, and checks out.

**Regression gate**
- `npm run build` succeeds; 197+ prerendered pages (set pages add to it);
  every existing `Revalidate`/`Expire` value unchanged.
- `npm run lint` and `npx tsc --noEmit` clean; zero `any`.
- No horizontal overflow at 320/375/768/1024/1440.
- Both locales render; RTL intact.

---

## Checks to run

```bash
npm run build      # route table diffed against the pre-change baseline
npm run lint
npx tsc --noEmit
```

Plus a Lighthouse pass on `/`, `/collections/signature`, `/perfume/onyx-night`
and one new `/set/[slug]`, desktop and mobile, compared against the stored
`scratchpad/base-*.json` and `BELOW-*.json` runs.

---

## Manual test steps expected after implementation

1. `npm run build && npx next start -p 3100`.
2. **Banners:** visit `/collections/body-care`, `/collections/home-fragrance`,
   `/collections/gift-set`, `/collections/discovery`, `/collections/noir`,
   `/heritage`, `/craftsmanship`, `/about`, `/ingredients`, a journal article and
   a legal page at 375, 768 and 1440. Confirm one treatment, readable type, and
   no image darker than before.
3. **Cards:** scroll the home page, `/collections`, `/journal`, `/ingredients`
   and `/stockists`; confirm no card photograph is dimmed for a caption that is
   no longer on it.
4. **Set detail:** from `/collections/discovery` and `/collections/gift-set`,
   click a card → detail page. Check gallery, price, promotion, format/size,
   included items, availability, quantity, add to cart, related rail.
5. **Routing:** confirm `/set/<a-perfume-slug>` and `/perfume/<a-set-slug>`
   both 404.
6. **Commerce:** add a set to the bag, apply a discount code, complete a Stripe
   test-card checkout, confirm the order in `/account/orders` and `/admin/orders`.
7. **Arabic:** repeat 2 and 4 under `/ar/…`, including the included-items list.
8. Re-run the Lighthouse pass and compare.

---

## Open question for the user

**Part 2, decision 1**: `/set/[slug]` as a new route, versus widening
`/ritual/[slug]` to carry all four non-fragrance kinds. This plan assumes the
new route because "ritual" does not describe a gift set, and because the URL is
customer-visible and permanent. Say if you would rather have one
`/ritual/[slug]` covering everything — it is a smaller diff and one fewer route
to prerender, at the cost of a URL that reads oddly for gifting.
