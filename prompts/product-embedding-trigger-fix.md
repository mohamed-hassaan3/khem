# Product semantic search: fix the embedding-invalidation trigger

## Goal

Make product embeddings **persist**, so semantic and related-product search work
for products for the first time. Today every vector written to `"Product"` is
wiped again by the same statement. That is why Tokyo had 0 of 29 products
embedded and Frankfurt has 0 of 28. Product search has only ever been lexical
in production.

The trigger still has to do its real job: **null a product's vector when the
text it was computed from changes**, so `npm run embed` re-embeds it.

## Skills read

- `AGENTS.md` (§9: migrations through `npm run db:migrate`; reload PostgREST after
  schema changes).
- `.agents/skills/supabase/SKILL.md`: verify every change with a query; keep
  `security invoker`; no new grants.

## Existing code inspected

| File | Finding |
| :--- | :--- |
| `supabase/sql/0004_search.sql:236-254` | `invalidate_product_embedding()` is a **BEFORE UPDATE** trigger: `if new.search_document is distinct from old.search_document then new.embedding := null`. `search_document` is a `generated always … stored` column, and Postgres computes stored generated columns **after** BEFORE triggers. So `new.search_document` is NULL in the trigger, the test is always true, and every UPDATE nulls the vector, including the UPDATE that writes it |
| `supabase/sql/0009_journal.sql:115-170` | The article trigger patched the symptom with a guard: "don't null if this statement changed the embedding". It documents the product defect and leaves it for "its own pass". This is that pass |
| `supabase/sql/0016_checkout.sql:225`, `0071_stock_movements.sql:27,34`, plus `0015`, `0017`, `0021`, `0027`, `0028`, `0035`, `0040`, `0041`, `0042` | **Product rows are updated on every sale, restock and stock movement.** So the article-style guard is *not enough* for products: a stock change does not touch the embedding, so the guard would still null the vector. Every sale would silently push that product back to lexical search |
| `src/actions/admin/catalog.ts:170-210` | Admin save → `embedDocument()` → `update({ embedding })`. Its comment records the defect and the intended fix. The write is a no-op today |
| `scripts/embed-catalog.ts:121-138` | Same defect, documented in a ⚠ comment |
| Frankfurt `schema_migrations` | Recorded through `0071`. `0072a` is **applied but unrecorded** (`ScentProfileProduct` exists with 53 rows). `0072b` is **not applied** (`IngredientFamily` and `assert_ingredient_families()` still exist), and its header says to run it only once the scent-profile code is verified |

## Decisions

1. **An AFTER UPDATE trigger with a `WHEN` clause, not a guard.** In an AFTER
   trigger, `NEW.search_document` holds the real computed value. So:
   ```sql
   create trigger product_embedding_invalidation
     after update on public."Product"
     for each row
     when (old.search_document is distinct from new.search_document)
     execute function public.invalidate_product_embedding();
   ```
   The function runs only when the text really changed. Stock, price, image and
   status updates never reach it, so a sale never touches the vector. Inside the
   function, if the same statement did **not** also write a new embedding (the
   null-safe comparison from `0009`, using `OPERATOR(extensions.=)` because
   `search_path` is empty), it runs
   `update public."Product" set embedding = null where id = new.id`. That nested
   UPDATE leaves `search_document` unchanged, so the `WHEN` is false and nothing
   recurses.
2. **`security invoker`, `set search_path = ''`, no grants**, as before. Text
   edits come from the admin (service role); the nested UPDATE runs as the same
   caller.
3. **Applying it without running `0072b`.** `npm run db:migrate` applies pending
   files in order and has no "only this file" option. It would run `0072b`,
   which is destructive and gated on separate verification. So:
   - the migration is **`supabase/sql/0073_product_embedding_invalidation.sql`**
     and is fully idempotent (`create or replace function`, `drop trigger if
     exists`, `create trigger`)
   - it is applied **once, directly**, with `psql --single-transaction`
     followed by `notify pgrst, 'reload schema'`, and **not** recorded in
     `schema_migrations`, which keeps that history a contiguous prefix as
     `validateAppliedFiles()` requires
   - when the owner later runs `npm run db:migrate` after verifying the
     scent-profile code, it applies `0072a` (idempotent), `0072b` (by that
     decision) and `0073` (re-applied harmlessly), and records all three.
     `supabase/README.md` gets one line saying this.
4. **The article trigger is out of scope.** It has a milder version of the same
   problem: any article update that doesn't write a new vector nulls the
   existing one, for example toggling publish. Articles are not touched by
   orders, and `npm run embed` refills them. It is listed as a possible
   follow-up, not changed.

## Files likely to change

| File | Change |
| :--- | :--- |
| `supabase/sql/0073_product_embedding_invalidation.sql` (new) | The function and the AFTER trigger above, with the reasoning in comments |
| `src/actions/admin/catalog.ts` | Replace the "this call is a no-op" comment with what is now true |
| `scripts/embed-catalog.ts` | Remove the ⚠ defect comment |
| `supabase/sql/0009_journal.sql` | **Not edited** (applied migrations stay immutable). `0073`'s header explains why it differs from `0009` |
| `supabase/README.md` | One line on the `0072a`/`0072b`/`0073` application note, plus the trigger in the Search section |

## Security requirements

- No new grants, no `SECURITY DEFINER`, no RLS changes. `db:verify` must still
  report the same results (52/54: the two existing catalog data gaps).
- `search_path = ''` and schema-qualified everything, including the vector
  operator.
- Applied in one transaction. If any statement fails, nothing changes.

## Acceptance criteria (all proven against Frankfurt, mutations rolled back)

1. **Vectors persist:** after `npm run embed`, `npm run embed -- --check`
   reports 0 products and 0 articles waiting.
2. **A stock-only update keeps the vector:** inside a rolled-back transaction,
   `update "Product" set inventory = inventory where slug = X` leaves `embedding`
   non-null.
3. **A text edit drops the vector:** in a rolled-back transaction, changing
   `description` nulls `embedding`.
4. **Writing a vector with a text change in the same statement keeps the new
   vector:** rolled back.
5. **No recursion:** `pg_stat_user_functions` (or a `raise notice` count in a
   rolled-back test) shows one trigger invocation per text edit.
6. **A sale keeps it:** `npm run db:test:sales` (rolls back) still passes the
   scenarios it passed before. The Discovery Credit stop is pre-existing.
   Afterwards the products it sold still have vectors.
7. **Live semantic search:** `/api/search?q=<a mood phrase>` returns products
   whose names do not contain the query words, and an Arabic query returns
   products.
8. `npx tsc --noEmit`, `npm run lint`, `npm run build` pass.

## Checks to run

```
psql "$SUPABASE_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
  -f supabase/sql/0073_product_embedding_invalidation.sql -c "notify pgrst, 'reload schema'"
npm run embed && npm run embed -- --check
npm run db:verify
npm run db:test:sales
npx tsc --noEmit && npm run lint && npm run build
```

Then deploy the comment-only code changes with
`ssh khem@179.67.202.31 /srv/khem/current/deploy/deploy.sh <branch>`.

## Manual test steps for the owner

1. On `https://khemperfumes.com`, search for a mood rather than a name, such as
   "warm smoky evening": products appear whose names don't contain those words.
2. Search in Arabic, such as "عطر دخاني": products appear.
3. Open a product page: the related-products rail is populated.
4. In `/admin`, edit a product's description and save. The product leaves the
   "awaiting an embedding" list within a few seconds (re-embedded on save).
5. Place a cash order for a product, then search for it by mood again. It
   still ranks; the sale did not drop its vector.
