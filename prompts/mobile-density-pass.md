# Mobile Density Pass — input zoom, spacing scale, two-up product grids

## Goal

Make the site read as *designed for a phone* rather than a desktop layout squeezed
into 375px. Three concrete outcomes:

1. **Focusing any text field must never zoom the viewport.** Today every field is
   13–14px, and iOS Safari force-zooms on focus for any font under 16px. The zoom
   is what makes the page "move right and left" afterwards — once zoomed, the
   layout is wider than the visual viewport and pans horizontally.
2. **Reduce the mobile spacing scale everywhere** — section padding, card padding,
   grid gaps, heading margins — so a phone screen carries content, not whitespace.
   Desktop composition is unchanged.
3. **Every product-style card grid is two-up on mobile** (perfumes, home spray,
   body mist, gift sets, related products, search results), with card internals
   shrunk to suit a ~170px column.

Scope is **mobile only** (`< 640px`, plus the `md:` step where the site's existing
breakpoint pattern lives). No desktop regression is acceptable.

## Skills read

- `AGENTS.md` §2.2 (spatial language), §3 (tokens), §11 (component standards).
- No external skill applies: this is a Tailwind v4 / CSS layout task with no
  Next.js data, AI SDK, Clerk, or Supabase surface. (The session hook suggested
  `ai-sdk` and `vercel-services` on a lexical false match — not read, not relevant.)

## Existing code inspected

- `src/app/globals.css` — `@theme` tokens, `@layer base/components`, the RTL and
  `[lang="ar"]` optical-size blocks at the end (unlayered, so they outrank
  utilities). No mobile-specific rules exist anywhere in the file today.
- Section wrapper pattern, used site-wide (~72 files):
  `className="… px-6 py-24 md:px-20 md:py-36"` — e.g.
  [page.tsx:177](src/app/[locale]/page.tsx#L177), `:203`, `:302`, `:431`, `:459`, `:470`.
  Mobile therefore gets **96px** of vertical section padding and 24px of gutter.
- Card grids, all `grid-cols-1` on mobile:
  - [CollectionGrid.tsx:350](src/components/ecommerce/CollectionGrid.tsx#L350)
  - [CollectionSkeleton.tsx:90](src/components/ecommerce/CollectionSkeleton.tsx#L90)
  - [CategoryView.tsx:230](src/components/ecommerce/CategoryView.tsx#L230)
  - [MerchGrid.tsx:101](src/components/ecommerce/MerchGrid.tsx#L101)
  - [RelatedProducts.tsx:40](src/components/ecommerce/RelatedProducts.tsx#L40)
  - [page.tsx:230](src/app/[locale]/page.tsx#L230) and `:314` (home, `sm:grid-cols-2 lg:grid-cols-4`)
  - [search/page.tsx:118](src/app/[locale]/search/page.tsx#L118) (`gap-x-6 gap-y-14`)
- [ProductCard.tsx](src/components/ecommerce/ProductCard.tsx) — `aspect-3/4` image,
  `p-6` body, `text-base` name, subtitle, up to 3 note pills, price/volume row.
  `DEFAULT_SIZES` currently claims `100vw` below 640px.
- [MerchCard.tsx](src/components/ecommerce/MerchCard.tsx) — `p-7` body, `text-lg`
  name and price, a description paragraph with `mb-6`, and a full-width
  `.btn-luxury` buy control. Same `100vw` mobile `sizes` claim.
- Field classes, all below the 16px iOS threshold:
  - `CheckoutField.tsx:105` → `text-[14px]`
  - `ContactForm.tsx:29` → `text-[13px]`
  - `CommentForm.tsx:44` → `text-[13px]`
  - `admin/fields.tsx:26` → `text-[13px]`
  - plus ad-hoc inputs in `SearchOverlay.tsx:380`, `SearchForm.tsx:49`,
    `NewsletterForm.tsx:100/131`, `AdminSearch.tsx:111`, `InventoryEditor.tsx:82`,
    `SignUpForm.tsx:66`, `ProductImageEditor.tsx`, `CurrencySwitcher.tsx:39`,
    `CollectionGrid.tsx:216` (`<select>`).
- `.btn-luxury` (globals.css) — `padding: 14px 36px`, `font-size: 11px`; the same
  chrome on every screen size.

## Decisions and assumptions

1. **Fix the zoom in one place, not sixteen.** Chasing every `text-[13px]` field
   would still miss the next one someone writes, and bumping the class to 16px
   would change desktop typography. Instead add one unlayered rule in
   `globals.css`, scoped to `@media (max-width: 767px)`, forcing
   `font-size: 16px` on `input`, `textarea`, and `select`. Unlayered so it beats
   Tailwind's utilities (same technique the existing `[lang="ar"]` block uses).
   The `viewport` meta is **not** touched — `maximum-scale=1` would "fix" the
   symptom by disabling pinch-zoom entirely, which is an accessibility failure.
2. **Kill the residual horizontal pan** with `overflow-x: clip` on `html, body`
   (`clip`, not `hidden` — `hidden` on `body` breaks `position: sticky` children,
   and the nav and `<StickyPurchaseBar>` both rely on it).
3. **Reduce spacing by editing the base classes, not by overriding Tailwind.**
   Every affected wrapper already carries a `md:` counterpart, so lowering the
   unprefixed value changes mobile *only* and leaves desktop byte-identical. This
   stays honest Tailwind — a future reader sees the real value in the markup
   instead of a hidden global override.
   **Mobile density scale** (base class → new base class; `md:`/`lg:` untouched):
   | current | mobile | current | mobile |
   |---|---|---|---|
   | `py-36` | `py-16` | `px-20` | `px-4` |
   | `py-30` | `py-14` | `px-14` | `px-4` |
   | `py-24` | `py-14` | `px-8` (section) | `px-4` |
   | `py-20` | `py-12` | `px-6` (section) | `px-4` |
   | `py-16` | `py-10` | | |
   Section gutter lands at **16px**. Card-internal and button padding are handled
   per component below and must not be swept by this table.
4. **A base class with no `md:`/`lg:` sibling on the same element gets one added**
   (restoring today's desktop value) rather than being lowered blind.
5. **Two-up on mobile** = change `grid-cols-1` → `grid-cols-2` on the six product
   grids. The `sm:grid-cols-2` in those same class strings becomes redundant and
   is dropped; `lg:` steps stay. Journal, ingredient, and stockist grids stay
   one-up — those are editorial cards with prose that would become unreadable at
   170px, and the user's request named product cards.
6. **Cards shrink to fit the new column.** At 375px a two-up cell is ~171px wide.
   Card typography and padding must come down accordingly (below), and the
   `sizes` hints must stop claiming `100vw` or every phone downloads a
   double-resolution image for a half-width slot.
7. `aspect-3/4` is kept on both cards. It is the brand's flacon crop, and two 3:4
   cells side by side is the standard boutique-grid proportion.

## Files likely to change

**Core**
- `src/app/globals.css` — mobile field-size rule, `overflow-x: clip`, mobile
  `.btn-luxury` / `.eyebrow` / `.note-pill` sizing.
- `src/components/ecommerce/ProductCard.tsx`
- `src/components/ecommerce/MerchCard.tsx`
- `src/components/ecommerce/DiscoverySetCard.tsx` (same treatment if it renders in a grid)

**Grids**
- `CollectionGrid.tsx`, `CollectionSkeleton.tsx`, `CategoryView.tsx`,
  `MerchGrid.tsx`, `RelatedProducts.tsx`,
  `src/app/[locale]/page.tsx`, `src/app/[locale]/search/page.tsx`

**Spacing sweep** — every `.tsx` under `src/app/[locale]/**` and `src/components/**`
carrying a section wrapper from the table in decision 3. Expect ~40 files.

## Implementation requirements

### 1. Input zoom (globals.css, unlayered, after the `[lang="ar"]` block)

```css
@media (max-width: 767px) {
  input,
  textarea,
  select {
    font-size: 16px;
  }
}
```
Comment it with *why* 16px (the iOS focus-zoom threshold), so nobody "tidies" it
back down to match the desktop field size. Line-height and padding stay as-is.

### 2. Horizontal stability

- `html, body { overflow-x: clip; }` in `@layer base`.
- Audit for real overflow sources while testing rather than masking them: check
  `IngredientCard` (`w-[260px]` in a horizontal scroller — fine), the home hero
  rings (`h-[450px] w-[450px]`, centred and clipped — fine), and
  `AdminTable` (`min-w-[720px]`, already inside `overflow-x-auto` — fine).

### 3. Spacing sweep

Apply the decision-3 table. Rules:
- Only the **unprefixed** class changes. Never touch `sm:`/`md:`/`lg:` variants.
- Only section/page wrappers and their heading blocks. Do **not** sweep padding
  inside buttons, pills, badges, table cells, or form fields.
- Where a swept element has no larger-breakpoint sibling, add one restoring the
  old value (`py-24` → `py-14 md:py-24`).
- Heading-block rhythm on mobile: `mb-16` → `mb-10`, `mb-12` → `mb-8`,
  `mb-10` → `mb-6` on section headers only, each with a `md:` restore.

### 4. `<ProductCard>`

- Body: `p-6` → `p-3 sm:p-6`.
- Collection eyebrow: keep `text-[9px]`, `mb-2` → `mb-1.5 sm:mb-2`.
- Name: `text-base` → `text-[13px] sm:text-base`, `tracking-wider` → `tracking-wide sm:tracking-wider`.
- Subtitle: `hidden sm:block` — at 171px it wraps to three lines and buries the price.
- Pills: keep the row, but show **one** pill on mobile. Do it in markup
  (`pills.slice(0, 1)` under a `sm:hidden` row is *not* acceptable — no duplicate
  DOM); use a wrapper utility instead:
  `[&>*:nth-child(n+2)]:hidden sm:[&>*:nth-child(n+2)]:inline-flex`, with a comment.
  Row margin `mb-4` → `mb-2.5 sm:mb-4`.
- Price/volume row: `pt-2` unchanged; price `text-sm` → `text-[13px] sm:text-sm`;
  volume `text-[10px]` → `text-[9px] sm:text-[10px]`.
- `DEFAULT_SIZES` → `"(min-width: 1024px) 25vw, 50vw"`. Update the `sizes` prop
  doc comment (it currently says "the grid is 1 → 2 → 4 columns"; it is now
  2 → 2 → 4). Audit every call site passing an explicit `CARD_SIZES` and correct
  its `100vw` tail to `50vw`.

### 5. `<MerchCard>`

- Body: `p-7` → `p-3.5 sm:p-7`.
- Name: `text-lg` → `text-[13px] sm:text-lg`; price `text-lg` → `text-[13px] sm:text-lg`.
- Description paragraph: `hidden sm:block` (with the `flex-1` spacer preserved so
  the buy button still bottom-aligns across a row of unequal cards).
- Price row: `mb-5` → `mb-3 sm:mb-5`, `pt-4` → `pt-3 sm:pt-4`.
- Buy button keeps full width; it inherits the compact `.btn-luxury` from §6.
- `DEFAULT_SIZES` → `"(min-width: 1024px) 33vw, 50vw"`.

### 6. Shared chrome (globals.css, inside the existing `@media (max-width: 767px)`)

- `.btn-luxury` → `padding: 11px 20px; font-size: 10px; letter-spacing: 0.16em;`
  — but keep a **44px minimum touch target** via `min-height: 44px`.
- `.note-pill` → `padding: 6px 12px; font-size: 11px;`
- `.mega-menu` padding `48px 80px` → `32px 24px` (it is desktop-triggered today;
  change only if it can render under 768px — verify before editing).
- Do not change `.eyebrow` unless the sweep leaves it visually orphaned.

### 7. Grids

Change to `grid-cols-2` on mobile and drop the now-redundant `sm:grid-cols-2`:
```
grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3
→ grid grid-cols-2 gap-px bg-border lg:grid-cols-3
```
`gap-px` / `gap-0.5` hairlines stay — they are the design's grid rule. The search
grid's `gap-x-6 gap-y-14` becomes `gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-14`.
`CollectionSkeleton` must mirror `CollectionGrid` exactly or the loading state
will reflow on hydration.

## Security requirements

None. No data access, no auth surface, no user input handling changes — this is
presentation-layer CSS and class-name work only. No new dependencies. Nothing
rendered from untrusted input changes.

## Acceptance criteria

- [ ] Tapping **any** input, textarea, or select on iOS Safari at 375px does not
      zoom the viewport, and the page cannot be panned horizontally afterwards.
      Verified on: contact form, checkout fields, comment form, newsletter,
      search overlay, admin search, currency `<select>`.
- [ ] No horizontal scrollbar / rubber-band at 320px, 375px, and 414px on any
      route.
- [ ] Perfumes, home spray, body mist, gift sets, related products, and search
      results all render **two cards per row** on mobile, with images sharp and
      no clipped or overlapping text.
- [ ] Card and section spacing is visibly tighter on mobile; a phone shows
      meaningfully more content per scroll than before.
- [ ] Every interactive control still has a ≥44px touch target.
- [ ] Desktop (≥768px) is **pixel-identical** to `main` on the home page,
      `/collections`, a PDP, and `/checkout`.
- [ ] RTL (`/ar`) mobile is checked alongside LTR — the gutter reduction must be
      logical (`px-*` is fine; any `pl-`/`pr-` found during the sweep becomes
      `ps-`/`pe-`).
- [ ] `npx tsc --noEmit` and `npx next lint` clean.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`, open DevTools device toolbar at **iPhone SE (375×667)**.
2. `/` — scroll the whole page. Confirm section padding is tight, the essences
   grid is two-up, no horizontal pan at any scroll position.
3. `/collections` — two-up grid; open the filter bar, change a facet, confirm the
   skeleton and the loaded grid have the same column count (no reflow flash).
4. `/collections/<slug>` and a merch category (home spray / body mist) — two-up,
   buy button reachable and ≥44px tall.
5. Open a PDP → scroll to Related Products → two-up.
6. `/search?q=oud` — two-up, tap the search field: **no zoom**.
7. `/contact` — tap name, email, subject `<select>`, and the message textarea in
   turn. No zoom on any of them; after focusing each, swipe left/right and
   confirm the page does not pan.
8. `/checkout` — walk every field including the delivery-instructions textarea.
9. A PDP comment form — tap the comment textarea and the name field.
10. Switch to `/ar` and repeat steps 2, 4, and 7; confirm the gutter is mirrored
    and Arabic labels are not cramped by the tighter spacing.
11. Resize to 768px and 1440px and compare against `main` side by side — desktop
    must be unchanged.
