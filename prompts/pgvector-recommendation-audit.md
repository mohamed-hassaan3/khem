# pgvector & Recommendations — Audit Report

Source brief: `src/docs/Product-Landing-Page-Navigation-Inventory-Updates.md` §7,
deferred from the four workstreams as a separate verification task.

Performed against production `ttekisapxjforpawnnla`. Read-only, apart from one
attempt to run the documented `npm run embed`, which failed for the reason below.

---

## Headline

**The infrastructure is complete and correct. There are no vectors in it.**

`0/28` products and `0/6` articles carry an embedding, and they cannot be
generated: the Vercel AI Gateway refuses every request with

> AI Gateway requires a valid credit card on file to service requests.

So every vector-ranked feature has been running on its **fallback** since the
day it was built. Nothing looks broken, because the fallbacks were written to
degrade rather than fail — which is precisely why this went unnoticed and why
the brief was right to say "do not assume it is working simply because the
extension is installed".

## What was checked

| Item | Result |
| :-- | :-- |
| Extension | `vector` **0.8.2**, installed |
| Vector columns | `Product.embedding`, `Article.embedding` |
| Indexes | `product_embedding_idx`, `article_embedding_idx` — both **HNSW, `vector_cosine_ops`** |
| Functions | `related_products(text, int, CollectionKind[])`, `hybrid_search_products(...)`, `related_articles(text, int)` |
| Embedding coverage | **0 / 28 products, 0 / 6 articles** |
| Staleness guard | trigger nulls `embedding` when `search_document` changes — present |
| `npm run embed -- --check` | reports 34 rows waiting, exits non-zero (the CI guard works) |
| `npm run embed` | **fails — gateway requires a credit card** |

The model is `openai/text-embedding-3-small`, 1536 dimensions, version `v1`.
`search_document` is a generated column, so the string that gets embedded is
composed by Postgres and the full-text and semantic halves describe the same
document.

## What the fallbacks actually do

Verified directly against the live functions with no vectors present:

| Product | Results | Self excluded | Deterministic |
| :-- | --: | :-- | :-- |
| `onyx-night` | 4 | yes | yes |
| `lapis` | 4 | yes | yes |
| `amber-body-mist` | 4 | yes | yes |

`hybrid_search_products('oud', null, …)` returns `onyx-night, sapphire` — the
lexical half working alone. `/api/search?q=oud` returns those same products, and
`/search?q=oud` renders them: the gateway error is logged and the request
succeeds. The soft-fail contract in `src/lib/search/semantic.ts` holds.

Ten `related_products()` round trips took ~2.2 s from this machine, which is
mostly latency to `ap-northeast-1` rather than query cost.

**So the brief's five requirements are already met** — relevant products, current
product excluded, availability respected, best results returned, up to four
shown. What is *not* happening is the ranking being **by scent**: today the
order is the collection preference plus the catalogue top-up, which is the
documented fallback, not cosine distance.

## What this costs you

Nothing is broken. What is missing is the quality the vectors buy:

- **Related products** rank by shelf, not by smell. A resinous Signature
  fragrance cannot surface beside a resinous Noir one, which is the entire
  argument for `related_products()` existing.
- **Search** is lexical only. "something smoky for a winter night" — the example
  in the search page's own placeholder — cannot work without embeddings.
- **Related articles** fall back to editorial ordering.

## To fix

1. Add a payment method to the Vercel AI Gateway account (the error links
   straight to it). Free credits unlock on the card, so 34 embeddings of
   `text-embedding-3-small` cost a fraction of a cent.
2. `npm run embed`
3. `npm run embed -- --check` must then exit zero.
4. Re-check a PDP rail: with vectors present the neighbours should change, and
   should cross collections.

## Recommendation

Put `npm run embed -- --check` in CI. It already exits non-zero when rows are
waiting, and it is the only thing that would have caught this — the site gives
no other signal, by design.
