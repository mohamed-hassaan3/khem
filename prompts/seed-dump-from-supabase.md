# Dump Supabase → `supabase/seed/catalog.json`

## Goal

Make Supabase the single place content is edited, and make the seed file a
**generated export** of it rather than a hand-maintained twin.

Today the flow is one-way: `supabase/seed/catalog.json` → `npm run db:seed` →
Postgres. Editing a price or a card image in the Supabase table editor leaves
the JSON stale, and the next `db:seed` on a fresh project silently rebuilds the
*old* catalog. `scripts/db-seed.ts` already names the missing half in its own
header — *"If you want the export to match again afterwards, dump it back"* —
but no dumper exists.

Add it: `npm run db:dump`, which reads the live database and rewrites
`supabase/seed/catalog.json` byte-for-byte in the exact shape `db-seed.ts`
reads back, so `dump → seed` is a round trip and `git diff` after a dump is a
readable changelog of what was edited on the platform.

## Skills read

None of `.agents/skills/{clerk,supabase,ai-sdk}` apply to a local `scripts/`
Node process: this connects over raw Postgres via `pg`, exactly like the three
existing `db:*` scripts, and never touches the Data API, RLS, or the browser
client.

## Existing code inspected

- [scripts/db-seed.ts](scripts/db-seed.ts) — the target shape. `CatalogSeed` =
  `{ collections, products, featuredProductSlug }`; `CollectionSeedRow` and
  `ProductSeedRow` carry the `_ar` twins the app types drop; `sortOrder` is
  array position, not a field; `ProductImage.id` is derived as
  `` `${product.slug}-image-${index}` ``.
- [scripts/db.ts](scripts/db.ts) — `connectionString()`, `redactUrl()`,
  `withClient()`. Reuse verbatim; no new connection code.
- [scripts/db-verify.ts](scripts/db-verify.ts) — the reader-side precedent for
  `SEED_DIR` and per-table queries.
- [supabase/sql/0001_catalog.sql](supabase/sql/0001_catalog.sql),
  [supabase/sql/0008_i18n_content.sql](supabase/sql/0008_i18n_content.sql),
  [supabase/sql/0010_collection_card_image.sql](supabase/sql/0010_collection_card_image.sql)
  — the real column list, including `cardUrl` / `cardAlt` / `cardAlt_ar` and
  the `_ar` columns.
- [supabase/seed/catalog.json](supabase/seed/catalog.json) — current file: 7
  collections, 28 products, 2-space indent, trailing newline.

## Decisions / assumptions

1. **Scope is `catalog.json` only.** That is what was asked. The script is
   written as one `dumpCatalog()` function behind a small `writeSeed()` helper
   so `content.json` and `directory.json` can be added later as pure additions
   — say the word and they go in the same file.
2. **Read-only.** The dumper opens `withClient` (not `withTransaction`) and
   issues nothing but `select`. It cannot alter the database, which is the
   property that makes it safe to run against production.
3. **`sortOrder` becomes array order and is dropped from the JSON**, mirroring
   `ordered()` on the seed side. `order by "sortOrder", id` — `id` breaks ties
   so two rows sharing a `sortOrder` still emit deterministically.
4. **Server-managed columns are excluded**: `createdAt`, `updatedAt`, the
   `searchVector` from `0004_search.sql`, and `ProductImage.id` (derived).
   Including them would make every dump a noisy diff and would feed
   `db-seed.ts` columns it does not write.
5. **`featuredProductSlug` comes from `BoutiqueSetting` where `id = 'default'`**
   — the row `db-seed.ts` writes it into. If the row is missing, fail loudly
   rather than emit a file that seeds a broken home page.
6. **Formatting matches the current file exactly**: `JSON.stringify(value, null, 2)`
   plus a trailing `\n`. Key order is fixed by the object literal in the script,
   in the same order the existing file uses, so a dump of an unedited database
   produces an empty `git diff`.
7. **The file is overwritten in place, not merged.** Rows deleted in Supabase
   disappear from the export. This is the intended asymmetry: `db:seed` is
   additive and never deletes, so a deletion still has to be made deliberately
   in the database — the export just stops advertising it.
8. `npm run db:dump` uses `tsx --env-file-if-exists=.env.local`, like its three
   siblings, so it reads `SUPABASE_DB_URL` the same way.

## Files likely to change

| File | Change |
| :--- | :--- |
| `scripts/db-dump.ts` | **New.** The dumper. |
| `package.json` | **New script:** `"db:dump": "tsx --env-file-if-exists=.env.local scripts/db-dump.ts"` |
| `supabase/seed/catalog.json` | Regenerated on first run (expected diff: whatever was edited on the platform). |
| `supabase/README.md` | Document the round trip: edit in Supabase → `npm run db:dump` → commit. |
| `scripts/db-seed.ts` | Header comment only — point "dump it back" at the real command. |

## Implementation requirements

**Queries** (three, all `select`, all read-only):

```
-- collections
select id, name, name_ar, slug, description, description_ar,
       "bannerUrl", "bannerAlt", "bannerAlt_ar",
       "cardUrl", "cardAlt", "cardAlt_ar",
       "isFeatured", kind
  from public."Collection"
 order by "sortOrder", id;

-- products
select id, name, slug, subtitle, subtitle_ar, description, description_ar,
       story, story_ar, concentration, format, format_ar,
       includes, includes_ar, badge, badge_ar, tags,
       "topNotes", "topNotes_ar", "heartNotes", "heartNotes_ar",
       "baseNotes", "baseNotes_ar",
       "volumeMl", "priceInCents", sku, inventory, "isBestseller",
       "collectionSlug"
  from public."Product"
 order by "sortOrder", id;

-- images, grouped onto products in JS
select "productSlug", url, alt, alt_ar, "isPrimary", "sortOrder"
  from public."ProductImage"
 order by "productSlug", "sortOrder";

-- featured slug
select "featuredProductSlug" from public."BoutiqueSetting" where id = 'default';
```

**Typing.** Zero `any`. Declare a `CollectionDumpRow` / `ProductDumpRow` /
`ImageDumpRow` per query and pass it as `client.query<Row>(…)`'s generic. Do
**not** import the seed-side types from `db-seed.ts` (it is a top-level script
that runs `main()` on import) — restate them, or lift the shared
`CollectionSeedRow` / `ProductSeedRow` / `CatalogSeed` types into a small
`scripts/seed-types.ts` that both files import. Lifting is preferred: it makes
"the seeder and the dumper agree" a compile-time fact instead of a convention.

**Object construction.** Build each JSON object with an explicit literal in the
documented key order — never `...row` spread — so the key order, and therefore
the diff, is controlled by the script rather than by Postgres.

**Images** are grouped by `productSlug` into each product's `images` array,
ordered by `sortOrder`, each entry `{ url, alt, alt_ar, isPrimary, sortOrder }`
— `sortOrder` **is** kept here, because `db-seed.ts` reads
`image.sortOrder` off the object rather than from array position.

**Empty database guard.** If `Collection` or `Product` comes back empty, throw
before writing. Overwriting a good 1,800-line export with `{"collections":[],
"products":[]}` because someone pointed the script at the wrong project is the
one destructive outcome available here, and it must be impossible.

**Output.** Write with `node:fs/promises` `writeFile` to
`path.join(process.cwd(), "supabase", "seed", "catalog.json")`. Print the
redacted host and a per-table count, matching `db-seed.ts`'s closing summary.

**Errors.** Same shape as the siblings: `main().catch()`, a one-line message,
`process.exitCode = 1`. Never print the connection string un-redacted.

## Security requirements

- Read-only by construction. No `insert` / `update` / `delete` / DDL anywhere
  in the file.
- No string interpolation into SQL. There is no user input here at all — every
  identifier is a literal in this file — and it stays that way.
- The connection string is never logged; only `redactUrl()` output is printed.
- `.env.local` stays gitignored; the script reads it and never copies any part
  of it into the output file.
- The dump contains published catalog content only — no `User`, `Order`,
  `Address`, or Clerk data — so the written file carries nothing that is not
  already public on the storefront. Do not extend the dumper to those tables.

## Acceptance criteria

- [ ] `npm run db:dump` rewrites `supabase/seed/catalog.json` from the live
      database and exits 0.
- [ ] Running `db:dump` against a database that was just seeded from the
      current file produces **no `git diff`** (byte-identical round trip).
- [ ] A change made in the Supabase table editor (e.g. a `priceInCents`, or a
      `cardUrl` on a collection) appears in the JSON after a dump, and only
      that change appears in the diff.
- [ ] `npm run db:seed` accepts the dumped file without error, and
      `npm run db:verify` passes afterwards.
- [ ] Rows are ordered exactly as the database's `sortOrder` says, and
      `sortOrder` does not appear on collection or product objects.
- [ ] Each product's `images` array is present, ordered, and keeps its
      `sortOrder` field.
- [ ] `featuredProductSlug` is read from `BoutiqueSetting`, and a missing row
      is a loud failure.
- [ ] Zero `any`; `npx tsc --noEmit` and `npm run lint` both clean.
- [ ] Pointing the script at an empty database refuses to write.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
```

## Manual test steps

1. `npm run db:dump` on the current database, then `git diff supabase/seed/catalog.json`.
   Expect either nothing, or exactly the platform edits already made — inspect
   the diff before committing.
2. In the Supabase table editor, change one `Product.priceInCents` and set one
   `Collection.cardUrl` + `cardAlt` pair.
3. `npm run db:dump` → `git diff` shows precisely those two edits.
4. `npm run db:seed` → `npm run db:verify`. Both succeed.
5. `npm run db:dump` again → clean `git diff` (round trip is stable).
6. `git checkout supabase/seed/catalog.json` to discard the throwaway edits, or
   revert them in Supabase and dump once more.

---

## Amendment — extended to `content.json` and `directory.json`

The scope note above ("say the word and they go in the same file") was taken up
immediately after the catalog landed: **Supabase now owns every editable field,
and nothing under `seed/` is hand-maintained.**

What the extension added beyond three more `select`s:

- **Every `_ar` column round-trips.** `content.json` carried *no* Arabic at all
  — not on testimonials, ingredients, articles, timeline events, craft steps or
  statements — while the database has had those columns since
  `0008_i18n_content.sql`. They are empty today because the editorial layer is
  untranslated, which is precisely why they had to be wired up before the first
  translation is written in the dashboard rather than after it is lost.
- **`isPublished` is a column, not a constant.** `db-seed.ts` hard-coded `true`
  for testimonials, articles, the craft quote and stockists, so unpublishing
  anything in the dashboard survived exactly until the next seed put it back on
  the site. Both sides now carry the real value.
- **`db-seed.ts` was extended in lockstep.** A dumper that writes a field the
  seeder ignores is worse than no dumper: it looks like the data is safe in git
  while a fresh project comes up without it. Every column the dump emits, the
  seed writes.
- **Two shapes changed.** `ingredientFamilies` and `enquirySubjects` were arrays
  of bare strings with nowhere to hang a translation; both are now rows
  (`{ name, label_ar }`, `{ label, label_ar }`).
- **One deliberate exception.** *Which* enquiry subjects exist still comes from
  the `ENQUIRY_SUBJECTS` constant, because `src/schemas/contact.ts` validates
  submissions against it — a subject added in Supabase would be rejected by the
  form it appeared on. Only its `label_ar` is platform-editable.
- **Dates are formatted in SQL** (`to_char(…, 'YYYY-MM-DD')`). node-postgres
  returns `date` as a JavaScript `Date`, which `JSON.stringify` writes as a UTC
  timestamp — and shifts by a day for anyone west of UTC.
- **Enum arrays are cast** (`tags::text[]`, `families::text[]`). The driver has
  no decoder for arrays of user-defined enums and returns the raw literal
  `{NEW_ARRIVAL}` as a string, which lands in the file where a JSON array
  belongs.

Verified: `dump → seed → dump` is byte-stable across all three files, every
pre-existing English value came back identical, `db:verify` passes all 38
checks, and `tsc --noEmit` and `eslint` are clean.
