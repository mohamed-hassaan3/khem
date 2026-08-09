# Prompt — Transform `/craftsmanship` into a Next.js page + centralize its data

## Goal

Do for `src/app/Craftsmanship/page.tsx` exactly what was already done for `/about`, `/heritage`, `/journal`, `/ingredients`:

1. Convert the Vite/React-Router SPA component into a Next.js 16 **async Server Component** — `next/link`, `next/image`, theme tokens instead of inline hex, `<Reveal />` instead of the hand-rolled `IntersectionObserver`, `metadata`, `revalidate`, real responsive breakpoints.
2. Move **every hardcoded record** out of the page file into the data centre — `src/data/content.ts` (records) → `src/types/content.ts` (types) → `src/services/content.ts` (query layer) — so the later Supabase/Prisma migration is a change of function bodies only.
3. Fix the route casing: `src/app/Craftsmanship/` → `src/app/craftsmanship/`, which is what AGENTS.md §8 and `src/constants/navigation-pages.ts` already point at.

No client component is needed on this route — the page has zero state and zero interaction beyond hover.

---

## Skills read

- `AGENTS.md` — §1 rules, §2 design language, §3 tokens, §5 prompt file contract, §6 stack, §7 structure, §8 routing matrix, §12 checklist.
- No `.agents/skills/*` applies: no Clerk, no Supabase client call, no AI SDK on this route. (Session hooks suggested `ai-sdk` / `vercel-services` / `next-cache-components` on keyword and path match — none is relevant; no AI feature, no multi-service deploy, and this route stays on the same `export const revalidate` convention as its four sibling pages rather than adopting `use cache`.)
- Prior prompts `prompts/about-page-nextjs-transform.md` and `prompts/heritage-journal-ingredients-nextjs-transform.md` — same transformation, reused verbatim where it applies.

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/app/Craftsmanship/page.tsx` | 181 lines. `react-router-dom` import; `useEffect`/`useRef` with no `'use client'`. `PROCESS_STEPS` (6) at module scope; the 4-item stat band and the master-perfumer quote are inline in JSX. 8 raw `<img>`. Every color a raw hex/rgba inline style. |
| `src/app/ingredients/page.tsx` | The closest precedent: hero (`h-[80vh] min-h-150`, `Image fill priority quality={85} sizes="100vw"`, `brightness-20 saturate-60`), then content, then a `border-t border-border bg-surface` CTA. Copy its shape. |
| `src/app/about/page.tsx` | `STAGGER_STEP = 0.1` constant; two-column `lg:grid-cols-2` alternating image/text blocks. |
| `src/data/content.ts` | Holds `TESTIMONIALS`, `INGREDIENTS`, `JOURNAL_ARTICLES`, `CRAFT_PILLARS` (4, home page only), `TIMELINE`, `BRAND_VALUES`, `MISSION_STATEMENTS`. |
| `src/types/content.ts` | `ContentImage`, `Testimonial`, `Ingredient`, `JournalArticle`, `TimelineEvent`, `BrandValue`, `MissionStatement`, `CraftPillar`. |
| `src/services/content.ts` | One exported `async` function per record set, each carrying its future Supabase query as a `→` comment. `getCraftPillars()` already exists and is consumed by `src/app/page.tsx`. |
| `src/components/animation/Reveal.tsx` | `children`, `className`, `delay` (seconds), `as` (`div` \| `section` \| `article`). Honors `prefers-reduced-motion`. |
| `src/app/globals.css` | `.eyebrow`, `.gold-line`, `.btn-luxury`, `.btn-luxury-fill`, `.img-zoom` (scales the descendant `img` on hover) already exist — use them, add nothing. |
| `src/constants/navigation-pages.ts` | `world` array already links `Craftsmanship → /craftsmanship` (lowercase). |
| `next.config.ts` | `images.unsplash.com` allowlisted — every image on the page is Unsplash, so no config change. |

### Defects to fix

1. `react-router-dom` imported — **not installed**; the route fails to build today.
2. React hooks in a file with no `'use client'` — invalid Server Component.
3. `useReveal()` duplicates `<Reveal />`, and its observer never `unobserve`s a revealed element.
4. 8 raw `<img>` → no optimization, no `sizes`, no LCP `priority`; lint warnings.
5. Every color a raw hex/rgba inline style; `fontFamily: "'Cinzel', serif"` bypasses the `--font-heading` variable.
6. Zero breakpoints: `padding: '0 120px'`, `repeat(4, 1fr)` stat band, `'1fr 1fr'` process grid, `padding: '80px 100px'` → horizontal overflow and unreadable text on mobile.
7. No `metadata`, no `revalidate`.
8. Image hover zoom implemented by mutating `style.transform` in `onMouseEnter`/`onMouseLeave` — must become `.img-zoom`, which also removes a client-JS reason.
9. Route folder is `Craftsmanship` (capital C) while every link and the routing matrix use `/craftsmanship`. On Vercel's case-sensitive filesystem the nav links 404 today, even though they resolve locally on macOS.
10. `<div ref={ref} className="page-enter">` — `page-enter` is a leftover SPA transition class that is not defined in `globals.css`.
11. Straight double quotes around the pulled quote and the apostrophe in "Nature's"-style copy will trip `react/no-unescaped-entities`; use `&ldquo;`/`&rdquo;`/`&apos;`.
12. Decorative hero and section images carry descriptive `alt` text on a purely atmospheric image; hero/quote backgrounds get `alt=""`, process-step images keep real alt text (they are informative).
13. **Copy contradiction:** the stat band claims *"16 Months Average Creation Time"*, the CTA says *"Six months of work"*, and the hero says *"a process that takes months"*. Fix the CTA to **"Sixteen months of work."** so the page agrees with itself. Also the CTA says *"Hundreds of decisions"* against *"300+ Formulation Trials"* — that is consistent, leave it.

---

## Decisions and assumptions

1. **Three new record sets, not one.** The page holds three distinct shapes; each gets its own type, const, and service function:
   - `CraftStep` — the six numbered process stages (image + copy).
   - `CraftStat` — the four figures in the band under the hero.
   - `CraftQuote` — the master-perfumer pull quote.
2. **`CraftQuote` is a new type, not a reuse of `Testimonial`.** The field shape is identical (`quote` / `author` / `authorTitle`), but a house statement from the head perfumer and a third-party press quote are different records that will land in different tables. Reusing `Testimonial` would put Leïla Hassan into `getTestimonials()` and therefore onto the home page carousel.
3. **`CRAFT_PILLARS` stays untouched.** It is the home page's four-pillar summary. The six `CRAFT_STEPS` are the full process. They overlap thematically but are different records with different cardinality; merging them would break `src/app/page.tsx`.
4. **`getMasterPerfumerQuote()` returns `CraftQuote | null`**, matching the `getFeaturedArticle()` precedent, and the page renders the quote section only when it is non-null.
5. **Images stay `ContentImage` (`url` + `alt`)**, consistent with every other record in `content.ts` — never a bare `img: string`.
6. **`number: "01"` stays a display string**, matching `CraftPillar.number`, with a separate implicit array order. Records are authored in order; no `sortOrder` field is introduced until the Supabase migration needs one.
7. **Stat values stay strings** (`"300+"`, `"100%"`, `"4"`, `"16"`). They are display figures with mixed units, not quantities anything computes on — the same reasoning as `TimelineEvent.year`.
8. **ISR 1 hour** (`export const revalidate = 3600`), aligned with `/about`, `/heritage`, `/journal`, `/ingredients`. AGENTS.md §8 lists `/craftsmanship` as Static; with all data flowing through the async service layer, a 1-hour revalidate is the same convention the sibling editorial routes settled on and stays correct once the source becomes Supabase.
9. **All copy is preserved verbatim**, except the CTA sentence corrected in defect 13.

---

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/types/content.ts` | **Add** `CraftStep`, `CraftStat`, `CraftQuote`. No existing type modified. |
| `src/data/content.ts` | **Add** `CRAFT_STEPS` (6), `CRAFT_STATS` (4), `MASTER_PERFUMER_QUOTE` (1). No existing const modified. |
| `src/services/content.ts` | **Add** `getCraftSteps()`, `getCraftStats()`, `getMasterPerfumerQuote()`, each with its `→ supabase…` comment. |
| `src/app/Craftsmanship/page.tsx` | **Deleted** — moved via `git mv` through a temporary name (macOS is case-insensitive, so a direct rename is a no-op). |
| `src/app/craftsmanship/page.tsx` | **New** — the rewritten Server Component. |

No schema, no migration, no route handler, no server action, no new dependency, no `next.config.ts` change.

---

## Implementation requirements

### Data layer

```ts
// src/types/content.ts — appended

/** One of the six numbered stages on `/craftsmanship`. */
export interface CraftStep {
  id: string;
  /** Display ordinal, e.g. "01". Matches CraftPillar.number. */
  number: string;
  title: string;
  /** Italic gold line under the title, e.g. "Mouth-Blown. Hand-Polished. Singular." */
  subtitle: string;
  body: string;
  image: ContentImage;
}

/** One figure in the `/craftsmanship` stat band. */
export interface CraftStat {
  id: string;
  /** Display figure, e.g. "300+" or "100%" — mixed units, so a string. */
  value: string;
  label: string;
}

/**
 * A house statement from the atelier. Deliberately not a `Testimonial`:
 * that record set is third-party press and feeds the home page carousel.
 */
export interface CraftQuote {
  id: string;
  quote: string;
  author: string;
  /** Role, e.g. "Head Perfumer & Co-Founder, KHEM". */
  authorTitle: string;
}
```

- `src/data/content.ts`: `CRAFT_STEPS` carries the six records verbatim from `PROCESS_STEPS` (kebab-case `id`s: `ingredient-sourcing`, `formulation`, `crystal-flacon-creation`, `filling-and-sealing`, `packaging-and-presentation`, `quality-control`), each `img` becoming `image: { url, alt }` with the alt written for a screen reader, not repeated from the title. `CRAFT_STATS` ids: `formulation-trials`, `continents-sourced`, `creation-months`, `hand-assembled`. `MASTER_PERFUMER_QUOTE` id: `leila-hassan`.
- `src/services/content.ts`: three `async` functions returning the consts, each preceded by its future query comment, e.g. `/** → supabase.from('CraftStep').select('*').order('number') */`. `getMasterPerfumerQuote()` returns `Promise<CraftQuote | null>` via `?? null`.

### Page

- `export const revalidate = 3600;`
- `metadata`: `title: "Craftsmanship"`, a description covering the six stages / four continents, `alternates.canonical: "/craftsmanship"`, and an `openGraph` title + description — same shape as `/ingredients`.
- `export default async function Craftsmanship()` awaiting all three services in a single `Promise.all`.
- Root: `<div className="min-h-screen bg-background text-ivory">`. The `page-enter` class is dropped.
- `const STAGGER_STEP = 0.1;` reused for the stat band delays.

**Hero** — `relative flex h-screen min-h-150 items-center overflow-hidden bg-black`; `<Image fill priority quality={85} sizes="100vw" alt="" className="object-cover brightness-25 saturate-50" />`; gradient overlay `bg-linear-to-b from-background/40 to-background/70`; content `relative z-10 max-w-2xl px-6 md:px-20 lg:px-30`; eyebrow → `h1` (`font-heading text-5xl … lg:text-8xl`, "Mastery in" / `<span className="text-gold">Every Drop</span>`) → `.gold-line` → lede paragraph `max-w-lg text-sm leading-loose text-ivory/50`. Scroll indicator absolutely positioned at `bottom-12 left-1/2 -translate-x-1/2`, hidden below `md`.

**Stat band** — `border-b border-border bg-surface`; `mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4`; each cell `<Reveal delay={index * STAGGER_STEP}>` with `border-border` dividers applied by index so the 2-col mobile layout does not leave a dangling right border; value in `font-heading text-4xl … text-gold`, label in `text-[11px] tracking-[0.12em] text-ivory/35`.

**Process steps** — `CRAFT_STEPS.map`, alternating background `index % 2 === 0 ? "bg-background" : "bg-surface"`, `border-t border-border`. Grid `grid-cols-1 lg:grid-cols-2` with `lg:min-h-155`. Image cell uses `.img-zoom group relative aspect-4/3 lg:aspect-auto` with `<Image fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover brightness-55 saturate-65" />` and the oversized ghost ordinal absolutely positioned (`font-heading text-7xl text-gold/15 md:text-8xl`). On `lg`, odd rows put the image second via `lg:order-2` — never a hardcoded `order` that would also flip on mobile, where the image must always come first. Text cell `flex flex-col justify-center px-6 py-16 md:px-16 lg:py-20`, wrapped in `<Reveal>`: eyebrow "Step 01" → `h2` → italic gold subtitle → `.gold-line` → body `text-sm leading-loose text-ivory/50`.

**Quote** — `relative min-h-100 border-t border-border md:h-[60vh]`; background `<Image fill sizes="100vw" alt="" className="object-cover brightness-30" />`; centered `<Reveal>` block with a `.gold-line` above and below, the quote in `font-heading italic text-xl sm:text-2xl md:text-3xl`, then author in `text-gold tracking-[0.2em]` and role in `text-ivory/35`. Rendered only if the quote is non-null.

**CTA** — mirrors `/ingredients`: `border-t border-border bg-background px-6 py-24 text-center md:px-20 md:py-30`, `<Reveal className="mx-auto max-w-xl">`, eyebrow "The Result" → `h2` "Fragrances Worthy of History" → corrected body copy → two `next/link` buttons (`/collections` with `btn-luxury btn-luxury-fill`, `/ingredients` with `btn-luxury`) in a `flex flex-col items-center justify-center gap-4 sm:flex-row`.

### Route move

```bash
git mv src/app/Craftsmanship src/app/craftsmanship-tmp
git mv src/app/craftsmanship-tmp src/app/craftsmanship
```

Two steps because macOS's default filesystem is case-insensitive. Verify afterwards that `git status` shows the rename and that no `src/app/Craftsmanship` directory remains.

---

## Security requirements

- No user input, no form, no query param, no `searchParams` on this route → no Zod schema needed and none is invented.
- No secrets, no env vars, no Clerk, no Supabase client, no fetch to a third party at runtime.
- Route stays public; it is already covered by the `isPublicRoute` matcher in AGENTS.md §10 and needs no middleware change.
- All image hosts remain the already-allowlisted `images.unsplash.com`; no new `remotePatterns` entry, and no user-supplied URL is ever passed to `next/image`.
- No `dangerouslySetInnerHTML`, no raw HTML from data.

---

## Acceptance criteria

- [ ] `/craftsmanship` renders; `src/app/Craftsmanship/` no longer exists; the Nav "Craftsmanship" link resolves.
- [ ] `react-router-dom` appears nowhere in the file; no `'use client'` on the page; no hooks in it.
- [ ] Zero hardcoded records in `page.tsx` — every string that is content comes from `getCraftSteps()`, `getCraftStats()`, `getMasterPerfumerQuote()`.
- [ ] Zero raw `<img>`; every image is `next/image` with `sizes`, and only the hero has `priority`.
- [ ] Zero inline `style={{…}}` and zero raw hex/rgba in the file — colors come from `bg-background`, `bg-surface`, `text-gold`, `text-ivory`, `border-border`.
- [ ] `font-heading` used for every serif heading; no `fontFamily` string anywhere.
- [ ] `<Reveal />` is the only reveal mechanism; no `IntersectionObserver` in the file.
- [ ] No horizontal overflow at 320px, 375px, 768px, 1024px, 1440px.
- [ ] `metadata` and `revalidate = 3600` exported.
- [ ] TypeScript strict passes with zero `any`; ESLint passes with zero warnings.
- [ ] The CTA no longer contradicts the stat band on creation time.
- [ ] `prefers-reduced-motion: reduce` renders the page fully with no entrance animation.

---

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three must pass clean before the task is reported complete.

---

## Exact manual test steps

1. `npm run dev`, open `http://localhost:3000/craftsmanship`.
2. Hero fills the viewport; heading reads "Mastery in / Every Drop" with "Every Drop" in gold; the scroll indicator sits centered at the bottom on desktop and is hidden on mobile.
3. Scroll into the stat band — four figures fade up in sequence, 2×2 on mobile, 1×4 from `lg`, with no dangling divider on the right column.
4. Scroll through the six process sections: on desktop the image alternates left/right (steps 01, 03, 05 image-left); on mobile the image is always above the text. Hovering an image zooms it smoothly with no layout shift.
5. Each step shows its ghost ordinal in the image corner and "Step 0N" as the eyebrow.
6. The quote section shows the pull quote, "Leïla Hassan", and "Head Perfumer & Co-Founder, KHEM" between two gold rules.
7. CTA reads "Sixteen months of work. Hundreds of decisions. One bottle." — "Shop Collections" goes to `/collections`, "Our Ingredients" goes to `/ingredients`.
8. Open Nav → The World → "Craftsmanship" and confirm it lands on this page.
9. Resize to 320px and 375px — no horizontal scrollbar, no clipped text.
10. Enable "Reduce motion" in macOS System Settings, reload — all content is visible immediately with no fades.
11. DevTools console and terminal: zero warnings, zero hydration errors.
12. Lighthouse on the built output: Performance ≥ 95, SEO 100, Accessibility ≥ 95.
