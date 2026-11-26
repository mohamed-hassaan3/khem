# /about — redesign to the "About Page Mock"

## Goal

Rebuild `src/app/[locale]/about/page.tsx` to follow the design canvas
**"KHEM — About Page Mock"** (claude.ai design artifact
`e632da08-f543-4349-b841-153fb2714093`, artboard `Main.dc.html`), built from
the app's own tokens, ground classes, buttons, `Reveal` and existing Nav and
Footer. It should look the same as the mock, but it is a KHEM page and not a
copy of the mock's HTML.

Two new photographs, supplied by the founder:

| Use | URL | Size |
| --- | --- | --- |
| Hero (portrait) | `https://res.cloudinary.com/co1xzkhf/image/upload/v1795705883/146DD9E7-D2D4-453F-80BA-FE35CD087EF1_1_102_o.jpg` | 1122×1402 (≈4:5) |
| Founder portrait | `https://res.cloudinary.com/co1xzkhf/image/upload/v1795705883/DDEB04BF-FA55-4392-965D-EECD8125196C_1_105_c.jpg` | 766×1026 (≈3:4) |

Both return 200 `image/jpeg`. `res.cloudinary.com` is already allowed in
`next.config.ts` (images and CSP), so no config change.

## Skills read

- `node_modules/next/dist/docs/` for App Router Server Components, `next/image` and ISR.
- No Clerk, Supabase-schema or AI SDK work is involved. The page only reads
  through existing `src/services/content.ts` functions.

## Existing code inspected

- `src/app/[locale]/about/page.tsx`: today it renders `EditorialHero` (old banner),
  the Founder (sand), Mission statements (ivory, 2 columns, from the DB) and
  the CTA (sand). ISR is 24h.
- `src/app/[locale]/admin/content/about/page.tsx` edits `MissionStatement`
  rows (label/title/text + `_ar`).
- `src/services/content.ts` has `getMissionStatements`, `getTimeline`, `getCraftSteps`,
  `getCraftStats`, `getBrandValues`. All are public reads that degrade to `[]`.
- `src/types/content.ts` has the `TimelineEvent {year,title,description}`,
  `CraftStep {number,title,subtitle,body,image}` and `CraftStat {value,label}` types.
- `src/lib/admin/revalidate.ts` has `revalidateAbout()` (only `/about`),
  `revalidateHeritage()` (timeline), `revalidateCraftsmanship()` (steps and stats).
- `src/lib/i18n/dictionaries/{en,ar}.ts` has the `about.*` keys (meta, hero, founders, cta),
  plus `footer.boutiqueAddress` and `contact.consultation.*`.
- `src/components/editorial/EditorialHero.tsx`, `NavGround`, `animation/Reveal`,
  `animation/stagger`, `i18n/LocaleLink` and `lib/i18n/rtl` (`ltrIsland`).
- `src/app/globals.css` has the tokens `ivory #f7f5f0`, `stone #efebe4`, `sand #e8e1d5`,
  `ink #242321`, `ink-muted #625f58`, `ink-subtle #8b867d`, `dim #b8b3aa`,
  `gold #b08d57`, `gold-deep #8a6a3f`, `border-light #d8d3ca`. These are the **exact
  hexes the mock uses**. The ground classes are `.ground-ivory/.ground-stone/.ground-sand/
  .ground-charcoal/.ground-obsidian`, plus `.btn .btn-primary .btn-outline`,
  `.eyebrow` and `.gold-line`.
- `public/logo/logo-transparent.svg` is the emblem for the closing CTA.

## Decisions and assumptions

1. **Keep the site's Nav and Footer.** The mock's own header and footer are
   not rebuilt. `NavGround ground="ivory"` stays.
2. **Stored data drives the repeating sections** (AGENTS.md says "UI must
   display stored data only"). The mock's literal copy is used only where no
   table exists yet:
   - **Principles (03)**: `MissionStatement` rows. This is the table `/admin/content/about`
     already edits. They render as the mock's numbered cards (I, II, III, …) and
     the grid adapts to the row count. Empty means the section is hidden.
   - **Timeline (04)**: `TimelineEvent` rows, shared with `/heritage`, ending in a
     "Discover our heritage" link to `/heritage`. Empty means hidden.
   - **Craftsmanship (05)**: `CraftStep` rows (number, title, and `subtitle` as the
     one-line description). The heading links to `/craftsmanship`. Empty means hidden.
   - **Facts strip**: `CraftStat` rows (value and label), so the numbers are the
     ones the house already publishes. The mock's "6 / 4 / 16 months" figures are
     **not** hard-coded. Empty means hidden.
3. **Fixed copy goes in the dictionaries, en and ar**: hero buttons and
   meta row, marquee words, "The Name / KEMET" section, section eyebrows and
   headings, promise band, visit cards, CTA lede. The Arabic text is drafted by
   the implementer and **flagged for the founder's review** in the hand-off.
4. **Founder copy fixes**: `imageAlt` becomes singular ("Mohamed Hassaan, founder of
   KHEM, in the atelier"). `quoteAuthor` becomes "Mohamed Hassaan" (it said "Co-Founder" in en,
   "المؤسّس" in ar). A new `founders.role` key holds "Founder & Perfumer · Dubai — Cairo".
   The existing bio text is kept as it is.
5. **The hero becomes the mock's split composition** (text left, 4:5 portrait right),
   not `EditorialHero`. The new photo is portrait, so a full-bleed banner would crop it badly.
   `EditorialHero` itself is untouched (other pages use it).
6. **The promise band has no photograph yet.** It is drawn in CSS and SVG as in the mock
   (`.ground-obsidian` with gold line-art pyramids, `aria-hidden`). The mock's placeholder
   caption "Full-bleed campaign film / photography" is **not** shipped.
7. **"Get directions"** links to `/stockists` (no maps URL is invented). **"Request appointment"**
   links to `/contact`, which already has the consultation block. **"Find a stockist"** links to `/stockists`.
8. **Revalidation**: the page now quotes `TimelineEvent`, `CraftStep` and `CraftStat`, so
   `revalidateHeritage()` and `revalidateCraftsmanship()` must also re-render `/about`.
   Update their comments and the `revalidateAbout()` comment ("the only page that reads
   them" stays true for mission statements). See AGENTS.md §8.
9. **The hero image is the LCP element**, so it gets `priority` (eager, high fetch priority) and a fixed
   `aspect-4/5` box. The founder image is lazy. It is only 766 px wide, so on a 2× display at
   50vw it will look a little soft. Noted for the founder; a larger original can be swapped
   in later by changing one URL.
10. No schema, migration, Server Action or admin change.

## Files likely to change

- `src/app/[locale]/about/page.tsx` (rewrite)
- `src/components/about/AboutMarquee.tsx` (new, Server Component, pure CSS animation)
- `src/components/about/AboutTimeline.tsx` (new, Server Component) *(optional: inline in
  the page if it stays short)*
- `src/app/globals.css` (a small `about` block: marquee keyframes, the timeline rule,
  hover lift for cards, all under `prefers-reduced-motion` guards)
- `src/lib/i18n/dictionaries/en.ts`, `src/lib/i18n/dictionaries/ar.ts` (`about.*` additions and fixes;
  the `ar` dictionary must satisfy the same type as `en`)
- `src/lib/admin/revalidate.ts` (add `/about` to the timeline and craft revalidators)

## Visual preview

Approved reference renders (real copy and DB content as of 2026-11-26):
`scratchpad/about-plan/desktop.png` (1440) and `mobile.png` (390), built from
`about-plan.html`. Where this prompt and the preview disagree, the preview wins.

## Implementation requirements

### Page structure (top to bottom), mapped to the mock

All sections use the existing horizontal padding scale of the current page
(`px-4 sm:px-6 md:px-10 lg:px-12 xl:px-16`, `mx-auto max-w-7xl`), plus `Reveal` for entrances
with a stagger from `revealStagger`. Physical left/right utilities become logical
(`ms/me/ps/pe/start/end`) so Arabic mirrors correctly.

1. **Hero**: `.ground-ivory`, `py-12 md:py-28`.
   Two columns from `lg` (`grid-cols-2 gap-16 xl:gap-24 items-center`), one column below that,
   with **text first, image second** on phones.
   - `.eyebrow` "About KHEM". `h1` in `font-heading`, uppercase, `font-normal`,
     `text-[clamp(38px,5.4vw,76px)] leading-[1.04] tracking-[0.02em]` (88px, as in the mock, breaks "A House of" onto two lines at 1440). Line 2 is in
     `text-ground-accent`. The lines come from the existing `headingLine1` and `headingLine2`.
   - A 96px gold hairline (`.gold-line`, `my-9`).
   - The lede comes from the existing `hero.lede`: `max-w-[520px] text-base md:text-lg leading-[1.75] text-ground-muted`.
   - Buttons: `btn btn-primary` "Our Story" goes to `#story`. `btn btn-outline` "Shop Collections" goes to
     `/collections` via `LocaleLink`.
   - A meta row with a top border (`border-t border-ground-border pt-7 mt-14 flex gap-10 text-xs`).
     It has two items, "Founded / Cairo, Egypt · 2025" and "Tagline / Essence of Heritage", with labels in
     `font-heading text-[10px] tracking-[0.24em] uppercase text-ground-subtle`.
   - Image: `figure` with `relative aspect-4/5 overflow-hidden bg-obsidian`, `next/image` `fill`,
     `object-cover`, `priority`, `sizes="(min-width:1024px) 50vw, 100vw"`. There is a hover zoom of `scale-[1.04]` over
     1.6s with the house ease, and no caption overlay. alt: new key `hero.imageAlt`.
2. **Marquee**: `.ground-sand`, `border-y border-ground-border py-5`, `aria-hidden`.
   The phrases come from the dictionary, each followed by a gold ✦ (a text glyph is fine
   here because it is decorative; this is not an emoji). The list is rendered twice and translated by `-50%`
   over 48s linear infinite. RTL: the animation direction is reversed. Reduced motion: it is static and clipped.
3. **01 — The Name** (`id="story"`, `.ground-sand`, `py-18 md:py-36`, `scroll-mt-[var(--header-h)]`).
   The split is `items-start`. On the left: eyebrow "01 — The Name", then "KEMET" in `font-heading`
   `text-[clamp(56px,9vw,136px)] leading-[0.95] tracking-[0.04em]`, then the subtitle "The Land of Black
   Earth" (`font-heading tracking-[0.24em] uppercase text-ground-muted`). On the right: a lead paragraph
   (`text-xl md:text-[26px] font-light leading-normal text-ground`), a body paragraph, and a
   gold-underlined text link "Discover our heritage" to `/heritage`.
4. **Facts strip** (`CraftStat`, `.ground-ivory`, `py-6 md:py-12`). Desktop: up to 4 per row
   with hairline dividers between them (`border-s`, none on the first). Below `md`: a 2-column grid with
   top borders. Values are `font-heading text-[clamp(36px,4vw,56px)] leading-none` and labels are
   `text-[13px] text-ground-muted mt-3.5`. Hidden when empty.
5. **02 — The Founder** (`.ground-ivory`, `border-t`, `py-16 md:py-32`). Image left, text right
   on `lg`; image first on phones. `figure` `aspect-4/5 bg-stone border border-ground-border`,
   founder `next/image` `fill object-cover object-center` (the photo is hands at the bench, no face), lazy. Text: eyebrow "02 — The Founder",
   name `h2` `text-[clamp(32px,3.6vw,52px)]`, role line `text-[13px] tracking-[0.06em] text-ground-subtle`,
   the two existing body paragraphs, then a `blockquote` with `border-t border-gold pt-8 mt-11`, the quote in
   `font-heading text-[clamp(20px,2vw,28px)] leading-[1.45]` (not italic, as in the mock), and `footer`/`cite`
   for the author in `text-[10px] tracking-[0.26em] uppercase text-ground-accent`.
6. **03 — The House Principles** (`MissionStatement`, `.ground-ivory`, `border-t`, `py-14 md:py-28`).
   The header row has the eyebrow and `h2` on the start side and a `max-w-[380px]` lede on the end side; it wraps on phones.
   Cards use a `grid gap-6` with column count = `min(rows, 3)` from `md` up (today 2 rows means 2 columns) and sit on `bg-stone border border-ground-border
   rounded-[2px] px-8 pt-10 pb-11`. Each card has a roman numeral (`font-heading text-[13px] tracking-[0.2em]
   text-ground-accent`), the `title` as `h3` (`mt-14 mb-3.5 text-[21px]`) and the `text` as body. The DB
   `label` is shown beside the numeral ("I · Mission", "II · Vision"). Hover: `-translate-y-1` and a gold border over 620ms with the house ease (no lift
   under reduced motion). The DB text keeps the existing `ltrIsland` treatment the current page applies.
7. **04 — A Timeline of Scent** (`TimelineEvent`, `.ground-sand`, `py-16 md:py-32`).
   Header: eyebrow and `h2` "Five Thousand Years, One Thread", `max-w-160 mb-16`. `md` and up: a
   horizontal row, `grid-cols-[repeat(N,minmax(0,1fr))]` up to 4 columns per row (wrapping to further
   rows beyond 4), a 1px gold rule at 60% opacity behind the markers, and each event a 15px rotated-square
   marker (gold outline on sand; the **last** one is filled ink), then the year (`font-heading text-xs
   tracking-[0.22em] uppercase text-ground-accent`), the title `h3` at 20px and the description at 14px.
   Phones: a vertical list with the rule running down the start edge. Use an `<ol>`.
8. **05 — Craftsmanship** (`CraftStep`, `.ground-ivory`, `py-16 md:py-32`). The header row has the eyebrow and
   `h2` "Mastery in Every Drop" plus a "Explore the process" link to `/craftsmanship`. Grid
   `md:grid-cols-2 lg:grid-cols-3` with `border-t` and each cell `border-b py-9 pe-8`. Each cell shows the number
   (`text-[13px] tracking-[0.16em] text-ground-accent`), the title `h3` at 19px and the `subtitle` at 14px muted. Use an `<ol>`.
9. **The KHEM Promise** (`.ground-obsidian`, `min-h-[520px]`, centred). The background is the
   mock's gold line-art pyramids SVG (`stroke-opacity .22`, `preserveAspectRatio="xMidYMid slice"`,
   `aria-hidden`). It shows an eyebrow (gold), `h2` "Modern Egyptian Luxury" (uppercase, ivory,
   `text-[clamp(34px,5vw,72px)]`), and a lede in `text-dim`. There is no placeholder caption.
10. **06 — Experience KHEM in Person** (`.ground-ivory`, `py-16 md:py-30`). The header is centred.
    Three cards (`border border-ground-border rounded-[2px] p-8 md:px-8 md:py-9`, same hover as §6),
    each with a Lucide icon (`strokeWidth={1.25}`, 28px, gold-deep: `Landmark`, `FlaskConical`, `Globe`),
    an `h3`, a body (the Boutique body reuses `footer.boutiqueAddress`) and a gold-underlined link (see Decision 7).
11. **CTA** (`.ground-sand`, `py-18 md:py-34`, centred). It has the emblem `public/logo/logo-transparent.svg`
    (`next/image`, height 72, `alt=""`), then `h2` "Experience KHEM" (existing key, uppercase,
    `text-[clamp(34px,4.4vw,64px)]`), a new lede key, and the existing buttons: `btn-primary` to `/collections`
    and `btn-outline` to `/heritage`.

### Typography and colour

- Headings use `font-heading` (Cinzel) with `font-normal`. Body uses `font-body` (Inter). Eyebrows use the existing `.eyebrow`
  class if it matches the mock's 11px / 0.32em / gold-deep; otherwise use a local class with those values.
- Gold **as text on light grounds** is always `gold-deep`/`text-ground-accent` (#8a6a3f, contrast 4.9:1).
  `gold` (#b08d57) is used only for rules, markers, borders, icons and on obsidian.
- No new colour values. Every colour is an existing token.

### Motion

- Entrances use `Reveal` (existing). The hero rule draws in with `scaleX` (origin `start`).
- The ease is `cubic-bezier(0.16,1,0.3,1)` everywhere. There is no spring or bounce, and the mock's `kDrift` float
  is **dropped** (it reads as bobbing).
- Everything decorative is off under `prefers-reduced-motion`.

### Responsiveness

- It must be pixel-faithful to the mock at 1440, look correct at 1024 and 768, and at 390 everything is one column, the
  facts are 2-up, the timeline is vertical, there is no horizontal scroll, and touch targets are at least 44px.
- Arabic (`/ar/about`) mirrors cleanly: logical properties throughout, and the marquee runs the other way.

### Data and caching

- Fetch everything in one `Promise.all`: mission statements, timeline, craft steps, craft stats, dictionary.
- `revalidate = 86400` stays. Update the comment to name the new revalidators.
- `revalidate.ts`: `revalidateHeritage()` also calls `revalidateAllLocales("/about")` (the timeline), and
  `revalidateCraftsmanship()` does the same (steps and stats). Before choosing, check every caller of both
  to confirm that brand-value-only edits don't need `/about` (they don't, since `/about` doesn't read `BrandValue`).
- Metadata: keep `generateMetadata`. Fix `ogDescription` "The founders" to "The founder".

## Security requirements

- No new input, no Server Action, no auth surface. The page stays public and static (ISR).
- External images come only from the already-allowlisted `res.cloudinary.com`.
- DB text is rendered as text (React escaping). No `dangerouslySetInnerHTML`.

## Acceptance criteria

- `/about` and `/ar/about` render all 11 sections in order, with the two new photographs.
- With any one of the four tables empty, its section disappears and the page still reads correctly.
- Editing a mission statement, a timeline event or a craft step or stat in admin is reflected on `/about`
  without waiting for the 24h window.
- No hard-coded copy in the JSX. All fixed strings are in `en.ts` and `ar.ts`.
- The site's Nav and Footer are unchanged, and there is no duplicate header or footer.
- At 390 px there is no horizontal overflow, and nothing overlaps the sticky header.
- Reduced motion: no marquee, no hover lift, no zoom.
- `npx tsc --noEmit`, `npm run lint` and `npm run build` all pass.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`, then open `http://localhost:3000/about`.
2. At 1440 px wide, compare section by section with the mock artboard "About — Desktop (1440)".
3. Click **Our Story**. It should scroll to "01 — The Name" and sit below the sticky header.
4. DevTools device toolbar at 390 × 844: check the single column, the hero text above the photo, the 2-up facts,
   the vertical timeline, and no sideways scroll.
5. Open `/ar/about`: check the mirrored layout, the Arabic copy and the marquee direction.
6. DevTools › Rendering › emulate `prefers-reduced-motion: reduce`: the marquee is static and there is no hover lift.
7. Signed in as the test admin, open `/admin/content/about`, edit a mission statement's title and save,
   then reload `/about`. The title should be updated.
8. In `/admin` edit one timeline event (heritage) and one craft stat, then reload `/about`. Both should be updated.
9. Lighthouse on `/about` (mobile): LCP is the hero image, and CLS is 0.

## Outcome (2026-11-26)

Built as above, approved from the preview renders. Deviations and additions:

- **Figures changed at the founder's request** — in the live DB (`CraftStat`):
  `formulation-trials` 300+ → **100+**, `creation-months` 16 → **6**. They are
  stored data, so `/about`, `/craftsmanship` and anything else quoting them
  change together.
- **Same claim elsewhere, brought in line** (audit):
  - `CraftStep` `formulation`: subtitle "Hundreds of Trials" → "Over a Hundred
    Trials"; body "between 80 and 300 formulation trials" → "more than a hundred
    formulation trials" (EN + AR).
  - `LandingSection` `featured` (home "Our Craft" film block): same body sentence.
  - `en.ts`/`ar.ts` `craftsmanship.meta.ogDescription` and `craftsmanship.cta.lede`:
    "sixteen months" → "six months", "hundreds of formulation trials" → "more
    than a hundred".
  - `supabase/seed/content.json` and `src/docs/FINAL-VERIFICATION.md` mirror the DB.
  - Left alone on purpose: Kyphi's "sixteen ingredients" (history), the Ebers
    Papyrus "hundreds of formulas" (history), "Hundreds of decisions" (not trials),
    and the Onyx Night journal story ("three years", one fragrance's own history).
- **Arabic fixes found on the way**: `CraftStat.continents-sourced.label_ar` read
  "the bottles from which ingredients are imported" → "قارّات نستقدم منها
  المكوّنات"; `creation-months.label_ar` had no unit → "أشهر في المتوسط لابتكار كل
  عطر"; `about.founders.body1` contained the English words "global clients";
  `imageAlt` said "the two founders".
- **Mission statements are no longer wrapped in `ltrIsland`** — they have Arabic
  columns now, and the island was forcing Arabic text left-to-right.
- **Promise band uses `.ground-charcoal`**, not `.ground-obsidian`: the design
  system reserves obsidian for image-bounded areas.
- `Reveal` gained `as="li"` so the timeline and craft lists are valid `<ol>` markup.
- `next/image` `priority` is lint-banned in Next 16 → `loading="eager"` +
  `fetchPriority="high"` on the hero.
- DB rows were backed up before the edit to the session scratchpad
  (`db-backup-2026-11-26/`).
- Checks: `tsc`, `npm run lint`, `npm run build` clean. Rendered on localhost at
  1440 and 390, EN and AR; no horizontal overflow (scrollWidth 390). Console
  shows only the two pre-existing dev-only messages (React eval under CSP,
  `/hk.js` 404 — nginx serves it in production), identical on `/heritage`.
