# Prompt — Bring `src/app/not-found.tsx` onto the design system

## Goal

Finish the SPA→Next migration for the 404 page. Unlike the other five pages, this one is **already a valid Server Component in the right place** — it uses `next/image` and `next/link` and it builds (`/_not-found` appears in the route table). The remaining work is styling and correctness: inline styles → theme tokens, plus responsiveness and accessibility.

---

## Skills read

- `AGENTS.md` — §1 rules, §2 design language, §3 tokens, §11 component standards, §12 checklist.
- No `.agents/skills/*` applies. (Session hook suggested `vercel-queues` on keyword match — not relevant to a 404 page.)
- Prior prompts in `prompts/` — same colour and layout conventions, reused.

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/app/not-found.tsx` | 118 lines. Server Component, correct imports, no hooks. Every element styled with an inline `style` object; all colours raw hex/rgba; `fontFamily: "'Cinzel', serif"` twice. |
| `src/app/page.tsx` | The hero already implements this exact visual — concentric `rounded-full border border-gold/10` rings and a radial `color-mix` wash — in Tailwind. Reuse that idiom rather than inventing a second one. |
| `src/app/layout.tsx` | Renders `<Nav />`, children, `<Footer />`; `body` carries `bg-background font-body text-ivory`. Owns the `<title>` template. |
| `src/app/globals.css` | `.gold-line`, `.btn-luxury`, `.btn-luxury-fill` available. |
| `public/logo/logo-transparent.svg` | Imported as a static `logo` — the home hero renders it at 40×40. |

### Defects to fix

1. **`paddingTop: "80px"` combined with `minHeight: "100vh"`** makes the element 100vh + 80px tall, so the 404 page always scrolls by exactly the Nav height. Use `min-h-[calc(100vh-5rem)]` instead of padding + full viewport height.
2. Inline `style` on every element; raw `#0D0D0D`, `#F7F4EC`, `rgba(200,169,106,…)`, `rgba(247,244,236,0.4)`.
3. `fontFamily: "'Cinzel', serif"` bypasses the `--font-heading` variable set by `next/font` — those two elements are not actually rendering in Cinzel today.
4. Decorative rings hardcoded at 700px / 1000px with no breakpoint — oversized on a phone (clipped by `overflow-hidden`, so no scrollbar, but the composition is wrong).
5. The giant `404` numeral is announced by screen readers as content, duplicating the `<h1>`; it is decoration and should be `aria-hidden`.
6. `alt="KHEM"` on the logo beside a heading that already names the page → should be `alt=""` (decorative).
7. `priority` on the logo — a 404 page is not an LCP-critical route; drop it.
8. `marginBottom: "-20px"` magic overlap between the numeral and the heading.
9. CTA buttons are a fixed `flex` row → cramped at 375px; must stack below `sm`.
10. The background wash and both rings lack `aria-hidden` / `pointer-events-none` (only the rings have the latter).

---

## Decisions and assumptions

1. **No `metadata` export.** Next's `not-found.tsx` convention does not support a `metadata`/`generateMetadata` export — the title comes from the root layout's template. Adding one would be inventing an API that does nothing.
2. **Ring sizes become responsive** using the home hero's pattern: a smaller pair below `sm`, the 700/1000px pair from `sm` up.
3. **Copy preserved verbatim**, including "like perfume dispersing into warm air."
4. **Colour mapping:** `#0D0D0D` → `bg-background`, `#F7F4EC` → `text-ivory`, `rgba(200,169,106,0.12)` → `text-gold/12`, ring borders → `border-gold/5` and `border-gold/3`, body copy → `text-ivory/40`, radial wash → `color-mix(in srgb, var(--color-gold) 4%, transparent)` exactly as in `page.tsx`.
5. `/collections` does not exist yet, so that CTA 404s today — unchanged and out of scope, same as on the other pages.

---

## Files likely to change

- `src/app/not-found.tsx` — full rewrite (only file changed).

No data, type, service, dependency, or config change: this page has no records to move into the data centre.

---

## Implementation requirements

- Root: `relative flex min-h-[calc(100vh-5rem)] items-center justify-center overflow-hidden bg-background px-6 text-center`.
- Radial wash: `pointer-events-none absolute inset-0` + `aria-hidden`, using the `bg-[radial-gradient(ellipse_at_center,_color-mix(in_srgb,var(--color-gold)_4%,transparent)_0%,_transparent_60%)]` idiom from `page.tsx`.
- Rings: one `aria-hidden` `pointer-events-none absolute inset-0` wrapper holding two centred `rounded-full` divs — `h-100 w-100 border-gold/5 sm:h-175 sm:w-175` and `h-150 w-150 border-gold/3 sm:h-250 sm:w-250`.
- Logo: `Image` at 40×40, `alt=""`, `opacity-40`, no `priority`, centred with `mb-10`.
- Numeral: `aria-hidden` `<p>` in `font-heading font-bold leading-none text-gold/12`, `text-8xl sm:text-9xl lg:text-[160px]`, `-mb-5` replaced by a normal `mb-0` with the heading carrying its own spacing.
- `<h1>`: `font-heading text-2xl font-normal tracking-widest text-ivory sm:text-3xl md:text-4xl`.
- `gold-line mx-auto mb-7`.
- Body copy: `mx-auto mb-12 max-w-100 text-sm leading-loose text-ivory/40`.
- CTAs: `flex flex-col justify-center gap-4 sm:flex-row` — `/` with `btn-luxury btn-luxury-fill`, `/collections` with `btn-luxury`.
- Zero inline `style`, zero raw hex, zero `any`.

## Security requirements

- Static page, no user input, no data access, no secrets, no route handler → no validation boundary applies.
- No `dangerouslySetInnerHTML`; no external resources; the only asset is the local logo import.

## Acceptance criteria

- [ ] Zero inline `style` props and zero raw hex/rgba in the file.
- [ ] Page occupies the viewport without the 80px scroll overhang.
- [ ] Headings render in Cinzel (via `font-heading`), verifiable in DevTools.
- [ ] Decorative numeral, rings, wash, and logo are all hidden from assistive tech; the `<h1>` is the only announced heading.
- [ ] No horizontal overflow at 375px, 768px, 1440px; CTAs stack below `sm`.
- [ ] Copy preserved verbatim.
- [ ] `npx tsc --noEmit` clean; `npx eslint src` clean; `npm run build` succeeds.

## Checks to run

```bash
npx tsc --noEmit
npx eslint src
npm run build
```

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/this-route-does-not-exist`.
2. Confirm the page fills the viewport with **no vertical scrollbar** (the current version always scrolls ~80px).
3. Inspect the `404` numeral and the `<h1>` in DevTools → computed `font-family` is Cinzel, not the browser's default serif.
4. Resize to 375px: rings stay centred and proportionate, copy stays readable, the two CTAs stack.
5. Run the browser's accessibility tree (or a screen reader) → only "Page Not Found" is announced as a heading; the numeral and logo are not read out.
6. Click **Return Home** → `/`. (**Explore Collections** still 404s — `/collections` is not built yet.)
