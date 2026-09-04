# Unified language + country selector, smart nav, editable New Arrival eyebrow

## Goal

Three independent changes, shipped together without regressions:

1. **One selector for language and country.** The footer's currency control is
   removed; the header's language switcher becomes a single trigger that reads
   the active language *and* country, carries a chevron, and opens a panel
   listing both languages and countries. Changing either must not break
   localisation or the display-currency behaviour.
2. **Smart navbar.** The fixed header hides on scroll down, returns on scroll
   up, and returns when a mouse approaches the top of the viewport — with no
   layout shift, on desktop and mobile. The mobile bar returns to the desktop
   height (80px).
3. **Editable "New Arrival" eyebrow.** The band's eyebrow is currently the
   hard-coded dictionary string `dict.home.featured.eyebrow`; it becomes a
   Landing Page CMS field with a safe "empty means inherit" default.

## Skills read

- `AGENTS.md` (§1 operational rules, §2 workflow, §3 design system, §6 stack,
  §11 component standards).
- `node_modules/next/dist/docs/` patterns already established in this repo for
  Server/Client boundaries — no new framework API is introduced.
- No `clerk` / `supabase` / `ai-sdk` skill work is needed: the only data change
  is one extra key inside an existing `jsonb` column.

## Existing code inspected

- `src/components/Nav.tsx` — the fixed header (`</nav>` at line 597; the mobile
  drawer, search overlay and both mega-menus are **siblings**, not children, so
  transforming the `<nav>` element cannot drag them).
- `src/components/Footer.tsx` — bottom bar renders `<CurrencySwitcher />` beside
  "crafted in".
- `src/components/i18n/LanguageSwitcher.tsx`, `src/components/i18n/CurrencySwitcher.tsx`.
- `src/providers/currency-provider.tsx` — module-level `useSyncExternalStore`
  store, cookie-backed, `getServerSnapshot()` returns `BASE_CURRENCY` so pages
  stay prerendered.
- `src/lib/currency.ts` — `CURRENCIES`, `COUNTRY_CURRENCY` (24 priced
  countries), `resolveCurrencyForCountry`, `CURRENCY_COOKIE`.
- `src/proxy.ts` — writes the currency cookie from `x-vercel-ip-country` and
  documents that **no country is stored**.
- `src/app/globals.css` — `--announcement-h` / `--nav-h` / `--header-h` stack
  (lines ~1725-1790), `.nav-bar`, `.mega-menu { top: var(--header-h) }`.
- `src/app/[locale]/layout.tsx` — `<AnnouncementBar>` (fixed, `top-0`),
  `<Nav>`, then `<div className="pt-[var(--header-h)]">`.
- `src/lib/landing-sections.ts` (`SectionSettings`, `resolveNewArrival`,
  `NewArrivalPresentation`), `src/schemas/landing.ts` (`newArrivalSchema`),
  `src/actions/admin/landing.ts` (`updateNewArrival`),
  `src/components/admin/NewArrivalForm.tsx`, `src/app/[locale]/page.tsx`
  (the `featured` band, eyebrow at line 642).
- `supabase/sql/0044_new_arrival_presentation.sql` — the check constraint only
  touches `mediaType` / `videoUrl` / `imageUrl`, so a new settings key needs no
  migration.

## Decisions and assumptions

- **"Country" = the footer currency control.** Confirmed with the user. The
  site has no other country selector outside checkout.
- **Country list = the countries KHEM prices in** — the keys of
  `COUNTRY_CURRENCY` (EG, GB, AE, SA and the 20 eurozone members) plus an
  explicit "International" row that means "anywhere else" and resolves to
  `FALLBACK_DISPLAY_CURRENCY` (USD). No new country data is invented; the list
  is derived from the existing pricing map, and names come from
  `Intl.DisplayNames` in the active locale, exactly as `src/lib/shipping.ts`
  already does — so it is bilingual for free.
- **Currency stays the source of truth for prices.** Choosing a country writes
  the country cookie *and* commits `resolveCurrencyForCountry(code)` through
  the existing currency store. Nothing about pricing, rounding, conversion
  notes, or the server-renders-EGP guarantee changes.
- **The proxy is not touched.** Its documented stance ("no IP, no country" is
  stored) is preserved: the country cookie is written only when the visitor
  *chooses* one. Until then the displayed country is derived from the active
  currency (`EGP → Egypt`, `GBP → United Kingdom`, `AED → UAE`, `SAR → Saudi
  Arabia`, `EUR → Europe`, `USD → International`).
- **The unified control lives in the header** (desktop rail + mobile drawer),
  per the user's choice. The footer keeps no region control.
- **Header hiding is transform-only**, on `fixed` elements, so no layout shift
  is possible: `--header-h` and the page's `pt-[var(--header-h)]` never change.
  The announcement bar hides with the nav so the two never separate.
- **Eyebrow override is single-language**, matching the band's existing
  `title` / `description` / `ctaLabel` overrides. Empty means "use the house
  wording" (`dict.home.featured.eyebrow`), so untouched installs render exactly
  what they render today.

## Files likely to change

**Task 1 — unified selector**
- `src/lib/currency.ts` — export `PRICED_COUNTRIES` (sorted codes from
  `COUNTRY_CURRENCY`), `COUNTRY_COOKIE` (`khem.country.v1`), `isCountryChoice`,
  `INTERNATIONAL` sentinel, and `representativeCountryFor(currency)`.
- `src/providers/currency-provider.tsx` — add a second module-level store for
  the chosen country (same `useSyncExternalStore` shape, same cookie helpers);
  context gains `country` (resolved, never `null` after hydration) and
  `setCountry(code)`, which writes the country cookie and commits the derived
  currency in one go.
- **New** `src/components/i18n/LocaleRegionSwitcher.tsx` (client) — the trigger
  + panel, `variant="compact"` for the header rail and `variant="full"` for the
  drawer.
- `src/components/Nav.tsx` — swap `<LanguageSwitcher />` for the new control in
  both places; the drawer section heading becomes the new label key.
- `src/components/Footer.tsx` — drop the `CurrencySwitcher` import and the
  control; keep "crafted in" alone in its slot.
- Delete `src/components/i18n/LanguageSwitcher.tsx` and
  `src/components/i18n/CurrencySwitcher.tsx` once nothing imports them.
- `src/lib/i18n/dictionaries/en.ts` + `ar.ts` — a `regionSwitcher` block
  (`label`, `language`, `country`, `international`, `europe`, `note`). The
  existing `languageSwitcher` / `currencySwitcher` blocks stay: the latter's
  `names` and `conversionNote` are still read by `ProductPurchase` and
  `CartSummary`; `languageSwitcher.label` is reused as the panel's language
  group heading.

**Task 2 — smart navbar**
- **New** `src/hooks/use-header-visibility.ts` — rAF-throttled scroll direction
  + pointer-near-top, returns `isHidden`.
- `src/components/Nav.tsx` — consume the hook, add the transform classes, force
  visible whenever a mega-menu, the drawer or search is open; `h-14 md:h-20` →
  `h-20` on the bar and on the drawer's header row.
- `src/app/globals.css` — `--nav-h: 80px` at every width (drop the `md`
  override, update the comment block), and the hidden-state rules keyed off
  `html[data-header-hidden="true"]` for `.nav-bar` and the announcement bar,
  including a `prefers-reduced-motion` branch.
- `src/components/marketing/AnnouncementBar.tsx` — add the `announcement-bar`
  class hook (no visual change).

**Task 3 — eyebrow**
- `src/lib/landing-sections.ts` — `showEyebrow?: boolean` + `eyebrow?: string | null`
  on `SectionSettings`; the same two fields on `NewArrivalPresentation`;
  `resolveNewArrival` applies `showEyebrow ?? true` and `trimmed(eyebrow)`
  (no product fallback — the eyebrow is house wording, so `null` means "use the
  dictionary string").
- `src/schemas/landing.ts` — `showEyebrow` + `eyebrow` (max 60) in
  `newArrivalSchema`.
- `src/actions/admin/landing.ts` — carry both into the stored `settings` object.
- `src/components/admin/NewArrivalForm.tsx` — a switch + box, placed above the
  existing Title field, worded like its neighbours.
- `src/app/[locale]/page.tsx` — render
  `newArrival.eyebrow ?? dict.home.featured.eyebrow`, gated on
  `newArrival.showEyebrow`.
- No SQL migration (the `settings` `jsonb` column already accepts it, and
  0044's constraint names only the media keys).

## Implementation requirements

### 1. Unified language + country selector

- Trigger: a single `<button>` with `aria-expanded` / `aria-controls`, reading
  `EN · Egypt` (compact) with a `ChevronDown` (lucide, `strokeWidth={1.25}`)
  that rotates 180° on open, 300ms `ease-luxury-bezier`. Uppercase Latin labels
  keep `tracking-[0.2em]`; the Arabic label keeps `tracking-normal` and
  `dir="rtl"` — carry over `labelAttributes()` from `LanguageSwitcher.tsx`
  verbatim, it is a correctness rule, not a style.
- Panel: absolutely positioned under the trigger (`end-0`, logical properties
  so it mirrors under RTL), `ground-ivory`, 1px `--color-border` hairline,
  `shadow-2`, no radius beyond `rounded-none`/`sm`, opening with an
  opacity + `translateY(-6px)` transition on `--ease-luxury-bezier`; **no
  spring, no bounce**. Two labelled groups: Language (the two locales, as
  `next/link` to `localizePath(locale, path)` — keep the existing
  `stripLocale(pathname)` derivation so localisation is untouched) and Country
  (buttons; the countries list scrolls at `max-h-[46vh]` with
  `overscroll-contain`).
- Each country row shows the localised country name and its currency code, and
  the active one carries `aria-current="true"` plus the gold accent.
- Closes on outside click (`pointerdown` on `document`), on `Escape` (returning
  focus to the trigger), and on route change. Never traps focus — it is a
  menu, not a modal.
- `variant="full"` (drawer): same component, rendered inline and expanded in
  place rather than as an overlay panel, sized for the drawer's type scale.
- Inert until hydrated, exactly as `CurrencySwitcher` was: the trigger renders
  the language and a neutral country placeholder from the server snapshot and
  is `disabled` until `isHydrated`, so the header cannot reflow.
- Accessibility: `aria-label` on the trigger from `dict.regionSwitcher.label`,
  group headings as real `<p class="eyebrow">` + `aria-labelledby`.

### 2. Smart navbar

- `use-header-visibility.ts`:
  - single `scroll` listener, `{ passive: true }`, coalesced into one
    `requestAnimationFrame`;
  - hide only when `scrollY > REVEAL_FLOOR` (use `2 × 80px = 160`) **and** the
    downward delta since the last direction change exceeds `8px`; show on any
    upward delta `> 8px` or when `scrollY <= REVEAL_FLOOR`;
  - a `pointermove` listener (also passive) that shows the header when
    `event.clientY < 96` and `event.pointerType === "mouse"`; it is attached
    only while hidden, so a visible header costs no pointer work;
  - accepts a `forceVisible` argument — when `true` the hook reports visible and
    resets its baseline, so closing a menu at depth does not snap the bar away;
  - cleans up every listener; SSR-safe (no `window` access during render).
- `Nav.tsx` applies `translate-y-0` / `-translate-y-[calc(var(--header-h)+2px)]`
  with `transition-transform duration-500 ease-luxury-bezier will-change-transform`,
  and sets `document.documentElement.dataset.headerHidden` in an effect so the
  announcement bar can follow the same state from CSS.
- `forceVisible` = `activeMenu !== null || drawerOpen || searchOpen`.
- `@media (prefers-reduced-motion: reduce)` removes the transition (the state
  still changes, it simply does not animate).
- No element outside the fixed header changes: `--header-h` is constant, so
  the page's top padding, every sticky offset and the mega-menu's `top` are
  unaffected — there is no CLS surface.
- Mobile height: `--nav-h: 80px` at all widths; `h-20` on the bar and on the
  drawer's header row. Icon hit areas (44px) and paddings stay as they are.

### 3. Editable eyebrow

- Field label "Eyebrow", hint: "The small line above the title — e.g. 'New
  Arrival'. Empty uses the house wording." Max 60 characters, validated in Zod
  with the house's sentence-style message.
- `showEyebrow` defaults to `true`; hidden means the `<p class="eyebrow">` is
  not rendered at all (and its `mb-5` goes with it).
- Existing rows have neither key → `showEyebrow: true`, `eyebrow: null` →
  identical output to today. **No content loss.**

## Security requirements

- No new server surface. `updateNewArrival` keeps `requireAdmin()` first and
  Zod before the query; the two new fields are parsed by the same schema and
  written into the same `settings` object — no raw input reaches Postgres.
- The country code is untrusted input read from a cookie: it is only ever used
  as a key into `COUNTRY_CURRENCY` / `Intl.DisplayNames`, validated against the
  closed list before it is stored or displayed, never interpolated into a URL.
- Cookie is a first-party preference cookie, `SameSite=Lax`, no `HttpOnly`
  requirement (the client writes it), same one-year ceiling as the currency
  cookie, matching the published cookie policy's preference category.
- No `any`, no non-null assertions, strict TypeScript throughout.

## Acceptance criteria

- Footer no longer renders any currency/country control and its bottom bar
  still reads correctly at every width in both locales.
- The header shows one control reading language + country with a chevron;
  clicking opens a panel with both lists; picking Arabic navigates to the same
  page under `/ar` with the locale intact; picking a country updates every
  price on the page and survives a reload.
- Nav hides on scroll down, reappears on scroll up and on mouse-to-top;
  never hides with a menu, the drawer or search open; no content jump at any
  point; works on touch.
- Mobile navbar is 80px, matching desktop, with nothing clipped underneath.
- Admin → Content → Landing Page → New Arrival has an eyebrow switch + field
  that saves, reloads, and drives the storefront band; clearing it restores
  "New Arrival"; every other landing-page setting is untouched.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

## Manual test steps

1. `npm run dev`, open `/`.
2. Scroll down 400px — the bar (and the announcement bar, if enabled) slides
   away; scroll up a little — it returns. Move the mouse to the top edge while
   hidden — it returns. Confirm the page content never jumps.
3. Open a mega-menu, scroll — the bar stays. Close it, scroll down — it hides.
4. At 375px width: bar is 80px tall, drawer opens, its header row aligns, page
   content starts below the bar.
5. Click the header selector: pick العربية → lands on `/ar/...`, same page,
   RTL intact. Reopen, pick United Kingdom → prices switch to GBP, trigger
   reads `EN · United Kingdom`; reload and confirm it persists.
6. `/admin/content/landing` → New Arrival: type "Just Landed" in Eyebrow, save,
   reload `/` → band reads "Just Landed". Clear the field, save → band reads
   "New Arrival". Toggle the switch off → no eyebrow at all.
