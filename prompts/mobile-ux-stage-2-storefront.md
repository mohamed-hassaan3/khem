# Stage 2 — Storefront: mobile density & usability

Part of `prompts/mobile-ux-audit-and-plan.md` (findings S1–S11). Stage 1
(account) is approved and uncommitted on the same branch.

## Goal

On a 390×844 phone, in English and Arabic:

- a collection page shows **products on the first screen**;
- checkout shows **what you're paying, and for what, before you pay**;
- product pages stop spending screens on near-empty boxes and stop hiding the
  footer under the buy bar;
- small breakages are fixed: the Arabic "ML 100", truncated note chips, the
  blue browser focus box, and the logo aspect warning.

Same structure, same brand. No new routes, data, copy keys, dependencies or
motion (motion is Stage 4). Desktop composition unchanged except where noted.

## Skills read

- `AGENTS.md` §2.2, §3, §8 (PDP ISR, checkout force-dynamic; no caching
  changes here), §11.
- `node_modules/next/dist/docs/` is not needed: no routing, data or boundary
  changes. Every file touched is already a Client or Server Component and keeps
  that boundary.
- Clerk / Supabase / AI SDK skills: not applicable.

## Existing code inspected

- `src/lib/format.ts:173` `formatVolume()` returns `` `${n} ML` ``. Its only
  consumers are display labels: `ProductCard:295`, `MerchCard:141`,
  `ProductPurchase:175` (joined with `·` and the concentration),
  `CartLine:103`, `CartDrawerLine:101`, `ArrivalShowcase:151`,
  `DiscoveryComparison:83`. In an RTL paragraph the digit run and "ML" are
  reordered, which produces "ML 100".
- `src/components/ecommerce/CategoryHero.tsx:60`:
  `h-[80vh] min-h-150 … md:h-[70vh] md:min-h-140`; title
  `text-4xl sm:text-6xl md:text-7xl`; `pb-14`; `gold-line my-7`; intro
  `text-[15px] leading-loose`. Used 4× by `CategoryView.tsx`.
- `src/components/ecommerce/CollectionView.tsx:191`: hero
  `h-[60vh] min-h-105`.
- `src/components/ecommerce/ProductCard.tsx`: collection eyebrow `line-clamp-1
  text-[9px] tracking-[0.2em]` (truncates to "SIGNATURE…" at two-up); note
  chips at `:245–255` with `truncate` (truncate to "Franki…").
- `src/components/ecommerce/ProductPyramid.tsx`: three `p-7` cards,
  `grid-cols-1 sm:grid-cols-3`, title `mb-5`, bullet list.
- `src/components/ecommerce/ProductPurchase.tsx`: quantity block `mb-6 md:mb-10`
  with its own label above `<QuantityStepper>`; CTA `grid grid-cols-2` below;
  perks grid `mt-8 pt-7`. The bar's visibility comes from one
  IntersectionObserver on `controlsRef` (`:103–119`).
- `src/components/ecommerce/StickyPurchaseBar.tsx`: `fixed bottom-0 z-40`; it
  stays visible over the footer at the end of the page.
- `src/components/checkout/CheckoutView.tsx:856`: `grid-cols-1
  lg:grid-cols-[1fr_420px]`. The form (with the submit button) comes first and
  `<OrderReview>` comes after it, so on a phone the summary sits below "Place
  order". `totalInCents` is already computed in the view.
- `src/components/checkout/OrderReview.tsx`: `<aside>` `px-4 py-10`, copy
  `dict.checkout.review.{heading,itemCount,itemCountOne,total}`.
  These existing keys are enough for a summary bar.
- `src/components/marketing/OfferPopup.tsx`: four gates (enabled, hydrated +
  consent decided, not snoozed, delay **or** scroll depth); image
  `h-56 sm:h-72`.
- `src/components/Nav.tsx`: icon buttons with no explicit focus style;
  `closeSearch()` refocuses the search trigger (`:410–414`). During the audit
  the search icon showed the browser's default blue box. The exact focus source
  (popup/consent focus return vs. the overlay) is confirmed during
  implementation, not assumed.
- `src/components/ecommerce/CommentForm.tsx:200`: `rows={4}`.
- Oversized type: every `text-5xl+` in pages is already breakpoint-prefixed, so
  the editorial pages need a **visual** pass, not a grep fix.

## Decisions / assumptions

1. **S3 at the source.** `formatVolume()` wraps its output in Unicode
   isolates, `⁦${n} ML⁩` (LRI…PDI). This fixes every consumer at
   once, including the strings that are joined with `·`, without touching seven
   call sites. The characters are invisible, and they are display-only (no
   consumer parses, compares or stores the string). English rendering is
   unchanged. The doc comment says why.
2. **S2 checkout:** below `lg`, a collapsible summary sits **above the form**:
   a `<details>` whose `<summary>` row shows `review.heading` · item count ·
   total, with a chevron, and whose body is the existing `<OrderReview>`. From
   `lg` the current sticky aside is unchanged. One `<OrderReview>` is rendered
   per breakpoint (`lg:hidden` / `hidden lg:block`); it's the same component
   with the same props. Collapsed by default. The submit button stays where it
   is.
3. **S1 heroes on phones only:** `CategoryHero` `h-[52svh] min-h-88`, title
   `text-3xl`, `pb-8`, `gold-line my-4`, intro `text-[13px] leading-relaxed`.
   `CollectionView` hero `h-[46svh] min-h-80`. `md:` values stay as they are.
   No text is clamped or hidden.
4. **S4 product card at two-up:** note chips `hidden sm:flex`; eyebrow tracking
   `tracking-[0.12em] sm:tracking-[0.2em]` so it fits. Name, price, volume and
   the bag button are unchanged.
5. **S5 pyramid below `sm`:** a single bordered card with three rows: tier
   label (fixed `w-20`) + notes joined by `·`. From `sm` the three cards are
   unchanged. Same data and the same `dir="auto"`.
6. **S6:** the sticky bar also hides while the site `<footer>` is in view. This
   adds a second observed target in the existing effect, so it's the same
   mechanism with one more condition. No page padding hacks.
7. **S7 popup:** phone image `h-40`; tighter body padding. Plus one gate: the
   popup does not open on `/perfume/*`, `/set/*`, `/cart` or `/checkout`, where
   the visitor is mid-purchase. Other pages behave as they do today. The
   delay, snooze and consent logic are untouched.
8. **S8 focus:** nav icon buttons get the house focus ring
   (`focus-visible:outline-2 outline-offset-2 outline-ground-accent`) and
   `focus:outline-none` for non-visible focus. Also find out why the search icon
   holds focus on page load, and fix the cause if it's a stray `.focus()`.
9. **S9:** on phones the quantity stepper sits inline with its label (one row)
   and the perks grid uses `mt-6 pt-5`. The review textarea becomes `rows={3}`.
10. **S10 / S11:** cookie banner phone padding and spacing tightened (no copy
    change). The logo `<Image>` gets `style={{ width: "auto" }}` or a matching
    height, whichever matches how it is sized, to clear the aspect warning.
11. **Editorial sweep** (home, heritage, about, craftsmanship, journal +
    article, ingredients, stockists, contact, legal, sign-in/up, new-arrival,
    search, 404): capture each at 390px and fix only clear offenders: a section
    taller than a screen with little in it, a block with `p-8+` on phones, or a
    hero taller than ~60svh with no product. Each fix is listed in the report.
    Anything subjective is listed as a note, not changed.

## Files likely to change

- `src/lib/format.ts`
- `src/components/ecommerce/CategoryHero.tsx`, `CollectionView.tsx`
- `src/components/ecommerce/ProductCard.tsx`
- `src/components/ecommerce/ProductPyramid.tsx`
- `src/components/ecommerce/ProductPurchase.tsx`, `StickyPurchaseBar.tsx`
- `src/components/ecommerce/CommentForm.tsx`
- `src/components/checkout/CheckoutView.tsx` (and `OrderReview.tsx` only if it
  needs a `variant` for the collapsed body's padding)
- `src/components/marketing/OfferPopup.tsx`
- `src/components/Nav.tsx`, possibly `src/components/Footer.tsx` (logo)
- `src/components/consent/CookieConsent.tsx`
- Editorial pages and components only where the sweep finds a clear offender.

## Implementation requirements

- Logical properties only (`ps/pe/ms/me/start/end`); numbers, prices, SKUs and
  codes keep their existing `ltrIsland` treatment.
- 44px minimum touch targets for anything made smaller or moved; `<summary>`
  rows ≥ 44px.
- No `any`; no new dependencies; no new dictionary keys. If a label turns out
  to be missing, stop and ask rather than invent copy.
- The checkout `<details>` must keep working when the order is frozen
  (`awaitingPayment`), and must not interfere with the Stripe Payment Element
  mount (it is outside the form's `fieldset`).
- The popup route gate uses the locale-stripped path (`stripLocale`), so
  `/ar/perfume/*` is covered too.
- Prefer existing tokens and classes (`.card`, `.btn`, `.eyebrow`,
  `ground-*`), and don't add new CSS to `globals.css` unless a Tailwind utility
  can't express it.

## Security requirements

- Checkout: no change to what is submitted, priced or validated. The summary
  is a second rendering of client-side display data that already exists. Server
  pricing in the Server Action stays authoritative.
- No new storage keys, no new network calls, no change to consent gating.

## Acceptance criteria

1. `/collections/fragrances` at 390×844: at least the top of the first product
   row is visible without scrolling, in EN and AR.
2. `/checkout` with one item at 390px: the summary bar with the total is
   visible above the contact step. Tapping it reveals the lines; desktop at
   1440px is unchanged.
3. Arabic PDP and product cards read **"100 ML"**, not "ML 100". English is
   unchanged.
4. Two-up product cards show no truncated chips; the collection eyebrow fits
   at 390px (allowing for the longest current collection name).
5. PDP pyramid on a phone is ≤ ~200px tall for three tiers; at `sm+` it's the
   same as before.
6. Scrolling a PDP to the end: the footer's last line is fully visible (the bar
   is gone).
7. The popup never opens on PDP, set, cart or checkout pages; it still opens
   elsewhere under the existing rules.
8. No blue default focus box on nav icons after load, mouse clicks or closing
   dialogs; keyboard Tab shows the gold ring.
9. `scrollWidth === innerWidth` on every captured page at 390px and 360px.
10. `tsc --noEmit` and ESLint clean on changed files.

## Checks to run

```bash
npx tsc --noEmit
npx eslint <changed files>
```
Live: agent-browser at 390×844, 360×740 and 1440×900, EN + AR, on home, a
collection, a category, a PDP, cart (empty + 1 item), checkout (1 item), journal,
an article, heritage, about, craftsmanship, ingredients, stockists, contact,
sign-in, search and 404. Before/after captures for each fixed item. The
storefront is public, so no sign-in is needed; I'll use my own browser session,
not yours.

## Manual test steps (after implementation)

1. `npm run dev`; DevTools → iPhone 14.
2. `/collections/fragrances` and `/ar/collections/fragrances`: products peek
   above the fold; cards show name, collection, price, volume, bag, and no
   cut-off chips.
3. `/ar/perfume/onyx-night`: the meta line and the sticky bar read "100 ML".
   Scroll to the bottom: the bar slides away and the footer is fully readable.
   The pyramid is one compact card.
4. Add to cart → `/checkout`: the "Your Order · 1 item · EGP …" bar is at the
   top. Tap it to expand, then collapse it. Fill contact and delivery, place a
   cash order on a test product (or stop before placing it), and confirm nothing
   about submission changed.
5. Clear `localStorage` for the site, accept cookies, and stay on a PDP past the
   popup delay: no popup. Go to `/heritage` and wait: the popup appears as before.
6. Tab through the header with the keyboard: gold focus ring. Click icons with
   the mouse: no blue box.
7. Desktop (1440): collection hero, PDP, checkout and cards look as before.
