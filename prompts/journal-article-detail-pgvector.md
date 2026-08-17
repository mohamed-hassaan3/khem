# Journal article detail page + pgvector related articles

## Goal

Give `/journal/[slug]` a real page: a museum-grade cinematic banner, long-form
editorial body copy stored in Supabase, and a "Continue Reading" rail at the
bottom ranked by **pgvector** semantic similarity — the same machinery
`related_products()` already uses on the PDP, extended to `"Article"`.

Three parts:

1. **Data** — `"Article"` gains a `body` column (the article text), a generated
   `search_document`, an `embedding vector(1536)`, an HNSW index, an
   invalidation trigger, and a `related_articles()` SQL function.
2. **Page** — `src/app/[locale]/journal/[slug]/page.tsx` plus the components it
   needs, ISR 1h, both locales prerendered, in the KHEM luxury language.
3. **Pipeline** — `npm run embed` covers articles as well as products; the admin
   article save embeds the one row it just wrote; sitemap and revalidation learn
   about article URLs.

## Skills read

- `.agents/skills/supabase` — schema, migrations, RLS, service-role usage, pgvector.
- `.agents/skills/ai-sdk` — `embed` / `embedMany` through the AI Gateway.
- `node_modules/next/dist/docs/` — App Router `generateStaticParams`,
  `generateMetadata`, ISR, server/client boundaries.

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `src/app/[locale]/journal/page.tsx` | Index page: header, featured card, `<JournalGrid>`; ISR 3600; `localeMetadata`; `ltrIsland` around DB copy. |
| `src/app/[locale]/perfume/[slug]/page.tsx` | The detail-page template to mirror: `generateStaticParams` over `LOCALES × slugs`, `notFound()` on unknown slug, metadata fallback, `Promise.all` fan-out, `<RelatedProducts>` at the bottom. |
| `src/components/ecommerce/RelatedProducts.tsx` | Related-rail layout: `border-t`, `py-24 md:py-32`, `max-w-350`, eyebrow + heading, `grid gap-px bg-border`, returns `null` when empty. |
| `src/services/content.ts` | Query-layer contract: publishable key, explicit column lists, `parseList`, `logFailure`, degrade to empty rather than throw. |
| `src/services/products.ts` → `getRelatedProductCards()` | The `.rpc(...).select(COLUMNS)` shape — the projection on top of a `setof` return keeps `embedding` out of the response. |
| `src/schemas/db/content.ts` | `ARTICLE_COLUMNS`, `articleRowSchema`, `toArticle()` — the row→`JournalArticle` boundary. |
| `src/types/content.ts` | `JournalArticle` interface. |
| `supabase/sql/0002_content.sql` | `"Article"` table, `article_published_idx`, RLS `"Published articles are readable"`, grants. |
| `supabase/sql/0004_search.sql` | The pgvector precedent: `extensions` schema, `join_text`, generated `search_document`, HNSW `vector_cosine_ops`, `related_products()` with `security invoker` + `search_path = ''`, the invalidation trigger, and the documented trigger bug. |
| `scripts/embed-catalog.ts` | Batched `embedMany`, `--check` mode, `BATCH_SIZE = 32`, gateway credential guard. |
| `src/lib/search/embed.ts`, `config.ts` | `embedDocument()`, `toVectorLiteral()`, `hasGatewayCredentials()`, `EMBEDDING_MODEL`/`DIMENSIONS`/`VERSION`. |
| `src/actions/admin/journal.ts`, `catalog.ts` | `requireAdmin()` → Zod → service key; catalog's post-save single-row embed is the pattern to copy for articles. |
| `src/schemas/admin.ts` (`articleFields`) | The admin Zod fields the body must join. |
| `src/components/admin/ArticleForm.tsx` | Controlled-state editor form the body textarea joins. |
| `scripts/db-seed.ts` | `upsert(client, "Article", "id", …)` — the seed mapping the new column joins. |
| `src/lib/admin/revalidate.ts` | `revalidateArticle()` — currently home + `/journal` + sitemap only. |
| `src/app/sitemap.ts` | Lists `/journal` but no article URLs. |
| `src/lib/i18n/dictionaries/en.ts` / `ar.ts` | `journal.*` keys; `product.related.*` as the copy precedent. |

## Decisions and assumptions

1. **Body is one `text` column, not a block table.** Blank-line-separated
   paragraphs; a line beginning `## ` is a section subheading; a line beginning
   `> ` is a pull quote. Parsed at render by a small pure helper — no markdown
   dependency is added, and no HTML is ever stored or dangerously injected.
2. **Body copy is seeded for all six existing articles** in
   `supabase/seed/content.json`, written in KHEM's editorial voice, roughly
   matching each article's stated `readTimeMinutes`.
3. **Article body is English-only**, exactly like every other DB-stored string
   in this project. Arabic locale renders it inside `ltrIsland()`; only chrome
   (eyebrows, headings, labels) is translated.
4. **`related_articles()` mirrors `related_products()`**: vectors first, cosine
   distance, then an editorial fallback — same category first, then newest — so
   the rail is full on a database where `npm run embed` has not yet run.
5. **The article invalidation trigger is written correctly from the start.**
   `0004_search.sql` documents that `product_embedding_invalidation` nulls the
   vector on every update because STORED generated columns are computed after
   BEFORE triggers. The article trigger guards on
   `new.embedding is not distinct from old.embedding`, so an explicit embedding
   write survives. **The product trigger is left alone — out of scope**, and the
   new file must not silently change it.
6. **New SQL file `supabase/sql/0009_journal.sql`**, idempotent like the rest;
   `0002_content.sql` and `0004_search.sql` are not rewritten.
7. **`readTimeMinutes` stays authored, not computed** from the body — it is an
   editorial figure, and recomputing it would change published pages.

## Files likely to change

**New**

- `supabase/sql/0009_journal.sql`
- `src/app/[locale]/journal/[slug]/page.tsx`
- `src/components/journal/ArticleHero.tsx` (Server Component)
- `src/components/journal/ArticleBody.tsx` (Server Component)
- `src/components/journal/RelatedArticles.tsx` (Server Component)
- `src/components/journal/ArticleCard.tsx` — extracted from `JournalGrid` so the
  grid and the related rail share one card rather than forking the design
- `src/lib/journal/body.ts` — the block parser (pure, unit-testable)

**Modified**

- `supabase/seed/content.json` — `body` for all six articles
- `scripts/db-seed.ts` — map `body` into the `"Article"` upsert
- `scripts/embed-catalog.ts` — embed articles alongside products
- `src/types/content.ts` — `body: string` on `JournalArticle`
- `src/schemas/db/content.ts` — `ARTICLE_COLUMNS`, `articleRowSchema`; add a
  narrow `ARTICLE_CARD_COLUMNS` projection (no body, no embedding) for lists
- `src/services/content.ts` — `getArticleBySlug()`, `getArticleSlugs()`,
  `getRelatedArticles()`
- `src/schemas/admin.ts` — `body` in `articleFields`
- `src/components/admin/ArticleForm.tsx` — body textarea
- `src/actions/admin/journal.ts` — embed after create/update
- `src/lib/admin/revalidate.ts` — `revalidateArticle(slug?)` also revalidates
  `/journal/[slug]`
- `src/app/sitemap.ts` — one entry per published article, both locales
- `src/components/journal/JournalGrid.tsx` — use the extracted `ArticleCard`
- `src/lib/i18n/dictionaries/en.ts`, `ar.ts` — `journal.article.*` keys

## Implementation requirements

### 1. SQL — `supabase/sql/0009_journal.sql`

```sql
alter table public."Article" add column if not exists body text not null default '';

alter table public."Article"
  add column if not exists search_document text
    generated always as (
      coalesce(title, '') || '. ' || coalesce(category, '') || '. ' ||
      coalesce(excerpt, '') || ' ' || coalesce(body, '')
    ) stored;

alter table public."Article"
  add column if not exists embedding extensions.vector(1536);

create index if not exists article_embedding_idx
  on public."Article" using hnsw (embedding extensions.vector_cosine_ops);
```

- `related_articles(article_slug text, match_limit int default 3)` →
  `setof public."Article"`, `language sql`, `stable`, `security invoker`,
  `set search_path = ''`, cosine via `OPERATOR(extensions.<=>)`.
  Excludes the source row and anything not `"isPublished"`.
  Order: `(p.embedding is null or s.embedding is null)`, then cosine distance
  `nulls last`, then `(p.category <> s.category)`, then `"publishedAt" desc`,
  then `p.slug`.
- `public.invalidate_article_embedding()` — BEFORE UPDATE, nulls `embedding`
  when `search_document` changes **and** `new.embedding is not distinct from
  old.embedding` (see decision 5).
- `grant execute on function public.related_articles(text, int) to anon, authenticated;`
- No new RLS policy and no new grant on `"Article"` — `0002_content.sql` already
  grants `select`, and `security invoker` keeps the draft filter honest.

### 2. Data layer

- `ARTICLE_COLUMNS` gains `body`; add `ARTICLE_CARD_COLUMNS` (everything except
  `body`) and use it for `getJournalArticles`, `getLatestArticles`,
  `getFeaturedArticle`, `getRelatedArticles`. `embedding` is never selected
  anywhere.
- `articleRowSchema` gets `body: z.string()`; the card schema derives from it via
  `.omit({ body: true })` so the two cannot drift, with `body` defaulting to `""`
  on card rows. `JournalArticle.body` is `string`.
- `getArticleBySlug(slug)` → `JournalArticle | null` (published only, via RLS).
- `getArticleSlugs()` → `string[]` for `generateStaticParams`.
- `getRelatedArticles(slug, limit = 3)` → `.rpc("related_articles", { article_slug, match_limit }).select(ARTICLE_CARD_COLUMNS)`, parsed with `parseList`.
- Every function follows the existing contract: `getSupabasePublic()` null-guard,
  `logFailure` on error, empty/null return — never a throw.

### 3. Body parser — `src/lib/journal/body.ts`

```ts
export type ArticleBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string };

export function parseArticleBody(body: string): ArticleBlock[];
```

Split on blank lines, trim, drop empties; `## ` → heading, `> ` → quote, else
paragraph. Plain text only — no HTML, no `dangerouslySetInnerHTML`, anywhere.

### 4. Page — `src/app/[locale]/journal/[slug]/page.tsx`

- `export const revalidate = 3600` (AGENTS.md §8, journal is ISR 1h).
- `generateStaticParams()` over `LOCALES × getArticleSlugs()`.
- `generateMetadata()` via `localeMetadata({ locale, path: '/journal/{slug}', … })`
  using the article title/excerpt; unknown slug falls back to the journal index
  metadata, exactly as the PDP falls back to `/collections`.
  Include `openGraph.images` with the banner and `type: "article"` plus
  `publishedTime`.
- Unknown slug → `notFound()`. The segment is untrusted input and is only ever
  matched against stored slugs.
- Server Component throughout; nothing here needs `'use client'`.
- Emit `Article` JSON-LD (`headline`, `image`, `datePublished`, `articleSection`,
  `publisher: KHEM`) via a `<script type="application/ld+json">` with
  `JSON.stringify` output — string data only, no user HTML.

### 5. Visual interpretation — luxury / museum

**Banner (`ArticleHero`)**

- Full-bleed `relative h-[70vh] min-h-125 w-full overflow-hidden`, `Image` with
  `fill priority sizes="100vw" className="object-cover brightness-45 saturate-75 scale-105"`.
- Two stacked overlays for depth: a vertical gradient
  `bg-gradient-to-t from-background via-background/70 to-transparent` and a
  subtle `bg-black/25`. The bottom edge must dissolve into `--color-background`
  so the hero reads as an exhibition plate, not a boxed image.
- Copy block absolutely positioned bottom-left, `max-w-4xl`, `px-6 md:px-20`,
  `pb-16 md:pb-24`, inside `mx-auto max-w-350`:
  - Breadcrumb `Journal / {category}` — `font-heading text-[10px] uppercase tracking-[0.25em] text-ivory/40`, `Journal` a `LocaleLink` to `/journal`.
  - Category eyebrow in gold (`eyebrow` utility class).
  - `<h1>` `font-heading text-3xl font-normal leading-tight text-ivory sm:text-5xl md:text-6xl`, balanced (`text-balance`).
  - Meta row: reading time · date, separated by `h-3 w-px bg-ivory/15` rules —
    the exact separator vocabulary the index page already uses.
- A thin gold hairline (`h-px w-24 bg-gradient-to-r from-gold to-transparent`)
  under the title, matching the house divider.
- Motion: `Reveal` only, opacity/translate, ease-out, no spring, no bounce, no
  parallax that shifts layout. Nothing may cause CLS — the hero is the LCP.

**Body (`ArticleBody`)**

- Single measured column: `mx-auto max-w-3xl px-6 py-20 md:py-28`.
- Lead paragraph (the excerpt) at `text-lg md:text-xl leading-relaxed text-ivory/70 italic font-heading` above a `GoldDivider`-style rule.
- Paragraphs `text-[15px] leading-[2] text-ivory/60`, `mb-8`.
- Headings `font-heading text-xl md:text-2xl text-ivory mt-16 mb-6`.
- Quotes: `border-l border-gold/40 pl-8 font-heading text-xl md:text-2xl italic text-champagne`, generous `my-14`; in RTL the border flips (`rtl:border-l-0 rtl:border-r rtl:pr-8 rtl:pl-0`).
- First paragraph gets a gold drop-cap via `first-letter:` utilities
  (`first-letter:float-left first-letter:font-heading first-letter:text-6xl first-letter:leading-none first-letter:text-gold first-letter:me-3 first-letter:mt-1`), logical properties so it flips under RTL.
- Body text is DB English — wrap in `ltrIsland(locale)`.
- Empty body → render the excerpt alone and no drop cap; never an empty column.

**Related rail (`RelatedArticles`)**

- Same skeleton as `RelatedProducts`: `border-t border-border px-6 py-24 md:px-20 md:py-32`, `mx-auto max-w-350`, centred eyebrow + heading, `grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3`.
- Cards are the extracted `ArticleCard` — identical hover (`img-zoom`, 700ms
  ease-out zoom, gold arrow translate) to the journal grid.
- Returns `null` when the service returns nothing.

**Responsiveness**

- 375 / 768 / 1024 / 1440 / 1920 verified. Hero title never wraps to more than
  four lines at 375; body measure stays ~68–75ch at ≥1024; no horizontal scroll
  at any width; RTL mirrors arrows, drop cap, quote rule, and breadcrumb order.

### 6. Pipeline

- `scripts/embed-catalog.ts`: generalise the pending→embed→write loop over a
  small table descriptor (`{ table, label }`) and run it for `"Product"` and
  `"Article"`. `--check` reports both and exits non-zero if either has gaps.
  Article pending filter: `embedding is null and "isPublished"`.
  Keep `BATCH_SIZE`, retries, dimension check, and the credential guard as-is.
- `src/actions/admin/journal.ts`: after a successful create/update, read back
  `search_document`, call `embedDocument()`, write `embedding` with
  `toVectorLiteral()` through the service-role client — mirroring
  `actions/admin/catalog.ts`. A failed embed logs and still returns `ok: true`;
  it must never lose the editor their work.
- `revalidateArticle(slug?: string)` also revalidates `/journal/${slug}` in both
  locales when a slug is given; all existing call sites pass theirs.
- `src/app/sitemap.ts`: one entry per published article at `/journal/{slug}`,
  both locales, `lastModified` from `publishedAt`, `priority: 0.5`, with the
  self-referential `alternates.languages` map the file already builds.

### 7. Copy keys (both dictionaries)

`journal.article.backToJournal`, `journal.article.related.eyebrow` ("Continue
Reading"), `journal.article.related.heading`, `journal.article.share`,
`journal.article.publishedOn`. Arabic translations written properly, not
transliterated English.

## Security requirements

- Reads go through `getSupabasePublic()` (publishable key, RLS applies); the
  service-role client appears only inside `src/actions/admin/journal.ts` behind
  `requireAdmin()`.
- `related_articles()` is `security invoker` with `set search_path = ''` — a
  `security definer` function would hand anonymous callers the owner's
  visibility and expose drafts.
- No new RLS policy or grant that widens `"Article"`; drafts stay invisible to
  `anon`.
- The `[slug]` segment is never interpolated into SQL or a URL — it is a bound
  RPC/filter argument, and an unknown value 404s.
- Body renders as text nodes only. No `dangerouslySetInnerHTML` anywhere.
- No secret, key, or `search_document`/`embedding` value reaches the client;
  column projections exclude `embedding` everywhere.
- Admin body input is Zod-bounded (min 0, max ~20 000 chars) before it reaches
  Postgres.

## Acceptance criteria

1. `/journal/{slug}` and `/ar/journal/{slug}` render for all six seeded articles;
   an unknown slug 404s in both locales.
2. Banner reads as a museum plate: full-bleed image dissolving into the page
   background, gold hairline, Cinzel title, no layout shift.
3. Body renders paragraphs, subheadings, and pull quotes from the stored `body`,
   with the gold drop cap; RTL mirrors correctly.
4. The related rail shows three other articles, and after `npm run embed` the
   selection is demonstrably semantic (e.g. the oud article surfaces the saffron
   / ingredient essays before an unrelated Culture piece).
5. Before `npm run embed` — every `embedding` null — the rail is still full via
   the category/recency fallback.
6. Cards in the rail and in `/journal` are the same component; the grid's
   appearance is unchanged.
7. Admin can author `body` at `/admin/journal/{slug}`; saving re-embeds the row
   and the public page reflects the edit after revalidation.
8. `npm run embed -- --check` reports products **and** articles.
9. `/sitemap.xml` lists every published article in both locales.
10. Zero TypeScript errors, zero `any`, zero ESLint warnings.

## Checks to run

```bash
npm run db:migrate      # applies 0009_journal.sql
npm run db:seed         # writes the new body copy
npm run db:verify
npm run embed -- --check
npm run embed
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run db:migrate && npm run db:seed && npm run embed`
2. `npm run dev`
3. Visit `/journal`, click the featured card → lands on `/journal/alchemy-of-ancient-egyptian-perfumery`.
4. Confirm the banner: image bleeds to the edges, fades into the background,
   breadcrumb `Journal / Heritage`, gold hairline, title in Cinzel.
5. Read the body: drop cap on the first paragraph, subheadings, at least one
   pull quote, comfortable measure.
6. Scroll to "Continue Reading" — three articles, hover zoom matches the journal
   grid, each links to its own detail page.
7. Visit `/ar/journal/alchemy-of-ancient-egyptian-perfumery`: chrome is Arabic
   and RTL, English body copy stays LTR inside its island, drop cap and quote
   rule are on the right, arrows point left.
8. Resize through 375 / 768 / 1024 / 1440 — no horizontal scroll, no overlap.
9. Visit `/journal/not-a-real-article` → 404 page.
10. Sign in as admin → `/admin/journal/saffron-the-golden-thread`, edit the body,
    save; reload the public page and confirm the change and that
    `npm run embed -- --check` reports zero pending (the save re-embedded it).
11. `curl localhost:3000/sitemap.xml | grep journal/` → twelve article URLs.
12. Lighthouse on the article page: Performance ≥ 95, SEO 100, CLS ≈ 0.
