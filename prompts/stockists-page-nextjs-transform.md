# Prompt — Transform `/stockists` into a localized Next.js App Router route, driven by a one-record store directory that scales

## Goal

`src/app/stockists/page.tsx` is a client-side SPA component sitting **outside** the `[locale]` tree. It cannot render today: `src/proxy.ts` rewrites `/stockists` → `/en/stockists`, which resolves to `app/[locale]/[...rest]` and returns the 404 page — the file at `src/app/stockists/page.tsx` is never reached. It also calls `useState` with no `"use client"` directive, which is a build error the moment it *is* reached.

Rewrite it as `src/app/[locale]/stockists/page.tsx` — a production-grade Next.js 16 **Server Component** with one client island — following the idiom already established by `src/app/[locale]/craftsmanship/page.tsx`, `src/app/[locale]/journal/page.tsx`, and the `CollectionView` / `CollectionGrid` server/client split.

Three things ship together:

1. **The transform** — theme tokens instead of raw hexes, `--font-heading` instead of inline `'Cinzel', serif`, `next/image`, `<LocaleLink>`, `<Reveal>`, responsive layout, real metadata, ISR.
2. **The data layer** — the single `STOCKISTS` entry moves out of the component into `src/types/stockist.ts` + `src/data/stockists.ts` + `src/services/stockists.ts`, matching the `contact` / `content` / `products` trio. **The record's content is preserved verbatim.**
3. **Full EN/AR support** — dictionary-driven chrome, RTL-correct, LTR islands around English store records.

And the constraint that shapes every layout decision: **the directory holds exactly one location today and must hold twenty tomorrow without a code change.** Every section is written against `stockists.length`, never against the number 1.

---

## Skills read

- `AGENTS.md` — §1 core rules, §2.2 visual language, §3 tokens, §6 stack, §7 structure, §8 routing matrix, §12 checklist.
- No `.agents/skills/*` skill applies: this route has no Clerk auth, no Supabase call, no AI SDK usage. The session hooks suggested `ai-sdk`, `vercel-services`, `nextjs`, `next-cache-components`, and `react-best-practices` on lexical/path matches — none is relevant to a static store-locator page, and none is invoked. Next.js patterns are verified against the installed `next@16.2.12` and the existing routes in this repo, not from memory.
- `prompts/collections-page-nextjs-transform.md` — the precedent this prompt follows for the server/client split, RTL islands, and metadata.

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/app/stockists/page.tsx` | 158 lines, untracked, **outside** `app/[locale]/`. `useState` with no `"use client"`. Every style is an inline `style` object with raw hexes. Raw `<img>` ×2. Hardcodes `STOCKISTS` (1 record) and `REGIONS` (5 labels). Desktop-only paddings (`80px`), fixed `gridTemplateColumns: '1fr 480px'` and `repeat(3, 1fr)`. All copy is hardcoded English. |
| `src/proxy.ts` | Rewrites every unprefixed path into `/en/*`. Anything not under `app/[locale]/` is unreachable — this is why the current file renders nothing. |
| `src/app/[locale]/craftsmanship/page.tsx` | Reference idiom for a static editorial route: `generateMetadata` → `localeMetadata()`, `Promise.all([params, …services])`, `isLocale()` narrowing, `ltrIsland()`, `<Reveal>` with `index * STAGGER_STEP`, `export const revalidate`. |
| `src/components/ecommerce/CollectionView.tsx` + `CollectionGrid.tsx` | The server/client split to copy: the page stays a Server Component, renders content nodes, and hands them to one `"use client"` component that owns only the interactive state. Also the source of the `ChevronRight … rtl:rotate-180` breadcrumb and the `end-*` logical-inset convention. |
| `src/components/ingredients/IngredientExplorer.tsx` | The closest precedent for *this* page's interaction: a filter bar + a selectable card grid + an expanding detail panel, all in one client component, with `handleFamilyChange` dropping a selection the new filter would hide. The region filter must do the same. |
| `src/data/contact.ts`, `src/types/contact.ts`, `src/services/contact.ts` | The three-file pattern for non-catalog domain data with no Prisma model: typed records + a seed module + an `async` service whose doc comment carries the future Supabase query. `CONCIERGE_EMAIL` is the precedent for `WHOLESALE_EMAIL`. `CONTACT_CHANNELS` already carries a boutique address and telephone — see decision 8. |
| `src/lib/i18n/*` | `localizePath`, `localeAlternates`, `isLocale`; `localeMetadata()`; `getDictionary()`; `interpolate()` (`{placeholder}` only, explicitly **not** ICU plurals); `ltrIsland()`. |
| `src/lib/i18n/dictionaries/en.ts` | Defines the `Dictionary` type; `ar.ts` is typed against it, so a missing key is a compile error. Already has `nav.stockists` and `footer.links.stockists`. No `stockists` page block yet. |
| `src/constants/navigation-pages.ts` | Keyed nav entries — the precedent for translating a closed vocabulary by typed key rather than by raw string. **No change needed**: Nav and Footer already link `/stockists`. |
| `src/components/Nav.tsx:163`, `src/components/Footer.tsx:43` | Both already point at `/stockists`. This route is currently a dead link in the chrome — the transform fixes a live 404. |
| `src/app/globals.css` | `@theme` tokens, `.eyebrow`, `.gold-line`, `.btn-luxury`, `.img-zoom`, `.card-lift`; the RTL tracking reset and `[lang="ar"]` optical-size compensation, both scoped to skip `[dir="ltr"]` islands. |
| `next.config.ts` | `images.remotePatterns` already allows `images.unsplash.com` — no config change. |
| `package.json` | `next 16.2.12`, `react 19.2.4`, `motion 13`, `lucide-react ^1.30.0`. No `clsx`, no map library. |

### Defects in the current file

1. **Lives outside `app/[locale]/`** — unreachable behind the proxy rewrite; `/stockists` renders the 404 page.
2. `useState` ×2 with no `"use client"` directive.
3. Store data hardcoded in the page, bypassing `src/services/*` and contradicting AGENTS.md §6 ("UI must display stored data only").
4. **The region filter is broken.** It matches on hardcoded country-name arrays and its `return true` fallback means `"Asia Pacific"` — which has no country list — shows *every* stockist rather than none. A region is a property of a store, not a lookup table living in a filter callback.
5. `REGIONS` is a fixed 5-item list, so four tabs are permanently empty and stay empty as data grows in regions nobody remembered to add.
6. Raw `<img>` ×2 — no optimization, no `sizes`, no LCP `priority`, plus an `@next/next/no-img-element` lint error.
7. Every colour is an inline hex/rgba; `fontFamily: "'Cinzel', serif"` bypasses the `--font-heading` variable `next/font` sets, so the Arabic tree would render Cinzel, which has no Arabic glyphs.
8. Not responsive — `padding: '80px'`, `gridTemplateColumns: '1fr 480px'`, `repeat(3, 1fr)`, no breakpoints. At 375px the split panel and the 3-up card grid both overflow.
9. **Every layout assumes many stockists.** A 3-column card grid holding one card renders one-third of a row and two-thirds of nothing. `maxHeight: '600px'` with `overflowY: 'auto'` reserves a scroll region for a 1-row list.
10. `"{filtered.length} Locations Worldwide"` prints **"1 Locations Worldwide"** — a live grammar bug with the current data.
11. `key={s.city}` ×3 — city is not an identity. Two Dubai stockists collide.
12. `href="https://maps.google.com"` — "Get Directions" goes to the Google Maps homepage, not to the boutique. It also lacks `rel="noopener noreferrer"` on `target="_blank"`.
13. The phone number is inert text, not a `tel:` link — on the mobile viewport this page is built for, that is the primary action.
14. `onMouseEnter`/`onMouseLeave` style mutation where CSS `:hover` (and the existing `.img-zoom`) suffices.
15. Clickable `<div>` rows with `cursor: pointer` — not focusable, not keyboard-operable, no `aria-expanded`, no accessible name.
16. Hardcoded English throughout; no `metadata`, no canonical, no `hreflang`, no `revalidate`.
17. `alt="World map"` on a decorative texture, and no `alt` discipline on the storefront photo.

---

## Decisions and assumptions

1. **The record's content is preserved verbatim** — name, city, country, address, phone, hours, type, and image URL are copied exactly as given, per your instruction that this is the data to work with. Only *structural* fields are added (see 3).
2. **One route, `/stockists`, matching AGENTS.md §8.** No `[slug]` detail route: a single flagship does not warrant one, and the expandable directory row already carries every field the record has.
3. **New fields on the record, all structural.** `id` (stable key, fixes defect 11), `region` (fixes defects 4–5), `phoneHref` (fixes 13), `mapsUrl` (fixes 12), and `imageAlt` (fixes 17). Everything else is the original data untouched.
4. **`region` and `type` are typed unions, not free strings** — following the `IngredientFamily` precedent in `src/types/content.ts`. A typo becomes a typecheck failure instead of an unfilterable region or an unstyled badge, and both are translated by key, so adding a value without translating it is a compile error.
5. **The region bar is derived from the data**, in canonical taxonomy order, and only lists regions that actually contain a stockist. Today it renders **All Regions · Middle East** — two honest tabs instead of five, four of them dead. It grows on its own as records land.
6. **Layout is written against `stockists.length`, never against 1.** Two places branch, both because a grid slot is the wrong container for a lone luxury boutique:
   - **Partner section**: `count === 1` renders an editorial two-column feature (full-bleed image beside the detail column); `count >= 2` renders the responsive card grid. Same component file, same tokens, one `isSolo` branch.
   - **Directory**: the sole row starts expanded (`stockists.length === 1`), so a visitor sees the address and hours without hunting for a click target.
   Everything else — region bar, count label, map chips — already scales because it maps over the array.
7. **No interactive map.** AGENTS.md §8 says "Interactive Map", but every option (Google Maps JS, Mapbox, Leaflet) is a new runtime dependency plus an API key, and neither is in scope here. The existing treatment is kept and made honest: a graded map texture, marked `alt=""` decorative, overlaid with the count and a chip rail of the actual locations, plus a real **Get Directions** deep link per store. **Flagged for you** — say the word and the map panel becomes a separate task with a real provider.
8. **The address is left exactly as supplied and not reconciled with `src/data/contact.ts`.** `CONTACT_CHANNELS` gives the boutique as *"New Cairo City, Cairo Governorate, Egypt."*; this record gives *"14 Place Vendôme, Garden City"* (Place Vendôme is in Paris). Both cannot be the Cairo flagship. This is a content decision, not a refactor — I am not silently editing either one. **Flagged for you.** `mapsUrl` therefore points at a Google Maps *search* for the address string as written, not at coordinates I would have to invent.
9. **Pluralization is handled with two dictionary keys, not a plural library.** `countOne` / `countOther` — `interpolate()` is deliberately not ICU (see its doc comment), and Arabic's six plural forms are not solved by a `{count}` placeholder. Two keys fixes defect 10 correctly in both languages today; when a third form is needed, `Intl.PluralRules` replaces this, as that comment already prescribes.
10. **Filtering stays client-side**, on the `IngredientExplorer` / `CollectionGrid` precedent: a `?region=` search param would opt the route out of ISR.
11. **Store records stay English in both locales**, per the note at the top of `dictionaries/en.ts`. Store names, addresses, cities, countries, and hours are wrapped in `ltrIsland()`; page chrome, region labels, and type badges are translated.
12. **`revalidate = 3600`.** §8 lists `/stockists` as Static; the service layer is already `async` against a future `Stockist` table, so an hourly ISR window means a new boutique appears without a redeploy. Same value as the other content routes.
13. **`lucide-react` only.** No hand-authored `<svg>`, all icons at `strokeWidth={1.25}` per §6.
14. **No new dependencies.**

---

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/app/stockists/page.tsx` | **Deleted** — and the now-empty `src/app/stockists/` directory with it. |
| `src/types/stockist.ts` | **New** — `Stockist`, `StockistRegion`, `StockistType`. |
| `src/data/stockists.ts` | **New** — the one record, `STOCKIST_REGIONS` taxonomy order, `WHOLESALE_EMAIL`. |
| `src/services/stockists.ts` | **New** — `getStockists()`, `getStockistRegions()`, `getWholesaleEmail()`. |
| `src/app/[locale]/stockists/page.tsx` | **New** — Server Component: metadata, data, hero, partner section, wholesale CTA. |
| `src/components/stockists/StockistDirectory.tsx` | **New** — `"use client"`. Region filter + map panel chips + expandable directory list. |
| `src/lib/i18n/dictionaries/en.ts` | **+`stockists` block.** |
| `src/lib/i18n/dictionaries/ar.ts` | Same keys, translated. |

Not touched: `src/constants/navigation-pages.ts`, `Nav.tsx`, `Footer.tsx` (all already link `/stockists`), `globals.css`, `next.config.ts`, `src/data/contact.ts`.

---

## Implementation requirements

### 1. Types — `src/types/stockist.ts`

```ts
/** Canonical regions. A union so a typo fails typecheck instead of producing
 *  an unfilterable region; display order lives in STOCKIST_REGIONS. */
export type StockistRegion = "middleEast" | "europe" | "americas" | "asiaPacific";

/** Badge vocabulary. Translated by key in `dict.stockists.types`. */
export type StockistType = "flagship" | "boutique" | "retailPartner" | "departmentStore";

export interface Stockist {
  id: string;
  name: string;
  city: string;
  country: string;
  region: StockistRegion;
  type: StockistType;
  /** Street address as displayed. English-only; rendered in an LTR island. */
  address: string;
  /** Display form, e.g. "+20 11 234 5678". */
  phone: string;
  /** `tel:` target — digits and a leading `+` only. */
  phoneHref: string;
  /** e.g. "Mon–Sat 10:00–20:00". English-only. */
  hours: string;
  /** Absolute maps URL. Stored, never built from user input. */
  mapsUrl: string;
  image: ContentImage;  // reuse the { url, alt } pair from `src/types/content.ts`
}
```

Both unions get a doc comment naming the file that holds their display order and their dictionary block.

### 2. Data — `src/data/stockists.ts`

```ts
export const STOCKIST_REGIONS: StockistRegion[] = [
  "middleEast", "europe", "americas", "asiaPacific",
];

export const STOCKISTS: Stockist[] = [
  {
    id: "cairo-flagship",
    name: "KHEM Flagship Boutique",
    city: "Cairo",
    country: "Egypt",
    region: "middleEast",
    type: "flagship",
    address: "14 Place Vendôme, Garden City",
    phone: "+20 11 234 5678",
    phoneHref: "tel:+201123456789",
    hours: "Mon–Sat 10:00–20:00",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=KHEM+Flagship+Boutique+Garden+City+Cairo+Egypt",
    image: {
      url: "https://images.unsplash.com/photo-1747696766706-5485b39bf358?w=1200&h=800&fit=crop&auto=format",
      alt: "The KHEM flagship boutique interior, lit low against dark stone",
    },
  },
];

/** Address wholesale and partnership enquiries reach. Precedent: CONCIERGE_EMAIL. */
export const WHOLESALE_EMAIL = "wholesale@khemperfumes.com";
```

Note the image URL keeps the original photo slug and is re-requested at `w=1200&h=800` for the wider editorial treatment. The `@khemfragrance.com` address in the original `mailto:` is normalised to `@khemperfumes.com`, matching every other address in `src/data/contact.ts` — call it out in the summary.

Add a file header comment matching `src/data/contact.ts`: local seed data, the only place these values are hardcoded, shaped for a straight Supabase insert later.

### 3. Services — `src/services/stockists.ts`

```ts
/** → supabase.from('Stockist').select('*').eq('isPublished', true).order('sortOrder') */
export async function getStockists(): Promise<Stockist[]>

/**
 * Regions that actually contain a stockist, in taxonomy order.
 * Derived from the records, so an empty region never renders a dead tab —
 * and a region gains its tab the moment a store lands in it.
 * → supabase.rpc('distinct_stockist_regions')
 */
export async function getStockistRegions(): Promise<StockistRegion[]>

/** → supabase.from('BoutiqueSetting').select('wholesaleEmail').single() */
export async function getWholesaleEmail(): Promise<string>
```

`getStockistRegions` filters `STOCKIST_REGIONS` by presence in `STOCKISTS` — order from the taxonomy, membership from the data. Same header comment convention as `src/services/contact.ts`, including the `// NOTE: add \`import "server-only"\`…` line.

### 4. Page — `src/app/[locale]/stockists/page.tsx`

Server Component. `export const revalidate = 3600`, `const PATH = "/stockists"`, `generateMetadata` → `localeMetadata()` with the four `dict.stockists.meta` fields. Body:

```ts
const [{ locale }, stockists, regions, wholesaleEmail] = await Promise.all([
  params, getStockists(), getStockistRegions(), getWholesaleEmail(),
]);
const activeLocale = isLocale(locale) ? locale : "en";
```

Root: `<div className="min-h-screen bg-background text-ivory">`.

**Header** — `border-b border-border px-6 pt-30 pb-0 md:px-20`, `mx-auto max-w-350`. `.eyebrow` (`dict.stockists.hero.eyebrow`), then `<h1 className="font-heading text-4xl font-normal text-ivory sm:text-5xl md:text-7xl">`. Top padding clears the fixed 80px Nav — take the exact value from a sibling route rather than re-deriving it. The region bar is rendered by the client component and slots directly beneath this heading, sharing its bottom border.

**Directory** — `<StockistDirectory stockists={…} regions={…} locale={activeLocale} />`.

**Partner section** — `border-t border-border px-6 py-24 md:px-20 md:py-30`, `mx-auto max-w-350`. `<Reveal>` header: `.eyebrow` + `<h2 className="font-heading text-2xl font-normal text-ivory sm:text-3xl md:text-4xl">`, `mb-16`. Then:

- **`stockists.length === 1`** → editorial feature. `grid grid-cols-1 lg:grid-cols-2` on `bg-surface`, image column `relative aspect-4/3 lg:aspect-auto lg:min-h-125` with `.img-zoom`, `<Image fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover brightness-55 saturate-65" />`. Detail column `flex flex-col justify-center px-8 py-14 md:px-14`: type badge, `<h3>` name, `city, country` in `text-gold/60`, a `.gold-line`, then address / `tel:` link / hours as a small definition list, then a **Get Directions** `.btn-luxury` to `mapsUrl`.
- **`stockists.length >= 2`** → `grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3`, one `<StockistCard>` per record: `bg-surface`, 200px `.img-zoom` image (`sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"`), then `px-6 py-7` with name + badge, `city, country`, address, hours. Each wrapped in `<Reveal delay={index * STAGGER_STEP}>` with `STAGGER_STEP = 0.1`, per `craftsmanship/page.tsx`.

Both branches share one `StockistBadge` and one `StockistCard` helper in this file. Every store-sourced string carries `{...island}`.

**Wholesale CTA** — `border-t border-border bg-surface px-6 py-24 text-center md:px-20 md:py-30`; `<Reveal className="mx-auto max-w-xl">`; `.eyebrow`, `<h2>`, lede at `text-[13px] leading-loose text-ivory/40`, and `<a href={\`mailto:${wholesaleEmail}\`} className="btn-luxury">`. Copy from `dict.stockists.wholesale.*`. Mirrors the `craftsmanship` CTA block exactly.

### 5. `StockistDirectory` — `"use client"`

```ts
export interface StockistDirectoryProps {
  stockists: Stockist[];
  /** Regions present in the data, taxonomy order. Rendered after an "All" tab. */
  regions: StockistRegion[];
  locale: Locale;
}
```

Reads `useDictionary()`; takes `locale` as a prop for `ltrIsland()` (matching `IngredientExplorer`, which uses `useLocale()` — either is fine, pick one and be consistent within the file).

State: `activeRegion: StockistRegion | null` (`null` = all), and `selectedId: string | null` initialised to `stockists.length === 1 ? stockists[0].id : null` (decision 6).

`handleRegionChange` follows `IngredientExplorer.handleFamilyChange`: switching region clears a `selectedId` the new filter would hide, so the expanded row is never one that just left the list.

**Region bar** — `border-b border-border`, `mx-auto flex max-w-350 gap-9 overflow-x-auto px-6 md:px-20`. Tabs styled exactly like `CollectionTab`: `whitespace-nowrap border-b-2 py-5 font-heading text-[11px] tracking-[0.2em]`, active `border-gold text-gold`, inactive `border-transparent text-ivory/40 hover:text-ivory/70`. `<button type="button">` with `aria-pressed`, since these filter in place rather than navigate. Labels: `dict.stockists.regionAll` + `dict.stockists.regions[region]`.

**Split panel** — `grid grid-cols-1 lg:grid-cols-[1fr_440px]`, `min-h-150` on the map column only.

*Map column*: `relative overflow-hidden bg-surface border-b lg:border-b-0 lg:border-e border-border`, `<Image src={MAP_TEXTURE} alt="" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover brightness-15 saturate-0 sepia-[0.3]" />` — the original Unsplash map URL, `alt=""` because it is texture, not information. Overlay `absolute inset-0 flex flex-col items-center justify-center gap-4 p-8`: `.gold-line`, the count line, then the chip rail.
- Count: `interpolate(filtered.length === 1 ? dict.stockists.countOne : dict.stockists.countOther, { count: filtered.length })`, `font-heading text-[13px] tracking-[0.15em] text-gold/50`.
- Chips: `flex flex-wrap justify-center gap-2 max-w-100`, one `<button type="button" aria-pressed>` per filtered stockist, label `{...island}` city. Active: `border-gold bg-gold/15 text-gold`; idle: `border-gold/20 text-ivory/40`. `px-3.5 py-1.5 font-heading text-[9px] tracking-[0.15em] border transition-colors duration-300 ease-out`. Clicking toggles `selectedId`, same as a row.
- Empty filter result: the chip rail is simply absent and the count reads zero — no separate empty state needed here, the list below carries `dict.stockists.empty`.

*Directory column*: `max-h-150 overflow-y-auto` **only from `lg`** (`lg:max-h-150 lg:overflow-y-auto`) — reserving a scroll region on mobile for a one-row list is defect 9.

Each row is a **`<button type="button">`**, not a div (fixes defect 15): `w-full text-start px-6 py-7 md:px-9 border-b border-border border-s-3 transition-colors duration-300 ease-out`, `border-s-gold bg-gold/6` when selected else `border-s-transparent`, plus `focus-visible:outline-none focus-visible:border-s-gold`. Carries `aria-expanded={isSelected}` and `aria-controls={detailId}`. Note `border-s-*`: the accent rail mirrors to the right edge in Arabic.

Row header: name (`font-heading text-[15px] text-ivory`, island), `city, country` (`text-[11px] tracking-[0.1em] text-gold/60`, island), and the badge pushed to the far end with `justify-between`.

Expanded panel: `id={detailId}`, `mt-4 pt-4 border-t border-border`, holding address (island), a `tel:` link on the phone, hours (island), and a **Get Directions** link — `<a href={s.mapsUrl} target="_blank" rel="noopener noreferrer">` with a lucide `<ExternalLink size={11} strokeWidth={1.25} aria-hidden />` and an `aria-label` from `interpolate(dict.stockists.directionsFor, { name })`, so a screen reader hears which store. Both the phone link and the directions link are **nested interactive content inside a `<button>`** — so the row button must *not* wrap the panel. Structure it as `<div>` container → `<button>` header → `{isSelected && <div id={detailId}>…</div>}` sibling. This is a correctness requirement, not a preference: an `<a>` inside a `<button>` is invalid HTML and breaks keyboard traversal.

Empty state: `dict.stockists.empty`, `py-16 text-center text-sm text-ivory/40`.

The component imports no service and no data module.

### 6. Dictionaries

New `stockists` block in `en.ts` (and the Arabic mirror in `ar.ts`):

```
stockists: {
  meta: { title, description, ogTitle, ogDescription },
  hero: { eyebrow: "Find KHEM", heading: "Our Stockists" },
  regionAll: "All Regions",
  regions: { middleEast: "Middle East", europe: "Europe", americas: "Americas", asiaPacific: "Asia Pacific" },
  types: { flagship: "Flagship", boutique: "Boutique", retailPartner: "Retail Partner", departmentStore: "Department Store" },
  countOne: "{count} Location Worldwide",
  countOther: "{count} Locations Worldwide",
  address: "Address",
  telephone: "Telephone",
  hours: "Hours",
  directions: "Get Directions",
  directionsFor: "Get directions to {name}",
  filterLabel: "Filter by region",
  empty: "No stockists in this region yet. New boutiques are announced here first.",
  partners: { eyebrow: "Our Partners", heading: "World-Class Retail Partners" },
  wholesale: {
    eyebrow: "Carry KHEM",
    heading: "Wholesale & Partnership Enquiries",
    lede: "We partner selectively with retailers who share our commitment to luxury, authenticity, and the highest standards of customer experience.",
    cta: "Contact Our Trade Team",
  },
}
```

`regions` and `types` are keyed by the union members, so `Record<StockistRegion, string>` lookups are exhaustive and adding a region without translating it is a compile error. Arabic copy is written as Arabic, not transliterated English; `countOne` / `countOther` keep the `{count}` placeholder and use the correct Arabic forms (`موقع واحد` / `{count} مواقع`).

`meta.title` is `"Stockists"` — the layout template appends `| KHEM Perfumes` / `| عطور كيم`.

### 7. Icons

`lucide-react` only — `ChevronDown`/`ChevronUp` (row expand affordance), `MapPin`, `Phone`, `Clock`, `ExternalLink`. All at `strokeWidth={1.25}`, all decorative instances `aria-hidden="true"`. Any chevron that points along the reading direction gets `rtl:rotate-180`. Zero hand-authored `<svg>`.

---

## Security requirements

1. `[locale]` is untrusted input — narrowed with `isLocale()` before it reaches the dictionary loader or any `href`.
2. No route param or user input is interpolated into an `href`. `mapsUrl` and `phoneHref` are **stored** fields, not constructed at render.
3. Every external link (`mapsUrl`) carries `target="_blank"` **and** `rel="noopener noreferrer"` — fixing defect 12, where the original had neither the right URL nor the rel.
4. `mailto:` for wholesale comes from the service layer, never from a form field.
5. No `dangerouslySetInnerHTML`, no `eval`, no user-supplied HTML.
6. The service layer stays server-only — `StockistDirectory` imports neither `src/services/*` nor `src/data/*`; it receives already-queried records as props.
7. Remote images stay on the `images.unsplash.com` allowlist already in `next.config.ts`.
8. No PII: the phone number and address are the business's own published details.

---

## Acceptance criteria

- [ ] `/stockists` renders in both `en` (unprefixed) and `ar` (`/ar/stockists`) — it currently 404s in both.
- [ ] `src/app/stockists/` no longer exists.
- [ ] The map panel reads **"1 Location Worldwide"**, singular, in both languages.
- [ ] The region bar shows exactly **All Regions · Middle East** — no dead tabs. Selecting Middle East keeps the one card; there is no reachable filter state that wrongly shows or hides it.
- [ ] The single directory row is expanded on load, showing address, a tappable phone number, hours, and a Get Directions link that opens the boutique's own maps URL in a new tab.
- [ ] The partner section renders the editorial two-column feature, not a lone card in a 3-up grid.
- [ ] **Scale check** (temporarily add two records in different regions, verify, then revert): the region bar gains those regions, the count switches to the plural string, the chip rail lists three cities, the partner section switches to the card grid, and nothing needs a code edit.
- [ ] Directory rows are `<button>`s: reachable by Tab, operable with Enter and Space, with a visible focus ring and `aria-expanded` tracking state.
- [ ] No `<a>` nested inside a `<button>` anywhere in the tree.
- [ ] Zero inline `style` props, zero raw hex colours, zero `<img>`, zero hand-written `<svg>` in the new code.
- [ ] Every font comes from `--font-heading` / `--font-body`; the Arabic tree renders Amiri + IBM Plex Sans Arabic, not Cinzel.
- [ ] Arabic: layout mirrors — the row accent rail sits on the right, chevrons point the reading way, the split panel's divider flips. English store copy sits in `dir="ltr"` islands and keeps its tracking.
- [ ] No horizontal overflow at 375px; the split panel stacks and the card grid is 1 → 2 → 3 columns.
- [ ] `generateMetadata` emits a canonical plus `en` / `ar` / `x-default` alternates and a complete OpenGraph block via `localeMetadata()`.
- [ ] Nav → Stockists and Footer → Stockists both resolve instead of 404ing.
- [ ] Strict TypeScript, no `any`, no non-null assertions.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

`npm run build` is the meaningful one: it exercises both locale trees, the prerender of a route that has never built before, and the server/client boundary.

## Manual test steps

1. `npm run dev`
2. `http://localhost:3000/stockists` — the page renders (before this change it was the 404). Header reads **FIND KHEM / Our Stockists**; region bar shows **All Regions · Middle East** only.
3. Map panel reads **"1 Location Worldwide"** — singular. One **Cairo** chip beneath it.
4. The directory row is already expanded: address, phone, hours visible. Click the row header → it collapses. Click again → expands.
5. Click the **Cairo** chip → it goes gold and the row expands with it.
6. Click the phone number → the OS offers to dial. Click **Get Directions** → a new tab opens on Google Maps for the boutique address; confirm the original tab has no `window.opener` handle (DevTools console: `window.opener` on the new tab is `null`).
7. Click **Middle East** → the card stays. Click **All Regions** → unchanged.
8. Tab through: region tabs → chip → directory row → phone → directions. Every stop shows a visible gold focus ring; Enter and Space both toggle the row.
9. Scroll to **Our Partners** → one editorial two-column block (image beside details), not a card stranded in a 3-column grid. Hover the image → it zooms slowly, no bounce.
10. **Carry KHEM** → the button opens a mail composer to `wholesale@khemperfumes.com`.
11. `http://localhost:3000/ar/stockists` — Arabic chrome throughout (heading, region tabs, "الموقع", "الهاتف", "ساعات العمل", "احصل على الاتجاهات"). Layout mirrored: the selected row's gold rail sits on the **right**, the map panel divider flips. The store name, address, and hours stay English and stay left-to-right inside their blocks. The count line reads the Arabic singular.
12. Switch language with the switcher from `/ar/stockists` → lands on `/stockists`, same page.
13. DevTools responsive: **375px** — the split panel is stacked, the map panel is above the list, no horizontal scrollbar, and the list is not trapped in its own scroll region. **768px** — same stack, wider. **1440px** — side-by-side with the 440px directory column.
14. **Scale check**: temporarily append two records to `STOCKISTS` (one `europe`, one `asiaPacific`), reload → the region bar gains two tabs, the count reads the plural, three chips appear, the partner section becomes a card grid, region filtering narrows all three surfaces. Revert the file.
15. View source on `/ar/stockists` → `<html lang="ar" dir="rtl">`, `<link rel="canonical" href="/ar/stockists">`, `hreflang` for `en`, `ar`, `x-default`, and `og:locale` `ar_EG`.
16. Nav → **Stockists** and Footer → **Stockists** both land on the page.
