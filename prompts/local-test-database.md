# A separate test database for local testing

> **Status: deferred by the owner (2026-11-20)** — "skip the test database for
> now". Not started. Until it exists, no signed-in or data-writing local test
> runs against `.env.local` (production).

Owner (2026-11-20): "set up a separate test database for local testing so test
users never touch the production database again", and "do what's best for the
app".

## Why

Local signed-in tests (Clerk **development** instance) twice wrote a test
`"User"` row into **production**. The account sidebar prefetches `/account`,
whose page runs `ensureUserRowId()` and `claimGuestOrdersForIdentity()`
(`production-audit.md` §11 and `prompts/clerk-account-navigation-fix.md`).
Both rows were removed. The structural cause is that `.env.local` knows only
one database: production.

## Decision: a second Supabase project, `khem-test`, in Frankfurt

It is the same platform as production: PostgREST/Data API, row-level security,
pgvector, Storage, the same pooler. So a test there behaves like the live site.
Nothing extra runs on the Mac.

The alternatives were weighed and rejected:
- **Docker + Supabase CLI:** not installed. It needs Docker Desktop running for
  every test and only emulates the platform.
- **Reusing Tokyo:** holds real customer data, would need a destructive wipe,
  and is the fallback until 12-02.

## What you do (about 3 minutes; I can't create projects in your account)

1. Supabase dashboard → **New project** → name `khem-test`, region **Central EU
   (Frankfurt)**, free plan, any strong database password.
   - If the free plan refuses (2 active free projects per organisation):
     **pause the Tokyo project** first, which is planned for after 12-02
     anyway. Or tell me, and we decide.
2. Create the file `.env.testdb.local` in the project root (git-ignored by
   `.env*`) with these four values from the new project's settings:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<test-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
   SUPABASE_SECRET_KEY=sb_secret_…
   SUPABASE_DB_URL=postgresql://postgres.<test-ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```
   (Session pooler, port 5432, as in `.env.local`.) Tell me when it's there. I
   won't print or copy the values.

## What I build

1. **Clerk development keys move into `.env.testdb.local`.** I append the two
   currently commented-out `pk_test`/`sk_test` lines. `.env.local` keeps the
   production pair and is otherwise untouched.
2. **Schema:** apply `supabase/sql/` in order to `khem-test`, mirroring
   production exactly.
   - **Skip `0072b`**, which production also doesn't have.
   - Record each file in `schema_migrations`, then reload PostgREST's schema
     cache.
   - A `scripts/db-test-setup.ts` does this. It **refuses to run unless the
     project ref in the URL is not production's.**
3. **Data:** `npm run db:seed` against `khem-test`: the catalogue, content and
   directory from `supabase/seed/`. **No customers, orders or PII.** Product
   embeddings via `npm run embed` (a few calls).
4. **One-command test mode:**
   - `npm run dev:test`: `next dev` on port 3100 with `.env.testdb.local`
     loaded over `.env.local`.
   - `npm run start:test`: build + start, the same way.
   - `npm run db:test:*`: `db:verify`, `db:test:sales` and friends against
     `khem-test`.
   - Implemented with Node's `--env-file` (process env wins over Next's
     `.env.local`). No new dependency.
5. **Guard rails that make the old mistake impossible, not just unlikely:**
   - **App, at server start (`src/instrumentation.ts` `register()`):** if the
     Clerk key is a **development** key (`pk_test_…`) and the Supabase URL is
     the **production** project, throw and refuse to start ("development Clerk
     against the production database").
     - Production uses `pk_live_…`, so this can never trigger there.
     - The production project ref is a constant in code. It is not a secret;
       it's in every public Supabase URL.
   - **Scripts (`scripts/db-target.ts`):** the existing confirmation compares
     the host, but every Frankfurt project shares the same pooler host. Add the
     **project ref** (from the `postgres.<ref>` user) to what is shown and
     confirmed, and add a `--test` flag that refuses anything but the test ref.
   - **Unit tests** for both guards.
6. **Docs:** a "Local testing" section in `README.md` and `supabase/README.md`,
   plus the `AGENTS.md` workflow rule: *signed-in or data-writing local tests
   run in test mode only*.

## Then: verify the Clerk fix (`1fdebde`) in test mode, and deploy it

Run `prompts/clerk-account-navigation-fix.md`'s scenarios R1–R5 with
`npm run start:test` and a disposable development-instance user:
- R1–R3: account pages after client navigation (the reported bug);
- R4: sign-in and sign-up forms;
- R5: signed-out pages make 0 Clerk requests, the signed-in menu works, the
  session is still fresh after 90 s, and nav sign-out works.

Any rows those tests create land in `khem-test`. Then run the checks, deploy,
do the live signed-out checks, and you re-test the signed-in path that failed.
Rollback target: `eee60c29dcdf`.

## Commits

1. guards (instrumentation + `db-target` ref check) and their tests;
2. `db-test-setup.ts` and the `*:test` npm scripts;
3. docs;
4. (after verification) a docs addendum and deploy of `1fdebde`.

## Security requirements

- `.env.testdb.local` is git-ignored (`.env*`) and never printed. The test
  project holds no customer data.
- The guards only refuse; they never change behaviour in production.

## Acceptance criteria

- `npm run start:test` serves the site from `khem-test`: catalogue visible,
  sign-in works with the development instance.
- With `.env.testdb.local` removed and the Clerk development key forced on, the
  app **refuses to start** against production, and the guard's error says why.
- `db:test:setup` and `db:seed` refuse the production ref.
- R1–R5 pass in test mode. Production's `"User"` table gains no row from any
  test.
- `tsc`, `eslint`, tests and `next build` pass.
