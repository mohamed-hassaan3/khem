# EGP Base Pricing & Catalog Restructure

## Goal

Two changes that have to land together, because either one alone leaves the site
lying about its prices:

1. **The stored price becomes Egyptian Pounds.** `priceInCents` stops meaning US
   cents and starts meaning piastres. EGP becomes the base, the settlement
   currency, and what the prerendered HTML shows; USD, EUR, GBP, AED, and SAR
   become the converted displays — the exact inverse of what shipped in
   `prompts/auto-location-pricing.md`.
2. **The fragrance catalog is restructured**: new names, new prices, new volumes,
   two collections resized, and eight products that do not exist yet.

## Skills read

None. The hooks proposed `ai-sdk`, `auth`, `vercel-services`, and
`next-cache-components` across the last two turns; all four were keyword
matches. This task touches a seed-data module, a formatter, and a rate table —
no AI, no auth, no services, no cache directives. `AGENTS.md` §4 admits only
`clerk`, `supabase`, and `ai-sdk`, none of which this task reaches.

## Existing code inspected

| File | What it settled |
| :--- | :--- |
| `src/data/products.ts` | 7 collections, 21 products. Signature 6 × 100 ML, Noir 4 × 100 ML, Gemstone 3 × 50 ML, Body Care 1, Home Fragrance 1, Discovery 3, Gift 3. The header states three rules that constrain this work: bottle format is a property of the **collection**; every image URL is a **vetted Unsplash photo** (an invented slug 404s through `next.config.ts`); non-fragrances carry `format` instead of `concentration` and have empty note tiers. |
| `src/types/catalog.ts` | `priceInCents` is documented as "Smallest currency unit, per AGENTS.md §9 (29500 = $295.00)" — that comment becomes wrong and must change. `Product.slug` is the URL key and must stay unique. |
| `src/lib/currency.ts` | `BASE_CURRENCY`, the rate/rounding table, and `resolveCurrencyForCountry`, all written USD-first two turns ago. |
| `src/lib/cart.ts` | `FREE_SHIPPING_THRESHOLD_IN_CENTS = 20_000` and `SHIPPING_FEE_IN_CENTS = 2_500` — $200 and $25. Left alone they become EGP 200 and EGP 25, i.e. free shipping on almost every order. |
| `src/data/content.ts` | Ingredient pages link products by `{ name, slug }` (`usedIn`), and testimonials, journal titles, and the heritage timeline name fragrances in prose. Already carries stale references to "Rā Soleil", a product renamed to Ivory Temple in an earlier pass — this change fixes that drift rather than adding to it. |
| `src/lib/i18n/dictionaries/en.ts` | `featuredProduct: "Sekhem Ambré"` — a product name hardcoded in a dictionary. |
| `src/data/products.ts:1043` | `FEATURED_PRODUCT_SLUG = "kyphi-noir"` — points at a slug this change retires. |
| `src/data/embeddings.generated.json` | `"items": {}`. The semantic index is **empty**, so renaming products invalidates nothing. `npm run embed` remains a post-launch step, unchanged by this work. |

## Decisions and assumptions

1. **`priceInCents` keeps its name.** It mirrors the Prisma column in AGENTS.md
   §9, and renaming it to `priceInPiastres` would put the seed data out of step
   with the schema it exists to prefigure. What changes is every doc comment
   that says "cents" or "$": `types/catalog.ts`, `products.ts`, `format.ts`,
   `currency.ts`, `cart.ts`. **Flag for review: AGENTS.md §9 itself still reads
   `priceInCents Int // Stored in smallest unit e.g. 35000 = $350.00`. It is the
   source of truth and it is now wrong — but it is your document, so this change
   does not edit it.**

2. **Two different constants for "the default currency".** `BASE_CURRENCY`
   (EGP) is what prices are *stored and settled* in and what the static HTML
   renders. Unmapped countries still resolve to **USD**, not EGP — an
   international visitor understands dollars, and showing them piastres because
   the shop is Egyptian helps nobody. Egypt now gets the best case for free: the
   server renders EGP, the cookie says EGP, and there is no post-hydration swap
   at all for the home market.

3. **Rates invert, rounding follows the currency's size.** Rates become units
   per 1 EGP, derived from the USD table already in the file (÷ 48.5). EGP
   itself rounds to nothing — it is the stored figure and must display exactly.
   Converted currencies round to the nearest 0.50 and keep two decimals, because
   at these amounts (1,470 EGP ≈ $30) a 5-unit rounding step would be a 16%
   error. `RATES_REVIEWED` is bumped.

4. **Duplicate names across collections are allowed; duplicate slugs are not.**
   "Amber" is a Gemstone fragrance, a room spray, and a body mist. The visible
   `name` is exactly what you asked for in each case; the slug carries the
   disambiguator (`amber`, `amber-room-spray`, `amber-body-mist`), as does the
   SKU. Nothing reads ambiguously in the UI: the three live on separate pages,
   and both the card and the cart line already print the format token beside the
   name via `formatProductType`, so a bag shows "Amber · Room Spray".

5. **Every image URL comes from the set already vetted in `products.ts`.** The
   file header is explicit that an invented Unsplash slug returns a 404, and
   there is no way to verify a new photo id from here. New products therefore
   reuse photographs already in the file, chosen to match the new name, and
   **every URL in the finished file is checked with `curl -I` for a 200 before
   the task is called done.** If you want genuinely new photography, send the
   Unsplash URLs and they go in as a follow-up.

6. **Renaming a fragrance means rewriting it.** The stories are name-bound
   ("Sekhem is the word the Egyptians used for the vital force…"). Each renamed
   product gets a new `subtitle`, `description`, `story`, and image `alt` in the
   house voice — Egyptian heritage, editorial, no marketing filler — and note
   pyramids adjusted where the new name implies a different accord (Emerald
   cannot keep a leather-and-incense pyramid). The first note in each tier stays
   the signature one, per the header's warning that `ProductCard` reads
   `[0]` of each tier.

7. **Set prices are mine, and flagged.** You priced the fragrances, the sprays,
   and the mists; the three discovery sets and three gift sets were not
   mentioned but sit in the same array and would read as EGP 125 if left. They
   are repriced proportionally to their contents (table below) — change any
   figure and it is a one-line edit.

8. **Shipping thresholds move with the currency:** free shipping at **2,000
   EGP**, flat fee **90 EGP**, replacing the $200 / $25 pair.

## Target catalog

### Signature — 6 × 100 ML @ 1,470 EGP (`147000`)

| Current | New name | slug | SKU |
| :--- | :--- | :--- | :--- |
| Sekhem Ambré | Sunlit Citrine | `sunlit-citrine` | `KHEM-SIG-SUN-100` |
| Kyphi Noir | Onyx Night | `onyx-night` | `KHEM-SIG-ONX-100` |
| Ivory Temple | Ivory Temple *(unchanged)* | `ivory-temple` | `KHEM-SIG-IVO-100` |
| Lotus Blanc | Silk Serenity | `silk-serenity` | `KHEM-SIG-SLK-100` |
| Isis Rose | Desert Lily | `desert-lily` | `KHEM-SIG-DES-100` |
| Horus Gold | Crimson Sun | `crimson-sun` | `KHEM-SIG-CRM-100` |

Mapped by character, not by list order: the amber-and-saffron opener becomes
Sunlit Citrine, the smoky incense becomes Onyx Night, the white floral becomes
Silk Serenity, the rose becomes Desert Lily, the golden radiant becomes Crimson
Sun. `KHEM-SIG-RAS-100` (a "Rā Soleil" leftover) is corrected to `IVO`.

### Noir — 2 × 100 ML @ 2,880 EGP (`288000`)

| Current | New name | slug | SKU |
| :--- | :--- | :--- | :--- |
| Obsidian Elixir | Kyphi | `kyphi` | `KHEM-NOI-KYP-100` |
| Nile Absolue | Mendesian | `mendesian` | `KHEM-NOI-MEN-100` |

Both names are real ancient Egyptian perfumes, which the stories lean on: Kyphi
is the sixteen-ingredient temple compound the heritage timeline already
describes, and Mendesian is the myrrh-and-cassia oil of the Nile Delta.

### Gemstone — 6 × 50 ML @ 840 EGP (`84000`)

| Current | New name | slug | SKU |
| :--- | :--- | :--- | :--- |
| Lapis Éternel | Lapis | `lapis` | `KHEM-GEM-LAP-050` |
| Carnelian Ember | Amber | `amber` | `KHEM-GEM-AMB-050` |
| Turquoise Néfer | Turquoise | `turquoise` | `KHEM-GEM-TUR-050` |
| Duat Obscura *(from Noir)* | Sapphire | `sapphire` | `KHEM-GEM-SAP-050` |
| Anubis Ombre *(from Noir)* | Emerald | `emerald` | `KHEM-GEM-EME-050` |
| — *(new)* | Opal | `opal` | `KHEM-GEM-OPA-050` |

The two transfers change `collectionSlug` to `gemstone` and drop from 100 ML to
50 ML, which is the collection's format. Emerald's pyramid is rewritten green
(galbanum, fig leaf, vetiver); Sapphire keeps its cool depth. Opal is new —
iridescent, shifting, white amber and mineral musk.

### Home Fragrance — 4 × 200 ML @ 490 EGP (`49000`)

Names **Amber, Opal, Lapis, Turquoise**; `format: "Room Spray"`; slugs
`<name>-room-spray`; SKUs `KHEM-HOM-<XXX>-200`. The existing Noir Room Spray
becomes Amber. Three are new.

**Descriptions must describe a room spray** — an instant atmosphere, sprayed
into the air, five pumps to a room. The current copy is close; the mistake to
avoid is the Temple Hearth gift set, whose image alt calls it "a reed diffuser".

### Body Care — 4 × 150 ML @ 390 EGP (`39000`)

Names **Amber, Opal, Lapis, Turquoise**; `format: "Body Mist"`; slugs
`<name>-body-mist`; SKUs `KHEM-BOD-<XXX>-150`. The existing Kyphi Body Mist
becomes Amber. Three are new.

**Descriptions must describe a body mist and nothing else.** The current record
is named "Kyphi Body Mist" but its `format` says "Dry Body Oil" and its
description sells jojoba and squalane that absorb into skin — that is a
different product. Rewrite: a fine alcohol-light veil misted over skin and hair,
worn alone on warm days or layered under the eau de parfum it shares an accord
with. No oils, no absorption, no "dry oil".

### Sets — repriced, contents corrected

| Set | Was (USD) | Now (EGP) | Contents fix |
| :--- | ---: | ---: | :--- |
| The Initiation Set | $125 | **690** (`69000`) | Vials renamed to surviving Signature fragrances |
| The Noir Initiation | $185 | **1,290** (`129000`) | Now Kyphi 10 ml + Mendesian 10 ml |
| The Complete Library | $280 | **1,890** (`189000`) | "All 6 Signature / All 2 Noir / All 6 Gemstone"; format `14 × 3 ML Vials`, `volumeMl: 42` |
| The Gilded Offering | $520 | **2,700** (`270000`) | Two surviving flacon names |
| The Obsidian Coffret | $465 | **2,400** (`240000`) | Kyphi + Mendesian only — it can no longer claim three Noir fragrances; becomes `2 × 30 ML`, `volumeMl: 60` |
| The Temple Hearth | $285 | **1,190** (`119000`) | "Amber Room Spray 200ml"; the reed-diffuser alt text corrected |

## Files likely to change

- `src/lib/currency.ts` — base flip, inverted rates, rounding, fallback constant.
- `src/lib/format.ts`, `src/types/catalog.ts`, `src/lib/cart.ts` — unit comments;
  cart thresholds.
- `src/data/products.ts` — the restructure. Largest edit by far.
- `src/data/content.ts` — `usedIn` links, testimonial and journal prose, timeline.
- `src/lib/i18n/dictionaries/en.ts` / `ar.ts` — `featuredProduct`, and the
  conversion note now says orders are charged in **Egyptian Pounds**.
- `src/data/legal.ts` — the cookie-policy currency section says USD settlement.
- Collection descriptions in `products.ts`: Gemstone says "Three fragrances",
  Noir says "Limited editions" of four.

## Implementation requirements

- `BASE_CURRENCY = "EGP"`; add `FALLBACK_DISPLAY_CURRENCY = "USD"` and use it as
  the `resolveCurrencyForCountry` fallback. `getServerSnapshot` in
  `currency-provider.tsx` returns `BASE_CURRENCY`, so the static HTML is EGP.
- `CURRENCY_CONFIG`: `EGP { rate: 1, roundToMinor: 1, fractionDigits: "auto" }`;
  `USD 0.02062`, `EUR 0.01897`, `GBP 0.01608`, `AED 0.07572`, `SAR 0.07732`,
  each `{ roundToMinor: 50, fractionDigits: 2 }`.
- Every product keeps its full shape — no field dropped, note tiers non-empty
  for fragrances and empty for the rest, `isBestseller` / `tags` / `badge`
  preserved where they still make sense (a badge on a retired name goes with it).
- Products stay grouped by collection in array order, new arrivals first, so the
  default "Featured" sort still reads deliberately.
- New products get: three note tiers of three, a subtitle, a description, a
  story where fragrances have one (`null` for sprays and mists, matching the
  existing non-fragrance rows), `inventory` in the range the file already uses,
  and at least one image with `isPrimary: true`.
- `FEATURED_PRODUCT_SLUG` → `kyphi`.

## Security requirements

- No new input surface: this is seed data, a constant table, and copy. The only
  values that reach a URL are slugs, which stay lowercase-kebab and unique.
- Image URLs stay on `images.unsplash.com`, the sole remote host in
  `next.config.ts`. No new host is introduced.
- The rate table is static and server-and-client identical; nothing here fetches.

## Acceptance criteria

- [ ] `/perfumes` shows 14 fragrances: 6 Signature @ EGP 1,470 / 100 ML, 2 Noir
      @ EGP 2,880 / 100 ML, 6 Gemstone @ EGP 840 / 50 ML.
- [ ] `/room-fragrance` shows 4 sprays @ EGP 490 / 200 ML; `/body-care` shows 4
      mists @ EGP 390 / 150 ML, described as mists rather than oils.
- [ ] Every fragrance detail page resolves; no slug collides; no link in
      `content.ts` points at a retired slug.
- [ ] A visitor with `x-vercel-ip-country: EG` sees EGP with **no** swap after
      hydration; `GB` sees pounds; an unmapped country sees USD.
- [ ] The conversion note and the cookie policy both say orders are charged in
      Egyptian Pounds.
- [ ] Free shipping triggers at EGP 2,000, and the nudge counts down in EGP.
- [ ] Every `images.unsplash.com` URL in `products.ts` returns 200.
- [ ] Zero `any`; `tsc --noEmit`, `eslint`, and `next build` clean, both locale
      trees still prerendered.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
# Every catalog image resolves:
grep -o 'https://images.unsplash.com/[^"]*' src/data/products.ts | sort -u \
  | xargs -P8 -I{} sh -c 'printf "%s %s\n" "$(curl -s -o /dev/null -w %{http_code} "{}")" "{}"' \
  | grep -v '^200' || echo "all images 200"
```

## Manual test steps

1. `npm run dev`; open `/perfumes` → 14 fragrances, prices in EGP, Gemstone at
   50 ML and Signature/Noir at 100 ML.
2. Open `/collection/gemstone` → six fragrances; `/collection/noir` → two.
3. Open `/body-care` and `/room-fragrance` → four each, correct volumes and
   prices, and copy that describes a mist and a spray.
4. Open any product page → EGP price, no conversion note (EGP is the base).
5. Footer switcher → GBP: every price converts and the note reads "charged in
   Egyptian Pounds"; switch back to EGP and the note disappears.
6. Add one Signature bottle (1,470) to the bag → shipping charged; add a second
   (2,940) → free shipping, nudge gone.
7. Open `/ingredients/oud` and one journal article → every linked fragrance name
   resolves to a live product page.
