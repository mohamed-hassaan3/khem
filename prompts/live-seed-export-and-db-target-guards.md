# Focused Live Seed Export and Remote Database Guards

## Goal

Make the local catalog and ingredient usage seed data reflect the live Supabase database, prevent the seed snapshot from writing stale inventory values, and require explicit confirmation before `db:seed` or `db:migrate` connects to a non-local database.

## Skills read

- `.agents/skills/supabase/SKILL.md`

## Existing code inspected

- `scripts/db-dump.ts`: existing read-only exporter; currently writes `catalog.json`, `content.json`, and `directory.json`.
- `scripts/db-seed.ts`: imports `CatalogSeed`, `ContentSeed`, and `DirectorySeed`; upserts catalog and content data and currently includes inventory counters in Product writes.
- `scripts/db-migrate.ts`: prints the redacted target but has no confirmation guard; runs every SQL file in one transaction and has no migration history table.
- `scripts/db.ts`: resolves `SUPABASE_DB_URL` then `DIRECT_CONNECTION_STRING`; connection and transaction helpers.
- `scripts/seed-types.ts`: shared JSON types; currently includes inventory through `Product` and explicit counter fields.
- `src/types/catalog.ts`: application `Product.inventory` is used for live storefront inventory and must remain unchanged.
- `scripts/db-verify.ts`: reads `catalog.json` without importing seed types; uses product images and row counts, not inventory fields.
- `package.json`, `.github/workflows/keep_alive.yml`, and `vercel.json`: no automated calls to `db:seed` or `db:migrate` were found. Existing CI only pings Supabase REST; Vercel config contains cron routes.

## Decisions and assumptions

- Extend `scripts/db-dump.ts`; do not create a second exporter.
- Add a focused mode/command for `catalog.json` plus ingredient `usedIn` links in `content.json` only.
- Do not change `directory.json`, or any other section or field in `content.json`.
- Preserve current JSON shapes, key order, array ordering, indentation, and trailing newline.
- Inventory totals and counters are volatile operational state, not seed content. Exclude `inventory`, `inventoryOnline`, and `inventoryOffline` from the catalog export and Product seed row/upsert.
- Freshly seeded products start with the database default stock (zero); later inventory management belongs to the inventory workflows.
- Keep `src/types/catalog.ts`'s `Product.inventory`: application queries and UI still need live inventory.
- Remote target confirmation is exact-host confirmation. Only the exact normalized hosts `localhost`, `127.0.0.1`, and `::1` count as local; no substring, suffix, or contains checks. `localhost.example.com` is remote.
- In interactive use, require typing the exact remote hostname. In non-interactive use, require the corresponding exact-host environment override: `KHEM_SEED_CONFIRM` for seeding and `KHEM_MIGRATE_CONFIRM` for migrations. Refuse mismatches and malformed URLs before connecting.
- Do not add a migration-history system or change `0068_collection_subdescription_seed.sql`. The migration runner still has no history table, and `0068` can overwrite editor-changed collection subdescription text on rerun; document both as known issues outside this task.

## Importer and consumer audit for inventory-field removal

- `scripts/db-dump.ts` reads Product inventory fields and emits them into `catalog.json`; remove those selects and output fields.
- `scripts/seed-types.ts` defines `ProductSeedRow`; omit the application `inventory` field and remove the explicit inventory-counter properties from this seed-only type.
- `scripts/db-seed.ts` builds Product upsert rows; remove inventory fields so generated upserts do not modify inventory columns. New products use database defaults.
- `scripts/db-verify.ts` reads the catalog JSON generically and checks counts/images; it does not inspect inventory, so no inventory-specific update is expected. Confirm it continues to parse the unchanged product/image structure.
- `src/types/catalog.ts` and its live application consumers are not seed importers; retain application inventory typing and behavior.
- No other TypeScript importer/consumer of `ProductSeedRow` or `CatalogSeed` was found beyond `db-dump.ts`, `db-seed.ts`, and the generic JSON read in `db-verify.ts`.

## Files likely to change

- `scripts/db-dump.ts`
- `scripts/db-seed.ts`
- `scripts/db-migrate.ts`
- `scripts/db.ts` or a small shared `scripts/` target-confirmation helper
- `scripts/seed-types.ts`
- `package.json` only if a focused dump command is needed
- `supabase/seed/catalog.json` and `supabase/seed/content.json` after the focused export is explicitly run

## Implementation requirements

### Focused export

1. Add a clearly named focused dump option/command to the existing exporter.
2. Use read-only `SELECT` queries only; no RPCs, DDL, mutations, or transaction writes.
3. Export the live catalog and product images to `catalog.json` in the current seed format and curated ordering.
4. Read live `IngredientUsage` rows and replace only the `usedIn` arrays for corresponding existing ingredient entries in `content.json`.
5. Preserve all non-`usedIn` content fields and sections exactly, and do not write `directory.json` in focused mode.
6. If a live usage points to an ingredient missing from the existing `content.json`, fail before writing either file and report the missing ingredient IDs. Do not silently discard usage data or invent ingredient content.
7. Build and validate both outputs before writing. Preserve two-space JSON formatting and the trailing newline.
8. Remove inventory total/counter columns from the exporter projection and output type.

### Volatile inventory handling

1. Remove inventory total/counter fields from the seed-only `ProductSeedRow` shape without changing `src/types/catalog.ts`.
2. Remove inventory columns from `db-seed.ts` Product upsert rows; do not substitute zero or a fallback value.
3. Rely on database defaults for new product inventory. Existing Product inventory must be untouched by `db-seed`.
4. Update comments that incorrectly imply inventory is included in the seed export or restored from it.

### Shared remote target guard

1. Parse the database URL and derive the hostname before opening a connection.
2. Print a redacted target host/database identifier; never print credentials.
3. Recognize a local host only by exact normalized equality to `localhost`, `127.0.0.1`, or `::1`. Do not include `host.docker.internal` unless separately approved; do not use substring matching.
4. For a remote host on a TTY, prompt the operator to type the exact hostname and proceed only on exact equality.
5. For non-interactive execution, accept only `KHEM_SEED_CONFIRM=<exact-host>` for `db:seed` or `KHEM_MIGRATE_CONFIRM=<exact-host>` for `db:migrate`. A missing or mismatched value must fail closed before connection.
6. Add or document a focused guard test case where `localhost.example.com` is classified as remote and requires confirmation.
7. Keep existing seed remote-target safety and apply the same shared classification/confirmation semantics to migrations.

### Known migration behavior to document, not fix

- `db:migrate` re-runs every SQL file in filename order and has no migration-history table.
- `supabase/sql/0068_collection_subdescription_seed.sql` updates collection text without a null guard and can overwrite editor-changed values on rerun.
- Do not change migration tracking, migration ordering, or `0068` in this task.

## Security requirements

- Keep database URLs and credentials out of logs and JSON output.
- Focused export must remain read-only and must not connect until it has resolved and displayed the intended target.
- Both write-capable runners must refuse unconfirmed remote targets before connection.
- Exact-host confirmation is required in both TTY and non-TTY flows; no boolean `yes` override.
- Never alter live product stock through the seed runner.

## Acceptance criteria

- Focused dump modifies only `catalog.json` and `usedIn` values in `content.json`; it never writes `directory.json` or other content sections.
- JSON structure, object key order, curated arrays, indentation, and trailing newline remain stable.
- Renamed products, live image galleries, and ingredient links are exported from live SELECT results.
- Missing ingredient records referenced by usage cause a fail-before-write error.
- No inventory totals/counters appear in the exported catalog seed or Product seed upsert.
- Existing live inventory remains unchanged by `db-seed`; new products receive the database default stock.
- Exact local hosts bypass confirmation; `localhost.example.com` and other remote hosts require exact-host confirmation.
- Non-interactive remote operation succeeds only with the exact corresponding environment confirmation; wrong host values fail before connection.
- CI/deploy inspection remains documented: no current repo automation calls `db:seed` or `db:migrate`.
- Migration history and the `0068` overwrite risk are documented and left unchanged.

## Checks to run after approval

- Run TypeScript typecheck and ESLint on changed scripts/types.
- Review `git diff` to confirm only the focused JSON targets changed and only ingredient `usedIn` arrays changed inside `content.json`.
- Review generated seed rows to confirm inventory fields are absent.
- Verify target parsing/guard behavior without connecting to a database, including the exact `localhost.example.com` case.
- Do not run `db-seed`, `db:migrate`, or SQL as part of this task. Run the focused read-only exporter only after approval to write the two local JSON artifacts.

## Exact manual review steps after implementation

1. Set the intended database URL and run the focused dump command; confirm its output names the redacted target.
2. Inspect `git diff -- supabase/seed/catalog.json supabase/seed/content.json supabase/seed/directory.json`.
3. Confirm `catalog.json` reflects live product slugs and image galleries and contains no inventory values.
4. Confirm in `content.json` that only ingredient `usedIn` arrays changed; all other fields/sections are byte-for-byte unchanged.
5. Confirm `directory.json` has no diff.
6. Exercise the remote guard with `localhost.example.com` and an incorrect hostname confirmation; both must refuse before opening a connection. Exercise an exact local host to confirm it is treated as local.
7. Do not run `db-seed` or `db:migrate`; their confirmation paths can be reviewed without applying writes.
