# `/ritual/[slug]` — full parity with `/perfume/[slug]`, minus the pyramid

## Goal

Rebuild the ritual detail page so it *is* the product detail page: the same
gallery on the left, the same buy block, story, **Key Ingredients**, **comments**,
and a **pgvector-ranked related rail** on the right and below. Everything
`/perfume/[slug]` has, except the fragrance pyramid — a body mist has no note
tiers to unfold.

This corrects the previous round. The triptych read the brief as "three
photographs laid out in a row"; what was wanted is three photographs *in the
gallery*, stepped through exactly as a fragrance's are.

## Skills read

- `.agents/skills/supabase` — function replacement, RLS, `security invoker`.
- `.agents/skills/ai-sdk` — `embedMany` through the gateway, as `scripts/embed-catalog.ts` already uses it.
- `node_modules/next/dist/docs/` — App Router dynamic segments, ISR, `revalidatePath`.

## Existing code inspected

| File | What it settled |
| :--- | :--- |
| `src/app/[locale]/perfume/[slug]/page.tsx` | The layout to match, section for section. |
| `src/app/[locale]/ritual/[slug]/page.tsx` | What this pass rewrites. |
| `src/components/ecommerce/ProductGallery.tsx` | Scroll-snap track + thumbnails, `ProductImage[]`. Kind-agnostic already — nothing about it is fragrance-specific. |
| `src/components/ecommerce/ProductIngredients.tsx` | Self-guarding; renders from `Ingredient.usedIn`, so a ritual product needs **usage rows**, not new code. |
| `src/components/ecommerce/ProductComments.tsx` | Self-guarding on `isSupabaseConfigured()`; takes a bare `slug`. |
| `src/components/ecommerce/RelatedProducts.tsx` | Lays out `<ProductCard>`s; the *service* decides membership. |
| `supabase/sql/0004_search.sql` **L191–228** | `related_products()` hard-filters `c.kind = 'FRAGRANCE'` — the one blocker for a cross-kind rail. |
| `src/actions/comments.ts` **L83, L137** | Validates the slug with the FRAGRANCE-scoped `getProductBySlug()`, and revalidates a hard-coded `/perfume/…` path. **Both break on a ritual slug.** |
| `src/services/content.ts` **L117** | `getIngredientsForProduct()` joins `IngredientUsage!inner` on `productSlug`. |
| `supabase/sql/0002_content.sql` **L100–113** | `"IngredientUsage"` — `(ingredientId, productSlug)` unique, carries a `name` snapshot. |
| `supabase/seed/content.json` | Usages are seeded from each ingredient's `usedIn: [{name, slug}]` array. |
| `scripts/embed-catalog.ts` | Needs `AI_GATEWAY_API_KEY` — **present in `.env.local`**, so vectors can actually be generated this pass. |

## Decisions and assumptions

1. **The page becomes a near-copy of the perfume page.** Same order:
   breadcrumb → `<ProductGallery>` | (purchase, story, ingredients) →
   `<ProductComments>` → `<RelatedProducts>`. The pyramid block is the only
   omission, and `dict.ritual.eyebrow[kind]` is the only addition.

2. **`<RitualTriptych>` is deleted.** It was the wrong reading of the brief and
   nothing else uses it.

3. **The captions are kept, and move into the gallery.** They are written,
   translated, and stored, and the gallery is where an image's own line
   belongs. `<ProductGallery>` prints the active slide's caption when there is
   one — which is never for a fragrance, whose `caption` is null on every row,
   so `/perfume/[slug]` renders exactly as it does today.

   *If you would rather the captions go entirely, say so and I will drop the
   column and the content instead — it is a smaller change, not a larger one.*

4. **The related rail is widened by parameter, not by deletion.**
   `related_products()` gains a third argument, `kinds text[] default
   '{FRAGRANCE}'`. The perfume page keeps calling it with two arguments and its
   rail is unchanged; the ritual page passes `{FRAGRANCE,BODY,HOME}` so a body
   mist can surface its own eau de parfum, its room-spray twin, *and* a
   scent-adjacent perfume — which is what was asked for.

   The old two-argument function is **dropped** before the new one is created.
   Postgres would otherwise keep both, and a two-argument call would be
   ambiguous between the old function and the new one's default.

   Discovery and gift sets stay out of the array: they have no detail page, so
   a card for one would link back to a category grid from a rail that is
   otherwise all detail pages.

5. **Vectors get generated.** `AI_GATEWAY_API_KEY` is in `.env.local`, so
   `npm run embed` is part of this pass rather than a note for later. Until it
   runs the function degrades to its editorial ordering — that fallback is why
   the rail is never empty, and it stays.

6. **Key Ingredients needs data, not code.** The eight products get usage rows
   against the materials they are actually built from, following the accords
   already written into each `description`:

   | Product | Materials |
   | :--- | :--- |
   | Amber (mist & spray) | Frankincense, Ambergris |
   | Opal (mist & spray) | Black Iris, Ambergris |
   | Lapis (mist & spray) | Black Iris, Haitian Vetiver |
   | Turquoise (mist & spray) | Neroli, Ambergris |

   Ambergris carries the "white amber / red amber" base in three of the four,
   which is what the descriptions already say.

7. **Comments must accept a ritual slug.** This is a real defect the moment the
   page renders the form: `actions/comments.ts` would reject every post with
   `slugInvalid`, because it validates against a fragrance-only query. The
   validation moves to a query scoped to *products with a detail page*, and the
   revalidation path comes from `productHref()` instead of a hard-coded
   `/perfume/` prefix.

8. **No new dictionary section.** The page reuses `dict.product.*` for every
   heading, exactly as the perfume page does. `dict.ritual` keeps only `meta`
   and `eyebrow`; `triptychHeading` and `triptychLabel` are removed.

## Files likely to change

**Database**

- `supabase/sql/0014_ritual_detail_parity.sql` — *new*.
  - `drop function if exists public.related_products(text, int);`
  - `create or replace function public.related_products(product_slug text, match_limit int default 3, kinds text[] default '{FRAGRANCE}')` — body identical but for `where c.kind = any(kinds)`, and a tie-break that prefers the *same* kind before the same collection, so a body mist's rail opens with body care rather than with whichever perfume sorts first.
  - `grant execute` on the new signature.
  - `insert … on conflict do nothing` for the 16 `"IngredientUsage"` rows.
- `supabase/seed/content.json` — the same usages, added to each ingredient's `usedIn` array, so a fresh database gets them from `npm run db:seed`.

**Query layer**

- `src/services/products.ts`
  - `getRelatedProductCards()` gains an options argument carrying the kinds, defaulted so every existing call is unchanged.
  - `getDetailPageProductBySlug()` — a fragrance **or** ritual product by slug, for the comment action's validation. Scoped to the kinds that have a detail page, so a gift-set slug is still rejected.

**Server Action**

- `src/actions/comments.ts` — validate with `getDetailPageProductBySlug()`; revalidate `productHref({ slug, collectionKind })` for both locales.

**Page & components**

- `src/app/[locale]/ritual/[slug]/page.tsx` — rewritten to the perfume layout.
- `src/components/ecommerce/RitualTriptych.tsx` — **deleted**.
- `src/components/ecommerce/ProductGallery.tsx` — renders the active slide's caption when present.

**Copy**

- `src/lib/i18n/dictionaries/{en,ar}.ts` — drop `ritual.triptychHeading` and `ritual.triptychLabel`; keep `meta` and `eyebrow`.

## Implementation requirements

### 1. The page

Mirror `/perfume/[slug]` exactly, including the `Promise.all` fan-out and the
`<Reveal>` wrappers:

```
<ProductBreadcrumb …/>
<section className="grid grid-cols-1 lg:grid-cols-2">
  <ProductGallery images={gallery} productName={product.name} />
  <div className="flex max-w-2xl flex-col gap-16 px-6 py-14 …">
    <ProductPurchase …/>            {/* eyebrow above it, per kind */}
    {story ? <Reveal><ProductStory …/></Reveal> : null}
    {ingredients.length ? <Reveal><ProductIngredients …/></Reveal> : null}
  </div>
</section>
<ProductComments slug={product.slug} locale={…} />
<RelatedProducts products={related} locale={…} />
```

No `<ProductPyramid>`. The `gap-16` and the `px`/`py` scale come from the
perfume page unchanged — this is parity, so the numbers are copied, not
re-chosen.

### 2. `related_products()`

Keep the existing ordering and add one term:

```
order by
  (p.embedding is null or s.embedding is null),
  case when both non-null then p.embedding <=> s.embedding end nulls last,
  (c.kind <> s_kind),                    -- new: same kind first
  (p."collectionSlug" <> s."collectionSlug"),
  p."sortOrder",
  p.slug
```

`security invoker`, `set search_path = ''`, and the `extensions.<=>` operator
qualification all stay as they are — they are not incidental.

### 3. Gallery captions

`<figcaption>` under the active slide, only when that image has one. It must
not shift layout when absent, must not be announced twice alongside the `alt`,
and must carry `dir="auto"` for the Arabic tree.

### 4. Comments

`getDetailPageProductBySlug()` returns the product for FRAGRANCE, BODY and HOME.
The action's error path is unchanged — an unknown or set-only slug still returns
`slugInvalid` rather than a constraint violation.

## Security requirements

- Reads stay on `getSupabasePublic()`; the comment insert stays on the service
  key inside the action, behind its existing rate limit.
- `kinds` is passed as a bound RPC argument from a **server-side constant**,
  never from the request — a visitor cannot widen their own rail.
- The widened comment validation still rejects any slug without a detail page,
  and the foreign key on `product_comment.product_slug` remains the backstop.
- The function keeps `security invoker`, so RLS applies to the caller; it must
  not become `security definer` while adding a parameter.
- Migration stays additive: no `drop table`, no `delete`; the one `drop
  function` is immediately replaced in the same transaction-per-file.
- Ingredient usage inserts are `on conflict do nothing`, so a re-run cannot
  overwrite an editor's ordering.

## Acceptance criteria

- [ ] `/ritual/amber-body-mist` renders a **stepped gallery of three images**
      with thumbnails, a buy block, a story, Key Ingredients, a comment form,
      and a related rail — and **no pyramid**.
- [ ] The related rail on a ritual page can contain body care, home fragrance
      *and* perfumes; every card links to a page that exists.
- [ ] `/perfume/[slug]`'s rail still contains **fragrances only**.
- [ ] Posting a comment on `/ritual/amber-body-mist` succeeds and the comment
      appears after reload (it currently would fail `slugInvalid`).
- [ ] `npm run embed` completes and `npm run db:verify` reports 28/28 embedded.
- [ ] Key Ingredients lists the right materials per accord, in both locales.
- [ ] Gallery captions show on ritual images and are absent on fragrances.
- [ ] `<RitualTriptych>` is gone and nothing imports it.
- [ ] Zero `any`; `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.

## Checks to run

```
npm run db:migrate
npm run db:seed
npm run embed
npm run db:verify
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run db:migrate && npm run db:seed && npm run embed && npm run dev`
2. `/ritual/amber-body-mist` — step the gallery with the arrows, the thumbnails,
   and a trackpad swipe; three images, captions changing with the slide.
3. Same page: Key Ingredients lists Frankincense and Ambergris, each linking to
   `/ingredients`; no pyramid anywhere.
4. Post a comment as a signed-out visitor → it appears under "Guest" after the
   page revalidates. Post one signed in → your name.
5. Scroll to the rail: confirm at least one non-fragrance card, and click
   through to confirm the destination resolves.
6. `/perfume/onyx-night` — rail is still fragrances only; gallery shows no
   caption line; pyramid intact.
7. `/ar/ritual/lapis-room-spray` — mirrored layout, Arabic ingredients,
   Arabic captions, working comment form.
8. `/ritual/xyz` and `/ritual/onyx-night` still render the 404 page.
