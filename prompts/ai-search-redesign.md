# AI search redesign: describe a scent, see why it matched

**Depends on `prompts/arabic-search-fix.md`.** It needs that prompt's
`fragrance_notes` glossary and note embeddings, and its recalibrated cut-off.
Build that first.

## Goal

Make KHEM's search *feel* like what it already is, a meaning-based (semantic)
search, without overclaiming:

1. An input that invites natural language, "Describe the scent you're looking
   for…" / «صِف العطر الذي تبحث عنه…», with a subtle **AI-powered** badge.
2. Example chips for **mood, occasion and season**, in English and Arabic.
3. A short **"Matches: …"** line on each result, saying why it matched.
4. **Honesty:** the AI label and the explanations appear **only when the
   meaning-based pass actually ran** (`mode === "hybrid"`). On keyword
   fallback, results look normal and make no AI claims.
5. A refined loading state, a no-results state that is never a dead end, and
   correct RTL.
6. KHEM's existing design system, premium feel, fast, accessible, mobile-first.
   No gimmicks.

**Mockup:** https://claude.ai/artifact/EwnECY5asohgCp6WWBm4jF has 9 artboards:
overlay idle, overlay with AI results, results page (AI), keyword fallback,
loading, no results, and three mobile screens, including Arabic RTL. It is drawn
with real catalogue data, as measured on Frankfurt on 2026-11-18.

## Existing code inspected

- `src/components/search/SearchOverlay.tsx` (841 lines, client):
  - debounced `/api/search`, keyboard listbox, recent searches
  - `TermChips` for popular terms, `ProductRow` / `CollectionRow`
  - no-results branch, footer "Press Enter for all results"
  - placeholder "Oud, amber, something for winter…"
- `src/components/search/SearchForm.tsx`: the results page's field.
- `src/app/[locale]/search/page.tsx`: the results grid of `ProductCard`;
  `EmptyState` plus popular chips when nothing is found; the search tracking
  added in `0074`.
- `src/app/[locale]/search/loading.tsx`: the skeleton (`khem-shimmer`).
- `src/services/search.ts`: `searchCatalog()` returns
  `{ products, mode: "hybrid" | "lexical" }`; the query vector is computed in
  `semantic.ts` and never leaves the server.
- `src/lib/i18n/dictionaries/{en,ar}.ts` → `search.*`, `popularTerms`.
- Design tokens (`src/app/globals.css`):
  - grounds: the **ivory** ground (`#f7f5f0`), stone `#efebe4`
  - text: ink `#242321`, ink-muted `#625f58`
  - accents: gold `#b08d57`, gold-deep `#8a6a3f` (gold text on light grounds)
  - border-light `#d8d3ca`
  - motion: `ease-luxury-bezier`
  - fonts: Cinzel/Inter for English, Amiri/IBM Plex Sans Arabic for Arabic

## Visual interpretation (as the mockup shows it)

- **Input:**
  - the same large Cinzel field as today, with a new placeholder
  - in place of the field's left edge, a 1 px gold hairline appears while
    focused
  - at the field's trailing end, a small outlined **AI-POWERED** pill
    (gold-deep, 9 px Inter caps, 0.2em tracking, one hairline 4-point star in
    stroke)
  - no gradients, no glow, no animation on the badge
- **Example chips:** three labelled groups, *Mood · Occasion · Season*. Each is
  a natural-language phrase in a hairline-bordered chip: "warm smoky evening",
  "fresh summer day", "a rich scent for a wedding night"… Arabic has its own
  phrases (not translations of chip labels into English search terms), because
  Arabic queries now work. Tapping a chip fills the field and searches.
- **Results header:** "Ranked by meaning" with the AI-powered mark, beside the
  count, only when the search was semantic.
- **"Matches:" line:**
  - **On a result card:** under the collection line, Inter 11 px, ink-muted. A
    gold-deep label, then up to 3 **notes this product really has**, joined by
    middots, in the visitor's language: "Matches · Smoked Incense · Black Oud ·
    Amber".
  - **In overlay rows:** the same line, condensed to 2 notes.
- **Refine your description** (hybrid mode only): three curated suffix chips
  under the results ("…with oud", "…lighter, for daytime", "…for a gift"). Each
  appends to the current query and searches again.
- **"How this works"** (desktop overlay, hybrid mode only): two sentences, in
  plain words, on how meaning-based ranking and the "Matches" lines work.
- **Keyword fallback:** the identical layout without the badge, header mark and
  "Matches" lines. A plain count only.
- **Loading:**
  - a 1 px gold line slides under the field (shimmer sweep; static under
    `prefers-reduced-motion`)
  - a caption: "Reading your description…" for queries of 3+ words, otherwise
    "Searching"
  - the existing skeleton rows and cards
- **No results:**
  - "Nothing in the collection matches "…" yet"
  - "Try describing it differently", with three rephrase chips from the same
    curated set
  - "Or begin with a collection": the three collections as quiet cards
  - "House favourites": up to 4 bestsellers, plainly labelled, never called
    "similar"

  It is never a dead end.
- **RTL:**
  - the entire layout mirrors (`dir="rtl"`, logical properties only)
  - the badge text is «بالذكاء الاصطناعي» and the matches label is «يطابق»
  - Arabic notes come from the glossary
  - visitor-typed text keeps `dir="auto"`
- **Mobile:**
  - the overlay is a full-screen sheet; chip groups scroll horizontally in one
    row each
  - 44 px minimum tap targets
  - result rows put the "Matches" line under the name and wrap to 2 lines at most

## Decisions

1. **How "why it matched" is computed, honestly.** For each result, a single SQL
   call (`search_match_notes(query_embedding, product_ids, locale, per_product,
   floor)`) compares the query vector with the **embeddings of that product's own
   notes**, taken from `fragrance_notes`. It returns up to 3 notes above a note
   floor, nearest first, plus any note the query names literally. We only ever
   claim notes the bottle contains, never mood words the product doesn't have.
   If no note clears the floor, that card shows **no** "Matches" line rather
   than a weak one. The note floor is calibrated with `search:eval`.
2. **Where the AI label appears.**
   - The idle badge appears only when semantic search is configured on the
     server (`hasEmbeddingCredentials()`, passed down as a boolean).
   - Results get the label and the "Matches" lines only when `mode ===
     "hybrid"` *for that query*. A keyword fallback, a provider timeout or a
     missing key all render plain.
3. **The data contract.**
   - `searchCatalog()` gains optional `reasons: Record<productId, string[]>`,
     filled only in hybrid mode.
   - The overlay payload (`SearchSuggestionsPayload`) gets the same field.
   - The query vector itself still never leaves the server.
   - `ProductCard` gains an optional `matchNotes?: string[]` prop. Every other
     use of the card is unchanged.
4. **Chips** are curated dictionary copy (`search.examples.mood|occasion|season`,
   EN and AR), editable like all copy. The old `popularTerms` stays for keyword
   fallback contexts.
5. **Performance.**
   - One extra RPC per hybrid search, issued after the main search: about 1–2 ms
     to Frankfurt.
   - The overlay's debounce is unchanged.
   - No new client dependencies, and the bundle grows only by the new copy.
6. **Accessibility.**
   - The badge is real text, with `aria-describedby` on the input explaining
     "Understands descriptions as well as names".
   - The results `aria-live` message adds "ranked by meaning" only in hybrid
     mode.
   - Chips are `<button>`s in a labelled group.
   - Contrast: ink-muted and gold-deep on ivory both clear 4.5:1.
   - Reduced motion is respected.
7. **Search tracking (`0074`)** is unchanged. It still records the mode.

## Files likely to change

| File | Change |
| :--- | :--- |
| `supabase/sql/0076_search_match_notes.sql` (new) | `search_match_notes(...)`: `stable`, `security invoker`, granted like `hybrid_search_products` |
| `src/services/search.ts` | Return `reasons` in hybrid mode (keeps the vector server-side) |
| `src/types/search.ts` | `reasons?` on `SearchResult` and `SearchSuggestionsPayload`; `matchNotes` on the suggestion |
| `src/app/api/search/route.ts` | Pass reasons through |
| `src/components/search/SearchOverlay.tsx` | Placeholder, badge, chip groups, reasons in rows, gold loading line and caption, richer no-results |
| `src/components/search/SearchForm.tsx` | Placeholder and badge |
| `src/components/search/AiBadge.tsx` (new, server-safe) | The pill, EN and AR |
| `src/components/search/ExampleChips.tsx` (new, client) | Grouped chips |
| `src/components/search/MatchLine.tsx` (new) | "Matches · a · b · c" |
| `src/components/search/SearchNoResults.tsx` (new) | Rephrase chips, collections, house favourites |
| `src/components/ecommerce/ProductCard.tsx` | Optional `matchNotes` |
| `src/app/[locale]/search/page.tsx`, `loading.tsx` | Header mark, reasons, the new empty state, caption |
| `src/app/[locale]/layout.tsx` (or the Nav) | Pass `semanticAvailable` to the overlay |
| `src/lib/i18n/dictionaries/en.ts`, `ar.ts` | New `search.*` copy and example chips |

## Security requirements

- No new public data: notes are catalogue copy that is already public. The
  query vector stays server-side.
- The new SQL function only reads `Product` (live rows) and `fragrance_notes`.
  No `SECURITY DEFINER`.
- Visitor text is rendered as text (never HTML), with `dir="auto"`.

## Acceptance criteria

1. "warm smoky evening" (EN) and «عطر دافئ للمساء» (AR): the results show the AI
   mark, and each card with a qualifying note shows "Matches …" with notes the
   product really has, in the page language.
2. Force keyword mode (no `AI_GATEWAY_API_KEY`, in a test env): the identical
   page with **no** badge, **no** header mark and **no** "Matches" line anywhere.
3. Loading shows the gold line and caption; under reduced motion it shows no
   motion.
4. A query with no results shows rephrase chips, the three collections and the
   house favourites. Every element is a working link or button.
5. `/ar`: full RTL, with no physical left/right classes in the new code (grep
   check).
6. Keyboard: Tab reaches chips; arrow keys and Enter still work in the overlay
   listbox; Escape closes. Screen-reader announcement includes "ranked by
   meaning" in hybrid mode only.
7. Lighthouse on `/search?q=oud`, mobile: performance not worse than before,
   accessibility at least 95.
8. `tsc`, `lint` and `build` pass. `/api/search` p95 stays under 600 ms.

## Manual test steps for the owner

1. Open search: see the new placeholder, the AI-powered badge and the chips. Tap
   "warm smoky evening".
2. Each card says *Matches · …* with real notes. Switch to `/ar` and tap
   «عطر دافئ للمساء»: the same in Arabic, right to left.
3. Search "zzqx": the no-results state offers rephrasings, collections and
   favourites.
4. On a phone, check the sheet, chip rows, tap targets and that the matches
   lines wrap cleanly.
