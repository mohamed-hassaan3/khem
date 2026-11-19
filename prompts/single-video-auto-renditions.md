# One film per section, both cuts automatic · a 1.0 + 0.6 s intro

> **Revised 2026-11-19 (owner):** the length cap is **20 s (`du_20`)**, not
> 10 s, for both cuts; the admin hint and warning say 20 s.

Owner decision on 2026-11-19, after reviewing
`prompts/mobile-video-hero-loading.md` (live as `e39826e`). It replaces that
prompt's "separate mobile video" input with **option 1**: a single film link
per section, from which the storefront builds the phone and desktop cuts. It
also slows the intro back down from 0.6 + 0.45 s, which reads as a flicker.

## Goal

- **One video link** for the Hero and one for New Arrival. Cloudinary builds:
  - phone: `f_auto,q_auto:eco,w_720,du_20,ac_none`
  - desktop: `f_auto,q_auto,w_1920,du_20,ac_none`
- **Remove the "Mobile video address" fields** from the admin.
- **Intro:** a 1.0 s logo reveal plus a 0.6 s curtain, gone about 2.6 s after
  navigation; a tap or key skips it from 0.2 s.
- Everything else from `e39826e` stays: the first-frame poster in the HTML, the
  film after `load`, the 0.5 s fade, New Arrival loading on scroll, reduced
  motion and Data Saver showing posters only, home only and once per session.

## Skills read

- `AGENTS.md` (workflow; motion rules: tweens, no spring or bounce).
- `supabase/README.md`. No migration is needed: see decision 3.

## Existing code inspected

- `src/lib/video-url.ts` + `scripts/video-url.test.ts`: `withoutAudio()`,
  `mobileFallback()`, `firstFramePoster()`, and
  `videoSources(desktop, mobile)`, which honours an editor's mobile link and
  keeps the editor's own desktop transformation (`w_828` today).
- `src/components/admin/HeroForm.tsx`, `src/components/admin/NewArrivalForm.tsx`:
  the "Mobile video address" inputs, plus `VideoUrlCheck` for both kinds.
- `src/components/admin/VideoUrlCheck.tsx`, `src/actions/admin/video.ts`:
  the metadata probe, and a HEAD size check restricted to Cloudinary.
- `HeroSetting."videoMobileUrl"` (0079) and `LandingSection('featured')
  .settings.videoMobileUrl`: both are null or absent in production (checked
  before removal).
- `src/components/home/HeroFilm.tsx`, `src/components/home/InViewVideo.tsx`,
  `src/app/[locale]/page.tsx`, and `src/components/home/Hero.tsx`.
- `src/components/intro/IntroCurtain.tsx` (`MIN_HOLD_MS` 600, `EXIT_MS` 450,
  `SKIP_AFTER_MS` 600), plus `globals.css` `--khem-intro-*` tokens.

## Measurements (live films, 2026-11-19)

| Film | Source length | Phone cut | Desktop cut |
| :-- | :-- | :-- | :-- |
| Hero `v1792146108/KHEM-40.mp4` | 36.4 s | 930 KB → **487 KB** with `du_20` | `w_1920` 6.0 MB → **3.09 MB** with `du_20` |
| New Arrival `Hero.mp4` | 5.8 s (unaffected by the cap) | **300 KB** | **1.50 MB** |

(`du_10` measured 190 KB / 1.25 MB on the hero, for reference.) With `du_20`
the hero's **desktop cut is over the 2.5 MB recommendation**, so the admin check
will warn about the current hero film's size. That's expected and doesn't block
anything: the desktop film loads after `load`, so it doesn't affect LCP. A
shorter source film is the way to bring it under.

Cloudinary's smart video crop (`g_auto`) returns 400 on this plan. On a phone,
the landscape film is centre-cropped by `object-cover`; I checked this frame
and the composition (light and a gold line) holds up.

## Decisions and assumptions

1. **`videoSources(url)` takes one URL.** For a Cloudinary film it *replaces*
   the editor's transformations with the two cuts above, so what visitors get
   no longer depends on what was typed after `/upload/`. A non-Cloudinary film
   is returned unchanged for both cuts, as today. `mobileFallback()` is
   renamed and folded in; `withoutAudio()` stays for anything else that
   needs it. The constants `PHONE_TRANSFORMATION` and
   `DESKTOP_TRANSFORMATION` live in `video-url.ts`.
2. **`du_20` caps every film at 20 s.** Hero becomes a 20 s loop of a 36 s
   film. If the 20 s mark doesn't flow back into frame 0, the loop visibly
   jumps. **Manual check after deploy**; if it jumps, the fix is to trim the
   source to a clean loop of up to 20 s, not a code change.
3. **The mobile link is removed from the admin and the code**, with no data
   migration:
   - The admin inputs, form state, Zod fields, save writes and read mappings
     for `videoMobileUrl` are removed (hero and landing).
   - The `HeroSetting."videoMobileUrl"` column stays, nullable and unused
     (documented in `supabase/README.md`). Dropping it would be a destructive
     migration for no gain; a later cleanup can remove it.
   - Before removing, confirm it's null in production and that `featured`
     settings carry no `videoMobileUrl`. If either holds a value, stop and
     ask.
4. **Admin hint and check, one per film:**
   - Hint: "Upload an MP4 of up to 20 s, 1920×1080, no sound. Longer films are
     cut to 20 s; phones get a lighter 720px copy automatically."
   - `VideoUrlCheck` measures the **delivered desktop cut** (size vs 2.5 MB)
     and the **delivered phone cut** (size vs 500 KB). It warns, without
     blocking, when the *source* is longer than 20 s ("will be cut to 20 s —
     check the loop") or smaller than 1920 px wide ("will look soft on large
     screens").
   - The `kind` prop goes, and `inspectVideoUrl` is unchanged.
5. **Posters** stay `so_0` first frames (720 / 1920 px), derived from the
   source URL.
6. **Intro: about 1.0 s of logo plus a 0.6 s curtain.**
   - `MIN_HOLD_MS` 600 → **1000** (from first paint); `EXIT_MS` 450 → **600**.
   - The entrance tokens are scaled to end at 1000 ms (×0.625 of the 1600 ms
     set): rule 55/240, bloom 140/640, wipe 190/690, settle 810, rule-out
     690/310.
   - The exit tokens: out 330, part-delay 110, part-dur 490 (110 + 490 = 600).
   - `SKIP_AFTER_MS` 600 → **200**, so a tap or key ends it almost at once.
   - Reduced motion is unchanged (300/300). `MAX_HOLD_MS` stays at 1000 (it
     still waits for the poster).
   - Expected live: the curtain is gone at ~2.5–2.7 s after navigation.

## Files likely to change

- `src/lib/video-url.ts`, `scripts/video-url.test.ts`
- `src/components/home/HeroFilm.tsx`, `src/components/home/InViewVideo.tsx`,
  `src/components/home/Hero.tsx`, `src/app/[locale]/page.tsx`
- `src/components/admin/HeroForm.tsx`, `src/components/admin/NewArrivalForm.tsx`,
  `src/components/admin/VideoUrlCheck.tsx`
- `src/types/content.ts`, `src/schemas/content.ts`, `src/schemas/db/content.ts`,
  `src/actions/admin/content.ts`, `src/schemas/landing.ts`,
  `src/schemas/db/landing.ts`, `src/lib/landing-sections.ts`,
  `src/actions/admin/landing.ts`
- `src/components/intro/IntroCurtain.tsx`, `src/app/globals.css` (intro tokens)
- `supabase/README.md` (the unused column), `src/docs/production-audit.md` (§9)

## Implementation requirements

- **Commits, one per change:**
  1. the URL helper and storefront: one link, two automatic cuts, `du_20`;
  2. remove the mobile field (admin, schemas, read and save paths), with the
     new admin hint and check;
  3. the intro at 1.0 + 0.6 s with early skip;
  4. docs.
- Order matters for commit 1: the storefront stops reading `videoMobileUrl`
  before commit 2 removes it, so every commit builds and runs.
- No new dependencies and no CSP change.

## Security requirements

- `inspectVideoUrl` keeps its guards: `requireAdmin()`, `res.cloudinary.com`
  only, HEAD, no redirects, 10 s timeout.
- No migration and no data change (the column is left as is).

## Acceptance criteria

- Admin Hero and New Arrival each show **one** video link, with the new hint.
  The check reports the delivered phone and desktop sizes and warns on a source
  longer than 20 s or narrower than 1920 px. Saving works.
- On a phone, the home page requests the hero film as
  `f_auto,q_auto:eco,w_720,du_20,ac_none/…` (~487 KB). On a desktop it
  requests `f_auto,q_auto,w_1920,du_20,ac_none/…` (~3.1 MB, after `load`). New Arrival does
  the same on scroll.
- The first HTML still has the `so_0` poster and no film `src`. The film starts
  after `load` and fades in.
- The intro is gone at ~2.5–2.7 s on a first home visit live, with the poster
  decoded when it lifts. A tap or keypress after 0.2 s skips it.
- Unit tests updated for the new `videoSources()`. `tsc`, `eslint`, tests and
  `next build` pass before deploy.
- After deploy: mobile Lighthouse on `/`, `/ar`, `/perfume/sunlit-citrine` and
  `/ar/perfume/sunlit-citrine` (two runs each), reported against the
  `e39826e` numbers.

## Checks to run

```bash
npx tsc --noEmit && npx eslint && npx tsx --test scripts/*.test.ts && npx next build
```

## Manual test steps (after deploy)

1. **Admin → Home → Hero** and **Admin → New Arrival**: one video field each,
   with the new hint. Paste the current hero link: the check shows the phone
   and desktop sizes, warns "36 s — will be cut to 20 s", and warns that the
   desktop cut (~3.1 MB) is over 2.5 MB. Save works.
2. Home on a phone, in a private window: the curtain (logo about 1 s, then it
   parts) is gone by about 2.5 s. Then the film fades in. In Network → Media,
   one request containing `w_720,du_20,ac_none`.
3. **Watch the hero loop on desktop for 40 s.** Note whether the cut at 20 s
   jumps. If it does, trim the source film to a clean loop.
4. Tap during the intro: it ends at once.
5. A product page in a private window still shows no intro.
