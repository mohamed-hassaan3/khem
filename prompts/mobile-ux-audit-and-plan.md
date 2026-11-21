# Mobile-first UI/UX audit & staged refinement plan

> Umbrella document for the four-stage pass requested on 2026-11-20. Each stage
> gets its own executable prompt (`prompts/mobile-ux-stage-N-*.md`), written and
> approved one at a time. Stage 1's prompt is ready; stages 2–4 are planned below
> and will be re-inspected against the code as it stands when their turn comes.

## Goal

Most KHEM customers are on phones. Make every surface (account, storefront,
admin) read as designed for a phone: more useful information per screen, less
empty bulk, nothing hard to reach. Keep the existing structure and brand.
After that, bring the hero's refined motion to the rest of the site without
costing LCP or mobile performance.

This is a **sizing, spacing, density and usability** pass. It is not a rebuild:
no new routes, no schema changes, no new data, no new dependencies.

## How the audit was done

- Live captures at **390×844 @2x** (iPhone 14 class) from the running dev
  server, scrolled one viewport at a time, in **English and Arabic**: home, PDP
  (`/perfume/onyx-night`), collection (`/collections/fragrances`), cart (empty and
  with one item), checkout (empty and with one item), journal, sign-in, 404.
- `/account/*` and `/admin/*` need a signed-in session, which this audit could
  not create. Those were audited **from the code** (classes, layout, component
  structure), and need live verification during their stage (see "Open question").
- Earlier passes were read first so nothing they settled gets undone:
  `prompts/mobile-density-pass.md` (16px inputs, two-up grids, mobile spacing
  scale), `prompts/mobile-design-adjustments.md` (ingredients rail, craft
  pillars, cookie banner).

## Findings

Severity: **H** = blocks or seriously slows a task on a phone, **M** = visible
waste or friction, **L** = polish.

### Account dashboard (`/account`, code audit)

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| A1 | H | Overview stat tiles stack **one per row** on a phone at `px-8 py-9` with a `text-3xl` value. Two numbers take ~300px of height. | `StatGrid.tsx` |
| A2 | H | Order card `p-8` at every width. On a phone the total drops **below** the order number and status, and the tracker trigger sits behind `mt-8 pt-6`. One order fills most of a screen. | `OrderCard.tsx` |
| A3 | H | Credit and reward ledgers are `<table min-w-[34rem]>` in a horizontal scroller. On a phone you have to swipe sideways to read your own balance history. | `CreditLedger.tsx`, `RewardLedger.tsx` |
| A4 | H | Empty states use the storefront `EmptyState` (`min-h-[60vh]`, `py-14`, `text-2xl`). On Orders or Vouchers with nothing in them, one empty state is taller than the phone. Vouchers can show **two** of them in a row. | `EmptyState.tsx` used by `orders`, `vouchers` |
| A5 | M | Every panel opens with an eyebrow + `text-3xl` h1 + `mb-8`, under a row that holds **only** the bell (`mb-6`). About 170px of header before any data. The name and email are hidden below `lg`, so the phone header has less information and takes more space. | `account/layout.tsx`, all 5 panel pages |
| A6 | M | Profile is three long sections (Clerk card, address book, preferences) with no way to jump between them. Clerk's card is wrapped in `overflow-x-auto` because it was wider than the column. | `account/profile/page.tsx` |
| A7 | M | Address card `p-9`; address form `px-6 py-7`, `gap-y-4`, `mt-8` before the buttons. | `AddressCard.tsx`, `AddressBook.tsx` |
| A8 | M | Credit and reward summary boxes: `py-8`, `text-4xl` balance, a paragraph under it. Section gaps `mb-12`, h2 `mb-6`. | `CreditSummary.tsx`, `RewardSummary.tsx`, `vouchers/page.tsx` |
| A9 | L | Privilege banner `px-6 py-6` with `gap-x-12`; benefits note `px-8`; preference cards `px-6 py-6`; notification rows `px-5 py-5`. Each one is fine alone, but together they add up. | various |
| A10 | L | Rail tabs are a horizontal strip (good), but `py-3` + `py-3.5` makes the strip 68px tall, and it stays sticky. | `AccountSidebar.tsx` |

### Storefront (live captures)

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| S1 | H | **Collection hero is `h-[80vh] min-h-150` on phones.** On `/collections/fragrances` the first product appears ~800px down: a full screen of sky, a title and a paragraph before anything you can buy. | `CategoryHero.tsx:60` (and the collection hero) |
| S2 | H | **Checkout on a phone:** the order summary (what you're buying, the total) sits at the **very bottom, after "Place order"**. You tap the button without seeing the total on screen. | `CheckoutView.tsx` / `OrderReview.tsx` |
| S3 | H | **Arabic bidi bug:** volume renders as **"ML 100"** in Arabic, on the PDP meta line and on every product card. The string is not an LTR island. | PDP price row, `ProductCard` |
| S4 | M | Product cards at two-up: the note chips truncate to "Franki…", "Blac…", "Pink …", which tells you nothing. The collection eyebrow truncates to "SIGNATURE…". | `ProductCard.tsx` |
| S5 | M | PDP fragrance pyramid is three tall boxed cards (~170px each) holding 1–3 bullet words each, so ~520px for about seven words. | PDP pyramid component |
| S6 | M | PDP sticky buy bar covers the end of the footer (legal links, copyright) once you reach the bottom. The page has no matching bottom padding. | PDP sticky bar / page footer spacing |
| S7 | M | Offer popup on a phone: ~560px modal with a 225px image. It opened over the PDP while we were reading the story, and it asks for the same email as the home page's inline "Inner Circle" form. | `OfferPopup.tsx` |
| S8 | M | Nav icon buttons show the **browser's default blue focus box** (seen on search after a dialog closes). AGENTS.md §3.2 rules out webkit blue rings. | `Nav.tsx` icon buttons |
| S9 | L | PDP: "Quantity" label + stepper + a separate CTA row stack to ~170px; the review textarea is tall before anyone writes. | PDP buy box, `CommentForm.tsx` |
| S10 | L | Cookie banner still covers ~45% of a 390px screen on first visit (its buttons collide with bottom-left overlays). | `CookieConsent.tsx` |
| S11 | L | Dev console: logo `<Image>` resized on one axis only (aspect-ratio warning). | `Nav.tsx` / `Footer.tsx` logo |

What already works well and must not regress: two-up product grids, 16px
inputs (no iOS zoom), the home hero and its text fade, the mobile footer
accordion, the cart page, and the PDP gallery with thumbnails.

### Admin (code audit)

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| D1 | H | `AdminTable` forces `min-w-[720px]`. On a phone **every list in the admin** (orders, products, customers, inventory…, about 69 pages use it) scrolls sideways, and the first column scrolls out of view. | `AdminTable.tsx` |
| D2 | M | The admin sits under the storefront chrome (announcement + nav, `--chrome-h`) plus its own sticky bar. About 140px of an 844px screen is chrome before any content. | `AdminShell.tsx`, admin layout |
| D3 | M | Long forms (`ProductForm` ~890 lines, `OrderForm`) end with the save button at the very bottom. On a phone there is no reachable save. | `ProductForm.tsx`, `OrderForm.tsx`, other `*Form.tsx` |
| D4 | L | Header action buttons `px-6 py-3` wrap awkwardly beside an `uppercase tracking-[0.2em]` h1; table cells `px-5 py-4`; empty state `py-10`. | `AdminTable.tsx` header/cells |

### Motion & first impression

| # | Sev | Finding | Where |
|---|-----|---------|-------|
| M1 | H | The root `loading.tsx` is a **fixed full-screen loader (z-1000) with a spinning orbit**. It shows on every navigation to a dynamic route (account, checkout, search…). It hides the nav and reads as an app spinner, not a perfume house. | `[locale]/loading.tsx`, `LoadingScreen.tsx` |
| M2 | M | Page changes have no transition. `.page-enter` / `@keyframes pageIn` exist in `globals.css` but nothing uses them. | `globals.css` |
| M3 | M | `Reveal` moves sections **40px over 0.9s**. On a phone that's a big jump and a slow settle. Grids reveal as one block, without a stagger. | `Reveal.tsx`, `.reveal` |
| M4 | L | Product images pop in with no fade; section gold rules are static, even though `khem-rule-draw` already exists. | `ProductCard`, section dividers |

Already right and to be kept: hero slide text rise/fade, `Reveal`'s
"visible by default, only below-the-fold animates" design (it fixed LCP),
reduced-motion handling in every keyframe block, and CSS-only, compositor-only
transitions.

## The four stages

Each stage: write its prompt → you approve → implement → `tsc` + `eslint` →
live check at 390px and desktop, EN + AR → report what changed → **wait for your
approval** before the next.

### Stage 1 — Account dashboard *(prompt ready: `prompts/mobile-ux-stage-1-account.md`)*

Fixes A1–A10. Summary:
- Phone header: avatar, name and email on one compact row with the bell, so
  identity is visible on phones without adding height.
- One shared `AccountPageHeader` (eyebrow + h1) at phone scale, used by all
  five panels.
- Two-up stat tiles; compact privilege band; order card with the total beside the
  order number at every width.
- Ledgers become stacked rows on phones (the table stays from `sm`).
- A `compact` variant of `EmptyState` for account panels.
- Profile gets a small jump row (Details · Addresses · Preferences); Clerk's
  card is styled to the column width, so the sideways scroller goes.
- Tighter address, voucher, credit, reward, preference and notification cards.
- Desktop composition unchanged apart from the inherited tidy-ups.

### Stage 2 — Storefront (home, collections, PDP, cart, checkout, auth, editorial)

- **S1** Phone collection/category hero to ~50svh with a smaller title and a
  clamped intro, so the first products show on the first screen.
- **S2** Checkout: a collapsible order-summary bar at the top on phones (item
  count + total, expands to the lines); the full summary stays where it is on
  desktop.
- **S3** Wrap volume ("100 ML") in an LTR island everywhere it renders.
- **S4** Product card on phones: hide note chips below `sm`, don't truncate the
  eyebrow, slightly tighter body.
- **S5** Pyramid on phones: one card with three compact rows (label + notes
  inline); desktop keeps the three cards.
- **S6** Bottom padding that matches the sticky buy bar while it shows.
- **S7** Phone popup: shorter image and tighter body. Don't open it on PDP/cart/
  checkout in the first session view (a single rule in the existing gate).
- **S8** On-brand `:focus-visible` ring on nav icon buttons.
- **S9–S11** Quantity + CTA on one row on phones, shorter empty textarea,
  tighter cookie banner, logo aspect fix.
- Sweep of editorial pages (heritage, about, craftsmanship, journal, ingredients,
  stockists, contact, legal, sign-in/up) for leftover unprefixed `text-5xl+`
  and oversized blocks.

### Stage 3 — Admin dashboard

- **D1** `AdminTable` gets a phone **stacked-row** mode: below `md`, each row
  becomes a compact card with its cells labelled by their column header, via a
  `data-label` attribute. The table is unchanged from `md`. One component
  change covers almost every list.
- **D2** Tighter admin chrome on phones. The admin bar merges with the page title
  row, and the storefront announcement bar is hidden inside `/admin`.
- **D3** Sticky save bar on phones for the long forms, reusing each form's
  existing submit (no new actions).
- **D4** Tighter header and action layout, cell padding and empty states; check
  the dashboard charts at 360px.

### Stage 4 — Motion & first impression

- **M1** Replace the full-screen loader for **navigations** with a quiet one:
  the chrome stays, a thin gold progress hairline runs under the nav, and the
  content area fades. (Decision for you when we get there: keep the full roundel
  only for the very first load, or drop it.)
- **M2** A soft page-enter fade (opacity only, ~400ms, no translate, so no layout
  shift) that runs **only on client-side navigations**, never on the first
  server-rendered paint, so it cannot delay LCP.
- **M3** `Reveal`: 16px travel and 0.7s on phones; an opt-in stagger for grids
  (product cards, journal cards, collection tiles), capped at 4 steps.
- **M4** Gold rules draw in with the existing `khem-rule-draw` when revealed;
  below-the-fold product images fade in once loaded (never the LCP image).
- All CSS, no new Motion usage, every effect off under `prefers-reduced-motion`.
  Lighthouse mobile before/after on home, PDP and collection; no regression
  allowed.

## Open question (needed for live checks of stages 1 and 3)

Account and admin pages need a signed-in session for the 390px screenshot pass.
Options: (a) sign in to `localhost:3000` in your Chrome, started with remote
debugging, so the browser tool can attach to it; (b) give me a test customer and
a test admin login; (c) you check those screens yourself from the steps in each
stage's report. Without one of these, those stages will be verified by type-check,
lint and code review only.
