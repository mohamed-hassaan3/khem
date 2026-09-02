# Content & AI-Writing Artifact Audit

Source brief: `src/docs/APP-WIDE-CONTENT-AI-WRITING-ARTIFACT-AUDIT.md`

---

## Goal

Remove visible AI-writing artifacts and improve clarity across all customer-facing
copy, without rewriting content that is already good and without touching the
KHEM brand voice.

**The audit has already been run.** This prompt records what was actually found,
which is materially different from what the brief assumed. The implementation
below is scoped to the real defects, not to the hypothetical ones.

---

## Skills read

- `AGENTS.md` (§2 workflow, §2.2 voice, §5 prompt files, §12 checklist)
- No external skill applies. This is a copy and localization task: no AI SDK
  call, no Vercel platform surface, no schema change.

## Existing code inspected

Content surfaces enumerated and measured:

| Surface | Where it lives | Editable by |
| :-- | :-- | :-- |
| UI copy, metadata, errors, empty states, forms | `src/lib/i18n/dictionaries/{en,ar}.ts` | code only |
| Products, collections | Supabase `Product`, `Collection` | admin dashboard |
| Ingredients, articles, testimonials, timeline, craft blocks | Supabase `Ingredient`, `Article`, … | admin dashboard |
| Legal documents, stockists, contact channels | Supabase `LegalDocument`, … | admin dashboard |
| Transactional & campaign email | `src/lib/email/{copy,order-copy,welcome-copy,campaign-copy}.ts` | code only |
| Journal article bodies | Supabase `Article.body`, parsed by `src/lib/journal/body.ts` | admin dashboard |

`supabase/seed/*.json` is a **generated export**, not the source of truth —
`scripts/db-seed.ts` header states this explicitly. Editing the JSON changes
nothing on the site until it is loaded back.

---

## What the audit actually found

Scans were run over every leaf string in both dictionaries (1,021 EN / 1,017 AR)
and every prose field in the three seed exports (920 EN-side / 607 AR-side).

### The brief's specific artifact list: essentially absent

| Artifact | Dictionaries | Database content |
| :-- | :-- | :-- |
| `__` in customer text | 0 | 0 |
| `---` | 0 | 0 |
| `***` | 0 | 0 |
| `**bold**` | 0 | 0 |
| Markdown bullets / backticks / links | 0 | 0 |
| Placeholder formatting | 0 | 0 |
| Internal terminology leaked | 0 | 0 |

The two "internal terminology" regex hits (`account.notifications.emptyBody`,
`account.preferences.marketing.transactional`) both use *dispatch* as an ordinary
shipping noun. They are correct English and must not be changed.

The six `*emphasis*` occurrences in `Article.body` are the documented house
convention for botanical binomials and foreign terms (*Aquilaria*, *Crocus
sativus*, *oudh*). `parseInline()` renders them as `<em>` text nodes — no
asterisk ever reaches the screen. **Legitimate. Do not remove.**

### Generic-luxury wording: 7 occurrences in 920 strings

`not just` ×1, `whether you` ×1, `curated` ×1, `timeless` ×1, `journey` ×3.
Two of them (`catalog.collections[0].description`,
`catalog.collections[5].description`) carry two tells each and are the only
genuinely generic paragraphs in the catalog.

### The one real pattern: em-dash density — 183 occurrences

| | EN | AR |
| :-- | --: | --: |
| Dictionaries | 70 across 67 strings | 65 |
| Database content | 113 across 80 strings | 65 |

Strings carrying **two** em dashes — the parenthetical-appositive construction
that reads most strongly as machine-written — number 3 in the dictionary and 17
in database content.

This is the finding that justifies the workstream. Everything else in the brief
is already clean.

### Two defects found in passing, both in scope

1. **The Arabic 404 page is broken.** `src/lib/i18n/dictionaries/ar.ts:1595`
   reads `notFound: undefined!,` — a non-null assertion suppressing a missing
   translation. It is the only key in either tree that does this.
2. **The 404 page ignores the dictionary entirely.**
   `src/app/[locale]/not-found.tsx` hardcodes English: "Page Not Found",
   "The page you are seeking has slipped beyond our grasp — like perfume
   dispersing into warm air.", "Return Home", "Explore Collections". An Arabic
   visitor sees English. The `en.notFound` keys exist and are unused.

---

## Decisions and assumptions

1. **This is not a rewrite.** The prose is well written and specific — real
   detail about Edfu, Hojari grading, formula revision 214. The brief's closing
   instruction ("Do not rewrite everything unnecessarily. Preserve good existing
   content.") governs. Default action on any paragraph is **leave it alone**.
2. **Em dashes are reduced by surface, not globally.** A dash earns its place in
   editorial writing and does not in a form hint or an error message. Split:
   - **Functional copy** (errors, empty states, form hints, confirmations,
     checkout, cart, account, buttons, metadata descriptions) → remove or
     replace the dash where it is decorative. Target: near zero.
   - **Editorial copy** (journal bodies, heritage, craftsmanship, product
     stories) → per-occurrence judgment; reduce doubled-dash constructions,
     keep single dashes that carry real syntactic weight. No target number.
   - **Never** a global find-and-replace. The brief forbids it and so does this
     prompt.
3. **Arabic is reviewed separately, not mechanically mirrored.** An EN sentence
   losing its dash does not mean the AR sentence must. Arabic punctuation is
   judged on its own.
4. **Database content is edited in Supabase, not in the JSON.** See workflow
   below. This is the single most likely way to get this task wrong.
5. **Product names, SKUs, slugs, prices, volumes, note lists and concentrations
   are out of scope** and must not be touched.
6. **Structured metadata** (`title`, `description`, `ogTitle`, `ogDescription`)
   may be edited for wording but keeps its length discipline and its keywords.

---

## Files likely to change

**Code**

- `src/lib/i18n/dictionaries/en.ts` — functional-surface em dashes; `notFound` block retained
- `src/lib/i18n/dictionaries/ar.ts` — **replace `notFound: undefined!` with a real translation**; Arabic punctuation pass
- `src/app/[locale]/not-found.tsx` — read from the dictionary; accept `locale`; delete hardcoded English
- `src/lib/email/copy.ts`, `order-copy.ts`, `welcome-copy.ts`, `campaign-copy.ts` — same functional-copy rule

**Database (via admin dashboard or Supabase table editor)**

- `Collection.description` / `description_ar` — the 2 generic paragraphs
- `Product.description` / `story` (+ `_ar`) — doubled-dash constructions in rows 2, 7, 14, 18
- `Ingredient.description`, `Testimonial.quote`, `Article.body`, `LegalDocument.sections` — per-occurrence

**Export (regenerated, never hand-edited)**

- `supabase/seed/{catalog,content,directory}.json` — via `npm run db:dump`

---

## Implementation requirements

1. Fix `ar.notFound` first. It is a live defect, not a style preference.
2. Rewire `not-found.tsx` onto `getDictionary(locale)`. Note the file's existing
   header comment: `not-found.tsx` cannot export `metadata`. Keep that true.
3. Work the em dashes **one at a time**, functional surfaces before editorial.
   For each, choose the smallest edit that keeps the sentence natural: a comma,
   a full stop, a colon, or a rewritten clause. Do not swap `—` for ` - `.
4. Rewrite only the paragraphs named above under generic-luxury wording. Each
   rewrite keeps the same information and the same approximate length.
5. Every EN dictionary edit requires the matching AR key to be re-read and, if
   the meaning moved, re-translated. The `Dictionary` type enforces key parity,
   not translation accuracy.
6. No new dictionary keys unless the 404 rewiring needs them.
7. Product names, technical specifications, prices and identifiers unchanged.

## Security requirements

- No schema change, no migration, no destructive statement.
- `npm run db:seed` against a remote target requires `KHEM_SEED_CONFIRM=<host>`
  and **overwrites live rows from the frozen export**. Any content edited in the
  dashboard since the last dump would be silently reverted. Therefore:
  **run `npm run db:dump` immediately before any content editing**, so the export
  matches production before anything is written back.
- Confirm which Supabase project `SUPABASE_DB_URL` points at, out loud, before
  any write.
- No customer, order or comment data is read or written by this task.

## Acceptance criteria

- [ ] `ar.notFound` is a real Arabic translation; no `undefined!` remains in either dictionary
- [ ] `/ar/<nonexistent>` renders fully in Arabic, RTL, with no English string
- [ ] `/en/<nonexistent>` is unchanged in meaning
- [ ] Em dashes in functional copy (errors, empty states, form hints, checkout, cart, account, buttons) reduced to zero or to instances with a written justification
- [ ] Doubled-em-dash strings reduced from 3 (dict) and 17 (DB) to a documented remainder
- [ ] The 7 generic-luxury phrase hits addressed or explicitly kept with a reason
- [ ] The 6 `*emphasis*` binomials still render as italics, not asterisks
- [ ] No product name, SKU, slug, price, volume or note list changed
- [ ] `supabase/seed/*.json` regenerated by `npm run db:dump`; the git diff contains only prose changes
- [ ] EN and AR leaf-string counts still match (currently 1021 / 1017 — the gap **is** the `notFound` bug and should close to parity)

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run db:dump      # after content edits; review git diff
npm run build
```

Re-run the two audit scripts from the scratchpad to confirm the counts moved in
the intended direction.

## Manual test steps

1. `npm run dev`
2. `/en/no-such-page` and `/ar/no-such-page` — Arabic must be fully Arabic and RTL, with no `undefined`
3. `/ar` home, `/ar/collections`, `/ar/perfume/<slug>` — punctuation reads naturally right-to-left
4. Checkout with an out-of-Egypt country — read the refusal copy
5. `/cart` empty, `/account/vouchers` empty, `/account/notifications` empty — every empty state
6. Contact form: submit a 3-character message and read the validation line
7. Search with no results — read the hint
8. `/journal/<slug>` — binomials still italic, no stray asterisks
9. Place a test order and read the confirmation email in both languages
10. Repeat 2–7 at 375px width

---

## Explicitly out of scope

- Moving editorial copy into the CMS (confirmed separate future project)
- The four queued workstreams
- Admin-facing dashboard copy, except where an admin string is shown to a customer
- Any change to `parseInline()` / `body.ts` parsing rules

## Noted, not fixed

An editor typing `**bold**` into the admin article textarea would render as a
literal `*bold*` on the storefront, because `EMPHASIS` matches the inner pair and
leaves the outer asterisks as text. No stored row does this today (verified: 0
occurrences). Recording it as a known sharp edge; fixing it is a change to the
parser and belongs in its own task.

---

## Follow-up recorded for the SEO / deployment workstream

**Nonexistent routes appear to return HTTP 200 and require production
verification/fix to avoid potential soft-404 SEO issues.**

Observed on `/no-such-page`, `/ar/no-such-page` and
`/perfume/<unknown-slug>`. Confirmed **pre-existing** by re-testing with this
task's changes stashed, so it is not a regression from the 404 localization
work. In dev the server render throws `NEXT_HTTP_ERROR_FALLBACK;404` and Next
falls back to client rendering, which is the likely cause of the 200 — it may
not reproduce in a production build. Not investigated further here, deliberately:
it is a routing/SEO concern, not a content one.

Next step for whoever picks it up: `npm run build && npm start`, then
`curl -o /dev/null -w '%{http_code}' http://localhost:3000/no-such-page`. If it
is 404 there, this is a dev-only artifact and no fix is needed.

## Deferred DB content, not part of this task

`MarketingSetting` is **not** covered by `scripts/db-dump.ts`, which exports only
the catalog, editorial content and directory tables. The offer-popup copy
therefore lives solely in the database: a fresh Supabase project rebuilt from
this repository would come up with the schema defaults from
`supabase/sql/0035_marketing.sql`, not with the copy now live. Extending the
dumper to `MarketingSetting` is a small, separate change.
