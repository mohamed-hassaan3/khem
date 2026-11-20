# Region switcher — a visible "Current" marker and one row per currency

## Goal

In the header language/country switcher (`LocaleRegionSwitcher`):

1. Mark the active country row **and** the active language row with a visible
   word — "Current" / "حاليًا" — not colour alone.
2. Replace the 25-row country list (24 priced countries + International) with
   **six rows, one per display currency**: Egypt, Saudi Arabia, UAE, UK,
   Europe, International.

The switcher controls only the display currency. Shipping is Egypt-only and
checkout never reads the chosen country, so the list should offer exactly the
six outcomes that exist and nothing that implies more.

## Skills read

- `AGENTS.md` (design tokens, RTL rules, workflow).
- No Clerk / Supabase / AI SDK surface is touched, so none of those skills apply.

## Existing code inspected

- `src/components/i18n/LocaleRegionSwitcher.tsx` — the trigger and panel;
  builds the country list from `PRICED_COUNTRIES`, names it with
  `Intl.DisplayNames`, sorts by collator, appends International. Active row is
  `text-ground-accent` + `aria-current` only.
- `src/lib/currency.ts` — `COUNTRY_CURRENCY` (EG, GB, AE, SA + 20 eurozone),
  `PRICED_COUNTRIES`, `INTERNATIONAL = "INTL"`, `isRegion`,
  `currencyForRegion`, `representativeCountry`, `COUNTRY_COOKIE`.
- `src/providers/currency-provider.tsx` — region store reads
  `COUNTRY_COOKIE` via `readCookie(COUNTRY_COOKIE, isRegion, null)`;
  `commitRegion` writes the cookie and commits `currencyForRegion(next)`.
  `setCurrency` has no callers outside the provider.
- `src/proxy.ts` — geo detection uses `resolveCurrencyForCountry` on the
  country header. **Unchanged by this work.**
- `src/lib/shipping.ts`, `src/constants/countries.ts` — checkout country list;
  independent of the switcher. **Unchanged.**
- `src/lib/i18n/dictionaries/en.ts` / `ar.ts` — `regionSwitcher` block.
- `src/components/Nav.tsx` — renders the switcher `compact` (desktop rail,
  line ~617) and `full` (mobile drawer, line ~903).

## Audit findings this fixes

- 20 of 25 country rows are eurozone countries with an identical outcome (EUR).
- A visitor detected in the eurozone who has not chosen a region sees "Europe"
  on the trigger but **no row is marked current**, because no Europe row exists
  (`activeRegion` is `null`).
- The active state is colour-only.

## Decisions

- **Regions are a fixed, ordered list of six**, not derived from
  `COUNTRY_CURRENCY`:
  `EG → EGP`, `SA → SAR`, `AE → AED`, `GB → GBP`, `EUROPE → EUR`,
  `INTL → USD`. Order is deliberate (home market, Gulf, UK, Europe,
  everyone else) and is **not** re-sorted by locale.
- **Europe is a sentinel, `"EUROPE"`**, like `INTERNATIONAL`. Not `EU` (the
  module already refuses `EU` as a claim, and it is an ISO-reserved code that
  would collide with the checkout's `NOT_COUNTRIES`).
- **Legacy cookies migrate on read.** A stored eurozone code (`FR`, `DE`, …)
  reads back as `EUROPE`. A legacy value is not rewritten in the cookie until
  the visitor next chooses; reading it as Europe is enough.
- **Geo detection is untouched.** `COUNTRY_CURRENCY`, `resolveCurrencyForCountry`,
  the proxy and the browser timezone fallback keep working on real country codes.
- **"Current" means "what prices are in now"**, whether chosen or detected. No
  separate "Detected" wording.
- **Arabic marker is "حاليًا"** — gender-neutral, so it reads correctly after
  "مصر", "أوروبا" and "دولي" alike.
- Country names still come from `shortNames` → `Intl.DisplayNames` (short) →
  long, as today. Europe and International come from the dictionary.

## Files likely to change

- `src/lib/currency.ts`
- `src/providers/currency-provider.tsx`
- `src/components/i18n/LocaleRegionSwitcher.tsx`
- `src/lib/i18n/dictionaries/en.ts`
- `src/lib/i18n/dictionaries/ar.ts`

No schema, route, proxy, or checkout changes.

## Implementation requirements

### `src/lib/currency.ts`

- Add `export const EUROPE = "EUROPE";` with a doc comment matching the
  `INTERNATIONAL` one (a region, not a country; deliberately not `EU`).
- Add `export const SWITCHER_REGIONS: readonly Region[] = ["EG", "SA", "AE", "GB", EUROPE, INTERNATIONAL];`
  documented as the switcher's closed, ordered list — one row per currency.
- `isRegion(value)` → true only for members of `SWITCHER_REGIONS`.
- Add `normalizeRegion(value: unknown): Region | null`:
  - a `SWITCHER_REGIONS` member → itself;
  - a string whose `resolveCurrencyForCountry` is `EUR` (any legacy eurozone
    code) → `EUROPE`;
  - anything else → `null`.
- `currencyForRegion`: `INTERNATIONAL → FALLBACK_DISPLAY_CURRENCY`,
  `EUROPE → "EUR"`, otherwise `resolveCurrencyForCountry(region)`.
- `representativeCountry` → rename-free change: return `EUROPE` for `"EUR"`
  (update its doc comment; it now returns a region, still `null` for USD).
- Remove `PRICED_COUNTRIES` if nothing else imports it after the switcher
  change (verify with grep); otherwise leave it.

### `src/providers/currency-provider.tsx`

- `loadRegion()` reads the raw cookie and passes it through `normalizeRegion`.
  Use `readCookie` with a guard that accepts any string, then normalise —
  `isRegion` alone would discard legacy `FR`/`DE` values. Check
  `src/lib/cookies.ts` for the exact `readCookie` signature before writing this.
- Update the region doc comments that mention "Europe" being label-only.

### `src/components/i18n/LocaleRegionSwitcher.tsx`

- Build rows from `SWITCHER_REGIONS` in order: `{ code, name, currency }`.
  Names: `EUROPE → dictionary.regionSwitcher.europe`,
  `INTERNATIONAL → dictionary.regionSwitcher.international`, countries via the
  existing name resolver. **Drop the collator sort.**
- Remove the separate hard-coded International button; it is now a row of
  the same map.
- `activeRegion = region ?? representativeCountry(currency) ?? INTERNATIONAL`
  — never `null`, so exactly one country row is always current after hydration.
- `regionLabel` (trigger) = the active row's name.
- **Current marker**, on country rows and language rows:
  - Rendered only when the row is active (and, for country rows, only once
    `isHydrated` — before hydration no row is current, matching the trigger's
    em-dash).
  - Markup: after the name, inside the same leading group:
    `<span aria-hidden="true"> · </span><span>{dictionary.regionSwitcher.current}</span>`
    — the middle dot hidden from AT; the word itself is read.
  - Style: `text-[9px] text-ground-subtle`; English `uppercase tracking-[0.15em]`;
    Arabic `tracking-normal` with no uppercase. Use the reading locale
    (`activeLocale`), not the row's locale, for the marker's language and
    styling — the marker is chrome in the page's language.
  - Keep `aria-current="true"` and the gold `ROW_ACTIVE` colour.
  - Row layout: name + marker grouped at the start, currency code at the end,
    unchanged `justify-between`. The marker must not wrap the currency code
    onto a new line at `w-64`.
- Remove the scroll container's `max-h-[46vh] overflow-y-auto overscroll-contain`
  (six rows need no scroll); keep the `role="group"` + `aria-label` wrapper.
  Update the comment that explains the scroll.
- Update the file's header comment: one row per currency, why, and the Europe
  sentinel. Remove claims about "24 names" / collation of the list.

### Dictionaries

- `en.ts` `regionSwitcher`: add `current: "Current"`.
- `ar.ts` `regionSwitcher`: add `current: "حاليًا"`.
- `europe` comment in `en.ts`: it is now a row label, not only a pre-choice
  fallback.

## Visual interpretation

- Panel width, padding, eyebrows, divider, fonts and motion unchanged.
- Row reads (EN): `Egypt · CURRENT ............ EGP`
- Row reads (AR, RTL): `مصر · حاليًا ............ EGP` (currency code stays an
  LTR island, as today).
- Marker is quieter than the name (smaller, subtle colour); the name stays gold
  when active. No new colours, no badges, no borders, no icons.
- Panel height shrinks (6 country rows + 2 language rows) — no scrollbar on
  desktop or a 375px phone.

## Security requirements

- Cookie values remain untrusted: `normalizeRegion` only ever uses the value
  as a key into fixed tables; anything unknown → `null`. Never interpolate it.
- No new cookies, no change to cookie lifetime or attributes.

## Acceptance criteria

- Country section shows exactly six rows in the fixed order, in both locales.
- Exactly one country row and one language row show the "Current"/"حاليًا"
  marker after hydration, including for a visitor with no country cookie and a
  detected EUR currency (Europe is current).
- Choosing a row sets the currency as before; the trigger label follows.
- A browser holding `khem.country.v1=FR` shows Europe as current with EUR prices.
- A browser holding a garbage country cookie behaves as "no choice".
- Arabic marker and labels have no letter-spacing; Latin ones keep tracking.
- Mobile drawer (`variant="full"`) shows the same rows and markers.
- Proxy detection, checkout country field and prices unchanged.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `grep -rn PRICED_COUNTRIES src` — no dangling imports.

## Manual test steps (after implementation)

1. `npm run dev`, open `http://localhost:3000`, clear cookies for localhost.
2. Open the header switcher: six country rows in order Egypt, Saudi Arabia,
   UAE, UK, Europe, International; one marked "· CURRENT" (from timezone
   detection — Egypt if your device is on `Africa/Cairo`); "English · CURRENT".
3. Pick UK → trigger reads `EN · UK`, prices switch to GBP, reopen → UK marked current.
4. Pick Europe → EUR prices, Europe marked current.
5. DevTools → Application → Cookies: set `khem.country.v1` to `DE`, reload →
   Europe current, EUR. Set it to `XX`, reload → falls back to detection.
6. Delete `khem.country.v1`, set `khem.currency.v1=EUR`, reload → trigger says
   Europe and the Europe row is marked current (previously nothing was).
7. Switch to Arabic (`/ar`) → markers read "حاليًا", no letter-spacing, currency
   codes stay LTR, panel anchored correctly on the RTL side.
8. Narrow to 375px, open the mobile menu → same six rows and markers, no
   inner scrollbar, no wrapped currency codes.
9. Go through to `/checkout` → country field behaves exactly as before.
