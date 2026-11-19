# LCP image priority · Clerk's weight on public pages

Owner: "yes, do both" (2026-11-19). The two items from
`src/docs/production-audit.md` §8–9: (1) product LCP image priority,
(2) Clerk loaded only where it's needed. Investigation changed both plans; see
"What I found".

## Goal

1. Every page's LCP image is fetched first and at high priority, and
   decorative images stop competing with it.
2. Cut Clerk's cost on public pages as far as can be done **safely**, measure
   it live, and decide the larger refactor on evidence.

## Skills read

- `AGENTS.md`.
- `.agents/skills/clerk` and the installed `@clerk/nextjs` 7.7.4 / `@clerk/shared`
  type definitions, for which props are public and which are `@internal`.
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md`
  for `priority`, `preload`, `loading` and `fetchPriority` in Next 16.

## What I found

### Images

- **Next 16 deprecated `priority`** ("in favor of `preload`"). In this version
  `priority` still makes an image eager and **adds a `<link rel="preload">`**,
  but **no `fetchpriority="high"`** (`next/dist/shared/lib/get-img-props.js`;
  the live PDP `<img>` has only `decoding="async"`). The docs: "In most cases,
  you should use `loading="eager"` or `fetchPriority="high"` instead of
  `preload`."
- 17 `<Image priority>` usages. Every page's `<head>` preloads
  **`full-logo-transparent`** (the intro artwork, `CinematicIntro.tsx`), the
  nav/footer name logo, and **`loading.webp`** (`LoadingScreen.tsx`, the route
  loader), *before* the page's own hero. On `/perfume/sunlit-citrine`, the
  product photo, which is the LCP element (Lighthouse: "fetchpriority=high
  should be applied"), is the **fourth** preload.

### Clerk (what loads on a public page, live)

| File | KB | How it loads |
| :-- | --: | :-- |
| `clerk-js` core | 84 | `<script>`: session state, needed for the nav's signed-in state |
| `@clerk/ui` `ui.browser.js` | 46 | `<link rel=preload>`, **High** priority, the `prefetchUI` default |
| `@clerk/ui` chunks (framework, ui-common, vendors, …) | 218 | fetched by clerk-js itself at ~3.9 s, after `load` |

KHEM's public pages render **no** prebuilt Clerk UI. The account menu is
custom (`AccountMenu.tsx`), and `<SignIn>`, `<SignUp>` and `<UserProfile>`
appear only on the auth and account pages.

- **`prefetchUI={false}`** is a public, documented `<ClerkProvider>` prop
  (`@clerk/shared` types: "Controls prefetching of the `@clerk/ui` script.
  `false` – Skip prefetching the UI (for custom UIs using Control
  Components)"). It removes the High-priority 46 KB preload from every page.
  - Whether clerk-js then *still* fetches the 218 KB of chunks later can only
    be measured on khemperfumes.com: the production instance doesn't run on
    localhost (checked; `window.Clerk.loaded` stays false).
- **Removing Clerk from public pages entirely** (the original idea) has no
  public "defer" option (only `@internal` props, which I won't build on). It
  means taking `<ClerkProvider>` out of the `[locale]` layout and giving it only
  to the auth, account and admin segments, with the nav and product-comment
  form working without Clerk hooks. **The risk, and why it's not in this
  prompt:**
  - Clerk keeps a signed-in user's 60-second session token fresh from the
    browser. Without clerk-js on a page, a signed-in customer who browses a
    product page and then **places an order or posts a comment** would reach
    the Server Action with an expired token. `auth()` would treat them as a
    guest: their order would not be linked to their account and their comment
    would be refused. (The document-request "handshake" refresh doesn't run for
    Server Action POSTs.)
  - Avoiding that means detecting signed-in visitors from Clerk's
    `__client_uat` cookie and loading Clerk *for them only*, through a single
    lazily-mounted provider. That's a real auth refactor (nav menu, sign-out,
    admin link, comments, checkout) which needs its own design, a test plan
    across sign-in, sign-out, SSO and checkout, and a measured reason to do it.
  - **Proposal:** ship the safe 80% now (below), measure what's left live, and
    bring the islands refactor back as its own prompt only if the numbers
    justify it.

## Decisions

1. **LCP images get `loading="eager"` + `fetchPriority="high"`**, replacing
   `priority`. This applies to the first product-gallery image
   (`ProductGallery`, index 0), the first hero slide in image mode
   (`Hero.tsx`), and the page heroes (journal, heritage, about,
   craftsmanship, ingredients, `ArticleHero`, `CategoryHero`,
   `CollectionView`, `NewArrivalHero`, `LegalHero`, `AuthShell`,
   `OrderCelebration`, `PrelaunchCover`). The video hero already uses
   `fetchPriority="high"` on its poster.
2. **Decorative images lose their preload.**
   - `CinematicIntro` artwork: `loading="eager"` only. It's in the HTML, so
     it's discovered at once on home, and on other pages (intro off) it no
     longer steals bandwidth.
   - `LoadingScreen` (`loading.webp`, shown only during route changes):
     `loading="lazy"` would delay it on the first navigation, so `eager`
     without a preload.
   - Nav/footer name logo: no preload (eager).
   - `OfferPopup` `priority={false}`: the prop is simply removed.
3. **`<ClerkProvider prefetchUI={false}>`** in the `[locale]` layout. Clerk
   still loads its UI on demand wherever a prebuilt component mounts (sign-in,
   sign-up, account profile), so those pages keep working. **Must be verified
   live:** sign-in, sign-up and the account profile render their Clerk forms
   in EN and AR.
4. **Measure after deploy:** whether the 218 KB of `@clerk/ui` chunks still
   load on public pages, plus mobile Lighthouse. Report it, with a
   recommendation on the islands refactor.

## Files likely to change

The 15 files with `priority` (listed in decision 1), plus `CinematicIntro.tsx`,
`LoadingScreen.tsx`, `Nav.tsx` and `Footer.tsx` (wherever the name logo is
preloaded), `OfferPopup.tsx`, and `src/app/[locale]/layout.tsx` (one prop).

## Implementation requirements

- **Commits:**
  1. image priority (all `priority` → explicit props, no remaining
     `priority`);
  2. `prefetchUI={false}`;
  3. docs.
- No `@internal` Clerk props. No dependency changes.
- A lint guard is optional: if the ESLint config allows a cheap
  `no-restricted-syntax` rule for the `priority` JSX attribute on `Image`, add
  it so the deprecated prop can't come back; otherwise note it in the docs.

## Security requirements

- No change to auth logic, middleware or Server Actions. Clerk is still
  loaded on every page, as today.

## Acceptance criteria

- The live PDP `<head>` preloads only the product photo, if it preloads
  anything at all. The intro logo, name logo and loader are no longer
  preloaded on any page.
- The PDP's first gallery `<img>` has `fetchpriority="high"`, and each page
  hero likewise. Lighthouse no longer reports "fetchpriority=high should be
  applied" on the PDP.
- No `ui.browser.js` preload on public pages. **Sign-in, sign-up, account
  profile and sign-out all work live in EN and AR** (rendered and clicked
  through; no real account changes).
- `tsc`, `eslint`, tests and `next build` pass. Mobile Lighthouse runs on `/`,
  `/ar`, `/perfume/sunlit-citrine` and `/ar/perfume/sunlit-citrine` (two
  each), reported against `dbf1d42`.

## Checks to run

```bash
npx tsc --noEmit && npx eslint && npx tsx --test scripts/*.test.ts && npx next build
```

## Manual test steps (after deploy)

1. `/sign-in` and `/ar/sign-in`: the Clerk form renders and you can sign in.
2. Signed in: the nav shows your avatar menu, and the admin link appears for
   the admin. `/account` → profile works. Sign out works.
3. On a product page, the first photo appears without the earlier delay. View
   source: no `full-logo-transparent` / `loading.webp` preload.
4. Signed in, post a test comment *only if you want to*. It should be accepted
   as before. (Optional: nothing about auth changed.)

---

## Outcome (2026-11-19) — read before reusing this prompt

- **Decision 2 was corrected during implementation.** React 19's server
  renderer auto-preloads every eager `<img>` (up to 10) unless it is
  `loading="lazy"`, `fetchPriority="low"`, or inside `<picture>`. So decorative
  images use `fetchPriority="low"`, not just `loading="eager"`. Shipped as
  `972075d`.
- **Decision 3 was wrong and has been reverted.** `prefetchUI={false}` does
  **not** load `@clerk/ui` on demand: `@clerk/react`'s `getClerkUIEntryChunk()`
  returns early and never loads it, so `<SignIn>`/`<SignUp>`/`<UserProfile>`
  cannot render. It crashed `/sign-in` and `/sign-up` live for ~2 minutes
  (21:19:51–21:21:59 UTC; no other visitor hit those pages). Rolled back to
  `dbf1d42`, then reverted in `eee60c2`. **Do not set `prefetchUI={false}`
  while any prebuilt Clerk component is in use.**
