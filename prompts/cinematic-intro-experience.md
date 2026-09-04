# Cinematic Website Intro — KHEM Curtain

## Goal

Replace the "nothing yet" moment of a first page load with the opening frames of a
luxury film: a full-bleed ivory field, the gold KHEM lockup arriving in three
staged beats (falcon → wordmark → tagline), a held frame, then the field opening
outward to reveal the site already painted behind it.

This is the *document*-level entrance. It is not the landing page video banner and
it is not the route-transition loader — both stay exactly as they are.

## Skills read

- `node_modules/next/dist/docs/` — App Router layout composition, `next/image`
  `priority` / preload behaviour, Server vs Client component boundaries, and why
  a layout-level component does **not** remount across client-side navigation.

No `clerk`, `supabase`, or `ai-sdk` surface is touched by this task, so those
skills are out of scope.

## Existing code inspected

| File | What it established |
| :--- | :--- |
| `src/app/[locale]/layout.tsx` | The single mount point for anything document-wide. `<CookieConsent>` and `<OfferPopup>` already sit last in the tree, `fixed`, "so it never participates in document flow and cannot contribute to CLS". The intro follows that precedent. |
| `src/components/LoadingScreen.tsx` | The house *route* loader — ivory field, roundel, `khem-orbit` arc, `z-1000`, CSS-only so it stays a Server Component. Its docblock records that this site's entire 0.757 CLS came from a boundary that took viewport space without reserving flow height. The intro must therefore be `fixed` only, and must sit **above** `z-1000`. |
| `src/components/animation/Reveal.tsx` | The house lesson on `initial={{opacity:0}}`: rendering hidden state into server HTML made LCP wait on the JS bundle across 72 call sites. The intro is the one place where hiding the page *is* the feature — but the same rule applies to the intro's own artwork: its entrance must be CSS, not a hydrated Motion tree. |
| `src/app/globals.css` §"Order confirmation sequence" (~L1440–1560) | The established choreography vocabulary: `khem-rule-draw`, `khem-seal-settle`, `khem-bloom`, `khem-rise`, all on `--ease-luxury-bezier`, all with a matching `prefers-reduced-motion` block that collapses them to `khem-fade-in`. The intro extends this vocabulary rather than inventing a second one. |
| `src/app/globals.css` L251–268 | `overflow: hidden` on `body` is **banned** — it promotes `body` to a scroll container and kills `position: sticky`, which both `<Nav>` and `<StickyPurchaseBar>` depend on. The intro must not scroll-lock that way. |
| `src/app/globals.css` L1828 | `html[data-header-hidden="true"] body` — the established idiom for a document-level state machine driven off an attribute on `<html>`. `data-intro` follows it. |
| `src/components/ecommerce/CartDrawer.tsx:155` | The one existing `body.style.overflow` lock. Deliberately *not* copied here (see Decisions). |
| `src/components/Nav.tsx:32`, `src/components/Footer.tsx:3` | Both locales already render the English `name-logo-transparent.webp` lockup. The wordmark is not localised anywhere on the site. |
| `public/logo/` | Three raster lockups plus three SVGs. Verified by eye and by `sips`. |
| Existing z-scale | `z-998` mega-menu overlay, `z-1000` LoadingScreen, `z-1001`/`z-1002` nav layers, `z-1100` in use. The intro needs a tier above all of them. |

### Asset audit (the material finding)

| File | Contents | Size | Verdict |
| :--- | :--- | :--- | :--- |
| `public/logo/logo-transparent.webp` (512×598) | Falcon alone, gold | 53 KB | **Beat 1** |
| `public/logo/name-logo-transparent.webp` (2000×848) | Falcon **+** "KHEM" | 69 KB | Not the wordmark alone — unusable for staging |
| `public/logo/full-logo-transparent.webp` (2000×1089) | Falcon + "KHEM" + "The Essence of Heritage" | 98 KB | **Beats 1–3 as one lockup** |
| `public/logo/*.svg` | 621–828 auto-traced `<path>` elements with per-path fills sampled off the raster (`#090602`, `#100B03`, …) | 435–557 KB | **Rejected.** These are vectorised photographs, not line art: no falcon/wordmark/tagline grouping, no single gold fill to animate, no strokes to draw, and 5× the payload of the raster. There is no stroke-draw or path-morph animation available from these assets. |

## Decisions and assumptions

1. **One lockup, revealed by a moving mask — not three cropped images.**
   The staged falcon → wordmark → tagline order the brief asks for is *already the
   vertical order inside `full-logo-transparent.webp`*. So the three beats come
   from a single `mask-image` gradient sweeping top-to-bottom across one image:
   the falcon surfaces first, the wordmark second, the tagline last, carried by one
   continuous pass of light. This is why no wordmark-only asset needs to be cut,
   why no Cinzel approximation of the gilded wordmark is needed (it would not
   match — the real wordmark carries a gold gradient), and why the sequence cannot
   drift out of sync: it is one animation, not three coordinated ones.
   The `logo-transparent.webp` falcon is **not** used; it would require a second
   download and a hand-tuned position match against the lockup.

2. **Play once per browser session**, keyed on `sessionStorage`
   (`khem:intro:seen`). "When the user first opens the website" = the first
   document load of a session. A hard refresh ten seconds later replays nothing.
   Client-side navigation cannot replay it in any case — the component lives in
   the `[locale]` layout, which persists across route changes.
   *Alternative not taken:* `localStorage` (once ever) would make the intro
   invisible to nearly every returning visitor and untestable without a
   devtools trip; per-tab-session is the luxury-house convention.
   `sessionStorage` here is strictly-necessary functional storage carrying no
   identifier, so it is **not** gated on `ConsentProvider`.

3. **The overlay ships in the server HTML.** A client-mounted overlay appears
   only after hydration, which means a visible frame of the real site first —
   the exact failure the brief rules out. The markup and the whole entrance
   animation are therefore CSS on a Server Component; JavaScript only *ends* it.

4. **The suppression decision is made before first paint**, by a ~200-byte
   blocking inline script in `<head>` that reads `sessionStorage` and stamps
   `data-intro` on `<html>`. Without it, a returning visitor gets a flash of
   ivory before React can hide the overlay. This is the only render-blocking
   script the site gains.

5. **No `body` scroll lock.** `overflow: hidden` on `body` is banned by
   `globals.css` L251–268 (it kills `<Nav>`'s and `<StickyPurchaseBar>`'s
   `position: sticky`), and the `CartDrawer` idiom would reintroduce exactly
   that. Instead the overlay itself swallows gestures with `touch-action: none`
   and `overscroll-behavior: contain`. It is opaque and covers the viewport, so
   there is nothing to scroll toward.

6. **Same lockup in both locales.** `<Nav>` and `<Footer>` already render the
   English mark on `/ar`, and the reveal sweeps vertically, so RTL needs no
   mirrored variant. No Arabic tagline substitution.

7. **Ready = hydrated ∧ `readyState === "complete"` ∧ artwork decoded**, floored
   by the choreography and capped by a ceiling. `window.load` alone would hold
   the curtain on the home page's hero video; the ceiling is what guarantees the
   site is never held hostage to a slow asset.

8. **Escapable.** Any pointer press or key dismisses immediately. A visitor who
   has seen it twice should never feel detained by it.

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/components/intro/CinematicIntro.tsx` | **New.** Server Component. The overlay markup — two curtain halves, the bloom, the hairline, the masked lockup. Renders nothing at all when suppressed is *not* possible on the server (no request-time signal), so suppression is CSS-driven via `data-intro`. |
| `src/components/intro/IntroCurtain.tsx` | **New.** `"use client"`. ~60 lines: readiness detection, the state machine that writes `data-intro` on `<html>`, the `sessionStorage` write, the skip handler. Renders `null`. |
| `src/app/[locale]/layout.tsx` | Mount `<CinematicIntro />` last inside `<body>` (sibling of `<CookieConsent>`, outside every provider — it consumes no context); add the pre-paint `<script>` to `<head>`. |
| `src/app/globals.css` | New "Cinematic intro" section after the order-confirmation sequence: the `data-intro` state machine, `khem-intro-*` keyframes, and the `prefers-reduced-motion` collapse added to the existing reduced-motion block. |

Nothing else. `LoadingScreen.tsx`, `loading.tsx`, `Reveal.tsx` and every video-banner
component are untouched.

## Visual interpretation

Ivory, empty, silent. A single gold hairline finds the centre of the frame and
opens outward along the horizon. Light passes down the frame and the falcon
surfaces out of the ivory, then the KHEM wordmark beneath it, then the tagline —
not three objects appearing, one object being lit from top to bottom. A warm
bloom rises behind the lockup and stays, the way a gallery light comes up on an
object and does not pulse. The frame holds. Then the ivory itself parts along
that same horizon — top half up, bottom half down — and the boutique is already
standing there behind it.

### Choreography

All curves `var(--ease-luxury-bezier)` — `cubic-bezier(0.16, 1, 0.3, 1)`.
Zero spring, zero bounce, zero loop (AGENTS.md §2.2).

| # | Beat | Start | Duration | Motion |
| :- | :--- | :--- | :--- | :--- |
| 1 | Hairline | 120 ms | 520 ms | `width: 0 → 96px`, `opacity: 0 → 1`, centred on the lockup's horizon. Reuses the `khem-rule-draw` gesture at a new width. |
| 2 | Bloom | 300 ms | 1400 ms | Gold radial gradient behind the lockup, `opacity: 0 → 0.16`, `forwards`. Never reverses. |
| 3 | Lockup wipe | 420 ms | 1500 ms | `mask-image: linear-gradient(to bottom, …)` with `mask-position` travelling from above the artwork to below it. A ~22% soft edge, so each element blooms into view over ~300 ms rather than clipping in. Falcon lands ≈ 700 ms, wordmark ≈ 1250 ms, tagline ≈ 1750 ms. |
| 4 | Settle | 420 ms | 1800 ms | The lockup's own `scale: 1.035 → 1` and `opacity: 0.9 → 1`, running under the wipe. Transform + opacity only; both composited. |
| 5 | Hairline recedes | 1500 ms | 700 ms | `opacity → 0`. Its job was to seed the split. |
| 6 | Hold | 2200 ms | until ready | Nothing moves. |
| 7 | Lockup out | on ready | 600 ms | `opacity → 0`, `scale → 1.015`. Leads the curtain by 200 ms so the field is empty before it parts. |
| 8 | Curtain opens | ready + 200 ms | 900 ms | Top half `translateY(-100%)`, bottom half `translateY(100%)`. The two halves are the overlay's only children at that point. |
| 9 | Gone | ready + 1100 ms | — | `data-intro="done"` → `display: none`. |

Total floor **2200 ms**; typical **≈ 3.3 s**; hard ceiling **4500 ms** of hold
before beat 7 fires regardless of readiness.

### Layout, typography, spacing, colour

- Ground `var(--color-ivory)` `#f7f5f0`, written **literally as well as** through
  the token, matching the reasoning in `globals.css` L266–284: the first paint
  must be ivory before any cascade resolves.
- The curtain is two absolutely-positioned halves, each `height: 50%`, each
  painting the same literal ivory. No seam: give the top half
  `bottom: -0.5px` so subpixel rounding cannot open a hairline gap on
  fractional-DPR displays.
- Lockup width: `clamp(260px, 62vw, 420px)` below `md`, `clamp(380px, 34vw, 520px)`
  at `md` and up. Aspect ratio pinned to 2000/1089 via `width`+`height` on
  `next/image` so the box exists before the bytes do.
- Bloom: `radial-gradient(circle, var(--color-gold) 0%, color-mix(in srgb, var(--color-gold) 40%, transparent) 30%, transparent 68%)`, sized ~1.6× the lockup, `filter: blur(40px)`. Identical recipe to `.khem-bloom`.
- Hairline: 1px, `var(--color-gold-deep)` `#8a6a3f` — the light-ground gold, per
  the token docblock. `--color-gold` on ivory is 2.6:1 and is the wrong one here.
- No text nodes at all. The tagline is inside the artwork, so nothing depends on
  a webfont having loaded and there is no FOUT inside the intro.

### Responsiveness

- Sized in `svh`/`dvh`-safe terms: the overlay is `fixed inset-0`, so it needs no
  viewport-height unit and is immune to mobile URL-bar resize.
- The curtain halves are percentage-based; a mid-animation orientation change
  cannot leave a gap.
- Verified at 320, 390, 768, 1024, 1440, 1920 CSS px.

### Pixel-perfect expectations

- Lockup optically centred: the artwork's own whitespace means geometric
  centring sits it slightly low. Offset the container `-2.5%` of its height.
- Hairline centred on the wordmark's baseline zone, not the artwork's centre.
- `image-rendering` untouched; `next/image` serves the resize, and the mask edge
  must not produce banding — use a 3-stop gradient, not 2.

## Implementation requirements

1. **`CinematicIntro.tsx` — Server Component, no `"use client"`.**
   - Root: `<div id="khem-intro" aria-hidden="true" data-intro-root>` with
     `fixed inset-0 z-2000`, `touch-action: none`, `overscroll-behavior: contain`.
   - `z-2000`: above `z-1002` (nav), `z-1000` (LoadingScreen), `z-998` (mega-menu).
   - Children: curtain-top, curtain-bottom, and a centred stage holding bloom +
     hairline + `<Image>`.
   - The `<Image>` takes `priority`, explicit `width={2000} height={1089}`, a
     `sizes` matching the clamps above, and `alt=""` (the whole overlay is
     `aria-hidden`; the site behind it stays in the accessibility tree, so **no
     focus trap and no `inert` on the page**).
   - Renders `<IntroCurtain />` as its last child.

2. **`IntroCurtain.tsx` — `"use client"`, returns `null`.**
   - `useEffect` on mount (⇒ hydration complete):
     - If `document.documentElement.dataset.intro === "off"`, do nothing.
     - Write `sessionStorage.setItem("khem:intro:seen", "1")` inside `try/catch` —
       Safari private mode throws on write.
     - Build the ready promise: `Promise.race([ Promise.all([documentComplete, minimumElapsed(2200)]), timeout(4500 + 2200) ])`.
       `documentComplete` resolves immediately when `document.readyState === "complete"`,
       otherwise on `window`'s `load`.
     - On resolve → `dataset.intro = "exit"`; after 1100 ms → `dataset.intro = "done"`.
   - Skip: `pointerdown` and `keydown` listeners on `window` jump straight to
     `"exit"`, but only after 600 ms have elapsed (so the press that opened the
     tab cannot eat the intro).
   - Every timer and listener cleaned up in the effect's teardown; the effect must
     be safe under React 19 StrictMode double-invocation (guard with a ref).
   - Zero `any`. No Motion import — the whole sequence is CSS.

3. **Pre-paint script in `layout.tsx` `<head>`.** Inline, no `next/script`
   (`beforeInteractive` still resolves too late for first paint):
   ```
   try{if(sessionStorage.getItem('khem:intro:seen'))document.documentElement.dataset.intro='off'}catch(e){}
   ```
   Emit it as `<script dangerouslySetInnerHTML={{ __html: … }} />`. Keep it one
   statement; it runs on every document load on the site.

4. **`globals.css` — new section, commented in the house voice** (explain *why*,
   as every other section there does):
   - `#khem-intro { }` default = playing.
   - `html[data-intro="off"] #khem-intro { display: none }`.
   - `html[data-intro="exit"]` drives beats 7–8.
   - `html[data-intro="done"] #khem-intro { display: none }`.
   - Keyframes `khem-intro-rule`, `khem-intro-bloom`, `khem-intro-wipe`,
     `khem-intro-settle`, `khem-intro-part-up`, `khem-intro-part-down`.
   - Add to the **existing** `@media (prefers-reduced-motion: reduce)` block
     rather than opening a second one: under reduced motion there is no wipe, no
     scale, no split. The lockup fades in over 400 ms, holds, and the whole
     overlay fades out over 400 ms. Total ≤ 1400 ms.

5. **Do not touch** `LoadingScreen.tsx`, `[locale]/loading.tsx`, `Reveal.tsx`,
   or any banner/video component.

## Security requirements

- The inline script contains no interpolated value of any kind — it is a
  constant string literal. Nothing from `params`, the dictionary, or any request
  data reaches `dangerouslySetInnerHTML`.
- `sessionStorage` holds one literal `"1"` under a fixed key. No identifier, no
  timestamp, no navigation history. Not consent-gated because it stores nothing
  about the visitor.
- No new network origin, no new dependency, no new env var.
- The overlay is `aria-hidden` and non-interactive: it exposes no control that
  could be clickjacked, and because it self-dismisses on a hard ceiling it can
  never permanently cover the document.

## Acceptance criteria

- [ ] First document load of a session: ivory field is the **first paint**, with no
      frame of the real site visible before it.
- [ ] Falcon, then wordmark, then tagline arrive in that order, from one pass of light.
- [ ] Second load in the same tab: no intro, no ivory flash, no layout shift.
- [ ] Client-side navigation (any internal link) never replays it.
- [ ] `/ar` behaves identically; nothing mirrors or breaks under `dir="rtl"`.
- [ ] `prefers-reduced-motion: reduce` → fade only, ≤ 1400 ms, no split, no wipe.
- [ ] CLS contribution **0.000** on `/` and `/collections` (the overlay is `fixed`
      and the site behind it renders at its final size throughout).
- [ ] LCP is not regressed by more than the intro's own hold on a page that
      already had one — verify the home page LCP element is unchanged after dismissal.
- [ ] Curtain never exceeds 4500 ms of hold even with the network throttled to
      Slow 3G.
- [ ] Any key or pointer press after 600 ms dismisses it immediately.
- [ ] No hydration mismatch warning in the console.
- [ ] `<Nav>` and `<StickyPurchaseBar>` still stick after the intro (proof the
      `body` scroll lock was not reintroduced).
- [ ] Zero `any`; `npm run lint` and `tsc --noEmit` clean.

## Checks to run

```bash
npm run lint
npx tsc --noEmit
npm run build      # confirms the [locale] layout still prerenders both trees
```

The build output must still show the locale routes as prerendered (`○`), not `ƒ` —
the intro reads no dynamic API and must not change any route's rendering mode.

## Manual test steps

1. `npm run dev`, open a **new tab** at `http://localhost:3000/`.
   → Ivory field first, hairline opens, falcon → KHEM → tagline, hold, curtain parts.
2. Click any nav link, then another. → No intro. Header and footer stay put.
3. Hard-refresh (`⌘R`). → No intro, no flash.
4. New tab at `http://localhost:3000/ar`. → Full intro, correct in RTL.
5. DevTools → Rendering → **Emulate `prefers-reduced-motion: reduce`**, new tab.
   → Fade in, fade out, ≤ 1.4 s, no wipe, no split.
6. DevTools → Network → **Slow 3G**, new tab. → Curtain opens by ~6.7 s at the
   latest, and the site behind it is already painted when it does.
7. New tab, press `Escape` about a second in. → Immediate exit, no jump.
8. New tab, then during the hold: scroll wheel and touch-drag.
   → Page behind does not move.
9. DevTools → Performance → record a first load. → Confirm the intro contributes
   **no** layout-shift entries, and that the animation runs on the compositor
   (transform/opacity only; no "Layout" entries during beats 3–8).
10. `/perfume/<any-slug>` in a new tab, scroll after the intro.
    → `<StickyPurchaseBar>` still sticks.
11. Lighthouse (mobile) on `/`. → CLS 0, Performance not below the pre-change score.

---

## As built — where this diverged from the plan

Five things above are the *plan*, not the code. Screenshot verification during
implementation overturned them; the tuning guide below describes what actually
shipped.

| Planned | As built | Why |
| :--- | :--- | :--- |
| Reveal by an opaque ivory scrim sliding off the artwork (`transform` only, composited) | Reveal by `mask-image` on the artwork | An opaque rectangle also hides what is *behind* it — the bloom. It painted a hard-edged lighter box across the glow, with two vertical edges nothing in the composition explained; widening it only traded those for a horizontal one. A mask hides the artwork and nothing else. Costs a repaint of one image for 1.5 s on a page doing nothing else — the correct trade. |
| `--khem-intro-lift: -2.5%` | `calc(var(--khem-intro-w) * -0.037)` | A percentage margin — `margin-block-start` included — resolves against the containing block's **inline** size, which here is the viewport. The lift was 36 px on desktop and 10 px on a phone, drifting with the window rather than staying fixed to the artwork it corrected. |
| Wipe and exit on `--ease-luxury-bezier` | Both on `--khem-intro-sweep`, `cubic-bezier(0.4, 0, 0.2, 1)` | The luxury curve covers half its distance in the first 13% of its duration. On the wipe that delivers all three beats in one rush; on the exit the halves finish 97% of half a viewport in the first 450 ms of 900 ms, which reads as the curtain being snatched rather than opened. Still a tween, no overshoot — just evenly paced. |
| Mask travel `0% 100%` → `0% 0%`; opaque run to 33.3% | Travel `0% 66%` → `0% 0%`; opaque run to 34% | The artwork is fully hidden from 66% upward, so a third of the sweep moved an edge that was not over the artwork yet. And an opaque run stopping exactly at 33.3% left the tagline on the boundary — it arrived visibly greyed, looking like a colour bug in the artwork. |
| Bloom 1.6× the lockup with `filter: blur(40px)`, peak 0.16 | 1.15×, no blur filter, peak 0.14 | Spread across most of a desktop viewport a 16% gradient quantises to visible concentric rings — it read as banding, not light, and the blur was paying for a full-screen filter layer to produce it. |

One requirement was also **added**: `suppressHydrationWarning` on the `<html>`
element in `[locale]/layout.tsx`. The pre-paint script stamps `data-intro` on
`<html>` before React hydrates, and React diffs that element's attributes — so
every load after the first in a session reported a hydration mismatch naming
`data-intro="off"`. This is the standing cost of answering "has this tab already
seen it?" ahead of first paint, and the same bargain every pre-paint theme script
makes. The prop is narrow: that element's own attributes and text, one level
deep. It does not reach `<body>`, the providers, or any page.

The pre-paint script also sits as the **first child of `<body>`**, not in
`<head>` — the App Router owns the head, and nothing renders before that point
anyway.

## Changing it later

### The one-place knobs

Every duration and delay is a custom property at the top of the `#khem-intro`
rule in `globals.css`. Retiming the whole sequence means editing that block and
nothing else.

| Property | Ships as | What it moves |
| :--- | :--- | :--- |
| `--khem-intro-w` | `clamp(260px, 62vw, 420px)`, and `clamp(380px, 34vw, 520px)` at `md` | Lockup size. The bloom, the lift and the hairline's vertical offset are all derived from it, so they follow automatically. |
| `--khem-intro-lift` | `calc(var(--khem-intro-w) * -0.037)` | Optical centring. Keep it a length, never a percentage. |
| `--khem-intro-rule-delay` / `-dur` | 120 ms / 520 ms | The gold hairline drawing outward. |
| `--khem-intro-bloom-delay` / `-dur` | 300 ms / 1400 ms | The light coming up behind the lockup. |
| `--khem-intro-wipe-delay` / `-dur` | 420 ms / 1500 ms | The pass of light. **The only knob that changes where the three beats land.** |
| `--khem-intro-settle-dur` | 1800 ms | The lockup's `scale(1.035) → 1`. |
| `--khem-intro-rule-out-delay` / `-dur` | 1500 ms / 700 ms | The hairline receding. |
| `--khem-intro-out-dur` | 600 ms | The lockup fading before the field parts. |
| `--khem-intro-part-delay` / `-dur` | 200 ms / 900 ms | The curtain opening. |
| `--khem-intro-sweep` | `cubic-bezier(0.4, 0, 0.2, 1)` | The evenly-paced curve for the wipe and the exit. Everything else uses `--ease-luxury-bezier`. |

### The three couplings — change one, change the other

These are the only places where a value lives in two files. Each is commented at
both ends; this is the index.

1. **Hold and exit length.** `MIN_HOLD_MS` (2200) and `EXIT_MS` (1100) in
   `IntroCurtain.tsx` mirror the CSS. `EXIT_MS` must equal
   `--khem-intro-part-delay + --khem-intro-part-dur`. Change one alone and the
   overlay is set to `display: none` partway through the curtain opening, or
   lingers as a dead layer after it has finished. `MIN_HOLD_MS` must be at least
   as long as the entrance (currently ~1.9 s of wipe plus its delay) or the
   sequence can be cut off mid-reveal on a warm cache.

2. **The mask feather.** The three gradient stops on `.khem-intro-art`
   (`34%` / `37.3%` / `40.7%`) and the `0% 66%` travel start in
   `@keyframes khem-intro-wipe` are one geometry, and CSS cannot derive them from
   each other. The arithmetic is in the comment above the rule. Widening the
   feather without moving the travel start makes the falcon begin the sequence
   already half-visible; narrowing the opaque run below 34% greys the tagline at
   the end.

3. **The storage key.** `khem:intro:seen` appears in `IntroCurtain.tsx` and in
   the inline script in `[locale]/layout.tsx`. They must match, or the intro
   plays on every load.

### Common changes, and what each one actually takes

- **Play once ever instead of once per session** — swap `sessionStorage` for
  `localStorage` in both places named in coupling 3. Nothing else changes.
  Note this makes the intro invisible to nearly every returning visitor and
  untestable without clearing site data.
- **Retire the intro entirely** — remove `<CinematicIntro />` and the inline
  script from `[locale]/layout.tsx`. The CSS section and
  `src/components/intro/` can then go. `suppressHydrationWarning` on `<html>`
  goes with the script, not before it.
- **Different artwork** — replace the `<Image>` source and update the
  `aspect-ratio` on `.khem-intro-lockup` to match. If the new lockup has a
  different vertical distribution, the beats land elsewhere: re-check the mask
  stops (coupling 2) and re-tune `--khem-intro-lift`.
- **Hold longer / shorter** — `MIN_HOLD_MS` only. `MAX_HOLD_MS` (4500) is the
  ceiling on *waiting for readiness*, not the hold itself; it is what stops a
  slow hero video from holding the curtain shut, and lowering it below the
  entrance length defeats the point.
- **A locale-specific lockup** — the intro currently renders the English mark on
  `/ar`, matching `<Nav>` and `<Footer>`. Making it locale-aware means passing
  `locale` into `<CinematicIntro>` from the layout, which already has it.

### What to re-verify after any change

The four measurements that caught real bugs, in the order they caught them:

1. **Screenshot the frames.** Freeze with
   `#khem-intro *{animation:none !important}` and drive
   `mask-position` by hand — at `66%`, `43%`, `25%`, `0%`. Every visual bug in
   this feature was invisible in code review and obvious in a screenshot.
2. **Timing.** Observe `data-intro` on `<html>` and log the transitions. Ships
   as: `exit` at ~2258 ms, `done` at ~3358 ms; reduced motion 644 ms / 1095 ms.
3. **CLS.** A `layout-shift` observer with `buffered: true`, reading
   `entry.sources`. The intro's own contribution must stay **0** — the page total
   is ~0.0033, all of it the announcement bar's rotation at ~5 s, which is
   pre-existing and unrelated.
4. **Console on the *second* load of a session.** The hydration mismatch only
   appears once `data-intro` is being stamped, so a first-load check passes while
   the bug is live.
