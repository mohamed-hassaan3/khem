# Ritual detail page — body care & home fragrance

## Goal

Give every **body care** and **home fragrance** product a detail page of its own at
`/ritual/[slug]`: three photographs and one short story, told as a simple
editorial triptych, with the buy block beside it.

Today those goods sell straight from `<MerchCard>` on
`/collections/body-care` and `/collections/home-fragrance`, and
`productHref()` routes a cart or wishlist line back to that grid because
"body care, home fragrance, and the sets do not [have a detail page]"
(`src/lib/routes.ts` header). This is the "single-line change" that header
anticipated — plus the page it points at, and the two columns that carry its
copy.

Scope is **BODY and HOME only**. `DISCOVERY` and `GIFT` sell a boxed
composition from `<DiscoverySetCard>` and keep doing so; they stay on the
category grid and `productHref()` keeps routing them there.

## Skills read

- `.agents/skills/supabase` — migration shape, RLS, service-role writes.
- `node_modules/next/dist/docs/` — App Router dynamic segments,
  `generateStaticParams`, `generateMetadata`, ISR.

Clerk and the AI SDK are not touched: this is a public catalogue surface.

## Existing code inspected

| File | What it settled |
| :--- | :--- |
| `src/app/[locale]/perfume/[slug]/page.tsx` | The detail-page shape to mirror — `revalidate`, `generateStaticParams` over locale × slug, metadata fallback on an unknown slug, `notFound()` on a missing row. |
| `src/lib/routes.ts` | `productHref()` / `hasDetailPage()` — the one place a record becomes a link; the `switch` is exhaustive over `CollectionKind`. |
| `src/services/products.ts` | `getProductBySlug()` is scoped to `FRAGRANCE` on purpose, so BODY/HOME need their **own** query rather than a widened one. Rules: publishable key, explicit column lists, parse-never-assert, failure → `null`/`[]`. |
| `src/schemas/db/catalog.ts` | `imageRowSchema`, `IMAGE_COLUMNS`, `toImage()`, `resolveText()` — where a new image column has to be added, once. |
| `src/types/catalog.ts` | `ProductImage`, `Product`, `ProductCardData`; `CollectionKind` as a discriminator. |
| `src/components/ecommerce/MerchCard.tsx` | Client card, sells in place; carries `ProductFlag`, wishlist heart, add-to-cart. |
| `src/components/ecommerce/CategoryView.tsx` | The BODY / HOME branches that render `<MerchGrid>`. |
| `src/components/ecommerce/ProductPurchase.tsx` | `PurchasableProduct` is already a `Pick<>` that a body mist satisfies — `concentration: null`, `format: "Body Mist"`. Reusable unchanged. |
| `src/components/ecommerce/ProductBreadcrumb.tsx`, `ProductStory.tsx` | Reusable unchanged. |
| `supabase/sql/0001_catalog.sql`, `0012_merch_page.sql` | `"ProductImage"` columns + RLS; the idempotent-migration house style. |
| `supabase/seed/catalog.json`, `scripts/seed-types.ts`, `db-seed.ts`, `db-dump.ts` | The seed round-trip: a new image column must be added on **both** sides or the build breaks (by design). |
| `src/app/sitemap.ts`, `next.config.ts` | Indexable URL list; the 308 table for moved paths. |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | `bodyCare` / `homeFragrance` sections; every UI string is keyed here in both trees. |

## Decisions and assumptions

1. **Route name — `/ritual/[slug]`.** Not `/perfume/…`, which is scoped to
   fragrances at the query level and would render an empty pyramid. Not
   `/product/…`, which is a CMS word, not a house word. The dictionary already
   calls this range "The Ritual" (`bodyCare.eyebrow`), and it covers both the
   skin and the room. One route for both kinds, because they are one page
   shape — the kind only decides the eyebrow copy.

2. **The story lives in columns that already exist, plus one new one.**
   `"Product"."story"` / `story_ar` are already on the table and already
   `null` for all eight of these products — that is the short story. What is
   new is the **caption**: each of the three photographs carries one line.
   So: add `caption` / `caption_ar` to `"ProductImage"`.

   Why a column on the image and not a `story2` / `story3` on the product: the
   line belongs *to* the photograph. Stored on the product it would be three
   nullable text columns that only mean something in the right order, and
   nothing would stop an editor deleting the middle photograph and leaving its
   sentence behind. On the image, `on delete cascade` already keeps them
   together, and `sortOrder` already orders them.

   Both columns are **nullable**, and the page renders captions only when
   present — a fragrance's gallery has none and must not grow an empty caption
   strip.

3. **Three photographs is data, not a constraint.** The page lays out whatever
   the gallery holds (1 → single image, 2 → pair, 3+ → triptych). Seeding three
   is the editorial decision; hard-coding three would make a deleted photograph
   a crash.

4. **The card keeps its buy button and gains a link.** `<MerchCard>` still adds
   to cart in place — that is the whole reason it exists — but the photograph
   and the name now link to the detail page. Removing the in-place buy would be
   a regression on a page that works.

5. **Image URLs.** The two new photographs per product use `images.unsplash.com`
   placeholders in the same style as the existing seed rows (host already in
   `next.config.ts`). Real Cloudinary art can replace them from the dashboard
   later; the migration writes with `on conflict do nothing` so it never puts a
   placeholder back over an editor's photograph.

6. **No `/ritual` index page.** `/collections/body-care` and
   `/collections/home-fragrance` are the index pages; a third listing URL for
   the same goods would split the crawl.

7. **No redirects needed** — `/ritual/*` is a new path, nothing moved.

## Files likely to change

**Database**

- `supabase/sql/0013_product_image_caption.sql` — *new*. Adds
  `caption` / `caption_ar` to `"ProductImage"`; backfills the eight BODY/HOME
  products with their `story` / `story_ar` and their two extra captioned
  photographs. Idempotent, additive, `on conflict do nothing`.
- `supabase/seed/catalog.json` — the same content, for a fresh database:
  `story` / `story_ar` filled on the eight products, `images` grown to three
  each, `caption` / `caption_ar` on every image row (`null` for fragrances).

**Seed round-trip**

- `scripts/seed-types.ts` — `caption` / `caption_ar` on `ProductImageSeedRow`.
- `scripts/db-seed.ts` — write the two columns (line ~183).
- `scripts/db-dump.ts` — select and emit them (lines ~152, ~196).

**Types & schemas**

- `src/types/catalog.ts` — `ProductImage.caption: string | null`, documented.
- `src/schemas/db/catalog.ts` — `imageRowSchema` gains
  `caption` / `caption_ar` (`.nullable().default(null)`, per the file's stated
  rule so a pre-migration row still parses); `IMAGE_COLUMNS` gains them;
  `toImage()` resolves the caption.

**Query layer**

- `src/services/products.ts` — two new functions beside their fragrance twins:
  - `getRitualProductBySlug(locale, slug)` → `Product | null`, scoped to
    `collection.kind in ('BODY','HOME')`, same `!inner` join and same
    archived/soft-deleted filters as `getProductBySlug()`.
  - `getRitualProductSlugs()` → `string[]`, the same shape as
    `getProductSlugs()`, for `generateStaticParams` and the sitemap.

**Routing**

- `src/lib/routes.ts` — `productHref()`: `BODY` and `HOME` return
  `/ritual/${slug}`; `DISCOVERY` and `GIFT` keep `CATEGORY_PATH`.
  `hasDetailPage()` becomes true for the three kinds that have one.
  `CATEGORY_PATH` narrows to the two kinds still using it.

**Page & components**

- `src/app/[locale]/ritual/[slug]/page.tsx` — *new*. `revalidate = 300`,
  matching `/perfume/[slug]`.
- `src/components/ecommerce/RitualTriptych.tsx` — *new*. Server Component: the
  three captioned photographs.
- `src/components/ecommerce/MerchCard.tsx` — photograph and name become
  `<LocaleLink>`s to `productHref(product)`.

**Copy & indexing**

- `src/lib/i18n/dictionaries/en.ts`, `ar.ts` — a `ritual` section.
- `src/app/sitemap.ts` — the ritual slugs, at the same priority as products.

## Implementation requirements

### 1. Migration — `supabase/sql/0013_product_image_caption.sql`

```
alter table public."ProductImage" add column if not exists caption      text;
alter table public."ProductImage" add column if not exists "caption_ar" text;
```

Then, in the file's usual commented house style:

- `update public."Product" set story = …, story_ar = … where slug = … and story is null`
  for each of the eight products — the `is null` guard is what makes a re-run,
  and a database an editor has already written to, safe.
- `insert into public."ProductImage" (id, "productSlug", url, alt, alt_ar,
  caption, "caption_ar", "isPrimary", "sortOrder") values … on conflict (id) do nothing`
  for the two extra photographs per product (ids
  `<slug>-2`, `<slug>-3`; `isPrimary = false`; `sortOrder` 1 and 2).
- `update` the existing primary image of each of the eight to carry a caption,
  guarded with `where caption is null`.

No RLS change: the new columns are on a table whose select policy already
covers every column, and no write policy exists (nor should).

### 2. The page — `/ritual/[slug]`

Follow `/perfume/[slug]` exactly where the shapes match:

- `export const revalidate = 300;`
- `generateStaticParams()` — `LOCALES × getRitualProductSlugs()`.
- `generateMetadata()` — product name + description; on an unknown slug fall
  back to the **collections** metadata rather than echoing the segment, exactly
  as the perfume page does.
- The body: `getRitualProductBySlug()`, `notFound()` when `null`, then
  `Promise.all` for the dictionary and `getCollectionBySlug()`.

Sections, top to bottom:

1. `<ProductBreadcrumb>` — Home → Collections → {Body Care | Home Fragrances}
   → {product}. Unchanged component.
2. **Opening** — two columns on `lg`: the primary photograph (portrait,
   `aspect-3/4`, `object-cover`, `priority`) and, beside it, the eyebrow
   (`dict.ritual.eyebrow[kind]`), the name, `format` + `formatVolume()`, and
   `<ProductPurchase>`. No pyramid, no ingredients, no related rail — a body
   mist has no note tiers, and `RelatedProducts` ranks by fragrance embedding.
3. **`<RitualTriptych>`** — the remaining photographs with their captions.
4. **`<ProductStory>`** — the short story, `dict.ritual.storyHeading` as its
   heading. Wrapped in `<Reveal>`, and guarded on `story !== null` the way the
   perfume page guards it.

### 3. `<RitualTriptych>`

Server Component. Props: `images: ProductImage[]`, `heading: string`,
`locale: Locale`.

- Renders nothing when fewer than two images remain after the primary —
  self-guarding, like `<ProductIngredients>`.
- Grid: `grid-cols-1 md:grid-cols-3`, `gap-px bg-border` — the hairline seam
  the other grids use. Each cell: `aspect-4/5` image with the catalogue's
  `brightness-65 saturate-60` treatment and a slow `img-zoom` on hover, and
  beneath it a numbered eyebrow (`I / II / III`, Roman, `text-gold/55`) plus
  the caption at `text-xs leading-loose text-ivory/40`.
- Each cell wrapped in `<Reveal delay={index * 0.1}>`.
- A cell whose caption is `null` renders the photograph alone — no empty line.

### 4. Dictionaries

```
ritual: {
  eyebrow: { BODY: "The Ritual", HOME: "Scent Your Sanctuary" },
  triptychHeading: "…",
  storyHeading: "…",
  meta: { … },   // used only as the unknown-slug fallback path
}
```

Arabic is a real translation, keyed identically — no English left in the `ar`
tree except the proper nouns the codebase already treats as Latin islands
(product name, `format`). Follow `ltrIsland()` usage in `<MerchCard>` for those.

### 5. Content — the eight stories

Short: 45–70 words each, one paragraph, in the house voice (see the Noir
collection description and the ingredient copy for register). Three captions
per product, 8–16 words each, each describing *its own* photograph — the object,
the material, the gesture. No marketing superlatives, no "elevate your
routine".

The four body mists are Amber, Opal, Lapis, Turquoise; the four room sprays are
the same accords for a room. Let the story turn on the difference between
wearing an accord and living in one.

Alt text is written for a screen reader and is **not** the caption reworded —
they sit next to each other and would read as a stutter.

## Security requirements

- Reads go through `getSupabasePublic()` (publishable key, RLS applies). No
  service-role key on this surface.
- `[slug]` is untrusted input: matched against seeded slugs via a parameterised
  `.eq()`, never interpolated; an unknown value 404s.
- The new query is scoped to `BODY`/`HOME` through the `!inner` join, so
  `/ritual/nefertem-royale` 404s rather than rendering a fragrance under a
  second URL — the same duplicate-content rule that keeps
  `/perfume/amber-room-spray` off the site.
- `isArchived = false` and `deletedAt is null` on both new queries, belt and
  braces with the RLS predicate.
- Rows parsed with Zod, never asserted; one malformed image drops that image,
  not the page.
- Failure returns `null` / `[]` and logs the provider message only — never row
  contents.
- Migration is additive: no `drop`, no `delete`, no unguarded `update`.

## Acceptance criteria

- [ ] `/ritual/amber-body-mist` and `/ritual/amber-room-spray` render on both
      `/` and `/ar/` with three photographs, three captions, a story, and a
      working add-to-cart.
- [ ] All eight BODY/HOME slugs resolve; `/ritual/nefertem-royale` (a
      fragrance) and `/ritual/anything` 404.
- [ ] `/perfume/[slug]` is unchanged — same layout, pyramid, related rail, and
      its gallery shows **no** caption strip.
- [ ] `<MerchCard>` still adds to cart in one click; its photograph and name
      link to the detail page; the wishlist heart still toggles and does not
      trigger the link.
- [ ] A cart or wishlist line for a body mist now links to `/ritual/…`;
      discovery and gift lines still link to their category page.
- [ ] `/sitemap.xml` lists all eight ritual URLs in both locales, each with a
      self-referential `hreflang` map.
- [ ] `npm run db:seed` after `npm run db:migrate` is a no-op diff against a
      migrated database; `npm run db:dump` produces no diff in
      `supabase/seed/catalog.json`.
- [ ] Zero `any`; `npx tsc --noEmit` and `npm run lint` clean.
- [ ] Arabic tree: no untranslated English strings, no broken mirroring in the
      triptych or the breadcrumb.

## Checks to run

```
npm run db:migrate
npm run db:seed
npm run db:verify
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run db:migrate && npm run db:seed && npm run dev`
2. Visit `/collections/body-care`. Click the Amber photograph → lands on
   `/ritual/amber-body-mist`. Back, click **Add to Bag** on the same card →
   the button confirms and the bag count increments (the link did not fire).
3. On `/ritual/amber-body-mist`: three photographs, each with its caption; the
   story below; the price, `150 ML`, and `Body Mist` beside the buy block;
   quantity stepper capped at inventory.
4. Toggle the wishlist heart there, reload → still filled. Open `/wishlist` →
   the line links back to `/ritual/amber-body-mist`.
5. `/collections/home-fragrance` → the format filter still works; open
   `/ritual/lapis-room-spray` and confirm the eyebrow reads "Scent Your
   Sanctuary", not "The Ritual".
6. `/ar/ritual/amber-body-mist` — layout mirrors, copy is Arabic, the product
   name and `Body Mist` stay Latin and read left-to-right.
7. `/perfume/nefertem-royale` — unchanged, and no caption strip under the
   gallery.
8. `/ritual/nefertem-royale` and `/ritual/xyz` → 404.
9. `/sitemap.xml` → search for `ritual`; eight slugs × two locales.
10. Stop Supabase (or blank `NEXT_PUBLIC_SUPABASE_URL`) and reload
    `/collections/body-care` → empty state, no 500.
