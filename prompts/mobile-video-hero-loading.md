# Mobile video inputs, hero loading, and a 2-second intro

Requested by the owner on 2026-11-19, following
`prompts/performance-intro-fonts-hero-cookie.md` and
`src/docs/production-audit.md` §7.6. The three cookie-card changes from that
work are **kept as they are** (owner decision); nothing here touches them.

## Goal

The hero film is 1.15 MB on a phone and is now the biggest remaining mobile
cost. This work:

- gives editors a separate, smaller **mobile** film for the Hero and New Arrival;
- falls back to a Cloudinary-shrunk version of the desktop film when there is
  no mobile one;
- strips audio from every film;
- shows a first-frame poster immediately and loads the film only after the page
  has loaded;
- fades the film in over the poster;
- makes the home intro fully gone by about 2 s.

## Skills read

- `AGENTS.md`: workflow, design language, motion (tweens only, no spring or
  bounce), and §9 (migrations and the PostgREST reload).
- `supabase/README.md`, "Migrations applied out of order": apply new
  migrations directly, never with `npm run db:migrate` (0072b).
- `node_modules/next/dist/docs/` for Server Actions and `next/image`.
- The `supabase` skill, for the column add and schema-cache reload.

## Existing code inspected

- `src/components/admin/HeroForm.tsx`: `AdminInput` URL fields `videoUrl`,
  `videoPosterUrl`, `videoAlt`, `videoAltAr`. **The admin has no file upload
  anywhere**, and there are no Cloudinary API credentials. The owner chose a
  **link field**, like today.
- `src/components/admin/NewArrivalForm.tsx` → `updateNewArrival()`
  (`src/actions/admin/landing.ts`): writes `LandingSection` key **`featured`**,
  `settings` JSON (`mediaType`, `videoUrl`, …). It is validated by
  `src/schemas/landing.ts` and read through `src/schemas/db/landing.ts` →
  `src/lib/landing-sections.ts` `resolveNewArrival()`. The JSON schema strips
  keys it doesn't name, so the new key goes in every one of these places.
- `HeroSetting` table: `videoUrl`, `videoPosterUrl`, `videoAlt`, `videoAlt_ar`
  (`src/schemas/content.ts`, `src/schemas/db/content.ts`,
  `src/types/content.ts`, `src/actions/admin/content.ts`).
- `src/components/home/Hero.tsx`: `<video src autoPlay muted loop playsInline
  preload="metadata" poster>`; `preload()` hints the admin poster.
- `src/components/home/InViewVideo.tsx` (New Arrival): `preload="none"`,
  IntersectionObserver play/pause.
- `src/components/intro/IntroCurtain.tsx` (`MIN_HOLD_MS` 1600 from first
  paint, `MAX_HOLD_MS` 1000, `EXIT_MS` 1100) and `globals.css`
  `--khem-intro-*` tokens. `aboveTheFoldMediaReady()` already waits for every
  non-lazy `<img>` to decode.
- `src/schemas/admin.ts`: the asset host allowlist (`res.cloudinary.com`).
- Live data: hero film
  `…/video/upload/f_auto,q_auto,w_828/v1792146108/KHEM-40.mp4`; New Arrival
  `…/video/upload/f_auto,q_auto,w_828/Hero.mp4`.

## Decisions and assumptions

1. **Mobile video is a link field**, "Mobile video address", directly under each
   desktop video field. It's optional, and the same `https://` + allowed-host
   validation applies.
2. **Recommended sizes appear as hints under each input:**
   - Mobile: "720×1280 (portrait), MP4, under 500 KB, 6–10 s, no sound."
   - Desktop: "1920×1080, MP4, under 2.5 MB, 6–10 s, no sound."
3. **Warnings never block a save.** When a link is entered or changes, the form
   checks it and shows an amber note under the field for anything over the
   recommendation:
   - **Resolution and duration** come from a hidden `<video
     preload="metadata">` in the admin (`videoWidth`, `videoHeight`,
     `duration`). This needs no server; Cloudinary is already in CSP
     `media-src`.
   - **File size** comes from a new admin-only Server Action,
     `inspectVideoUrl(url)`. It calls `requireAdmin()`, accepts only `https:`
     and `res.cloudinary.com` (no other host, so no SSRF), sends a `HEAD`
     request with a 10 s timeout, and returns `Content-Length`. The size
     checked is that of the URL visitors will actually receive (with
     `ac_none`).
   - **Audio** can't be detected from a link without Cloudinary credentials, so
     there's no warning for it. `ac_none` removes audio anyway.
   - If the check can't run (timeout, a host other than Cloudinary), the form
     shows "Couldn't check this file" and still saves.
4. **URL rules** go in one helper, `src/lib/video-url.ts`. It only applies to
   `res.cloudinary.com/<cloud>/video/upload/` URLs; anything else is returned
   unchanged.
   - `withoutAudio(url)` adds `ac_none` to the transformation segment (or
     inserts the segment when there is none) and is idempotent.
   - `mobileFallback(url)` replaces the transformation with
     `f_auto,q_auto:eco,w_720,ac_none`.
   - `firstFramePoster(url, width)` returns
     `…/video/upload/so_0,w_<width>,q_auto/<version>/<public_id>.jpg`.
   - It is applied at render time, so the stored URLs stay exactly as the editor
     entered them. Unit tests go in `scripts/video-url.test.ts`.
5. **Which film is shown:** on a phone (`max-width: 767px`) the mobile URL, or
   `mobileFallback(desktop)` when there's no mobile URL. Otherwise the desktop
   URL. Both go through `withoutAudio()`.
6. **Hero poster:** a Cloudinary first frame (`so_0`, `.jpg`), w_720 on phones
   and w_1920 on desktop. It's an `<img>` inside a `<picture>` with a
   `<source media>`, `fetchPriority="high"` and not lazy, so it's the LCP
   element and the intro's readiness check waits for it. For a film that
   isn't on Cloudinary, the admin "Poster image" field is used as today; that
   field's hint says so.
7. **The hero film loads after the page has loaded.** On `window` `load` (or
   immediately if it already fired), the client sets `src` on a muted, looping,
   `playsInline` `<video>` stacked over the poster at `opacity: 0`, then calls
   `play()`. On `playing` it fades to `opacity: 1` over **500 ms**
   (`--ease-luxury-bezier`). Nothing changes size, so there is no CLS.
   - Under `prefers-reduced-motion` or `navigator.connection.saveData`, the
     film is not loaded and the poster stays (the same rule as New Arrival).
   - A refused autoplay leaves the poster in place.
8. **New Arrival keeps loading when scrolled near.** `InViewVideo` gains the
   phone/desktop choice and `withoutAudio()`, and the same 500 ms fade over its
   existing poster. Its poster stays `imageUrl ?? featured image`.
9. **Intro fully gone by about 2 s** (currently about 3.7 s live), with the same
   choreography, just faster:
   - `MIN_HOLD_MS` 1600 → **600** (still counted from first paint);
     `EXIT_MS` 1100 → **450**. The entrance CSS tokens are compressed ×0.375 so
     they end at 600 ms. The exit tokens are cut so that `part-delay +
     part-dur = 450 ms` and `out-dur` is 250 ms.
   - Reduced motion: floor 600 → 300, exit 450 → 300.
   - `MAX_HOLD_MS` stays at **1000** so the curtain waits for the poster: it
     never lifts onto an empty hero. With live first paint at ~1.0 s, the
     curtain is gone at ~2.05 s. On a slow connection it can wait up to 1 s
     more for the poster; that is the cap.
   - Behind the curtain: the poster loads (high priority) and the film starts
     after `load` (§7), which often happens while the curtain is still up.

## Files likely to change

- `supabase/sql/0079_hero_mobile_video.sql` (new): `alter table
  public."HeroSetting" add column if not exists "videoMobileUrl" text`, with the
  same `^https://` check as `videoUrl`, then `notify pgrst, 'reload schema';`.
  Applied directly with `psql --single-transaction`;
  `supabase/README.md` updated.
- `src/schemas/content.ts`, `src/schemas/db/content.ts`,
  `src/types/content.ts`, `src/actions/admin/content.ts`: hero
  `videoMobileUrl`.
- `src/schemas/landing.ts`, `src/schemas/db/landing.ts`,
  `src/lib/landing-sections.ts`, `src/actions/admin/landing.ts`:
  `videoMobileUrl` in the `featured` settings (no migration; JSON).
- `src/components/admin/HeroForm.tsx`, `src/components/admin/NewArrivalForm.tsx`,
  and a new `src/components/admin/VideoUrlCheck.tsx` (the metadata probe and
  warnings, shared by both forms).
- New `src/actions/admin/video.ts` (`inspectVideoUrl`).
- New `src/lib/video-url.ts` + `scripts/video-url.test.ts`.
- `src/components/home/Hero.tsx`, a new `src/components/home/HeroFilm.tsx`
  (client: the load-gated film and fade), `src/components/home/InViewVideo.tsx`,
  and `src/app/[locale]/page.tsx` (pass the mobile URL).
- `src/components/intro/IntroCurtain.tsx`, `src/app/globals.css`: intro tokens
  only.

## Implementation requirements

- **Commits, in order, one per change:**
  1. migration + the hero/landing data plumbing;
  2. admin inputs, hints and warnings;
  3. the URL helper + `ac_none` + mobile fallback + tests;
  4. hero poster + load-gated film + fade (with the New Arrival fade);
  5. the faster intro;
  6. docs.
- Server stays server: `Hero.tsx` stays a Server Component and renders the
  poster `<picture>`; only `HeroFilm`, `InViewVideo` and `VideoUrlCheck` are
  client components.
- Zod on every new input (`videoMobileUrl`: optional, `https://`, allowed host,
  ≤ 2048 chars). `inspectVideoUrl` validates its argument with Zod as well.
- `src/lib/admin/revalidate.ts` already re-renders `/` and `/ar` on hero and
  New Arrival saves. Confirm it does, and don't add a second path.
- No new dependencies. Motion is CSS transitions (opacity only).

## Security requirements

- `inspectVideoUrl`: `requireAdmin()` first; host allowlist (`res.cloudinary.com`
  only); `HEAD` only; no redirects followed to other hosts (`redirect:
  "manual"`); 10 s timeout; nothing from the response except `Content-Length`
  and status is returned or logged.
- No CSP change: images and video stay on `res.cloudinary.com`, which is
  already allowed for `img-src` and `media-src`.
- The migration only adds a nullable column with a check constraint; it doesn't
  rewrite existing rows.

## Acceptance criteria

- **Admin → Home → Hero (Video)** and **Admin → New Arrival (Film)** each show
  "Mobile video address" under the desktop field, with the size hints from
  decision 2.
- Entering the current hero URL as the desktop video shows a warning for size
  and for width (828 < 1920) but still saves. A 720×1280 film under 500 KB as
  the mobile video shows no warning. Saving round-trips both fields.
- With no mobile URL, a phone receives
  `…/f_auto,q_auto:eco,w_720,ac_none/…/KHEM-40.mp4`. Every film URL on the page
  contains `ac_none`.
- The first HTML response contains the hero `<picture>` poster
  (`so_0,w_720…jpg` for phones, `so_0,w_1920…jpg` for desktop) and **no**
  video `src`. The film request starts only after the `load` event, then fades
  in over ~0.5 s.
- New Arrival is unchanged in timing (scroll-triggered) and gains the fade and
  the mobile source.
- Live, on a first visit to home, the curtain is fully gone by about 2.0–2.3 s
  on a fast desktop connection, and the hero poster is visible when it lifts.
  Product pages still show no intro.
- CLS stays ≤ 0.05. `tsc`, `eslint`, unit tests (including the new
  `video-url` tests) and `next build` pass.
- After deploy, mobile Lighthouse runs on `/`, `/ar`,
  `/perfume/sunlit-citrine` and `/ar/perfume/sunlit-citrine`, with the
  before → after scores reported to the owner.

## Checks to run

```bash
npx tsc --noEmit && npx eslint && npx tsx --test scripts/*.test.ts && npx next build
```

Migration: apply `0079` directly (`psql --single-transaction` or the same
`pg` transaction pattern used for 0078), confirm the column exists, and that
PostgREST returns it (`select=videoMobileUrl` on `HeroSetting` via the Data
API).

## Manual test steps (after deploy)

1. **Admin → Home page → Hero**: the media type is Video. Under "Video address"
   there's now "Mobile video address", with both size hints. Paste the current
   desktop link and see the size/width warning; save, and it saves.
2. **Admin → New Arrival**: the same two fields and hints appear when the media
   type is Film.
3. On a phone, or in devtools as an iPhone in a private window, open `/`. The
   curtain is gone in about 2 s onto the poster. In Network → Media, one film
   request appears after "load", with `w_720` and `ac_none` in its URL. It fades
   in.
4. On a desktop, the same check: the film URL has `ac_none` and the desktop
   transformation.
5. Add a mobile video link in the admin, save, reload the phone view, and the
   mobile file is the one requested.
6. Scroll to New Arrival: its film starts near the viewport and fades in.
7. Reduced motion (OS setting) or Data Saver: posters only, no film requests.
8. Open `/perfume/sunlit-citrine` in a private window: no curtain, as before.
