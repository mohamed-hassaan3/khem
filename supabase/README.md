# Supabase — search schema

This directory holds the **designed but not yet applied** database side of KHEM
search. Nothing here runs today: the catalog still lives in `src/data/`, and
`src/services/` is the seam that will swap underneath the UI.

## What is here

- **`sql/product-search.sql`** — pgvector + full-text schema, the HNSW index, the
  `hybrid_search_products()` RRF function, RLS policies, and the embedding
  invalidation trigger. Reviewed and ready; not a migration file.

## Turning it into a migration

Migration filenames are **generated, never hand-written** — an invented name
breaks `supabase db diff` and the migration history.

```bash
supabase migration new product_search      # creates the timestamped file
# paste the contents of sql/product-search.sql into it
supabase db reset --local                  # apply from scratch, locally
supabase db advisors                       # security + performance lint (CLI ≥ 2.81.3)
supabase migration list --local            # verify
```

Fix everything the advisors report before committing. Pay particular attention
to anything about `security definer`, exposed schemas without RLS, or missing
indexes on foreign keys.

## What changes in the application

Exactly two files, by design:

| File | Change |
| :--- | :--- |
| `src/services/search.ts` | `searchCatalog()`'s body becomes the `hybrid_search_products` RPC call already written in its doc comment. The lexical/semantic/fusion imports go away — Postgres does all three. |
| `src/services/products.ts` | The other queries become the `supabase.from(...)` calls already written above each function. |

`src/lib/search/semantic.ts` keeps `embedQuery()` — the query still has to be
embedded somewhere — and loses `rankSemantic()`, whose brute-force loop the HNSW
index replaces. No component and no page changes.

## Prisma

Prisma has no native `vector` type. Declare the column as unsupported so
`prisma migrate` leaves it alone:

```prisma
model Product {
  // …
  embedding Unsupported("vector(1536)")?
}
```

Vector queries then go through `$queryRaw` or — preferably — the RPC above.
Never through the Prisma query builder, which cannot express `<=>`.

## Embedding the catalog

Today `npm run embed` writes `src/data/embeddings.generated.json`, committed to
the repository so builds need no credentials. In Postgres that becomes a
background job:

1. The trigger in `sql/product-search.sql` nulls `embedding` whenever a
   product's `search_document` changes.
2. A `pg_cron` schedule invokes an Edge Function every few minutes.
3. The function selects rows `where embedding is null limit 50`, embeds them
   with the same model, and writes them back with the service-role key.

The model, dimensions, and document text **must** stay in step with
`src/lib/search/config.ts` and `productEmbeddingSource()`. A vector is only
comparable to a query vector produced by the same model from the same kind of
document; when they drift, the search does not error, it just quietly returns
the wrong things. `EMBEDDING_VERSION` exists to make that drift loud.

## Credentials

- **Local:** `AI_GATEWAY_API_KEY` in `.env.local` (see `.env.example`).
- **Deployed:** prefer OIDC — Vercel injects a token that rotates on its own, and
  the AI SDK picks up whichever credential is present. `vercel env pull` brings
  the same token to a local checkout.
- The Supabase **service-role key is server-only** and never reaches a
  `NEXT_PUBLIC_` variable. The embedding writer is the only thing that needs it.
