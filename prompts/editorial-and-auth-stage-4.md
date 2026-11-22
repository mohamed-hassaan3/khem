# Stage 4 — Editorial & auth

Part of the whole-app redesign (stage list: `prompts/storefront-redesign-stage-2.md`
hand-off; working agreement: self-audit → build → self-test → local commit →
wait for OK to push). Visual language: Stage 1 (account), Stage 2 (storefront),
Stage 3 (chrome). No canvas mock; self-audit as in Stage 3.

## Goal

Bring the editorial pages and the sign-in / sign-up screens into the Stage 1–3
language, mobile first, EN + AR: `/about`, `/heritage`, `/craftsmanship`,
`/ingredients`, `/journal`, `/journal/[slug]`, `/contact`, `/stockists`, the four
legal pages (`/privacy-policy`, `/cookie-policy`, `/terms-conditions`,
`/return-exchange`), `/unsubscribe`, `/sign-in`, `/sign-up`.

## Skills read

`AGENTS.md` (§2.2, §3, §8 + the `src/lib/admin/revalidate.ts` rule, §8.1
prelaunch, §10.2 Clerk only on Clerk routes). `clerk` skill not needed beyond
the existing `appearance` object: no flow, redirect or provider change. No
routing, caching-mode or boundary changes. Supabase / AI SDK not needed.

## Existing code inspected

All route files above; `components/auth/{AuthShell,SignInForm,SignUpForm,KhemClerkProvider}`,
`lib/clerk-appearance.ts`, `components/journal/*`, `components/legal/*`,
`components/contact/ContactForm`, `components/stockists/StockistDirectory`,
`components/ingredients/IngredientExplorer`, `components/newsletter/UnsubscribePanel`,
`lib/format.ts`, `lib/i18n/dictionaries/{en,ar}.ts`.

## Audit (390×844, live dev server, 2026-11-22)

1. **Editorial heroes** (about, heritage, craftsmanship, ingredients): the text is
   laid over the photograph at full phone width. On `/about` the heading runs
   onto the dark marble ("A House of" — "of" lost). The same hero JSX and the
   same 30-line comment are copied into four files.
2. **Legal pages**: the title is illegible over the banner on phones (Privacy
   Policy: ivory-on-bright image). "Last updated", "Contents", "Questions",
   its sentence and "Email Us" are hard-coded English — they show in English
   on `/ar/*`; the date is English too. The contents index is desktop-only,
   so a phone reader of a 5,900px policy has no way to jump.
3. **Journal**: on phones every article is a 520px card — 4,300px of page for
   the index. Dates are English on `/ar` (`formatArticleDate` ignores locale).
   Category tabs are the old underline row (Stage 3 uses pills).
4. **Ingredients**: one 400px card per material on phones (~20 materials);
   the grid is single-column below 640px.
5. **Stockists**: no boutique is open yet (Cairo, Dubai are "coming soon"),
   so the map panel reads **"0 Locations Worldwide"** and the Partners
   section heads an empty grid. The map panel is 400px tall on a phone for
   two chips.
6. **Contact**: channel labels at `text-ground-accent/50` (fails contrast);
   aside cards `p-10` on a phone.
7. **Sign-in / sign-up**: Clerk's card repeats the page title as
   "Sign in to KHEM Web App" (Clerk's application name, also in AR). Logo
   64px + `pt-16` push the form below the fold on a 390px phone. The guest
   footer offers only "Your Bag". Copy promises "your saved fragrances" (EN
   + AR) — saving was withdrawn from the product (AGENTS §9).
8. **Craftsmanship**: step numerals at `text-gold/15` are invisible; otherwise
   sound. **Heritage** timeline and **About** body are sound.
9. **Data, not UI (report only)**: Blue Iris carries the Latin name
   *Aquilaria malaccensis* (agarwood's) in the ingredients table.

## Decisions

1. **One `EditorialHero` component** (`src/components/editorial/EditorialHero.tsx`,
   Server Component) replacing the four copies: props `image`, `eyebrow`,
   `lines: [string, string]`, `lede`, `scrim`, optional `children` (the
   craftsmanship scroll hint). **Phone (<md):** the photograph as a 4:3 band,
   the text block beneath it on the page ground — no text over the image.
   **md+:** exactly today's overlay composition (height, scrim, type sizes).
   Image stays `loading="eager" fetchPriority="high"` (LCP).
2. **LegalHero**: same phone treatment (image band, text below). All five
   hard-coded strings move to `dict.legal.document` (EN + AR); the date uses
   the locale (see 4). **Phone contents**: a `<details>` "Contents" disclosure
   above the first section (anchors only, no JS); desktop sticky index unchanged.
3. **Journal index**: featured card unchanged. Below `sm`, the remaining
   articles render as compact rows (96px square image, category · read time,
   title, date; ruled dividers); `sm+` keeps the card grid. Category filter
   becomes the Stage 3 pill chips (same client-side filter). The article page's
   `ArticleHero` gets the phone image-band treatment for consistency.
4. **Dates by locale**: `formatArticleDate(iso, locale)` and
   `formatLegalDate(iso, locale)` use `ARABIC_INTL_LOCALE` for `ar` (Latin
   digits, per the Stage 2 decision). All callers updated.
5. **Ingredients**: 2-up grid on phones (image 150px, name + origin; Latin
   name hidden below `sm` to keep tiles calm); the opened detail spans the row.
   `COLUMN_BREAKPOINTS` gains the 2-column base so row placement stays right.
6. **Stockists**: when no boutique is open, the map panel reads "Opening soon"
   (new dict key, EN + AR) instead of "0 Locations Worldwide", and the
   Partners section is not rendered. Map panel 260px tall on phones.
7. **Contact**: channel labels full accent colour; aside cards `p-6` on phones.
8. **Auth**: `AuthShell` compact on phones (logo 44px, `pt-8`, tighter gaps)
   so the email field is on the first screen; guest footer gains
   "Explore the collections" beside "Your Bag". Copy: "saved fragrances"
   removed from sign-in body and meta (EN + AR). Clerk's card header stays
   (it carries step titles in multi-step flows, so hiding it is wrong);
   **the "KHEM Web App" name is a Clerk Dashboard setting — reported for the
   user to rename to "KHEM"**, not worked around with CSS.
9. **Craftsmanship**: step numeral `text-gold/40` on the photo; phone step
   image 3:2.
10. **Unsubscribe**: light pass only if needed after capture (ivory card,
    spacing) — no change to the token/action logic.
11. **Not changed**: any data (item 9), Clerk flows/redirects/providers,
    caching windows, revalidation lists (no new public surface).

## Files likely to change

`src/components/editorial/EditorialHero.tsx` (new); `app/[locale]/{about,heritage,craftsmanship,ingredients,journal,contact,stockists}/page.tsx`;
`components/legal/{LegalHero,LegalDocumentBody}.tsx` + the four legal pages (pass
locale/labels); `components/journal/{JournalGrid,ArticleCard,ArticleHero}.tsx`;
`components/ingredients/IngredientExplorer.tsx`; `components/stockists/StockistDirectory.tsx`;
`components/auth/AuthShell.tsx`; `lib/format.ts`; `lib/i18n/dictionaries/{en,ar}.ts`;
possibly `components/newsletter/UnsubscribePanel.tsx`.

## Implementation requirements

- Server Components stay server; only the existing client islands stay client.
- Logical properties (`ms-/ps-/start-`) for RTL; Latin digits in AR.
- Motion: existing `Reveal` only; ease-out, no spring; reduced motion respected.
- No hard-coded user-visible English in touched files.
- Strict TS, no `any`; ESLint clean.

## Security requirements

No new routes, actions, cookies, storage keys or Clerk props beyond
presentation. Unsubscribe still performs no write on render. Legal/journal copy
still rendered as text nodes (no `dangerouslySetInnerHTML` added).

## Acceptance criteria

- At 390px no hero text sits over a photograph on the editorial and legal pages;
  desktop heroes unchanged.
- `/ar` legal pages: no English chrome; dates in Arabic with Latin digits.
- Journal index ≤ ~55% of its current phone height with 6+ articles.
- Ingredients 2-up at 390px; opening a tile shows the detail across the row.
- Stockists never shows "0 Locations"; no empty Partners section.
- Sign-in at 390×844: email field visible without scrolling (cookie banner
  dismissed); no "saved fragrances" copy.
- 360px: no horizontal overflow on any touched page, EN + AR.
- `tsc --noEmit` and ESLint clean.

## Checks

`npx tsc --noEmit`; ESLint on changed files; agent-browser captures at 390×844
and 1440×900, EN + AR, of every page in the goal; 360px overflow sweep; open an
ingredient tile; switch a journal category; sign-in and sign-up render (no
credentials entered).

## Manual test steps (after build)

1. `npm run dev`, open `/about`, `/heritage`, `/craftsmanship`, `/ingredients`
   at phone width: photograph first, heading below it, readable.
2. `/ar/privacy-policy`: Arabic chrome, Arabic date, "Contents" opens and jumps.
3. `/journal` on a phone: compact rows; tap a category pill; open an article.
4. `/ingredients`: tap a tile, detail spans both columns; close it.
5. `/stockists`: "Opening soon", no empty partners block.
6. `/sign-in` on a phone: form on the first screen; links under it.
7. Desktop 1440px: the same pages look as before apart from journal pills,
   contact labels, stockists empty state and auth spacing.

## Outcome (built 2026-11-22)

- `EditorialHero` replaces the four copied heroes. Phones: photo band, text
  beneath. Desktop: the overlay as before, but the type block is wider and
  steps 6xl → 7xl → 8xl, so "A House of" no longer breaks into four lines
  (it already did that before this stage). Arabic gets its own line-height and
  eyebrow gap (the hamza of «أرض» was touching the eyebrow).
- Legal: the photo is a band with the text beneath it **at every width**, not
  only on phones. On desktop the privacy title over the dark seal couldn't be
  read either, and banners are chosen per document, so the picture can't be
  trusted to keep the text legible. "Last updated / Contents / Questions /
  Email Us" now come from the dictionary; dates follow the locale with Latin
  digits; phones get a `<details>` Contents; the table uses logical alignment.
- Journal: pill filter; phone rows (`ArticleRow`); `/journal` at 390px went
  4,284px → 2,253px. Article hero is a photo band on phones. Dates localized
  (also on the home journal cards).
- Ingredients: 2-up on phones (5,321px → 2,864px); opened tile spans the row.
- Stockists: "Boutiques Opening Soon" while none are open; Partners hidden;
  coming-soon rows readable.
- Contact: labels and handles at full accent colour; tighter phone spacing.
- Auth: compact on phones (Continue button on the first screen at 390×844);
  "Explore the Collections" beside "Your Bag"; "saved fragrances" copy →
  "orders, addresses and vouchers" (EN + AR). Clerk app name renamed by the
  user in the dashboard ("Sign in to KHEM" now).
- Craftsmanship: step numerals visible (ivory/45); 3:2 step image on phones.
- Data: Blue Iris Latin name `Aquilaria malaccensis` → `Iris pallida` (its
  own description names *Iris pallida*), in the live table and in
  `supabase/seed/content.json`. Written directly, so `/ingredients` refreshes
  on its 24h window, or at once if the material is re-saved in the admin.
- Unsubscribe: checked, unchanged.
- Seen, not changed: the dev-only "1 Issue" badge is React's `eval` blocked
  by the development CSP (pre-existing; production unaffected).

Checks: tsc + ESLint clean; captures at 390×844 and 1440×900, EN + AR; 360px
overflow sweep of every Stage 4 route in EN + AR: none.
