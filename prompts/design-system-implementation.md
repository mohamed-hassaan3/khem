# KHEM Design System — Full Implementation

Follows the approved preview at `/design-preview`
(`prompts/design-system-preview.md`). Spec: `src/docs/khem-ui-design-system.md`.

## Goal

Apply the approved four-ground system — obsidian / charcoal / sand / ivory,
gold demoted to an accent — across the storefront and the admin dashboard, and
build the three things the spec asks for that do not exist yet: a collection
slider, footer accordions, and detail pages for discovery and gift sets.

## Skills read

None of `clerk`, `supabase`, or `ai-sdk` apply to the re-skin. Phase 5 adds two
routes that read the catalogue through the existing `src/services/` layer; if
that turns out to need a new query shape, `supabase` is read before writing it.

## Existing code inspected

Beyond everything listed in `prompts/design-system-preview.md`:

- `src/lib/routes.ts` — `productHref()` sends `DISCOVERY` and `GIFT` products to
  their *category* page, and `hasDetailPage()` returns `false` for both.
- `src/app/[locale]/page.tsx` — eleven sections, every one of them
  `bg-background` or `bg-surface`. Collections render as a static
  `<CollectionCard>` grid.
- `src/components/Footer.tsx` — a four-column `lg:grid-cols-[2fr_1fr_1fr_1fr]`
  link grid. No collapse, no accordion, no `<details>`.
- `CollectionGrid`, `CategoryView`, `MerchGrid`, `RelatedProducts`,
  `CollectionSkeleton` — all `grid-cols-2 … lg:grid-cols-3`, all using
  `gap-px bg-border` to draw hairlines *between* cards.
- 228 `.tsx` files: 148 under `src/components/`, 80 under `src/app/`.

### Three findings that change the shape of this work

1. **The grid is 2 → 2 → 3, not 2 → 2 → 4.** The spec asks for 2 → 3 → 4, so
   every grid gains a breakpoint and every `sizes` hint beside it is now wrong.
   `ProductCard`'s `DEFAULT_SIZES` of `(min-width: 1024px) 25vw, 50vw` already
   disagrees with the `lg:grid-cols-3` it is rendered into — the cards are
   fetching images a third too small today. Worth fixing regardless of this
   project.

2. **Cards have no borders — the grid draws them.** `gap-px bg-border` makes a
   mosaic: cards butt together and a 1px background bleeds through as a
   hairline. That technique needs an opaque card and cannot survive the move to
   `k-card` on ivory. So every product grid changes structurally, not just in
   colour. This was implicit in the preview and should be explicit here.

3. **Discovery and gift sets are a feature build, not a re-skin.** §11 and §12
   require real detail pages; today those products have no route, and the cart
   line for one links back to the grid. This needs routes, metadata, sitemap
   entries, a service query, and `productHref` / `hasDetailPage` changes.
   It is the only part of this project that touches business logic.

## Decisions / assumptions

1. **Tokens are renamed, not redefined.** `--k-*` from the preview lands in
   `globals.css`'s `@theme` under the real names. `--color-gold` changes value
   (`#c8a96a` → `#b08d57`) and a new `--color-gold-deep` appears for gold text
   on light. Nothing keeps its old name with a new meaning, so every diff is
   visible.
2. **`body` stops declaring a ground.** The sitewide dark radial gradient is
   removed; each page or section states its own. This is the single change most
   likely to expose a component that was relying on inheritance — expect a pass
   of "this looked fine because everything was black" fixes.
3. **Ground is a prop, not a guess.** Components that appear on both grounds
   (`ProductCard`, `ProductFlag`, `ProductPrice`, buttons, fields) take an
   explicit `ground` prop defaulting to `"light"`. No component sniffs its
   parent.
4. **Arabic is unchanged in mechanism.** The `[dir="rtl"]` tracking reset and
   the `[lang="ar"]` optical-size block stay exactly as they are. Both trees are
   checked at every phase; the RTL work is verification, not rewriting.
5. **The preview route survives until the end**, then is deleted with its proxy
   bypass in the final commit. It is the reference while the work is in flight.
6. **Phases ship independently.** Each phase leaves the site working, builds
   clean, and is reviewable on its own. No phase depends on a later one.

## Phases

### Phase 0 — Tokens & foundations ✅ DONE
`globals.css`, `src/lib/fonts.ts` (unchanged, verified).
Land the palette, elevation scale, radius, and the ground helper classes.

**Two deviations from this plan as written, both deliberate:**

1. **`body` keeps a ground.** The plan said to remove it and accept a broken
   intermediate state. That was the wrong call: it would have handed the
   reviewer a site mid-surgery for no gain. The radial *gradient* is gone — it
   was a decision about a page being made in the stylesheet, and it would have
   haloed behind every future ivory section — but `body` now states flat
   obsidian, which is what every page that declares nothing means today. Later
   phases opt surfaces into light explicitly; nothing is left inheriting.
2. **The `!important` 16px mobile field patch stays.** Deleting it here would
   re-introduce the iOS focus-zoom on every form, because fields still declare
   `text-[13px]` through `FIELD_CLASS`. It goes in Phase 1, when the field
   primitive declares 16px and there is nothing left to override. Noted in the
   stylesheet at the block itself.

**Two unplanned changes, forced by the token work:**

- `--color-champagne` → `--color-gold-soft` (17 call sites across 13 files).
  Not cosmetic: the spec has no "champagne", and dropping the token while
  leaving `text-champagne` in the markup would have silently produced *no
  colour at all* — Tailwind v4 emits nothing for an unknown utility, so the
  failure would have been invisible in review and caught by nobody.
- `src/constants/theme.ts` **deleted.** A second, unreferenced copy of the
  entire palette in hex, imported by nothing. Harmless while it agreed with
  `globals.css`; actively misleading the moment the palette changed, since it
  now stated the old values as fact. Restore it if you disagree — nothing
  depends on it.

### Phase 1 — Primitives ✅ DONE

**Deviation: no `components/ui/` React components.** The primitives are CSS
component classes in `globals.css` — `.btn` + five variants, `.field` /
`.field-underline` / `.label` / `.field-error` / `.field-hint`, `.card` — which
is the idiom this codebase already uses for `.btn-luxury`, `.eyebrow` and
`.note-pill`. A React `<Button>` would have to be polymorphic across `<button>`,
`<a>`, `<Link>` and `<LocaleLink>` (all four are real call sites), which needs a
`Slot` polyfill since Radix is not a dependency, and would earn nothing: every
one of the 30 call sites already composes extra Tailwind onto the class string.

**`.btn-primary` resolves against its ground.** `--btn-primary-bg/-fg` are set
by the `.ground-*` blocks, so the same class is ivory-on-obsidian on a dark
ground and obsidian-on-ivory on a light one. The alternative — a `primary` and
an `inverse` variant, chosen per call site — makes each button responsible for
knowing what colour the section around it is, and the failure mode when a
section later changes ground is an invisible button.

**Ground colours are Tailwind theme colours, not CSS classes.**
`--color-ground`, `-muted`, `-accent`, `-bg`, `-border` alias the `--ground-*`
variables inside `@theme`. Written as `@layer components` classes they would
have taken no variants at all — no `hover:`, no `group-hover:`, no `md:` —
which several of the reworked components need.

**`ProductFlag` is deliberately *not* ground-relative.** It sits on the
photograph, in the corner of the image, and a photograph is not one of the five
grounds — it can be a pale flacon on cream or a black bottle on obsidian in the
same grid. Tying the pill to the card's ground would make it illegible on
exactly the images that contrast most with their card. Fixed near-obsidian veil
on all five grounds; reasoning recorded at the component.

**The `!important` 16px field patch stays until Phase 4**, not Phase 1 as
planned. `.field` now declares 16px at every width, but roughly a dozen inputs
still bypass the primitive (offer popup, both search bars, newsletter forms,
several admin sub-controls) and each carries a `text-xs` utility that beats a
non-`!important` base rule. Deleting it now would re-introduce the iOS
focus-zoom on those forms only — the kind of regression nobody finds until it
ships. Phase 0's annotation corrected to say so.

Done: 30 `.btn-luxury` call sites migrated (18 primary, 12 outline) across 23
files; `.btn-luxury` / `.btn-luxury-fill` deleted. Four drifted `FIELD_CLASS`
constants collapsed onto `.field` (they had diverged in padding, type size and
focus treatment); `FIELD_CLASS` keeps its export name, since 24 admin modules
import it. `ProductPrice`, `AddToBagButton`, `QuantityStepper`, `EmptyState`,
`PageHeader` moved onto ground-relative colours.

`.card` is defined but not yet applied — it lands in Phase 2 with the cards.

### Phase 2 — Product cards & grids ✅ DONE

`ProductCard` and `MerchCard` are now `<article>` + stretched link (`z-1`) with
the bag as a real sibling above it (`z-2`). §36 holds *structurally*: the two
are different regions of the card, so there is no event to stop and no wrapper
for a call site to forget. `AddToBagButton` stopped positioning itself — the
card places it, in the price row — and grew from 36px to 44px.

**A bug this fixed rather than a change.** Because the old card was one anchor,
each grid had to wrap it in a `relative` div and overlay the bag on top.
`<RelatedProducts>` never did, so **a product in the related rail could not be
added to the bag at all.** It now can, for free, because the card carries its
own control.

**The `sizes` hint was wrong before this.** It claimed `25vw` at `lg` while
every grid rendered three columns, so cards fetched images about a third
smaller than the slot they filled. Now
`(min-width: 1400px) 350px, … 25vw, … 33vw, 50vw`, matching the real 2/3/4 grid
inside a `max-w-350` container, and set on the card so it cannot drift from the
layout again.

**Mosaic → bordered cards.** `gap-px bg-border` made the grid draw the edges by
letting a 1px background bleed between butted cards. That cannot survive an
opaque card on ivory, so all six product grids moved to real gaps plus `.card`.
`<CollectionSkeleton>` moved with them: on a gapped grid, a borderless
placeholder is a floating patch of slightly-lighter nothing.

**Deviation: the three cards are not merged.** They now share structure —
identical shell, clamps, price row and bag placement, so a shopper cannot tell
two components are involved — but not code. `ProductCard` is an async Server
Component and the other two need the dictionary on the client, and
`DiscoverySetCard` still has no detail page to link to. The natural merge point
is Phase 5, when sets get routes and the last structural difference disappears.

`DiscoverySetCard` lost its full-width "Add to Cart" — the last text buy button
in the catalogue (§9) — and with it the transient "Added ✓" state, which only
existed because a full-width button had somewhere to report. The cart panel is
the confirmation. Its `useCart` / `useState` / `useEffect` / `useRef` plumbing
went too.

**Pre-existing defect found, not fixed:** an ingredient image 404s —
`res.cloudinary.com/…/ingerdints-mendesian.png`, a typo for "ingredients" in
stored content data, not code. Out of scope for a UI phase; worth a data fix.

### Phase 3 — Chrome ✅ DONE

**The header ground is declared by the page, not detected by the header.**
`providers/nav-ground-provider.tsx` + `<NavGround ground hero />`. The tempting
implementation — `elementFromPoint` under the header's bottom edge, or an
`IntersectionObserver` over every `.ground-*` section — runs on every scroll
frame to answer a question the page already knows statically, and both fail in
the same place: in the gap between two sections, or over a full-bleed image
belonging to neither. Defaults are `obsidian` + `hero: true`, which is exactly
what every page does today, so this is inert until a page declares otherwise.

`hero={false}` forces the solid state from the first pixel — the right answer
for `/cart`, `/checkout`, `/account` and the dashboard, which open on a rule
rather than an image. On a light page a transparent header is ivory type on
ivory, so it is a required decision rather than something inferred.

**The ground class is applied in both header states, not only the solid one.**
Transparent means no *background*; it does not mean no foreground, and the
links, icons and bag count still have to resolve against the hero behind them.

**A latent bug fixed before it could land.** The mega-menus and the mobile
drawer are children of `<nav>`. Once that element became ground-aware, on a
future ivory shop page they would have inherited `--ground-fg: #151515` while
keeping their own obsidian backgrounds — near-black type on near-black. All
three now declare `ground-obsidian` explicitly, as do `<CartDrawer>`,
`<SearchOverlay>`, `<CookieConsent>`, `<OfferPopup>` and `<AnnouncementBar>`.
§23: an overlay is its own surface.

`.nav-link` was `color-mix(in srgb, var(--color-ivory) 70%, transparent)` — a
readable grey on obsidian and invisible on ivory. It now mixes the ground's own
foreground into its own background, giving the same recessive weight on all
five grounds.

**Footer:** mobile accordions (§25) via `components/FooterGroup.tsx`. The
heading is rendered twice — a `<button>` below `md`, static text above it —
rather than once as a button that stops behaving like one, because that
alternative keeps the button role and `aria-expanded="false"` on desktop and
announces a collapsed disclosure over a plainly visible list. `<details>` was
the right instinct and does not work: `open` is a boolean attribute and cannot
be made responsive, and `::details-content` is not reliably overridable across
supported browsers.

**Deviations:**

- **`<OfferPopup>`'s light treatment is not wired.** Which treatment a modal
  takes depends on the page beneath it, and no page has a ground to read until
  Phase 4 — choosing now would be choosing blind. Obsidian is unchanged and
  correct on every page today.
- **`<AnnouncementBar>`'s sand/gold variants are not wired.** Picking one per
  campaign needs an admin field, which is a Phase 6 concern. The bar is
  `ground-obsidian`, which is §24's register and the preview's default anyway.
- **Desktop footer Collections is not collapsible.** Open question — see below.

**Known Phase 4 dependency:** `public/logo/name-logo-transparent.svg` is
fixed-colour traced artwork. It reads correctly on obsidian; whether it survives
on an ivory header needs checking when a light page exists, and may need a
second asset.

### Phase 4 — Pages

**Split into 4a and 4b.** The phase as planned was ~40 page files in one
delivery, which is not a reviewable unit — and 4a turned up a foundational bug
that had to be fixed before any further page could be trusted.

#### Phase 4a ✅ DONE — home, the slider, and the shop

**The ground system was silently inert until this phase, and the bug was mine.**
`@theme` declared `--color-ground: var(--ground-fg)`, with each `.ground-*`
block setting only `--ground-fg`. Custom properties inherit as **computed**
values: that expression resolved once, at `:root`, against `:root`'s
`--ground-fg`, and the resulting *colour* inherited down. Redefining
`--ground-fg` on a descendant did not re-resolve it — there was nothing left to
resolve. Every `text-ground*` utility written in Phases 1–3 was therefore
painting the obsidian value everywhere, and nothing looked wrong because the
whole site was obsidian. It surfaced the moment a section went sand: an ivory
heading on sand. Each `.ground-*` block now restates the `--color-ground*`
names as literals; the reasoning is recorded at `@theme`.

**Home** — four movements rather than ten alternations: obsidian hero → sand
collections → ivory fragrances → obsidian (brand story, craftsmanship, feature)
→ sand ingredients → ivory (journal, testimonials) → obsidian newsletter into
the obsidian footer. §38 twice over. Five hand-rolled buttons that never used
`.btn-luxury`, and so were missed in Phase 1, became `.btn` variants.

**`<CollectionSlider>`** (§5) — native `overflow-x: auto` with CSS scroll
snapping, not a carousel library. Touch is the platform's own scroll, with real
momentum and interruptibility; arrow keys work because the track is a focusable
scroll container; nothing is measured on resize; and it works before hydration —
JavaScript only adds the arrows and their disabled state. `basis-[85%]` on a
phone leaves the next card's edge visible, which is §5's swipe affordance. The
widest step is capped at the item count, so two featured collections do not
leave an empty third of the row.

**Shop and bag to ivory** (§14, §15): `/collections`, `/collections/[slug]`,
the category and merch grids, `/cart`, and the loading skeleton. Heroes keep
`ground-obsidian` — their type sits on a photograph, and the ground type needs
is the image's. The order summary takes sand (§16).

Two fixed-obsidian veils found and made ground-relative: the sticky facet bar
(a dark band across the ivory shop page) and the sticky purchase bar.

`<NavGround>` declared on the converted pages. `hero={false}` on `/cart`, which
opens on a rule rather than an image. The logo mark reads correctly on ivory —
the Phase 3 concern about needing a second asset does not materialise.

#### Phase 4b ✅ DONE — remaining pages

93 files swept onto ground-relative colours; grounds and `<NavGround>` set per
route. PDP, ritual, checkout, account, auth, cart-adjacent flows, search,
stockists, contact and legal to **ivory**; ingredients and the olfactory pyramid
to **sand**; heritage, craftsmanship, new-arrival, the order confirmation and
404 stay **dark**; about follows §18's black → sand → ivory → black.

**The `!important` 16px patch is gone**, and narrowed rather than deleted. It
still exists as a *floor* for controls added later without the primitive — that
failure is invisible on a desktop browser — but `<select>` was dropped from it
(iOS opens a native picker and never zooms for one, so forcing 16px there was
doing nothing for accessibility while overriding the deliberate 11px on the
currency and sort controls), and `!important` went with the four `FIELD_CLASS`
constants that made it necessary. Three raw inputs migrated to `.field`.

**A blanket sweep is not safe, and this proved it.** The mechanical pass
rewrote `<ProductFlag>`'s fixed dark veil into ground-relative colours —
undoing a Phase 1 decision that was documented at the component. On the ivory
shop grid every muted flag became near-black text on a near-black veil.
Reverted, with a note at the component telling the next sweep to leave it
alone. Same class of fix for `<ProductGallery>`'s arrows and
`<CommentLightbox>`, which also sit on imagery rather than on a ground.

**An automated contrast audit was written and run** rather than trusting
screenshots — a canvas pixel readback per element, walking up for the first
opaque background, flagging anything under 3:1. It took three attempts to make
the tool itself correct (regex parsing of `oklab()` and `color(srgb …)` gives
nonsense; painting the colour and reading the pixel does not), and it then
found three genuine bugs that no screenshot had shown:

1. **The header over a hero on a light page.** `ground-${ground}` was applied in
   both header states. Transparent, there is no bar — the type sits directly on
   the hero photograph — so an ivory page painted near-black links onto a dark
   image. The solid state now takes the page's ground and the transparent state
   takes obsidian, which is what a full-bleed hero is by construction. This is
   the precise failure the whole `<NavGround>` mechanism exists to prevent, and
   it survived three phases of screenshots.
2. Dark `bg-surface` panels left inside the now-ivory stockists page.
3. Three `text-ivory/NN` survivors whose opacity suffix the sweep's map missed.

Final state: **0 contrast findings** across 17 routes in both locales.

### Phase 5 — Discovery & gift set detail pages
New routes `/discovery/[slug]` and `/gift-set/[slug]`; service query; `sitemap.ts`;
`productHref` / `hasDetailPage`; `next.config.ts` redirects for the old
category-page links; cart lines now link to the product.
**The only phase that changes behaviour rather than appearance.**

### Phase 6 — Admin
`AdminShell` (charcoal rail, ivory content, mobile drawer), `AdminTable`
(+ card fallback under `md`), `fields.tsx`, `charts/`, and the ~35 admin pages.

### Phase 7 — Close out
Delete `src/app/design-preview/` and the `proxy.ts` bypass. Full RTL pass. Full
responsive pass. Lighthouse.

## Implementation requirements

- Reuse before creating (§34). New primitives replace duplicated markup; they do
  not sit alongside it.
- No component may assume its ground.
- Every interactive control keeps a visible focus state and a 44px touch target.
- Icon-only controls carry an `aria-label` that names their subject.
- Motion stays `cubic-bezier(0.16, 1, 0.3, 1)`. Zero spring, zero bounce.
- The collection slider must support pointer, touch, and keyboard, and must not
  trap scroll on a phone.
- Footer accordions are real disclosure widgets — `aria-expanded`, keyboard
  operable, and open by default on desktop where there is room.

## Security requirements

- No change to `requireAdmin()`, `getViewer()`, or any Server Action's auth
  check. Admin pages are re-skinned, never re-gated.
- Phase 5's new routes are public catalogue pages and must select through the
  existing service layer — no new direct database access from a page.
- No new client-exposed environment variable.
- The `proxy.ts` design-preview bypass is removed in Phase 7.

## Acceptance criteria

- Every box in the spec's Implementation Checklist is satisfied.
- Grids are 4 / 3 / 2 with `sizes` hints that match.
- Product cards hold equal height with unequal copy; the bag control never
  navigates.
- Discovery and gift sets have detail pages reachable from their cards.
- Footer collections collapse; mobile footer is an accordion.
- Home page alternates dark / sand / ivory / dark.
- Admin is usable at 390px, tables included.
- Both locales verified at 390 / 834 / 1440 on every changed page.
- TypeScript clean, ESLint clean, `npm run build` succeeds.
- No regression in cart, checkout, discounts, credits, inventory, or admin.

## Checks to run

Per phase: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
Visual verification via `agent-browser` at three widths in both locales.

## Manual test steps

Given per phase on delivery. At minimum, end to end: browse `/collections` →
open a perfume → add to bag from the card → open the drawer → `/cart` →
`/checkout` → confirmation, in both `en` and `ar`, at 390px and 1440px.
