# Polish & UX Fixes — Clerk theming, footer collections, analytics, password policy, landing collections, hero scrims

## Goal

Six targeted polish fixes from `src/docs/Polish-UX-fixes.md`. No redesign, no
refactor, no schema change beyond one data-only migration. Every change reuses
an existing component, token, or CSS primitive.

## Skills read

None of the three approved skills (`clerk`, `supabase`, `ai-sdk`) are present in
this checkout (`.agents/skills/` does not exist). Work is therefore grounded in
the code itself, `AGENTS.md`, and the Clerk/Supabase usage already in the repo.
No AI SDK surface is touched.

## Existing code inspected

- `src/lib/clerk-appearance.ts`, `src/components/auth/{AuthShell,SignInForm,SignUpForm}.tsx`,
  `src/app/[locale]/{sign-in,sign-up}/…/page.tsx`, `src/app/[locale]/layout.tsx`
- `src/components/{Footer,FooterGroup}.tsx`, `src/constants/navigation-pages.ts`
- `src/app/[locale]/admin/analytics/page.tsx`, `src/services/admin/analytics.ts`,
  `src/components/admin/charts/*`, `src/components/admin/AdminShell.tsx`,
  `supabase/sql/0015_orders.sql` (`DailySales`, `daily_sales()`)
- `src/app/[locale]/page.tsx`, `src/components/home/{CollectionSlider,CollectionCard}.tsx`,
  `src/services/products.ts` (`getFeaturedCollections`)
- `src/components/ecommerce/{CategoryHero,CategoryView,CollectionView,NewArrivalHero}.tsx`,
  `src/components/{journal/ArticleHero,legal/LegalHero,stockists/StockistDirectory}.tsx`,
  `src/app/[locale]/{heritage,about,craftsmanship,ingredients}/page.tsx`,
  `.banner-scrim*` in `src/app/globals.css`
- `src/lib/i18n/dictionaries/{en,ar}.ts`

## Decisions and assumptions

1. **Clerk card is themed light, not dark.** `khemClerkAppearance` is written
   against the obsidian palette (`colorBackground: #1a1a1a`, ivory text) while
   `<AuthShell>` — and `/account`, where `<UserProfile>` and `<UserButton>`
   render — is `ground-ivory`. That mismatch *is* the "generic" look: a dark SaaS
   widget dropped into a light boutique page. The fix is to re-point the same
   variables at the light tokens (`--color-ivory`, `--color-ink`,
   `--color-gold-deep`, `--color-border-light`), keeping every existing decision
   comment and the `colorNeutral` note (its value flips to `--color-ink` for the
   same reason it was ivory before: it generates the shade ramp against the card).
2. **The logo goes in `<AuthShell>`, not through Clerk.** Clerk v7 exposes no
   stable, typed `logoImageUrl`; rendering `public/logo/logo-transparent.webp`
   in the shell header is the supported, non-fragile placement and satisfies the
   requirement. Static `import`, per the Footer's existing note about relative
   `src` breaking on `/ar` routes.
3. **Footer grouping is desktop-only markup.** Mobile keeps the flat list
   verbatim. Follows `<FooterGroup>`'s own precedent: render the grouped shape
   `hidden md:block` and the existing flat list `md:hidden`, rather than one
   list that behaves differently. Subheadings reuse `dict.nav.collectionGroups`
   — no new copy in either dictionary.
4. **Analytics root cause: the chart palette was never moved off obsidian.**
   `SalesChart` hard-codes `textColor: "rgba(247, 244, 236, 0.35)"` (ivory at
   35%) and `horzLines: rgba(255,255,255,0.06)`, but the desk is `ground-ivory`
   (`AdminShell`). Near-white text at 35% opacity on `#f7f5f0` is invisible —
   which is exactly "days, dates and numbers do not display". The data layer is
   correct: `daily_sales()` returns `YYYY-MM-DD`, `fillDays()` gap-fills the
   window, the tiles read the same series. No query, no date maths and no
   timezone handling changes. Secondary: `fontFamily: "var(--font-body)"` is not
   resolvable inside a canvas font shorthand, so the axis silently falls back to
   the browser default — replaced with a real stack.
5. **Password policy is Clerk-owned.** There is no project-side password
   validation anywhere (`grep` for `password` finds only comments). `<SignUp>`
   is Clerk's prebuilt component; minimum length, complexity and the compromised
   -password check all live in Clerk Dashboard → User & Authentication →
   Password. Per the brief, this is **documented, not faked** — no frontend rule
   is added that Clerk would then reject.
6. **Gemstone is featured by data, not by a hardcoded list.** The landing
   section renders `getFeaturedCollections()` (`Collection.isFeatured`, ordered
   by `sortOrder`). Adding a slug in code would create the "duplicate or
   inconsistent collection data" the brief forbids. One data-only migration flips
   the existing row. Heading copy moves off "Two Worlds of Scent" in both locales.
7. **Hero standardisation is the scrim's vertical layer, not the layout.** The
   reference pages (`/collections`, `/collections/noir`, `/collections/gemstone`,
   the scent-profile pages — all `<CollectionView>`) use `.banner-scrim-base`:
   opaque ivory at the bottom edge, fading to transparent upward, so the banner
   resolves into the page. Body Care / Gift Set / Discovery / Home Fragrance
   (`<CategoryHero>`, `.banner-scrim-column`) and Heritage / About / Ingredients
   /Craftsmanship / Stockists / New Arrival (`-column`, `-center`) carry a much
   weaker floor, so the image ends on a visible seam and the type sits over
   undimmed photography. Fix in `globals.css` only: bring the *vertical* layer of
   `-column` and `-center` up to the base ramp. The horizontal wash and the
   radial pool stay — the compositions are intentionally different, only the
   bottom-to-top reveal is unified. Type/CTA are inside the scrim's stacking
   context already, so they are covered by construction.

## Files likely to change

- `src/lib/clerk-appearance.ts`
- `src/components/auth/AuthShell.tsx`
- `src/components/Footer.tsx`
- `src/components/admin/charts/SalesChart.tsx`
- `src/app/globals.css` (`.banner-scrim-column`, `.banner-scrim-center` only)
- `src/lib/i18n/dictionaries/en.ts`, `src/lib/i18n/dictionaries/ar.ts`
  (`home.collections.heading` only)
- `supabase/sql/0039_feature_gemstone.sql` (new, data-only)
- `src/docs/clerk-password-policy.md` (new)

## Implementation requirements

### 1. Clerk appearance (light-first)

- Replace the token literals in `src/lib/clerk-appearance.ts` with the light
  ground values, mirrored from `globals.css` and named in comments as now:
  `colorBackground: #f7f5f0` (ivory), `colorForeground: #242321` (ink),
  `colorMutedForeground` ink-muted, `colorMuted` `#efebe4` (stone),
  `colorPrimary: #8a6a3f` (gold-deep, the gold that passes contrast on light),
  `colorPrimaryForeground: #f7f5f0`, `colorNeutral: #242321`,
  `colorBorder: #d8d3ca`, `colorRing`/`colorShimmer` on gold-deep,
  `colorInput` a translucent ink wash, `colorInputForeground` ink,
  `colorModalBackdrop` an ink wash rather than pure black.
- Keep `borderRadius: "2px"`, the font variables, `options`, and every existing
  explanatory comment; update the wording where it now describes light.
- `elements.card` background follows to ivory/stone; `formButtonPrimary` keeps
  uppercase / `0.2em` tracking / the 0.4s luxury bezier, hovering to ink rather
  than champagne (champagne on ivory is unreadable).
- No `!important`, no selector hacks, no removal of the Clerk badge.

### 2. `<AuthShell>` logo

- `import logo from "@/public/logo/logo-transparent.webp"` and render it above
  the eyebrow: `<Image>` with an explicit `sizes`, `h-…-w-auto`, `priority`
  omitted (below the fold on no viewport it is not LCP-critical — verify; if it
  is the LCP element on mobile, set `priority`).
- Alt text from the existing `dict.footer.logoAlt`, or the nearest existing auth
  key — do not invent a dictionary key without adding both locales.

### 3. Footer collections (desktop only)

- Inside the existing `<FooterGroup title={dict.footer.collections}>`, keep the
  current flat `<nav>` and mark it `md:hidden`.
- Add a second `hidden md:block` `<nav>` that walks `collections` from
  `navigation-pages.ts` in its native shape: `kind: "link"` rows print as now;
  `kind: "group"` rows print a small subheading (`dict.nav.collectionGroups[key]`,
  the `eyebrow`-adjacent micro type already used in the footer, e.g.
  `text-[10px] uppercase tracking-[0.2em] text-ground-muted/70`) with its
  children indented beneath. Quick-access links close the column as they do now.
- Both navs keep `aria-label={dict.footer.collections}`; only one is ever in the
  layout at a given width.
- Nothing else in `Footer.tsx` changes.

### 4. Analytics chart legibility

- In `SalesChart.tsx`, replace the obsidian literals with light-ground ones,
  mirrored from `globals.css` and named in comments:
  `textColor` → ink-muted (`#625f58`), `horzLines` → `#d8d3ca` at low alpha,
  crosshair lines → gold-deep at ~0.4, `labelBackgroundColor` → gold-deep with
  ivory text where the library allows.
- Series colours: the area line and histogram bars must read on ivory — use
  `--color-gold-deep`/`--color-gold` rather than `--color-gold-soft`/champagne,
  with the area fill a low-alpha gold.
- `fontFamily`: a literal stack (`"Inter, ui-sans-serif, system-ui, …"`), since
  a canvas cannot resolve `var()`.
- Do not touch `services/admin/analytics.ts`, `fillDays`, the RPCs, or the SQL.
- Empty states already exist (`ChartPanel.isEmpty`, `hasSales`) — leave them.

### 5. Password policy

- Add `src/docs/clerk-password-policy.md`: where the policy lives (Clerk
  Dashboard → Configure → User & Authentication → Password), the exact settings
  to relax (minimum length 8, complexity/character-class requirements off,
  keep the compromised-password (HIBP) check on), why nothing in this repo can
  enforce or contradict it, and the invariant that no client-side password rule
  may be added while `<SignUp>` owns the form.
- No code change. Report it as a Clerk-configuration limitation.

### 6. Gemstone on the landing page

- `supabase/sql/0039_feature_gemstone.sql`: `update public."Collection" set
  "isFeatured" = true where slug = 'gemstone';` — idempotent, data-only, with a
  header comment in the style of the existing migrations explaining that the
  home section renders `isFeatured` rows and that the flag is also editable from
  `/admin/collections`. No table, column, policy or grant changes.
- `home.collections.heading`: `"Two Worlds of Scent"` → `"Worlds of Scent"`;
  `"عالمان من العطور"` → `"عوالم من العطور"`. No other copy touched.
- No change to `page.tsx`, `CollectionSlider` (its `wideBasis` already opens a
  third slot at three items) or `CollectionCard` (`tone` is keyed on `noir`;
  Gemstone takes `standard`, and `COLLECTION_ORDINALS` already has four entries).

### 7. Hero scrim standardisation

- `globals.css` only. Raise the vertical layer of `.banner-scrim-column` and
  `.banner-scrim-center` to the `.banner-scrim-base` ramp — opaque
  `var(--color-ivory)` at `0%`, ~82% at ~30%, transparent by ~64–70% — leaving
  the horizontal (`--banner-dir`) and radial layers exactly as they are, and
  leaving the RTL rule alone.
- Update the comment blocks to record that all three variants now share one
  bottom-to-top floor and differ only in how they anchor the type.
- No component, no layout, no `items-*` change. `.banner-scrim-base` itself is
  the reference and is not touched.

## Security requirements

- No change to `middleware`/`src/proxy.ts`, `requireAdmin()`, RLS, grants, or any
  Server Action.
- The migration touches one boolean on one catalog row; the `Collection` table is
  already publicly readable.
- No client-side password validation is introduced (see §5) — the auth provider
  stays the single authority.
- Clerk appearance is presentation only; no flow, redirect or metadata change.
- `unsafeMetadata` handling in `SignUpForm` is untouched.

## Acceptance criteria

- `/signin` and `/signup` render a light KHEM-toned Clerk card with the KHEM
  logo above the heading; sign-in, sign-up, Google, and password-reset all work.
- `/account` (`<UserProfile>`, `<UserButton>` popover) is legible under the new
  appearance — no black-on-ivory or ivory-on-ivory text.
- Footer Collections is grouped with subheadings from `md` up; below `md` the
  accordion and its flat list are byte-for-byte what they are today.
- `/admin/analytics` shows readable axis dates, axis values, gridlines and
  crosshair labels in all three ranges; tiles and captions unchanged; the empty
  state still reads as "nothing recorded", not "sales collapsed".
- The landing collections section shows Signature, Noir and Gemstone with a
  heading that does not claim a number.
- Every HERO banner fades bottom-to-top into the page ground, on desktop and
  mobile, LTR and RTL; the reference pages look unchanged.
- `npx tsc --noEmit` and `npx next lint` clean; no new console errors.

## Checks to run

```
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`.
2. `/signin`, `/signup` — desktop + 390px, `en` and `/ar`: logo, card tone,
   focus rings, error state (submit a wrong password), "Continue with Google"
   label legibility, sign-up → account redirect, forgot-password step.
3. `/account` and the header user button popover — every row readable.
4. Any page footer at ≥1024px: Collections grouped. At ≤767px: tap Collections,
   confirm the accordion and flat list are unchanged.
5. `/admin/analytics` at 7 / 30 / 90 days: dates along the bottom axis, values on
   the right axis, hover crosshair labels; compare the tile figures to the curve.
   Then with an account that has no orders, confirm the empty panels.
6. Apply `supabase/sql/0039_feature_gemstone.sql` in the Supabase SQL editor,
   reload `/` — three cards, new heading, arrows enabled at ≥1024px.
7. Walk `/collections`, `/collections/noir`, `/collections/gemstone`, a scent
   profile, `/collections/body-care`, `/collections/gift-set`,
   `/collections/discovery`, `/collections/home-fragrance`, `/new-arrival`,
   `/heritage`, `/about`, `/craftsmanship`, `/ingredients`, `/stockists`, a
   journal article and a legal page — desktop and 390px, `en` and `/ar` —
   confirming each banner's bottom edge dissolves into the page.
