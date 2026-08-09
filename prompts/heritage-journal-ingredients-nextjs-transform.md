# Prompt — Transform `/heritage`, `/journal`, `/ingredients` into Next.js pages + centralize their data

## Goal

Do for the three newly added pages exactly what was done for `/about`:

1. Convert each from a Vite/React-Router SPA component into a Next.js 16 **Server Component** (`next/link`, `next/image`, theme tokens, `<Reveal />`, `metadata`, `revalidate`, responsive layout).
2. Move **every hardcoded record** out of the page files into the existing data centre — `src/data/content.ts` (records) → `src/types/content.ts` (types) → `src/services/content.ts` (query layer) — so the later Supabase/Prisma migration is a change of function bodies only.
3. Isolate the interactive parts (family filter, ingredient detail panel, category filter) into small `'use client'` components that receive server-fetched data as props, following the `TestimonialCarousel` precedent.

Also retro-fit `/about`: its `MISSION_VISION` const moves into the data centre for consistency with rule 2.

---

## Skills read

- `AGENTS.md` — §1 rules, §2 design language, §3 tokens, §5 prompt files, §6 stack, §7 structure, §8 routing matrix, §12 checklist.
- No `.agents/skills/*` applies: no Clerk, no Supabase client call, no AI SDK on these routes. (Session hooks suggested `vercel-storage` / `next-upgrade` on keyword match — neither is relevant; no storage product is being added and Next stays at 16.2.12.)
- Prior prompt `prompts/about-page-nextjs-transform.md` — same transformation, reused verbatim where it applies.

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/app/heritage/page.tsx` | 177 lines. `react-router-dom` import, `useEffect`/`useRef` with no `'use client'`. `TIMELINE` (6) at module scope; `VALUES` (3) inline in JSX. Two raw `<img>`. All inline hex styles. Fully static content — no state. |
| `src/app/journal/page.tsx` | 124 lines. Same broken imports. `ARTICLES` (6) + `CATEGORIES` at module scope. `useState` category filter. Numeric `id`s used as URL slugs (`/journal/1`). Pre-formatted `date: 'December 2024'` strings. Inline `onMouseEnter` transform hacks on `<img>`. |
| `src/app/ingredients/page.tsx` | 294 lines. Same broken imports. `INGREDIENTS` (8, richest dataset in the repo) + `FAMILIES`. Two `useState` (family filter, selected ingredient). `family` stored as the display string `"Woody · Resinous"`; `price` as the display string `"$$$$$"`. Sticky filter bar at `top: 80px`. Three raw `<img>`. |
| `src/data/content.ts` | **Already holds `INGREDIENTS` (6) and `JOURNAL_ARTICLES` (3)** — consumed by the home page rail and journal preview. These overlap the new page data and must be merged, not duplicated. |
| `src/types/content.ts` | `ContentImage`, `Testimonial`, `Ingredient` (`id`,`name`,`slug`,`origin`,`image`), `JournalArticle` (`id`,`slug`,`title`,`category`,`publishedAt`,`image`), `CraftPillar`. |
| `src/services/content.ts` | `getTestimonials`, `getIngredients`, `getLatestArticles(limit)`, `getCraftPillars` — each carrying its future Supabase query as a comment. |
| `src/lib/format.ts` | `formatPrice`, `formatArticleDate` (ISO → "December 2024", UTC-pinned), `formatVolume`. |
| `src/components/home/IngredientCard.tsx` | Consumes `ingredient.image` + `origin` + `name` only → unaffected by adding fields. |
| `src/components/home/JournalCard.tsx` | Consumes `slug`, `category`, `publishedAt`, `image`, `title` → unaffected by adding fields. |
| `src/data/products.ts` | Existing product slugs: `kyphi-noir`, `ra-soleil`, `nile-absolue`, `obsidian-elixir`. |
| `src/components/animation/Reveal.tsx` | `children`, `className`, `delay` (s), `as`. Honors `prefers-reduced-motion`. |
| `next.config.ts` | `images.unsplash.com` allowlisted — every image on all three pages is Unsplash, so no config change. |

### Defects to fix (all three pages)

1. `react-router-dom` imported — **not installed**; all three routes fail to build today.
2. React hooks in files with no `'use client'` — invalid Server Components.
3. Hand-rolled `IntersectionObserver` duplicating `<Reveal />`, never unobserving.
4. 7 raw `<img>` total → no optimization, no `sizes`, no LCP priority; lint warnings.
5. Every color a raw hex/rgba inline style; `fontFamily: "'Cinzel', serif"` bypassing the `--font-heading` variable.
6. Zero breakpoints: `padding: '0 120px'`, `repeat(4, 1fr)`, `repeat(3, 1fr)`, `'400px 1fr'`, `'1fr 2fr'` → horizontal overflow on mobile.
7. No `metadata`, no `revalidate` on any of the three.
8. Hover animation implemented via inline `onMouseEnter`/`onMouseLeave` style mutation — must be CSS (`img-zoom` / `group-hover:`), which also removes a client-JS reason.
9. **Journal:** numeric `id` used as URL slug; `date` stored pre-formatted; `readTime` stored as `'8 min'` string.
10. **Ingredients:** `family` stored as a `" · "`-joined display string then re-split for filtering and tags; `price` stored as `'$$$$$'`; `usedIn` linked via `f.toLowerCase().replace(' ', '-')` — `String.replace` with a string pattern replaces only the **first** space, so "Obsidian Elixir" → `obsidian-elixir` works but any 3-word name breaks.
11. **Ingredients:** grid cards are `<button>` wrapping a heading — the detail panel has no `aria` association and no focus management; close button is not `type="button"`.
12. **Journal:** `paddingTop: '80px'` hardcodes the Nav height into the page.
13. **Heritage:** the `1fr 60px 1fr` alternating timeline is desktop-only geometry with no mobile fallback.

---

## Decisions and assumptions

1. **One canonical record set.** The 8-item `INGREDIENTS` and 6-item `ARTICLES` from the new pages **supersede and absorb** the 6-item / 3-item versions in `src/data/content.ts`. Existing types are *extended*, never forked, so the home page keeps rendering unchanged.

2. **Display strings become structured fields** (this is the migration-readiness requirement):
   | Was | Becomes | Rationale |
   | :--- | :--- | :--- |
   | `family: 'Woody · Resinous'` | `families: string[]` | maps to a Prisma `String[]`, like `topNotes` |
   | `price: '$$$$$'` | `priceTier: 1..5` (number) | renderable, sortable, filterable |
   | `latin: 'Aquilaria malaccensis'` | `latinName: string` | naming consistency |
   | `desc` | `description` | matches `CraftPillar.description` |
   | `img: string` | `image: ContentImage` | matches every other record in the file |
   | `usedIn: ['Kyphi Noir']` | `usedIn: { name, slug }[]` | denormalized now; becomes a join table later |
   | `date: 'December 2024'` | `publishedAt` ISO (already on the type) | formatted by `formatArticleDate()` |
   | `readTime: '8 min'` | `readTimeMinutes: number` | formatted at render |
   | `featured: boolean` | `isFeatured: boolean` | matches the Prisma `isFeatured` convention in AGENTS.md §9 |
   | `id: 1` (number) | `id`/`slug` kebab strings | ids are `String @id` per §9 |

3. **New types** in `src/types/content.ts`: `TimelineEvent { id, year, title, description }`, `BrandValue { id, title, description }`, `MissionStatement { id, label, title, text }`. New fields on `Ingredient` and `JournalArticle` are **required**, not optional — every record gets them.

4. **New service functions** in `src/services/content.ts`, each with its future Supabase query comment: `getIngredientDetails()`, `getIngredientFamilies()`, `getJournalArticles()`, `getFeaturedArticle()`, `getJournalCategories()`, `getTimeline()`, `getBrandValues()`, `getMissionStatements()`. `getIngredients()` and `getLatestArticles()` keep their current signatures.

5. **Categories/families are derived, not hardcoded** — `getIngredientFamilies()` / `getJournalCategories()` compute the distinct set from the records and prepend `"All"`, so adding a record never requires editing a second list.

6. **Client boundaries — two new components, minimal surface:**
   - `src/components/ingredients/IngredientExplorer.tsx` — owns the family filter + selected-ingredient state, renders the grid and detail panel.
   - `src/components/journal/JournalGrid.tsx` — owns the category filter, renders the tab bar and the article grid.
   The featured-article block, all three heroes, and the whole heritage page stay Server Components. Filtering is *not* moved to `?category=` search params, because that would force dynamic rendering and drop these routes out of ISR.

7. **Caching:** `export const revalidate = 3600` on all three, matching §8 (`/journal` ISR 1h) and the `/about` precedent.

8. **Copy is preserved verbatim** across all three pages, including the Kyphi/Cleopatra timeline entries and every "rare fact".

9. **Known dangling links, unchanged and out of scope:** `/perfume/[slug]`, `/journal/[slug]`, `/collections`, `/craftsmanship` routes do not exist yet, so those links 404 today regardless of this change. Four `usedIn` entries (Horus Gold, Lotus Blanc, Isis Rose, Anubis Ombre) also have no product record — they are kept as content and will resolve when the catalog grows.

10. **Colors** map to exact tokens as in the `/about` prompt; the ad-hoc `#1E1A12` "selected card" tint becomes `bg-gold/5` over `bg-surface`, and `#0A0A0A` → `bg-black`.

---

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/types/content.ts` | extend `Ingredient`, `JournalArticle`; add `TimelineEvent`, `BrandValue`, `MissionStatement` |
| `src/data/content.ts` | merge to 8 ingredients / 6 articles with full fields; add `TIMELINE`, `BRAND_VALUES`, `MISSION_STATEMENTS` |
| `src/services/content.ts` | 8 new query functions |
| `src/app/heritage/page.tsx` | full rewrite (Server Component) |
| `src/app/journal/page.tsx` | full rewrite (Server Component + client grid) |
| `src/app/ingredients/page.tsx` | full rewrite (Server Component + client explorer) |
| `src/components/ingredients/IngredientExplorer.tsx` | new client component |
| `src/components/journal/JournalGrid.tsx` | new client component |
| `src/app/about/page.tsx` | `MISSION_VISION` const replaced by `getMissionStatements()` |

No dependency, schema, middleware, route-handler, or `next.config.ts` change.

---

## Implementation requirements

### Shared
- Server Components by default; `'use client'` only in the two new filter components.
- Each page: `export const metadata: Metadata` (title, description, `alternates.canonical`, `openGraph`) + `export const revalidate = 3600` with the §8 reference comment.
- Pages `await` the service functions (`Promise.all` where more than one).
- Section comment banners, `eyebrow` / `gold-line` / `btn-luxury` classes, `text-ivory/50` opacity scale, `font-heading font-normal` headings — matching `src/app/page.tsx`.
- Responsive padding `px-6 md:px-20`, sections `py-24 md:py-36`, `max-w-7xl` / `max-w-350` wrappers.
- Every `Image`: `fill` inside a `relative` parent, explicit `sizes`, `alt` (empty for decorative heroes), `priority` on the hero only.
- Hover zoom via the existing `.img-zoom` class or `group-hover:scale-105`, never inline JS.
- `&apos;` / `&ldquo;` / `&rdquo;` for entities; zero `any`; zero inline `style`.

### `/heritage`
Hero (h-[85vh] min-h-150, gradient scrim, "The Land of / Black Earth") → Philosophy (`1fr` mobile / `1fr_2fr` at `lg`, `section-divider`) → full-bleed quote band (`h-[60vh]`, centered Cinzel pull-quote) → Timeline → Values (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, `gap-px bg-border`) → CTA (`/collections`, `/craftsmanship`).

**Timeline:** rendered from `getTimeline()` as a `<ol>`. Mobile (`< md`): single left-rail layout — vertical gold gradient line at `left-0`, node dots on it, all content right-aligned of the rail. Desktop (`md+`): the existing alternating `1fr 60px 1fr` centered-rail layout. Each entry wrapped in `<Reveal delay={index * STAGGER_STEP}>`; `year` in `text-gold font-heading`.

### `/journal`
- Server page: metadata, `revalidate`, header block (`eyebrow` + `<h1>`), featured-article card (server-rendered `Link` + `Image`, `grid-cols-1 lg:grid-cols-2`, "✦ Featured" marker `aria-hidden`), then `<JournalGrid articles={rest} categories={categories} />`.
- Remove the hardcoded `paddingTop: '80px'`.
- Links use `/journal/${article.slug}`.
- `readTimeMinutes` renders as `{n} min read`; `publishedAt` renders through `formatArticleDate` inside a `<time dateTime={...}>`.
- `JournalGrid` (client): tab bar of `<button type="button">` with `aria-pressed`, gold underline on the active tab, horizontally scrollable on mobile (`overflow-x-auto`); grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border`; renders an empty-state line when a category has no articles.

### `/ingredients`
- Server page: metadata, `revalidate`, hero (`h-[80vh] min-h-150`, "Nature&apos;s / Finest"), then `<IngredientExplorer ingredients={...} families={...} />`, then the CTA band.
- `IngredientExplorer` (client):
  - Sticky filter bar — `sticky top-20 z-40 border-b border-border bg-surface/95 backdrop-blur-md`, tabs `overflow-x-auto` on mobile, `<button type="button" aria-pressed>`.
  - Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0.5 bg-border`; each card a `<button type="button" aria-expanded aria-controls="ingredient-detail">` with image (`h-65 relative`, `img-zoom`), name, `priceTier` rendered as `$`×n with an `aria-label` giving the tier, italic `latinName`, `From {origin}`, and one bordered pill per `families` entry.
  - Selected card: `border-gold/35 bg-gold/5`; clicking the selected card again clears it.
  - Detail panel below the grid, `id="ingredient-detail"`, `grid-cols-1 lg:grid-cols-[400px_1fr]`, `border border-gold/20`: image, `rarity` eyebrow, name, latin name, origin, `gold-line`, description, then two columns — **Found in** (`Link` to `/perfume/${slug}`, gold on hover) and **Rare Facts** (em-dash bullets). Close `<button type="button" aria-label="Close ingredient details">`.
  - Filtering matches against the `families` array (case-insensitive), and clears the selection if the selected ingredient is filtered out.

### `/about`
Replace the local `MISSION_VISION` const with `await getMissionStatements()`; the component becomes `async`. No visual change.

## Security requirements

- Static editorial content only: no user input, no DB, no secrets, no route handler → no Zod boundary required on these routes.
- The two client components receive already-projected, non-sensitive data as props; no service module is imported across the client boundary (`src/services/content.ts` stays server-side).
- Remote images stay within the already-allowlisted `images.unsplash.com`; no new `remotePatterns`.
- No `dangerouslySetInnerHTML`; no new external links.

## Acceptance criteria

- [ ] No file under `src/app/` imports `react-router-dom`; no React hook outside a `'use client'` file.
- [ ] Zero inline `style` props, zero raw hex/rgba, zero raw `<img>` across the three pages.
- [ ] Zero hardcoded record arrays remain in any page file — heritage timeline, values, articles, ingredients, families, categories, and about mission/vision all resolve through `src/services/content.ts`.
- [ ] `Ingredient` and `JournalArticle` remain a single type each; the home page renders unchanged.
- [ ] Families and categories are derived from the records, not hand-listed.
- [ ] All three pages export `metadata` and `revalidate = 3600`.
- [ ] Copy preserved verbatim.
- [ ] No horizontal overflow at 375px, 768px, 1024px, 1440px.
- [ ] Filter tabs and detail-panel controls are `type="button"` with correct `aria-pressed` / `aria-expanded` / `aria-controls`.
- [ ] `npx tsc --noEmit` clean; `npx eslint src` clean; `npm run build` succeeds with `/heritage`, `/journal`, `/ingredients` prerendered.

## Checks to run

```bash
npx tsc --noEmit
npx eslint src
npm run build
```

## Manual test steps

1. `npm run dev`.
2. `/heritage` — hero, philosophy, full-bleed quote, timeline alternating left/right on desktop; at 375px the timeline collapses to a single left rail with no overflow; values grid stacks; CTA buttons stack.
3. `/journal` — featured article renders first with "✦ Featured"; click **Ingredients** in the tab bar → grid shows only ingredient articles and the tab underlines gold; click **All** to restore; card links point at `/journal/<slug>` (not `/journal/1`); dates read "December 2024" and read time reads "8 min read".
4. `/ingredients` — filter bar sticks under the Nav while scrolling; select **Woody** → Oud, Vetiver, Black Iris remain; click **Oud** → detail panel opens below the grid with rarity, latin name, Found in, and Rare Facts; click Oud again or the ✕ → panel closes; switch to **Floral** while Oud is selected → the panel closes rather than showing a hidden ingredient.
5. Keyboard: Tab to a filter tab and an ingredient card, activate with Enter and Space; confirm a visible focus ring and that the detail panel is reachable.
6. Enable "Reduce Motion" and reload each page — content appears immediately with no transition.
7. `/` — home page ingredient rail and journal preview still render correctly with the merged data.
8. Tab titles read "Our Heritage | KHEM Perfumes", "Journal | KHEM Perfumes", "Ingredients | KHEM Perfumes".
