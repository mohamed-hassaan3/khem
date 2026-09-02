# Product Detail: Gallery Arrows, Mobile Eyebrow, Trust Badges, Related Rail

Source brief: `src/docs/Product-Landing-Page-Navigation-Inventory-Updates.md` §1, §2, §7 (display half only).

Independent of the other three workstreams. Touches no schema and no shared layout.

---

## Goal

Four small, verified changes on the product detail pages: remove the gallery
arrows, fix the mobile eyebrow collision on `/ritual/[slug]`, revise the trust
badges (add "No Blind Buy", change 30-day to 7-day returns), and raise the
related-products rail from 3 to 4.

## Skills read

- `AGENTS.md` §2.2 (motion, spacing), §3.2 (component aesthetics), §11, §12
- `src/docs/khem-ui-design-system.md`
- No external skill applies.

## Existing code inspected

| Concern | File |
| :-- | :-- |
| Gallery | `src/components/ecommerce/ProductGallery.tsx` (238 lines) |
| Ritual eyebrow | `src/app/[locale]/ritual/[slug]/page.tsx:145` |
| Trust badges | `src/components/ecommerce/ProductPurchase.tsx:273` |
| Trust copy | `src/lib/i18n/dictionaries/{en,ar}.ts` → `product.trust` |
| Related rail | `src/services/products.ts:809`, `src/components/ecommerce/RelatedProducts.tsx:40` |
| Related SQL | `supabase/sql/0014_ritual_detail_parity.sql` → `related_products(text, int, CollectionKind[])` |

---

## A. Remove the gallery arrows

`<ProductGallery>` is a native scroll-snap track. `activeIndex` is **derived**
from an IntersectionObserver, and the arrows only call `scrollIntoView` on a
slide — they own no state. Removing them is therefore safe: swipe, trackpad,
shift+wheel and the thumbnail strip all keep working, and the strip stays usable
before hydration.

Remove:
- `ARROW_CLASS` (line 44)
- both `<button>` elements and their `scrollTo` handlers
- the `ChevronLeft` / `ChevronRight` import
- the now-unused `product.gallery.previous` / `product.gallery.next` keys in
  **both** dictionaries (leaving them is a lie about what the UI offers)

Keep `activeIndex`, the observer, the thumbnails and the caption strip.

One component serves `/perfume/[slug]`, `/ritual/[slug]` and `/set/[slug]`, so
"consistently across all product types" needs no per-route work. Verify all
three.

## B. Fix the mobile eyebrow collision

`ritual/[slug]/page.tsx:145` renders the range eyebrow as:

```tsx
<p className="eyebrow -mb-10 text-ground-accent/55">
```

inside a column whose gap is `gap-7 md:gap-16`. The arithmetic is the bug:

| | column gap | negative margin | effective |
| :-- | --: | --: | --: |
| Desktop (`md:`) | 64px | −40px | **+24px** — fine |
| Mobile | 28px | −40px | **−12px** — overlap |

So "SCENT YOUR SANCTUARY" collides with the collection eyebrow that
`<ProductPurchase>` renders beneath it ("HOME FRAGRANCES COLLECTION").

Prefer restructuring over patching the number: two stacked eyebrows in a row is
the real hierarchy problem. Group the range eyebrow and the collection eyebrow
into one deliberate unit with its own internal spacing, so the layout no longer
depends on a negative margin cancelling a flex gap. If that proves too invasive,
the minimum fix is a responsive margin (`-mb-3 md:-mb-10`) — but say so and
explain why.

Check both eyebrows in Arabic: they are uppercase-tracked, and `tracking` on
Arabic text is a known RTL hazard.

## C. Trust badges

`product.trust` is an object of `{title, desc}` and `<ProductPurchase>` renders
`Object.values(...)` — so **adding a fourth key is enough to render a fourth
badge**, no component change. But check the container's column count first: a
grid built for three will reflow awkwardly at four. Fix the grid in the same
pass, and check it at 375px.

1. **Add "No Blind Buy."** The concept: a customer may try a tester/sample
   before the full-size bottle is unsealed. Write it in the house voice, short
   enough to sit beside "Luxury Packaging". Add to **both** dictionaries.
2. **30-Day Returns → 7-Day Returns.** One occurrence in `en.ts`
   (`product.trust.returns.title`) and one in `ar.ts`
   (`"إرجاع خلال ٣٠ يومًا"` → seven days, Arabic-Indic digits).

**Audit note, already performed:** the `/return-exchange` policy page renders
from `LegalDocument` in Supabase, not from the dictionary. Its stored sections
were searched for a return-window figure and **none was found** — so no database
edit is required for this change. Re-verify before concluding; if the house
later writes a window into that document it must say seven days too.

## D. Related rail: 3 → 4

The recommendation engine is already correct and needs no work. `related_products()`
orders by cosine distance over `search_document` embeddings against an HNSW
index, prefers the product's own collection when vectors cannot decide, and
**tops the list up from the rest of the catalog** so a rail is never short. The
brief's requirement that the system "not blindly return four unrelated products"
is the behaviour it already has.

The display change is:
- `getRelatedProductCards()` default `limit = 3` → `4` (`src/services/products.ts:812`)
- three call sites passing an explicit `3`: `perfume/[slug]/page.tsx:94` (uses
  the default), `ritual/[slug]/page.tsx:112`, `set/[slug]/page.tsx:125`
- `<RelatedProducts>` already grids `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`,
  so four fills the row exactly — confirm three no longer leaves a gap and four
  does not wrap at `md:`

Do **not** change `kinds` at any call site: it decides what a visitor is shown
and is deliberately a server-side constant.

Collections hold 6/6/2 fragrances, so `/perfume/[slug]` in Noir (2 products) is
the case where the top-up actually fires. Test that page specifically.

**Out of scope:** embedding coverage, `EMBEDDING_VERSION`, `npm run embed`, and
the similarity-quality audit. Those are a separate verification task per the
confirmation doc.

---

## Decisions and assumptions

- No schema change, no migration, no Supabase write.
- Both dictionaries move together; the `Dictionary` type makes a missing Arabic
  key a compile error, not a runtime fallback.
- Removing the arrows removes an affordance. It is what the brief asks for and
  the track remains fully operable; do not add a replacement control.

## Files likely to change

- `src/components/ecommerce/ProductGallery.tsx`
- `src/app/[locale]/ritual/[slug]/page.tsx`
- `src/components/ecommerce/ProductPurchase.tsx`
- `src/services/products.ts`
- `src/app/[locale]/{ritual,set}/[slug]/page.tsx`
- `src/lib/i18n/dictionaries/{en,ar}.ts`

## Security requirements

None beyond the usual: no new input is accepted, no query is parameterised by
anything request-derived, and `kinds` stays a server constant.

## Acceptance criteria

- [ ] No arrow controls on `/perfume`, `/ritual`, `/set`; swipe, thumbnails and captions still work
- [ ] `gallery.previous` / `gallery.next` removed from both dictionaries
- [ ] `/ritual/[slug]` eyebrows do not overlap at 320, 375, 414 or 768px, in EN and AR
- [ ] Four trust badges render without reflow at 375px and at desktop
- [ ] "7-Day Returns" in EN and AR; no "30" remains in `product.trust`
- [ ] Related rail shows up to 4, excludes the current product, and is not short on a Noir PDP
- [ ] `npx tsc --noEmit` and `npm run lint` clean

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`
2. `/perfume/onyx-night` — no arrows; swipe the gallery; click thumbnails; count the related rail
3. `/perfume/lapis` (Noir/Gemstone, small collection) — related rail still reaches 4
4. `/ritual/amber-body-mist` at 375px — the two eyebrows are legible and separated
5. `/ar/ritual/amber-room-spray` at 375px — same, RTL
6. `/set/discovery-signature` — gallery and rail
7. Read the four trust badges on any PDP, EN and AR

---

## Implementation record

All four changes shipped. `npx tsc --noEmit` and `npm run lint` clean.

### A. Gallery arrows — removed

Gone from `ProductGallery.tsx`: `ARROW_CLASS`, both buttons, the
`PreviousIcon`/`NextIcon` direction pair, and the `lucide-react` import. The
`group` class came off the track wrapper with them — the arrows' hover reveal
was its only consumer. `product.gallery.previous` / `.next` deleted from both
dictionaries.

Kept, and verified still working: `goTo()`, the arrow-key handler, the
IntersectionObserver, the thumbnail strip, the caption strip. The header comment
now records *why* there are no arrows, so nobody adds them back as a fix.

Verified: 0 arrow controls and 3 thumbnails on `/perfume/onyx-night` and
`/ritual/amber-body-mist`; 0 of each on `/set/temple-hearth-set`, which has one
image (`hasMultiple` false) — correct, not a regression.

### B. Mobile eyebrow — restructured, not patched

The range eyebrow and `<ProductPurchase>` are now one wrapped unit
(`flex flex-col gap-1.5`) instead of two siblings of a `gap-7 md:gap-16` column
with `-mb-10` cancelling the gap. The negative margin is gone entirely, so the
spacing no longer depends on arithmetic that only balanced at one breakpoint.

Measured gap between the two eyebrows:

| width | pair | gap |
| :-- | :-- | --: |
| 320px | The Ritual / Body Care Collection | 6px |
| 375px | The Ritual / Body Care Collection | 6px |
| 768px | The Ritual / Body Care Collection | 6px |
| 1440px | Scent Your Sanctuary / Home Fragrances Collection | 6px |
| 375px AR | عطِّر ملاذك / مجموعة عطور المنزل | 6px |

No overlap at any width, in either locale. Was −12px on mobile.

### C. Trust badges — four, two-up

`noBlindBuy` added to both dictionaries ("Try the tester before the seal is
broken" / "جرّب العيّنة قبل فتح القارورة"), ordered between `packaging` and
`returns` so the 2×2 grid reads as two pairs: what the house does to the parcel,
then what it offers a buyer who is not yet sure.

Returns changed to "7-Day Returns" / "إرجاع خلال ٧ أيام". The only remaining
"30-Day" anywhere in `src/` is the source brief quoting the old value.

Grid went `grid-cols-1 sm:grid-cols-3` → `grid-cols-2`. Three-across left a
fourth badge orphaned on its own line, and four-across is too tight for this
column — on `lg:` the page is two columns, so each badge would get roughly
100px. Two-up divides evenly and holds at 375px; verified by screenshot at both
375px and 1440px.

### D. Related rail — four

Default `limit` 3 → 4 in `getRelatedProductCards()`; the explicit `3` at the
ritual and set call sites → `4`. `/perfume/[slug]` uses the default. `kinds`
untouched at every call site.

Verified — 4 results, current product excluded, on every page shape:

| page | related |
| :-- | :-- |
| `/perfume/onyx-night` | sunlit-citrine, ivory-temple, silk-serenity, desert-lily |
| `/perfume/lapis` | sapphire, amber, emerald, opal |
| `/ritual/amber-body-mist` | the 3 sibling mists, then sunlit-citrine |
| `/set/temple-hearth-set` | 2 other sets, then 2 fragrances |

The last two show the top-up doing its job: neither collection holds four
candidates, and the rail fills from the rest of the catalogue rather than
returning short.

### Not run

`npm run build` — a production build writes to `.next` and would clash with the
dev server this was verified against. `tsc --noEmit` and `eslint` both pass; run
the build before deploying.
