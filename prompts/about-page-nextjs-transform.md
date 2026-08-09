# Prompt — Transform `/about` from React Router SPA into a Next.js App Router page

## Goal

Rewrite `src/app/about/page.tsx` (currently a Vite/React-Router component pasted into the App Router tree) as a production-grade Next.js 16 **Server Component**, matching the idiom already established by `src/app/page.tsx`.

Visual output stays the same design intent — hero, founders, mission/vision split, CTA — but rendered with theme tokens, Tailwind utilities, `next/image`, `next/link`, and the shared `<Reveal />` motion wrapper. Responsiveness is added (the current file is desktop-only with fixed `120px` / `80px` padding and hard 2-column grids).

---

## Skills read

- `AGENTS.md` — §1 core rules, §2 design language, §3 tokens, §6 stack, §7 directory structure, §8 routing matrix, §12 checklist.
- No `.agents/skills/*` skill applies: no Clerk auth, no Supabase call, no AI SDK on this route. (The session hook suggested `ai-sdk` / `auth` skills on keyword match — neither is relevant to a static editorial page.)
- Next.js App Router patterns verified against the installed `next@16.2.12`.

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/app/about/page.tsx` | 92 lines. Imports `react-router-dom` (**not installed** — this file cannot compile today). Uses `useEffect`/`useRef` + `IntersectionObserver`, all styling via inline `style` objects with raw hexes, raw `<img>`, `.reveal` / `.reveal-delay-N` / `.page-enter` CSS classes. |
| `src/app/page.tsx` | The reference idiom: Server Component, `export const revalidate`, `export const metadata`, module-scope typed const data, `next/image` with `fill` + `sizes`, `<Reveal delay={index * STAGGER_STEP}>`, section comment banners, `eyebrow` / `gold-line` classes, `text-ivory/40` opacity scale. |
| `src/components/animation/Reveal.tsx` | Client boundary around Motion. Props: `children`, `className`, `delay` (s), `as` (`div`/`section`/`article`). Honors `useReducedMotion`. This replaces the hand-rolled IntersectionObserver entirely. |
| `src/app/globals.css` | `@theme` tokens + `.eyebrow`, `.gold-line`, `.btn-luxury`, `.btn-luxury-fill`, `.reveal*`, `.page-enter`. Body already sets `bg`/`color`/`font-body`. |
| `src/app/layout.tsx` | Renders `<Nav />`, children, `<Footer />`, `metadataBase`, title template `"%s | KHEM Perfumes"`. |
| `src/constants/navigation-pages.ts` | `world` array already links `/about` → this route is reachable from Nav/Footer. |
| `next.config.ts` | `images.remotePatterns` allows `images.unsplash.com` only — both hero and founders images are Unsplash, so no config change needed. |
| `src/services/content.ts`, `src/data/content.ts`, `src/types/content.ts` | Established "service layer absorbs the future DB swap" pattern for editorial content. |
| `package.json` | `next 16.2.12`, `react 19.2.4`, `motion 13`, `lucide-react`. No `react-router-dom`, no `clsx`. |

### Defects in the current file

1. `import { Link } from 'react-router-dom'` — dependency not installed; the route fails to build. Must be `next/link` with `href`.
2. `useEffect` / `useRef` in a file with **no `'use client'`** — invalid in a Server Component; the route would throw.
3. Hand-rolled `IntersectionObserver` duplicates `<Reveal />`; it also never unobserves.
4. Two raw `<img>` with remote Unsplash URLs — no optimization, no `sizes`, no LCP `priority`; also a lint warning (`@next/next/no-img-element`).
5. Every color is a raw hex/rgba inline style (`#0D0D0D`, `#F7F4EC`, `#C8A96A`, `rgba(247,244,236,0.5)`, `#111`) instead of theme tokens.
6. Inline `fontFamily: "'Cinzel', serif"` bypasses the `--font-heading` variable set by `next/font`.
7. Not responsive: `padding: '0 120px'`, `140px 80px`, and `gridTemplateColumns: '1fr 1fr'` with no breakpoints → horizontal overflow on mobile.
8. Dynamic class `` `reveal reveal-delay-${i + 1}` `` — Tailwind-adjacent dynamic string; here the classes are hand-authored CSS so they exist, but the whole system is superseded by `<Reveal delay>`.
9. No `metadata` export, no canonical, no `revalidate`.
10. `<h1>` hero image has `alt="KHEM Atelier"` on a purely decorative background → should be `alt=""` + `aria-hidden` semantics, matching the home hero.
11. Hero `height: 85vh` with no `min-height` → collapses on short viewports.

---

## Decisions and assumptions

1. **Server Component, zero client JS of its own.** All interactivity is scroll reveal, which lives inside `<Reveal />`.
2. **Static-leaning route.** `/about` is not in the §8 routing matrix; it is editorial and sits alongside `/heritage` (Static). Use `export const revalidate = 3600` for consistency with the other editorial content, since founders/mission copy is a candidate for a future CMS pull.
3. **Content stays in this file as module-scope typed consts** (`MISSION_VISION`, `FOUNDERS_QUOTE`), matching the `Footer.tsx` / `page.tsx` idiom. It is not moved into `src/services/` this round because there is no `About` model in AGENTS.md §9 and no second consumer. Flagged as the obvious later swap point.
4. **Copy is preserved verbatim** — including founder names (Mohamed Hassaan, Dr. Karim Mansour), the 2019 founding date, and the pull quote.
5. **Color mapping** (all exact tokens):
   | Current | Token |
   | :--- | :--- |
   | `#0D0D0D` | `bg-background` |
   | `#111` | `bg-surface` (nearest token; was ad-hoc off-black) |
   | `#F7F4EC` | `text-ivory` |
   | `#C8A96A` | `text-gold` / `border-gold` |
   | `rgba(247,244,236,0.5)` | `text-ivory/50` |
   | `rgba(200,169,106,0.6)` | `text-gold/60` |
   | `rgba(255,255,255,0.04)` | `border-border` (`/8` — closest token, 1px hairline, imperceptible) |
6. **`page-enter`** is dropped: it is a route-transition artifact of the SPA and duplicates the reveal on first paint.
7. **Typography scale** uses Tailwind responsive steps rather than `clamp()` inline, matching `page.tsx` (`text-5xl sm:text-6xl md:text-7xl` etc.).

---

## Files likely to change

- `src/app/about/page.tsx` — full rewrite (only file changed).

No schema, route-handler, middleware, config, or dependency changes.

---

## Implementation requirements

**Structure** (top → bottom, section comment banners in the `page.tsx` style):

1. **Hero** — `relative flex min-h-[600px] h-[85vh] items-center overflow-hidden`. `next/image` with `fill`, `priority`, `sizes="100vw"`, `alt=""`, `className="object-cover brightness-[0.25] saturate-50"`. Left-to-right gradient scrim `from-background/90 via-background/60 to-transparent`. Content: `eyebrow` "About KHEM", `<h1>` "A House of / Ancient Futures" (second line `text-gold`), intro paragraph. Padding `px-6 md:px-20 lg:px-30`, `max-w-2xl`.
2. **Founders** — `bg-background px-6 py-24 md:px-20 md:py-36`, `mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center`. Left: portrait in a `relative aspect-4/5` wrapper with `Image fill sizes="(min-width:1024px) 50vw, 100vw"` and `brightness-60 saturate-50`. Right (`<Reveal delay={0.2}>`): eyebrow, `<h2>`, `gold-line`, two body paragraphs, `<blockquote>` with `border-l-2 border-gold pl-6` and a `<cite>`/attribution line.
3. **Mission & Vision** — `border-y border-border bg-surface`, `mx-auto max-w-350 grid grid-cols-1 md:grid-cols-2`. Each cell `p-10 md:p-20`; the first gets `md:border-r border-border`. Rendered from the `MISSION_VISION` const via `.map()`, each wrapped in `<Reveal delay={index * STAGGER_STEP}>`.
4. **CTA** — `bg-background px-6 py-24 md:px-20 md:py-30 text-center`, `mx-auto max-w-xl`, `<h2>` "Experience KHEM", buttons stacked on mobile (`flex flex-col sm:flex-row gap-4 justify-center`): `/collections` with `btn-luxury btn-luxury-fill`, `/heritage` with `btn-luxury`.

**Code standards**
- No `'use client'` anywhere in the file.
- `export const metadata: Metadata` — title `"About"` (layout template appends the brand), description, `alternates: { canonical: "/about" }`, and an `openGraph` title/description pair.
- `export const revalidate = 3600` with the AGENTS.md reference comment, mirroring `page.tsx`.
- Typed module consts: `interface`-free where a `const … as const` suffices; explicit `readonly` arrays typed inline. Zero `any`.
- Every `Image` gets `alt` (empty for decorative), `sizes`, and `fill`-parent `relative`.
- Escape apostrophes (`&apos;`) per the ESLint `react/no-unescaped-entities` rule the home page already respects.
- All headings use `font-heading font-normal`; body uses default `font-body`.
- Reuse `eyebrow` and `gold-line` component classes rather than re-implementing them.

## Security requirements

- Static content only — no user input, no DB, no secrets, no route handler, so no Zod boundary is required on this route.
- Remote images restricted to the already-allowlisted `images.unsplash.com`; no new `remotePatterns` entry.
- No `dangerouslySetInnerHTML`. External links: none added.

## Acceptance criteria

- [ ] `src/app/about/page.tsx` imports nothing from `react-router-dom`; no React hooks; no `'use client'`.
- [ ] Renders as a Server Component with `metadata` + `revalidate` exports.
- [ ] Zero inline `style` props; zero raw hex/rgba colors; zero raw `<img>`.
- [ ] All four sections present with copy preserved verbatim.
- [ ] Layout is correct with no horizontal overflow at 375px, 768px, 1024px, and 1440px.
- [ ] Scroll reveals run through `<Reveal />` and are suppressed under `prefers-reduced-motion`.
- [ ] `npx tsc --noEmit` reports no error originating in `src/`.
- [ ] `npx eslint src` reports no new error or warning.

## Checks to run

```bash
npx tsc --noEmit
npx eslint src
npm run build
```

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/about`.
2. Confirm the hero fills the viewport with the darkened atelier image, gold "Ancient Futures" line, and readable intro copy.
3. Scroll — founders block, then mission/vision cells fade up in sequence, each only once.
4. Resize to 375px: no horizontal scrollbar; grids collapse to one column; CTA buttons stack.
5. Enable macOS "Reduce Motion" and reload — content is visible immediately, no transition.
6. Click **Shop Now** → `/collections`; back, click **Our Heritage** → `/heritage`.
7. View source / check the network tab: images are served from `/_next/image`, and the hero image carries `fetchpriority="high"`.
8. Confirm the browser tab reads "About | KHEM Perfumes".
