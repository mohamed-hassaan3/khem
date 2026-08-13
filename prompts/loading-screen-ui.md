# Prompt — Global Loading Screen + Collections Skeleton

## Goal

Two loading states, each matched to the wait it covers:

1. **Global** — a luxury full-screen state for route transitions across the
   whole `[locale]` tree: flat primary background, the KHEM roundel
   (`/loading.webp`) centred, a gold arc rotating around it.
2. **Collections** — a **skeleton**, not the roundel, while
   `/collections` and `/collections/[slug]` fetch. Plus an honest treatment of
   the facet filter, which has no fetch to wait on at all.

## Skills read

None of `.agents/skills/{clerk,supabase,ai-sdk}` apply — presentational route
UI, no auth, data layer, or model calls.

## Existing code inspected

- `src/app/[locale]/layout.tsx` — `<Nav />` and `<Footer />` wrap `{children}`,
  so a sibling `loading.tsx` renders *between* them, not over the viewport. The
  global screen is therefore `fixed inset-0` with its own background.
- `src/app/globals.css` — `@theme` tokens (`--color-background: #0d0d0d`,
  `--color-gold: #c8a96a`, `--color-surface`, `--color-border`,
  `--ease-luxury-bezier`), the `.gold-line` / `.section-divider` gold-gradient
  idiom, and the trailing `@keyframes pageIn` block where new keyframes belong.
- `body` paints a radial gradient, not a flat colour — the overlay sets
  `background: var(--color-background)` explicitly so "blank primary colour" is
  literal.
- `public/loading.webp` — 1536×1024, VP8X with a real alpha channel (verified:
  alpha flag set, `ALPH` chunk present). The white field in a preview is
  transparency, so the roundel drops onto obsidian with no white box. The
  artwork is a circle centred in a landscape canvas, so `object-contain` in a
  square box centres it exactly.
- `src/components/ecommerce/CollectionView.tsx` — Server Component: hero
  (`h-[60vh] min-h-105`), breadcrumb, eyebrow + title, then description/sort
  bar, tab bar, facet chips, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
  gap-px bg-border`. This is the shape the skeleton must mirror.
- `src/components/ecommerce/CollectionGrid.tsx` — `'use client'`. Filtering and
  sorting are `useMemo` over an in-memory array (lines 130–155): **synchronous,
  zero await**. The facet also comes from `window.location.search` in a
  `useEffect`, deliberately, to keep the route prerenderable.
- `src/components/ecommerce/ProductCard.tsx` — the card the skeleton imitates.

## Decision: skeleton vs. spinner (asked for explicitly)

**Skeleton for the collections route; no loading indicator on the filter
itself; the roundel spinner stays global.**

- A spinner on the facet chips would be theatre. `filtered`/`sorted` resolve in
  the same tick as the click — there is nothing to wait for, and a deliberate
  delay to make a spinner visible would make the page objectively slower.
- At the route boundary the wait is real (ISR miss, cold data fetch), and there
  a skeleton beats the full-screen roundel: it preserves the hero → bar → chips
  → grid rhythm, so content lands into its own outline instead of replacing a
  black field, which removes the layout jump and reads as the page arriving
  rather than the app stalling.
- The roundel screen still earns its place as the tree-wide default for routes
  with no bespoke skeleton — it is brand, not diagnostics.
- One real defect *is* worth fixing here: arriving at
  `/collections?facet=best-sellers` paints the full catalog, then narrows on
  hydration — a visible flash of unfiltered content. Covered below.

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/components/LoadingScreen.tsx` | new — roundel + orbiting gold ring |
| `src/app/[locale]/loading.tsx` | new — tree-wide boundary |
| `src/components/ecommerce/CollectionSkeleton.tsx` | new — collections skeleton |
| `src/app/[locale]/collections/loading.tsx` | new — renders the skeleton |
| `src/app/[locale]/collections/[slug]/loading.tsx` | new — renders the skeleton |
| `src/components/ecommerce/CollectionGrid.tsx` | facet-flash fix + grid fade |
| `src/app/globals.css` | `@keyframes khemOrbit`, `khemShimmer`, helpers |

## Implementation requirements

### 1. `<LoadingScreen />` — Server Component, CSS-only animation

- `fixed inset-0 z-[1000] flex items-center justify-center`,
  `background: var(--color-background)` (flat `#0d0d0d`, no gradient).
- `role="status"` `aria-live="polite"` `aria-label="Loading"`.
- Logo: `next/image`, `src="/loading.webp"`, `priority`, explicit
  `width`/`height`, `object-contain`, `alt=""` (decorative — the status role
  carries the meaning). Box `h-40 w-40`, `md:h-52 md:w-52`.
- Ring: inline SVG, `viewBox="0 0 100 100"`, absolutely positioned and sized
  ~1.35× the logo box so it orbits clearly outside the roundel's own gold rim.
  - static track: `r=47`, `stroke: var(--color-border-gold)`, `stroke-width: .6`
  - moving arc: same `r`, `stroke: var(--color-gold)`, `stroke-width: 1`,
    `stroke-linecap="round"`, `stroke-dasharray="70 225"` (≈24% of the
    circumference), `transform-origin: center`.
- `.khem-orbit` → `animation: khemOrbit 1.6s linear infinite` (0 → 360deg).
  Linear and continuous — no spring, no bounce (AGENTS §2.2).

### 2. `<CollectionSkeleton />` — Server Component, no props

Mirrors `<CollectionView>` block for block, at identical heights so nothing
shifts on swap:

- Hero: `h-[60vh] min-h-105` `bg-surface` with the same
  `bg-linear-to-t from-background` scrim; inside it, placeholder bars for the
  breadcrumb (w-40 h-3), eyebrow (w-28 h-2.5) and title (w-80 h-10 / md:h-14).
- Description + sort bar: `border-b border-border px-6 py-10 md:px-20`, two
  text bars and a `w-44 h-10` control block.
- Tab bar and chip row: 4–5 pills, `h-9`, widths varied (`w-24`, `w-32`,
  `w-28`, `w-36`) so it reads as type, not as a progress bar.
- Grid: 6 cells in `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border`,
  each an `aspect-[3/4]` `bg-surface` block plus two caption bars under it.
- Every placeholder: `bg-white/[0.045]` with a `.khem-shimmer` sweep —
  `background-image: linear-gradient(90deg, transparent, color-mix(in srgb,
  var(--color-gold) 7%, transparent), transparent)`, `background-size: 200% 100%`,
  `animation: khemShimmer 1.8s var(--ease-luxury) infinite`. Gold at 7%, not
  white: a white sweep on obsidian reads as a cheap SaaS placeholder.
- Sweep direction must not be hardcoded LTR — under `[dir="rtl"]` reverse it.
- Wrapper carries `role="status"` `aria-label="Loading collection"` and the
  placeholder blocks are `aria-hidden`.

### 3. Facet flash + filter transition in `<CollectionGrid>`

- Keep the `useEffect` URL read (the prerender rationale in the file's header
  comment stands — do not swap it for `useSearchParams`).
- Read `window.location.search` **synchronously during the first client render**
  (a lazy `useState` initialiser guarded for SSR) so hydration narrows the grid
  in the same commit instead of a frame later. The `useEffect` stays, reduced to
  the `popstate` subscription.
- On facet/sort change, fade the grid: `key={`${facet}-${sort}`}` on the grid
  container plus a 250ms opacity/translate-y fade-in reusing the existing
  `pageIn`-style curve. This is the honest substitute for a spinner — it marks
  the change without inventing a wait.

### 4. Accessibility

- `prefers-reduced-motion: reduce` → `khemOrbit` and `khemShimmer` both
  `animation: none`; the ring shows full (`stroke-dasharray: none`) and
  placeholders sit at their base fill. The grid fade is disabled too.

## Security requirements

None — static presentational markup, no user input, no network, no secrets.
The `?facet=` value is already parsed through `parseFacet()`, which rejects
unknown values; that path is unchanged.

## Acceptance criteria

- [ ] Route transitions in the locale tree show the roundel on flat `#0d0d0d`
      with a gold arc orbiting it, concentric at every breakpoint.
- [ ] No white box behind the logo; no layout shift when content swaps in.
- [ ] Rotation is perfectly linear and continuous — no bounce, no easing pop.
- [ ] `/collections` and `/collections/[slug]` show the skeleton, not the
      roundel, and its blocks land where the real content lands.
- [ ] Shimmer is gold-tinted and subtle; it sweeps the correct way under `/ar`.
- [ ] Clicking a facet chip re-renders instantly with a fade — no spinner, no
      artificial delay.
- [ ] Landing on `/en/collections?facet=best-sellers` never paints the full
      catalog first.
- [ ] Reduced-motion: static ring, static placeholders, no fade.
- [ ] `tsc` and ESLint clean; zero `any`; server/client boundaries unchanged.

## Checks to run

```
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`.
2. `http://localhost:3000/en` → click through to `/en/perfumes`, `/en/heritage`:
   the roundel screen appears during each transition.
3. DevTools → Network → Slow 3G, then navigate to `/en/collections` — the
   skeleton holds; watch that the hero and first grid row do not jump when the
   real content replaces it.
4. Load `/en/collections?facet=best-sellers` cold and watch the first paint —
   the grid must never flash the full catalog.
5. Click each facet chip and both sort options: instant, with a short fade.
6. Repeat 3–5 on `/ar/collections`; confirm the shimmer sweeps right-to-left
   and the layout mirrors.
7. Resize 375px → 1440px; ring stays concentric, skeleton grid reflows 1/2/3-up.
8. Enable macOS "Reduce motion", reload — ring full and still, no shimmer.
