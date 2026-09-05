# Mobile design adjustments — ingredients rail, craft pillars, cookie banner

## Goal

Three mobile-facing design corrections, no data or schema changes:

1. **Landing page, Ingredients section (mobile):** tapping a card must *toggle a
   detail panel open in place* instead of navigating to `/ingredients`. The
   detail unfolds vertically under the rail; the rail itself stays a
   horizontally-scrolling row exactly as it is today. Desktop keeps its current
   behaviour — the card is a link to `/ingredients?ingredient=<slug>`.
   This is the mobile counterpart of `IngredientExplorer`'s desktop behaviour,
   where the detail slides out horizontally beside the image.
2. **Landing page, Craft section (mobile):** the four pillars currently stack
   vertically under each other on a phone. They must scroll horizontally
   instead. `sm:` and up keep the existing 2-up / 4-up hairline grid.
3. **Cookie consent banner:** on desktop it currently spans a `max-w-5xl` card
   across the whole viewport bottom. It becomes a small card pinned bottom-end
   (right in LTR, left in RTL). On mobile it stays full width, but the paragraph
   under "Cookies at KHEM" is replaced by a shorter sentence.

## Skills read

None of `.agents/skills/{clerk,supabase,ai-sdk}` apply — this is presentational
work on already-rendered stored data. No new APIs, no queries, no schema.

## Existing code inspected

- `src/app/[locale]/page.tsx` — `ingredients` section (rail at ~L713-745) and
  `craft` section (~L515-573).
- `src/components/home/IngredientCard.tsx` — async Server Component, sole
  consumer is the landing rail.
- `src/components/ingredients/IngredientExplorer.tsx` — the established
  expand-in-place pattern: `motion` tween on `EASE_LUXURY`, `AnimatePresence`,
  `aria-expanded` / `aria-controls`, close button, `gold-line` divider,
  "Found in" / "Rare facts" columns.
- `src/components/consent/CookieConsent.tsx` — banner layout and motion.
- `src/services/content.ts` — `getIngredients()` already returns the **full**
  `Ingredient` (description, `facts`, `usedIn`, `rarity`, `latinName`);
  `getIngredientDetails()` is the same call. **No new query is needed.**
- `src/lib/i18n/dictionaries/{en,ar}.ts` — `cookieConsent.*`,
  `home.ingredients.*`, `ingredientsExplorer.*`.

## Decisions / assumptions

- **Anchor preserved, click intercepted.** The mobile card stays a real
  `<LocaleLink>` in the markup — losing the anchor would cost the crawlable link
  and the desktop navigation. On tap, a handler checks
  `matchMedia("(max-width: 767px)")` and, only when it matches, calls
  `preventDefault()` and toggles. Rendering two separate card trees (a link and
  a button) would double the `next/image` requests, which §"Vercel usage
  reduction" rules out.
- The rail must become a **Client Component** to hold the open slug. The page
  stays a Server Component and passes the already-queried rows down, matching
  how `IngredientExplorer` draws its client boundary. `IngredientCard.tsx` is
  absorbed into it and deleted (single consumer).
- The detail panel renders **after** the rail in DOM order and is `md:hidden`,
  so desktop never sees it and its markup costs nothing there.
- Craft on mobile: a flex row with `overflow-x-auto` and snap points; the
  `gap-px` over `bg-ground-border` hairline stays, so the rules still read as
  rules between cards.
- Cookie copy: a new `cookieConsent.bodyShort` key in **both** dictionaries.
  Long body `hidden sm:block`, short body `sm:hidden` — CSS, not JS, so there is
  no hydration branch and no layout shift.

## Files likely to change

- `src/components/home/IngredientRail.tsx` — **new**, client.
- `src/components/home/IngredientCard.tsx` — deleted (absorbed).
- `src/app/[locale]/page.tsx` — rail import/render; craft grid classes.
- `src/components/consent/CookieConsent.tsx` — positioning, width, dual body.
- `src/lib/i18n/dictionaries/en.ts`, `ar.ts` — `cookieConsent.bodyShort`.

## Implementation requirements

### 1. `IngredientRail` (new client component)

- `"use client"`. Props: `{ ingredients: Ingredient[] }`. Reads `useDictionary()`
  and `useLocale()`; never imports `src/services/content.ts`.
- Rail markup unchanged from today: `flex gap-0.5 overflow-x-auto pb-4 ps-4
  md:ps-20`, cards `w-[260px] sm:w-[300px] flex-none`, 380px image, name +
  `From {origin}` under a `border-t`.
- Card `<LocaleLink href={"/ingredients?ingredient=" + slug}>` gains
  `onClick`, `aria-expanded` and `aria-controls` (mobile panel id). The handler:
  if `event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0`,
  do nothing (let the browser open a new tab); else if the mobile media query
  matches, `preventDefault()` and toggle `activeSlug`; else fall through to
  navigation.
- Active card carries `border-gold/35 bg-gold/5` on mobile so the tapped card is
  identifiable once the reader has scrolled the rail.
- Panel: `md:hidden`, `AnimatePresence` + `motion.div`, `initial/exit`
  `{ opacity: 0, height: 0 }`, `animate` `{ opacity: 1, height: "auto" }`,
  `transition { duration: 0.6, ease: [0.16, 1, 0.3, 1] }`, `overflow-hidden`.
  Under `useReducedMotion()` collapse to opacity-only at duration 0.
- Panel content mirrors `IngredientExplorer`'s detail, minus the image (the
  card above it already carries the photograph): `rarity` eyebrow, name,
  `latinName` in `ltrIsland`, `From {origin}`, close `X` button
  (`dict.ingredientsExplorer.closeDetails`), `gold-line`, `description`
  (`dir="auto"`), then `foundIn` (links via `productHref()`) and `rareFacts`.
- On open, scroll the panel into view with `block: "nearest"` after one
  `requestAnimationFrame`, so the reader is not left above it.
- `Escape` closes the panel.
- No URL writes — the landing page is not a deep-link surface for a material,
  and `history.replaceState` here would leave `?ingredient=` on `/`.

### 2. Craft pillars

Container becomes:
`flex snap-x snap-mandatory gap-px overflow-x-auto bg-ground-border pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4`

Each `Reveal` cell adds `w-[80%] flex-none snap-start sm:w-auto`. Padding,
typography, gold rule and stagger are untouched.

### 3. Cookie banner

- Wrapper: `fixed inset-x-0 bottom-0 … flex justify-center sm:justify-end`
  (`justify-end` is logical, so RTL mirrors).
- Card: `w-full max-w-5xl` → `w-full sm:max-w-md` and drop `mx-auto`; padding
  `p-5 sm:p-6` (down from `p-6 sm:p-8`); keep the rounded gold border, the
  hairline top rule, `shadow-3`, and all motion as-is.
- Body: long text `hidden sm:block`, `copy.bodyShort` `sm:hidden`, same classes
  otherwise (`max-w-2xl` can go — the card is narrow now).
- Preferences panel and action row keep working inside the narrower card: the
  action row stays `flex-col` until `sm:`, and inside a `max-w-md` card the
  `sm:flex-row sm:justify-between` split must not overflow — verify the three
  controls still fit, and if they do not, keep the toggle on its own line.

**English `bodyShort`:** "A few cookies keep your bag intact and your
preferences remembered. No advertising, no ad networks, never sold."
**Arabic `bodyShort`:** "ملفات قليلة تحفظ حقيبتك وتفضيلاتك. لا إعلانات، ولا شبكات
إعلانية، ولا بيع لبياناتك."

## Security requirements

No user input, no network calls, no new data. The ingredient slug is used only
as a React key and an `href` built from a stored record; nothing is written to
the URL or to storage. `dangerouslySetInnerHTML` is not used anywhere.

## Acceptance criteria

- Phone: tapping an ingredient card opens the detail under the rail without
  navigating; tapping the same card or the `X` closes it; the rail still scrolls
  horizontally and keeps its scroll position.
- Desktop (`md` and up): the card navigates to
  `/ingredients?ingredient=<slug>` exactly as before, and no panel exists.
- Phone: the four craft pillars scroll horizontally, one mostly-full card at a
  time, hairlines intact; `sm`+ is byte-for-byte the current grid.
- Cookie banner sits bottom-right on desktop at roughly a third of its old
  width; on a phone it is full width with the shorter sentence.
- Zero TypeScript errors, zero ESLint errors, no `any`.
- Both locales render; the Arabic banner sits bottom-**left** and the ingredient
  panel mirrors correctly.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/en`.
2. DevTools device toolbar, iPhone 14 (390px):
   - Scroll to "Nature's Finest". Swipe the rail; tap a card → detail unfolds
     below, URL stays `/en`. Tap `X` → closes. Tap a second card while one is
     open → the first closes, the second opens.
   - Scroll to the craft section → the pillars swipe sideways.
   - Reload with cookies cleared → banner is full width, short sentence, and
     "Manage Preferences" still expands cleanly.
3. Back to desktop width (≥1024px):
   - Tap an ingredient card → navigates to `/ingredients?ingredient=<slug>` with
     that material open.
   - Clear `localStorage` and reload → banner is a compact card bottom-right.
4. Repeat step 2 on `http://localhost:3000/ar` and confirm the banner is
   bottom-left and nothing overflows.

---

# Addendum — the "Found in" list must name what each product *is*

## The problem

The detail panel's **Found in** list prints `usage.name` alone. The house sells
objects that share a name across ranges — a *Silk Serenity* perfume, a *Silk
Serenity* body mist and a *Silk Serenity* room spray are three different
products with three different pages. The list currently renders them as three
identical lines, and the only thing distinguishing them is the URL they open.

## What already exists (no migration needed)

- `public."ProductType"` — the stored enum, seven values, created by
  `0041_product_type.sql` and widened by `0052_product_type_and_volume.sql`.
  Its stated purpose in that header is *exactly* this: "telling a Body Mist from
  a Room Spray inside a range." Mirrored in TS as `PRODUCT_TYPE_VALUES` /
  `ProductType` in `src/lib/product-types.ts`.
- `IngredientUsage` already embeds the product:
  `usedIn:IngredientUsage(name, productSlug, sortOrder, product:Product(collection:Collection(kind)))`.
  Adding `productType` to that embed is one more column on an embed already
  being made — the same argument the `INGREDIENT_COLUMNS` doc comment makes for
  `kind`. **No migration, no new grant, no new query.**
- `PRODUCT_TYPE_LABELS` exists but is **admin-only English**, and its comment
  says outright that nothing on the storefront prints a product type. That
  changes here, so the storefront gets its own translated map rather than
  reaching into the dashboard's.

## Decisions

- The label comes from `productType` when stored, and falls back to the
  product's `collectionKind` when it is `null` — every row predating the column
  carries no type, and a blank token beside a name would be worse than a coarse
  one. Never renders empty.
- Both maps are new dictionary entries in **both** locales, beside
  `product.concentrations`, which answers the neighbouring question.
- `PRODUCT_TYPE_LABELS` is left exactly as it is. The dashboard's vocabulary and
  the storefront's are allowed to differ, and merging them would make an admin
  string a translated one.

## Changes

**`src/schemas/db/content.ts`**
- `INGREDIENT_COLUMNS`: `product:Product(productType, collection:Collection(kind))`.
- `embeddedProduct` gains `productType: z.enum(PRODUCT_TYPE_VALUES).nullable().default(null)`
  — nullable and defaulted, matching the existing reasoning on that schema: a
  widened select may degrade, never empty the list.
- `toIngredient`'s `usedIn` map emits `productType: usage.product ? first(usage.product).productType : null`.

**`src/types/content.ts`** — `IngredientUsage` gains
`productType: ProductType | null`, documented as "what the object *is*, so two
products sharing a name are distinguishable."

**`src/lib/product-types.ts`** — new exported helper:

```ts
export function usageTypeLabel(
  usage: { productType: ProductType | null; collectionKind: CollectionKind },
  labels: {
    productTypes: Record<ProductType, string>;
    collectionKinds: Record<CollectionKind, string>;
  },
): string
```

Returns the type label when the type is stored, else the kind label. Both
records are exhaustive `Record`s, so a future enum value fails to compile rather
than rendering blank.

**`src/lib/i18n/dictionaries/en.ts`** — under `product`, beside `concentrations`:

```
productTypes: {
  PERFUME: "Perfume", GIFT: "Gift", BOX: "Gift Box",
  ANTIQUE: "Antique", DECORATIVE: "Decorative",
  BODY_MIST: "Body Mist", ROOM_SPRAY: "Room Spray",
} satisfies Record<ProductType, string>,
collectionKinds: {
  FRAGRANCE: "Perfume", BODY: "Body Care", HOME: "Home Fragrance",
  DISCOVERY: "Discovery Set", GIFT: "Gift Set",
} satisfies Record<CollectionKind, string>,
```

**`src/lib/i18n/dictionaries/ar.ts`** — the same two maps:
`PERFUME: "عطر"`, `GIFT: "هدية"`, `BOX: "علبة هدايا"`, `ANTIQUE: "قطعة أثرية"`,
`DECORATIVE: "قطعة زينة"`, `BODY_MIST: "رذاذ الجسم"`, `ROOM_SPRAY: "معطر الغرفة"`;
`FRAGRANCE: "عطر"`, `BODY: "العناية بالجسم"`, `HOME: "عطور المنزل"`,
`DISCOVERY: "علبة الاكتشاف"`, `GIFT: "علبة هدايا"`.

**`src/components/ingredients/IngredientExplorer.tsx`** and the new
**`IngredientRail`** — each "Found in" row becomes two lines inside the existing
`LocaleLink`: the product name as now, and beneath it the label in
`text-[9px] uppercase tracking-[0.18em] text-ground-accent/50`. The hairline
dash, the hover colour transition and `productHref()` are untouched.

## Acceptance criteria (addendum)

- Three products sharing one name render three visibly different rows — the
  perfume reads "Perfume", the mist "Body Mist", the spray "Room Spray" — and
  each still opens its own page (`/perfume/…`, `/ritual/…`).
- A product whose `productType` is unset still shows a label, derived from its
  collection kind; no row is ever blank.
- Both locales print the label in their own language.
- Adding an eighth `ProductType` breaks the build at the two dictionaries rather
  than shipping a silent blank.

## Manual test (addendum)

On `/en/ingredients`, open a material used by more than one range (or add a
usage row from the dashboard pointing at a body-care product with the same name
as a perfume) and confirm the two rows are distinguishable and link apart.
Repeat on `/ar/ingredients`, and in the landing rail's mobile panel.
