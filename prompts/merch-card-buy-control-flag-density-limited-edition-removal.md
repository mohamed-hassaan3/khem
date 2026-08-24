# Merch card buy control, mobile flag density, and the end of Limited Edition

## Goal

Three changes the user asked for, in one pass:

1. **`/collections/home-fragrance` and `/collections/body-care` cards lose their
   full-width "ADD TO CART" button.** The corner bag icon those cards already
   carry becomes the only buy control, matching every perfume card in the app.
2. **The corner flag reads smaller and sits flush on phones.** `New`,
   `Best Sellers`, `Sold Out` — the pill drops a size and loses its inline-start
   inset at mobile widths; desktop is untouched.
3. **"Limited Edition" is withdrawn from the product entirely** — the pill, the
   facet chip, the `/collections/limited-edition` page, the admin tag, the
   dictionary copy, the seed data, and the `ProductTag` enum value in Postgres.

## Skills read

None. No Clerk, Supabase-client, or AI-SDK surface is touched — the Supabase
work here is a plain SQL migration in the repository's existing style, and the
rest is UI, dictionaries, and types. (The session hook suggested `ai-sdk` and
`ai-gateway`; neither is involved in this task.)

## Existing code inspected

| File | What it told me |
| :--- | :--- |
| `src/components/ecommerce/MerchCard.tsx` | The body-care / home-fragrance card. Carries **both** `<AddToBagButton>` (corner) and a full-width `btn-luxury` button driven by local `justAdded` state. Sold-out is currently reported *only* by that button. |
| `src/components/ecommerce/MerchGrid.tsx` | Its only caller — the grid `<CategoryView>` renders for `BODY` and `HOME` collections. |
| `src/components/ecommerce/ProductCard.tsx` | The perfume card: corner bag only, and a **muted** `<ProductFlag>` for sold-out stock. The precedent this task moves `<MerchCard>` onto. |
| `src/components/ecommerce/DiscoverySetCard.tsx` | Also sells from a full-width button. **Out of scope** — the user named body care and home fragrance only. |
| `src/components/ecommerce/ProductFlag.tsx` | The pill: `absolute start-5 top-5 … text-[9px]`, one class string for every breakpoint. |
| `src/components/ecommerce/AddToBagButton.tsx` | The corner bag, `absolute end-5 top-5`, already disables at zero inventory. |
| `src/lib/facets.ts` | `ProductFacet`, `FACET_ORDER`, `productFacets()`, `MERCH_PAGE_FACETS`, `productFlag()` — every mention of `limited-edition` in the storefront's vocabulary. |
| `src/app/[locale]/collections/[slug]/page.tsx` | Routes the merchandising pages, holds `MERCH_PAGE_BANNERS`, prerenders `MERCH_PAGE_FACETS`. |
| `src/app/[locale]/admin/collections/{page,[slug]/page}.tsx` | Lists and edits merchandising pages; the list copy says "The last two are merchandising pages". |
| `src/components/admin/{MerchPageForm,ProductForm}.tsx` | The membership hint per page, and the `TAG_OPTIONS` checkbox list. |
| `src/schemas/{admin,db/admin,db/catalog}.ts` | `z.enum(["NEW_ARRIVAL","LIMITED_EDITION"])` in three places; `z.enum(MERCH_PAGE_FACETS)` in three more. |
| `src/services/admin/catalog.ts` | `countMerchPageProducts()` runs one count query per cut. |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | `collections.facets["limited-edition"]` and `collections.merchPages["limited-edition"]`. |
| `supabase/sql/0001_catalog.sql` | `create type public."ProductTag" as enum ('NEW_ARRIVAL','LIMITED_EDITION')`, inside a `do $$ … exception when duplicate_object` guard. |
| `supabase/sql/0012_merch_page.sql` | `MerchPage`, its `check (slug in ('best-sellers','limited-edition'))`, and the two seeded rows. |
| `scripts/db-migrate.ts` | **Every** `supabase/sql/*.sql` file is re-applied in filename order inside one transaction on every run; there is no migration history table. So a schema change is *both* an edit to the file that created the thing **and** a new numbered file that repairs an already-migrated database. |
| `supabase/seed/catalog.json` | Six products carry the `LIMITED_EDITION` tag; three carry a free-text badge mentioning "Limited". |

## Decisions and assumptions

- **D1 — `<MerchCard>` keeps its sold-out voice.** Deleting the full-width
  button deletes the only place that card says "Sold Out". It gains the muted
  `<ProductFlag>` `<ProductCard>` already uses, resolved in the same order
  (sold out → stored `badge` → flag), so the two cards behave identically.
  Without this, a sold-out room spray would look purchasable.
- **D2 — the card stops being a client component's client component.** With the
  button gone, `justAdded`, `CONFIRMATION_MS`, the `setTimeout` cleanup,
  `useCart`, and the `Check` import are all dead. They go. `<MerchCard>` still
  needs `"use client"` for `useDictionary` / `useFormatPrice`.
- **D3 — `dict.product.addToCart` and `dict.product.added` stay.** Still used by
  `<DiscoverySetCard>` and the product purchase panel.
- **D4 — the flag's mobile treatment is `start-0 top-4 text-[8px]`, restored to
  `sm:start-5 sm:top-5 sm:text-[9px]`.** "No margin from left side" reads as
  flush to the card edge; the pill keeps its own `px-3` padding, so the text
  does not touch the border. `top` drops with it so the pill does not look
  pinned to a corner it no longer has. The bag button's `end-5` is left alone —
  the user asked about the label only, and the two no longer share a margin to
  keep symmetrical.
- **D5 — "Limited Edition" is removed, not hidden.** The user said "even
  database and scheme". So: the `ProductTag` enum loses the value, the facet
  union loses the member, `/collections/limited-edition` stops existing, and the
  `MerchPage` row is deleted. `MERCH_PAGE_FACETS` survives as a one-member tuple
  (`["best-sellers"]`) — the machinery around it (routing, revalidation, admin
  form, sitemap) is sound and a second cut may well return.
- **D6 — `/collections/limited-edition` will 404.** It is linked from nowhere:
  the Nav's Quick Access replaced "Limited Editions" with Key Ingredients in
  `9e4b93c`, and the Footer reads the same table. A dead merchandising URL that
  404s is the honest outcome of withdrawing the cut; no redirect is added.
- **D7 — free-text badges that say "Limited" go too.** Three seed rows carry
  one: Sapphire's `"New · Limited"` becomes `"New"` / `"جديد"`, and the two
  Kyphi–Mendesian gift sets drop their badge to `null`. A pill reading "Limited"
  is the same label under a shorter name.
- **D8 — the enum value is dropped by recreating the type.** Postgres has no
  `alter type … drop value`. The migration strips the value from every array,
  renames the old type aside, creates the new one, retypes the column through
  `text[]`, and drops the old type — guarded so a re-run (which `db:migrate`
  guarantees) is a no-op.

## Files likely to change

**UI**
- `src/components/ecommerce/MerchCard.tsx` — remove the button, add the sold-out flag, drop the dead state.
- `src/components/ecommerce/ProductFlag.tsx` — responsive inset and type size.

**Limited Edition removal — storefront**
- `src/lib/facets.ts` — drop from `MerchandisingFacet`, `FACET_ORDER`, `productFacets()`, `MERCH_PAGE_FACETS`, `productFlag()`; update the file's own prose.
- `src/types/catalog.ts` — `ProductTag` becomes `"NEW_ARRIVAL"`.
- `src/app/[locale]/collections/[slug]/page.tsx` — one entry in `MERCH_PAGE_BANNERS`.
- `src/lib/i18n/dictionaries/en.ts`, `ar.ts` — drop `facets["limited-edition"]` and `merchPages["limited-edition"]`.

**Limited Edition removal — admin**
- `src/components/admin/ProductForm.tsx` — drop the tag option.
- `src/components/admin/MerchPageForm.tsx` — drop the membership hint; adjust prose.
- `src/app/[locale]/admin/collections/page.tsx` — "The last two are merchandising pages" → singular.
- `src/app/[locale]/admin/collections/[slug]/page.tsx` — prose only.
- `src/services/admin/catalog.ts` — `countMerchPageProducts()` loses the limited count.
- `src/actions/admin/catalog.ts` — prose only.
- `src/schemas/admin.ts`, `src/schemas/db/admin.ts`, `src/schemas/db/catalog.ts` — `productTagSchema` / `productTagField` become `z.enum(["NEW_ARRIVAL"])`.

**Data**
- `supabase/sql/0001_catalog.sql` — enum without `LIMITED_EDITION` (fresh installs).
- `supabase/sql/0012_merch_page.sql` — check constraint and seed values without the row (fresh installs).
- `supabase/sql/0021_retire_limited_edition.sql` — **new**; repairs an already-migrated database.
- `supabase/seed/catalog.json` — six `tags` arrays, three badges.

## Implementation requirements

### 1. `<MerchCard>`

- Delete the `<button className="btn-luxury …">` block and the `mb-3`/`sm:mb-5`
  margin on the price row that only existed to separate it from that button.
- Resolve the corner pill exactly as `<ProductCard>` does:
  `isSoldOut ? muted Sold Out : badge ? … : flag ? … : null`.
- Remove `useCart`, `justAdded`, `timeoutRef`, the `useEffect` cleanup,
  `CONFIRMATION_MS`, `handleAddToCart`, and the `Check` import.
- Update the component's doc comment: it no longer "sells straight from the
  card" through a button of its own, and `<AddToBagButton>`'s comment about
  `<MerchCard>` having a full-width button must stop claiming that too.
- The card's `<article>` keeps `relative`; both overlays keep their insets.

### 2. `<ProductFlag>`

- `absolute start-0 top-4 … text-[8px] sm:start-5 sm:top-5 sm:text-[9px]`.
- Everything else — tone map, tracking, padding, `z-2`, the logical inset so it
  mirrors in Arabic — unchanged. `start-0` mirrors to `right: 0` in the RTL
  tree, which is the correct flush edge there.

### 3. Limited Edition removal

- No identifier named `limited`, `LIMITED_EDITION`, or `limited-edition` may
  remain under `src/`, and no user-facing string may read "Limited Edition",
  "Limited edition", "Limited", or "إصدار محدود".
- Prose in the touched files must not be left describing a two-cut world:
  "the two merchandising pages", "the last two", "between Limited Edition and
  Best Seller" all need rewriting to match what the code now does.
- `productFlag()` reduces to the bestseller check; keep the function and its
  return type (`MerchPageFacet | null`) so no call site changes.
- `countMerchPageProducts()` returns `{ "best-sellers": n }` and runs one query.

### 4. `supabase/sql/0021_retire_limited_edition.sql`

In this order, every statement idempotent, in the house comment style:

1. `delete from public."MerchPage" where slug = 'limited-edition';`
2. Drop and re-add `merch_page_known_slug` as `check (slug in ('best-sellers'))`.
3. `update public."Product" set badge = null where badge in ('Limited','New · Limited') …` — the three seeded badges, English and Arabic columns, matched by value so an editor's own copy is never touched.
4. Strip the tag: `update public."Product" set tags = array_remove(tags, 'LIMITED_EDITION'::public."ProductTag") where 'LIMITED_EDITION' = any(tags);`
5. Recreate the type, inside a `do $$` block that returns early when the value is already absent from `pg_enum`: drop the column default → rename `"ProductTag"` to `"ProductTag_old"` → create `"ProductTag"` as `enum ('NEW_ARRIVAL')` → `alter table public."Product" alter column tags type public."ProductTag"[] using tags::text[]::public."ProductTag"[]` → restore `default '{}'` → `drop type public."ProductTag_old"`.

The header comment must explain why the enum is recreated rather than altered,
and why the file exists alongside the edits to `0001` and `0012` (fresh install
versus already-migrated database).

## Security requirements

- No change to any RLS policy, grant, or auth boundary. `0021` touches data and
  types only; `MerchPage`'s existing public-read / service-role-write policies
  are untouched.
- The tag enum narrowing must hold on the **server** side too — the Zod schemas
  in `schemas/admin.ts` and `schemas/db/*.ts` are the gate a crafted admin POST
  hits, so they change with the UI, not after it.
- No `any`, no non-null assertions, no widening of a parsed type to get the
  build green.

## Acceptance criteria

1. A body-care card and a home-fragrance card show the image, the eyebrow, the
   name, the description, the price row, and **no** button — only the corner bag.
2. Tapping that bag adds one unit and opens the cart drawer, on both pages.
3. A body-care product with `inventory = 0` shows the muted **Sold Out** pill and
   a disabled bag, and cannot be added.
4. At 375px the corner pill is flush with the card's left edge and visibly
   smaller than it was; at ≥640px it is exactly as before. In Arabic it is flush
   with the right edge.
5. `/collections` shows nine chips, ending at **Best Sellers**. No Limited
   Edition chip exists, and `?facet=limited-edition` shows the whole catalogue.
6. No card anywhere in the app prints a Limited Edition pill; the six formerly
   tagged products print their next-best badge (Best Sellers) or none.
7. `/collections/limited-edition` and `/ar/collections/limited-edition` 404.
8. The sitemap contains `/collections/best-sellers` and no limited-edition URL.
9. `/admin/collections` lists one merchandising page; `/admin/products/[id]`
   offers one tag checkbox, **New arrival**.
10. `npm run db:migrate` on an already-seeded database succeeds, and succeeds
    again unchanged on a second run. `select unnest(enum_range(null::public."ProductTag"))`
    returns `NEW_ARRIVAL` only.
11. `npm run lint` and `npx tsc --noEmit` are clean.

## Checks to run

```
npx tsc --noEmit
npm run lint
npm run db:migrate     # twice — idempotency is the point
npm run db:seed
```

## Manual test steps

1. `npm run dev`.
2. `/collections/home-fragrance` — confirm no "ADD TO CART" button; click the
   corner bag on a card and confirm the drawer opens with that product.
3. `/collections/body-care` — the same.
4. Narrow to 375px on both: the flag is flush left and smaller; the two-up grid
   is otherwise unchanged and no card overflows.
5. `/ar/collections/body-care` at 375px — the flag is flush **right**, the bag
   at the left.
6. `/collections` — count the chips: `All` plus nine, ending at Best Sellers.
   Visit `/collections?facet=limited-edition` and confirm the full catalogue.
7. Visit `/collections/limited-edition` — 404. Same under `/ar`.
8. `/sitemap.xml` — no limited-edition entry.
9. `/admin/collections` — one merchandising row, Best Sellers. Open a product
   that used to be limited (Sapphire) and confirm the tag checkbox list offers
   only New arrival and that its stored badge now reads "New".
10. `/new-arrival` still lists the `NEW_ARRIVAL` products — proof the enum
    recreation preserved the surviving value.
