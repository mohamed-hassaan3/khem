# Hero Slider — Pause / Play Control

## Goal

Give the campaign hero's image slideshow an explicit **pause button**, so a
visitor can stop the rotation and hold the slide they are looking at — and start
it again. Keep it simple: one small control at the foot of the frame, beside the
existing progress segments.

Scope is the image slideshow only. The video hero (`mediaType === "VIDEO"`) is
untouched, and a one-image hero still renders no chrome at all.

## Skills read

None of `.agents/skills/{clerk,supabase,ai-sdk}` apply — this is a client-side
presentational change with no auth, no database, and no model call. The relevant
reference was the existing code and `src/app/globals.css`.

## Existing code inspected

- `src/components/home/Hero.tsx` — the whole component. It already has an
  `isPaused` state, written from two places: a `visibilitychange` listener and
  `onMouseEnter`/`onMouseLeave` on the section. One `setInterval` in one effect,
  reset by an `epoch` counter that manual slide selection bumps.
- `src/app/[locale]/page.tsx:197-204` — where `<Hero>` receives its `labels`.
- `src/app/globals.css:2044-2088` — `.khem-hero-progress`, a linear CSS
  animation whose duration is set inline, restarted by React keying the span on
  `epoch` and the slide index; and the `prefers-reduced-motion` block, which
  deliberately keeps the rotation and drops only the motion.
- `src/lib/i18n/dictionaries/en.ts:195-211` and `ar.ts:168-177` — the
  `home.hero` label group. `ar.ts` is typed as `Dictionary`, so any key added to
  `en` **must** be added to `ar` or the build fails.
- `lucide-react@^1.30.0` is already a dependency and is used across the admin
  tree.

## Decisions and assumptions

1. **Two pause sources, one derived boolean.** Today `isPaused` is a single
   flag two independent things write to, which is already slightly wrong — a
   `mouseleave` while the tab is hidden resumes a hidden tab. Split it:

   - `isHidden` — the tab is in the background.
   - `isStopped` — the visitor pressed the control.

   Effective: `const paused = isHidden || isStopped`.

   **Hover-to-pause is removed** (decided after the first pass, which kept it
   alongside the button). It is a guess about intent dressed up as a courtesy: a
   cursor resting anywhere in a full-screen hero froze the campaign with nothing
   on screen to say why, and it never existed on touch at all. With a real
   button in the frame, stopping the rotation is something the visitor asks for.
   Removing it also disposes of the interaction knot the button otherwise
   created — the cursor is by definition on the button when Play is pressed, so
   a surviving hover-pause would have made Play do nothing visible until the
   pointer left the frame.

2. **The progress bar freezes with the rotation.** Currently the CSS fill keeps
   drawing while a hovered hero is paused, so the bar completes and then sits
   full against a slide that is not changing. Add
   `animationPlayState: paused ? "paused" : "running"` to the fill.

3. **Resuming restarts the countdown.** The interval cannot be resumed
   mid-flight — the effect tears it down and a fresh one gets a full
   `slideDurationMs`. So on resume, bump `epoch`, which remounts the keyed fill
   and restarts the bar from zero at the same instant. The bar and the slide
   then agree, which is the whole point of the bar.

4. **The control renders exactly when the segments do** (`rotates` — images, two
   or more). One image has nothing to pause; a film is not a slideshow.

5. **Reduced motion keeps the rotation**, as the stylesheet already argues. The
   button is a visitor's explicit instruction, not motion, so it works
   identically under the preference — and it is in fact the accessible escape
   hatch a reduced-motion visitor did not previously have.

## Files likely to change

- `src/components/home/Hero.tsx` — state model, the button, the frozen fill.
- `src/lib/i18n/dictionaries/en.ts` — `home.hero.pause`, `home.hero.play`.
- `src/lib/i18n/dictionaries/ar.ts` — the same two keys.
- `src/app/[locale]/page.tsx` — pass the two new labels.
- `src/components/home/Hero.tsx`'s `HeroLabels` interface — the two new fields.

No CSS change: `animation-play-state` is set inline, and the button is composed
from existing utilities.

## Implementation requirements

- `"use client"` stays; nothing moves across the server/client boundary.
- Strict TypeScript, zero `any`. `intent` is `boolean | null`.
- No new dependency. Icons come from `lucide-react`, `strokeWidth={1.25}` per
  the house standard.
- The `visibilitychange` effect now writes `isHidden` only.
- The section's `onMouseEnter` / `onMouseLeave` handlers are deleted outright.
- One `setInterval`, still exactly one, still owned by the same effect; its
  dependency list takes the derived `paused` in place of `isPaused`.
- The button is a real `<button type="button">` with an `aria-label` that
  changes with the state (`labels.pause` / `labels.play`) and
  `aria-pressed={paused}` so assistive technology reads it as a toggle.

## Visual interpretation

The control is chrome for a campaign photograph, so it is nearly nothing: an
icon in the same hairline vocabulary as the progress segments, sharing their
row and their restraint. Not a media player. Not a filled circle.

- **Layout.** Inside the existing
  `absolute inset-x-0 bottom-8 z-10 flex justify-center gap-2 px-6 sm:bottom-10`
  row, as the **first** child, before the segments. The row is centred as a
  group, so the segments shift by half the button's width — intended: the
  cluster stays optically centred. Under `dir="rtl"` the flex row reverses with
  the document, putting the button on the reading-start side in both locales.
- **Size and hit area.** `h-8 w-8` — the same 32px height as a segment button,
  so the row has one baseline and one hit-area height. Icon `size={14}`.
- **Colour.** `text-ivory/50`, `hover:text-ivory/80`,
  `focus-visible:text-gold` — the exact ramp the segment hairlines use
  (`bg-ivory/30` → `/60` → `gold`), so the two controls read as one set.
- **Motion.** `transition-colors duration-500` only. No scale, no spring, no
  bounce — colour is the entire state change.
- **Typography.** None; the control is an icon and its accessible name.
- **Responsiveness.** Unchanged at every breakpoint — the row already handles
  `bottom-8` / `sm:bottom-10`, and the button adds 32px + one 8px gap, which the
  narrowest supported phone absorbs even with five slides.
- **Pixel-perfect expectations.** The button's optical centre sits on the same
  horizontal line as the segment hairlines; segment appearance, spacing and fill
  are otherwise byte-identical to today.

## Follow-up — the indicator became points

Requested after the button shipped: the foot of the banner shows **one point per
slide**, and only the active one expands into the bar that carries the
countdown. The rest stay dots.

- One element per slide, not two swapping: `h-1 rounded-full`, `w-1` when
  inactive and `w-10 sm:w-14` when active, with
  `transition-[width,background-color] duration-700 ease-luxury-bezier` — the
  dot stretches into the bar it becomes. `motion-reduce:transition-none` drops
  the travel under the preference; the point is then simply wide or narrow.
- The track is `overflow-hidden`, so the existing `.khem-hero-progress` scaleX
  fill is clipped to the pill instead of squaring off its ends. Nothing about
  the fill, its duration, its keying or its `animationPlayState` changed.
- Hit area is padding, not width: `px-2` around a 4px dot is a 20×32 box, and
  the row's gap tightened from `gap-2` to `gap-1` so the dots read as one set
  rather than as four separate marks.
- Colour, hover and focus ramps are unchanged from the hairline version
  (`bg-ivory/30` → `/60` → `gold`).

Why: a row where every slide carried a full-width track spent most of the foot
of the frame drawing countdowns that are not running. This way the frame states
how many slides there are, and draws the clock only for the slide it belongs to.

## Security requirements

None beyond the existing surface: no user input, no network call, no data
written, no new route. Labels come from the server dictionary, not from
user-supplied content, so nothing here is interpolated into markup unescaped.

## Acceptance criteria

- A hero with two or more images shows one pause control beside the segments.
- A hero with one image, and a video hero, show no control (and no segments).
- Pressing pause stops the rotation **and** freezes the progress fill.
- Pressing play resumes immediately, with the pointer still over the button, and
  the fill restarts from zero.
- Moving the pointer over the hero does **not** pause it.
- Backgrounding the tab still pauses regardless of the visitor's choice, and
  returning honours what they chose.
- Keyboard: the control is reachable by `Tab`, has a visible focus state, and
  toggles with `Enter` and `Space`.
- Arabic renders both labels and mirrors the control's position.
- `npx tsc --noEmit` and `npm run lint` are clean.

## Checks to run

```
npx tsc --noEmit
npm run lint
```

## Manual test steps

1. `npm run dev`.
2. In `/admin`, configure a hero with **three** images and a slide duration of
   about 5s, if one is not already configured.
3. Open `http://localhost:3000/en`. The hero rotates; the fill draws under the
   active segment.
4. Move the pointer off the hero, then press **Pause**. The image holds and the
   fill stops where it is.
5. Press **Play** without moving the pointer. Rotation resumes at once and the
   fill restarts from the left edge.
6. Hover the hero without touching the button (reload first). Nothing happens —
   the rotation continues and the fill keeps drawing.
7. Switch to another browser tab for ten seconds and return. The slide has not
   advanced, and whatever you chose in step 4/5 still holds.
8. `Tab` to the control, confirm a visible focus ring, and toggle it with
   `Space`.
9. Open `http://localhost:3000/ar`. The control sits on the right of the row and
   reads in Arabic.
10. Enable "Reduce motion" in the OS and reload. The dissolve becomes a swap and
    the fill stops drawing, the rotation continues, and the pause button still
    stops it.
