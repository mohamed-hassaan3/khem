# Stage 2 (v2) — Storefront redesign: "The Maison"

Supersedes `prompts/mobile-ux-stage-2-storefront.md` (the pre-mock plan). Its
small fixes are folded in below where the mock relies on them (§D12–D15).
Built from the approved canvas mock
(https://claude.ai/artifact/RmiBe4rrHmk8trXVx8EHA2, approved 2026-11-21, no
changes requested). Umbrella: `prompts/mobile-ux-audit-and-plan.md`. Visual
language follows Stage 1 (`prompts/account-redesign-stage-1.md`).

## Goal

Rebuild the buying path to match the mock: **Home, Collection (and the
category routes), Product, Bag drawer, Checkout**. Phones first (390px), in
English and mirrored Arabic, plus the desktop product page. On a phone each
screen leads with what the visitor came for: products on the first collection
screen, the decision on the first product screen, the total on the first
checkout screen. Same KHEM palette, Cinzel over Inter / IBM Plex Sans Arabic,
calm motion. Real data only.

The mock's artboards (link each to check details while building):
`#artboard-Main` (Home), `#artboard-Collection`, `#artboard-Product`,
`#artboard-Bag`, `#artboard-Checkout`, `#artboard-ProductAr`,
`#artboard-ProductDesktop`.

## Skills read

- `AGENTS.md`: §2.2 motion (no spring/bounce), §3 tokens, §8 caching (home ISR
  24h, PDP ISR 1h, `revalidate.ts` is the freshness mechanism; checkout is
  dynamic), §8.1 the prelaunch guards in `Nav`/`Footer`/layout (must keep
  working), §10.2 (no Clerk on public pages; `useKhemSession()` only), §11.
- `node_modules/next/dist/docs/`: no new routes, no change to caching or
  Server/Client boundaries. Each file touched keeps its current boundary.
- Clerk / Supabase / AI SDK skills: not needed. The one data change (D7) is a
  read through an existing service.

## Existing code inspected

- **Tokens** (`src/app/globals.css`): mock colours are the house tokens exactly:
  ivory `#f7f5f0`, stone `#efebe4`, sand `#e8e1d5`, gold-deep `#8a6a3f`, ink
  `#242321`, ink-muted `#625f58`. Grounds `.ground-{ivory,stone,sand,charcoal,
  obsidian}`. Motion: `khem-rise`, `khem-fade`, `ease-luxury-bezier`, all
  disabled under reduced motion. Header stack: `--announcement-h`, `--nav-h`
  (80px at every width), `--header-h`, read by layout padding, mega menu,
  sticky bars and `ProductGallery` (`--chrome-h`).
- **Home** `src/app/[locale]/page.tsx`: bands are CMS-ordered and toggled
  (`getLandingSections()`): `hero` (campaign `<Hero>` or the typographic ivory
  composition, `h-svh`), `collections` (`CollectionSlider` of `CollectionCard`),
  `essences` (slider of `ProductCard`), `story` (sand, `min-h-[700px]`),
  `craft` (pillars), `featured` (new arrival, `h-[80vh]`), `ingredients`
  (`IngredientRail`), `journal` (slider of `JournalCard`), `testimonials`,
  `newsletter` (`NewsletterForm`). Section padding `py-14 md:py-36`; headings
  `text-3xl–4xl` on phones.
- **Collection**: `CollectionView.tsx` (hero `h-[60vh] min-h-105`),
  `CategoryView.tsx` + `CategoryHero.tsx` (`h-[80vh] min-h-150`),
  `CollectionGrid.tsx` (client: facet chips in a sticky bar, sort `<select>`
  with featured/price-asc/price-desc, "filtered by / sorted by" line, cards
  passed in as server-rendered children). No pagination today.
- **Product card** `ProductCard.tsx`: `ProductFlag` overlays, `AddToBagButton`
  overlaid on the image, eyebrow `line-clamp-1 text-[9px]`, note chips with
  `truncate` (cut to "Franki…" at two-up).
- **PDP** `src/app/[locale]/perfume/[slug]/page.tsx`: breadcrumb, then
  `lg:grid-cols-2`: `ProductGallery` (snap carousel, `aspect-4/5`, thumbnail
  strip `h-20`, sticky full height at `lg`) | `ProductPurchase`, `ProductStory`,
  `ProductPyramid` (three `p-7` cards), `ProductScentProfile`,
  `ProductIngredients`; then `ProductComments` (calls
  `getProductRatingSummary(slug)`, **not** request-memoised) and
  `RelatedProducts`. `ProductPurchase`: eyebrow, h1 `text-4xl`, subtitle,
  `gold-line my-9`, price + `formatVolume · concentration`, promotion line,
  currency note, quantity block with its own label, `grid-cols-2` Add/Buy,
  stock line (`inStock`/`lowStock`/`soldOut`), 2×2 `dict.product.trust` text
  badges, `StickyPurchaseBar` driven by one IntersectionObserver on the CTAs.
- **Bag drawer** `CartDrawer.tsx`: `w-[88vw] max-w-100`, header eyebrow +
  heading + count, lines (`CartDrawerLine`), footer with promotion, subtotal,
  tax note, Checkout + View bag. Catalogue fetched from `/api/cart/catalog` on
  first open. Delivery maths already exists: `useDeliveryTerms()`,
  `shippingInCents()`, `amountToFreeShippingInCents()` (`src/lib/cart.ts`),
  copy `cart.freeShippingNudge`, `cart.shipping`, `cart.complimentary`,
  `cart.total`, `cart.continueShopping`.
- **Checkout** `CheckoutView.tsx`: `PageHeader`, then `lg:grid-cols-[1fr_420px]`:
  form (`ContactStep`, `DeliveryStep` with saved-address buttons from this
  branch, `DiscountStep`, `PointsStep` when rewards exist, `CreditStep`,
  `PaymentStep` with `CardPaymentForm`, honeypot, error, submit) | `OrderReview`
  aside. On phones the summary sits **below** "Place order". Steps use
  `CheckoutField`'s section (`index="01"`, title, complete tick). Copy exists for
  steps, `itemCount(One)`, `review.*`, `submit.{cash,card,working}`,
  `cardUnavailable`.
- **Nav** `Nav.tsx` (1,062 lines): `h-20` bar under the announcement bar,
  hamburger `lg:hidden`, search, bag, prelaunch guards. Footer already uses
  `FooterDisclosure` accordions.
- **Fonts** `src/lib/fonts.ts`: Arabic is IBM Plex Sans Arabic (400/500/600).
  The mock's Amiri subtitle is a mock-only stand-in; no new font is added.

## Decisions

1. **Scope.** The five surfaces above, at all widths (phone is the redesign;
   desktop changes only where the desktop PDP artboard shows it or a shared
   component's new look carries up naturally). Editorial pages (heritage,
   journal, about, …), `/cart`, search and auth are not redesigned; they get
   only the shared changes (header height, card, focus ring).
2. **Phone header 56px.** `--nav-h: 56px` below `lg`, `80px` from `lg`, set
   in the one place it's declared; the bar's `h-20` becomes `h-[var(--nav-h)]`.
   Every consumer of the stack moves with it. Logo 20px tracking `0.1em`; icon
   buttons stay 44×44.
3. **Purchase-route chrome (phones only, `< lg`).**
   - `/perfume/*`, `/set/*`: the leading hamburger becomes a **back chevron**
     linking to the product's collection (`/collections/<slug>`; `/collections`
     when unknown), `aria-label` "Back to {collection}". Deterministic, works
     from a shared link; not `history.back()`. The announcement bar is not
     rendered on these routes on phones. The menu is still one tap away via
     the logo → home. Desktop unchanged.
   - `/checkout`: a task header: back chevron to `/cart`, centred wordmark,
     "Secure" with a lock icon at the end. No search, bag, menu or announcement
     bar, at every width (desktop keeps the same quiet header, centred in the
     max-width container). Footer stays.
   - Implemented as a `variant` the Nav derives from the locale-stripped path
     (`stripLocale`), so `/ar/...` is covered. The prelaunch guards are kept.
4. **Home: CMS stays in charge.** Order and on/off still come from
   `getLandingSections()`. Each band gets the mock's phone treatment; `md+`
   keeps today's composition unless noted. Shared phone rhythm: section
   `pt-8`/`pt-9`, header row = eyebrow + `text-[22px]` Cinzel h2 at the start,
   a small uppercase gold **text link** at the end (replacing `btn-outline` on
   phones), `px-4`.
   - **hero**: phone height `min(540px, 68svh)`, copy bottom-aligned at the
     start edge: eyebrow, h1 34px, one-line lede, two buttons (filled ivory
     "Shop", outline "Our story"), slide dashes. Applies to both the campaign
     `<Hero>` and the typographic fallback (fallback keeps its ivory
     composition, just shorter, so the next band peeks).
   - **collections**: phone = a swipe rail (`khem-scroll-track`, snap) of
     132px portrait cards: image 160px, name, "{count} pieces" (count from the
     existing read, see Answered questions).
   - **essences**: phone = a **2-up grid of the first four** products (no
     slider), "View all" link to `/collections`. `md+` keeps the slider.
   - **story**: phone = one compact band on `ground-charcoal`: image column
     150px | eyebrow, 19px heading, one paragraph (`body1`), "Discover our
     story" link. `lg` keeps the sand split.
   - **ingredients**: phone = rail of 104px circles, name + origin. Uses
     `IngredientRail`'s data; its open-detail behaviour stays.
   - **journal**: phone = the **first article** as one row (120px thumb |
     category · date, title, read time), "Read" link to `/journal`. `md+` keeps
     the slider.
   - **featured / craft / testimonials** (not drawn in the mock): same phone
     rhythm; `featured` becomes `min(520px, 70svh)` with copy bottom-aligned;
     craft pillars keep their rail at `p-5`; testimonials keep the carousel with
     tighter rules.
   - **newsletter**: phone = an inline card on `ground-stone`, `rounded-[10px]`
     border, 19px heading, lede, input + "Join" on one row (`NewsletterForm`
     gains a `layout="inline"` prop; same action, same validation).
5. **Product card (everywhere it's used).** Image `aspect-3/4`, `rounded-md`;
   one flag top-start (existing `ProductFlag` precedence); the existing
   `AddToBagButton` restyled as a 36px round "+" on ivory at bottom-end with an
   `aria-label` "Add {name} to bag" (hit area ≥44px via padding/inset). Below:
   collection eyebrow 9px `tracking-[0.12em] sm:tracking-[0.2em]`, name 14px
   Cinzel, **notes as one line of text** (first three of top/heart/base joined
   with " · ", ellipsis) instead of chips, price · volume. Grid gap
   `gap-x-3 gap-y-[18px]` on phones.
6. **Collection page.**
   - Hero 220px on phones (`md:` unchanged): breadcrumb, h1 30px + "{count}
     pieces" eyebrow on one baseline, intro clamped to two lines. Same change to
     `CategoryHero` (all four category variants).
   - Toolbar (already sticky, already `CollectionGrid`): chips as 36px pills
     (pressed = filled ink), then a row with "{count} results" at the start and
     the sort control at the end, rendered as "Sort: {current}" with a chevron.
     It stays a native `<select>` (visually restyled, label kept for a11y).
   - 2-up grid, `p-4`.
   - **Show more**, client-side only: `CollectionGrid` shows the first 12 of the
     current filter+sort; "Showing {shown} of {total}", a thin progress rule,
     and a "Show more" button add 12 each press. Hidden cards are rendered
     with the `hidden` attribute, so every product link stays in the
     server HTML; changing filter or sort resets to 12. No new fetch, no URL
     param. If a list has ≤ 12 items the footer row is not rendered.
7. **PDP (phone).** Order follows the mock.
   - **Gallery** below `lg`: full-bleed, height `min(440px, 56svh)`, the same
     snap carousel; the thumbnail strip is replaced by a "1 / 4" counter pill
     at the bottom-end and slide dashes centred. Captions keep their strip.
   - **Buy block**: eyebrow (collection) at the start and a rating link at the
     end ("★★★★★ 5.0 (1)" → `#reviews`), shown only when the summary has ≥1
     rating. To read the rating at the top without a second query,
     `getProductRatingSummary` is wrapped in React `cache()`; the page and
     `ProductComments` share one call per request. h1 30px, subtitle italic
     gold, price 24px + "100 ML · Eau de Parfum". The `gold-line` divider
     goes on phones. Promotion and currency-note lines stay (only rendered
     when they have content; the empty `min-h-3.5` placeholder goes).
   - **Controls**: quantity stepper (48px, no separate label; label becomes the
     group's `aria-label`) inline with **Add to bag** (`grid-cols-[auto_1fr]`),
     **Buy now** full width below it as outline. Desktop: one row
     `grid-cols-[auto_1fr_1fr]`.
   - **Stock line** with a 6px dot (success / warning for low stock / muted for
     sold out), existing copy.
   - **Perks**: the four `dict.product.trust` badges as a 2×2 card on
     `ground-stone`, each with a Lucide icon (`Truck`, `Gift`, `FlaskConical`,
     `RotateCcw`, `strokeWidth={1.25}`, gold-deep), title 12px + desc 11px.
   - **The fragrance**: `ProductPyramid` becomes one bordered card with three
     rows (tier label 64px column | notes joined by " · ") **at every width**
     (the desktop artboard shows the same). `ProductScentProfile` chips follow
     it.
   - **Accordions** (`<details>`, ≥56px summaries, Cinzel 13px, chevron
     rotates): **The story** (open by default, `ProductStory`), **Key
     ingredient · {name}** (or the plural heading when there are several;
     `ProductIngredients` as the body), **Delivery & returns** (the delivery and
     returns trust descriptions + a link to `/return-exchange`). A section with
     no content is not rendered.
   - **Reviews** (`id="reviews"`): summary first: average 30px, stars, count;
     a "Write a review" button toggles the existing `CommentForm` open
     (closed by default; open automatically after a validation error); then the
     comments as bordered cards.
   - **You may also love**: 2-up on phones.
   - **Sticky bar**: name + "EGP 1,470 · 100 ML" + Add to bag, safe-area
     padding; it also **hides while the site footer is in view** (second
     observed target in the existing effect).
8. **PDP (desktop, `lg+`)** per `#artboard-ProductDesktop`: breadcrumb above
   the grid; gallery column = a large lead image (`aspect-5/4`, the active
   image) and a 3-column grid of the other images as buttons that set it
   active, sticky under `--header-h`; details column `max-w-[520px]`: h1 44px,
   price 28px, the three-up control row, perks card, pyramid card, accordions.
   Reviews and related products below the grid as today.
9. **Bag drawer.** Width `min(92.8vw, 400px)` (362px at 390); header "Your bag
   · {count}" with close (44px); a **delivery progress strip** on stone:
   "Add {amount} more for complimentary delivery." (existing
   `freeShippingNudge`) or "You've unlocked complimentary delivery" (new key),
   with a 3px bar = subtotal / threshold, from `useDeliveryTerms()`; lines
   with a 72px thumb, name + line price, "Eau de Parfum · 100 ML", stepper,
   Remove. **Footer pinned**: promotion (when present), Subtotal, Delivery
   ("Complimentary" or the fee via `shippingInCents()`), **Total** in Cinzel
   gold, a 50px "Checkout · {total}" button, and "Continue shopping" as a text
   button that closes the drawer. "View bag" moves out of the footer; the error
   state still links to `/cart`. Display only: the server reprices at checkout.
10. **Checkout (phone).**
    - Task header (D3). Under it, below `lg`, a **summary bar**: `<details>`
      whose 56px summary shows a bag icon, "Your order · {n} items", a chevron
      and the total in Cinzel gold; its body is the existing `<OrderReview>`
      lines. Collapsed by default. `lg+` keeps the sticky aside.
    - **Progress line**: "Contact — Delivery — Payment", each gold once its
      step is complete (`contactComplete`, `deliveryComplete`), else muted.
    - **Steps** numbered in 22px circles (filled gold-deep when complete),
      `CheckoutField` sections tightened to `py-6` on phones.
    - **Delivery**: saved addresses become a horizontal row of one-tap cards
      (label · Default, area) plus a "+ New" card that clears the address
      fields to blank (new client-side handler; no server call). The note
      field moves behind "+ Landmark or delivery note (optional)", opening by
      itself when it already has text. A delivery row shows "Complimentary ·
      ships within 48 hours" or the fee.
    - **Payment**: methods as radio cards (selected = gold border + inset
      ring on `#faf6ee`-ish stone tint; card disabled with "· temporarily
      unavailable" from `cardUnavailable` when `!cardAvailable`). Then
      `DiscountStep`, `PointsStep` and `CreditStep` each sit behind a quiet
      48px disclosure row inside step 3 ("Have a discount code?", and each
      step's existing title), opening by themselves when something is applied,
      selected, refused or stale. Their logic and props are untouched.
    - **Totals card** before the action: extract the totals rows of
      `OrderReview` into `OrderTotals` and render it here on phones, so both
      places use one implementation. "All prices include tax" (existing
      `taxNote`).
    - **Sticky action bar** on phones: the existing submit button, moved into a
      `fixed bottom-0` bar inside the `<form>` (still `type="submit"`), 52px,
      reading "Place order · {total}" for cash (new key with `{amount}`) and the
      existing card label for card. Hidden while `awaitingPayment` (Stripe's
      own form takes over) and while the footer is in view; the page gets
      bottom padding equal to the bar so nothing is covered.
    - Desktop: same structure in the left column; the aside unchanged.
11. **Arabic.** Logical properties only (`ps/pe/ms/me/start/end`,
    `rtl:` for transforms). Product names, prices, SKUs, counters ("1 / 4"),
    order totals keep `ltrIsland`; tier labels and copy are Arabic. Drawer
    slides from the reading end (already does).
12. **"ML 100" fix at the source**: `formatVolume()` wraps its output in
    LRI…PDI (`⁦100 ML⁩`); display-only, documented in its comment.
13. **Popup gate**: `OfferPopup` does not open on `/perfume/*`, `/set/*`,
    `/cart`, `/checkout` (locale-stripped path). Elsewhere unchanged.
14. **Focus**: nav icon buttons and every new control use the house ring
    (`focus-visible:outline-2 outline-offset-2 outline-ground-accent`), no
    default blue box on mouse focus; find and fix the cause of the search icon
    holding focus on load if it is a stray `.focus()`.
15. **Logo aspect warning**: the logo `<Image>` gets `style={{ width: "auto" }}`
    or a matching height, whichever fits how it's sized.
16. **Motion**: CSS only, `ease-luxury-bezier`, ≤500ms: drawer slide (exists),
    `<details>` body `khem-rise`, chevron rotate, card image `scale-105` on
    hover (`md+`), sticky bars translate in/out. All off under
    `prefers-reduced-motion`. The route loader and Lighthouse work stay in
    Stage 4.
17. **Copy**: new strings go in `en.ts` and `ar.ts` under the existing
    namespaces (`nav`, `collections`, `product`, `cart.drawer`, `checkout`).
    Existing keys are reused wherever they fit. Expected new keys:
    `nav.back` ("Back to {name}"), `nav.secure`, `collections.resultCount`,
    `collections.showing`, `collections.showMore`, `collections.pieces`
    (+ `One`), `product.ratingShort`, `product.writeReview`,
    `product.deliveryReturns`, `product.deliveryReturnsLink`,
    `product.keyIngredient`, `cart.drawer.headingCount`,
    `cart.drawer.unlocked`, `cart.drawer.checkoutTotal`,
    `checkout.summaryBar`, `checkout.progressLabel`, `checkout.newAddress`,
    `checkout.noteToggle`, `checkout.discountToggle`, `checkout.submit.cashTotal`.
    Arabic copy is written properly, not machine-literal.
18. Components that become unused are deleted; the old pre-mock prompt gets a
    one-line "Superseded by `prompts/storefront-redesign-stage-2.md`" header.

## Answered questions (2026-11-21)

- **Collection counts on Home**: show them ("9 pieces"). `getFeaturedCollections`
  gains a `Product(count)` embed (non-archived products) in its existing read;
  `Collection` gains an optional `productCount`. No schema change.
- **PDP back arrow on phones**: keep it, as in the mock.

## Files likely to change

- `src/app/globals.css` (`--nav-h` per breakpoint, card/accordion/sticky-bar
  helpers only where Tailwind can't express it)
- `src/app/[locale]/layout.tsx` (announcement-bar route variant, if it lives
  there), `src/components/Nav.tsx`, `src/components/Footer.tsx` (logo)
- `src/app/[locale]/page.tsx`, `src/components/home/{Hero,CollectionCard,
  CollectionSlider,IngredientRail,JournalCard,NewsletterForm}.tsx`
- `src/components/ecommerce/{ProductCard,AddToBagButton,ProductFlag,
  CollectionView,CategoryView,CategoryHero,CollectionGrid}.tsx`
- `src/app/[locale]/perfume/[slug]/page.tsx` (and `set/[slug]` only for the
  shared header variant), `src/components/ecommerce/{ProductGallery,
  ProductPurchase,QuantityStepper,ProductPyramid,ProductScentProfile,
  ProductStory,ProductIngredients,ProductComments,RatingSummary,CommentForm,
  RelatedProducts,StickyPurchaseBar,ProductBreadcrumb}.tsx`, new
  `ProductAccordion.tsx`, `ProductPerks.tsx`
- `src/services/comments.ts` (`cache()` wrapper only)
- `src/components/ecommerce/{CartDrawer,CartDrawerLine}.tsx`, new
  `DeliveryProgress.tsx`
- `src/components/checkout/{CheckoutView,CheckoutField,ContactStep,
  DeliveryStep,AddressFields,PaymentStep,DiscountStep,PointsStep,CreditStep,
  OrderReview}.tsx`, new `OrderTotals.tsx`, `CheckoutSummaryBar.tsx`,
  `CheckoutProgress.tsx`
- `src/components/marketing/OfferPopup.tsx`, `src/lib/format.ts`
- `src/lib/i18n/dictionaries/{en,ar}.ts`
- `prompts/mobile-ux-stage-2-storefront.md` (superseded header)

## Implementation requirements

- Strict TS, no `any`, no new dependencies, no new fonts.
- Server Components stay server; only components that already are client (or
  need state: accordions use native `<details>`, so they don't) are client.
- 44px minimum touch targets; `<summary>` rows ≥ 48px; inputs 16px on phones
  (no iOS zoom).
- Prefer existing classes (`.btn`, `.eyebrow`, `.card`, `ground-*`,
  `khem-scroll-track`, `khem-rise`) and tokens; no raw hexes in components.
- Images keep `next/image` with correct `sizes` for the new layouts; the PDP's
  first image and the home hero stay the LCP candidates (`priority`/eager).
- The checkout `<details>` and the moved submit button must not interfere with
  the Stripe Payment Element mount or the `fieldset disabled={awaitingPayment}`
  freeze; the honeypot stays where it is.
- Show-more uses `hidden`, not unmounting, so cards stay in the HTML.
- Every new public surface quotes only stored data already covered by
  `src/lib/admin/revalidate.ts` lists (no new data surfaces are added).
- The prelaunch guards in `Nav`/`Footer`/layout keep hiding search, the
  Collections menu and the bag while `KHEM_PRELAUNCH` is on.

## Security requirements

- Checkout: no change to what is submitted, priced or validated. Totals bar,
  totals card and drawer totals are display copies of client data that already
  exists; the Server Action's server-side pricing stays authoritative. "+ New"
  address only clears client state.
- No new routes, actions, API calls, storage keys or cookies; consent gating
  unchanged; no Clerk on public pages.
- The rating summary read is the same service-role query that already runs on
  the PDP, now memoised per request.

## Acceptance criteria

1. Each surface matches its artboard at 390×844 (EN) and the PDP also in AR
   (mirrored) and at 1440 (desktop artboard). Differences forced by real data
   (copy length, missing images, counts) are listed in the report.
2. Phone header is 56px; sticky toolbars, mega/drawer panels and the PDP
   gallery sit flush under it; desktop header is unchanged at 80px.
3. `/collections/fragrances` at 390px: the first product row is visible above
   the fold; "Show more" reveals 12 more; filter/sort resets it; with ≤12
   products no footer row.
4. Product cards: no truncated chips; notes on one line; "+" adds to bag and
   opens the drawer as today.
5. PDP at 390px: name, price, stepper, Add to bag and Buy now all within the
   first ~1.4 screens; pyramid card ≤ ~150px; story open; reviews form closed
   until asked; sticky bar appears after the CTAs scroll away and is gone at
   the footer.
6. Arabic reads "100 ML", "1 / 4", "EGP 1,470" correctly ordered; English
   unchanged.
7. Drawer: progress strip correct below and above the threshold; Delivery and
   Total rows match what checkout then shows for the same bag.
8. Checkout at 390px: the total is visible on the first screen; the summary
   expands; progress line follows completion; the sticky "Place order · EGP …"
   submits the form; card flow (when enabled) still mounts Stripe and hides the
   bar; nothing about submission changes.
9. Popup never opens on PDP/set/cart/checkout; still opens elsewhere.
10. No default blue focus box; keyboard Tab shows the gold ring everywhere new.
11. `scrollWidth === innerWidth` on every captured page at 360 and 390px.
12. Reduced motion disables every new animation.
13. `npx tsc --noEmit` and ESLint clean on changed files.

## Checks to run

```bash
npx tsc --noEmit
npx eslint <changed files>
```

Live (dev server): screenshots at 390×844, 360×740 and 1440×900, EN + AR, of
home, `/collections/fragrances`, one category route, `/perfume/onyx-night`, a
set page, the bag drawer (empty, below threshold, above threshold), `/checkout`
(one item, cash; summary collapsed and expanded), plus heritage and journal
for the shared header change. Overflow check on each. Public pages, so no
sign-in needed; the saved-address row is checked with the `.env.local` test
admin account in the user's own browser session only if the user offers it.

## Manual test steps (after implementation)

1. `npm run dev`; open DevTools → iPhone 14 (390×844).
2. `/`: hero ends near two-thirds of the screen and the collections rail
   peeks; swipe the rail; four best sellers in a 2-up grid; heritage band,
   ingredient circles, one journal row, inline newsletter card. Toggle a band
   off in Admin → Content → Landing: it disappears as before.
3. `/collections/fragrances`: compact hero, first products on screen. Tap a
   chip, change sort, press "Show more" until all show. Repeat at
   `/ar/collections/fragrances`.
4. Tap a card's "+": the drawer opens with the line. Check the delivery strip,
   then add another bottle and watch it switch to "unlocked". Totals match.
5. `/perfume/onyx-night`: back chevron returns to its collection; swipe the
   gallery (counter updates); stepper + Add to bag; scroll: sticky bar
   appears, then leaves at the footer. Open/close accordions; "Write a review"
   opens the form. Repeat at `/ar/perfume/onyx-night` and check "100 ML".
6. Desktop 1440: `/perfume/onyx-night` matches the desktop artboard; click a
   thumbnail to change the lead image; home, collection and checkout look as
   before apart from the new card.
7. `/checkout` on the phone: total bar at the top; expand it; fill contact and
   delivery and watch the progress line; open the note and discount rows;
   submit with the sticky "Place order" on a test product (or stop before
   placing it).
8. Clear site data, accept cookies, wait on a PDP past the popup delay: no
   popup. On `/heritage` it appears as before.
9. Tab through the header and a PDP with the keyboard: gold rings, no blue box.
10. macOS → Accessibility → Reduce motion on: no entrance or bar animations.

## Outcome (built 2026-11-21)

Built as specified, with these differences from the text above:

- **Collection counts**: `Product(id)` embed, counted in code, not
  `Product(count)`. The aggregate needs a table-wide SELECT grant and the anon
  role holds column grants only (PostgREST answered 42501). RLS already limits
  the embed to purchasable products.
- **Scope of D10 rows**: the discount row also opens itself while a credit is
  selected, so the "blocked by credit" sentence is never hidden.
- **Breadcrumb**: hidden below `lg` inside `ProductBreadcrumb` itself, so set
  and ritual pages match the product page (the back chevron replaces it).
- **Copy**: "Add to Cart" became "Add to Bag" (EN) to match "Your bag"; the
  drawer heading is "Your bag". `collections.sortBy` reads "Sort:".
- **Drawer total** ignores a signup offer, which only the checkout knows about;
  with an offer active, checkout's total is lower than the drawer's.
- **Not changed**: pricing, validation, the checkout action, auth or data
  writes. The only data change is the extra embed in one existing read.
- Known, left for later stages: `DiscoverySetCard` and `MerchCard` keep their
  framed style (Stage 3/4 consistency pass); a dev-only Next warning names the
  PDP's first image as LCP because the hidden desktop thumbnail shares its URL.

Checks run: `npx tsc --noEmit`, ESLint on every changed/new file (clean);
agent-browser captures at 390×844 and 1440×900 in EN and AR of home,
collection, category, product, ritual, bag drawer and checkout; overflow and
56px header verified at 360×740 on 14 routes; sticky bar shows after the CTAs
and hides at the footer; popup does not open on a product page.
