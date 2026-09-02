# Navigation & Footer: Body Care and Home Fragrance as Expandable Groups

Source brief: `src/docs/Product-Landing-Page-Navigation-Inventory-Updates.md` §3, and the
product-type question in §2.

Independent of the other three workstreams.

---

## Goal

Turn `BODY CARE` and `HOME FRAGRANCES` into expandable parent categories with
children (`Body Mist`, `Room Spray`), using the disclosure pattern the nav
already has, and in a shape that accepts a third and fourth child without a
rebuild.

## Skills read

- `AGENTS.md` §2.2, §7 (structure), §8 (routing matrix), §12
- `src/docs/khem-ui-design-system.md`
- No external skill applies.

## Existing code inspected

| Concern | File |
| :-- | :-- |
| Nav/footer structure | `src/constants/navigation-pages.ts` |
| Group rendering | `src/components/Nav.tsx:175, 652, 832` |
| Footer flattening | `src/components/Footer.tsx:188-199` |
| Disclosure UI | `src/components/FooterDisclosure.tsx`, `src/components/FooterGroup.tsx` |
| Labels | `dict.nav.collectionGroups`, `dict.nav.collectionItems` |
| Catalog shape | `supabase/seed/catalog.json`, `src/types/catalog.ts` |
| Facets | `src/lib/facets.ts` |

---

## The good news, and the catch

**The structure already exists.** `CollectionEntry` in `navigation-pages.ts` is a
discriminated union:

```ts
type CollectionEntry =
  | ({ kind: "link" } & CollectionLink)
  | { kind: "group"; key: CollectionGroupKey; children: ReadonlyArray<CollectionLink> };
```

`fragrances` and `scentProfiles` are already groups. The Nav renders a group
behind a chevron; the Footer flattens groups away through the derived
`collectionLinks`; labels are looked up by typed `key`, so **an untranslated
entry is a compile error, not an English string leaking into Arabic**. Adding a
child is one array line.

**The catch: the child destinations do not exist.** The catalog has seven
collections and no `body-mist` or `room-spray` among them:

| slug | kind | products |
| :-- | :-- | --: |
| `signature`, `noir`, `gemstone` | FRAGRANCE | 6 / 2 / 6 |
| `body-care` | BODY | 4 |
| `home-fragrance` | HOME | 4 |
| `discovery`, `gift-set` | DISCOVERY / GIFT | 3 / 3 |

Every body-care product is a Body Mist and every home-fragrance product is a
Room Spray. Today the parent and the child would be **the same four products at
two URLs** — which is the second-URL-for-the-same-goods problem the file's own
header says was deliberately removed.

## The decision this workstream must make first

`Product.format` already holds the product type as text — `"Body Mist"`,
`"Room Spray"`, `"6 × 3 ML Vials"`, `"Room Spray · Candle · Incense"`. It is a
**display string, not an enum**, and it is `null` on fragrances.

Three options; pick one and state why before writing code:

1. **Facet on `format`** — children become `/collections/body-care?format=body-mist`,
   handled by `src/lib/facets.ts`. Cheapest, no new collections, no migration.
   But `format` is free text, so the facet needs normalisation, and the brief
   warns against menu links that land on the catalogue "with a filter silently
   applied" — the existing house rule is that a menu link reaches a page with a
   hero and a name.
2. **A typed product-type column** — add a `ProductType` enum (or a
   `productType` text column with a check constraint), backfilled from `format`.
   Children become real facet pages with their own hero and copy. More work,
   and it is the shape that actually scales to Body Cream and Candle.
3. **New collections** — `body-mist`, `room-spray` as `Collection` rows under the
   BODY/HOME kinds. Fits the existing `/collections/[slug]` route with zero new
   routing, but makes "Body Care" a parent with no page of its own and needs a
   decision about whether products move or are cross-listed.

> ## ✅ DECIDED — option 2, a typed product-type field.
>
> Chosen by the user. Options 1 and 3 are recorded above only as the
> alternatives that were weighed; do not revisit them.

**Recommendation was option 2**, because the brief's explicit requirement is
future-proofing ("Body Cream", "Candle", "Future Category") and options 1 and 3
both encode the current two-type situation into either free text or collection
rows. Confirm with the user before implementing — this is the one genuinely
architectural choice in this workstream.

## Implementation requirements

Once the destination shape is settled:

1. Convert `bodyCare` and `homeFragrance` from `{kind: "link"}` to
   `{kind: "group", children: [...]}` in `navigation-pages.ts`.
2. Add `bodyCare` and `homeFragrance` to `dict.nav.collectionGroups` and the new
   children to `dict.nav.collectionItems`, in **both** dictionaries. The
   `CollectionGroupKey` / `CollectionKey` types will enforce this.
3. Change no renderer. If Nav or Footer needs editing to display these groups,
   something has been done wrong — they are already generic over
   `CollectionEntry`. The one thing to verify is that the Footer's flattening
   still produces a sensible sitemap when a parent is no longer itself a link.
4. Decide explicitly what happens to the parent row. `fragrances` and
   `scentProfiles` are disclosures with **nothing to navigate to**. If Body Care
   keeps a page of its own, this is a new pattern (a group whose parent is also a
   link) and the union must be extended to express it rather than faked.
5. Keep the same chevron, timing and easing as the existing disclosures.

## Decisions and assumptions

- No renderer rewrite. The scalability the brief asks for is already present in
  the type; this workstream supplies data and destinations.
- Both dictionaries move together.
- The Footer stays a flat sitemap.

## Files likely to change

- `src/constants/navigation-pages.ts`
- `src/lib/i18n/dictionaries/{en,ar}.ts`
- `src/lib/facets.ts` *(options 1 and 2)*
- `supabase/sql/00XX_product_type.sql` *(option 2 only)*
- `src/types/catalog.ts`, `src/schemas/db/catalog.ts` *(option 2 only)*
- `src/components/{Nav,Footer}.tsx` — only if step 4 needs it

## Security requirements

- A facet value arriving from the URL is request-derived: validate it against a
  fixed allowlist before it reaches a query, exactly as `src/lib/facets.ts`
  already does. Never interpolate it into SQL or pass it through to `.eq()` raw.
- Option 2's migration is additive (new column, backfill). No destructive DDL.

## Acceptance criteria

- [ ] `BODY CARE` and `HOME FRAGRANCES` expand and collapse like `Fragrances`, in Nav desktop, Nav mobile and Footer
- [ ] Children reach a real page with a name, not the catalogue with a hidden filter
- [ ] Adding a hypothetical third child is a one-line change — demonstrate it in the PR description
- [ ] No English label appears in the Arabic tree; RTL chevron direction is correct
- [ ] `npx tsc --noEmit` and `npm run lint` clean

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`
2. Desktop nav → hover/open Collections → expand Body Care, then Home Fragrances
3. Mobile nav at 375px → same two disclosures, check tap targets
4. Footer → both ranges and their children appear flattened, no dead headings
5. `/ar` → repeat 2–4; chevrons point the RTL-correct way
6. Follow every new child link and confirm a real page with a heading
7. Confirm the parent row still behaves as decided in step 4 of the requirements

---

## Implementation record

Built as decided. Everything below compiles and lints clean.

| Piece | Where |
| :-- | :-- |
| Enum, column, backfill, cross-table trigger, index | `supabase/sql/0041_product_type.sql` |
| Code-owned type table | `src/lib/product-types.ts` |
| Card query | `getProductCardsByProductType()` in `src/services/products.ts` |
| Route + metadata branch | `src/app/[locale]/collections/[slug]/page.tsx` |
| Nav/footer structure | `src/constants/navigation-pages.ts` |
| Page + nav copy, both trees | `src/lib/i18n/dictionaries/{en,ar}.ts` |

Decisions taken while building:

- **`format` is left alone.** It stays display copy (`"6 × 3 ML Vials"`,
  `"Room Spray · Candle · Incense"`); `"productType"` is derived from it once, in
  the migration, and the two then serve different jobs. Backfill matches the
  collection kind *and* the exact string, which is what keeps the gift set
  `temple-hearth-set` — whose `format` mentions a room spray — off the Room Spray
  page.
- **The range keeps its page, as the first child.** `All Body Care` →
  `/collections/body-care` sits under the `Body Care` heading, mirroring how
  `All Products` opens the column. This avoided extending `CollectionEntry` to
  express "a group that is also a link", so **no renderer changed** — Nav and
  Footer were not touched.
- **Children are generated from `PRODUCT_TYPES`**, not written out in the nav
  table. Adding Body Cream is one row in `src/lib/product-types.ts`, one enum
  value, and copy in both dictionaries; the menu and the footer follow.
- **No `ProductTypePage` table.** These pages render from the dictionary and
  inherit the parent range's banner, so a new type needs no photograph. If
  editors later need to write them, copy the `"ScentProfile"` shape — a stored
  row that wins whole over the dictionary, never field by field.
- The cross-table rule (`BODY_MIST` only under a `BODY` collection) is a
  **trigger**, not a check constraint, because the kind lives on `"Collection"`
  and a check constraint cannot subquery.

### Verified

- `npx tsc --noEmit`, `npm run lint` — clean
- Nav renders in both locales with the two new disclosures; footer flattens to
  13 links including `/collections/body-mist` and `/collections/room-spray`
- The four compile errors raised while wiring this up were all missing dictionary
  keys — the typed-key guarantee doing its job

### Applied and verified

`supabase/sql/0041_product_type.sql` has been applied to production
`ttekisapxjforpawnnla` by the user.

| Check | Result |
| :-- | :-- |
| Typed rows | 8 — the four body mists and the four room sprays |
| Misplaced rows | 0 |
| `temple-hearth-set` (gift set, `format` mentions a room spray) | `null` — correctly excluded |
| Range products left untyped | 0 |
| Trigger, given `BODY_MIST` on a FRAGRANCE | rejected: *"Product onyx-night: BODY_MIST belongs to a BODY collection, not FRAGRANCE."*, row unchanged |
| `/collections/body-mist`, `/collections/room-spray` | 200, correct h1, exactly the right 4 products, inherited banner |
| Arabic equivalents | 200, `بخّاخ الجسم` / `بخّاخ الغرفة`, same 4 products |
| Nav + footer, both locales | both disclosures and all children present; 3 links each to the new pages |
| `npx tsc --noEmit`, `npm run lint` | clean |

### Dumper extended — the stated exception

`scripts/db-dump.ts` and `scripts/db-seed.ts` did **not** carry `"productType"`,
so `db:seed` run after `db:migrate` would have written products with the column
null and left both new pages empty, silently. That is the "unless a workstream
actually requires it" case, so the column was added to both scripts and to
`ProductSeedRow` in `scripts/seed-types.ts`.

It is declared on the seed row rather than on the app's `Product` type on
purpose: the storefront never reads this value off a product object — it is a
*filter*, applied in `getProductCardsByProductType()` — so putting it on
`Product` would oblige every card and detail parse to carry a field none of them
uses.

Round-trip verified: `npm run db:dump` now emits `productType` on the eight rows
and `null` on `temple-hearth-set`.

`MarketingSetting` remains outside the dumper. That is untouched and still open
as a separate persistence follow-up.
