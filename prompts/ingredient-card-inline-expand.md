# Ingredient Card — Inline Expansion, Price Tier Removal, Deep Link

## Goal

Three changes to the `/ingredients` experience:

1. **Inline expansion.** Clicking an ingredient card no longer renders a separate
   detail panel below the grid. The clicked card itself expands *in place*: on
   desktop the image stays exactly where it is (same cell, same column width) and
   the detail content slides out beside it, inline-start → inline-end, as if it had
   been hidden underneath the image. Cards after it flow down smoothly. On screens
   below `lg` the detail opens *underneath* the image inside the same card.
   All of it animated on the KHEM motion curve — no spring, no bounce.
2. **Delete the price tier.** The `"$$$$"` glyph run disappears from the card.
3. **Deep link.** Clicking an ingredient anywhere else on the site (perfume detail
   page, home rail) lands on `/ingredients?ingredient=<slug>` with that ingredient
   already expanded and scrolled into view — e.g. Oud on a PDP opens Oud as the
   active card.

## Skills read

None of the three approved skills (`clerk`, `supabase`, `ai-sdk`) apply — this is
a client-side UI/animation task on already-queried data. The relevant prior art is
in-repo: `src/components/ecommerce/CollectionGrid.tsx` (URL-parameter pattern) and
`src/components/animation/Reveal.tsx` (Motion conventions).

## Existing code inspected

- `src/app/[locale]/ingredients/page.tsx` — Server Component; ISR 3600; passes
  `ingredients` + `families` into `<IngredientExplorer>`.
- `src/components/ingredients/IngredientExplorer.tsx` — the whole surface being
  changed: family filter bar, 4-column grid of `<button>` cards, and a separate
  `#ingredient-detail` panel rendered after the grid.
- `src/components/ecommerce/ProductIngredients.tsx` — PDP rows, each a
  `LocaleLink href="/ingredients"`.
- `src/components/home/IngredientCard.tsx` — home rail card, same bare href.
- `src/types/content.ts` — `Ingredient` already carries a `slug`, plus
  `latinName`, `origin`, `families`, `rarity`, `priceTier`, `description`,
  `usedIn`, `facts`, `image`.
- `src/components/ecommerce/CollectionGrid.tsx` — the established pattern for a
  linkable client-side view parameter: read from `window.location.search` in an
  effect (never `useSearchParams`, which would strip the grid out of the
  prerendered HTML), write back with `history.replaceState`, re-read on
  `popstate`.
- `src/components/animation/Reveal.tsx` — Motion import style (`motion/react`
  behind a `"use client"` boundary), `EASE_LUXURY = [0.16, 1, 0.3, 1]`,
  `useReducedMotion`.
- `src/lib/i18n/dictionaries/{en,ar}.ts` — `ingredientsExplorer` block.

## Decisions and assumptions

- **Selection key becomes the slug, not the id.** The URL has to be readable and
  stable (`?ingredient=oud`), and `Ingredient.slug` already exists.
- **Expansion is a column span, not an overlay.** The selected card gets
  `sm:col-span-2 lg:col-span-4` so it occupies a full grid row. That is what makes
  the following cards reflow downward, and Motion's `layout` prop is what makes
  that reflow smooth rather than a jump.
- **The image column keeps the card's width.** Expanded, the card is
  `lg:grid-cols-[25%_1fr]` inside a `max-w-350` 4-column grid, so the image cell
  lands on the same 25% the collapsed card occupied — the image reads as staying
  put while the detail unfurls next to it.
- **Direction is logical, not physical.** The detail slides from the inline start,
  so in Arabic (RTL) it travels right → left. Derive the sign from `useLocale()` /
  the existing `dir` handling rather than hardcoding a negative `x`.
- **Below `lg` the panel opens vertically** (height + opacity), matching the
  request that mobile shows the detail beneath the image. Breakpoint is resolved
  with `window.matchMedia("(min-width: 1024px)")` inside an effect, so SSR output
  stays stable.
- **`priceTier` stays in the data model.** Only its rendering is removed; the
  `PriceTier` component and the now-unused `ingredientsExplorer.priceTier`
  dictionary key in both `en` and `ar` are deleted.
- **Deep-link arrival does not change the family filter.** The filter defaults to
  `All`, so any linked ingredient is visible; if a future default changed that,
  the effect falls back to clearing the selection as it already does.
- Reduced motion: opacity-only, no travel, no layout animation duration.

## Files likely to change

- `src/components/ingredients/IngredientExplorer.tsx` (rewrite of the grid/detail
  section)
- `src/components/ecommerce/ProductIngredients.tsx` (href gains the query)
- `src/components/home/IngredientCard.tsx` (href gains the query)
- `src/lib/i18n/dictionaries/en.ts`, `src/lib/i18n/dictionaries/ar.ts` (drop
  `priceTier`; add `closeDetails` + `origin` labels if the hardcoded English
  strings currently in the panel — `"Origin:"`, `"Close ingredient details"` — are
  to be localized, which they should be)

## Implementation requirements

1. **State**
   - `const [activeSlug, setActiveSlug] = useState<string | null>(null)`.
   - Effect on mount: read `ingredient` from `window.location.search`, accept it
     only if it matches a known slug, set it, and `scrollIntoView({ behavior:
     "smooth", block: "center" })` on that card once laid out. Re-read on
     `popstate`.
   - Toggling a card writes/deletes the `ingredient` param via
     `history.replaceState` — no router navigation.
   - `handleFamilyChange` keeps its current behaviour (drop a selection the new
     filter would hide) and must also clear the URL param when it clears the
     selection.
2. **Card markup**
   - Each grid cell is a `motion.div` with `layout` and a stable `key` (slug).
   - Collapsed: today's markup minus `<PriceTier>` — image block, name, latin
     name, origin line, family badges.
   - Expanded: same cell, `sm:col-span-2 lg:col-span-4`, laid out
     `grid-cols-1 lg:grid-cols-[25%_1fr]`; image on the inline-start side keeps
     `h-65` collapsed height as its `min-h` and stretches to the panel height on
     `lg`; the detail column carries the content currently in `#ingredient-detail`
     (rarity eyebrow, name, latin name, origin, gold divider, description,
     "Found in" perfume links, "Rare Facts"), plus the close `X`.
   - The clickable affordance stays a `<button>` for the collapsed card; when
     expanded, the header/close button is the control that collapses it. Keep
     `aria-expanded` and `aria-controls` pointing at the panel's id
     (`ingredient-detail-<slug>`), and keep the panel `role="region"` with an
     `aria-label` of the ingredient name.
3. **Animation**
   - `AnimatePresence` around the detail panel; `initial/animate/exit` on opacity
     plus inline-axis travel (desktop) or block-axis height (below `lg`), duration
     ~0.6s, `EASE_LUXURY` `[0.16, 1, 0.3, 1]`.
   - `overflow-hidden` on the panel wrapper so the content genuinely appears to
     emerge from under the image rather than fading in on top of the layout.
   - `useReducedMotion()` collapses every animation to an instant opacity change.
   - No layout shift of the image element itself: it must not re-mount when the
     card expands (same `<Image>` node, same `src`), so the browser does not
     re-request or flash it.
4. **Deep-link sources**
   - `ProductIngredients`: `href={`/ingredients?ingredient=${ingredient.slug}`}`.
   - Home `IngredientCard`: same.
   - Leave the generic `/ingredients` nav and craftsmanship CTA links untouched.
5. **Standards**: strict TypeScript, zero `any`, Server/Client boundary unchanged
   (the page stays a Server Component), Tailwind tokens only, RTL-safe logical
   spacing, `ltrIsland` retained for the Latin binomial.

## Security requirements

- The `ingredient` query value is untrusted: resolve it against the in-memory
  ingredient list and ignore anything that does not match a known slug. Never
  interpolate it into markup, an href, or a selector.
- No new data fetching, no new route handlers, no secrets touched.

## Acceptance criteria

- [ ] No `$` glyph run appears anywhere on `/ingredients`.
- [ ] Clicking a card expands it in place; the image does not move or reload; the
      detail appears beside it on `lg+` and beneath it below `lg`.
- [ ] Cards after the expanded one move down smoothly, not in a jump.
- [ ] Clicking the same card, or the close button, collapses it smoothly.
- [ ] Opening a second card closes the first with no double-expanded state.
- [ ] `/ingredients?ingredient=oud` loads with Oud expanded and scrolled into view.
- [ ] A PDP ingredient row and the home rail card both land on the right expanded
      ingredient.
- [ ] An unknown or missing `?ingredient=` value renders the plain grid.
- [ ] Family filter behaviour is unchanged; switching to a family that hides the
      open card collapses it and clears the URL param.
- [ ] Arabic locale mirrors the reveal direction; the Latin binomial stays LTR.
- [ ] `prefers-reduced-motion` yields an instant open/close.
- [ ] `npx tsc --noEmit` and `npm run lint` are clean.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` if it is already part of the normal loop for this repo

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/en/ingredients`.
2. Confirm no `$$$` on any card.
3. Click a card in the middle of the grid — detail opens to the right of its
   image, following cards slide down.
4. Click it again, then a different card; watch for a clean single-open state.
5. Resize to < 1024px — the detail opens under the image instead.
6. Visit `/en/ingredients?ingredient=oud` directly — Oud is expanded and centred.
7. Open a perfume detail page, click an ingredient row — it lands on the expanded
   ingredient.
8. Home page ingredient rail — same.
9. `/ar/ingredients` — layout mirrors, reveal travels the other way, binomial LTR.
10. Enable Reduce Motion in the OS and confirm instant transitions.
