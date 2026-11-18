# Supabase region migration — Tokyo → Frankfurt

> **Amended 2026-11-17 by the owner's answers.** This is phase 2 of
> `prompts/hostinger-vps-migration.md`, which takes precedence where the two
> differ:
> - The store is **already paused on Vercel**, so no `KHEM_PRELAUNCH` freeze is
>   needed. Decision 2 reduces to "nobody uses `/admin` or the Tokyo dashboard
>   during the copy".
> - **There is no Vercel cutover.** Steps B4–B6 are replaced by the VPS deploy in
>   the master prompt; the VPS is configured against Frankfurt from the start.
> - **Realtime stays off.** Decision 3 is confirmed by the owner.
> - Because nothing is live, the rehearsal (A) and the real copy (B) can be the
>   same run, provided section C passes in full.

## Goal

Move KHEM's Supabase project from **`ap-northeast-1` (Tokyo)** to
**`eu-central-1` (Frankfurt)**, so the database sits next to the new Hostinger
KVM 2 VPS (Germany) and close to the customers in Egypt.

Today every server render pays roughly 220–250 ms per database round trip from
Europe to Tokyo, and most pages make several. After the move a round trip from the VPS
costs 1–2 ms.

The move must be **lossless**: identical schema, rows, sequence values, grants,
RLS, functions, embeddings, and storage objects. It must also be **reversible**:
the Tokyo project stays intact until the new one has run production cleanly for
two weeks.

This is a data and infrastructure task. **No application code changes.** The
app reads every Supabase coordinate from the environment
(`NEXT_PUBLIC_SUPABASE_URL`, keys, `SUPABASE_DB_URL`). `next.config.ts` derives
the CSP and `next/image` remote patterns from the same variable. Comment images
are stored as relative `storage_path`s.

## Skills read

- `.agents/skills/supabase/SKILL.md`: verify against current docs, verify
  every step, security checklist (secret key never `NEXT_PUBLIC_`).
- Supabase docs, read 2026-11-17:
  - `guides/platform/migrating-within-supabase.md`
  - `.../backup-restore.md` (the CLI dump of roles, schema and data, then a
    `psql --single-transaction` restore with `session_replication_role = replica`)
  - `guides/platform/clone-project.md`. Restore to a new project **stays in the
    same region**, so it cannot do this move.

## Existing state inspected (live, read-only queries)

| Fact | Value | Consequence |
| :--- | :--- | :--- |
| Postgres | **17.6** | Dump and restore need `pg_dump`/`psql` **17**; the new project must be PG 17 |
| DB size | 21 MB, 73 public tables | A dump and restore takes seconds; the freeze window is minutes |
| Extensions | `vector 0.8.2`, `pg_trgm`, `pgcrypto`, `uuid-ossp`, `supabase_vault`, `pg_stat_statements` | `vector` and `pg_trgm` must exist in schema `extensions` before the restore |
| `vault.secrets` | **0 rows** | No pgsodium root-key transfer needed |
| `auth.users` | **0 rows** (auth is Clerk) | The `auth` schema is not migrated |
| Custom login roles | **none** | No `roles.sql` and no password resets |
| Storage | 1 bucket `comment-images` (public, 5 MB, jpeg/png/webp), **3 objects, 396 kB** | Copied by a small script; no storage RLS policies exist |
| Realtime publication | `supabase_realtime` holds 12 public tables (Article, Collection, ContactChannel, CraftQuote, CraftStep, IngredientFamily, LegalDocument, Product, ProductImage, SocialProfile, Testimonial, product_comment) | **Not in any migration, and no `.channel()`/`postgres_changes` call anywhere in `src/`**. See Decision 3 |
| Migration tracker | `public.schema_migrations` (70 rows) | Comes across with the data, so `npm run db:migrate` on the new project knows where it stands |
| Local tooling | **no `pg_dump`, `psql`, `supabase` CLI, Homebrew or Docker** | Postgres.app 17 must be installed (Decision 1) |
| `npm run db:dump` | exports catalog, content and directory **only** | **Not** a migration tool: orders, customers, finance and campaigns would be lost. Do not use it for this |

Scripts read: `scripts/db.ts` (`SUPABASE_DB_URL ?? DIRECT_CONNECTION_STRING`),
`scripts/db-target.ts` (remote-host confirmation), `scripts/db-migrate.ts`,
`scripts/db-dump.ts`, `supabase/README.md`,
`supabase/sql/0018_comment_rating_images.sql`, `src/actions/comments.ts`,
`src/lib/comment-images.ts`, `next.config.ts`.

## Decisions and assumptions

1. **Tooling: `pg_dump`/`psql` 17 from Postgres.app**, not the Supabase CLI.
   `supabase db dump` needs Docker, which is not installed, and it would also
   dump managed schemas this project doesn't use. Plain `pg_dump` limited to
   `public` covers everything KHEM owns.
2. **Write freeze during the copy.** Any order, comment or admin edit made after
   the dump and before the cutover would exist only in Tokyo. During the window:
   set `KHEM_PRELAUNCH=true` on Vercel and redeploy. That 307s every commerce
   route to the cover; editorial pages stay up. Nobody uses `/admin` during the
   window. **Owner to confirm** whether the store is publicly live. If it is
   still pre-launch the flag is already on and the freeze is simply "don't use
   admin".
3. **Realtime publication: not recreated.** The app subscribes to nothing, and
   publishing `Product` and `product_comment` changes only widens what the
   Realtime server broadcasts. If it turns out something external needs it,
   one `alter publication` restores it.
4. **Cutover happens on Vercel first**, while production is still there. Then
   the Hostinger VPS is built against Frankfurt from day one and never sees
   Tokyo. The two migrations stay independent.
5. **Rollback point:** the Tokyo project is not paused or deleted for 14 days.
   Rolling back is "restore the four env vars and redeploy". Writes made after
   the cutover would then be stranded in Frankfurt, which is why the
   verification below happens *before* the freeze lifts.
6. Supabase plan limits: a Free organisation allows 2 active projects, so
   creating Frankfurt alongside Tokyo fits. The owner confirms the plan when
   creating the project.

## Owner actions (Claude cannot do these)

1. Install **Postgres.app** with PostgreSQL **17** (postgresapp.com). Claude
   uses `/Applications/Postgres.app/Contents/Versions/17/bin/{pg_dump,psql}`
   by absolute path, so no PATH change is needed.
2. In the Supabase dashboard, create a new project **in the same organisation**:
   - region **Central EU (Frankfurt) — `eu-central-1`**
   - Postgres **17**
   - a strong DB password
   - name e.g. `khem-eu`
3. In the new project: **Database → Extensions** → enable `vector` and `pg_trgm`
   in schema `extensions`. Claude will also run `create extension if not exists`
   as a guard.
4. Add these to `.env.local` (Claude never prints values, only checks that each
   one is present):
   ```
   TARGET_SUPABASE_DB_URL=      # Session pooler, port 5432 — NOT 6543
   TARGET_SUPABASE_URL=         # https://<new-ref>.supabase.co
   TARGET_SUPABASE_SECRET_KEY=  # new project's secret key
   TARGET_SUPABASE_PUBLISHABLE_KEY=
   ```
   The source's existing `SUPABASE_DB_URL` must also be a **session-mode
   (5432)** pooler URL for `pg_dump`. If it is 6543 (transaction mode), add
   `SOURCE_SUPABASE_DB_URL` with port 5432.

## Files likely to change

| File | Change |
| :--- | :--- |
| `scripts/db-copy-storage.ts` (new) | Copies buckets (with the same `public`, `file_size_limit` and `allowed_mime_types`) and every object, source → target, through `@supabase/supabase-js` with the two secret keys. Refuses when source and target hosts are equal. Idempotent (`upsert: true`). Prints counts, never keys |
| `package.json` | `"db:copy-storage": "tsx --env-file-if-exists=.env.local scripts/db-copy-storage.ts"` |
| `supabase/README.md` | Short "Moving region" section: why `db:dump` isn't the tool, the dump/restore commands, the storage script |
| `src/docs/HOSTINGER-MIGRATION-REPORT.md` | Note that Supabase is now in Frankfurt and the VPS must be in Germany |
| `.env.local` | Owner swaps the values after cutover (not committed) |

Dump files go to the session scratchpad, **never** into the repo. They contain
customer emails, addresses and orders. They are deleted once the migration is
verified.

## Implementation steps

### A. Rehearsal (no freeze, nothing changes for visitors)

1. Check that the env vars exist (names only) and that the
   source and target hosts differ. Abort if `TARGET_*` points at Tokyo or source
   points at Frankfurt.
2. Check the server versions: both `show server_version` → 17.x.
3. Run the dump from the source:
   ```
   pg_dump "$SOURCE" --schema=public --schema-only --no-owner \
           --no-subscriptions --no-publications -f schema.sql
   pg_dump "$SOURCE" --schema=public --data-only --no-owner \
           --no-publications -f data.sql
   ```
   Then strip any `ALTER PUBLICATION`, `CREATE SCHEMA public` and
   `COMMENT ON SCHEMA public` lines from `schema.sql`. The schema already exists
   in the target.
4. Make sure the extensions exist in the target:
   `create extension if not exists vector with schema extensions;` and the same for `pg_trgm`.
5. Run the restore into the target as one transaction:
   ```
   psql "$TARGET" --single-transaction -v ON_ERROR_STOP=1 \
        -f schema.sql \
        -c 'SET session_replication_role = replica' \
        -f data.sql \
        -c "notify pgrst, 'reload schema'"
   ```
   `replica` keeps the embedding-invalidation trigger and the order and
   inventory triggers from firing on restored rows.
6. Run `npm run db:copy-storage`.
7. Run the verification (section C) against the target. A rehearsal that
   fails is fixed and re-run on a **reset** target, which is the reason for
   doing a rehearsal at all.

### B. Real cutover

1. Start the freeze (Decision 2). Note the time.
2. Wipe the target's public data, not its schema:
   `truncate` every public table `restart identity cascade`. Then repeat steps
   A3 (data dump only) and A5 (data only), and A6.
   The alternative is to drop and re-create the target's `public` schema and
   re-run all of section A, which is equally fine at 21 MB. Pick whichever the
   rehearsal proved cleaner.
3. Run section C again in full. **Do not continue on any mismatch.**
4. On Vercel production, replace `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` and
   `SUPABASE_DB_URL` (if set) with the Frankfurt values, then **redeploy**.
   The `NEXT_PUBLIC_*` values and the CSP are baked in at build time. Claude
   prepares the exact list; the owner pastes the values in the Vercel dashboard
   (or Claude runs `vercel env` if the owner asks).
5. Smoke test production (section D) while still frozen.
6. Lift the freeze (`KHEM_PRELAUNCH` back to its previous value, redeploy).
7. Swap `.env.local` so local development and every `db:*` script now target
   Frankfurt. Then delete the dump files.

### C. Verification (must be identical, source vs target)

- **Schema diff:** `pg_dump --schema=public --schema-only --no-owner` of both,
  normalised → `diff` must be empty, apart from the publication lines removed on
  purpose.
- **Row counts:** exact `count(*)` for all 73 public tables, compared one by one.
- **Sequences:** `last_value` of every public sequence equal, including
  `order_number_seq`. The next order number must not collide.
- **Embeddings:** `count(*) where embedding is null` on `Product` is equal, and
  `npm run embed -- --check` passes against the target.
- **Grants and RLS:** `relrowsecurity` on every table equal; `anon` and
  `authenticated` have no write grants. `npm run db:verify` on the target
  covers the security assertions.
- **Functions:** `npm run db:test:sales` and `npm run db:test:finance` against
  the target. Both always roll back.
- **PostgREST:** with the new secret key, a supabase-js `select` on `Product`
  and an `rpc('hybrid_search_products', …)` both return rows, which proves the
  schema cache reloaded.
- **Storage:** 3 objects in `comment-images` with equal sizes; one public
  object URL answers 200 with the right `content-type`.
- **Realtime:** `supabase_realtime` in the target has 0 tables (Decision 3).

### D. Production smoke test (after the redeploy)

Home, a collection, a product in EN and AR, a product with comment photos,
search (semantic and lexical), `/admin` dashboard, orders list, finance page,
one Stripe test-mode payment end to end with the webhook landing (order flips to
PAID), and one cash order, followed by the confirmation email.

## Security requirements

- Secret keys and DB URLs are never printed, logged, committed, or put in a
  `NEXT_PUBLIC_` name. Scripts print hostnames only (`redactUrl` in
  `scripts/db.ts`).
- Dump files hold PII. They stay in the scratchpad and are deleted after step B7.
- Grants and RLS are carried over by the dump and proven equal by `db:verify`.
  Nothing is loosened to "make the restore work". In particular, **no**
  `SECURITY DEFINER` is added and no grant is widened.
- `scripts/db-copy-storage.ts` refuses to run when source and target are the
  same host, and never deletes anything in either project.
- The Tokyo project is left untouched: read-only from start to finish.

## Acceptance criteria

- Schema diff empty; all 73 row counts and all sequences equal.
- `db:verify`, `db:test:sales`, `db:test:finance`, `embed -- --check` pass
  against Frankfurt.
- Storage objects equal; comment photos render on the live site.
- Production on Vercel serves from Frankfurt, which shows in
  `NEXT_PUBLIC_SUPABASE_URL` and in the CSP header.
- A real test order lands in Frankfurt with the next order number in sequence.
- Tokyo project still exists and is unchanged.
- `npm run lint` and `npx tsc --noEmit` pass (for the new script).

## Checks to run

```
npx tsc --noEmit
npm run lint
npm run db:verify          # with .env.local pointing at Frankfurt
npm run db:test:sales
npm run db:test:finance
npm run embed -- --check
```

## Manual test steps after implementation

1. Open the live site, browse home → collection → product (EN, then `/ar/…`).
2. Open DevTools → Network: Supabase image and data requests go to the **new**
   project ref.
3. Search for a scent name and for a mood phrase (semantic).
4. Sign in as an admin → `/admin` → orders, customers, finance all show
   historic data.
5. Place a Stripe test order → the admin shows it PAID, and the order number
   follows the last Tokyo order number.
6. Supabase dashboard (Frankfurt) → Table editor → the new order is there.
   Tokyo → the new order is **not** there.
7. After 14 clean days: pause the Tokyo project, then delete it a week after
   that.
