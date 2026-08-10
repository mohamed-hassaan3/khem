# Prompt — Localize the `src/data` content layer so Arabic pages carry Arabic content

## Goal

The internationalization pass translated the site's **chrome** — nav, eyebrows, CTAs, form labels, metadata — but left the **content** English. Every consumer of `src/data/*.ts` therefore wraps those fields in `ltrIsland()` and renders them as embedded English on Arabic pages. On `/ar/craftsmanship` that is the hero lede, all four step titles and bodies, all four stat labels, and the master perfumer quote: most of the visible page.

This prompt closes that gap by making the data layer itself locale-aware, resolving the active locale in `src/services/*`, and removing the `ltrIsland()` wrappers that exist solely to quarantine untranslated English.

Depends on `prompts/i18n-rtl-defects.md` landing first — that prompt changes which elements are LTR islands, and this one removes most of the remaining ones.

---

## Skills read

- `AGENTS.md` — §1 rules, §6 architecture (UI displays stored data only; services own the query layer), §9 schema (which of these records already have a Prisma model and which do not), §12 checklist.
- `prompts/internationalization-en-ar.md` — established `Dictionary`, `getDictionary()`, `interpolate()`, `ltrIsland()`, and the explicit decision to defer content translation. This prompt reverses that deferral.
- `prompts/ingredient-family-taxonomy.md` — the closed `IngredientFamily` union and why the filter vocabulary must stay fixed; that constraint survives localization.
- No `.agents/skills/*` applies. Supabase is not being provisioned in this pass.

---

## Existing code inspected

| File | Lines | Untranslated content |
| :--- | ---: | :--- |
| `src/data/content.ts` | 585 | `TESTIMONIALS`, `INGREDIENTS`, `JOURNAL_ARTICLES`, `CRAFT_PILLARS`, `TIMELINE`, `BRAND_VALUES`, `MISSION_STATEMENTS`, `CRAFT_STEPS`, `CRAFT_STATS`, `MASTER_PERFUMER_QUOTE` |
| `src/data/legal.ts` | 620 | `LEGAL_DOCUMENTS` — full policy bodies for four documents |
| `src/data/products.ts` | 162 | `COLLECTIONS`, `PRODUCTS` — names, subtitles, descriptions, stories, note lists |
| `src/data/contact.ts` | 77 | `CONTACT_CHANNELS`, `ENQUIRY_SUBJECTS`, `SOCIAL_PROFILES` |

| Consumer | `ltrIsland()` usages |
| :--- | ---: |
| `src/app/[locale]/page.tsx` | 2 |
| `src/app/[locale]/craftsmanship/page.tsx` | 2 |
| `src/app/[locale]/heritage/page.tsx` | 2 |
| `src/app/[locale]/about/page.tsx` | 2 |
| `src/app/[locale]/journal/page.tsx` | 2 |
| `src/app/[locale]/contact/page.tsx` | 2 |
| `src/components/ecommerce/ProductCard.tsx` | 2 |
| `src/components/home/CollectionCard.tsx` | 2 |
| `src/components/home/IngredientCard.tsx` | 2 |
| `src/components/home/JournalCard.tsx` | 2 |
| `src/components/ingredients/IngredientExplorer.tsx` | 2 |
| `src/components/journal/JournalGrid.tsx` | 2 |
| `src/components/legal/LegalDocumentBody.tsx` | — (renders `LegalDocument` bodies) |

Key structural facts:

- **`src/services/*` is already the only boundary the UI crosses.** 26 exported async functions across four service modules; every page and card awaits one of them. None currently take a locale.
- **`src/types/content.ts` documents these as pre-schema.** Testimonials, ingredients, articles, and craft records have no Prisma model in AGENTS.md §9. `Collection` and `Product` **do**.
- **`Ingredient.families` is a closed union** (`IngredientFamily`), used as a filter predicate and rendered as badges. `src/services/content.ts` exposes `ALL_FILTER = "All"` and builds filter options from it.
- **`JournalArticle` carries a `category`**, surfaced as filter tabs via `getJournalCategories()`.
- **Non-display fields already exist as data, not strings**: ISO dates, numeric reading time, price tiers, `String[]` note lists. `src/lib/format.ts` handles presentation.

---

## Decisions and assumptions

1. **Localize at the field, not the record.** Each translatable field becomes a `LocalizedText` — `Record<Locale, string>` — rather than duplicating whole record arrays per locale. Duplicating records would let the two trees drift in `id`, `slug`, image, price, or sort order; per-field keeps every non-translatable attribute single-sourced. Introduce `export type LocalizedText = Record<Locale, string>` (and `LocalizedTextArray` for `String[]` fields) in `src/types/`.
2. **Resolve the locale in `src/services/*`, not in components.** Every service function that returns records gains a `locale: Locale` parameter and returns records whose translatable fields are already plain `string`. Components keep their current prop shapes and stay ignorant of localization. This is also the shape a Supabase translation-table join collapses into later, so the migration path AGENTS.md §6 describes is preserved.
3. **Introduce a resolved type alongside the stored type.** `Ingredient` (stored, localized fields) vs. the resolved projection the UI receives. Do not make components accept `LocalizedText` — that would push locale resolution into the view layer and break the "UI displays stored data only" rule.
4. **`slug`, `id`, `sku`, image `url`, ISO dates, numbers, and enum values are never localized.** URLs must not fork per locale — `/ar/perfume/kyphi-noir` and `/perfume/kyphi-noir` address the same product. Image `alt` **is** localized.
5. **`IngredientFamily` stays a closed English union.** It is a type-level key, not display text. Add an Arabic label map (`INGREDIENT_FAMILY_LABELS: Record<IngredientFamily, LocalizedText>`) and translate at render. Same for `JournalArticle.category` and `ALL_FILTER`. Localizing the union itself would make a typo an unfilterable eighth family — the failure mode `prompts/ingredient-family-taxonomy.md` exists to prevent.
6. **Proper nouns stay Latin inside Arabic copy where that is correct.** Perfume names (`Kyphi Noir`), collection names, botanical binomials (`latinName`), brand names, and social platform names are not transliterated. These keep an `ltrIsland()` wrapper — that helper is not being deleted, only the wrappers that exist purely because a field was untranslated. Latin binomials in particular **must** stay `dir="ltr"`.
7. **Arabic testimonial attributions are transliterated, not invented.** `Yasmine Al-Rashid` → `ياسمين الراشد`; `James Whitmore` stays Latin inside an island. Do not fabricate new Arabic personas or change any `id`.
8. **Legal documents are translated but flagged.** Arabic policy text is a good-faith translation of the English, not independent legal drafting. Each Arabic legal document must carry a visible notice that the English version governs in case of discrepancy, and the notice string belongs in the dictionary, not the document body.
9. **Ship in slices, in this order**, so each slice is independently reviewable and revertable: (a) types + `LocalizedText` plumbing + `content.ts` craft records — which unblocks `/craftsmanship`, the page you reported; (b) rest of `content.ts` (testimonials, ingredients, articles, timeline, brand values, mission); (c) `products.ts` + `contact.ts`; (d) `legal.ts`. Each slice must leave the app building and both locales rendering.
10. **No new dependencies.** No i18n library, no ICU. `interpolate()` remains the only templating. If plural agreement is ever needed, `Intl.PluralRules` replaces it — as `src/lib/i18n/interpolate.ts` already documents.
11. **`revalidate` values and route caching are unchanged.** Both locale trees already prerender via `generateStaticParams`; localized data adds no dynamic behavior.

---

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/types/content.ts` | `LocalizedText`; stored vs. resolved variants of each content type. |
| `src/types/catalog.ts` | Same for `Collection`, `Product`, `ProductCardData`. |
| `src/types/contact.ts`, `src/types/legal.ts` | Same for their record types. |
| `src/data/content.ts` | Arabic added to every translatable field. |
| `src/data/products.ts` | Arabic for names, subtitles, descriptions, stories, notes. |
| `src/data/contact.ts` | Arabic for channels, enquiry subjects. |
| `src/data/legal.ts` | Arabic for all four documents. |
| `src/services/content.ts` | All 15 functions take `locale`; add family/category label resolution. |
| `src/services/products.ts`, `contact.ts`, `legal.ts` | Same. |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | Family/category labels if kept in the dictionary; legal-translation notice. |
| The 12 consumers listed above | Pass `locale` to services; remove `ltrIsland()` wrappers that no longer guard English. |
| `src/components/legal/LegalDocumentBody.tsx` | Render the resolved localized body; add the governing-language notice. |

No dependency, config, proxy, or middleware change.

---

## Implementation requirements

1. Add `LocalizedText` and the resolver (`resolveText(value, locale)`) in `src/lib/i18n/`, alongside `interpolate.ts`. Keep it pure and free of React and Next imports, matching `config.ts`.
2. Every service function that returns a record takes `locale: Locale` as its **first** parameter and returns the resolved projection. Update the `// → supabase.from(…)` comments to show the translation join the localized query becomes.
3. Every consumer already has the active locale in scope (`activeLocale` on pages, a `locale` prop on cards). Thread it through — do **not** add a second locale lookup or reach for `useLocale()` in a Server Component.
4. Remove an `ltrIsland()` wrapper only when **every** field it guards is now translated. Where a block mixes translated prose with a Latin proper noun, keep the island on the proper noun alone and unwrap the prose.
5. Delete the `{/* … comes from src/data — English only. */}` comments as their claims stop being true. Leaving a stale comment is worse than no comment.
6. Arabic copy must match the brand register described in AGENTS.md §2 — editorial, museum-quality, unhurried. Do not machine-translate marketing copy literally; write it as Arabic brand copy conveying the same meaning. Preserve every factual claim (dates, regions, concentrations, volumes, prices) exactly.
7. Zero `any`. `Record<Locale, string>` must make a missing Arabic string a **typecheck failure**, not a runtime fallback — that is the main reason to prefer it over a partial map with an English default.
8. `src/lib/format.ts` may need locale-aware number and date formatting (`Intl.NumberFormat` / `Intl.DateTimeFormat`). **Confirmed with the user: Western Arabic numerals throughout** — prices, volumes, dates, reading times, stat values. Request the `latn` numbering system explicitly (`"ar-EG-u-nu-latn"`), since `ar` defaults to Eastern Arabic (`arab`) digits in most runtimes. Do not rely on the default.

---

## Security requirements

- Locale reaching the data layer must already be narrowed to `Locale`; services accept the union type, never a raw `string`. The `[locale]` layout's `isLocale()` + `notFound()` guard remains the only entry point.
- Localized strings are rendered as text, never via `dangerouslySetInnerHTML`. `LegalDocumentBody` must keep whatever structured rendering it uses today.
- No localized field may flow into an `href`, `src`, or `redirect()` target. Slugs and URLs stay non-localized (decision 4), which enforces this structurally.
- Do not localize `sku`, `id`, or any value used as a React `key` or lookup key.

---

## Acceptance criteria

1. `/ar/craftsmanship` renders entirely in Arabic: hero lede, all four step titles/subtitles/bodies, all four stat labels, and the master perfumer quote. Only the perfumer's Latin-script name (if kept Latin) remains an LTR island.
2. `/ar` renders Arabic collection descriptions, product subtitles and notes, ingredient names and origins, journal titles and excerpts, and testimonial quotes.
3. `/ar/ingredients`, `/ar/journal`, `/ar/heritage`, `/ar/about`, `/ar/contact`, and all four `/ar` legal routes contain no untranslated English prose.
4. Ingredient family filters and journal category tabs display Arabic labels while filtering on the unchanged English keys; every filter still returns the same record set in both locales.
5. Product, collection, article, and ingredient **URLs are byte-identical** across locales apart from the `/ar` prefix.
6. `npx tsc --noEmit` fails if any record is missing its `ar` string. Verify by deleting one and confirming the error.
7. Remaining `ltrIsland()` usages are only on genuine Latin proper nouns and binomials — each with a comment saying which.
8. Arabic legal documents display the governing-language notice.
9. The English tree is visually and textually unchanged; diff `/`, `/craftsmanship`, and `/journal` against the pre-change build.
10. `npm run build` prerenders both trees with no new warnings; ISR settings unchanged.

---

## Checks to run

```bash
npm run lint
npx tsc --noEmit
npm run build
grep -rn "English only" src/          # must return nothing
grep -rn "ltrIsland" src/             # every remaining hit justified by a comment
```

---

## Exact manual test steps

1. `npm run dev`.
2. Open `/ar/craftsmanship`. Read top to bottom — hero, stat band, all four process steps, quote, CTA. No English prose anywhere.
3. Open `/craftsmanship` and confirm it is identical to the pre-change page.
4. Open `/ar`. Check each section: collections grid, featured fragrances, brand story, craftsmanship pillars, featured perfume, ingredient rail, journal preview, testimonial carousel. Let the carousel cycle through every testimonial.
5. On `/ar/ingredients`, click through every family filter. Labels Arabic, result counts identical to `/ingredients`.
6. On `/ar/journal`, click through every category tab. Same check.
7. Open `/ar/perfume/kyphi-noir`. Confirm the URL slug is unchanged and the copy is Arabic; the perfume name may stay Latin, marked `dir="ltr"`.
8. Open all four `/ar` legal routes. Confirm Arabic bodies plus the governing-language notice.
9. On any `/ar` page, inspect a Latin binomial (e.g. `Aquilaria malaccensis`) — it must carry `dir="ltr"` and render with its Latin tracking intact.
10. Use the language switcher on `/ar/craftsmanship` → `/craftsmanship` and back. Both directions land on the same page in the right language, with no flash of the wrong locale.
11. Confirm prices, volumes, dates, and stat values render with **Western** numerals (`1,250`, not `١٬٢٥٠`) and correct RTL placement of currency and unit.
