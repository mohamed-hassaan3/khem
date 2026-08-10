# Internationalization — English (default) + Arabic

## Goal

Add a cross-app internationalization system to KHEM supporting two locales: **English (`en`, default)** and **Arabic (`ar`)**, addressed via URL segment routing — English stays at `/*` with no prefix, Arabic lives at `/ar/*`. Ship full RTL support, locale-appropriate typography, locale-aware metadata/hreflang, and a `<LanguageSwitcher />` in the navigation.

Scope this pass: **infrastructure + UI chrome**. Navigation, footer, buttons, form labels, section headings, and page-level headings/eyebrows get real Arabic translations. The long editorial and legal bodies in `src/data/content.ts` and `src/data/legal.ts` stay English-only for now — the type structure must be ready to receive Arabic later without a rewrite.

## Skills read

- `node_modules/next/dist/docs/` — App Router routing, dynamic segments as root layout, `generateStaticParams`, `generateMetadata`, middleware rewrites, `next/font` variables, `global-not-found`.
- No Clerk / Supabase / AI SDK involvement in this task. The auto-suggested `ai-sdk` and `chat-sdk` skills are not relevant and were deliberately not read.

## Existing code inspected

- `src/app/layout.tsx` — root layout, hardcoded `<html lang="en">`, full `Metadata` export, mounts `Nav` + `Footer`.
- `src/app/*/page.tsx` — 12 routes: `/`, `/about`, `/contact`, `/cookie-policy`, `/craftsmanship`, `/heritage`, `/ingredients`, `/journal`, `/privacy-policy`, `/return-exchange`, `/terms-conditions`, plus `not-found.tsx`.
- `src/components/Nav.tsx` — client component; drawer + two mega menus; heavy directional CSS (`-ml-2.5`, `left-0`, `-translate-x-full`, `justify-end`); hardcoded strings ("Collections", "The World of KHEM", "Stockists", "Menu", "Discover", "Boutique", "Featured", "Quick Access", "New Arrival", "Search", "Wishlist", "Account", "Close menu", "Open menu").
- `src/components/Footer.tsx` — server component; hardcoded link labels, section headings, brand blurb, boutique address, copyright, "Crafted with reverence in Cairo".
- `src/constants/navigation-pages.ts` — `collections` and `world` arrays currently store **display strings** (`label`, `desc`) alongside `path`. These must become translation keys.
- `src/app/globals.css` — Tailwind v4 `@theme` tokens; `@layer components` with directional rules in `.mega-menu` (`left/right`), `.nav-link::after` (`left: 0`), `.section-divider`, `.gold-line`.
- `src/lib/fonts.ts` — `Cinzel` (heading) and `Inter` (body) via `next/font/google`, exposed as `--font-heading` / `--font-body`.
- `src/data/*.ts`, `src/services/*.ts`, `src/types/*.ts` — content layer. Untouched this pass except where a display string leaks into UI chrome.
- No `middleware.ts` exists. No i18n dependency is installed; `package.json` deps are only `lucide-react`, `motion`, `next`, `react`, `react-dom`.

## Decisions and assumptions

1. **No i18n library.** With exactly two locales and a UI-chrome dictionary, `next-intl` earns its config surface only at larger scale. Build a ~150-line typed dictionary system instead, keeping the dependency list at zero additions and matching the project's existing hand-rolled `src/lib` conventions. If a third locale or ICU pluralization/date formatting is ever needed, this can be swapped for `next-intl` without changing the route structure.
2. **`as-needed` prefix strategy.** English keeps its current URLs (`/heritage`), so no existing link or indexed URL breaks. Arabic is prefixed (`/ar/heritage`). A middleware rewrite maps unprefixed requests to the internal `/en/*` tree.
3. **No automatic `Accept-Language` redirect.** Auto-redirecting on browser language fragments the CDN cache, surprises users who deliberately opened an English link, and confuses crawlers. Locale changes only through explicit user action on the switcher.
4. **Switcher does not preserve query strings.** Reading `useSearchParams()` in the layout-level Nav would force every statically prerendered page into a client-side bailout. The switcher maps pathname only. Acceptable today (no route uses query params); revisit when filters land on `/perfumes`.
5. **Arabic typography.** Cinzel and Inter have no Arabic glyphs. Use **Amiri** for Arabic headings (classical Naskh, the closest luxury-editorial match to Cinzel's register) and **IBM Plex Sans Arabic** for Arabic body. Declare them under the *same* CSS variable names (`--font-heading` / `--font-body`) and mount only the active locale's font variables, so no CSS rule changes and English visitors never download Arabic fonts.
6. **Two consumption paths.** Server components call `getDictionary(locale)` directly. Client components read from an `I18nProvider` context via `useI18n()`. The dictionary is UI chrome only, so serializing it into the RSC payload is cheap.
7. **`ar` dictionary is type-locked to `en`.** `Dictionary = typeof en` and `const ar: Dictionary` — a missing Arabic key is a compile error, not a runtime fallback.
8. **Assumption:** the boutique address ("New Cairo, Cairo, Egypt") and the brand name "KHEM" are transliterated, not translated — "خِم" is used for the brand in Arabic body copy but the logo image stays as-is.

## Files likely to change

**New**

```
src/middleware.ts
src/lib/i18n/config.ts
src/lib/i18n/get-dictionary.ts
src/lib/i18n/dictionaries/en.ts
src/lib/i18n/dictionaries/ar.ts
src/providers/i18n-provider.tsx
src/components/i18n/LanguageSwitcher.tsx
src/components/i18n/LocaleLink.tsx
src/app/global-not-found.tsx
```

**Moved** — every route file from `src/app/<route>/` into `src/app/[locale]/<route>/`, and `src/app/layout.tsx` → `src/app/[locale]/layout.tsx` (which becomes the root layout). `src/app/globals.css`, `src/app/favicon.ico`, `src/app/opengraph-image.png` and any other root-level metadata files stay at `src/app/`.

**Modified**

```
src/app/[locale]/layout.tsx          (html lang/dir, fonts, provider, metadata)
src/app/[locale]/**/page.tsx         (12 pages: locale params, dictionary, LocaleLink)
src/app/[locale]/not-found.tsx
src/app/globals.css                  (logical-property conversion)
src/lib/fonts.ts                     (Arabic font declarations)
src/constants/navigation-pages.ts    (labels → translation keys)
src/components/Nav.tsx
src/components/Footer.tsx
src/components/contact/ContactForm.tsx
src/components/home/NewsletterForm.tsx
src/components/home/*.tsx, src/components/journal/*.tsx,
src/components/ingredients/*.tsx, src/components/legal/*.tsx,
src/components/ecommerce/ProductCard.tsx   (directional classes + chrome strings)
```

## Implementation requirements

### 1. Locale config — `src/lib/i18n/config.ts`

```ts
export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
```

Also export:

- `LOCALE_DIRECTION: Record<Locale, "ltr" | "rtl">`
- `LOCALE_LABELS: Record<Locale, string>` — `{ en: "English", ar: "العربية" }` (each label in its own language, never translated)
- `LOCALE_SHORT_LABELS: Record<Locale, string>` — `{ en: "EN", ar: "ع" }` for the compact switcher
- `LOCALE_HTML_TAG: Record<Locale, string>` — `{ en: "en", ar: "ar" }`
- `OG_LOCALE: Record<Locale, string>` — `{ en: "en_US", ar: "ar_EG" }`
- `isLocale(value: string): value is Locale`
- `localizePath(locale: Locale, path: string): string` — returns `path` unchanged for `en`; returns `/ar${path}` for `ar`, normalising `/` → `/ar` and never double-prefixing.
- `stripLocale(pathname: string): { locale: Locale; path: string }` — inverse of the above, used by the switcher.

No `any`. All exports strictly typed.

### 2. Dictionaries — `src/lib/i18n/dictionaries/`

`en.ts` exports `const en = { ... } as const` and `export type Dictionary = typeof en`. `ar.ts` exports `const ar: Dictionary = { ... }`.

Namespace the keys — do not build a flat string map:

| Namespace | Contents |
| :--- | :--- |
| `common` | `readMore`, `discover`, `explore`, `shopNow`, `viewAll`, `learnMore`, `back`, `close`, `loading`, `comingSoon` |
| `nav` | `collections`, `worldOfKhem`, `stockists`, `menu`, `discover`, `boutique`, `featured`, `quickAccess`, `newArrival`, `ourCollections`, `search`, `wishlist`, `account`, `openMenu`, `closeMenu` |
| `nav.collectionItems` | keyed by collection slug — `signature`, `noir`, `discovery`, `bodyCare`, `roomFragrance`, each `{ label, desc }` |
| `nav.worldItems` | keyed — `heritage`, `craftsmanship`, `ingredients`, `journal`, `about`, each `{ label }` |
| `nav.quickAccess` | `newArrivals`, `bestSellers`, `giftSets`, `limitedEditions` |
| `footer` | `brandBlurb`, `collections`, `worldOfKhem`, `myAccount`, `boutique`, `boutiqueAddress`, `rights`, `craftedIn`, plus account/legal link labels |
| `home` | eyebrows, section headings, and CTA labels on `/` |
| `pages` | per-route `{ title, description, eyebrow, heading }` for the 11 non-home routes |
| `forms` | `name`, `email`, `subject`, `message`, `send`, `sending`, `subscribe`, `newsletterPlaceholder`, `required`, `invalidEmail`, `successMessage`, `errorMessage` |
| `notFound` | `eyebrow`, `heading`, `body`, `cta` |
| `languageSwitcher` | `label` (aria-label, e.g. "Change language" / "تغيير اللغة") |

Arabic strings must be real, natural Modern Standard Arabic in a luxury editorial register — not transliteration and not literal word-for-word rendering. Use Arabic-Indic punctuation where correct (`،` comma, `؟` question mark).

### 3. Dictionary loader — `src/lib/i18n/get-dictionary.ts`

```ts
const loaders = {
  en: () => import("./dictionaries/en").then((m) => m.en),
  ar: () => import("./dictionaries/ar").then((m) => m.ar),
} satisfies Record<Locale, () => Promise<Dictionary>>;

export async function getDictionary(locale: Locale): Promise<Dictionary> { ... }
```

Server-only usage. Falls back to `DEFAULT_LOCALE` for an unrecognised input rather than throwing.

### 4. Middleware — `src/middleware.ts`

- If the pathname starts with `/ar` (exactly `/ar` or `/ar/...`), pass through untouched.
- Otherwise, rewrite to `/en${pathname}` (`/` → `/en`).
- Matcher must exclude `_next`, `/api`, and static asset extensions — reuse the shape of the matcher in `AGENTS.md` §10.1 so it stays compatible when Clerk middleware is layered in later.
- **Rewrite, never redirect** — the visible URL must not change.
- No cookie writing, no `Accept-Language` sniffing.

### 5. Route restructure

Move all route directories under `src/app/[locale]/`. `src/app/[locale]/layout.tsx` becomes the root layout (owns `<html>` and `<body>`); delete `src/app/layout.tsx`. Verify against `node_modules/next/dist/docs/` that a dynamic segment may host the root layout in Next 16 and that `global-not-found.tsx` is the correct escape hatch for requests that never match a locale segment — do not guess this API, read it.

`src/app/[locale]/layout.tsx` must:

- Type params as `Promise<{ locale: string }>` and `await` them (Next 16 async params).
- `export function generateStaticParams()` returning `LOCALES.map((locale) => ({ locale }))` so both trees still prerender.
- Validate the segment with `isLocale()`; call `notFound()` on anything else.
- Set `<html lang={LOCALE_HTML_TAG[locale]} dir={LOCALE_DIRECTION[locale]}>`.
- Mount only the active locale's font variable classes.
- Wrap children in `<I18nProvider locale={locale} dictionary={dict}>`.
- Keep `Nav` and `Footer` mounted exactly where they are today.
- Replace the static `metadata` export with `generateMetadata({ params })`, preserving **every** field currently in `src/app/layout.tsx` (icons, manifest, robots, appleWebApp, formatDetection, themeColor, twitter, keywords, authors…) while making locale-dependent: `title`, `description`, `openGraph.locale`, `openGraph.url`, `alternates.canonical`, and adding:

```ts
alternates: {
  canonical: localizePath(locale, "/"),
  languages: { en: "/", ar: "/ar", "x-default": "/" },
}
```

Arabic `keywords` should include Arabic search terms, not a copy of the English array.

### 6. Provider and hooks — `src/providers/i18n-provider.tsx`

`"use client"`. Context holds `{ locale, dir, dictionary }`. Export:

- `I18nProvider`
- `useI18n()` — returns the full context; throws a clear error outside the provider
- `useLocale()`, `useDir()`, `useDictionary()` convenience hooks

### 7. `<LocaleLink />` — `src/components/i18n/LocaleLink.tsx`

`"use client"` wrapper over `next/link` that prefixes internal `href`s via `localizePath(useLocale(), href)`. Passes through external (`http`, `mailto:`, `tel:`, `#`) hrefs untouched. Props extend `ComponentProps<typeof Link>` with `href: string`. Replace **every** internal `next/link` usage in `Nav`, `Footer`, and all pages/components with it, so Arabic navigation never escapes the `/ar` tree.

### 8. `<LanguageSwitcher />` — `src/components/i18n/LanguageSwitcher.tsx`

`"use client"`. Behaviour:

- `stripLocale(usePathname())` to get the current path, then render one `<Link>` per locale to `localizePath(target, path)`.
- Uses raw `next/link` (not `LocaleLink`) — it computes absolute targets itself.
- Each link carries `hrefLang={LOCALE_HTML_TAG[target]}` and `lang` set to the target locale so screen readers pronounce "العربية" correctly.
- The active locale renders as non-interactive (`aria-current="true"`, `pointer-events-none`), not as a link to itself.
- Wrapped in `<nav aria-label={dict.languageSwitcher.label}>`.

Visual spec (design system §3.2):

- Two labels separated by a 1px hairline in `--color-border`: `EN` `|` `ع` on the compact desktop rail, full `English` / `العربية` in the mobile drawer.
- `font-body`, `text-[10px]`, `uppercase`, `tracking-[0.2em]` for the Latin label; the Arabic label drops `uppercase` and uses `tracking-normal` (letter-spacing breaks Arabic joined script — this is mandatory, not cosmetic).
- Inactive: `text-ivory/40`. Hover: `text-gold`, `transition-colors duration-300 ease-luxury-bezier`. Active: `text-gold`.
- No dropdown, no chevron, no rounded pill — two flat labels.

Placement: in the desktop right-hand icon cluster of `Nav`, before the search icon, separated by the same `gap-5 sm:gap-7` rhythm; and as its own section at the bottom of the mobile drawer under a `gold-line` divider with an `eyebrow` label.

### 9. RTL

Convert directional styling to logical properties across the app.

In `src/app/globals.css`:

- `.mega-menu` — `left: 0; right: 0` → `inset-inline: 0`.
- `.nav-link::after` — `left: 0` → `inset-inline-start: 0`.
- Audit `.gold-line`, `.section-divider`, `.grain`, `.btn-luxury`, `.note-pill` for direction-sensitive rules; symmetric gradients need no change.
- Add a scoped rule so `.eyebrow` and other `tracking-[0.2em]`-class utilities do not letter-space Arabic:
  ```css
  [dir="rtl"] .eyebrow,
  [dir="rtl"] .nav-link,
  [dir="rtl"] .btn-luxury {
    letter-spacing: 0;
  }
  ```

In components, replace physical Tailwind utilities with logical ones: `ml-`/`mr-` → `ms-`/`me-`, `pl-`/`pr-` → `ps-`/`pe-`, `left-`/`right-` → `start-`/`end-`, `text-left`/`text-right` → `text-start`/`text-end`, `border-l`/`border-r` → `border-s`/`border-e`, `rounded-l`/`rounded-r` → `rounded-s`/`rounded-e`.

Transforms are not automatically mirrored — handle explicitly:

- `Nav` drawer: `left-0` → `start-0`, `border-r` → `border-e`, and `-translate-x-full` → `-translate-x-full rtl:translate-x-full`.
- Any `translate-x` used for hover slides or carousel motion in `TestimonialCarousel`, `IngredientExplorer`, `JournalGrid`, `ProductCard` must get an `rtl:` counterpart.
- Lucide chevrons/arrows that imply direction get `rtl:rotate-180`.
- The `Reveal` animation is vertical (`translateY`) — no change needed.

Numbers, prices, and dates stay in Western Arabic numerals for both locales (`src/lib/format.ts` unchanged this pass).

### 10. Navigation constants refactor

`src/constants/navigation-pages.ts` currently stores display copy. Restructure to key + path only:

```ts
export const collections = [
  { key: "signature", path: "/collections/signature" },
  { key: "noir", path: "/collections/noir" },
  { key: "discovery", path: "/discovery" },
  { key: "bodyCare", path: "/body-care" },
  { key: "roomFragrance", path: "/room-fragrance" },
] as const;
```

Type the keys so `dict.nav.collectionItems[item.key]` is exhaustively checked. Same for `world`. Update `Nav.tsx` and `Footer.tsx` accordingly — `Footer`'s `label === "Journal" ? "The Journal" : label` special case is replaced by a dedicated dictionary key.

### 11. Page updates

Each of the 12 pages must:

- Accept `params: Promise<{ locale: string }>`, await it, and pass the locale down where needed.
- Use `getDictionary(locale)` for its own chrome strings (eyebrow, heading, CTA labels).
- Export `generateMetadata` producing locale-aware `title`/`description` plus `alternates.languages` pointing at both locale variants of *that* route.
- Keep the long-form editorial body coming from `src/data/*` in English for both locales — **do not** stub, truncate, or machine-translate it in this pass.
- Where a page renders an English editorial block inside an Arabic layout, wrap that block with `dir="ltr" lang="en"` so bidirectional text does not scramble punctuation and list markers. This is required, not optional.

## Security requirements

- The `locale` route param is untrusted input. Validate it with `isLocale()` before it reaches `<html lang>`, `dir`, metadata, or the dictionary loader; call `notFound()` otherwise. Never interpolate a raw param into markup.
- The middleware must not build its rewrite target from unvalidated user input in a way that permits path traversal or open redirect — construct the rewrite via `new URL(..., request.url)` and rewrite only to same-origin internal paths.
- `stripLocale` / `localizePath` must reject or normalise absolute URLs and protocol-relative (`//evil.com`) values so the switcher can never produce an off-site link from a crafted pathname.
- No secrets, no network calls, no new dependencies introduced.

## Acceptance criteria

- [ ] `/`, `/heritage`, `/journal`, and every other existing English URL renders identically to before — same markup, same copy, no redirect, no visible URL change.
- [ ] `/ar` and `/ar/<every route>` render in Arabic chrome with `<html lang="ar" dir="rtl">`.
- [ ] `<html lang>` and `dir` are correct for both trees; English pages remain `lang="en" dir="ltr"`.
- [ ] The language switcher appears in the desktop nav and the mobile drawer, preserves the current route when switching, and marks the active locale as non-interactive.
- [ ] Every internal link inside `/ar` stays inside `/ar`; no link silently drops the visitor into English.
- [ ] Arabic pages use Amiri headings and IBM Plex Sans Arabic body; English pages load no Arabic font files (verify in the network panel).
- [ ] No letter-spacing is applied to Arabic text anywhere.
- [ ] The mobile drawer slides in from the **right** in Arabic and from the left in English; the mega menus and nav underline are correctly mirrored.
- [ ] Every page emits `alternates.languages` with both `en` and `ar` plus `x-default`.
- [ ] Both locale trees are statically prerendered (`generateStaticParams` present; build output shows `●`/`○` for both, not `ƒ` for all).
- [ ] An unknown locale segment such as `/fr/heritage` renders the not-found page rather than crashing or rendering English chrome under `lang="fr"`.
- [ ] `Dictionary` type-locks `ar` to `en` — deleting a key from `ar.ts` produces a TypeScript error.
- [ ] Zero `any`. Zero new runtime dependencies.
- [ ] Editorial and legal bodies still render in full (in English) on both locale trees, with `dir="ltr" lang="en"` applied on the Arabic tree.
- [ ] No layout shift or scrollbar regression on either locale.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

The build must complete with no new warnings, and the route table must list both the unprefixed and `/ar` variants of all 12 routes.

## Manual test steps

1. `npm run dev`, open `http://localhost:3000` — confirm the page is byte-for-byte the English site as it exists today, URL still `/` with no `/en` in the address bar.
2. Inspect `<html>` — `lang="en" dir="ltr"`.
3. Click **ع** in the nav. Confirm the URL becomes `/ar`, the page renders in Arabic, `<html lang="ar" dir="rtl">`, and the layout mirrors (logo centred, icon cluster on the left, nav links on the right).
4. Navigate to Heritage from the Arabic nav — URL must be `/ar/heritage`, not `/heritage`.
5. From `/ar/heritage`, click **EN** — URL must be `/heritage` (same page, English), not `/`.
6. Resize below 1024px on `/ar`. Open the mobile drawer: it must slide in from the **right**, the hamburger must sit on the right, and the switcher must appear at the bottom of the drawer.
7. Press Escape and confirm the drawer closes and the scroll lock releases in both locales.
8. Open the two desktop mega menus on `/ar` — confirm the three-column grid mirrors and the nav-link underline animates from the right.
9. On `/ar/privacy-policy`, confirm the English legal body renders left-to-right inside the RTL page with correct punctuation and list markers.
10. In DevTools → Network, filter by font on `/` — no Amiri or IBM Plex Sans Arabic request. Repeat on `/ar` — no Cinzel or Inter request.
11. View source on `/ar/journal` — confirm `<link rel="alternate" hreflang="en" href="…/journal">`, `hreflang="ar"`, and `hreflang="x-default"` are all present, and `og:locale` is `ar_EG`.
12. Visit `/fr/heritage` — confirm the not-found page renders.
13. Run Lighthouse on `/ar` — SEO 100, no "document does not have a valid lang attribute" or contrast regressions.
