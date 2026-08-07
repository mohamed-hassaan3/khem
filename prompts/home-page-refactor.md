# Prompt — Home Page Refactor (`src/app/page.tsx`)

## Goal

Bring the KHEM home page into full compliance with `AGENTS.md`:

1. Replace every hardcoded hex/arbitrary color with the Tailwind v4 `@theme` tokens already declared in `src/app/globals.css`.
2. Enhance the Next.js implementation (Server Component by default, `next/image`, ISR, metadata, correct client boundaries).
3. Debug the real defects currently present in the file.
4. Restructure the inline mock data + TypeScript types so the later migration to Supabase/Prisma is a drop-in swap of one module, with **zero UI changes**.

Visual output must be pixel-equivalent to today's page. This is a refactor, not a redesign.

---

## Skills read

- `AGENTS.md` (full) — §1 core rules, §2 design language, §3 tokens, §6 stack, §7 directory structure, §8 routing matrix, §9 Prisma schema, §12 checklist.
- No `.agents/skills/*` skill applies: this task touches no Clerk auth, no Supabase client calls (data stays local this round), and no AI SDK.
- Next.js App Router patterns verified against `node_modules/next/dist/docs/` and the installed `next@16.2.12`.

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/app/page.tsx` | 585 lines, `'use client'`, 4 inline data arrays, 8 raw `<img>`, all colors hardcoded hex. |
| `src/app/globals.css` | `@theme` block matching AGENTS.md §3.1 exactly. Also already defines `.reveal` / `.reveal.visible`, `.reveal-delay-1..5`, `.gold-line`, `.btn-luxury`, `.btn-luxury-fill`, `.eyebrow`, `.note-pill`, `.section-divider`, `.img-zoom`, `.card-lift`, `::selection`. |
| `src/app/layout.tsx` | Renders `<Nav />`, `children`, `<Footer />`. `body` already has `bg-background font-body text-ivory`. Full metadata object present. |
| `src/lib/fonts.ts` | Cinzel → `--font-heading`, Inter → `--font-body`. **There is no Tailwind `font-serif` alias configured** — the tokens are `font-heading` / `font-body`. |
| `src/components/Footer.tsx` | Established project idiom: module-scope typed const arrays, extracted `*Class` string constants, `.map()` render, `text-ivory/40`, `text-gold`, `bg-background`, `eyebrow` class. This is the pattern the home page must match. |
| `src/constants/navigation-pages.ts` | `collections` / `world` link data. |
| `next.config.ts` | `images.remotePatterns` allows `images.unsplash.com` only. |
| `tsconfig.json` | `strict: true`, path alias `@/*` → `./*` (so imports are `@/src/...`). |
| `package.json` | Only `next`, `react`, `react-dom`. **No `motion`, no `clsx`/`tailwind-merge`, no `zod`, no `@prisma/client`, no `@supabase/supabase-js` installed.** |

### Baseline check results (measured, not assumed)

- `npx eslint src` → **0 errors, 8 warnings**, all `@next/next/no-img-element` at `page.tsx` lines 155, 220, 239, 283, 315, 388, 445, 484.
- `npx tsc --noEmit` → errors are **entirely from a stale `.next/types/validator.ts`** that validates routes (`/about`, `/collections`, `/perfume/[slug]`, …) whose files do not exist in this working tree. No error originates in `src/`. Fix by deleting `.next` and regenerating; not a source defect.

---

## Defects to fix (the "debug" pass)

1. **Dead dynamic Tailwind classes.** `` `delay-[${(i + 1) * 100}ms]` `` (lines 280, 366, 481) — Tailwind v4 scans source statically, so these class names are never generated. The stagger silently does nothing today.
2. **Duplicated, conflicting reveal system.** The page hand-rolls `opacity-0 translate-y-8` + `classList` mutation while `globals.css` already ships `.reveal` / `.reveal.visible` / `.reveal-delay-N`. Two systems, one unused.
3. **Reveal observer never unobserves** elements after they fire, so it keeps re-running work on every scroll intersection.
4. **`font-serif` used ~40 times** but no such font token exists in the theme → those elements silently fall back to the browser default serif, not Cinzel. Must be `font-heading`.
5. **8 raw `<img>`** → no optimization, no `sizes`, no LCP priority. Fails AGENTS.md §12 Lighthouse target and is the entire current lint warning count.
6. **Whole page is a Client Component** although only two fragments are interactive (testimonial rotator, newsletter form). Violates AGENTS.md §6 ("RSC by default") and §8 (`/` = SSR/ISR 1h).
7. **No `revalidate`** despite §8 specifying ISR 1h for `/`.
8. **`id` used as a URL slug** (`/perfume/${p.id}`) — conflates the Prisma `id` (uuid) with `slug`.
9. **Price stored as a float dollar number** (`price: 295`) — Prisma §9 mandates `priceInCents: Int`.
10. **`selection:bg-…` utilities on the root `div`** duplicate the `::selection` rule already in `globals.css`.
11. **Newsletter "submit" is a no-op** that flips local state with no validation and no persistence; must at minimum validate the email and be structured as a swappable submit handler.
12. **Testimonial rotator has no pause and no live region** — auto-advances every 5s with no `aria-live`, and the dot `<button>`s lack `type="button"`.
13. **Craftsmanship pillar data is inline inside JSX** (lines 360-364), unlike every other data set.

Adjacent, flagged but **out of scope** (report only, do not change):
- `src/app/layout.tsx` exports `themeColor` inside `metadata`; Next 16 wants it in a `viewport` export.
- `src/components/Footer.tsx` line 55 uses `src="logo/name-logo-transparent.svg"` with no leading slash.

---

## Decisions and assumptions

1. **Color token mapping** (hex → utility). Two hexes in the page have no exact token; mapped to the nearest brand token, which is a ≤1% perceptual shift:

   | Current hex | Token utility | Note |
   | :--- | :--- | :--- |
   | `#0D0D0D` | `bg-background` / `text-background` | exact |
   | `#1A1A1A` | `bg-surface` | exact |
   | `#242424` | `bg-card` | exact |
   | `#C8A96A` | `text-gold` / `bg-gold` / `border-gold` | exact |
   | `#F7F4EC` | `text-ivory` | exact |
   | `#d4b778` (hover) | `bg-champagne` (`#e6d6a8`) | nearest token; matches `.btn-luxury-fill:hover` |
   | `#111111` | `bg-surface` | nearest token (was an ad-hoc off-black) |
   | `#0A0A0A` | `bg-black` | nearest token |
   | `border-white/5`, `bg-white/5` | `border-border` / `bg-border` | `--color-border` is `rgba(255,255,255,0.08)` |

   Alpha variants keep the token: `#C8A96A/40` → `border-gold/40`, `#F7F4EC/50` → `text-ivory/50`. Gradients use `var(--color-*)` inside the arbitrary value so no hex survives anywhere in the file.

2. **`font-serif` → `font-heading`** everywhere. Body copy gets no font class (inherits `font-body` from `<body>`).

3. **Reuse the CSS component classes that already exist** rather than re-implementing them in Tailwind: `.eyebrow` for the 10px gold labels, `.btn-luxury` / `.btn-luxury-fill` for the CTAs, `.gold-line` and `.section-divider` for the gold rules, `.note-pill` for note chips, `.reveal` + `.reveal-delay-N` for scroll animation. This deletes a large amount of duplicated utility soup and makes the page consistent with `Footer.tsx`.

4. **Motion replaces the plain-CSS reveal** (user decision, 2026-08-07). `motion@13.0.0` is installed and drives every animation on this page: scroll reveal, stagger, testimonial crossfade, newsletter success panel. The `.reveal` / `.reveal-delay-N` classes in `globals.css` are consequently **not** used by the home page (left in place for other pages; removing them is a separate cleanup).
   - Verified: `motion/react` re-exports `framer-motion@13.0.0`; `motion/react-client` maps to `framer-motion/client`, which in this version ships **without** a `"use client"` directive. Therefore Motion is never imported into a Server Component — every Motion usage lives inside a file that declares `'use client'` itself, under `src/components/animation/`.
   - Motion config obeys AGENTS.md §2.2: `ease: [0.16, 1, 0.3, 1]` (the `--ease-luxury-bezier` curve) on tween transitions only. **No `type: 'spring'`, no bounce, anywhere.**
   - `useReducedMotion()` gates every animation; when reduced motion is on, content renders in its final state with no transition.
   - Zod remains uninstalled — the user will add it later. Newsletter validation is native + explicit guard, with the Zod upgrade marked as a TODO.

5. **Data shape mirrors the Prisma models in AGENTS.md §9 exactly**, so the Supabase swap is a query, not a remap. Field names, casing, and units match §9 (`priceInCents`, `topNotes`/`heartNotes`/`baseNotes`, `concentration`, `ProductImage[]`, `slug`). Nothing is invented beyond §9; where the page needs a value §9 has no column for (ingredient origin, article category), it goes in a clearly separate, non-Prisma "editorial content" type marked as such.

6. **Access goes through an async service layer** (`src/services/`) returning `Promise<T>` today from local seed data. When Supabase lands, only the function bodies change; the page and components are already `await`-ing. This is the core of "easy to transfer to Supabase later."

7. **`src/constants/theme.ts` (`COLORS`) is left untouched** but is not used by the page — the CSS `@theme` is the single source of truth for styling. Flag it as a duplicate source of truth for a future cleanup decision.

8. Assumed the placeholder Unsplash URLs stay as-is this round (Cloudinary migration is a separate task).

---

## Files likely to change

**Created**

```
src/types/catalog.ts            # Product, ProductImage, Collection, Concentration — mirrors Prisma §9
src/types/content.ts            # Testimonial, Ingredient, JournalArticle, CraftPillar — editorial content
src/data/products.ts            # seed-shaped product + collection records
src/data/content.ts             # seed-shaped testimonials, ingredients, articles, craft pillars
src/services/products.ts        # getFeaturedProducts(), getFeaturedCollections(), getProductBySlug()
src/services/content.ts         # getTestimonials(), getIngredients(), getLatestArticles(), getCraftPillars()
src/lib/format.ts               # formatPrice(cents), formatArticleDate(iso)
src/components/animation/Reveal.tsx        # 'use client' — IntersectionObserver → .visible
src/components/ecommerce/ProductCard.tsx   # server component
src/components/home/CollectionCard.tsx     # server component
src/components/home/IngredientCard.tsx     # server component
src/components/home/JournalCard.tsx        # server component
src/components/home/TestimonialCarousel.tsx# 'use client'
src/components/home/NewsletterForm.tsx     # 'use client'
```

**Modified**

```
src/app/page.tsx                # → Server Component, composed of the above
```

**Untouched:** `globals.css`, `layout.tsx`, `Nav.tsx`, `Footer.tsx`, `next.config.ts`, `theme.ts`.

---

## Implementation requirements

### Types (`src/types/catalog.ts`) — Prisma-parity

```ts
export type Concentration =
  | 'PARFUM' | 'EXTRAIT_DE_PARFUM' | 'EAU_DE_PARFUM' | 'ATTAR_OIL';

export interface ProductImage {
  url: string;
  alt: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Collection {
  id: string; name: string; slug: string;
  description: string; bannerUrl: string; isFeatured: boolean;
}

export interface Product {
  id: string; name: string; slug: string;
  subtitle: string | null; description: string;
  concentration: Concentration;
  topNotes: string[]; heartNotes: string[]; baseNotes: string[];
  volumeMl: number; priceInCents: number; sku: string;
  inventory: number; isBestseller: boolean;
  collectionSlug: string;            // FK expressed by slug until the DB assigns uuids
  images: ProductImage[];
}
```

`ProductCardData` = the narrow view the card needs, derived via `Pick<>` — cards must not demand fields a list query would not select.

Editorial types in `content.ts` are separate and each carries a comment stating it is **not** a Prisma model (destined for a CMS or a future `Article` / `Ingredient` table). `JournalArticle.publishedAt` is an ISO-8601 string, never a pre-formatted display string.

### Services

```ts
export async function getFeaturedProducts(limit = 4): Promise<ProductCardData[]>
```

Each function: async, explicit return type, pure read from `src/data/*`, and a one-line comment naming the Supabase query that will replace it (e.g. `// → supabase.from('Product').select(...).eq('isBestseller', true).limit(limit)`). No `any`. Wrapped so a future throwing client surfaces cleanly.

### Page

- Remove `'use client'`. `export const revalidate = 3600` (AGENTS.md §8, ISR 1h).
- `export const metadata: Metadata` with a home-specific title/description/canonical.
- `export default async function Home()` — `await Promise.all([...])` the service calls in parallel.
- Every section renders from service data; **no literal content arrays remain in the file**.
- Product links use `/perfume/${product.slug}`.
- Prices render through `formatPrice(product.priceInCents)`.

### Images

- All 8 `<img>` → `next/image`.
- Hero: `fill`, `priority`, `sizes="100vw"`, `quality={85}`.
- Below-fold: `fill` inside an aspect-ratio container with accurate `sizes` (grid cards `"(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw"`), default lazy loading.
- Every `alt` is descriptive; decorative images get `alt=""`.
- Zoom transitions move to the wrapper (`.img-zoom` from `globals.css`) so `next/image`'s own styles are not fought.

### Client boundaries

- `Reveal` — `'use client'`, Motion-based. `motion.div|section|article` with `initial={{ opacity: 0, y: 40 }}`, `whileInView={{ opacity: 1, y: 0 }}`, `viewport={{ once: true, amount: 0.1, margin: '0px 0px -60px 0px' }}`, `transition={{ duration: 0.9, ease: [0.16,1,0.3,1], delay }}`. Accepts `children`, `className`, `delay` (seconds), `as`. `useReducedMotion()` → renders the plain tag with no animation.
- Stagger is a real `delay` prop (`index * 0.1`), which is what finally fixes defect #1 — Motion reads it at runtime, so no Tailwind class generation is involved.
- `TestimonialCarousel` — `'use client'`. 5s interval preserved; `aria-live="polite"`; dots are `type="button"` with `aria-label`; interval cleared on unmount and paused on hover/focus.
- `NewsletterForm` — `'use client'`. Native `required` + `type="email"` plus an explicit regex/`validity` guard; renders the existing success panel; the submit path is a single `onSubmit` function with a `// TODO: wire to Server Action → Resend` marker so the swap is one function.
- Everything else stays a Server Component.

### Styling rules (non-negotiable for this task)

- **Zero hex literals and zero `white/N` utilities** in any file touched. Grep must come back empty.
- Only tokens from the `@theme` block, or `var(--color-*)` inside arbitrary gradient values.
- `font-heading` for display type; body copy inherits.
- Spacing, tracking, sizes, and layout preserved verbatim from the current design.
- Stagger uses the real `.reveal-delay-N` classes, never interpolated class strings.

---

## Security requirements

- No secrets, no env vars, no network calls introduced.
- Newsletter email is validated client-side and **not** persisted or transmitted; the TODO explicitly states server-side Zod validation is required before wiring a real endpoint.
- All remote images stay on the `images.unsplash.com` host already allow-listed in `next.config.ts`; no new remote pattern is opened.
- No `dangerouslySetInnerHTML`; all copy is JSX text.
- External `<a>` elements, if any survive, carry `rel="noopener noreferrer"`.
- No user input reaches a URL, query, or DOM sink.

---

## Acceptance criteria

- [ ] `grep -nE '#[0-9a-fA-F]{6}|white/[0-9]' src/app/page.tsx src/components/home src/components/ecommerce src/components/animation` returns nothing.
- [ ] `grep -rn 'font-serif' src/app/page.tsx src/components` returns nothing.
- [ ] `src/app/page.tsx` has no `'use client'` and no literal data arrays.
- [ ] `revalidate = 3600` and a page-level `metadata` export are present.
- [ ] Zero `<img>`; `npx eslint src` reports **0 errors, 0 warnings**.
- [ ] `npx tsc --noEmit` clean after `rm -rf .next` (no `any`, no non-null assertions).
- [ ] `npm run build` succeeds and lists `/` as a prerendered ISR route.
- [ ] Rendered page is visually identical to the current one at 375 / 768 / 1440 px.
- [ ] Reveal stagger is visibly active (it is currently dead) and honors reduced-motion.
- [ ] Swapping Supabase in requires editing only `src/services/*` — no component or page edit.

---

## Checks to run

```bash
rm -rf .next          # clear the stale route validator described above
npx tsc --noEmit
npx eslint src
npm run build
```

Plus the two greps in the acceptance criteria.

---

## Visual interpretation (UI task requirements)

- **Layout:** unchanged. Hero `h-screen min-h-[800px]`; sections `py-24 md:py-36 px-6 md:px-20`; `max-w-7xl mx-auto`; collections 1→2 col; products 1→2→4 col; craft pillars 1→2→4 col; journal 1→3 col; ingredients horizontal overflow rail at `w-[260px] sm:w-[300px]`.
- **Typography:** Cinzel via `font-heading` on `h1`/`h2`/`h3` and CTA labels; Inter body inherited. Hero `text-6xl sm:text-8xl md:text-9xl lg:text-[160px] tracking-[0.3em]`. Eyebrows `10px / 0.3em / uppercase / gold` via `.eyebrow`. CTA labels `11px / 0.2em / uppercase`.
- **Color:** obsidian ground, gold accents, ivory text at the exact same alpha steps (`/60`, `/50`, `/40`, `/30`) — only the token name changes, never the alpha.
- **Motion:** fade + 40px rise over 0.9s on `--ease-luxury-bezier`; image zoom `scale(1.04)` over 0.8s; testimonial crossfade 1s. No spring, no bounce, no scale on text.
- **Responsiveness:** verify 375 / 768 / 1024 / 1440. No horizontal scroll except the intentional ingredients rail. Hero circles shrink at `sm`.
- **Pixel expectation:** a before/after screenshot diff at each breakpoint should differ only where `#111111`→`surface`, `#0A0A0A`→`black`, and `#d4b778`→`champagne` were remapped, and where Cinzel now correctly replaces the fallback serif in the previously-broken `font-serif` elements.

---

## Manual test steps after implementation

1. `rm -rf .next && npm run dev` → open `http://localhost:3000`.
2. Hero renders at full height, KHEM wordmark in Cinzel, gold rules visible, background image loads with `priority` (no lazy flash).
3. Scroll slowly: each section fades up **and the cards stagger** (previously they all appeared at once).
4. DevTools → Network, filter Img: every image is served from `/_next/image` as WebP/AVIF with a `w=` matching the viewport.
5. DevTools → Elements: confirm no `style` or class contains a raw hex; confirm heading elements compute to `Cinzel`.
6. Testimonials advance every 5s; hovering pauses; clicking a dot jumps and the dot widens; screen reader announces the change.
7. Newsletter: submit empty → native validation blocks; submit `abc` → blocked; submit `a@b.com` → gold "Welcome to the Circle" panel.
8. Hover a product card → image zooms to 1.04 over 0.8s, no layout shift; click → navigates to `/perfume/kyphi-noir` (404 expected, route not built yet — confirm the URL is slug-based, not uuid-based).
9. OS "Reduce motion" on → content is visible immediately, no transitions.
10. Resize 375 → 1440, confirm no horizontal scrollbar and the ingredient rail scrolls independently.
11. Lighthouse (mobile, incognito, prod build) → Performance ≥ 95, Accessibility ≥ 95, SEO 100.
