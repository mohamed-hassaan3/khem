# Product Gallery Carousel — scrollable PDP image track

## Goal

Turn the product detail page gallery
(`src/components/ecommerce/ProductGallery.tsx`, rendered by
`src/app/[locale]/perfume/[slug]/page.tsx`) from a stacked cross-fade into a
**horizontal carousel the visitor can scroll left and right**:

- swipe / trackpad / drag horizontally on the image itself,
- gold chevron arrows to step one frame at a time,
- the existing thumbnail strip keeps working as a jump target and stays in sync
  with whatever the scroll position actually is,
- keyboard `←` / `→` when the track has focus, and a visible focus ring.

Correct in Arabic (RTL) as well as English, and unchanged in behaviour when a
product has exactly one image.

## Skills read

None of the three approved skills apply. This is a pure client-side UI change:
no auth surface (`clerk`), no schema/query change (`supabase`), no model call
(`ai-sdk`). The auto-injected `ai-sdk` / `vercel-services` suggestions were
lexical false positives on "scroll"/"images" and were **not** followed.
Reference for the interaction: existing project scroll patterns listed below.

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `src/components/ecommerce/ProductGallery.tsx` | Current cross-fade implementation, thumbnail strip, `SIZES`, `aria-current` on thumbs |
| `src/app/[locale]/perfume/[slug]/page.tsx` | Gallery is the left half of a `lg:grid-cols-2` section; parent column is `lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)]` |
| `src/components/ecommerce/CollectionView.tsx`, `MerchGrid.tsx`, `JournalGrid.tsx`, `IngredientExplorer.tsx` | House idiom for horizontal rails: `flex … gap-… overflow-x-auto`, no JS scroller library anywhere in the repo |
| `src/lib/i18n/rtl.ts` | Direction helpers (`readingArrow` / `backArrow`) and the project's stance on direction-aware affordances |
| `src/providers/i18n-provider.tsx` (`useDictionary`) | How this client component already reads copy |
| `src/lib/i18n/dictionaries/{en,ar}.ts` → `product.gallery` | Namespace the new strings join (`thumbnail` already lives there) |
| `src/lib/i18n/interpolate.ts` | `{index}` / `{total}` placeholder substitution used by the thumbnail label |

## Decisions and assumptions

1. **Native scroll + CSS scroll-snap, no carousel dependency.** The repo has no
   Embla/Swiper and every other rail is native `overflow-x-auto`. Native scroll
   gives touch swipe, trackpad, shift+wheel, and momentum for free, and it
   degrades to a plain scrollable strip if JS is slow to hydrate.
2. **Scroll position is the source of truth, not React state.** `activeIndex`
   becomes derived: an `IntersectionObserver` on the slides (threshold ~0.6,
   root = the track) sets it. Clicking a thumb or an arrow calls
   `scrollTo`/`scrollIntoView`; the observer then reports the new index. This
   avoids the classic fight between a controlled index and a user mid-swipe.
3. **RTL is handled by never doing arithmetic on `scrollLeft`.** Scroll to a
   slide via `track.children[i].scrollIntoView({ inline: "start", block: "nearest", behavior: "smooth" })`,
   which is direction-agnostic. Arrow buttons step `index ± 1` in **reading
   order**, and the chevron glyph/icon each button shows is chosen by locale
   direction so "next" always points the way the text runs.
4. **Arrows are a pointer affordance, hidden from touch-only clutter is *not*
   required** — keep them visible on all sizes (luxury PDPs show them), but
   fade them in on hover/focus at `lg` where the column is sticky and large.
   Disable (not hide) at the ends: `disabled` + `opacity-40`, no wrap-around.
5. **One image → no track chrome.** No arrows, no thumbs, no snap; render the
   single frame exactly as today so nothing regresses for products with one
   photo.
6. **`priority` stays on the first image only**; the rest keep `quality={85}`
   and `SIZES`. All slides render eagerly as today (they already did) so
   swiping never shows an empty frame.
7. **No new dependency, no server change, no schema change.**

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/components/ecommerce/ProductGallery.tsx` | Rewritten as a snap-scroll carousel with arrows + synced thumbs |
| `src/lib/i18n/dictionaries/en.ts` | Add `product.gallery.previous` / `product.gallery.next` (and keep `thumbnail`) |
| `src/lib/i18n/dictionaries/ar.ts` | Arabic equivalents, same keys |
| `src/app/[locale]/perfume/[slug]/page.tsx` | No change expected — props stay `{ images, productName }`. Only touch if the sticky column needs a height tweak. |

## Implementation requirements

**Markup**

```
<div>                        ← existing column wrapper, unchanged classes
  <div className="relative … group">
    <ul  ref={trackRef}      ← the scroller
        role="list"
        tabIndex={0}
        aria-roledescription="carousel"
        aria-label={dict.product.gallery.label}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto
                   overscroll-x-contain scroll-smooth [scrollbar-width:none]
                   [&::-webkit-scrollbar]:hidden focus:outline-none
                   focus-visible:outline-2 focus-visible:-outline-offset-2
                   focus-visible:outline-gold">
      <li className="relative h-full w-full flex-none snap-start"> <Image fill …/> </li>
      …
    </ul>
    <button prev /> <button next />        ← absolutely positioned, vertically centred
  </div>
  <thumbnail strip … />                    ← existing markup, `aria-current` unchanged
</div>
```

- Each slide is `w-full flex-none snap-start`; the track keeps the current
  aspect behaviour: `aspect-4/5 lg:aspect-auto lg:flex-1` moves to the
  scroller/relative wrapper so the sticky column height math is untouched.
- Images keep `object-cover brightness-90`, `sizes={SIZES}`, `quality={85}`.
- Remove the opacity cross-fade classes — position, not opacity, now selects the
  visible frame.

**Behaviour**

- `useRef<HTMLUListElement>` + `useState(activeIndex)`; an effect registers one
  `IntersectionObserver` (root = track, `threshold: 0.6`) over the slide
  elements, cleaned up on unmount / when `images` changes.
- `goTo(index)` clamps to `[0, images.length - 1]` and calls `scrollIntoView`
  on the child (see decision 3). Thumbs and arrows both call it.
- `onKeyDown` on the track: `ArrowRight` / `ArrowLeft` map to next/previous in
  **reading order** (swapped under RTL), `preventDefault()` only when handled.
- Respect `prefers-reduced-motion`: skip `behavior: "smooth"` (use `"auto"`)
  when `window.matchMedia("(prefers-reduced-motion: reduce)").matches`.
- Guard every DOM read: this is a client component that must not throw during
  hydration or when `trackRef.current` is null.

**Aesthetics (AGENTS.md §2–3)**

- Arrow buttons: `size-11`, `rounded-none`, `bg-background/60 backdrop-blur-md`,
  `border border-border-gold`, `text-ivory hover:text-gold`,
  `hover:border-gold hover:shadow-[0_0_20px_rgba(200,169,106,0.25)]`,
  `transition-all duration-500 ease-out`, inset `left-4` / `right-4`
  (logical `start`/`end` so RTL mirrors), `disabled:opacity-40
  disabled:pointer-events-none`.
- Icon: `ChevronLeft` / `ChevronRight` from `lucide-react`, `strokeWidth={1.25}`,
  `size-4` — matching the project icon standard.
- At `lg`: `opacity-0 group-hover:opacity-100 focus-visible:opacity-100` so the
  museum frame is clean at rest; always visible below `lg`.
- Zero bounce, zero spring — `ease-out` / `ease-luxury-bezier` only.
- Thumbnail strip visual treatment unchanged (gold outline on the active thumb).

**Copy**

`product.gallery` gains:

| Key | EN | AR |
| :--- | :--- | :--- |
| `label` | `"{name} gallery"` | `"معرض صور {name}"` |
| `previous` | `"Previous image"` | `"الصورة السابقة"` |
| `next` | `"Next image"` | `"الصورة التالية"` |

`thumbnail` stays as-is. No raw English string may appear in the component.

## Security requirements

- No new data flows, no user input, no network call, no secrets.
- `image.url` / `image.alt` remain rendered through `next/image` and JSX text —
  never `dangerouslySetInnerHTML`; remote hosts stay governed by the existing
  `next.config.ts` `images.remotePatterns` allowlist (unchanged).
- No `window`/`document` access outside effects and event handlers.

## Acceptance criteria

1. A product with several images shows one frame at a time; dragging/swiping
   horizontally moves to the neighbouring image and snaps cleanly.
2. Chevron buttons step exactly one image; the first/last is disabled at the
   respective end (no wrap).
3. Clicking a thumbnail scrolls the track to that image; the gold outline
   follows the frame that is actually on screen after a manual swipe too.
4. `←`/`→` move the carousel when the track is focused, and the focus ring is
   the gold outline (never the browser default blue).
5. Arabic locale: the track scrolls the mirrored way, "next" moves toward the
   next image, and arrows sit on the mirrored sides.
6. A single-image product renders exactly as before — no arrows, no thumbs, no
   horizontal scrollbar.
7. No visible scrollbar; no layout shift; the `lg` sticky column still fills
   `calc(100vh-5rem)` and the page below is unaffected.
8. `npx tsc --noEmit` and `npm run lint` clean; zero `any`.
9. No console warnings/errors on load or interaction.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build      # confirms the PDP still prerenders per locale × slug
```

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/en/perfume/<slug>` for a product
   with 2+ images (any seeded perfume).
2. Drag the main image left → the next image snaps into place; drag right →
   back. Shift+wheel / trackpad two-finger swipe do the same.
3. Click the right chevron repeatedly to the last image → it becomes disabled;
   left chevron back to the first → that one disables.
4. Click the third thumbnail → track scrolls there, gold outline moves to it.
5. Swipe manually to another frame → the gold thumbnail outline follows without
   clicking anything.
6. Tab until the track is focused (gold ring), press `→` and `←`.
7. Repeat 2–6 at `/ar/perfume/<slug>` and verify mirrored direction and Arabic
   `aria-label`s (inspect the buttons in devtools).
8. Resize to 375px width: arrows visible and tappable, image keeps `4/5` ratio,
   thumbs remain a single row.
9. Open a product with exactly one image and confirm no arrows/thumbs appear.
10. macOS System Settings → Accessibility → Reduce motion on: stepping jumps
    instantly with no smooth animation.
```
