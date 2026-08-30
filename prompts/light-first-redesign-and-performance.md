# Light-First KHEM Redesign & Performance Optimization

Source brief: `src/docs/KHEM-REDESIGN-AND-PERFORMANCE.md` (read in full).
Existing design SoT: `src/docs/khem-ui-design-system.md` (to be rewritten by this work).

---

## Goal

Two deliverables, in this order:

1. **One unified light-first KHEM environment.** Ivory is the ground the whole
   application sits on; Sand carries warmth and rhythm; Soft Stone is the card
   and panel level; Charcoal is structure, type and primary action; Gold is a
   minimal accent. The customer site and the admin dashboard stop being two
   visual worlds, and the site stops alternating between a dark and a light one.
   Full responsive coverage on desktop, tablet and mobile for both.

2. **An evidence-based performance pass.** Baseline is already measured (below).
   Fix what the measurements actually point at, then re-measure and report
   before/after honestly, including anything that did not improve.

Business logic is out of scope and must not change: Supabase, Clerk, products,
cart, checkout, discounts, credits, vouchers, emails, webhooks, SEO metadata,
ISR/caching, i18n and RTL all keep working exactly as they do today.

---

## Skills read

- `.agents/skills/supabase` — for the query-performance section (§45 of brief).
- `node_modules/next/dist/docs/` + `vercel-plugin:nextjs` — App Router
  boundaries, `next/font`, `next/image`, route segment config, ISR.
- `vercel-plugin:agent-browser` — driving Chrome for the responsive and
  navigation-heat verification passes.
- `.agents/skills/clerk` — only to confirm the auth surfaces keep working while
  their appearance object is restyled.

No new dependencies are introduced by this work.

---

## Existing code inspected

- `src/app/globals.css` (1354 lines) — the `@theme` token block, the five
  `.ground-*` classes, `.btn`/`.field`/`.card`/`.nav-link`/`.eyebrow`
  primitives, the loading and announcement keyframes, the `[lang="ar"]` and
  mobile-density override blocks.
- `src/app/[locale]/layout.tsx` — provider tree, fonts, announcement bar sizing.
- `src/components/Nav.tsx` (868 lines), `Footer.tsx`, `LoadingScreen.tsx`,
  `NavGround.tsx`, `providers/nav-ground-provider.tsx`.
- `src/app/[locale]/page.tsx` — the ten homepage sections and their grounds.
- `src/components/admin/AdminShell.tsx` and the 46 `admin/**/page.tsx` routes.
- `src/components/animation/Reveal.tsx`, `home/TestimonialCarousel.tsx`,
  `home/CollectionSlider.tsx`, `marketing/AnnouncementBar.tsx`,
  `ecommerce/CollectionGrid.tsx`, `ecommerce/StickyPurchaseBar.tsx`.
- `src/lib/fonts.ts`, `next.config.ts`, `src/services/**`.
- Baseline `npm run build` output and six Lighthouse runs (below).

---

## Phase 1 — Audit findings (already completed)

### 1.1 The colour system is half-built, and its default is the wrong way round

The `.ground-*` mechanism in `globals.css` is sound and should be **kept and
extended, not replaced**. It already resolves background, foreground, muted,
accent, hairline, button, field and card variables together per ground, which is
exactly the semantic-token architecture §49–§50 of the brief asks for.

What is wrong is the *defaults* and the *census*:

- `:root` and `body` are obsidian. Every surface that declares nothing is dark.
- Ground usage across `.tsx`: **41 obsidian, 33 ivory, 11 sand, 2 charcoal.**
- **52 page files declare no ground at all** — including all 46 admin routes and
  `cart`, `checkout`, `collections`, `collections/[slug]`, `sign-in`, `sign-up`,
  and five `account/*` routes. All of them are currently dark by inheritance.
- `text-ivory` appears **282 times** and `text-gold` **178 times**, mostly as
  fixed dark-ground colours that will be wrong on an ivory ground.
- Raw dark utilities still in use: `bg-surface` ×30, `bg-background` ×21,
  `bg-black` ×15, `bg-card` ×8.
- The homepage alternates **obsidian → sand → ivory → charcoal → obsidian →
  obsidian → sand → ivory → ivory → obsidian**. This is precisely the "switching
  between two websites" the brief rejects.
- Token gaps against the brief: no Soft Stone `#EFEBE4`; charcoal is `#151515`
  (brief asks `#242321`); secondary text is `#5f5a52` (brief: `#625F58`); no
  muted `#8B867D`; border is `rgba(21,21,21,0.1)` (brief: `#D8D3CA`).

### 1.2 Performance baseline (measured, `next build` + `next start`, local)

Lighthouse 13, headless Chrome, production build, canonical URLs.
Artefacts: `scratchpad/base-*.json`.

| Page | Device | Perf | FCP | LCP | TBT | CLS | SI |
|---|---|---|---|---|---|---|---|
| `/` | desktop | **68** | 0.7s | 1.8s | 0ms | **0.764** | 1.0s |
| `/` | mobile | **47** | 2.4s | **8.2s** | 0ms | **0.757** | 4.0s |
| `/collections/signature` | desktop | **70** | 0.9s | 1.5s | 0ms | **0.764** | 1.1s |
| `/collections/signature` | mobile | **71** | 2.9s | 7.1s | 40ms | 0 | 3.6s |
| `/perfume/onyx-night` | desktop | **71** | 0.6s | 1.5s | 0ms | **0.764** | 0.9s |
| `/perfume/onyx-night` | mobile | **46** | 2.9s | **8.3s** | 10ms | **0.757** | 3.2s |

This reproduces the ~72 desktop / ~63 mobile the brief reports.

**Finding P1 — CLS 0.76 is the single biggest scoring loss, and it is one
shift.** Lighthouse reports exactly one layout shift on every page, on the same
element: `<footer class="ground-obsidian">`. Identical score on three unrelated
routes means a *global* cause, not page content. Leading hypothesis is the
webfont swap: `src/lib/fonts.ts` sets `preload: false` on all four faces (a
deliberate trade to halve font payload across locales), so Cinzel/Inter arrive
after CSS parse and the swap reflows the whole document, with the tallest
trailing block scoring the shift. **This must be confirmed by experiment before
being fixed** — the fix differs depending on whether it is the font swap, a
late-arriving image, or the announcement bar.

**Finding P2 — mobile LCP 7–8.3s.** Ten `/_next/image` requests on the homepage
first load, each 0.9–2.5s on a cold optimizer. Only two images carry `priority`,
which is correct; the problem is volume and optimizer cold-start, plus no AVIF
in `next.config.ts` (`images.formats` is unset, so WebP only).

**Finding P3 — device heat during navigation: `backdrop-filter` on
fixed/sticky elements.** Every one of these re-blurs the region behind it on
every scroll frame, on the GPU:

- `Nav.tsx:411` — `backdrop-blur-xl` on the **fixed, full-width** header. The
  background behind it is already `color-mix(… 94%, transparent)`, so the blur
  is very nearly invisible and is close to pure cost.
- `Nav.tsx:757` and `:814` — **two `.mega-menu` panels are always mounted** at
  `opacity: 0`, each `position: fixed`, full width, with
  `backdrop-filter: blur(20px)` from `globals.css`. They are `hidden lg:block`,
  so this is a desktop-only cost, but on desktop it is two live blur layers over
  the whole viewport for the entire session.
- `CollectionGrid.tsx:262` — `backdrop-blur-xl` on the sticky filter bar
  (96% opaque).
- `account/layout.tsx:71` — `backdrop-blur-md` on the sticky sidebar.
- `StickyPurchaseBar.tsx:86` — `backdrop-blur-md` (88% opaque).
- `AdminShell.tsx:314` — `backdrop-blur-md` on a sticky bar (90% opaque).

Six sticky/fixed blur surfaces, five of which sit behind a background that is
88–97% opaque. This is the strongest available explanation for sustained GPU
load while scrolling and navigating.

**Finding P4 — 282 KiB unused JavaScript** (Lighthouse `unused-javascript`),
against 2.2 MB of client chunks. 107 of 247 `.tsx` files are client components.
`<Reveal>` (Motion) is instantiated **72 times** across the site, pulling Motion
into nearly every route for an effect that is a fade and a 40px translate — CSS
can do it with an IntersectionObserver-free `animation-timeline` fallback or a
single shared observer.

**Finding P5 — `server-response-time` 750ms** on the local cold run. Not
actionable locally (Vercel ISR serves these from cache); noted so it is not
mistaken for an app-level regression in the after-run.

### 1.3 What the audit found to be *healthy* — do not "fix" these

- **ISR is correct and must be preserved verbatim.** The build prerenders 197
  pages. Marketing/editorial 1h, legal 1d, collections 10m, PDP/ritual 5m, cart
  5m, account/admin/checkout `force-dynamic`. `generateStaticParams` covers both
  locales. `ClerkProvider` deliberately omits `dynamic` to keep routes static —
  this comment in `layout.tsx` is load-bearing.
- **Supabase queries are already disciplined** — explicit column lists, no
  `select('*')`, embeddings excluded from list payloads. §45 of the brief needs
  verification, not surgery.
- **Fonts are already locale-split**; only the active locale's pair is mounted.
- **No `<video>` backgrounds, no canvas, no WebGL, no `animate-pulse`/`spin`
  loops.** The two `setInterval`s (testimonial rotation, announcement carousel)
  are content changes, not animation loops, and both pause correctly.
- **`prefers-reduced-motion` is already honoured** for the orbit, shimmer, fade,
  search rows, confirmation sequence and marquee.

---

## Decisions and assumptions

1. **Extend the existing `.ground-*` system; do not rewrite it.** It is the
   semantic-token layer the brief asks for. The work is to add Soft Stone, flip
   the defaults to light, retire obsidian from general use, and migrate call
   sites off fixed colours.
2. **`ground-obsidian` and `ground-charcoal` survive but become rare.** Per §21
   the footer stays charcoal, and §17 allows charcoal cards and image framing
   for NOIR. Obsidian is retained only as an image-overlay/framing tone. Neither
   remains a page ground for any route.
3. **Adopt the brief's exact hex values** where they differ from today's tokens
   (charcoal `#242321`, secondary `#625F58`, muted `#8B867D`, border `#D8D3CA`,
   Soft Stone `#EFEBE4`), keeping today's ivory `#F7F5F0`, sand `#E8E1D5`, gold
   `#B08D57` and deep gold `#8A6A3F`, which already match.
4. **`--color-cream` is renamed to `--color-stone` with the new value.** Cream
   `#FBFAF7` is a fifth near-white that the brief's four-level hierarchy does not
   have room for; `.ground-cream` becomes `.ground-stone`.
5. **The homepage hero takes Option A (Ivory editorial hero)** from §13, since
   the existing hero is type-and-concentric-rings with no photograph to carry a
   Sand treatment. Confirm with the user if a photographic hero is wanted.
6. **`prefers-reduced-motion` behaviour is preserved exactly.** Nothing in the
   perf pass may reduce the existing accessibility guarantees.
7. **Performance fixes are gated on measurement.** Finding P1's cause is a
   hypothesis; the fix ships only after an experiment confirms it. Nothing is
   changed "because it is usually slow".
8. **No new dependencies.** Lighthouse and Chrome are used as external
   measurement tools only and are not added to `package.json`.

---

## Files likely to change

**Tokens and primitives (Phase 2)**
- `src/app/globals.css` — token block, ground defaults, `body`, scrollbar,
  `.mega-menu`, `.card`, `.btn`, `.field`, shadows, radii.
- `src/docs/khem-ui-design-system.md` — rewritten to describe the light-first
  system as the single source of truth.

**Shared components (Phase 3)**
- `Nav.tsx`, `NavGround.tsx`, `providers/nav-ground-provider.tsx`, `Footer.tsx`,
  `FooterGroup.tsx`, `LoadingScreen.tsx`, `components/ecommerce/PageHeader.tsx`,
  `CategoryHero.tsx`, `EmptyState.tsx`, `CollectionSkeleton.tsx`,
  `ProductCard.tsx`, `MerchCard.tsx`, `DiscoverySetCard.tsx`,
  `home/CollectionCard.tsx`, `JournalCard.tsx`, `IngredientCard.tsx`,
  `CartDrawer.tsx`, `SearchOverlay.tsx`, `CookieConsent.tsx`,
  `AnnouncementBar.tsx`, `OfferPopup.tsx`, `CommentLightbox.tsx`,
  `ProductGallery.tsx`, `animation/Reveal.tsx`.
- New: a small **banner system** replacing the one-shape dark banner —
  editorial (ivory), collection (sand), image (photography), utility (stone),
  per §14.

**Customer routes (Phase 4)**
- `app/[locale]/page.tsx`, `about`, `heritage`, `craftsmanship`, `ingredients`,
  `journal`, `journal/[slug]`, `new-arrival`, `not-found`, `stockists`,
  `contact`, `search`, `search/loading`, the four legal pages,
  `perfume/[slug]`, `ritual/[slug]`, `collections`, `collections/[slug]`,
  `cart`, `checkout`, `checkout/confirmed`, `sign-in`, `sign-up`,
  `unsubscribe`, and the eight `account/*` routes + `account/layout.tsx`.
- Their components under `components/ecommerce`, `checkout`, `account`,
  `journal`, `legal`, `stockists`, `ingredients`, `auth`, `newsletter`.
- `src/lib/clerk-appearance.ts` — Clerk's hosted UI must follow the new ground.

**Admin (Phase 5)**
- `components/admin/**` (34 client components incl. `AdminShell.tsx`,
  `fields.tsx`, `AdminToaster.tsx`, `NotificationBell.tsx`,
  `UnsavedChangesDialog.tsx`, `charts/SalesChart.tsx`) and all 46
  `app/[locale]/admin/**/page.tsx`.

**Performance (Phase 6)**
- `next.config.ts` (`images.formats`), `src/lib/fonts.ts` (pending P1
  experiment), the six `backdrop-blur` call sites, `Nav.tsx` mega-menu
  mounting, `animation/Reveal.tsx`.

**Explicitly not changed:** `src/services/**` logic, `src/actions/**`,
`src/app/api/**`, `middleware`/`proxy.ts`, every `export const revalidate` /
`dynamic` value, `generateStaticParams`, `generateMetadata`, `sitemap.ts`,
`supabase/**`, `emails/**` content and logic.

---

## Implementation requirements

### Phase 2 — Token system

- Add `--color-stone: #efebe4`; retire `--color-cream`.
- Retune `--color-ink` → `#242321`, `--color-ink-muted` → `#625f58`, add
  `--color-ink-subtle: #8b867d`, `--color-border-light` → `#d8d3ca`.
- Add the brief's semantic aliases as a documented layer over the ground
  variables: `--background-primary/secondary/tertiary`,
  `--surface-primary/secondary`, `--text-primary/secondary/muted`,
  `--border-default`, `--accent-gold`, `--action-primary`,
  `--action-primary-hover`. These map onto the existing `--ground-*` machinery
  rather than duplicating it.
- Flip `:root` and `body` to the ivory ground. Update the scrollbar track,
  `::selection`, and the `*` border fallback to match.
- Rename `.ground-cream` → `.ground-stone`; keep `.ground-obsidian` /
  `.ground-charcoal` defined for framing/footer use with a comment saying they
  are no longer page grounds.
- Shadows: keep the restrained `--shadow-1/2/3` scale (§35 already satisfied).
- Every token change carries a comment explaining *why*, matching the existing
  file's documentation register.

### Phase 3 — Shared components

- Nav: ivory/transparent-over-light default, charcoal type, subtle hairline when
  solid, no large dark bar; mobile drawer on ivory/sand, not full-screen black.
- Footer: charcoal ground retained, ivory primary text, warm muted secondary,
  gold accent, and a deliberate transition from the last content section.
- LoadingScreen: ivory ground, soft-stone skeleton, charcoal/gold indicator.
  `CollectionSkeleton` likewise. No dark full-screen loader anywhere.
- Banner system per §14: four variants, not one component recoloured.
- Product cards per §22–§24: ivory/stone card, consistent dimensions and image
  area, controlled text overflow, whole-card navigation, bag icon that
  `stopPropagation`s with an accessible label and visible hover/focus. Grid
  **4 / 3 / 2** columns at desktop / tablet / mobile.
- All primitives (`.btn`, `.field`, `.card`, `.nav-link`, `.eyebrow`,
  `.note-pill`) verified on ivory, stone and sand.

### Phase 4 — Customer surfaces, in the brief's §52 order

Homepage, Collections, Shop, Product Cards, Product Details, Discovery Sets,
Gift Sets, Cart, Checkout, Account, About, Heritage, Craft, Journal, remaining
pages. Each page is *recomposed*, not recoloured: background, type scale,
contrast, imagery treatment, spacing, borders, hover and motion all
reconsidered against the new ground. NOIR keeps its identity through
photography, charcoal framing and composition — not a dark page.

### Phase 5 — Admin

Ivory main surface, Soft Stone panels and navigation, charcoal type and primary
actions, gold as accent only. Responsive per §32: adaptive sidebar on tablet,
drawer/sheet on mobile, single-column forms, and data presented as cards on
mobile rather than a shrunken table.

### Phase 6 — Performance, gated on measurement

1. **Resolve P1 by experiment.** Build three variants (fonts preloaded for the
   active locale / explicit fallback metrics / unchanged) and measure CLS on
   `/`. Ship whichever actually removes the shift, and report the result. If the
   font hypothesis is wrong, trace the real source before changing anything.
2. **Remove `backdrop-filter` from the five call sites whose background is
   already ≥88% opaque**, replacing with a fully opaque ground colour. Keep blur
   only where it is doing visible work (candidate: the cart drawer / search
   overlay scrim), and only if a before/after scroll trace shows the cost is
   acceptable.
3. **Mount the mega-menu panels conditionally** so no fixed blur/paint layer
   exists while they are closed.
4. **`images.formats: ['image/avif', 'image/webp']`** in `next.config.ts`;
   verify `sizes` on every `fill` image; confirm no over-eager `priority`.
5. **Reduce `<Reveal>`'s cost** — a CSS-driven reveal or one shared observer, so
   Motion is not pulled into routes that only fade sections in. Reduced-motion
   behaviour must be identical afterwards.
6. **Verify §43–§45** rather than change: re-run `npm run build` and diff the
   route table against the baseline (197 prerendered pages, same revalidate
   values); confirm no service gained a `select('*')` or an N+1.
7. **Re-measure** the same six Lighthouse runs plus a scroll/navigation CPU
   trace, and report before/after including regressions and anything still open.

---

## Security requirements

- No change to `middleware`/`proxy.ts` route matching or to `isAdminRoute` /
  `isPublicRoute` behaviour. Admin RBAC is unchanged.
- No `auth()`/`currentUser()` call is added to a currently-static route; doing
  so would silently turn prerendered pages dynamic.
- No secret, service-role key or Supabase admin client is moved into or reached
  from a client component. Restyling `components/admin/**` must not relocate a
  server-only import across the `"use client"` boundary.
- Server Actions keep their existing authorization checks verbatim.
- No user-supplied string is rendered as HTML; no `dangerouslySetInnerHTML` is
  introduced.
- Clerk appearance changes are presentational only — no change to
  `signInUrl`/redirect URLs or to the provider's `dynamic` behaviour.

---

## Acceptance criteria

**Visual**
- No route renders on `ground-obsidian` as its page ground. `bg-black`,
  `bg-background`, `bg-surface` and `bg-card` no longer appear as page or
  section surfaces; remaining uses are documented framing/overlay cases.
- Ivory is the ground of the site and of the admin dashboard. Navigating
  home → collection → product → cart → checkout → account → admin never crosses
  a dark/light boundary.
- Footer is the only charcoal full-width surface.
- Gold appears as accent only: no gold primary buttons in commerce flows, no
  gold body copy.
- Every ground/foreground pair meets WCAG AA at its rendered size; gold text on
  light grounds uses `--color-gold-deep`.

**Functional (regression gate)**
- `npm run build` succeeds; the route table still shows 197 prerendered pages
  with unchanged `Revalidate`/`Expire` columns.
- `npm run lint` clean; TypeScript clean; zero `any`.
- Add to bag, cart drawer, discount code, voucher, credit, checkout through to
  `/checkout/confirmed`, sign-in/sign-up, account pages, and admin CRUD all work.
- English and Arabic both render correctly; RTL layout, Arabic tracking and the
  Arabic optical-size compensation are intact.

**Responsive**
- No horizontal overflow at 320, 375, 768, 1024, 1280, 1440 and 1920 px on the
  customer site or admin.
- Product grid is 4 / 3 / 2 columns; touch targets ≥ 44px; admin tables are
  usable on mobile without pinch-zoom.

**Performance**
- CLS ≤ 0.1 on all three measured pages, both devices.
- Desktop performance ≥ 90 and mobile ≥ 85 where the measurement environment
  makes that realistic; if a target is missed, the report says by how much and
  why, with the remaining bottleneck named.
- A scroll/navigation trace shows sustained main-thread and GPU work
  measurably reduced versus the baseline trace.
- Before/after table published for all six runs, including any regression.

---

## Checks to run

```bash
npm run build      # route table diffed against the baseline in this file
npm run lint
npx tsc --noEmit
```

Plus, from the scratchpad:

```bash
npx next start -p 3100
lighthouse http://localhost:3100/                       --preset=desktop --only-categories=performance
lighthouse http://localhost:3100/                                        --only-categories=performance
# ...repeated for /collections/signature and /perfume/onyx-night, both devices
```

Baseline JSON for comparison is already stored at `scratchpad/base-*.json`.

---

## Manual test steps expected after implementation

1. `npm run build && npx next start -p 3100`.
2. **Visual continuity:** walk `/` → `/collections` → `/collections/noir` →
   `/perfume/onyx-night` → add to bag → `/cart` → `/checkout` → `/account` →
   `/admin`. Confirm one continuous ivory environment and no dark-mode flash on
   any route transition or loading state.
3. **NOIR check:** `/collections/noir` reads as distinct through photography and
   charcoal detail, not as a dark page.
4. **Responsive:** repeat step 2 at 375px, 768px and 1440px. Open the mobile nav
   drawer (ivory, not black), the cart drawer, the search overlay, and an admin
   table on mobile.
5. **Arabic:** repeat step 2 under `/ar/...`. Confirm RTL layout, no clipped
   type, and correct mirrored drawers.
6. **Commerce regression:** apply a discount code, apply a voucher, apply store
   credit, complete a Stripe test-card checkout, and confirm the order appears
   in `/account/orders` and in `/admin/orders`.
7. **Admin regression:** create and edit a product, a collection, a discount and
   an announcement; confirm the unsaved-changes dialog still fires.
8. **Heat check:** with Chrome's Performance monitor open, scroll `/` for 30
   seconds and navigate between five routes. Compare CPU% and GPU raster against
   a recording of the same sequence on the pre-change build.
9. **Reduced motion:** enable `prefers-reduced-motion` and confirm the loader,
   shimmer, reveals, marquee and confirmation sequence all degrade as before.

---

## Open question for the user

§13 offers an Ivory or a Sand editorial hero for the homepage. This plan assumes
**Ivory (Option A)** and keeps the existing typographic composition rather than
introducing campaign photography, because no hero photograph exists in the
catalogue today. If a photographic hero is wanted, that asset decision should be
made before Phase 4 starts.
