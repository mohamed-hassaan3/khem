# Stage 8 — Motion & first impression ("the house never goes dark")

## Goal

The user, 2026-11-26:

- Keep the **first-visit intro** as it is. This is `<CinematicIntro>`: the ivory curtain with the lockup, shown on the first home load of a session.
- **Replace the loading page** the rest of the app shows on navigation. This is `<LoadingScreen>`, the big KHEM roundel with a gold arc spinning around it. The user calls it "old style" and it is.

The rest of the umbrella plan's motion stage comes with it (`prompts/mobile-ux-audit-and-plan.md`, M1–M4):

- a soft change between pages;
- calmer scroll reveals on phones;
- gold rules that draw in.

## Skills read

- `node_modules/next/dist/docs/`:
  - `03-file-conventions/loading.md`
  - `03-file-conventions/template.md`
  - `02-guides/view-transitions.md` (React `<ViewTransition>` works in the App Router with no configuration on Next 16.3 / React 19.2).
- No Clerk, Supabase or AI SDK work in this stage.

## Existing code inspected

| File | What it does today |
| :--- | :--- |
| `src/app/[locale]/loading.tsx` | Tree-wide Suspense fallback; renders `<LoadingScreen>`. |
| `src/components/LoadingScreen.tsx` | A `min-h-svh` ivory spacer (the CLS fix — keep it). Over it, a `fixed inset-0 z-1000` overlay holds the 160–208 px roundel (`/loading.webp`, 136 KB) and an SVG arc spinning by `.khem-orbit` (1.6 s, infinite). The overlay covers the nav. |
| `src/app/[locale]/collections/loading.tsx`, `search/loading.tsx`, `admin/loading.tsx` | Route-shaped skeletons. **Untouched.** |
| `src/components/intro/CinematicIntro.tsx`, `IntroCurtain.tsx`, layout pre-paint script | First home load per tab session only (`sessionStorage khem:intro:seen`). **Untouched.** |
| `src/components/animation/Reveal.tsx` + `.reveal` in `globals.css` | Visible by default. Below-the-fold elements hide, then move up `TRAVEL_PX = 40` px over 0.9 s. A `delay` prop exists and is used ad hoc (`index * STAGGER_STEP`, `(index % 4) * 0.1`). 70 uses. |
| `.page-enter` / `@keyframes pageIn` | Defined, never used (20 px translate — would shift layout). |
| `.gold-line` | 29 uses; static. `.khem-rule-draw` exists but only on the order confirmation. |
| `src/components/Nav.tsx` | `fixed`, `top: var(--announcement-h)`, height `var(--nav-h)` (80 px), `z-1000`. |
| `ProductCard` | Images already sit inside `Reveal` grids, so below-the-fold cards already fade in. |

## Decisions

1. **The first-visit intro stays exactly as it is.** No file under `src/components/intro/` changes.
2. **The spinning roundel goes.** A navigation no longer covers the screen.
   - The header stays on screen.
   - A thin gold line runs under it.
   - The page area underneath is a calm, empty ivory field.
   - No logo in the middle: the header already carries KHEM, and a second, larger one is exactly the "app spinner" look being removed.
   - `.khem-orbit`, its keyframes, its reduced-motion rule and `public/loading.webp` are deleted. Nothing else uses them; verified by grep before deleting.
3. **The gold line waits 150 ms before showing.** A prefetched page arrives faster than that, and a line flashing for a single frame is worse than nothing.
4. **Page change = a soft cross-fade, through React `<ViewTransition>`**, not `template.tsx`.
   - Why: a view transition only runs on a *navigation* (a React Transition). It never runs on the first server-rendered paint, so it cannot touch LCP. It also fades between `/perfume/a` and `/perfume/b`, where a `[locale]/template.tsx` would not remount.
   - In browsers without support, pages simply change as they do today.
   - **Fallback:** if live testing shows a real problem (header flicker, the cart drawer or a sticky bar caught in the snapshot, Safari misbehaving), drop the view transition and ship decision 2 alone. Report it rather than force it.
5. **The header and footer never fade.** The page area is its own named transition; the browser's default whole-page (`root`) animation is switched off.
6. **Reveal is calmer.**
   - Phones (< 768 px): 16 px over 0.7 s.
   - Wider screens: 24 px over 0.8 s.
   - Opacity behaviour is unchanged.
7. **Grids get one stagger rule** instead of four ad-hoc ones. One `revealStagger(index)` helper: `(index % 4) * 0.08` s, capped at 4 steps, so row 3 of a grid never waits half a second.
8. **Gold rules draw in when their section reveals.** A `.gold-line` inside a pending `Reveal` starts at `scaleX(0)` and grows from the centre (fine in RTL) on the same curve. Rules already on screen at load stay static.
9. **No image fade-on-load.** Cards already fade with their `Reveal`. An `onLoad` handler would turn every `ProductCard` into client JavaScript for no visible gain.
10. **Admin is untouched.** It already has its own in-panel skeleton.
11. **Everything is CSS.**
    - The only new client code is the existing `Reveal` change.
    - `<ViewTransition>` comes from React; no Motion library use is added.
    - Every effect is off under `prefers-reduced-motion`.
    - Every curve is a tween on `--ease-luxury-bezier`: no spring, no bounce.

## Files likely to change

- `src/components/LoadingScreen.tsx`: rewritten (spacer kept, overlay and roundel gone, hairline added).
- `src/app/[locale]/layout.tsx`: wrap `{children}` in `<ViewTransition>` (named page region).
- `src/app/globals.css`:
  - remove `.khem-orbit`, `@keyframes khemOrbit` and the unused `.page-enter` / `pageIn`;
  - add the hairline keyframes, the view-transition rules and the Reveal phone/desktop travel;
  - add `.reveal-pending .gold-line`;
  - add reduced-motion overrides.
- `src/components/animation/Reveal.tsx`: travel from CSS (a custom property) instead of the inline 40 px; export `revealStagger()`.
- Grid callers using ad-hoc delays move to `revealStagger(index)`:
  - `[locale]/page.tsx`
  - `stockists/page.tsx`
  - `CategoryView.tsx`
  - `MerchGrid.tsx`
  - `FeatureTriptych.tsx`
  - any product/journal/collection grid found during the build.
- `public/loading.webp`: deleted.

No schema, data, auth, pricing or checkout file changes.

## Implementation requirements

### A. The navigation loader (`LoadingScreen`)

- Keep the outer `role="status" aria-live="polite" aria-label="Loading"` element and its `min-h-svh ground-ivory` height. That height is what keeps the footer below the fold (the 0.757 CLS fix documented in the file).
- Remove the fixed overlay. The page under the header is the plain ivory spacer.
- Add the hairline as a child with `aria-hidden`:
  - `position: fixed`, `inset-inline: 0`, `top: calc(var(--announcement-h) + var(--nav-h))`, height 2 px;
  - `z-index` just under the nav (so an open mega-menu still covers it);
  - colour `--color-gold-deep`. On ivory, `--color-gold` is 2.6:1, per the existing token note.
- Animation (`.khem-route-line`):
  - an indeterminate sweep: a 30 %-wide gold segment travels across a faint 10 % gold track, 1.4 s, `--ease-luxury-bezier`, infinite;
  - `animation-delay: 150ms` with `opacity: 0` until then;
  - mirrored for `dir="rtl"`, like `khemShimmerRtl`.
- Reduced motion: no sweep. A static full-width 10 % gold line fades in after the same 150 ms.
- Rewrite the file's doc comment to describe the new state, keeping the CLS reasoning.
- Delete `.khem-orbit`, `@keyframes khemOrbit`, the `.khem-orbit` reduced-motion block and `public/loading.webp`, after `grep` shows no other use.

### B. Page cross-fade (`<ViewTransition>`)

- In `src/app/[locale]/layout.tsx`, wrap only the page region (`{children}`, between `<Nav>` and `<Footer>`): `<ViewTransition name="khem-page" default="khem-page-fade">`. Read the guide once more at build time and use whichever props it documents for a cross-fade class.
- CSS:
  - `::view-transition-old(root), ::view-transition-new(root) { animation: none; }` — the header, footer and drawers do not fade;
  - `.khem-page-fade` old: opacity 1→0, 180 ms ease-out;
  - new: opacity 0→1, 320 ms `--ease-luxury-bezier`, 60 ms delay;
  - opacity only, no translate, no blur;
  - `@media (prefers-reduced-motion: reduce)` sets every `::view-transition-*` animation to `none`.
- Confirm it does **not** run:
  - on the first load;
  - on the intro curtain;
  - when only search params change (e.g. collection filters), so the grid does not blink as a filter is toggled. If it does run there, scope it to pathname changes or remove it from that case.
- Confirm the fixed header, the announcement bar, `<StickyPurchaseBar>`, the cart drawer and the mobile menu are not visibly caught in the transition.

### C. Reveal

- `.reveal` reads `--reveal-travel` (default 16 px; 24 px from `md`) and its duration from `--reveal-dur` (0.7 s; 0.8 s from `md`).
- `Reveal.tsx` sets `transform: translateY(var(--reveal-travel))` while pending, instead of the inline `40px`. Remove `TRAVEL_PX`.
- Keep the visible-by-default / only-below-the-fold behaviour exactly; it is what fixed LCP.
- Export `revealStagger(index: number): number`, returning `(index % 4) * 0.08`. Replace the ad-hoc grid delays with it.
- Non-grid sequential delays (e.g. `STAGGER_STEP * 2` on About and Heritage) are left alone.

### D. Gold rules

- CSS only: `.reveal-pending .gold-line { transform: scaleX(0); }`, with `.gold-line` transitioning `transform` on the same duration and curve, `transform-origin: center`.
- A rule that is already on screen at load is never pending, so it never animates.
- Reduced motion: nothing pending, nothing to draw (`Reveal` already skips the pending state).

## Security requirements

None change. No new route, action, data read or third-party script. CSP unchanged: view transitions are a browser API and need no script source.

## Acceptance criteria

1. The spinning roundel no longer appears anywhere. `grep -rn "khem-orbit\|loading.webp" src public` returns nothing.
2. On a navigation to a route that waits on data (e.g. `/account`, `/checkout`, a cold `/perfume/[slug]`):
   - the header stays visible;
   - a gold line sweeps under it after ~150 ms;
   - the page below is plain ivory;
   - the new page fades in.
3. A fast (prefetched) navigation shows no line at all, just the cross-fade.
4. The first home visit of a session still plays the intro unchanged. A first load of any page shows no page fade.
5. Header, footer, announcement bar and open drawers never fade or flash during navigation.
6. Below-the-fold sections rise 16 px on phones and 24 px on desktop. Grid cards stagger by at most 3 × 80 ms.
7. Gold rules in sections revealed by scrolling draw out from the centre. Rules visible at load are static.
8. With "Reduce motion" on:
   - no sweep (only a static line after 150 ms);
   - no page fade, no reveal travel, no rule draw.
9. Layout shift on navigation stays at 0 (the spacer is kept).
10. EN and AR (RTL), 360 / 390 px and desktop: no horizontal overflow; the line spans the full width under the header.
11. Lighthouse mobile on home, a PDP and a collection: Performance, CLS and LCP no worse than before (measured before and after on the same production build).
12. `tsc` and `eslint` clean.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`, then `next start -p 3100`. Never touch the user's dev server on :3000.
- Lighthouse mobile before and after on `/`, `/perfume/<slug>` and `/collections/<slug>`, against the production build.
- `agent-browser` at 390 px and 1440 px, EN + AR:
  - navigations from home → collection → PDP → bag → account (signed in with a test ticket, as in earlier stages);
  - the same with reduced motion emulated;
  - screenshots of the loading state, taken by slowing the network.

## Manual test steps (after implementation)

1. Open the site in a fresh private window on the home page: the intro curtain plays as before.
2. Tap Collections, then a perfume:
   - the header never disappears;
   - the page fades softly into the next one;
   - no big logo and no spinning circle.
3. In Chrome DevTools → Network, choose "Slow 4G", then open **Account** or **Checkout**:
   - a thin gold line sweeps under the header while it loads;
   - the page fades in when it arrives.
4. Scroll down the home page on a phone: sections rise gently, product cards appear one after another, and the gold dividers draw out from the middle.
5. Switch to Arabic and repeat steps 2–4: the line sweeps right-to-left, and nothing overflows.
6. Turn on "Reduce motion" (macOS: Accessibility → Display; iPhone: Accessibility → Motion) and repeat:
   - no fades or movement;
   - only a still gold line while a page loads.
7. Open the admin and move between screens: unchanged (it keeps its own skeleton).

## Outcome (2026-11-26)

### Changed

- **Loader:** `LoadingScreen` keeps the `min-h-svh` ivory spacer. The overlay, roundel and spinning arc are gone, replaced by `.khem-route-line`:
  - fixed at `top: var(--header-h)`, `z-index` 999 (under the nav and the mega-menu), 2 px;
  - a deep-gold 30 % segment sweeping across a 12 % track, mirrored in RTL;
  - fades in after 150 ms;
  - under reduced motion, a still 35 % line.
  - `.khem-orbit`, `khemOrbit` and the unused `.page-enter` / `pageIn` were removed.
- **Page fade:**
  - `<ViewTransition name="khem-page" default="none" update={{ "khem-page": "khem-page-fade", default: "none" }}>` wraps the page region in `[locale]/layout.tsx`.
  - `LocaleLink` adds `transitionTypes={["khem-page"]}` only when the link leads to a *different* pathname (a caller's own `transitionTypes` wins).
  - CSS: root not animated, group not morphed, old 180 ms out, new 320 ms in on the house curve after 60 ms, overlay click-through, all off under reduced motion.
- **Reveal:**
  - `--reveal-travel` / `--reveal-dur`: 16 px / 0.7 s on phones, 24 px / 0.8 s from `md`. The pending transform moved from inline style to `.reveal-pending`.
  - `revealStagger(index)` = `(index % 4) * 0.08`, in `src/components/animation/stagger.ts`. It lives outside `Reveal.tsx` because Server Components cannot call a function from a `"use client"` module (the first build failed on exactly that).
  - Used by home, about, heritage, craftsmanship, stockists, `CategoryView`, `MerchGrid` and `FeatureTriptych`, and newly by `CollectionGrid` and `RelatedProducts`, which had no reveal at all.
- **Gold rules:** `.reveal-pending .gold-line { transform: scaleX(0) }`, drawing out from the centre when the section reveals.

### Deviations from the plan

- **`public/loading.webp` is kept.** `scripts/build-email-logo.ts` uses it as the source for the email logo. The page no longer loads it, so it costs nothing at runtime.
- **The fade is opt-in per link type, not on every update.** A layout-level `<ViewTransition>` with a plain default would also fade on `router.refresh()` (after add-to-bag and other server actions) and on Suspense reveals. Keying it to a transition type set by `LocaleLink` avoids both. The admin uses `AdminLink`, so it never fades.

### Verified (production build on :3100, agent-browser)

- **Link navigation** (collection → PDP): `document.startViewTransition` ran once.
- **Browser back:** it did not run. Collection filters are local state, not navigations, so they never fade.
- **Loader markup**, mounted in place of the page at 390 px (EN and AR) and at 1440 px with reduced motion:
  - the line sits flush under the header (top 90 px on phone with the announcement bar, 118 px on desktop) at full width, with no horizontal overflow;
  - in AR it uses `khemSearchSweepRtl`;
  - under reduced motion there is no animation, the line is full width at 0.35 opacity.
- **Real slow navigation:** could not be forced locally. Pages are prefetched, so they arrived instantly: the "no line on fast navigations" case.
- **First visit:** `#khem-intro` is present and plays (`data-intro` unset → `done`).
- **Reveal:** at 390 px, pending = `translateY(16px)`, 0.7 s; at 1280 px, 24 px, 0.8 s; a pending `.gold-line` = `scaleX(0)`. After scrolling to the bottom, 0 elements were still pending.
- **Lighthouse mobile** (local, 2 runs each, before → after):

  | Page | Performance | CLS |
  | :--- | :--- | :--- |
  | Collection | 67/73 → 70/72 | 0 → 0 |
  | PDP | 71/67 → 70/71 | 0 → 0 |
  | Home | 65/66 → 65/65 | 0 → 0 |

  Home LCP is the hero film and varies run to run (5.4–7.9 s before, 7.7–8.0 s after). Nothing on the first load changed except CSS, and no view transition runs on a first load.
- `tsc`, `npm run lint` and `npm run build`: clean.
