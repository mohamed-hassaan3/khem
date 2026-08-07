# Prompt — Mobile Navigation + Gold Line Consistency

## Goal

1. Make every inline "gold divider line" on the home page render with the same
   symmetric gradient as the `.gold-line` component class used around the
   testimonial carousel (`transparent → gold → transparent`), instead of the
   one-sided `from-gold to-transparent` variants currently used.
2. Make `Nav.tsx` fully usable on mobile / small screens. Today it renders a
   fixed three-column desktop bar (left links, centre logo, right icons) with
   `px-12` and two fixed-position mega menus using a 3-column grid and `80px`
   horizontal padding — all of which overflow and collide below ~1024px.

## Skills read

- None of `.agents/skills/{clerk,supabase,ai-sdk}` apply — this is a pure
  presentational Tailwind v4 / React client-component task.
- Followed AGENTS.md §2.2 (motion language), §3 (tokens), §11 (component
  standards).

## Existing code inspected

- `src/app/page.tsx` — gold line usages:
  - L103 hero divider: `bg-linear-to-r from-transparent via-gold to-transparent` (already correct, reference)
  - L218 brand-story divider: `bg-linear-to-r from-gold to-transparent` (inconsistent)
  - L268 craft-pillar divider: `bg-linear-to-r from-gold to-transparent` (inconsistent)
  - L391 / L393: `.gold-line` class (reference look)
  - L90/L91 hero side rules and L133 scroll indicator: intentionally one-sided
    fades anchored to the viewport edge / bottom — **out of scope, unchanged**.
- `src/app/globals.css` — `.gold-line` (L126), `.mega-menu` (L209), `.nav-link` (L234).
- `src/components/Nav.tsx` — client component, scroll-solidify state,
  `menuOpen` + `menuPath` mega-menu state, overlay close button.
- `src/constants/navigation-pages.ts` — `collections` and `world` arrays reused
  by the mobile panel (no new data invented).

## Decisions / assumptions

- Breakpoint for the desktop → mobile switch: `lg` (1024px), because the mega
  menu needs a real 3-column grid to look right.
- Mobile pattern: hamburger button on the left, centred logo, account/search on
  the right; tapping the hamburger slides in a full-height panel from the left
  containing accordion-free, flat sections ("Our Collections", "Discover",
  "Stockists") built from the existing constants.
- Motion stays linear/ease-out with the luxury bezier — no spring, no bounce
  (AGENTS.md §2.2).
- The existing desktop mega-menu behaviour is preserved untouched on `lg+`.
- Nav height stays `h-20` (80px) so `.mega-menu { top: 80px }` remains valid.

## Files likely to change

- `src/app/page.tsx` — two divider class strings.
- `src/components/Nav.tsx` — responsive layout + mobile panel.
- `src/app/globals.css` — responsive `.mega-menu` padding; hide mega menus below
  `lg` (mobile uses the drawer instead).

## Implementation requirements

### Gold lines
- Replace `bg-linear-to-r from-gold to-transparent` with
  `bg-linear-to-r from-transparent via-gold to-transparent` at `page.tsx:218`
  and `page.tsx:268`. Keep existing widths (`w-12`, `w-10`) and margins.
- Remove the stale `{/* gold-line mx-auto mt-12 */}` comment at L217.

### Nav — mobile
- Bar padding becomes responsive: `px-5 sm:px-8 lg:px-12`.
- Logo scales: `h-10 sm:h-12 lg:h-14`.
- Left link cluster and the wishlist/search icons are `hidden lg:flex`.
- New `lg:hidden` hamburger button (animated two-bar → X, `aria-expanded`,
  `aria-controls`, `aria-label`), 44×44 tap target.
- New mobile panel:
  - `fixed inset-y-0 left-0 z-[1001] w-[85%] max-w-sm`, obsidian background with
    `backdrop-blur-xl`, right border `border-border`.
  - Slides via `translate-x-0` / `-translate-x-full` with
    `duration-500 ease-[var(--ease-luxury-bezier)]`; scrollable (`overflow-y-auto`).
  - Sections: "Our Collections" (from `collections`, label + desc), "Discover"
    (from `world`), then Stockists / Wishlist / Account links.
  - Each section header uses the `eyebrow` class; a `gold-line` divider separates
    sections.
  - Full-screen `bg-black/60` backdrop button closes the panel.
  - Panel closes on route change (`pathname` effect) and on any link click.
  - `aria-hidden` + `pointer-events-none` when closed so hidden links are not
    focusable/tabbable.
- Body scroll lock while the mobile panel is open, restored on close/unmount.
- Desktop mega-menu state is force-closed when switching into the mobile panel
  (and vice versa) so the two never overlap.

### globals.css
- `.mega-menu` padding responsive: `32px 24px` by default, `48px 80px` from
  `1024px` up.
- `.mega-menu { display: none }` below `1024px` (mobile uses the drawer).

## Security requirements

- No data access, no auth, no user input — presentational only.
- No `dangerouslySetInnerHTML`; all links come from the typed constants file.

## Acceptance criteria

- [ ] All home-page horizontal gold dividers fade in from transparent on both
      ends and read identically to the ones bracketing the testimonials.
- [ ] At 320px–1023px: no horizontal overflow, logo centred, hamburger visible,
      drawer opens/closes smoothly, links navigate and auto-close the drawer.
- [ ] At 1024px+: nav renders exactly as before, mega menus behave unchanged.
- [ ] Keyboard: hamburger focusable, drawer links focusable only when open,
      Escape closes the drawer.
- [ ] Zero TypeScript errors, zero ESLint errors, no `any`.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev` → open `http://localhost:3000`.
2. DevTools responsive mode at 375px: confirm the nav fits, tap the hamburger,
   confirm the drawer slides in from the left over a dimmed backdrop, background
   does not scroll, tap "Noir Collection" → navigates and drawer closes.
3. Press Escape with the drawer open → it closes.
4. Resize to 1440px: confirm hamburger disappears, "Collections" / "The World of
   KHEM" mega menus still open and close on outside click.
5. Scroll the home page: confirm the dividers under "Born from the Cradle of
   Civilization" and inside each craftsmanship pillar now fade on both ends,
   matching the testimonial dividers.
