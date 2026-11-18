-- KHEM — search tracking (prompts/search-tracking.md).
--
-- One row per *committed* storefront search: the `/search` results page, not
-- the overlay's as-you-type suggestions. Written by `src/services/search-log.ts`
-- after the response has been sent.
--
-- ## Anonymous by construction
--
-- The table has no column that could identify a visitor: no user id, IP, user
-- agent, session, cookie or referrer. Queries that look like personal data
-- (an email address, a run of 7+ digits) are never written in the first place
-- (`src/lib/search/privacy.ts`).
--
-- ## Retention
--
-- 90 days. `purge_search_events()` deletes older rows and is called daily by
-- `/api/cron/purge-search-events` (deploy/cron/khem.crontab, 04:00 UTC).
--
-- ## Access
--
-- RLS on, no policies, the public roles revoked by name on the table and on
-- every function. Only the service role (the admin client) reads or writes —
-- the same posture as the finance tables in 0063.
--
-- Idempotent. Applied directly with psql rather than `npm run db:migrate`,
-- which would also run the still-gated 0072b (supabase/README.md,
-- "Migrations applied out of order").

create table if not exists public.search_events (
  id            bigint generated always as identity primary key,
  -- As `normalizeQuery()` returns it: trimmed, spaces collapsed, ≤ 120.
  query         text        not null check (char_length(query) between 2 and 120),
  -- `fold(query)`: lower-case, diacritics stripped. What the reports group by,
  -- so "Oud", "OUD" and "oud" are one search.
  query_key     text        not null check (char_length(query_key) between 1 and 120),
  -- The page locale the visitor was browsing in.
  locale        text        not null check (locale in ('en', 'ar')),
  -- Products returned, capped at RESULTS_LIMIT (48) — the page never fetches more.
  result_count  integer     not null check (result_count between 0 and 48),
  mode          text        not null check (mode in ('hybrid', 'lexical')),
  searched_at   timestamptz not null default now()
);

create index if not exists search_events_searched_at_idx
  on public.search_events (searched_at desc);
create index if not exists search_events_key_time_idx
  on public.search_events (query_key, searched_at desc);

alter table public.search_events enable row level security;

revoke all on public.search_events from public, anon, authenticated;
grant select, insert, delete on public.search_events to service_role;

-- ── Reports ─────────────────────────────────────────────────

-- Window totals for the stat tiles.
create or replace function public.search_totals(days int)
returns table (
  searches             bigint,
  distinct_queries     bigint,
  zero_result_searches bigint,
  hybrid_share         numeric,
  ar_share             numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with w as (
    select *
      from public.search_events
     where searched_at >= now() - make_interval(days => least(greatest(days, 1), 90))
  )
  select
    count(*)                                              as searches,
    count(distinct query_key)                             as distinct_queries,
    count(*) filter (where result_count = 0)              as zero_result_searches,
    coalesce(round(avg((mode = 'hybrid')::int), 4), 0)    as hybrid_share,
    coalesce(round(avg((locale = 'ar')::int), 4), 0)      as ar_share
  from w;
$$;

-- Most frequent queries in the window, grouped case- and accent-insensitively.
-- `query` is the most recent spelling a visitor used for that group.
create or replace function public.search_top_queries(days int, lim int)
returns table (
  query             text,
  searches          bigint,
  avg_results       numeric,
  zero_result_share numeric,
  last_searched_at  timestamptz,
  locales           text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (array_agg(e.query order by e.searched_at desc))[1]          as query,
    count(*)                                                      as searches,
    round(avg(e.result_count), 1)                                 as avg_results,
    round(avg((e.result_count = 0)::int), 4)                      as zero_result_share,
    max(e.searched_at)                                            as last_searched_at,
    array_agg(distinct e.locale order by e.locale)                as locales
  from public.search_events e
  where e.searched_at >= now() - make_interval(days => least(greatest(days, 1), 90))
  group by e.query_key
  order by count(*) desc, max(e.searched_at) desc
  limit least(greatest(lim, 1), 100);
$$;

-- Queries that never found anything in the window: every search in the group
-- returned zero products. The list most worth acting on.
create or replace function public.search_zero_result_queries(days int, lim int)
returns table (
  query            text,
  searches         bigint,
  last_searched_at timestamptz,
  locales          text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (array_agg(e.query order by e.searched_at desc))[1]   as query,
    count(*)                                               as searches,
    max(e.searched_at)                                     as last_searched_at,
    array_agg(distinct e.locale order by e.locale)         as locales
  from public.search_events e
  where e.searched_at >= now() - make_interval(days => least(greatest(days, 1), 90))
  group by e.query_key
  having max(e.result_count) = 0
  order by count(*) desc, max(e.searched_at) desc
  limit least(greatest(lim, 1), 100);
$$;

-- ── Retention ───────────────────────────────────────────────

-- Delete rows older than `keep_days` (default 90, never less than 1). Returns
-- how many were deleted.
create or replace function public.purge_search_events(keep_days int default 90)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  deleted integer;
begin
  delete from public.search_events
   where searched_at < now() - make_interval(days => greatest(keep_days, 1));
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke execute on function public.search_totals(int)                   from public, anon, authenticated;
revoke execute on function public.search_top_queries(int, int)         from public, anon, authenticated;
revoke execute on function public.search_zero_result_queries(int, int) from public, anon, authenticated;
revoke execute on function public.purge_search_events(int)             from public, anon, authenticated;

grant execute on function public.search_totals(int)                   to service_role;
grant execute on function public.search_top_queries(int, int)         to service_role;
grant execute on function public.search_zero_result_queries(int, int) to service_role;
grant execute on function public.purge_search_events(int)             to service_role;
