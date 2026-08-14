# Auto-Location Pricing — Geo-Resolved Display Currency

## Goal

A visitor sees KHEM's prices in the currency of the country they are browsing
from, without asking for it, and can override that choice from the footer.

USD stays the **base and the settlement currency**: `priceInCents` in
`src/data/products.ts` is not touched, no catalog record gains a second price,
and every non-USD figure is a *converted display of the same USD amount*. This
is a presentation feature, and it is confined to the presentation layer.

## Skills read

None. The four Vercel-plugin skills the hooks proposed this session
(`workflow`, `ai-sdk`, `next-forge`, `routing-middleware`, `react-best-practices`)
were keyword matches, not topic matches — there is no AI, no durable workflow,
and no new middleware framework here. `AGENTS.md` §4 restricts skills to
`clerk`, `supabase`, `ai-sdk`, none of which this task touches. The one genuinely
external fact — the geolocation header contract — is Vercel's
`x-vercel-ip-country`, read directly rather than through a new dependency.

## Existing code inspected

| File | What it settled |
| :--- | :--- |
| `src/lib/format.ts` | `formatPrice(priceInCents)` is the single money formatter; `CURRENCY`/`LOCALE` are module constants. `formatConsentDate` already establishes the "locale-aware only where the copy is translated" rule. |
| `src/proxy.ts` | `clerkMiddleware` wrapping a locale rewrite. Returns from **three** places: the sign-in redirect, `NextResponse.next()` (prefixed locale), `NextResponse.rewrite()` (default locale). |
| `src/app/[locale]/layout.tsx` | `generateStaticParams()` prerenders both locale trees. Providers are mounted here: Clerk → Consent → Cart → Wishlist → I18n. |
| `src/providers/consent-provider.tsx`, `src/lib/persistent-store.ts`, `src/hooks/use-is-hydrated.ts` | The house pattern for browser-only state: module-level store in `useSyncExternalStore` shape, `getServerSnapshot` returns the empty value, `useIsHydrated()` gates anything that must not flash. |
| `src/lib/consent.ts`, `src/lib/storage.ts` | Versioned `khem.*.v1` key convention; stored values are untrusted and pass a type guard. |
| `src/data/legal.ts` (cookie-policy, `how-we-use-them`) | The published policy already says Preferences cookies "remember your region, currency…". This feature must not contradict the page. |
| 15 `formatPrice` call sites | Split ~half Server Components (`ProductCard`, `ArrivalShowcase`, `DiscoveryComparison`, `OrderCard`), ~half Client (`MerchCard`, `ProductPurchase`, `DiscoverySetCard`, `WishlistCard`, `StatGrid`, `SearchOverlay`, `CartSummary`, `CartLine`, `CartView`). Not all are JSX text nodes — `CartSummary` feeds `formatPrice` into `interpolate()` and into a `value` prop, `DiscoveryComparison` stores the result in a `cells[].value: string` data structure. |

## Decisions and assumptions

1. **Static prerender is preserved; the swap happens after hydration.**
   Reading `cookies()`/`headers()` in the layout would opt every price-bearing
   route out of static generation. Instead the server renders the USD base into
   the HTML — correct, cacheable, indexable — and a client provider re-formats
   once it has read the cookie. The cost is a brief USD → local transition on
   first paint, accepted deliberately in exchange for ISR and the §12 Lighthouse
   target.

2. **Detection in `src/proxy.ts` from `x-vercel-ip-country`.** The proxy already
   runs on every page request. It maps the country to a currency and writes the
   `khem.currency.v1` cookie **only when the cookie is absent** — so a manual
   override, written by the client, always outranks geo.

3. **The currency cookie is treated as essential/functional, and the policy is
   updated to say so.** It is set from the request itself, holds a three-letter
   code and no identifier, cannot track across sites, and is required to render
   the price the visitor asked to see. Gating it on the consent banner would mean
   nearly every first-time visitor sees USD, which defeats the feature. Because
   `src/data/legal.ts` currently files "currency" under *Preferences*, the policy
   table and the `what-cookies-we-set` copy are edited in the same change — the
   code and the published page must agree. **Flag for review at approval: this
   is a compliance judgement, not a purely technical one.**

4. **Rates are a curated static table in `src/lib/currency.ts`.** No network, no
   key, no failure path, deterministic between server and client. AED (3.6725)
   and SAR (3.75) are USD-pegged and effectively permanent; EGP, EUR, GBP are
   floating and carry a `RATES_REVIEWED` date constant plus a comment saying they
   are indicative and must be re-checked. Converted prices are rounded to a
   per-currency unit so a $295 bottle reads as a considered price, never
   `EGP 14,307.50`.

5. **Currencies: the core six.** USD (base), EGP, EUR, GBP, AED, SAR. Every
   other country falls back to USD — the fallback is the default, not an error.

6. **Digits stay Latin on both locale trees.** `formatPrice` keeps `en-US`
   number formatting and only the currency changes, consistent with the existing
   rule in `format.ts` that prices describe English-only catalog records. The
   Arabic tree gets an Arabic currency *name* in the switcher copy, not
   Arabic-Indic numerals in the price.

7. **Settlement disclosure.** Whenever the active currency is not USD, a line of
   translated micro-copy states that the price is an indicative conversion and
   the order is charged in USD. This appears in the buy block and the cart
   summary. Not doing this would be misleading, and it is cheap to do.

8. **No cross-tab sync.** Cookies fire no `storage` event, and a currency change
   in another tab is not worth a polling loop. Documented in the provider.

## Files likely to change

**New**

- `src/lib/currency.ts` — `Currency` union, the rate/rounding/symbol table, the
  country → currency map, `isCurrency` guard, `resolveCurrencyForCountry`,
  `convertFromUsdCents`, `CURRENCY_COOKIE` name, `CURRENCY_COOKIE_MAX_AGE`.
  Imports nothing from React or Next, so it is safe in the proxy, in Server
  Components, and in Client Components alike — the same constraint
  `src/lib/i18n/config.ts` documents.
- `src/lib/cookies.ts` — guarded `document.cookie` read/write, mirroring
  `storage.ts`: never throws, treats the value as untrusted, parses through a
  caller-supplied guard.
- `src/providers/currency-provider.tsx` — module-level store over the cookie in
  the `useSyncExternalStore` shape; `getServerSnapshot` returns `"USD"` so the
  server HTML and the hydration render agree. Exposes `useCurrency()` and
  `useFormatPrice()`.
- `src/components/ecommerce/Price.tsx` — `"use client"`, `<Price cents={…} />`,
  the unit Server Components render instead of calling `formatPrice`.
- `src/components/i18n/CurrencySwitcher.tsx` — the footer control.

**Modified**

- `src/lib/format.ts` — `formatPrice(priceInCents, currency = "USD")`; the
  default keeps every existing call compiling and keeps USD the base.
- `src/proxy.ts` — geo read + cookie write on all three response paths.
- `src/app/[locale]/layout.tsx` — mount `CurrencyProvider`.
- `src/components/Footer.tsx` — the switcher in the bottom bar.
- The 15 `formatPrice` call sites.
- `src/lib/i18n/dictionaries/en.ts`, `ar.ts` — switcher labels, currency names,
  the settlement note.
- `src/data/legal.ts` — cookie-policy disclosure.

## Implementation requirements

### `src/lib/currency.ts`

```ts
export const CURRENCIES = ["USD", "EGP", "EUR", "GBP", "AED", "SAR"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const BASE_CURRENCY: Currency = "USD";
```

One record per currency: `rate` (units per 1 USD), `roundToMinor` (the unit the
converted minor-unit amount snaps to), `fractionDigits`. Starting values —
pegged rates exact, floating rates indicative and dated:

| Currency | Rate | Round to | Digits |
| :--- | ---: | ---: | ---: |
| USD | 1 | 1 | 2 (dropped when whole) |
| EGP | 48.5 | 5000 (`EGP 50`) | 0 |
| EUR | 0.92 | 500 (`€5`) | 0 |
| GBP | 0.78 | 500 (`£5`) | 0 |
| AED | 3.6725 | 500 (`AED 5`) | 0 |
| SAR | 3.75 | 500 (`SAR 5`) | 0 |

- `convertFromUsdCents(cents, currency)` → minor units of the target,
  `Math.round(converted / roundToMinor) * roundToMinor`, and **never returns 0
  for a non-zero input** (a rounding unit must not erase a small amount — clamp
  to one rounding unit). Free shipping is a real `0` and must still convert to
  `0`.
- The country map covers the six: `EG→EGP`; the eurozone members KHEM ships to
  → `EUR`; `GB→GBP`; `AE→AED`; `SA→SAR`; everything else → `USD`. Country codes
  are untrusted request input: uppercase, validate against the map, fall back to
  `USD` on anything unrecognised.
- `isCurrency(value: unknown): value is Currency` for the cookie parse.

### `src/lib/format.ts`

`formatPrice(priceInCents: number, currency: Currency = BASE_CURRENCY)`:
converts, then formats with `Intl.NumberFormat("en-US", { style: "currency", currency, … })`.
Preserve the existing whole-amount rule for USD (`29500 → "$295"`); non-USD
currencies round to whole units by construction, so they carry no decimals.
Keep the module's existing doc-comment voice and extend the file header to say
that money now has a *display* currency distinct from its stored one.

### `src/proxy.ts`

- Add a `withCurrencyCookie(request, response)` helper called on each of the
  three returned responses, so a future fourth return cannot silently skip it.
- Read `request.cookies.get(CURRENCY_COOKIE)`. If present **and valid**, return
  untouched — the visitor's override wins. If present and invalid, overwrite it.
- Otherwise read `request.headers.get("x-vercel-ip-country")`, resolve, and
  `response.cookies.set` with `path: "/"`, `sameSite: "lax"`,
  `secure: process.env.NODE_ENV === "production"`, `httpOnly: false` (the client
  must read it), `maxAge: CURRENCY_COOKIE_MAX_AGE` (one year, matching the
  policy's twelve-month statement).
- Absent header (local dev, non-Vercel host): write nothing and let the client
  fall back. Do not fabricate a country.
- Extend the file's doc comment with a **## Currency detection** section in the
  established voice, including why this does *not* contradict the existing
  "there is deliberately no `Accept-Language` detection" paragraph: currency is
  a display transform of one price, not a second URL tree, so it fragments no
  cache and creates no crawler ambiguity.

### `src/providers/currency-provider.tsx`

- Module-level store: `getServerSnapshot()` → `"USD"`; `getSnapshot()` reads the
  cookie once, caches, and returns a referentially stable value.
- Client fallback when the cookie is absent (dev, or a non-Vercel host): resolve
  from `Intl.DateTimeFormat().resolvedOptions().timeZone` for the handful of
  zones that map to the six currencies, else `navigator.language`'s region
  subtag, else `USD`. Wrapped in try/catch; failure means `USD`.
- `setCurrency(next)` writes the cookie and emits, so the switcher and every
  price update in one pass.
- Expose `{ currency, setCurrency, isHydrated, formatPrice }` where `formatPrice`
  is bound to the active currency — client components call that instead of
  importing the raw formatter, which is what stops a call site from silently
  rendering USD forever.
- Mount inside `I18nProvider` in the layout (it needs no dictionary, but the
  switcher does).

### Call sites

- Server Components → `<Price cents={product.priceInCents} />`.
- Client Components → `const formatPrice = useFormatPrice()`, same call shape as
  today.
- `DiscoveryComparison` — the price row currently stores a formatted `string` in
  `cells[].value`. Either widen that cell to a `kind: "price"` carrying the
  cents, or let `value` be `React.ReactNode` and hold a `<Price>`. Prefer the
  `kind: "price"` variant: it keeps the data structure data and the formatting
  in the renderer.
- `CartSummary` — `interpolate(dict.cart.freeShippingNudge, { amount })` needs a
  string, so it uses the hook, not the component.
- After the sweep, **no component outside `Price.tsx` and the provider may
  import `formatPrice` from `src/lib/format` directly.** Verify with a grep.

### `CurrencySwitcher`

- A `<select>` styled to the house language, or a small popover list matching
  `LanguageSwitcher`'s tracking and gold/ivory states — no new visual idiom.
  Reuse `LanguageSwitcher`'s `labelAttributes` reasoning: never letter-space
  Arabic labels.
- Renders `null`, or the base currency inert, until `isHydrated` — it must not
  claim a detected currency the server never rendered.
- Placed in the footer bottom bar beside the legal links / `CookieSettingsButton`
  row, keeping the three-part `md:flex-row` bar intact at every breakpoint.
- Labelled `aria-label` from the dictionary; the active option marked
  `aria-current` (or `selected`), matching `LanguageSwitcher`.

### Visual requirements

- Price typography is unchanged — `font-heading`, existing sizes and gold tones.
  This feature must be invisible except for the symbol.
- Add `tabular-nums` to price spans so the post-hydration swap and any quantity
  change do not jiggle the surrounding layout.
- The USD → local transition gets **no** fade or animation. A price that animates
  reads as a price that is changing; it is the same price. Instant swap.
- The settlement note: `text-[10px] tracking-[0.05em] text-ivory/25`, matching
  `dict.cart.taxNote`'s existing treatment directly above it.
- RTL: the switcher sits in the same flex bar that already flips; verify the
  Arabic footer at `sm`, `md`, and `lg`.

## Security requirements

- `x-vercel-ip-country` is untrusted (a client can send it to a non-Vercel
  origin). It is only ever used as a **key into a fixed map**, never
  interpolated, never used to build a URL or a redirect.
- The cookie value is untrusted on the way back in: parsed through `isCurrency`
  before use, on both the proxy and the client side. An unrecognised value
  resolves to `USD`, never throws.
- `httpOnly: false` is required and acceptable: the value is a three-letter
  display preference with no security or identity meaning. It must never be
  extended to carry anything else.
- No IP address, no coarse location, and no country code is stored, logged, or
  sent anywhere. Only the derived currency code is persisted.
- Prices remain server-authoritative in USD. When checkout lands, the Stripe
  amount is computed from `priceInCents`, never from the client's displayed
  currency — the display layer must never become a pricing input.

## Acceptance criteria

- [ ] A visitor with `x-vercel-ip-country: EG` sees EGP; `AE` sees AED; `US`,
      `JP`, and an absent header all see USD.
- [ ] Choosing a currency in the footer persists across reload **and** overrides
      geo on the next request.
- [ ] The prerendered HTML for `/perfumes` and `/ar/perfumes` still contains USD
      prices, and `next build` still reports both locale trees as static.
- [ ] No hydration mismatch warning in the console on any price-bearing route.
- [ ] Cart subtotal, shipping, free-shipping nudge, and total all move to the
      selected currency together — no mixed-currency summary is possible.
- [ ] Free shipping still renders as "Complimentary", not as a converted zero.
- [ ] The settlement note appears in the buy block and cart summary when the
      currency is not USD, and is absent when it is.
- [ ] The cookie policy page names the currency cookie and its category, and the
      code matches what the page says.
- [ ] `grep -rn "from \"@/src/lib/format\"" src` shows no `formatPrice` import
      outside `Price.tsx` and the provider.
- [ ] Zero `any`; `npx tsc --noEmit` and `npm run lint` clean.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build     # confirm the [locale] trees are still prerendered
```

## Manual test steps

1. `npm run dev`, open `/perfumes` → prices in USD (no geo header locally).
2. Simulate geo without deploying — temporarily read a `?country=EG` search
   param alongside the header in the proxy, or set the cookie by hand:
   `document.cookie = "khem.currency.v1=EGP;path=/"` in the console, then
   reload → every price on the page is EGP, rounded to whole EGP 50.
3. Add two items to the bag, open `/cart` → subtotal, shipping, nudge, and total
   are all EGP; the free-shipping threshold behaves the same as in USD.
4. Switch to GBP in the footer → prices update without a reload; reload → GBP
   persists; open `/ar/cart` → still GBP, footer bar laid out correctly RTL.
5. Clear the cookie, hard-reload with the network throttled to Slow 3G → the
   first paint is USD and the swap is a single instant change, no flicker loop.
6. Switch back to USD → the settlement note disappears from the cart summary.
7. `npm run build && npm start`, confirm `/perfumes` is served from the static
   output and the swap still happens.
