# Prompt — Make `/ar` fully Arabic: localize the Supabase content layer

## Goal

The **chrome** is already bilingual. `src/lib/i18n/dictionaries/{en,ar}.ts` (1118 / 1040 lines) covers nav, eyebrows, CTAs, form labels, empty states, and metadata; `getDictionary()`, `interpolate()`, `localizePath()`, and the `[locale]` tree all work; `npx tsc --noEmit` is clean.

The **content** is not. Commit `9e312f0` moved `src/data/*` into Supabase and dropped locale-awareness on the way: `src/data/` is now empty, **not one of the 32 exported service functions takes a `locale`**, and **not one of the 19 content tables has an Arabic column**. Every product name, subtitle, description, story, note pyramid, collection description, ingredient, journal title and excerpt, testimonial, timeline entry, craft step, stockist address, contact channel, and all four legal policy bodies render as English on `/ar`.

That is why ~20 components wrap DB text in `ltrIsland()` — those wrappers exist *solely* to quarantine untranslated English, exactly as `prompts/content-layer-localization.md` predicted. That prompt was written against the old `src/data/*.ts` files and was never implemented; it is superseded by this one.

This prompt closes the gap at the database, threads `locale` through the service layer, unwraps the LTR islands, and adds Arabic authoring to the admin dashboard so the gap cannot reopen.

---

## Skills read

- `AGENTS.md` — §1 operational rules, §2 brand register (the Arabic copy must read as editorial brand copy, not machine translation), §6 architecture (thin route handlers; services own the query layer; **UI displays stored data only**), §7 directory structure, §9 schema conventions, §12 checklist.
- `.agents/skills/supabase` — migration file conventions, RLS, service-role boundaries, `db:migrate` / `db:seed` / `db:verify` pipeline.
- `prompts/internationalization-en-ar.md` — established `Dictionary`, `getDictionary()`, `interpolate()`, `ltrIsland()`, and the `as-needed` prefix strategy. Unchanged by this pass.
- `prompts/content-layer-localization.md` — **superseded.** Its decisions were made against `src/data/*.ts`; the storage decision here replaces its `LocalizedText` in-code approach. Its brand-register and non-localizable-field rules survive.
- `prompts/i18n-rtl-defects.md` — which elements are LTR islands and why.
- `prompts/supabase-data-migration.md` — the seed/verify contract this pass extends.
- `prompts/ingredient-family-taxonomy.md` — the closed `IngredientFamily` union; that constraint survives localization.
- `.agents/skills/clerk` and `.agents/skills/ai-sdk` do not apply. No auth or model change in this pass.

---

## Existing code inspected

### Data layer — the gap

| SQL file | Tables | Arabic columns today |
| :--- | :--- | ---: |
| `supabase/sql/0001_catalog.sql` | `Collection`, `Product`, `ProductImage` | 0 |
| `supabase/sql/0002_content.sql` | `Testimonial`, `IngredientFamily`, `Ingredient`, `IngredientUsage`, `Article`, `TimelineEvent`, `BrandValue`, `MissionStatement`, `CraftPillar`, `CraftStep`, `CraftStat`, `CraftQuote` | 0 |
| `supabase/sql/0003_directory.sql` | `Stockist`, `ContactChannel`, `SocialProfile`, `EnquirySubject`, `BoutiqueSetting`, `LegalDocument` | 0 |
| `supabase/sql/0004_search.sql` | generated `search_document` / `search_vector` on `Product` | English-only |

### Record volume to translate

`supabase/seed/catalog.json` — 7 collections, 28 products.
`supabase/seed/content.json` — 3 testimonials, 7 ingredient families, 8 ingredients, 6 articles, 6 timeline events, 3 brand values, 2 mission statements, 4 craft pillars, 6 craft steps, 4 craft stats, 1 craft quote.
`supabase/seed/directory.json` — 2 stockists, 4 contact channels, 3 social profiles, 7 enquiry subjects, 1 settings row, 4 legal documents (the four policy bodies are by far the largest payload).

### Service layer

32 exported async functions across `src/services/{products,content,contact,legal,stockists,settings,search,comments,account}.ts`. **None takes a locale.** Each reads through `getSupabasePublic()` with an explicit column-list constant from `src/schemas/db/*`, parses rows with Zod (`toProduct`, `toIngredient`, …), and degrades a failed query to an empty section rather than throwing. `src/services/content.ts` also exposes `ALL_FILTER = "All"` and builds filter options with `toFilterOptions()`.

### Consumers wrapping DB text in `ltrIsland()`

`src/app/[locale]/page.tsx`, `journal/page.tsx`, `contact/page.tsx`, `perfume/[slug]/page.tsx`, `stockists/page.tsx`, `heritage/page.tsx`, `about/page.tsx`, `craftsmanship/page.tsx`; `src/components/home/{CollectionCard,IngredientCard,JournalCard}.tsx`, `src/components/journal/JournalGrid.tsx`, `src/components/ecommerce/{ProductCard,ProductBreadcrumb,ProductIngredients,CartLine,CommentRow,ArrivalShowcase,WishlistCard,MerchCard}.tsx`.

### Admin write layer

`src/schemas/admin.ts` (createCollection/updateCollection/createProduct/updateProduct/createArticle/updateArticle/saveProductImages), `src/actions/admin/{catalog,journal,shared}.ts`, `src/components/admin/{ProductForm,CollectionForm,ArticleForm,ProductImageEditor,fields}.tsx`. All English-only fields.

### Structural facts that constrain the work

- **`EnquirySubject.label` is the primary key**, and `0003_directory.sql` documents that it is validated in the contact Server Action against `ENQUIRY_SUBJECTS` in `src/constants/contact.ts` because the value lands in a mail header. `npm run db:verify` fails if the two drift.
- **`Ingredient.families` is a closed union** enforced by the `assert_ingredient_families()` trigger against `IngredientFamily.name`.
- **`Product.search_document` is a stored generated column**, the SQL twin of `productEmbeddingSource()` in `src/lib/search/`. `0004_search.sql` warns that the two sides must stay in step.
- **Articles have full bodies and a detail route.** `supabase/sql/0009_journal.sql` adds `Article.body` (`not null default ''`, a markdown-ish block format parsed by `src/lib/journal/body.ts`) and a `related_articles()` pgvector function; `src/app/[locale]/journal/[slug]/` renders it. Six bodies of roughly 4 KB each — about 26 KB of editorial prose — are therefore in the translation scope, and they are the single largest payload in this pass.
  ⚠ This landed from a **concurrent session** while this prompt was being written, and corrects an earlier claim here that no article bodies existed. `Article.body_ar` is nullable rather than `not null default ''`: an untranslated essay must fall back to the English body, where `''` would render a hero with nothing under it. Arabic article *search* and Arabic article *embeddings* stay out of scope for the same reasons decision 11 gives for products.
- **`LegalDocument.sections` is `jsonb`** holding the `LegalSection[]` discriminated union from `src/types/legal.ts`, validated by Zod on read, rendered by typed components — never `dangerouslySetInnerHTML`.
- Components with no dictionary usage (`EmptyState`, `ProductStory`, `CategoryHero`, `NewArrivalHero`, `FeatureTriptych`, `LegalHero`, `AccountIdentity`, `SignInForm`, …) take all their copy as props from pages that *do* use the dictionary. **They are already correct — do not touch them.** The admin components are the genuine exception.

---

## Decisions and assumptions

These four were confirmed with the user before this prompt was written:

1. **Storage: sibling `_ar` columns.** Each translatable column `foo` gains a nullable `foo_ar` of the same type beside it. No new tables, no joins, no jsonb. Non-translatable attributes (`id`, `slug`, `sku`, URLs, enums, numbers, dates, booleans, sort orders) stay single-sourced, so the two language trees can never drift in identity, price, or order. A third language would mean another column sweep; that is accepted.
2. **Proper nouns stay Latin.** House and perfume names (`Kyphi Noir`, `Signature`, `Noir`, `Egyptica`) render in Latin script on `/ar`, following luxury-house convention. Botanical binomials (`Ingredient.latinName`) likewise. Social platform names and `@handles` likewise.
   **Nuance:** some `Collection.name` values are categories, not house proper nouns — `Body Care`, `Room Fragrance`, `Gift Sets`, `Discovery`. `name_ar` is therefore added as a nullable column, populated for the category-style collections and left `null` for the house ranges. The fallback in decision 4 makes `null` render the Latin name, which is the desired outcome. Same treatment for `Stockist.name` and `Testimonial.author` / `CraftQuote.author` — populate Arabic only where the name is genuinely Arabic (transliterating an existing person's name, never inventing a new persona or changing an `id`).
3. **Admin gets bilingual authoring fields.** Every Arabic field is **optional** in the admin Zod schemas, matching the nullable columns and the fallback. Admin *chrome* stays English (it is behind the `ADMIN` role and out of scope); only the content fields become bilingual.
4. **Missing Arabic falls back to English.** `null` or empty `foo_ar` resolves to `foo`. Nothing ever renders blank, and a product an admin adds tomorrow degrades gracefully instead of showing an empty card on `/ar`.

And these follow from the codebase:

5. **Resolve the locale in `src/schemas/db/*` mappers, not in components.** Each `toX(row)` mapper becomes `toX(row, locale)`: it parses both columns and returns the existing resolved type with plain `string` fields. Service functions take `locale: Locale` as their **first** parameter and pass it down. **Component prop shapes and every type in `src/types/*` are unchanged** — this is what keeps "UI displays stored data only" true and is the single reason to prefer mapper-level resolution over a `LocalizedText` type reaching the view layer.
6. **Replace `ltrIsland()` on DB text with `dir="auto"`.** Because of the fallback, an Arabic page can legitimately contain an English string at runtime, and a compile-time island cannot know which. `dir="auto"` resolves direction from the first strong character in the actual rendered text — Arabic content lays out RTL, a fallback English string lays out LTR, with no type churn and no per-field `isFallback` plumbing. Apply it to the element that directly wraps the DB text.
   `ltrIsland()` is **not deleted**. It stays on values that are Latin *by design* regardless of locale: `latinName`, `sku`, `phoneHref`, `@handles`, email addresses, `mapsUrl` labels, and the proper nouns of decision 2. Every surviving call must carry a comment naming which value it guards.
7. **Filter keys stay English; only labels translate.** `IngredientFamily.name` and `Article.category` are filter predicates and `IngredientUsage` trigger targets. Add `label_ar` / `category_ar` for **display**, and keep the filter comparing on the unchanged English key. A localized key would make a typo an unfilterable eighth family — the failure `prompts/ingredient-family-taxonomy.md` exists to prevent.
8. **`EnquirySubject.label` is never localized.** It is the primary key *and* the mail-header value validated against `src/constants/contact.ts`. Add `label_ar` for the `<option>` text only; the `<option value>` and the submitted payload stay the English key, so the Server Action's validation and `db:verify`'s drift check are untouched.
9. **Western Arabic numerals throughout**, as already decided and implemented in `src/lib/format.ts` (`"ar-EG-u-nu-latn"`). Prices, volumes, dates, reading times, and stat values keep Latin digits. Do not change `format.ts` except where a new localized unit string is needed.
10. **Arabic legal text is a good-faith translation, not independent legal drafting.** Each Arabic legal document displays a governing-language notice stating the English version prevails in case of discrepancy. That notice string lives in the **dictionary**, not in the document body.
11. **Arabic full-text search is in scope; Arabic semantic search is not.** Add a `search_document_ar` generated column and an Arabic `tsvector` using the `simple` text-search configuration (Postgres ships no Arabic stemmer; `simple` is the correct, honest choice). The pgvector `embedding` column stays English-sourced — re-embedding the catalog in Arabic is a separate job with its own cost. Document this limitation in the migration header; do not silently leave Arabic queries returning nothing.
12. **No new dependencies.** No i18n library, no ICU. `interpolate()` remains the only templating.
13. **Caching and routing are unchanged.** Both trees already prerender via `generateStaticParams`; localized columns add no dynamic behavior. No proxy, middleware, or `revalidate` change.

---

## Translatable column inventory

Add `_ar` (nullable, same type) for exactly these. **Everything not listed is not localized.**

**`0001_catalog.sql`**
- `Collection`: `name` (decision 2 nuance), `description`, `bannerAlt`
- `Product`: `subtitle`, `description`, `story`, `format`, `badge`, `includes[]`, `topNotes[]`, `heartNotes[]`, `baseNotes[]` — **not** `name` (decision 2)
- `ProductImage`: `alt`

**`0002_content.sql`**
- `Testimonial`: `quote`, `authorTitle`, `author` (decision 2 nuance)
- `IngredientFamily`: `label_ar` (display label; `name` stays the key — decision 7)
- `Ingredient`: `name`, `origin`, `rarity`, `description`, `facts[]`, `imageAlt` — **not** `latinName`, `slug`, `families`, `priceTier`
- `IngredientUsage`: nothing (`name` is a snapshot of the Latin product name)
- `Article`: `title`, `excerpt`, `body`, `imageAlt`, `category_ar` (display label — decision 7)
- `TimelineEvent`: `year` (e.g. `3000 BC` → `3000 ق.م`, Latin digits per decision 9), `title`, `description`
- `BrandValue`: `title`, `description`
- `MissionStatement`: `label`, `title`, `text`
- `CraftPillar`: `title`, `description` — **not** `number`
- `CraftStep`: `title`, `subtitle`, `body`, `imageAlt` — **not** `number`
- `CraftStat`: `value` (nullable; only where the figure carries a word — `300+` and `100%` stay), `label`
- `CraftQuote`: `quote`, `authorTitle`, `author` (decision 2 nuance)

**`0003_directory.sql`**
- `Stockist`: `name` (decision 2 nuance), `city`, `country`, `address`, `hours`, `imageAlt` — **not** `phone`, `phoneHref`, `mapsUrl`, or the three enums
- `ContactChannel`: `label`, `value` — **not** `href`
- `SocialProfile`: nothing
- `EnquirySubject`: `label_ar` only (decision 8)
- `BoutiqueSetting`: nothing
- `LegalDocument`: `eyebrow`, `title`, `lede`, `bannerAlt`, `sections` (`sections_ar jsonb`, same `legal_sections_is_array` check)

---

## Files likely to change

| File | Change |
| :--- | :--- |
| `supabase/sql/0007_i18n_content.sql` | **New.** All `_ar` columns via `add column if not exists`; Arabic search column + index; header documenting decisions 1, 11. |
| `supabase/seed/catalog.json` | Arabic for 7 collections, 28 products. |
| `supabase/seed/content.json` | Arabic for ~50 editorial records. |
| `supabase/seed/directory.json` | Arabic for stockists, contact channels, enquiry labels, 4 legal documents. |
| `scripts/db-seed.ts` | Upsert the `_ar` columns in the existing single transaction. |
| `scripts/db-verify.ts` | New check: Arabic coverage per table, reported as a count, not a hard failure for nullable-by-design fields. |
| `src/lib/i18n/resolve.ts` | **New.** `resolveText(en, ar, locale)` and `resolveList(en, ar, locale)`. Pure; no React, no Next — same constraint as `config.ts`. |
| `src/lib/i18n/rtl.ts` | Update the `ltrIsland()` doc comment: its stated rationale ("records in Postgres are English-only in this pass") stops being true. |
| `src/schemas/db/{catalog,content,directory}.ts` | `_ar` in every `*_COLUMNS` constant and row schema; every `toX(row)` becomes `toX(row, locale)`. |
| `src/services/{products,content,contact,legal,stockists,search}.ts` | `locale: Locale` as first parameter on every record-returning function; update the `// → supabase.from(…)` doc comments. |
| `src/services/content.ts` | `ALL_FILTER` and `toFilterOptions()` return `{ value, label }` pairs so tabs display Arabic while filtering on English keys. |
| `src/services/contact.ts` | `getEnquirySubjects()` returns `{ value, label }[]` (decision 8). |
| The 8 pages + 12 components listed above | Pass `locale` to services; swap `ltrIsland()` → `dir="auto"` where it guarded untranslated English; keep and comment the rest. |
| `src/components/legal/LegalDocumentBody.tsx` | Render resolved sections; add the governing-language notice on `ar`. |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | Governing-language notice; any new admin-facing or filter-related label. |
| `src/schemas/admin.ts` | Optional Arabic fields on collection / product / article schemas and `saveProductImages`. |
| `src/actions/admin/{catalog,journal}.ts` | Persist the Arabic columns. |
| `src/components/admin/{ProductForm,CollectionForm,ArticleForm,ProductImageEditor}.tsx` | Arabic inputs beside the English ones, `dir="rtl"` on the Arabic inputs, labelled as optional. |
| `src/types/*` | **Unchanged** (decision 5). If a change seems necessary, re-read decision 5 before making it. |

No dependency, `next.config.ts`, proxy, or middleware change.

---

## Implementation requirements

1. **Ship in slices, each leaving the app building and both trees rendering.**
   **A** — migration `0007` + `resolve.ts` + `rtl.ts` comment. **B** — `catalog.json` Arabic + seed/verify. **C** — `content.json` Arabic. **D** — `directory.json` + legal Arabic. **E** — schemas/db + services threading `locale`. **F** — consumers: `dir="auto"`, filter label pairs, legal notice. **G** — admin bilingual forms. **H** — Arabic search column and query path.
   Do not begin a slice before the previous one typechecks and builds.
2. Migration `0007_i18n_content.sql` uses `add column if not exists` throughout so it lands on a database created before it existed, mirroring how `featuredProductSlug` was added in `0003`. It must be re-runnable. Do not modify `0001`–`0003`.
3. Arabic columns are **nullable with no default**. Do not backfill with the English value — a `null` must remain distinguishable from a deliberate Arabic translation, otherwise `db:verify` can never report real coverage.
4. `resolveText(en, ar, locale)` returns `en` when `locale === "en"`, when `ar` is `null`/`undefined`, or when `ar.trim()` is empty. `resolveList` applies the same rule to the array as a whole — a partially translated array falls back entirely, because a half-Arabic note pyramid is worse than a consistent English one.
5. Mappers accept `locale: Locale`, never a raw `string`. The `[locale]` layout's `isLocale()` + `notFound()` guard stays the only entry point into the localized tree.
6. **Arabic copy must match the brand register of AGENTS.md §2** — editorial, unhurried, museum-quality. Do not machine-translate marketing prose literally; write it as Arabic brand copy carrying the same meaning. **Preserve every factual claim exactly**: dates, regions, concentrations, volumes, prices, percentages, ingredient origins, boutique addresses, policy obligations, retention periods, and refund windows.
7. Fragrance note names (`Frankincense`, `Blue Lotus`, `Oud`) are perfumery vocabulary with established Arabic equivalents — translate them (`لبان`, `اللوتس الأزرق`, `عود`). This is the `notes` case the request calls out.
8. Remove an `ltrIsland()` only when the text it wraps is now translated; replace with `dir="auto"` on the wrapping element. Keep it — with a comment naming the value — on Latin-by-design content. Delete the `{/* … English only. */}` comments as their claims stop being true; a stale comment is worse than none.
9. Zero `any`. Zod row schemas use `.nullable()` (not `.optional()`) for the `_ar` columns so a Supabase `null` parses rather than dropping the whole row — a malformed Arabic column must never blank an English section.
10. Admin Arabic fields are optional and must not weaken any existing English validation. Arabic `<input>`/`<textarea>` elements carry `dir="rtl"` and a `lang="ar"` attribute.
11. The Arabic search column mirrors the English one exactly in structure and A/B/C weighting, differing only in source columns and the `simple` configuration. Add its GIN index. `0004_search.sql`'s "keep the two sides in step" warning now covers three artefacts — say so in a comment there.

---

## Security requirements

- Locale reaching the data layer is already narrowed to `Locale`; services and mappers accept the union type, never `string`.
- **No localized value may flow into an `href`, `src`, `redirect()`, `mailto:`, or `tel:` target.** Slugs, URLs, and `phoneHref` are explicitly excluded from the inventory above, which enforces this structurally.
- **`EnquirySubject`:** the submitted value stays the English primary key validated against `src/constants/contact.ts`. Confirm by reading the contact Server Action before touching the `<select>` — a localized value reaching a mail header is a header-injection surface.
- Localized text is rendered as text. `LegalDocumentBody` keeps its typed structured rendering; `sections_ar` is parsed by the same Zod `LegalSection[]` union as `sections`. Nothing reaches `dangerouslySetInnerHTML`.
- Do not localize `sku`, `id`, `slug`, or any value used as a React `key` or lookup key.
- Admin Arabic fields go through the same Server Action authorization path as the English ones — verify `src/lib/admin/auth.ts` is applied on every mutated action, and add no new route handler.
- The migration adds columns only. It must not alter, drop, or re-create any RLS policy or grant; `0006_privileges.sql` stays the sole owner of those.

---

## Acceptance criteria

1. `/ar` renders Arabic throughout the home page: collection descriptions, product subtitles and note pyramids, brand story, craft pillars, featured perfume, ingredient rail, journal preview, and every testimonial in the carousel.
2. `/ar/perfumes`, `/ar/collections`, `/ar/collections/[slug]`, `/ar/new-arrival`, `/ar/gift-set`, `/ar/body-care`, `/ar/room-fragrance`, and `/ar/discovery` show Arabic product cards — subtitle, description, badge, notes — with only the Latin perfume name remaining Latin.
3. `/ar/perfume/[slug]` renders Arabic subtitle, description, story, all three note tiers, `includes`, key ingredients, and breadcrumb. `latinName` stays `dir="ltr"`.
4. `/ar/journal` shows Arabic titles, excerpts, and category tabs; `/ar/ingredients` shows Arabic names, origins, rarity, descriptions, facts, and family filter labels. Both filter on unchanged English keys and return **identical result counts** to their English pages.
5. `/ar/heritage`, `/ar/about`, `/ar/craftsmanship`, `/ar/contact`, and `/ar/stockists` contain no untranslated English prose.
6. All four `/ar` legal routes render Arabic bodies plus the governing-language notice.
7. `/ar/cart`, `/ar/wishlist`, and `/ar/account/*` render Arabic line items and product names per the same rules.
8. Product, collection, article, and ingredient **URLs are byte-identical across locales** apart from the `/ar` prefix.
9. Prices, volumes, dates, reading times, and stat values render with **Western** numerals (`1,470`, not `١٬٤٧٠`) and correct RTL placement of currency and unit.
10. Deleting a record's `_ar` value in the database makes that field render its English text in correct LTR flow inside the Arabic page — no blank, no reversed punctuation, no dropped row.
11. Remaining `ltrIsland()` calls are only on Latin-by-design values, each with a comment naming the value.
12. Admin can create a product, collection, and article with Arabic fields; the new record renders Arabic on `/ar` and English on `/` without a redeploy. Leaving the Arabic fields blank still saves and falls back cleanly.
13. Searching an Arabic term on `/ar/search` returns matching products; the English tree's relevance ordering is unchanged.
14. **The English tree is textually and visually unchanged.** Diff `/`, `/perfumes`, `/craftsmanship`, and `/journal` against the pre-change build.
15. `npm run build` prerenders both trees with no new warnings; ISR settings unchanged.

---

## Checks to run

```bash
npm run lint
npx tsc --noEmit
npm run db:migrate          # 0007 applies, and is re-runnable with no error
npm run db:seed             # single transaction, converges on re-run
npm run db:verify           # row counts unchanged; Arabic coverage reported
npm run build

grep -rn "English only" src/          # must return nothing
grep -rn "ltrIsland" src/             # every remaining hit justified by a comment
```

---

## Exact manual test steps

1. `npm run db:migrate && npm run db:seed && npm run db:verify`, then `npm run dev`.
2. Open `/ar`. Read top to bottom — collections grid, featured fragrances, brand story, craft pillars, featured perfume, ingredient rail, journal preview, testimonials. Let the carousel cycle through all three. No English prose anywhere except Latin house names.
3. Open `/` and confirm it is identical to the pre-change page.
4. Open `/ar/perfumes`. Check several cards: subtitle, badge, note line, price. Open `/ar/perfume/kyphi-noir` — URL slug unchanged, all copy Arabic, `Kyphi Noir` and the botanical binomials Latin and `dir="ltr"`.
5. On `/ar/ingredients`, click through every family filter. Labels Arabic, counts identical to `/ingredients`. Repeat on `/ar/journal` for the category tabs.
6. Open `/ar/craftsmanship` — hero lede, all stat labels, all six process steps, the master perfumer quote. Then `/ar/heritage`, `/ar/about`, `/ar/stockists`, `/ar/contact`.
7. On `/ar/contact`, open the enquiry `<select>`: options display Arabic. Submit the form and confirm the received mail carries the **English** subject.
8. Open all four `/ar` legal routes; confirm Arabic bodies and the governing-language notice.
9. Add a product to the bag, then check `/ar/cart` and `/ar/wishlist` line items.
10. Search an Arabic term (e.g. `عود`) on `/ar/search`. Then search `oud` on `/search` and confirm the English ordering is unchanged.
11. In Supabase, set one product's `subtitle_ar` to `null`. Reload `/ar/perfumes` — that subtitle shows English, flowing LTR, with the rest of the card still Arabic.
12. Sign in as `ADMIN`. Create a collection and a product with Arabic fields filled, and one article with the Arabic fields left blank. Verify all three on both `/` and `/ar`.
13. Use the language switcher on `/ar/craftsmanship` → `/craftsmanship` and back. Both directions land on the same page in the right language with no flash of the wrong locale.
14. Inspect the page in a browser at 375px, 768px, and 1440px on `/ar` — confirm RTL layout, mirrored paddings, and correct arrow direction (`readingArrow`) at every breakpoint.
