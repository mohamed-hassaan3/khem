# Search — Slide-In Overlay + Hybrid Semantic Results (pgvector-ready)

## Goal

Two halves, one feature:

**A. The surface.** The Nav search icon opens a luxury slide-in panel from the logical **end**
edge (right in English, left in Arabic) over a blurred page backdrop:

- **≥ 1024px:** 75% of viewport width, capped at `1040px`
- **640–1023px:** 85%
- **< 640px:** full screen

Live suggestions while typing; **Enter** navigates to `/search?q=…`. Keyboard-operable,
screen-reader-correct, bilingual, RTL-safe.

**B. The engine.** Search is **hybrid**: a lexical pass over the catalog fused with a
**semantic pass over embeddings**, so "something smoky for a winter night" finds the Noir
fragrances even though none of those words appear in the data. The embedding layer is written
against the shape it will have in Postgres — one document-builder, one similarity contract,
one fusion function — so migrating to **Supabase + pgvector** replaces the *storage* of the
vectors and nothing else.

---

## Skills read

- **`.agents/skills/ai-sdk`** — "never write AI SDK code from memory." Verified against the
  live docs before writing this prompt: `embed()` / `embedMany()` / `cosineSimilarity()` are
  current (`ai-sdk.dev/docs/ai-sdk-core/embeddings.md`), model strings go through the AI
  Gateway as `provider/model`, and `providerOptions.openai.dimensions` controls vector width.
  Latest `ai` is **7.0.64**. **At implementation time the bundled docs at
  `node_modules/ai/docs/` must be read again** — they match the installed version and outrank
  both this prompt and the web docs.
- **`.agents/skills/supabase`** — RLS on every table in an exposed schema; views need
  `security_invoker`; never expose the service-role key; **never invent a migration filename**
  (`supabase migration new <name>` generates it). Hence the SQL below ships as documentation
  under `supabase/sql/`, not as a fabricated migration file.
- `node_modules/next/dist/docs/` — route handlers, `searchParams` in Server Components,
  static-over-dynamic segment precedence (`app/api/*` beats `app/[locale]/*`).

## Existing code inspected

| File | What it settles |
| :--- | :--- |
| `src/components/Nav.tsx` | Search button (L275–281) is a dead `<button>`; drawer open-state derivation, Escape handling, scroll-lock, `inert`, z-ladder (nav 1000, drawer 1001) |
| `src/types/catalog.ts` | `ProductCardData` — the projection results are built from |
| `src/services/products.ts` | Query-layer conventions: `async`, exact UI projection, a `→ supabase…` comment per function |
| `src/lib/facets.ts` | Precedent for URL-param helpers (`FACET_PARAM` / `parseFacet` / `facetHref`) |
| `src/lib/routes.ts` | `productHref()` — the only way a card becomes a link |
| `src/components/ecommerce/{CollectionView,CollectionGrid,ProductCard,PageHeader,EmptyState,CollectionSkeleton}.tsx` | Grid geometry, server-rendered cards handed to a client shell, reusable header/empty/skeleton |
| `src/lib/i18n/{config,metadata,rtl}.ts`, `LocaleLink.tsx` | Locale prefixing, `localeMetadata()`, `ltrIsland()` |
| `src/proxy.ts` | `api` is excluded from the matcher → `/api/search` is neither locale-rewritten nor auth-gated |
| `src/lib/storage.ts` | Guarded `localStorage` + type-guarded reads — reused for recent searches |
| `package.json` | **No Zod, no `ai`, no Supabase/Prisma client.** `tsx` **is** available (devDep) → the embedding script runs under it. `motion` exists but Nav uses CSS transitions |
| `prisma/AGENTS.md`, AGENTS.md §9 | The `Product` model the vector column will hang off |

---

## Decisions & assumptions

1. **Panel side is logical.** Right under `dir="ltr"`, left under `dir="rtl"`, matching the
   drawer's `start`-anchored convention. Transforms are not mirrored by `dir`, so the RTL
   variant is explicit (`translate-x-full rtl:-translate-x-full`), as `Nav.tsx` already does.
2. **Hybrid, not pure semantic.** Pure vector search is bad at exact intent — a visitor typing
   `Sekhem Ambré` wants that flacon first, and embeddings routinely rank a "similar" product
   above an exact name match. Lexical and semantic rankings are fused with **Reciprocal Rank
   Fusion** (`score += weight / (RRF_K + rank)`), which is the same algorithm the Postgres
   version will run, so relevance does not visibly change on migration day.
3. **Embeddings are precomputed offline and committed.** `scripts/embed-catalog.ts` batch-embeds
   the catalog with `embedMany()` and writes `src/data/embeddings.generated.json`. Committed to
   the repo so `npm run build` and CI never need an API key, and so a build can never silently
   cost money. Only the **query** is embedded at request time.
4. **Vectors live behind the service layer.** `embeddings.generated.json` is imported by
   `src/services/search.ts` alone. It must never reach the client bundle — the same rule
   `src/services/products.ts` already documents.
5. **Model: `openai/text-embedding-3-small` at 1536 dimensions**, via the AI Gateway
   (`AI_GATEWAY_API_KEY`), so no provider package is installed — only `ai`. Chosen for cost,
   ubiquity, and a dimension that matches every pgvector example.
   *Caveat, stated plainly:* cross-lingual retrieval (Arabic query → English catalog text) is
   this model's weak spot. `EMBEDDING_MODEL` / `EMBEDDING_DIMENSIONS` therefore live in one
   config module, so switching to `cohere/embed-v4.0` or `voyage/voyage-3.5` (both stronger
   multilingual, both on the gateway) is a one-line change plus a re-run of the script plus one
   `ALTER TABLE` later. Arabic queries are additionally covered by the term-mapping in the
   dictionaries (decision 9).
6. **Degradation is mandatory, not optional.** No API key, no embeddings file, a provider
   error, or a >2.5s timeout ⇒ the search silently falls back to lexical-only and reports
   `mode: "lexical"` internally. **Search never shows an error because AI is unavailable.**
7. **The results page is the source of truth**, the panel is a shortcut. The page works with
   JavaScript disabled via a plain `GET` form.
8. **Search-result pages are `noindex, follow`.** Indexing arbitrary query URLs is an SEO
   liability; `/collections` already covers the catalog.
9. **Arabic popular-search chips carry an English `term` with an Arabic `label`** — catalog
   strings are English-only (the reason `ltrIsland()` exists), so the chip's *value* must be
   the searchable string.
10. **No Zod** (not installed) — the query is hand-validated. **No Motion** — CSS transitions,
    matching Nav.
11. **New dependency: `ai` only**, pinned to `^7.0.64`.

---

## Files likely to change

**New — engine**

- `src/lib/search/config.ts` — model, dimensions, thresholds, RRF constants, `EMBEDDING_VERSION`.
- `src/lib/search/text.ts` — `normalizeQuery`, `fold`, `isSearchable`, `SEARCH_PARAM`,
  `searchHref`, and **`productEmbeddingSource()`**.
- `src/lib/search/lexical.ts` — weighted field matching + scoring.
- `src/lib/search/semantic.ts` — `embedQuery()` (AI SDK, cached, timed out, fail-soft).
- `src/lib/search/fuse.ts` — Reciprocal Rank Fusion.
- `src/types/search.ts` — `SearchSuggestion`, `SearchResults`, `SearchMode`, `EmbeddingIndex`.
- `src/services/search.ts` — `searchCatalog()`, `searchCollections()`, with the Supabase RPC
  written out in the migration comment.
- `scripts/embed-catalog.ts` — offline batch embedder (`tsx`).
- `src/data/embeddings.generated.json` — generated, committed.
- `supabase/sql/product-search.sql` + `supabase/README.md` — the pgvector schema, index, and
  `hybrid_search_products` function, as documentation to be turned into a real migration via
  `supabase migration new` when the database lands.

**New — surface**

- `src/app/api/search/route.ts`
- `src/components/search/SearchOverlay.tsx`, `SearchSuggestionRow.tsx`, `SearchForm.tsx`
- `src/app/[locale]/search/page.tsx`, `src/app/[locale]/search/loading.tsx`

**Edited**

- `src/components/Nav.tsx`, `src/lib/i18n/dictionaries/{en,ar}.ts`, `package.json`
  (`ai` dependency + `"embed": "tsx scripts/embed-catalog.ts"` script), `.env.example` (create).

---

## Implementation requirements

### 1. Install & verify the SDK first

```bash
npm i ai@^7.0.64
```

Then **read `node_modules/ai/docs/` (embeddings + AI Gateway sections) and, if needed,
`node_modules/ai/src/`, before writing a line of embedding code.** If the installed API differs
from what this prompt describes, the installed API wins — say so and follow it.

Environment (`.env.local`, plus a committed `.env.example` with empty values):

```
AI_GATEWAY_API_KEY=
```

Never `NEXT_PUBLIC_`. `src/lib/search/semantic.ts` is server-only.

On Vercel, the gateway can authenticate via OIDC instead of a long-lived key (`vercel env pull`
provides the token, which rotates automatically). Keep `AI_GATEWAY_API_KEY` as the local-dev
path and note the OIDC option in `supabase/README.md`'s deployment section — no code change,
the SDK picks up whichever is present.

### 2. `src/lib/search/config.ts`

```ts
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
/** Bump when EMBEDDING_MODEL, its dimensions, or productEmbeddingSource() changes. */
export const EMBEDDING_VERSION = 1;

export const SEARCH_PARAM = "q";
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 120;
/** Below this cosine similarity a vector "match" is noise, not a result. */
export const SIMILARITY_FLOOR = 0.28;
/** RRF damping — 60 is the value the literature and the Supabase guide both use. */
export const RRF_K = 60;
export const LEXICAL_WEIGHT = 1;
export const SEMANTIC_WEIGHT = 1;
export const EMBED_TIMEOUT_MS = 2_500;
export const SUGGESTION_LIMIT = 6;
export const RESULTS_LIMIT = 48;
```

Every one of these becomes a constant in the SQL function or a parameter to it. Keep the file
free of imports so both the script and the server can read it.

### 3. `src/lib/search/text.ts`

- `fold(value)` — lowercase + `.normalize("NFD").replace(/\p{Diacritic}/gu, "")`, applied to
  both sides of every comparison.
- `normalizeQuery(raw)` — trim, collapse whitespace, cap at `MAX_QUERY_LENGTH`.
- `isSearchable(q)` — `q.length >= MIN_QUERY_LENGTH`.
- `searchHref(q)` — `/search?q=<encodeURIComponent(q)>`; locale-agnostic, `<LocaleLink>` prefixes.
- **`productEmbeddingSource(product: Product): string`** — the single document builder:

  ```
  <name>. <subtitle>.
  <collectionName> collection, <kind>, <concentration | format>.
  Top notes: … Heart notes: … Base notes: …
  <badge>. <tags joined>.
  <description>
  ```

  **This function is the contract.** The offline script embeds its output; the Postgres version
  will build the identical string in a generated column / trigger. A change here without a
  re-run of the script and an `EMBEDDING_VERSION` bump makes stored vectors describe text that
  no longer exists — document that in the doc comment.

### 4. `src/lib/search/lexical.ts`

`scoreLexical(product, terms)` — AND across terms, OR across fields, `0` if any term misses:

| Field | Weight |
| :-- | :-- |
| `name` starts with term | 100 |
| `name` contains | 70 |
| `collectionName` contains | 40 |
| `subtitle` contains | 30 |
| any note array contains | 25 |
| `format` / `badge` contains | 15 |
| `description` contains | 8 |

Tie-break on `name.localeCompare()` so ordering is deterministic across renders.

### 5. `src/lib/search/semantic.ts`

- `embedQuery(query: string): Promise<number[] | null>`
  - `import { embed } from "ai"` — verify the exact signature against the bundled docs.
  - `model: EMBEDDING_MODEL`, `value: query`,
    `providerOptions: { openai: { dimensions: EMBEDDING_DIMENSIONS } }`,
    `abortSignal: AbortSignal.timeout(EMBED_TIMEOUT_MS)`.
  - Returns `null` — never throws — when `AI_GATEWAY_API_KEY` is unset, the call fails, or it
    times out. Log once per failure server-side with `console.warn`, not per keystroke.
- **In-process LRU cache**, `Map` capped at 200 entries, keyed
  `${EMBEDDING_VERSION}:${EMBEDDING_MODEL}:${foldedQuery}`. Repeat queries — which is most of
  them — cost nothing and return in microseconds.
- **In-process rate limit**, token bucket per client IP, 20 requests / 10s, applied in the route
  handler. Each miss is a paid API call; an unthrottled public endpoint is a billing incident.
  Document that this is per-instance and becomes Upstash/Vercel KV when the app scales.
- `scoreSemantic(queryVector, index)` — `cosineSimilarity` from `ai` against every catalog
  vector; drop anything under `SIMILARITY_FLOOR`; return `[productId, similarity][]` sorted
  desc. Brute force over ~25 vectors is microseconds; the doc comment states that this loop is
  exactly what the HNSW index replaces in Postgres.

### 6. `src/lib/search/fuse.ts`

```ts
export function reciprocalRankFusion(
  lists: { weight: number; ids: string[] }[],
): { id: string; score: number }[]
```

Rank-based, so a cosine similarity (0–1) and a lexical score (0–300) fuse without normalization
games. Deterministic tie-break by id. Pure and unit-testable — no imports beyond types.

### 7. `src/services/search.ts`

```ts
export type SearchMode = "hybrid" | "lexical";

export async function searchCatalog(
  query: string,
  options?: { limit?: number },
): Promise<{ products: ProductCardData[]; mode: SearchMode }>;

export async function searchCollections(query: string): Promise<Collection[]>;
```

- Normalize; return `{ products: [], mode: "lexical" }` for a non-searchable query without
  touching the embedding provider.
- Run the lexical pass and `embedQuery()` **in parallel** (`Promise.all`) — the lexical result
  is the floor, the vector call is the enhancement.
- Fuse; slice to `limit`; map through the existing `toCardList` projection path (export a
  helper from `src/services/products.ts` rather than duplicating the mapper).
- Validate the loaded index on first use: model, dimensions, and `EMBEDDING_VERSION` must match
  `config.ts`, and any vector of the wrong length is dropped. A mismatch logs a warning and
  degrades to lexical rather than producing garbage rankings.
- Carry the migration comment, written out in full:

  ```
  → const { embedding } = await embed({ model: EMBEDDING_MODEL, value: query })
    supabase.rpc('hybrid_search_products', {
      query_text: query,
      query_embedding: embedding,
      match_limit: limit,
      rrf_k: RRF_K,
      full_text_weight: LEXICAL_WEIGHT,
      semantic_weight: SEMANTIC_WEIGHT,
    })
    // the RRF above moves into SQL; this function's body becomes the rpc call
  ```

### 8. `scripts/embed-catalog.ts` (run with `npm run embed`)

- Reads `PRODUCTS` + `COLLECTIONS`, builds each document with `productEmbeddingSource()`,
  batches through `embedMany({ model, values })`.
- Writes `src/data/embeddings.generated.json`:

  ```json
  {
    "model": "openai/text-embedding-3-small",
    "dimensions": 1536,
    "version": 1,
    "generatedAt": "…",
    "items": { "<productId>": { "sourceHash": "<sha256 of the document>", "vector": [ … ] } }
  }
  ```

- Floats rounded to 6 decimals (cuts the file roughly in half; cosine ranking is unaffected).
- Fails loudly with a clear message when `AI_GATEWAY_API_KEY` is missing — this is a developer
  tool, not a runtime path.
- **`--check` mode**: re-hashes each product's document and exits non-zero listing any product
  whose text changed since it was embedded, plus any product missing a vector. This is the
  staleness guard; mention in `supabase/README.md` that it becomes a `pg_cron` re-embed job.

### 9. `supabase/sql/product-search.sql` (documentation, not yet applied)

Written now so the migration is a review, not a design exercise. Contents:

```sql
create extension if not exists vector;
create extension if not exists pg_trgm;

alter table "Product"
  add column if not exists embedding vector(1536),
  add column if not exists search_vector tsvector
    generated always as (
      setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') ||
      setweight(to_tsvector('english', array_to_string(
        "topNotes" || "heartNotes" || "baseNotes", ' ')), 'B') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'C')
    ) stored;

create index if not exists product_search_vector_idx on "Product" using gin (search_vector);
create index if not exists product_embedding_idx on "Product"
  using hnsw (embedding vector_cosine_ops);

-- Reciprocal Rank Fusion over both rankings — the SQL twin of src/lib/search/fuse.ts
create or replace function hybrid_search_products(
  query_text text,
  query_embedding vector(1536),
  match_limit int default 20,
  rrf_k int default 60,
  full_text_weight float default 1,
  semantic_weight float default 1
) returns setof "Product"
language sql stable security invoker set search_path = '' as $$ … $$;
```

Plus, in `supabase/README.md`:

- The exact command to turn this into a migration (`supabase migration new product_search`,
  paste, `supabase db advisors`, `supabase migration list --local`) — filenames are **never**
  invented.
- `security invoker` + `set search_path = ''` on the function, and **RLS enabled on `Product`
  with a read policy for `anon`/`authenticated`**, per the Supabase skill's checklist.
- Prisma has no native `vector` type → `embedding Unsupported("vector(1536)")?` in
  `schema.prisma`, and vector queries go through `$queryRaw` or the RPC above, never the
  Prisma query builder.
- The re-embed job: a trigger sets `embedding = null` whenever a document field changes;
  `pg_cron` + an Edge Function re-embeds the nulls in batches.

### 10. `src/app/api/search/route.ts`

- `export const runtime = "nodejs"; export const dynamic = "force-dynamic";`
- Rate-limit → normalize `q` → if `!isSearchable`, return an empty payload with `200` (an
  in-flight keystroke is not a client error, and it must not reach the paid provider).
- Cap: 6 products, 3 collections. Return **only** the fields the panel renders (`id`, `name`,
  `slug`, `collectionName`, `collectionKind`, `priceInCents`, `primaryImage`) — never the whole
  projection, never `sku`/`inventory`.
- `Cache-Control: no-store`. Include `mode` in the payload for observability; the UI does not
  display it.
- `try/catch` around the service; log server-side, return the empty payload with `500`.
- Zero `any`; types from `src/types/search.ts`.

### 11. `src/components/search/SearchOverlay.tsx` (client)

Props `{ open, onClose }`. Always mounted (drawer pattern) so the close transition runs;
`inert` + `aria-hidden` when closed.

```
backdrop (fixed inset-0 z-1099, bg-black/55 backdrop-blur-md, opacity 0→1, 400ms)
panel    (fixed inset-y-0 end-0 z-1100, flex flex-col, translate-x-full → 0, 500ms ease-luxury-bezier,
          w-full sm:w-[85%] lg:w-[75%] lg:max-w-[1040px],
          bg-[color-mix(in_srgb,var(--color-background)_97%,transparent)] backdrop-blur-2xl,
          border-s border-border shadow-luxury rounded-none)
 ├─ header : eyebrow "Search" · close button (X + "ESC")
 ├─ field  : Search icon · <input> · clear (X) — border-b animating border-border → border-gold on focus-within
 ├─ body   : idle | loading | results | no-results | (never an AI error)
 └─ footer : "Press Enter for all results" ⏎ + live count
```

**Field** — `font-heading text-2xl sm:text-3xl tracking-wide`, transparent, `focus:outline-none`,
`placeholder:text-ivory/25`, `dir="auto"` (a Latin query in the Arabic UI must align correctly),
`maxLength={MAX_QUERY_LENGTH}`, `autoComplete="off"`, `spellCheck={false}`,
`enterKeyHint="search"`, `type="search"` with the webkit cancel glyph suppressed in
`globals.css`.

**Behaviour**

- Focus the input on open inside `requestAnimationFrame` (focusing during the transition start
  scroll-jumps iOS); `Nav.tsx` holds a `ref` to the trigger and restores focus on close.
- **Debounce 350ms** (longer than a lexical-only panel would need: each miss is a paid
  embedding call) with an `AbortController`; abort the previous request on every keystroke and
  on close; discard any response whose query no longer matches the input.
- Reset query/results/highlight on close. Derive "closed" from a `pathname` change the way the
  drawer does, so navigating closes it without an extra render pass.
- **Enter** → highlighted row's href, else `router.push(localizePath(locale, searchHref(q)))`;
  either way record the query in recents and close.
- **↑/↓** move the highlight (wrapping) and update `aria-activedescendant`; **Escape** closes;
  **Tab** is trapped inside the panel; body scroll locked while open and released on
  close/unmount.

**States**

- *Idle* (`< 2` chars): stacked on mobile, `lg:grid-cols-[1fr_1fr_1.2fr]` —
  1. **Recent Searches** (≤ 6, `localStorage` key `khem.search.recent.v1` through
     `src/lib/storage.ts` with a `string[]` guard and the `MAX_STORED_ENTRIES` cap; "Clear"
     empties it; hidden when empty; rendered only after mount so there is no hydration
     mismatch).
  2. **Popular Searches** — 6 `{ label, term }` chips from the dictionary.
  3. **Collections** — the three fragrance collections plus Body Care / Room Fragrance as
     `LocaleLink` rows with a hairline gold rule on hover.
- *Loading*: 4 `animate-pulse` skeleton rows matching the result geometry. Never a spinner.
- *Results*: `role="listbox"` / `role="option"`. Each row: 56×72 `next/image`
  (`sizes="56px"`, `rounded-sm`, `object-cover`), name in `font-heading` with the matched
  substring wrapped in `<mark>` (`bg-transparent text-gold`) **built by slicing the string into
  React children, never via `dangerouslySetInnerHTML`**, collection + format beneath in
  `text-[11px] text-ivory/40`, price at the `end` via `formatPrice`. Collections follow under
  their own eyebrow. Rows stagger in with `transition-delay: index * 40ms` (opacity + 8px
  translate, 400ms) — no bounce, no layout shift.
  *Semantic-only rows* (present in the vector ranking but with a lexical score of 0) are still
  listed inline — no "AI" badge; the point is that it just works.
- *No results*: `font-heading` "No matches for “<query>”" (query in `dir="auto"`), one line of
  guidance, and the Popular Searches block repeated.
- *Provider failure*: **indistinguishable from a normal search** — lexical results render, no
  error copy. The dictionary still carries a generic `error` line for a total request failure.

**A11y** — dialog: `role="dialog" aria-modal="true" aria-label`; input: `role="combobox"`,
`aria-expanded`, `aria-controls="search-suggestions"`, `aria-autocomplete="list"`,
`aria-activedescendant`; a visually hidden `aria-live="polite"` result count; `aria-label` on
every icon-only button; `aria-hidden` on decorative icons; Lucide at `strokeWidth={1.25}`.

### 12. `src/components/Nav.tsx`

- `searchOpen` state plus the existing `path === pathname` derivation; opening search closes the
  drawer and any mega menu.
- Search button: `hidden sm:inline-flex` → `inline-flex` (phones currently have **no** search),
  plus `aria-expanded`, `aria-controls="search-overlay"`, `aria-haspopup="dialog"`, `onClick`,
  and a `ref` for focus restoration.
- Drawer "Boutique" section gains a Search entry that closes the drawer and opens the panel.
- Escape has exactly one owner — the overlay. Do not extend Nav's existing Escape effect to
  fight it.

### 13. `src/app/[locale]/search/page.tsx` (Server Component)

- `searchParams: Promise<{ q?: string | string[] }>`; take the first value of an array. Dynamic
  by nature; no `revalidate`.
- `generateMetadata` — build on `localeMetadata({ locale, path: "/search", … })`, interpolate
  the query into the title when present, then spread and add
  `robots: { index: false, follow: true }`.
- Body:
  - `<PageHeader eyebrow heading={query || dict.search.headingEmpty} meta={interpolate(
    dict.search.resultCount, { count })} />`, query rendered `dir="auto"`.
  - `<SearchForm defaultValue={query} />` — a real `<form method="get" action={localizePath(
    locale, "/search")}>` with `name={SEARCH_PARAM}`; the client component only adds the clear
    button. **Works with JavaScript disabled.**
  - Results grid identical to `CollectionView`: `mx-auto max-w-350 px-6 py-16 md:px-20` around
    `grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3` of
    `<ProductCard product locale sizes={CARD_SIZES} />`.
  - Zero results → `<EmptyState icon={SearchX} …>` (CTA to `/collections`) plus the popular
    chips as `LocaleLink`s to `searchHref(term)`.
  - Empty query → the same block with the "start typing" copy.

### 14. `src/app/[locale]/search/loading.tsx`

Reuse `CollectionSkeleton` under a static header bar, mirroring `collections/loading.tsx`.

### 15. Dictionaries (`en.ts` + `ar.ts`, shape-identical)

```
search: {
  meta: { title, titleWithQuery: "Search: {query}", description, ogTitle, ogDescription },
  dialogLabel, inputLabel, placeholder, close, closeHint: "ESC", clear,
  eyebrow, headingEmpty,
  recent, clearRecent, popular, collections, products,
  loading, resultCount: "{count} results", resultCountOne: "1 result",
  noResults: "No matches for “{query}”", noResultsHint,
  error, enterHint: "Press Enter for all results",
  emptyPrompt, emptyPromptBody, browseCta,
  popularTerms: [{ label, term }, … ×6],
}
```

Real Arabic copy, no transliteration. `popularTerms[].term` stays English (see decision 9);
`label` is the Arabic word shown on the chip.

### 16. Styling

Tokens only — `bg-background`, `text-ivory`, `border-border`, `text-gold`, `font-heading`,
`ease-luxury-bezier`, existing `.eyebrow` / `.btn-luxury`. No new colors, sharp edges on the
panel, durations 300–500ms, no spring physics.

---

## Security requirements

- **`q` is untrusted and now leaves the building.** It is normalized, capped at 120 chars, and
  sent to a third-party embedding provider. Document that in `semantic.ts`. The cap is the
  first line of defence against someone using the endpoint as a free embedding API.
- **Rate limit the route handler** (20 req / 10s / IP). Every cache miss is a billed call; an
  open endpoint is a billing incident, not just an abuse vector.
- `AI_GATEWAY_API_KEY` is server-only — never `NEXT_PUBLIC_`, never imported into a client
  component. `src/lib/search/semantic.ts` and `src/services/search.ts` are server modules; when
  `server-only` is added to the project they get the import.
- The `<mark>` highlight slices the original string into React children; no HTML injection path.
- The route returns a fixed projection — no internal fields leak.
- `Cache-Control: no-store` so no shared cache retains visitor query strings.
- Recent searches are read back through `readStored()` with a type guard and an entry cap —
  `localStorage` is attacker-writable, same threat model as the cart.
- No user input reaches `router.push` as a path: only `searchHref()` (which
  `encodeURIComponent`s) and `productHref()` (built from catalog slugs).
- `noindex` on `/search` keeps crafted query URLs out of the index as KHEM content.
- **Supabase, for when the SQL lands:** RLS enabled on `Product` with an explicit read policy;
  `hybrid_search_products` declared `security invoker` with `set search_path = ''`; embeddings
  written only by the service-role key from a server context; `supabase db advisors` run before
  the migration is committed.

---

## Acceptance criteria

1. Clicking the Nav search icon at any breakpoint slides a panel in from the right over a
   blurred, dimmed page; the page behind does not scroll.
2. Width: 100% < 640px, 85% to 1023px, 75% capped at 1040px from 1024px up.
3. Under `/ar` the panel enters from the **left**, all spacing mirrors, no transform points the
   wrong way.
4. ≥ 2 characters → skeletons, then ≤ 6 products and ≤ 3 collections, matched substring in gold.
5. **A conceptual query with no lexical overlap returns sensible products.** `smoky winter
   night` surfaces Noir; `something fresh for summer` surfaces the citrus/aquatic side of the
   catalog. `npm run embed -- --check` exits 0.
6. **Removing `AI_GATEWAY_API_KEY` (or deleting the embeddings file) leaves search fully
   working** on the lexical path, with no user-visible error and one server-side warning.
7. An exact product name ranks that product first — semantic recall never outranks exact intent.
8. Enter with no highlight → `/search?q=…` (`/ar/search?q=…` in Arabic), panel closes; Enter on
   a highlighted row → that product/collection.
9. ↑/↓ move the highlight and update `aria-activedescendant`; Escape closes and returns focus to
   the search icon; Tab never escapes the panel.
10. `/search?q=oud` renders a relevance-ordered grid with a correct count; `/search?q=zzzz`
    renders the empty state; `/search` renders the prompt state; the field submits with
    JavaScript disabled.
11. `<meta name="robots" content="noindex, follow">` on `/search`.
12. The same query typed twice issues **one** embedding call (LRU cache), and 25 rapid requests
    from one IP get throttled.
13. `embeddings.generated.json` is **not** present in any client bundle
    (`npx next build` → no search vectors in `.next/static`).
14. Zero TypeScript errors, zero ESLint errors, zero `any`, no hydration warnings, no layout
    shift when suggestions replace skeletons, `ai` the only new dependency.

---

## Checks to run

```bash
npm run embed -- --check     # embeddings match the current catalog text
npx tsc --noEmit
npm run lint
npm run build
```

---

## Manual test steps

1. Put `AI_GATEWAY_API_KEY=…` in `.env.local`, then `npm run embed` (one-off, commits the JSON).
2. `npm run dev` → `http://localhost:3000`.
3. Click the search icon: confirm the slide-in from the right, blurred backdrop, auto-focused
   field, locked page scroll.
4. Type `ou` → skeletons, then suggestions with `Oud` highlighted in gold.
5. Type `smoky winter night` → Noir products appear despite none of those words being in the
   data. This is the semantic pass; confirm the server log shows one embedding call.
6. Retype the same query → no second embedding call (cache hit).
7. Type the exact name of a fragrance → it is the first row.
8. ↓ ↓ then Enter → lands on the second suggestion's page.
9. Reopen, type `amber`, Enter with no highlight → `/search?q=amber` with a populated grid and a
   matching count.
10. Reopen: `amber` and `smoky winter night` appear under Recent Searches; "Clear" empties the
    block and it disappears.
11. Type `qqqq` → no-results copy plus popular chips; click a chip → results for that term.
12. Escape → panel closes, focus ring back on the search icon.
13. Resize to 1440 / 800 / 375px and repeat step 3 at each.
14. Switch to Arabic: panel enters from the left, copy is Arabic, chips work, Enter →
    `/ar/search?q=…`.
15. **Comment out `AI_GATEWAY_API_KEY`, restart, repeat steps 4 and 9** — results still appear
    (lexical), no error is shown to the visitor, one warning in the server log.
16. Disable JavaScript, load `/search`, type and submit → the page reloads with the query applied.
17. View source on `/search?q=oud` → `noindex` present; console clean, no hydration warnings.
18. VoiceOver keyboard pass: the dialog is announced, the combobox reports the option count, the
    live region announces "N results".
