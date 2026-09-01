# Polish adjustments — hero composition, Clerk branding, collapsible footer groups

Follow-up to `prompts/polish-ux-fixes.md`, answering `src/docs/ADJUSTING_POLISH.md`
and the two screenshots (Body Care vs Signature at 390px).

## Goal

Three corrections. Nothing from the previous pass is reverted; the hero item is a
second, deeper cut at the same problem — the CSS-only fix was not enough.

## What the screenshots actually show

The last pass equalised the *scrim ramp* but not the **composition**, and the
composition is the difference:

- **Signature** (`<CollectionView>`) is `items-end`: the photograph owns the top
  of the frame at full luminance, and the breadcrumb, count and title sit on the
  ivory floor at the bottom. You see the artwork, then you read.
- **Body Care** (`<CategoryHero>`) is `items-center`: the type sits *in the
  middle of the picture*, so the scrim has to be strong enough to carry text
  across the whole frame. At 390px that leaves a washed-out corner of a bottle
  behind a paragraph — the image is present but never seen.

Every remaining non-conforming hero has the same `items-center` shape. So the
fix is to move the type to the floor, not to tune gradients further.

## Existing code inspected

- `src/components/ecommerce/{CollectionView,CategoryHero,NewArrivalHero}.tsx`
- `src/app/[locale]/{heritage,about,ingredients,craftsmanship}/page.tsx`
- `src/components/stockists/StockistDirectory.tsx`
- `.banner-scrim*` in `src/app/globals.css`
- `src/components/Nav.tsx` (the collections disclosure — the house's existing
  expand/collapse), `src/components/{Footer,FooterGroup}.tsx`
- Clerk docs: Dashboard → Settings → **Branding** → *Remove "Secured by Clerk"
  branding*; `.env.local` carries a `pk_test_…` (development) publishable key.

## Decisions and assumptions

1. **One hero shape, each page's own type.** Affected heroes adopt the
   `<CollectionView>` composition — `items-end`, `.banner-scrim-base`, content
   bottom-padded — and keep their own copy, type scale, and horizontal alignment
   (the New Arrival hero stays centred, just centred *on the floor*). This is
   "same visual behaviour", not "same layout", which is what §6 of the original
   brief asked to avoid flattening.
2. **`.banner-scrim-column` and `.banner-scrim-center` are deleted.** With no
   type floating over the middle of a frame, neither the horizontal reading-column
   wash nor the radial pool has a job left. Leaving them defined would leave two
   unused scrim systems for the next edit to pick the wrong one from — the exact
   drift the primitive was introduced to end. `.banner-scrim-base` is renamed to
   nothing and stays the single variant.
3. **Heights are re-cut per breakpoint, not shared.** The point is visible
   artwork, so each banner keeps a tall-enough frame with the type occupying the
   bottom third at every width. Current `min-h` values were set for centred type
   and are re-checked at 390 / 768 / 1440.
4. **Clerk branding: supported route only.** The toggle exists —
   Dashboard → Settings → Branding → *Remove "Secured by Clerk" branding* — and
   is free on a development instance, paid-plan for production. It is an account
   setting, not a code change, so this is documented and left for the account
   owner. The **Development mode** pill is a property of the development instance
   itself (`pk_test_…`); it is not removable by configuration and disappears when
   the deployment uses production keys. No CSS is written to hide either.
5. **Footer groups collapse with the Nav's disclosure, closed by default.** The
   Nav already owns this interaction (chevron, `grid-rows-[0fr]` → `[1fr]`,
   `ease-luxury-bezier`, `inert` when closed, one group open at a time). The
   footer reuses that shape rather than inventing a second one. Closed by
   default, because a control that never shortens the column is decoration —
   and the group labels still print the structure.

## Files likely to change

- `src/components/ecommerce/CategoryHero.tsx`
- `src/components/ecommerce/NewArrivalHero.tsx`
- `src/app/[locale]/{heritage,about,ingredients,craftsmanship}/page.tsx`
- `src/components/stockists/StockistDirectory.tsx`
- `src/app/globals.css` (scrim variants only)
- `src/components/Footer.tsx`, new `src/components/FooterDisclosure.tsx`
- `src/docs/clerk-password-policy.md` → joined by `src/docs/clerk-branding.md`

## Implementation requirements

### 1. Hero composition

For each affected hero:

- `items-center` → `items-end`; the content wrapper takes the reference's
  bottom padding (`pb-14 md:pb-18`, `px-4 md:px-20`) and keeps its own
  `max-w-*` and alignment.
- `banner-scrim-column` / `banner-scrim-center` → `banner-scrim banner-scrim-base`.
- The `<Image>` keeps `fill object-cover priority quality={85} sizes="100vw"` and
  its existing (absent) filter — no new `brightness-*`.
- Heights: keep each page's `h-[Nvh]`, and re-cut `min-h` so the type block never
  occupies more than roughly the bottom third at 390px. Verify per page rather
  than applying one number.
- Nothing else moves: copy, type scale, gold rule, scroll hint, breadcrumbs and
  CTAs stay exactly as they are.
- `<StockistDirectory>`'s panel is a *card*, not a page banner — if the base ramp
  reads wrong inside a bordered box, leave its scrim as the last remaining use
  and keep the variant; decide by looking, and record which way it went.

### 2. `globals.css`

- Remove `.banner-scrim-column`, `[dir="rtl"] .banner-scrim-column` and
  `.banner-scrim-center` once nothing references them (grep to confirm).
- Rewrite the block comment so it documents one scrim and why: the type sits on
  the floor of every banner, so the floor is the only gradient the house needs.
- No change to `.banner-scrim-base`'s stops.

### 3. Clerk branding

- Add `src/docs/clerk-branding.md`: the Dashboard path, that it is free in
  development and requires a paid plan in production, that the Development-mode
  pill follows the instance and not the setting, and the standing rule that
  neither is to be hidden with CSS (it breaks on a Clerk release and, for the
  badge, misrepresents which instance a visitor is on).
- No code change. Report as a Clerk-account limitation.

### 4. Collapsible footer groups (desktop only)

- New `src/components/FooterDisclosure.tsx`, `"use client"`, one group: a
  `<button>` with the label + `<ChevronDown>` (`strokeWidth={1.25}`,
  `rotate-180` when open, `duration-400 ease-luxury-bezier`), and a panel using
  the Nav's `grid-rows-[0fr]`/`[1fr]` + `overflow-hidden` + `inert` pattern.
  Props: `title`, `children`, optional `defaultOpen`.
- `Footer.tsx`: in the `md:flex` collections column, wrap **Fragrances**,
  **Scent Profiles** and **Quick Access** each in a `<FooterDisclosure>`.
  Ungrouped rows (All Products, Body Care, Home Fragrance) stay plain links.
- The `md:hidden` flat list and `<FooterGroup>`'s own phone accordion are
  untouched — the new control must not render below `md`.
- The other three footer columns are untouched.

## Security requirements

None of this touches auth, data, or a server boundary. `FooterDisclosure` is
presentational client state; no props carry user data.

## Acceptance criteria

- Body Care, Gift Set, Discovery, Home Fragrance, Heritage, About, Ingredients,
  Craftsmanship and New Arrival open the way `/collections/signature` does: a
  clearly visible photograph resolving downward into ivory, type on the floor.
- Verified at 390px, 768px and 1440px, in `en` and `/ar`.
- Only one `.banner-scrim-*` variant remains in `globals.css` (or two, with the
  stockist exception recorded).
- Each desktop footer group opens and closes on its own; mobile is unchanged.
- `tsc --noEmit`, `eslint`, `next build` clean.

## Manual test steps

1. `/collections/signature` first — the reference. Then `/collections/body-care`,
   `/collections/gift-set`, `/collections/discovery`,
   `/collections/home-fragrance`, `/new-arrival`, `/heritage`, `/about`,
   `/ingredients`, `/craftsmanship`, `/stockists` — at 390 / 768 / 1440, `en`
   and `/ar`. Each banner: artwork visible, type legible on the floor, no seam.
2. Footer at ≥1024px: open and close each of the three groups; confirm one
   group's control does not move another's items. At ≤767px: the accordion and
   its flat list are unchanged.
3. `/signin`: confirm the Clerk badge is still present and the card still works;
   the removal is a Dashboard toggle for the account owner.
