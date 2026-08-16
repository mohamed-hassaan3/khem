# Supabase data migration — move every hardcoded record into Postgres

## Goal

Make Supabase Postgres the single source of truth for all KHEM content that is
today hardcoded in `src/data/`: the catalog (collections, products, images),
editorial content (testimonials, ingredients, journal, heritage, craftsmanship,
about), the four legal documents, the stockist directory, and the contact
details. Wire the integration end to end — clients, schema, RLS, seed tooling,
service repointing, search vectors — so that after this task `src/data/` no
longer holds any record the UI renders, and no component or page has changed.

Non-goals: orders, addresses, users, carts, payments. `src/services/account.ts`
keeps returning empty arrays; AGENTS.md §9's `Order`/`User`/`Address` tables are
out of scope and are not created.

## Skills read

- `.agents/skills/supabase` — schema, migrations, service-role usage, RLS,
  pgvector. Read before writing SQL.
- `node_modules/next/dist/docs/` — server/client boundaries, ISR revalidation
  behaviour for the pages that will now read from Postgres.
- `.agents/skills/ai-sdk` — only for phase 5 (embedding the catalog through the
  AI Gateway with `text-embedding-3-small`).
- `.agents/skills/clerk` — not modified; the comment write path already stamps
  identity from the Clerk session and that stays as it is.

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `src/lib/supabase.ts` | `getSupabaseAdmin()` on `SUPABASE_SECRET_KEY`, returns `null` when unconfigured rather than throwing |
| `src/services/products.ts` | Every function carries the exact Supabase query it becomes — the migration checklist |
| `src/services/content.ts`, `legal.ts`, `stockists.ts`, `contact.ts` | Same contract, same `→ supabase.from(...)` comments naming the target tables |
| `src/services/comments.ts`, `src/actions/comments.ts` | The one path already talking to Postgres; the pattern the rest should match |
| `src/types/catalog.ts`, `content.ts`, `legal.ts`, `stockist.ts`, `contact.ts` | The row shapes, field for field |
| `src/data/products.ts` (1313 ln), `content.ts` (587), `legal.ts` (646), `stockists.ts` (86), `contact.ts` (93) | The records to transfer |
| `supabase/sql/product-search.sql` | Reviewed pgvector + full-text design against `"Product"`, incl. `hybrid_search_products()` RRF and RLS |
| `supabase/sql/product-comments.sql` | Reviewed `product_comment` design; its FK to `Product(slug)` is explicitly deferred to this task |
| `src/services/search.ts`, `src/lib/search/*` | Lexical + brute-force vector fusion over `src/data/embeddings.generated.json` |
| `src/providers/cart-provider.tsx`, `wishlist-provider.tsx` | Persist **product ids** in `localStorage` |
| `src/schemas/contact.ts`, `src/lib/email/addresses.ts`, `src/lib/email/layout.ts` | The only three module-scope (non-async) consumers of `src/data/` |

Verified environment facts (checked, not assumed):

- The Supabase project `ttekisapxjforpawnnla` has **zero tables in `public`**;
  extensions present: `pgcrypto`, `uuid-ossp`, `pg_stat_statements`,
  `supabase_vault`, `plpgsql`. `vector` and `pg_trgm` are **not** installed yet.
- The REST API accepts `SUPABASE_SECRET_KEY` (verified with a 404 on the not-yet
  existing `product_comment`, i.e. auth passed).
- `DIRECT_CONNECTION_STRING` points at `db.<ref>.supabase.co:5432`, which
  resolves **AAAA only** and is unreachable from this machine.
- The **session pooler** works: `aws-0-ap-northeast-1.pooler.supabase.com:5432`,
  user `postgres.ttekisapxjforpawnnla`, password `SUPBASE_DATABASE_PASSWORD`,
  TLS on. Project region is therefore `ap-northeast-1`.
- Neither `psql` nor the Supabase CLI is installed; there is no Prisma
  dependency in `package.json` (only `prisma/AGENTS.md`).
- `.gitignore` covers `.env*`.

## Decisions and assumptions

1. **DDL is applied over the session pooler with `pg`**, from a script in
   `scripts/`, not by the Supabase CLI. Reason: no CLI, no Docker, and the
   direct host is IPv6-only here. The SQL files stay plain and portable, so
   moving to `supabase migration new` later is a copy.
2. **Primary keys are `text`, holding the ids the seed data already uses**
   (`"signature"`, `"oud"`, `"cairo-flagship"`), not `uuid`. Reason: the cart
   and wishlist persist product ids in `localStorage`, so switching to generated
   uuids would silently empty every returning visitor's bag. The ids are already
   stable, unique, and opaque to the app. This is a deliberate deviation from
   AGENTS.md §9's `@default(uuid())` and is recorded in the SQL header. Tables
   created later for `Order`/`User` may still use uuid.
3. **`Product.collectionSlug` is a real FK to `Collection(slug)`**, matching both
   the TypeScript field and the `.eq('collectionSlug', …)` in the service
   comments — rather than renaming to `collectionId` and rewriting every query.
4. **Table naming follows the service doc comments verbatim**: PascalCase quoted
   identifiers (`"Product"`, `"Collection"`, `"Testimonial"`, `"Ingredient"`,
   `"Article"`, `"Stockist"`, `"LegalDocument"`, `"ContactChannel"`, …) because
   `supabase/sql/product-search.sql` already alters `"Product"` and every
   migration comment in `src/services/` names them that way. `product_comment`
   keeps its snake_case name — it already exists as a reviewed design and
   renaming it would break `src/services/comments.ts` for no gain.
5. **Reads use the publishable key, writes use the secret key.** A new
   `getSupabasePublic()` (publishable key, still server-side only) serves every
   read path, so RLS is actually exercised: a policy mistake fails loudly
   instead of leaking archived or unpublished rows through a key that bypasses
   RLS. `getSupabaseAdmin()` stays for the comment write path and the seed
   script only.
6. **Rows are parsed with Zod, never trusted.** No generated `Database` types
   exist, so each service parses its rows the way `toComment()` already does.
   Row schemas live in `src/schemas/db/`.
7. **Degradation matches the existing bargain.** A query failure logs the
   provider message and returns `[]` / `null`; a page renders its empty state
   rather than 500ing. Detail routes still `notFound()` on a genuine miss.
8. **`src/data/` seed modules are deleted** once seeded and verified —
   `products.ts`, `content.ts`, `legal.ts`, `stockists.ts`,
   `embeddings.generated.json`. What survives moves to `src/constants/contact.ts`:
   `HOUSE_EMAIL` and the canonical `ENQUIRY_SUBJECTS` list, because a Zod schema
   and an email `From:` address are module-scope code, not content. The database
   is seeded *from* those constants, and `npm run db:verify` fails if they drift.
9. **Localization is unchanged.** The catalog and editorial copy are stored in
   English, exactly as today; Arabic lives in `src/lib/i18n/dictionaries/ar.ts`.
   No `locale` column is introduced.
10. **Pooler URL is a new env var.** `SUPABASE_DB_URL` is added to `.env.local`
    (session pooler, IPv4) and the migrate/seed scripts prefer it, falling back
    to `DIRECT_CONNECTION_STRING`. Server-only, never `NEXT_PUBLIC_`.

## Files likely to change

**New**

```
supabase/sql/0001_catalog.sql            Collection, Product, ProductImage, enums, RLS
supabase/sql/0002_content.sql            Testimonial, Ingredient(+Usage, Family), Article,
                                         TimelineEvent, BrandValue, MissionStatement,
                                         CraftPillar, CraftStep, CraftStat, CraftQuote
supabase/sql/0003_directory.sql          Stockist, ContactChannel, SocialProfile,
                                         EnquirySubject, BoutiqueSetting, LegalDocument
supabase/sql/0004_search.sql             ← existing product-search.sql, applied
supabase/sql/0005_comments.sql           ← existing product-comments.sql + FK to Product(slug)
scripts/db.ts                            shared pg connection helper (pooler, TLS, no logging of values)
scripts/db-migrate.ts                    applies sql/*.sql in order, idempotently, in a transaction
scripts/db-seed.ts                       upserts every record from src/data + constants
scripts/db-verify.ts                     row counts, parity checks, RLS smoke test
src/constants/contact.ts                 HOUSE_EMAIL, ENQUIRY_SUBJECTS
src/schemas/db/*.ts                      Zod row schemas per table
```

**Modified**

```
src/lib/supabase.ts                      + getSupabasePublic(), + import "server-only"
src/services/products.ts                 bodies → real queries
src/services/content.ts                  bodies → real queries
src/services/legal.ts                    bodies → real queries
src/services/stockists.ts                bodies → real queries
src/services/contact.ts                  bodies → real queries
src/services/search.ts                   → hybrid_search_products RPC
src/lib/search/semantic.ts               keeps embedQuery(), drops rankSemantic()
src/schemas/contact.ts                   imports ENQUIRY_SUBJECTS from constants
src/lib/email/addresses.ts               imports HOUSE_EMAIL from constants
src/lib/email/layout.ts                  social profiles passed in from the async send path
scripts/embed-catalog.ts                 writes Product.embedding instead of a JSON file
package.json                             + pg, server-only; db:migrate / db:seed / db:verify scripts
.env.local                               + SUPABASE_DB_URL (session pooler)
supabase/README.md                       rewritten to describe what is now applied
```

**Deleted**

```
src/data/products.ts  src/data/content.ts  src/data/legal.ts  src/data/stockists.ts
src/data/contact.ts (content moves to DB; two constants move to src/constants/contact.ts)
src/data/embeddings.generated.json
```

## Implementation requirements

### Phase 1 — configuration

- `npm i pg` (dev) `@types/pg` (dev), `npm i server-only`.
- `src/lib/supabase.ts`: add `import "server-only"` at the top (the file's own
  header asks for it), keep `getSupabaseAdmin()` unchanged in behaviour, add
  `getSupabasePublic()` built on `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with the
  same `persistSession: false` posture and the same memoisation. Both return
  `null` when unconfigured.
- Add `import "server-only"` to all six service modules — every one of them
  carries a NOTE asking for exactly this.
- Add `SUPABASE_DB_URL` to `.env.local` (session pooler form, `sslmode=require`).
  Do not print it, do not commit it, do not add it to any committed example file
  with a real password.

### Phase 2 — schema

Every SQL file is idempotent (`create table if not exists`, `create or replace`,
`drop policy if exists` before `create policy`) so re-running the migrator is
safe. Every file opens with a header stating that it is applied by
`npm run db:migrate` and that the ids are slugs (decision 2).

Enums: `Concentration`, `CollectionKind`, `ProductTag`, `StockistRegion`,
`StockistType`, `StockistStatus` — members exactly as the TypeScript unions.

Columns mirror `src/types/*.ts` field for field, in the same casing (quoted
camelCase, as `product-search.sql` already assumes: `"topNotes"`, `"isArchived"`,
`"priceInCents"`). Arrays are `text[]`, never joined strings. `Product` also
carries the AGENTS.md §9 server columns the types omit: `isArchived boolean not
null default false`, `deletedAt timestamptz`, `createdAt`, `updatedAt`. Legal
`sections` is `jsonb` (the block union is already a closed discriminated union;
it is validated by Zod on read). Ingredient `usedIn` becomes a child table
`"IngredientUsage"(ingredientId, productSlug, name)` so the documented
`.eq('usedIn.slug', …)` join works.

`"BoutiqueSetting"` is a singleton row (`id text primary key default 'default'`
with a `check (id = 'default')`) holding `conciergeEmail`, `wholesaleEmail`,
`houseEmail`.

Ordering columns (`sortOrder int not null`) exist wherever a service documents
`.order('sortOrder')`; the seed assigns them from array position so display
order survives the move exactly.

**RLS on every single table, no exceptions.** For each: `enable row level
security`, one `select` policy `to anon, authenticated` carrying the published
predicate the service documents (`isArchived = false and deletedAt is null` for
`Product`, `isPublished` for `Testimonial`/`CraftQuote`/`Stockist`, plain `true`
for reference tables), and `grant select` — and nothing else — to `anon,
authenticated`. No insert/update/delete policy or grant is created for the
public roles anywhere; every write in this repo goes through the service role.

Apply `product-search.sql` as `0004` unchanged apart from the header, then
`product-comments.sql` as `0005` with the deferred FK now real:
`product_slug text not null references public."Product"(slug) on delete cascade`
— the file's own comment says to do this once the catalog lands in Postgres.

### Phase 3 — seeding

`scripts/db-seed.ts` imports the `src/data/*` modules directly (they still exist
at this point) and upserts every record inside **one transaction**:
`insert … on conflict (id) do update set …`, so re-running converges rather than
duplicating. Order: `Collection` → `Product` → `ProductImage`, then the
independent content tables, then `Stockist`/contact/legal.

- All values go through parameterised placeholders. No string interpolation of
  data into SQL, anywhere, ever — this script handles editorial copy full of
  apostrophes and it must be injection-proof by construction, not by escaping.
- The script prints counts per table and nothing else. No row contents, no
  connection string, no password.
- It refuses to run without `SUPABASE_DB_URL` or `DIRECT_CONNECTION_STRING` and
  exits non-zero with a clear message.

`scripts/db-verify.ts` then asserts, and exits non-zero on any failure:

- Row count per table equals the source array length.
- Every `Product.collectionSlug` resolves; every product has exactly one
  `isPrimary` image; every `IngredientUsage.productSlug` resolves to a product.
- `ENQUIRY_SUBJECTS` in `src/constants/contact.ts` equals `"EnquirySubject"`.
- **RLS smoke test:** a client built on the *publishable* key can `select` a
  published product and gets **zero rows** for an archived one, and gets a
  permission error on `insert` into `"Product"` and `product_comment`.

### Phase 4 — repointing the services

Replace the body of every function in the six service modules with the query its
doc comment already specifies. Rules:

- The comment stays, updated from "→ becomes" to what it now is.
- Explicit column lists, never `select('*')`, matching the projection the type
  demands (`ProductCardData` is deliberately narrow — honour it).
- Parse with the Zod row schema; drop a malformed row rather than the whole
  list, log `error.message` only.
- Return `[]` / `null` on failure. `getProductBySlug()` returning `null` on a
  real miss is what lets the route `notFound()`; that behaviour is unchanged.
- Keep every existing filter semantic exactly: fragrance-only scoping on
  `getProductSlugs`, `getNewArrivals`, `getFeaturedProducts`,
  `getProductBySlug`, `getRelatedProductCards`; the deliberate all-kinds
  behaviour of `getProductCardsByCollection()` with no argument; the
  own-collection-first-then-top-up ordering of `getRelatedProductCards()`.
- `getIngredientFamilies()` and `getStockistRegions()` keep returning the
  taxonomy order with the `ALL_FILTER` prefix / present-only filtering.

Then move `HOUSE_EMAIL` and `ENQUIRY_SUBJECTS` to `src/constants/contact.ts`,
repoint `src/schemas/contact.ts` and `src/lib/email/addresses.ts`, change
`src/lib/email/layout.ts` to receive social profiles as a parameter from its
(already async) send path, and delete the `src/data/` modules listed above.

### Phase 5 — search

- `scripts/embed-catalog.ts` selects products whose `embedding is null`, embeds
  `search_document` through the AI Gateway with the model in
  `src/lib/search/config.ts`, and writes vectors back with the service role, in
  batches. `--check` keeps its meaning: report drift, write nothing.
- `searchCatalog()` calls `hybrid_search_products(query_text, query_embedding,
  match_limit, rrf_k, full_text_weight, semantic_weight, similarity_floor)` with
  the weights from `config.ts`, and maps rows through the same card projection.
- `rankSemantic()` and the JSON index loader go; `embedQuery()`, `fold()`,
  `normalizeQuery()`, `MIN/MAX_QUERY_LENGTH` and the query-length cap stay — the
  cap is what stops the endpoint being used as a free embedding API.
- If the gateway or the RPC fails, search degrades to the lexical path over the
  card list rather than erroring.

## Security requirements

1. `SUPABASE_SECRET_KEY` never appears in a `NEXT_PUBLIC_` variable, a Client
   Component, a committed file, or a log line. `import "server-only"` guards
   `src/lib/supabase.ts` and every service.
2. RLS is enabled on **every** table created, with select-only grants to `anon`
   and `authenticated` and no write policy for either role.
3. Read paths use the publishable key so RLS is genuinely exercised in
   production; the service role is confined to the seed/embed scripts and the
   comment write action.
4. Unpublished, archived, and soft-deleted rows are excluded by the **policy**,
   not only by the query — a forgotten `.eq('isArchived', false)` must not be
   able to leak a row.
5. All SQL is parameterised. No user input and no seed value is ever
   concatenated into a statement.
6. Logs carry provider error messages only — never row contents, author names,
   comment bodies, emails, or connection strings.
7. Functions keep `security invoker` and `set search_path = ''`, as
   `product-search.sql` already specifies.
8. `.env.local` stays gitignored; the new `SUPABASE_DB_URL` is added there only.
   No credential is written into `supabase/README.md` or any script default.
9. The seed script is idempotent and additive; it never issues `drop table`,
   `truncate`, or `delete` against a table it did not just create.

## Acceptance criteria

- `src/data/` contains no record the UI renders; the app reads everything from
  Postgres.
- No file under `src/app/` or `src/components/` is modified. (The service seam
  is the whole point; a component diff means the seam leaked.)
- `npx tsc --noEmit` and `npm run lint` are clean; `npm run build` succeeds and
  prerenders the same routes as before.
- `npm run db:verify` passes, including the RLS smoke test.
- Every page renders identical content to the pre-migration site: home,
  `/collections` and each collection, `/perfume/[slug]`, `/new-arrival`,
  `/body-care`, `/room-fragrance`, `/discovery`, `/gift-set`, `/ingredients`,
  `/journal`, `/heritage`, `/craftsmanship`, `/about`, `/contact`,
  `/stockists`, the four legal routes, `/search`, `/cart`, `/wishlist`.
- Both locales still render; Arabic copy is unaffected.
- A cart or wishlist saved before the migration still resolves afterwards
  (product ids unchanged).
- Comments still post and list on a PDP, now with a real FK to the product.
- Search returns sensible results for an exact name ("Onyx Night") and for an
  intent query ("smoky, for a winter night").
- With `SUPABASE_*` unset, the app still builds and renders empty states rather
  than throwing.

## Checks to run

```bash
npm run db:migrate          # idempotent — run twice, second run is a no-op
npm run db:seed
npm run db:verify
npm run embed               # needs AI_GATEWAY_API_KEY
npm run embed -- --check
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`, open `/` — hero, bestsellers grid, featured fragrance,
   testimonials, journal rail all populated.
2. `/collections` — every facet chip (new arrivals, best sellers, limited) still
   filters; body care, home, discovery and gift cards all present.
3. `/collections/signature`, `/collections/noir`, `/collections/gemstone` —
   correct products; `/collections/body-care` still 404s.
4. `/perfume/onyx-night` — note pyramid, story, key ingredients, related rail,
   comments. Post a comment, confirm it appears after revalidation.
5. `/perfume/amber-room-spray` — still 404.
6. `/body-care`, `/room-fragrance`, `/discovery`, `/gift-set` — cards show
   description, format line, set contents and badge.
7. `/ingredients` — seven family chips in taxonomy order; filtering works;
   detail panel shows facts and "used in" links that resolve.
8. `/journal` — featured article first, categories derived from the records.
9. `/heritage`, `/craftsmanship`, `/about` — timeline, values, six steps, stats,
   perfumer quote, mission statements.
10. `/stockists` — region bar shows only populated regions; the coming-soon
    location renders as an announcement with no contact details; the "locations
    worldwide" count excludes it.
11. `/contact` — channels, socials, subject `<select>`; submit an enquiry and
    confirm both the internal mail and the acknowledgement send.
12. The four legal routes — sections, tables, notes, cross-reference links.
13. `/search?q=Onyx Night` and `/search?q=smoky for a winter night`; then the
    header search overlay.
14. Add to cart and to wishlist, reload, confirm both survive.
15. Switch to `/ar/...` on three of the above and confirm the Arabic chrome with
    English catalog copy, as before.
16. In the Supabase dashboard: with the **publishable** key, `select` from
    `"Product"` succeeds and `insert` is rejected.
