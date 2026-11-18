# Arabic search fix: Arabic-aware keyword matching, a recalibrated meaning cut-off, and a bilingual notes glossary

## Goal

A single Arabic word, such as **«عود»**, **«عنبر»** or **«ورد»**, must find the
fragrances that contain it, on both `/ar` and `/`. Today «عود» returns **0
results** on both. This also lays the shared ground the AI search redesign
(`prompts/ai-search-redesign.md`) builds on: a canonical **bilingual notes
glossary**, with an embedding for every note.

## Findings (measured on Frankfurt, 2026-11-18)

| # | Finding | Evidence |
| :--- | :--- | :--- |
| F1 | **Arabic keyword search never strips the article «ال».** `search_vector_ar` is built with the `simple` config (0008), which keeps tokens whole. The Arabic copy says «العود», «العنبر», «الورد», so a bare «عود» cannot match | `plainto_tsquery('simple','عود')`: **0** keyword matches, while «عود» appears as a substring in 3 products. «ورد»: 0 matches, 18 occurrences |
| F2 | **The meaning cut-off is tuned for the old model.** `SIMILARITY_FLOOR = 0.28` (`src/lib/search/config.ts`, passed to `hybrid_search_products`) was set for OpenAI. Cohere scores single Arabic words lower | Best match per query: «عود» 0.242, «عنبر» 0.262, «ورد» 0.202; "oud" 0.458, "amber" 0.512, "rose" 0.395; nonsense "zzqx" 0.156 |
| F3 | **An Arabic query on the English page uses the English keyword index.** The keyword pass picks the index by *page* locale | «عود» on `/` searches `search_vector`, which holds no Arabic |
| F4 | **Arabic note names are incomplete and live only inside each product.** 14 of the 15 products that carry notes have `*_ar` arrays, paired by position with the English ones. 82 distinct English notes exist, but there is no shared list, so «عود» has no canonical link to "Oud", "Black Oud" or "Smoked Oud" | `topNotes[i]` ↔ `topNotes_ar[i]`, for example Kyphi `Burnt Wood` ↔ «الخشب المحروق» |

## Skills read

`AGENTS.md`; `.agents/skills/supabase/SKILL.md` (RLS, revoke by name, verify,
reload PostgREST); `.agents/skills/ai-sdk` (gateway `embed`/`embedMany`,
already in use).

## Decisions

1. **Arabic normalisation in SQL:** `public.ar_fold(text)`, an `immutable`
   function so it can be used in a generated column. It:
   - strips tashkeel (U+064B–U+0652, U+0670) and tatweel (U+0640)
   - unifies alef forms «أ إ آ ٱ» → «ا», «ى» → «ي», «ة» → «ه»
   - strips a leading «ال», plus the clitics «و ف ب ك» + «ال», and «لل» → «ل»,
     from each word

   It is applied to **both** sides: the index (`search_vector_ar` is rebuilt
   from `ar_fold(...)`) and the query inside `hybrid_search_products`. A
   generated column's expression can't be altered, so the column and its GIN
   index are dropped and re-added. That takes milliseconds at 28 rows.
2. **The keyword index is chosen by the query's script, not only the page.** If
   the query contains Arabic letters, the Arabic index is used even on `/`
   (fixes F3). Everything else is unchanged.
3. **The meaning cut-off is set from an evaluation, not guessed.** A new script,
   `scripts/search-eval.ts`, runs a labelled set of about 30 queries (EN and AR:
   notes, moods, misspellings, nonsense) at floors from 0.16 to 0.30. It reports
   recall@6 and how many nonsense queries return anything. The chosen value is
   expected to be **about 0.20**: the lowest floor where every nonsense query
   still returns nothing. The table goes in the commit. Then
   `SIMILARITY_FLOOR` and the SQL default are updated together.
4. **The notes glossary:** a new `public.fragrance_notes` table with
   - `name_en` (unique, as products spell it)
   - `name_ar`
   - `aliases_ar text[]`, for example «عود» for "Black Oud"
   - `embedding vector(1536)`

   It is seeded from the **brand's own pairs** (each product's `x[i]` ↔
   `x_ar[i]`), so existing Arabic copy wins. **Only the notes with no pair get a
   drafted Arabic name, and those drafts are shown to the owner for approval
   before being written** (see checkpoint below). It is readable by
   `anon`/`authenticated` (it is catalogue copy, like the notes themselves), and
   writable only by the service role.
5. **Backfill missing per-product Arabic notes** from the glossary, only where a
   product's `*_ar` array is empty. Existing Arabic copy is never overwritten.
6. **Note embeddings:** `npm run embed` also fills `fragrance_notes.embedding`,
   embedding "Oud" and «عود» together as one document. `--check` reports notes
   with no vector and notes with no Arabic name. Notes that later appear on a
   product are inserted into the glossary automatically by the script, with
   `name_ar` null until someone names them. That makes the glossary
   self-maintaining.
7. **Migration `0075_arabic_search.sql`** is applied directly with
   `psql --single-transaction` and `notify pgrst`, like 0073/0074 (the gated
   `0072b` stays unrun), and added to the README's out-of-order list.

## ⏸ Owner checkpoint during implementation

After seeding from product pairs, Claude prints the **notes that still have no
Arabic name, with drafted translations**, as a short table (expected: a few of
the 82). Nothing is written to them until the owner approves or edits the list.

## Files likely to change

| File | Change |
| :--- | :--- |
| `supabase/sql/0075_arabic_search.sql` (new) | `ar_fold()`; rebuild `search_vector_ar` and its index; `hybrid_search_products` (script-aware index, folded query, default floor); `fragrance_notes` + RLS + grants; seed from product pairs |
| `src/lib/search/config.ts` | `SIMILARITY_FLOOR` set to the evaluated value, with the evaluation table in the comment |
| `scripts/embed-catalog.ts` | Third target: `fragrance_notes`; auto-insert unseen notes; `--check` also reports missing Arabic names |
| `scripts/search-eval.ts` (new) + `package.json` `search:eval` | The labelled evaluation |
| `scripts/ar-fold.test.ts` (new) | Unit cases for the normaliser (SQL called through the DB client) |
| `supabase/README.md` | `0075` in the out-of-order list; the glossary |

## Security requirements

- `ar_fold`: `immutable`, `security invoker`, `set search_path = ''`, no table
  access.
- `fragrance_notes`: RLS on, a `select` policy for `anon`/`authenticated`
  (public catalogue copy), writes revoked by name, service role only.
- `hybrid_search_products` keeps its existing grants and signature, so no client
  change is needed.
- `db:verify` unchanged (52/54).

## Acceptance criteria

1. On `/ar` **and** `/`: «عود», «عنبر», «ورد», «ياسمين» and «بخور» each return
   at least one correct fragrance. "oud", "amber" and "rose" still return what
   they do today.
2. «العود» and «عود» return the same top results, and so do «بالعنبر» and
   «عنبر».
3. Nonsense ("zzqx", «ققق») returns 0 results at the chosen floor.
4. `npm run search:eval` prints the floor table, and the chosen floor beats
   0.28 on recall without letting nonsense through.
5. Every one of the 82 notes has `name_ar` (after owner approval) and an
   embedding. `embed -- --check` is clean.
6. No product's existing Arabic copy changes, except empty `*_ar` arrays now
   filled.
7. `tsc`, `lint` and `build` pass. `db:verify` is unchanged.

## Manual test steps for the owner

1. On `https://khemperfumes.com/ar`, search «عود», «عنبر» and «ورد». Each finds
   fragrances.
2. On the English site, search «عود». It finds the same fragrances.
3. Open `/admin/search`. The Arabic searches now show results greater than 0.
