# Supabase — the database behind KHEM

Everything the site renders lives here: the catalog, the editorial content, the
legal documents, the stockist directory, the contact details, and the product
comments. `src/data/` no longer exists — `src/services/` queries Postgres, and
no component or page knows the difference.

## Layout

```
sql/     schema, applied in filename order by `npm run db:migrate`
seed/    a generated export of the database — written by `npm run db:dump`,
         loaded back by `npm run db:seed`
```

| File | What it creates |
| :--- | :--- |
| `sql/0001_catalog.sql` | `Collection`, `Product`, `ProductImage`, the three catalog enums, RLS |
| `sql/0002_content.sql` | `Testimonial`, `Ingredient` (+ `IngredientFamily`, `IngredientUsage`), `Article`, `TimelineEvent`, `BrandValue`, `MissionStatement`, `CraftPillar`, `CraftStep`, `CraftStat`, `CraftQuote` |
| `sql/0003_directory.sql` | `Stockist`, `ContactChannel`, `SocialProfile`, `EnquirySubject`, `BoutiqueSetting`, `LegalDocument` |
| `sql/0004_search.sql` | pgvector + full-text columns, HNSW index, `hybrid_search_products()`, `related_products()`, the embedding-invalidation trigger |
| `sql/0005_comments.sql` | `product_comment`, with a real foreign key onto `Product(slug)` |
| `sql/0006_privileges.sql` | revokes the write grants Supabase hands `anon`/`authenticated` by default |
| `sql/0015_orders.sql` | `Order`, `OrderItem`, the three order enums, `place_order()` / `restock_order()` / `set_order_status()`, and the sales reports — readable with the **secret key only** |

## Commands

```bash
npm run db:migrate    # apply sql/*.sql — idempotent, safe to re-run
npm run db:seed       # load seed/*.json — upserts, never deletes
npm run db:dump       # write seed/*.json back out of the database
npm run db:verify     # counts, integrity, and the security assertions
npm run embed         # fill Product.embedding through the AI Gateway
npm run embed -- --check   # non-zero exit if any product lacks a vector
```

A fresh project is `db:migrate`, `db:seed`, `embed`, in that order.

## Where content is edited

**In Supabase — never in `seed/`.** The table editor and the admin dashboard
are the only places content changes. The JSON under `seed/` is a
*generated export*, kept in git so a fresh project (a preview branch, a restored
backup, a new environment) can be rebuilt from the repository rather than by
hand. It is not a second, editable copy of the catalog.

That makes the loop:

```bash
# 1. edit in the Supabase table editor or /admin
npm run db:dump              # 2. pull the change into seed/*.json
git diff supabase/seed/       # 3. read it — this is your changelog
git commit                    # 4. keep it
```

`db:dump` is read-only, so it is safe against production, and it refuses to
write an empty catalog — pointing it at the wrong project fails loudly instead
of replacing the export with `[]`. Dumping an unedited database produces no
diff at all, so any diff is a real change.

The direction that has teeth is the other one: `db:seed` writes the file *into*
the database. Run it after a dump, not before, or you will push a stale export
over live edits. It only ever upserts — a row deleted in Supabase is not deleted
by seeding — so deletions stay deliberate.

`db:dump` covers all three files — the catalog, the editorial content, and the
directory — including every `_ar` translation and every `isPublished` flag. An
article unpublished in the dashboard stays unpublished through a seed; a
translation written on the platform survives one. Nothing here is edited in the
repository any more.

The only field the database does not own is *which* enquiry subjects exist:
`src/schemas/contact.ts` validates a submitted subject against the
`ENQUIRY_SUBJECTS` constant, so a subject added in Supabase would be rejected by
the form it appeared on. Add one in the constant. Its Arabic label is ordinary
content and round-trips like everything else.

### Connecting

The scripts read `SUPABASE_DB_URL` from `.env.local` — the **session pooler**
(`aws-0-<region>.pooler.supabase.com:5432`, user `postgres.<ref>`), not
`db.<ref>.supabase.co`. The direct host publishes an AAAA record and no A
record, so on a network without IPv6 it does not resolve at all. Session mode
(port 5432, not 6543) because these scripts issue DDL and hold transactions.

Nothing under `src/` uses that URL. The application talks to the Data API,
where row level security applies.

## Security model

Three things hold, and `npm run db:verify` asserts all three:

1. **RLS is enabled on every table**, with a `select` policy carrying the
   published predicate — `isArchived = false and deletedAt is null` for
   products, `isPublished` for stockists, testimonials, articles and comments.
   The policy is the access control, not a second copy of the query's `where`.
2. **The public roles hold `select` and nothing else.** No insert, update or
   delete policy exists for `anon` or `authenticated` anywhere, and
   `0006_privileges.sql` takes back the DML grants a stock Supabase project
   attaches to every new table in `public`.
3. **Reads use the publishable key, writes use the secret key.** Every
   `src/services/*` read goes through `getSupabasePublic()`, so a policy mistake
   fails loudly instead of being masked by a key that bypasses RLS.
   `getSupabaseAdmin()` — `SUPABASE_SECRET_KEY`, which *does* bypass RLS — is
   reached only by `src/actions/comments.ts` and the `scripts/db-*` tooling, and
   `src/lib/supabase.ts` is guarded by `server-only` so neither key can reach a
   client bundle.

Identity is Clerk's, not Supabase Auth's, so `auth.uid()` is always null and no
policy can express "this row is mine". That is why comment authorship is stamped
server-side from the session rather than enforced in SQL.

## Search and related products

Both run on the same vectors.

`hybrid_search_products()` fuses a full-text ranking with a pgvector
nearest-neighbour ranking using Reciprocal Rank Fusion — exact names stay on top
while conceptual queries ("smoky, for a winter night") reach products that share
no words with them. `related_products()` orders the PDP rail by cosine distance
between product embeddings, so the suggestions are fragrances that actually
smell alike rather than whichever three share a collection.

What gets embedded is `Product.search_document`, a **generated column**. The
full-text index reads the same column, so both halves of a hybrid search
describe the same text — and there is no TypeScript twin of that string to drift
out of step. A trigger nulls `embedding` whenever `search_document` changes, so
editing a product marks it for re-embedding; `npm run embed` picks up the nulls.

Until `npm run embed` has run, everything still works: search returns the
full-text ranking and the related rail falls back to own-collection-first
ordering. `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` and `EMBEDDING_VERSION` in
`src/lib/search/config.ts` must stay in step with the `vector(1536)` column —
changing the model to one of a different width is an `alter` plus a full
re-embed.

Credentials: `AI_GATEWAY_API_KEY` locally, or Vercel's OIDC token in a
deployment (`vercel env pull` brings it to a local checkout).

## Editing content

The database is the source of truth. Edit rows in the Supabase table editor;
`seed/*.json` is a snapshot for rebuilding an empty project, not a place to make
changes. `db:seed` upserts and never deletes, so removing a record from the JSON
does not remove it from the database — unpublish or delete it deliberately.

Two lists are deliberately duplicated in code, and `db:verify` fails if they
drift:

- `ENQUIRY_SUBJECTS` in `src/constants/contact.ts` is the allow-list the contact
  Server Action validates against, because a submitted subject reaches a mail
  header and must not be validated against an editable row.
- The stockist regions and the olfactive families are unions in `src/types/`,
  because the dictionary keys are typed against them.

## Migrating this to the Supabase CLI

The files are written so that adopting the CLI is a copy, not a rewrite.
Migration filenames are generated, never invented:

```bash
supabase migration new catalog     # then paste sql/0001_catalog.sql, and so on
supabase db reset --local
supabase db advisors               # fix everything it reports before committing
```
