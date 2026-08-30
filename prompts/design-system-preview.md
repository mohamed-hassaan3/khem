# Design System Preview — `/design-preview`

## Goal

Stand up an **isolated, non-production visual showcase** of the design direction
specified in `src/docs/khem-ui-design-system.md`, so the house can approve the
visual direction *before* any of it is applied to the live application.

Nothing in the customer-facing site or the admin dashboard changes in this step.

## Skills read

None of the three approved skills (`clerk`, `supabase`, `ai-sdk`) apply — this
task touches no auth, no schema, and no model calls. It is presentational only.

## Existing code inspected

- `src/app/globals.css` — the live token set (`@theme`): obsidian `#0d0d0d`,
  surface `#1a1a1a`, card `#242424`, gold `#c8a96a`, champagne `#e6d6a8`,
  ivory `#f7f4ec`. Body is a **dark radial gradient**, sitewide, unconditionally.
- `src/app/[locale]/layout.tsx` — the single root layout (there is no
  `app/layout.tsx`); mounts fonts, `<Nav>`, `<Footer>`, `<AnnouncementBar>`,
  `<OfferPopup>`, `<CookieConsent>` and five providers.
- `src/proxy.ts` — locale rewrite (`as-needed` prefixing) wrapping
  `clerkMiddleware`; every unprefixed path is rewritten into `/en/*`.
- `src/components/ecommerce/ProductCard.tsx` — server card, `aspect-3/4` image,
  collection label, name, subtitle, note pills, price row. **No add-to-bag
  control inside it**; `<AddToBagButton>` is overlaid by the grid.
- `src/components/ecommerce/ProductPrice.tsx`, `ProductFlag.tsx`, `Price.tsx`.
- `src/components/Nav.tsx` — fixed header, `top-[var(--announcement-h)]`,
  transparent then `bg-background` on scroll. Ivory-on-dark in both states.
- `src/components/marketing/AnnouncementBar.tsx` — `bg-black`, static /
  carousel / marquee.
- `src/components/marketing/OfferPopup.tsx` — two-column obsidian modal.
- `src/components/admin/AdminShell.tsx`, `AdminTable.tsx`, `fields.tsx` — the
  admin surface, also entirely obsidian/ivory.
- `src/lib/fonts.ts` — Cinzel/Inter (en), Amiri/IBM Plex Sans Arabic (ar), both
  pairs mounted under the same `--font-heading` / `--font-body` variables.

### Audit finding

The application today is **single-mode dark**. The proposed system is
four-ground (obsidian / charcoal / sand / ivory) with gold demoted to a 5%
accent. That is not a re-skin — it is a second, light half of the system that
does not exist yet. It therefore has to be shown before it is applied.

## Decisions / assumptions

1. **Isolation over integration.** The preview is a *sibling root layout* at
   `src/app/design-preview/`, outside the `[locale]` tree, so it inherits no
   `<Nav>`, no `<Footer>`, no providers, and no locale rewrite. It cannot
   regress a production page because it shares no component with one.
2. **Proposed tokens are scoped, not global.** They are declared on
   `.khem-preview` in `src/app/design-preview/preview.css`, prefixed `--k-*`.
   `globals.css` and its `@theme` block are **not touched**. Deleting the
   `design-preview` folder removes the entire proposal.
3. **The showcase re-draws components; it does not import them.** Importing the
   live `<ProductCard>` would only show what already exists. Each specimen is a
   local, static re-drawing under the proposed tokens, so old and new can sit
   side by side.
4. **No data access.** No Prisma/Supabase call, no `getDictionary`, no auth.
   Specimen copy is hard-coded English. Product imagery is an inline SVG flacon
   rather than a remote photograph, so the page renders identically offline.
5. **One proxy line.** `/design-preview` is let through the locale rewrite
   before it can be pushed into `/en/*`. Clearly commented as removable.

## Files changed

- `src/app/design-preview/layout.tsx` *(new)* — sibling root layout.
- `src/app/design-preview/preview.css` *(new)* — proposed `--k-*` tokens.
- `src/app/design-preview/page.tsx` *(new)* — the showcase.
- `src/app/design-preview/_kit/*.tsx` *(new)* — specimen sections.
- `src/proxy.ts` — one early bypass.

## Implementation requirements

Sections, in order, all of them required by the review brief:

1. Colour system — every ground and accent as a labelled swatch with hex,
   role, and the doc's 40/40/15/5 distribution.
2. Typography — Cinzel display scale, Inter body scale, eyebrow/label
   treatment, on both dark and light grounds.
3. Buttons — primary (obsidian on light), primary inverse (ivory on dark),
   gold, ghost/outline, icon, disabled; all with hover and focus states shown.
4. Inputs — text, textarea, select, quantity, toggle, error and hint states, on
   both grounds. Minimum 16px on mobile (iOS zoom threshold).
5. Product cards — the proposed card with the bag **icon** replacing the
   "Add to Cart" text, on ivory and on obsidian; equal-height demonstration
   with deliberately unequal copy; 4/3/2 responsive grid.
6. Cards & surfaces — collection card, journal card, sand panel, elevation
   scale, radius and border rules.
7. Navigation — over-hero transparent state and scrolled ivory state, plus the
   mobile drawer.
8. Announcement bar — on both grounds, static and marquee.
9. Subscribe popup — the two-column modal, light and dark treatment.
10. Pricing & promotional states — base price, promoted pair, percent chip,
    sold out, campaign flag, badge, low stock.
11. Admin dashboard — charcoal rail, ivory content, stat cards, table, form
    row, and the **mobile card fallback** for tables.
12. Mobile & desktop — the same surfaces drawn in a 390px frame and a desktop
    frame, side by side.

## Security requirements

- Preview is presentational; it reads no session, no database, no environment.
- It must not be linked from any production navigation.
- The proxy bypass grants no privilege — it only skips the locale rewrite.
- Route is trivially removable before production; noted in the layout header.

## Acceptance criteria

- `/design-preview` renders every one of the twelve sections above.
- No file under `src/app/[locale]/`, `src/components/`, or `src/app/globals.css`
  is modified.
- TypeScript and ESLint clean.
- Page renders with no network access and no database.
- Zero spring/bounce motion; all curves `cubic-bezier(0.16, 1, 0.3, 1)`.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`

## Manual test steps

1. Start the dev server.
2. Open `http://localhost:3000/design-preview`
3. Read top to bottom; the section index at the top jumps to each block.
4. Resize to 390px / 834px / 1440px, or use the built-in device frames in the
   final section, to check the responsive claims.
5. Confirm `http://localhost:3000/` is visually unchanged.
