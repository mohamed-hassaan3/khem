# Hero & Announcement Upgrade

Source of truth: `src/docs/HERO-AND-ANNOUNCEMENT-UPGRADE.md.md`.

## Goal

1. Make the landing-page hero a CMS-managed media hero: any number of
   cross-faded images (one or more) **or** one video, with independently
   optional headline / description / button, in EN and AR, edited from the
   existing Landing Page screen.
2. Give the existing announcement bar previous / next arrows that co-operate
   with its automatic rotation.

Enhancement only. No parallel CMS, no new admin route, no unrelated changes.

## Skills read

- `AGENTS.md` (root) — architecture, boundaries, design tokens, workflow.
- `supabase/AGENTS.md` — Supabase SQL is the schema source of truth; no Prisma.
- No Clerk / AI-SDK work in this task, so those skills are not engaged beyond
  the existing `requireAdmin()` boundary that every admin action already uses.

## Existing code inspected

| Area | File |
| --- | --- |
| Current hero (hard-coded, ivory typographic composition) | `src/app/[locale]/page.tsx` |
| Landing Page CMS screen | `src/app/[locale]/admin/content/landing/page.tsx` |
| Announcement bar | `src/components/marketing/AnnouncementBar.tsx` |
| Bar wiring, `--announcement-h`, `data-announcement` | `src/app/[locale]/layout.tsx` |
| Singleton-settings precedent (table, row, editor, action) | `supabase/sql/0035_marketing.sql`, `src/components/admin/MarketingSettingsForm.tsx`, `src/actions/admin/marketing.ts`, `src/services/admin/marketing.ts` |
| Repeatable-rows editor with “Add image” | `src/components/admin/ProductImageEditor.tsx` |
| Admin field primitives | `src/components/admin/fields.tsx`, `src/hooks/useUnsavedGuard.ts`, `src/providers/admin-toast-provider.tsx` |
| Row mappers / locale resolution | `src/schemas/db/content.ts`, `src/schemas/db/marketing.ts`, `src/lib/i18n/resolve.ts` |
| Zod boundary style | `src/schemas/marketing.ts` |
| Cache invalidation map | `src/lib/admin/revalidate.ts` |
| Motion + reduced-motion precedent | `src/components/animation/Reveal.tsx`, `src/components/home/CollectionSlider.tsx`, `.khem-announcement-fade` / `khem-fade-in` in `src/app/globals.css` |
| Image hosts | `next.config.ts` (`res.cloudinary.com`, `images.unsplash.com`, Supabase bucket) |
| Migration runner | `scripts/db-migrate.ts` (`npm run db:migrate`, idempotent, one transaction) |

## Decisions and assumptions

1. **No maximum number of images.** §1's “3 images or more” is the reading
   that stands: minimum one, no ceiling. One slide renders as a static hero with
   no timer, no rotation and no progress bar — there is nowhere to rotate to, so
   arming an interval for it would be machinery doing nothing. Two or more
   enables the fade, the timer and the progress indicator. The “Add image”
   control is always available; “Remove” is always available per row. Nothing in
   the schema, the database or the editor caps the count.
2. **Media is a URL, not an upload.** Every existing image field in this
   dashboard (`ProductImageEditor`, `offerPopupImageUrl`, collection banners) is
   a pasted https URL against the hosts allowed in `next.config.ts`. Building an
   upload widget would be a parallel media system — explicitly out of scope.
3. **No configured media ⇒ the current hero, unchanged.** The existing ivory
   typographic composition (circles, wordmark, rule, tagline, two links) stays in
   the file as the fallback branch and is what renders until the desk configures
   a hero. Nothing regresses on day one and the migration needs no fake photo.
4. **Video hosting.** Video is a URL too, on the same allowlist idea, rendered
   by a plain `<video>` (`muted`, `playsInline`, `loop`, `autoPlay`,
   `preload="metadata"`, `poster`). `next/image` does not touch video; the poster
   goes through `next/image`-style optimisation only as the `poster` attribute
   URL, so the hosts list needs no change for it. A new `remotePatterns` entry is
   added only if the poster host is not already allowed — it will be, because it
   is the same media library.
5. **Reduced motion.** Follows the bar’s existing precedent: rotation is a
   *content* change and is kept, the cross-fade and the content’s translate are
   dropped in CSS. Stopping rotation would strand a reduced-motion visitor on
   slide one.
6. **SEO / headings.** The hero headline renders as the page’s single `<h1>`
   when enabled. When it is disabled, a visually-hidden `<h1>` carries the house
   name so the home page never ships without one. Slides never each render a
   heading — the headline is hero-level, not slide-level, so there is nothing to
   duplicate.
7. **Announcement arrows are carousel-only.** `MARQUEE` is a continuous track
   with no discrete index and `STATIC` has nowhere to go; arrows appear only when
   the effective mode is `CAROUSEL` (which already requires ≥2 live rows). Both
   ends wrap, matching the existing modulo rotation.
8. **Bar height is untouched.** `--announcement-h` stays as it is; the arrows sit
   inside the existing one-line bar as `inset-y-0` edge buttons, so `CLS` and
   every `pt-20` page offset are unaffected.
9. **Dictionary keys already exist** — `announcementBar.previous` / `.next` are
   in both trees and currently unused. They get used rather than duplicated.

## Files likely to change

**New**
- `supabase/sql/0037_hero.sql`
- `src/types/hero.ts` (or a `// ── Hero ──` block appended to `src/types/content.ts`; decided in favour of a section in `content.ts` to match how craft/heritage types live together)
- `src/components/home/Hero.tsx` (client: slides, fade, timer, progress, content reveal, video branch)
- `src/components/admin/HeroForm.tsx` (client: the Landing Page hero editor)

**Edited**
- `src/app/[locale]/page.tsx` — hero section becomes `<Hero config={…}>` with the existing composition as the no-media fallback
- `src/app/[locale]/admin/content/landing/page.tsx` — Hero row in `SECTIONS` becomes “Edited below”, `<HeroForm>` mounted above Craft pillars
- `src/services/content.ts` — `getHero(locale)`
- `src/services/admin/content.ts` — `getAdminHero()`
- `src/schemas/db/content.ts` — columns + `toHero` / `toAdminHero` mappers
- `src/schemas/content.ts` — `heroSchema` (zod boundary)
- `src/actions/admin/content.ts` — `saveHero()`
- `src/lib/admin/revalidate.ts` — `revalidateHero()` (home page, both locales)
- `src/components/marketing/AnnouncementBar.tsx` — arrows + timer reset
- `src/app/globals.css` — hero fade / staggered reveal keyframes + reduced-motion block
- `src/lib/i18n/dictionaries/{en,ar}.ts` — hero slide/pause a11y labels

## Implementation requirements

### Database — `supabase/sql/0037_hero.sql`

Idempotent, in the house style (`create … if not exists`, `drop policy if
exists` before `create policy`, comments that explain the *why*).

```
type  public."HeroMediaType"  enum ('IMAGES', 'VIDEO')

table public."HeroSetting"            -- singleton, id text pk default 'default' check (id = 'default')
  "mediaType"          public."HeroMediaType" not null default 'IMAGES'
  "slideDurationMs"    int not null default 6000 check (between 3000 and 15000)
  "videoUrl"           text        check (starts with https:// )
  "videoPosterUrl"     text        check (starts with https:// )
  "videoAlt"           text, "videoAlt_ar" text          -- <=160
  "showHeadline"       boolean not null default false
  "showDescription"    boolean not null default false
  "showButton"         boolean not null default false
  "headline" / "_ar"           text  -- <=120
  "description" / "_ar"        text  -- <=280
  "buttonLabel" / "_ar"        text  -- <=40
  "buttonHref"                 text  check (app path: ^/[A-Za-z0-9/_-]*$)
  "updatedAt"          timestamptz not null default now()
  -- cross-field: VIDEO requires "videoUrl"; the row is otherwise always valid
  -- (IMAGES with zero slides is the “not configured yet” state, not an error)
  insert … values ('default') on conflict do nothing

table public."HeroSlide"
  id text pk default gen_random_uuid()::text
  "imageUrl"  text not null check (https)
  "alt"       text not null check (1..160)
  "alt_ar"    text check (<=160)
  "sortOrder" int not null default 0
  "createdAt" timestamptz not null default now()
  -- No row-count ceiling. The hero is a slideshow of however many campaign
  -- images the house is running; the storefront cost of an extra one is a lazy
  -- image that is never fetched until its turn comes.
```

RLS: both tables `enable row level security`; `select` policy for `anon,
authenticated` (this is public marketing chrome, exactly like `"Announcement"`);
every write is service-role behind `requireAdmin()`. `grant select … to anon,
authenticated`. End the file with `notify pgrst, 'reload schema';` as
`0035`/`0036` do.

Applied with `npm run db:migrate`.

### Types

```ts
HeroMediaType = "IMAGES" | "VIDEO"
HeroSlide      { id; imageUrl; alt }                 // alt resolved to locale
Hero           { mediaType; slideDurationMs; slides; videoUrl; videoPosterUrl;
                 videoAlt; headline; description; buttonLabel; buttonHref }
                 // storefront: already resolved, and already *filtered* —
                 // a disabled or empty field arrives as null
AdminHero      { …both languages, the three show* booleans, slides with alt/altAr }
```

The storefront type deliberately has no `show*` booleans: the service applies
them, so the component cannot render a heading the desk switched off.

### Service reads

- `getHero(locale)` — publishable key, `withTimeout`-free (the home page is not
  the root layout, and `services/content.ts` reads are unguarded today; match the
  neighbours), two queries in one `Promise.all`, mapper resolves `_ar`, returns
  `null` on any failure so the page falls back to the typographic hero.
- `getAdminHero()` — secret key, both languages, all slides.

### Frontend — `src/components/home/Hero.tsx`

- Server component `page.tsx` awaits `getHero(activeLocale)` alongside its
  existing `Promise.all`, and renders `<Hero>` only when there is media.
- Section keeps the current geometry: `ground-ivory relative flex h-svh
  min-h-160 …`, so nav ground, announcement offset and mobile height are
  untouched.
- **Images**: every slide is an absolutely-positioned `next/image` with
  `fill`, `sizes="100vw"`, `className="object-cover"`, opacity 0/1 with a
  1200ms `--ease-luxury-bezier` transition. Slide 1 carries `priority` and
  `fetchPriority="high"`; the rest are `loading="lazy"` — no LCP regression, and a hero of
  any length costs one image on first paint.
- **Timer**: one `window.setInterval`, single `useEffect`, restarted by an
  `epoch` state bump. Never two intervals. Paused when the tab is hidden
  (`document.visibilitychange`) and when the pointer is over the hero.
- **Progress**: a hairline gold rule under the content, one segment per slide,
  the active segment filled by a CSS `transform: scaleX` animation whose
  duration is `slideDurationMs`, keyed on the slide index so it restarts. No
  per-frame JavaScript. Hidden under `prefers-reduced-motion` and when there is
  one slide.
- **Manual control**: slide dots/segments are real `<button>`s with
  `aria-label` from the dictionary (`Show slide 2 of 3`), keyboard reachable;
  clicking one resets the timer.
- **Video**: one `<video muted playsInline loop autoPlay preload="metadata"
  poster={…}>`, `aria-label` from `videoAlt`, `object-cover`. No slider, no
  second source, no controls.
- **Content**: `<h1>` / `<p>` / `<LocaleLink className="btn btn-primary">`,
  each rendered only when the service handed a value. Staggered CSS reveal —
  0ms / 140ms / 280ms, opacity + 12px translate on `cubic-bezier(0.16, 1, 0.3,
  1)`, `both` fill so nothing flashes and nothing shifts. Reduced motion drops
  the translate and the delay in `globals.css`, never in JS.
- Overlay: a restrained ivory-to-transparent scrim only when content is shown,
  so text stays legible over photography without darkening a bare visual hero.

### Frontend — `AnnouncementBar.tsx`

- Two `<button>`s, `ChevronLeft` / `ChevronRight` from lucide at
  `strokeWidth={1.25}`, 44px touch target via padding, `absolute inset-y-0`
  start/end, `aria-label={dict.announcementBar.previous | .next}`, rendered
  only when `effectiveMode === "CAROUSEL"`.
- The message keeps `px-5 sm:px-8` plus arrow-width padding when they are
  present, so nothing overlaps and the bar never overflows horizontally.
- `go(delta)` sets the index modulo-wrapped **and** bumps an `epoch`, which is
  in the interval effect’s dependency array — that is the timer reset, and it is
  the same single interval, not a second one.
- RTL: the arrows use logical `start`/`end` positioning, so in Arabic “next”
  sits on the left, and the chevrons swap glyph by direction.

### Admin — `HeroForm.tsx`

Mounted on the existing Landing Page screen, above Craft pillars. Same shape as
`MarketingSettingsForm`: local state, one payload object, `useUnsavedGuard`,
`useAdminToast`, `AdminNotice` for field errors, one `AdminButton` submit.

- `Media type` — `AdminSelect` (`Images` / `Video`). The irrelevant block is not
  rendered, so a video hero cannot be edited as a slideshow.
- Images: repeatable rows (URL, Alt EN, Alt AR) with up/down, **Remove**, and
  an always-available **Add image** button — no cap. Thumbnail preview via a
  plain `<img>`, the reason `ProductImageEditor` documents. A hint states the
  rule the storefront applies: one image is a static hero, two or more rotate.
- Video: URL, poster URL, alt EN/AR, with the “one video only” rule stated in
  the hint rather than implied.
- Timing: `AdminSelect` of 4 / 6 / 8 / 10 / 12 seconds.
- Content: three `AdminToggle`s; each toggle reveals its EN/AR pair. Button also
  reveals `Button URL`.
- Saved by one `saveHero()` action — settings row and slides in one write, so a
  half-saved screen cannot leave `VIDEO` selected with no video.

### Validation — `heroSchema`

- `mediaType` enum; `slideDurationMs` coerced int 3000–15000.
- `VIDEO` ⇒ `videoUrl` required and https.
- `IMAGES` ⇒ any number of slides, including none (the unconfigured state that
  keeps the typographic hero). Each slide that exists needs an https URL and a
  non-empty English alt; a wholly blank row is dropped rather than refused.
- `showHeadline` ⇒ non-empty `headline`; same for description; `showButton` ⇒
  non-empty `buttonLabel` **and** a `buttonHref` matching the app-path pattern
  already used by `hrefField` in `src/schemas/marketing.ts` (reused, not
  re-invented — no absolute URLs, no `javascript:`).
- Empty optional strings normalise to `null`.

## Security requirements

- `requireAdmin()` is the first statement of `saveHero()`; nothing else in this
  change is writable from a browser.
- Every write input parsed by zod before it reaches a query; the database
  re-states each rule as a check constraint.
- `buttonHref` is an app path only, and is rendered through `LocaleLink` — the
  same open-redirect posture the announcement `href` already has.
- Media URLs must be `https://`; `next/image` only proxies the allowlisted hosts
  in `next.config.ts`, and an unlisted host fails loudly in the editor rather
  than silently on the storefront.
- Storefront reads go through the publishable key so the RLS policies are
  actually exercised.

## Acceptance criteria

Every box in §18 of the source document, plus:

- The Landing Page CMS keeps its craft-pillar editor and its section map intact.
- With no hero configured, `/` renders exactly what it renders today.
- One image is static; two or more rotate. No maximum is enforced anywhere.
- No new dependency; no carousel library.
- `npx tsc --noEmit` and `npm run lint` clean.
- No new console errors or hydration warnings on `/` or `/ar`.

## Checks to run

```
npm run db:migrate
npx tsc --noEmit
npm run lint
npm run build          # confirms both locale trees still prerender
npm run dev            # for the browser pass
```

## Manual test steps

1. `npm run db:migrate`, then `npm run dev`.
2. `/admin/content/landing` — Hero section is present, Media type = Images, no
   slides. Public `/` still shows the current typographic hero.
3. Add one image (any allowed host) + alt EN/AR. Save. Reload the admin screen —
   the value persisted. Open `/` — the image hero renders, no text.
4. With exactly one image: no rotation, no progress bar, no timer — a static
   hero. Confirm no interval is armed (no repainting progress segment).
5. Add a second, third, fourth and fifth image. Save. Watch `/`: fade
   1→2→3→4→5→1 on the configured interval, progress segments advance in step,
   no jump, and only the first image is requested on load.
6. Enable Headline only, save, check `/` — headline reveals, no description, no
   button, no empty space.
7. Enable all three, set a button to `/collections`, save, check `/` — staggered
   reveal, button navigates, and on `/ar` it goes to `/ar/collections`.
8. Set the button URL to `https://evil.example` — refused with a readable message.
9. Switch to Video, paste a video URL and a poster, save — one looping muted
   video, poster visible before it plays, no slider controls, no image requests.
10. Save with Video selected and no URL — refused.
11. `/ar` throughout: RTL layout, Arabic headline/description/button, Arabic
    alt text.
12. DevTools: iPhone SE, iPad, 1440px desktop — hero height, crop, text and
    progress bar all behave; no horizontal scrollbar.
13. Emulate `prefers-reduced-motion: reduce` — slides still change, nothing
    fades or slides, no progress animation.
14. Announcement bar: with ≥2 live announcements and mode Carousel, arrows
    appear. Click ← from the first message → last message. Click → from the last
    → first. After each click the full interval elapses before the next auto
    step. Tab to each arrow and activate with Enter and Space.
15. `/ar`: arrows mirrored, Arabic labels announced.
16. Switch the bar to Marquee and to Static — no arrows, previous behaviour
    unchanged.
17. Performance: Lighthouse mobile on `/` before and after, LCP not worse.
