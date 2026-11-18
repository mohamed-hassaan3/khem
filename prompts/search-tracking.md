# Search tracking and `/admin/search`

## Goal

Record each committed storefront search **without identifying anyone**:

- the query text
- the language
- the number of results
- the search mode
- the date and time

Report the records at **`/admin/search`**:

- top searches
- searches with no results
- recent searches

Delete records older than **90 days** automatically.

## Existing logging (checked first; there is none)

| Place | Finding |
| :--- | :--- |
| Code (`src/`, `scripts/`, `supabase/sql/`) | Nothing records a search. The search path only logs errors (`console.error` in `api/search/route.ts`, `services/search.ts`, `lib/search/*`) |
| Database (Frankfurt) | No search, query, event or analytics table. The only search function is `hybrid_search_products`. No `pg_cron` |
| nginx | `khem_noquery` log format leaves out query strings on purpose (`deploy/nginx/khemperfumes.bootstrap.conf`), so search terms never reach the access log |
| Analytics | `@vercel/analytics` was removed in the VPS migration. Nothing else is installed |

So this is built from scratch. Nothing existing is replaced.

## Skills read

- `AGENTS.md`: Server/Client boundaries, Zod at the edges, luxury admin
  styling, `revalidate.ts` rule (not relevant: the admin is `force-dynamic`).
- `.agents/skills/supabase/SKILL.md`: RLS on every table in `public`; no
  `SECURITY DEFINER` unless needed; revoke by name; verify with queries; reload
  the PostgREST cache.
- `node_modules/next/dist/docs/` on `after()` (self-hosting guide: pending
  `after()` work drains on SIGTERM, and PM2 `kill_timeout` is 30 s).

## Existing code inspected

- `src/app/[locale]/search/page.tsx`: the **committed** search. It is reached by
  Enter in the overlay, the popular-search chips, and shared links. It calls
  `searchCatalog(locale, query, { limit: RESULTS_LIMIT })` and knows `products.length`.
  `mode` is returned but not read yet. It has a `loading.tsx`, so a `<Link>`
  prefetch renders only the loading boundary and never runs this page body.
- `src/app/api/search/route.ts`: the overlay's **as-you-type** suggestions,
  debounced. It runs on every typing pause, so logging it would record fragments
  ("o", "ou", "oud") rather than searches.
- `src/services/search.ts`: `SearchResult { products, mode: "hybrid" | "lexical" }`.
- `src/lib/search/text.ts`: `normalizeQuery()` (trims, collapses spaces, caps at
  `MAX_QUERY_LENGTH` = 120), `isSearchable()` (at least 2 characters), `fold()`.
- `src/lib/search/config.ts`: `RESULTS_LIMIT` = 48.
- `src/app/[locale]/admin/analytics/page.tsx` and `src/services/admin/analytics.ts`:
  the pattern to follow. `SALES_RANGES = [7, 30, 90]`, `parseRange()`,
  `<RangeTabs>`, `AdminPageHeader`/`AdminTable`/`AdminEmpty`, and `supabase.rpc`
  to service-role-only SQL functions.
- `src/app/[locale]/admin/layout.tsx`: the admin guard (`notFound()` for
  non-admins). `src/components/admin/AdminShell.tsx`: the nav groups.
- `src/app/api/cron/*/route.ts`: the bearer-token cron pattern, and
  `deploy/cron/khem.crontab`.
- `supabase/README.md`, "Migrations applied out of order": `db:migrate` would
  also run the gated `0072b`.

## Decisions

1. **Only committed searches are logged:** the `/search` results page. Overlay
   suggestions are not logged (fragments, and several requests per search). One
   limitation: a visitor who types in the overlay and clicks a suggestion
   directly never reaches `/search`, so that search isn't counted. This is
   stated on the admin page.
2. **The write happens in `after()`**, once the page has been sent. Logging can
   never slow down or break a search; a failure only logs a warning.
3. **"Language" means the page locale** (`en` or `ar`), the language the
   visitor was browsing in. The query's own script isn't classified.
4. **What is stored:**
   - the query exactly as `normalizeQuery()` returns it, plus `query_key` =
     `fold(query)`, so "Oud", "OUD" and "oud" group together
   - `locale`
   - `result_count`, 0–48, capped at `RESULTS_LIMIT` (shown as "48+")
   - `mode`
   - `searched_at`

   **No user ID, IP, user agent, session, cookie or referrer.**
5. **Queries that look like personal data are not stored at all:** anything
   containing an email-like `x@y.z`, or a run of 7 or more digits (phone
   numbers, card or ID numbers). The search still works; it just isn't recorded.
6. **Obvious automation is skipped:** a user agent matching
   `bot|crawl|spider|slurp|preview|headless|monitor|curl|wget|python|http-client`,
   and requests carrying `Next-Router-Prefetch`. The user agent is only checked
   in memory, never stored.
7. **Retention:** an SQL function `purge_search_events(keep_days int default 90)`.
   A new cron route `/api/cron/purge-search-events` runs it daily at 04:00 UTC,
   with the same bearer-token pattern and `flock` line as the other four jobs.
   The route needs no new code path: it calls the function and returns
   `{ deleted: n }`.
8. **Reporting is done in SQL**, so the admin page receives aggregates, not raw
   rows. All three functions are restricted to service-role:
   - `search_top_queries(days, lim)`
   - `search_zero_result_queries(days, lim)`
   - `search_totals(days)`

   Recent searches are a plain `select … order by searched_at desc limit 50`
   through the admin client.
9. **Migration `0074_search_events.sql` is applied directly** with
   `psql --single-transaction` plus `notify pgrst`, exactly like `0073`, because
   `db:migrate` would also run `0072b`. It is idempotent, and gets added to the
   README's out-of-order list.

## Data model (`0074_search_events.sql`)

```sql
create table if not exists public.search_events (
  id            bigint generated always as identity primary key,
  query         text        not null check (char_length(query) between 2 and 120),
  query_key     text        not null check (char_length(query_key) between 1 and 120),
  locale        text        not null check (locale in ('en', 'ar')),
  result_count  integer     not null check (result_count between 0 and 48),
  mode          text        not null check (mode in ('hybrid', 'lexical')),
  searched_at   timestamptz not null default now()
);
create index if not exists search_events_searched_at_idx on public.search_events (searched_at desc);
create index if not exists search_events_key_time_idx   on public.search_events (query_key, searched_at desc);

alter table public.search_events enable row level security;   -- no policies
revoke all on public.search_events from anon, authenticated;
grant select, insert, delete on public.search_events to service_role;
```

Functions:
- `language sql stable security invoker set search_path = ''`, except the purge,
  which is `volatile`
- `revoke execute … from public, anon, authenticated`, then
  `grant execute … to service_role`
- `days` limited to 1–90 and `lim` to 1–100 inside each function

Each reporting function returns:

| Function | Returns |
| :--- | :--- |
| `search_top_queries` | `query` (the most recent spelling for that `query_key`), `searches`, `avg_results`, `zero_result_share`, `last_searched_at`, `locales` |
| `search_zero_result_queries` | `query`, `searches`, `last_searched_at`, `locales`. Only groups where every search returned 0 |
| `search_totals` | `searches`, `distinct_queries`, `zero_result_searches`, `hybrid_share`, `ar_share` |

## Files likely to change

| File | Change |
| :--- | :--- |
| `supabase/sql/0074_search_events.sql` (new) | Table, indexes, RLS, grants, four functions |
| `src/services/search-log.ts` (new, `server-only`) | `recordSearch({ query, locale, resultCount, mode })`: Zod-validated, PII and length gate, `fold()` for the key, inserts through `getSupabaseAdmin()`, never throws |
| `src/lib/search/privacy.ts` (new, pure) | `looksPersonal(query)` and `isAutomatedAgent(ua)`. Pure functions so they can be unit-tested |
| `src/app/[locale]/search/page.tsx` | Read `mode` too. When `isSearchable(query)` and the request isn't a prefetch or a bot, `after(() => recordSearch(…))` |
| `src/services/admin/search-insights.ts` (new) | `getSearchTotals`, `getTopSearches`, `getZeroResultSearches`, `getRecentSearches`, reusing `parseRange`/`SALES_RANGES` |
| `src/app/[locale]/admin/search/page.tsx` (new) | The report (layout below) |
| `src/components/admin/AdminShell.tsx` | Nav entry "Search", with the Lucide `Search` icon, in the Analytics group after "Analytics" |
| `src/app/api/cron/purge-search-events/route.ts` (new) | Bearer-token check (copied pattern), `rpc("purge_search_events")`, `{ deleted }` |
| `deploy/cron/khem-cron.sh` | Accept the `purge-search-events` job name |
| `deploy/cron/khem.crontab` | `0 4 * * *  flock -n /tmp/khem-search-purge.lock $CRON purge-search-events >> $LOG 2>&1` |
| `src/docs/hostinger-vps.md`, `supabase/README.md` | The fifth cron job; `0074` added to the out-of-order list; the search tables in the layout table |

## Admin page: `/admin/search`

Built like `/admin/analytics`: the same shell, `AdminPageHeader`, `RangeTabs`
(7 / 30 / 90 days, default 30) and table components, so it matches the existing
admin exactly. Obsidian ground, Cinzel headings, gold accents, Inter for tables.
No new styling primitives.

1. **Header:** "Search", with the subtitle "What visitors look for. Committed
   searches only, no personal data, kept 90 days."
2. **Four stat tiles,** in the same style as the analytics totals:
   - Searches
   - Distinct queries
   - No-result rate (%)
   - Semantic share (% `hybrid`)

   The Arabic share appears as the caption under Searches.
3. **Top searches** (up to 20): query (`dir="auto"`, so Arabic reads right to
   left), searches, average results (0–48, shown as "48+" at the cap), no-result
   share, languages (EN/AR badges), last searched.
4. **Searches with no results** (up to 20): query, searches, languages, last
   searched. This is the list most worth acting on: it shows products or
   synonyms the catalogue is missing.
5. **Recent searches** (last 50): time, query, language, results, mode badge
   (Semantic or Keyword).

Empty states use `AdminEmpty`, for example "No searches recorded in the last
30 days." Times are formatted the way the other admin tables format them.
Responsive: the tables scroll horizontally inside their panels on phones, and
the tiles go from 4 columns to 2.

## Security requirements

- No identity stored, as listed in decision 4. Verified by inspecting the
  table's columns.
- Queries that look personal are never written (decision 5), and this is
  unit-tested.
- RLS on and no policies. `anon` and `authenticated` are revoked by name on the
  table and on every function. Only the service role reads or writes. A
  rejected PostgREST read with the publishable key proves it.
- The insert path validates with Zod: length 2–120, locale enum, count 0–48,
  mode enum.
- The cron route checks the token in constant time, as the existing routes do.
  It answers 401 without the token.
- `/admin/search` sits under the existing admin guard: `notFound()` for
  non-admins, verified signed out.
- `'use client'` only where the existing admin components already use it. Data
  loading stays in Server Components.

## Acceptance criteria

1. A search on `/search?q=oud` in a browser creates exactly **one** row, with the
   right `locale`, `result_count` and `mode`.
2. Typing in the overlay without pressing Enter creates **no** rows. A `curl`
   request and a prefetch create none either.
3. `/search?q=my email a@b.com` and a 10-digit number create **no** row, and the
   page still renders.
4. Rows for "Oud" and "oud" group into one entry under Top searches.
5. A query with 0 results appears under "Searches with no results".
6. `/admin/search` renders all sections and empty states for 7, 30 and 90 days.
   A non-admin gets 404.
7. `purge_search_events()` deletes only rows older than 90 days. Tested in a
   rolled-back transaction with back-dated rows.
8. The cron route returns 200 `{ deleted }` with the token and 401 without it.
   It is installed in the crontab and shows in `cron.log`.
9. Reading `search_events` with the publishable key is refused.
10. `npx tsc --noEmit`, `npm run lint`, `npm run build` pass. `db:verify` is
    unchanged (52/54, the existing gaps).

## Checks to run

```
psql … --single-transaction -f supabase/sql/0074_search_events.sql -c "notify pgrst, 'reload schema'"
npx tsc --noEmit && npm run lint && npm run build
npm run db:verify
# then deploy, install the crontab, run the new job once by hand
```

## Manual test steps for the owner

1. Open `https://khemperfumes.com`, search "oud" and press Enter. Then search
   something absurd, like "zzqx". Then open `/ar`, search "عود" and press Enter.
2. Open `/admin/search`. "oud" appears under Top searches and Recent, "zzqx"
   under "Searches with no results", and "عود" with an AR badge.
3. Type in the search overlay without pressing Enter, then reload
   `/admin/search`. Nothing new appears.
4. Switch between 7, 30 and 90 days. The figures change consistently.
5. Signed out, `/admin/search` shows the 404 page.
