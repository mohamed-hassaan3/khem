# Prompt — Fix the three Arabic-tree defects: broken asset paths, undersized type, stripped wordmark tracking

## Goal

Close three defects introduced or exposed by the `en`/`ar` internationalization pass. All three are presentation- or routing-layer bugs with no data implications:

1. **Broken asset paths cause phantom page renders.** A relative `next/image` src in the Footer resolves against the current URL, so on every `/ar/*` route it 404s into the App Router and renders the entire `[locale]` layout again. Four icon files declared in metadata do not exist and do the same thing on *both* locales. This is what reads as "infinite compiling" in dev.
2. **Arabic type renders too small.** Amiri and IBM Plex Sans Arabic have a markedly smaller apparent size than Cinzel and Inter at identical `px`, and the RTL `letter-spacing: normal` rule removes the wide tracking that gave the 9–13px labels their compensating width.
3. **The `KHEM` wordmark loses its `0.3em` tracking under RTL**, because that same rule catches it — the hero `<h1>` is Latin content that was never marked as an LTR island.

Translation of the `src/data` records is **out of scope** — see `prompts/content-layer-localization.md`.

---

## Skills read

- `AGENTS.md` — §1 operational rules, §2.2 visual language, §3.1 tokens, §12 checklist.
- `prompts/internationalization-en-ar.md` — the pass that introduced `[locale]`, `proxy.ts`, the dictionaries, `ltrIsland()`, and the unlayered RTL tracking rule. All conventions below extend it rather than revise it.
- `prompts/not-found-nextjs-transform.md` — establishes that the 404 page renders the full layout, which is why each broken asset request is expensive.
- No `.agents/skills/*` applies. (Session hooks suggested `ai-sdk`, `verification`, `workflow`, and `v0-dev` on keyword match — none are relevant to an RTL styling and asset-path fix.)

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/components/Footer.tsx` | Line 67: `<Image src="logo/name-logo-transparent.svg" width={1273} height={540} />` — **no leading slash**. Line 19: `socialLinks = ["Instagram", "Facebook", "Pinterest"]`, rendered with `tracking-[0.15em]` and commented as proper nouns identical in both locales. |
| `src/components/Nav.tsx` | Line 176: the same relative src, currently inside a commented-out `<Image>` block. Must be corrected now so uncommenting it later cannot reintroduce the bug. |
| `src/app/[locale]/layout.tsx` | `generateMetadata` declares `icons.icon` = `/favicon.ico`, `/icon.svg`, `/favicon-32x32.png`, `/favicon-16x16.png`; `icons.apple` = `/apple-touch-icon.png`; `icons.shortcut` = `/favicon.ico`; `manifest` = `/site.webmanifest`. |
| `public/` | Contains **only** `logo/` — six brand files. None of the declared icon or manifest files exist there. |
| `src/app/` | Contains `favicon.ico` and `opengraph-image.png` as file-convention metadata. These resolve correctly (verified 200). |
| `src/proxy.ts` | The matcher excludes any path containing a file extension, so `/ar/logo/x.svg`, `/icon.svg`, and `/site.webmanifest` bypass the proxy and fall through to the App Router. |
| `src/app/[locale]/[...rest]/page.tsx` | Catch-all calling `notFound()`. Any unmatched path under a locale therefore renders the full `[locale]` layout — dictionary, Nav, Footer — as a ~56–62 KB HTML document. |
| `src/app/globals.css` | `.eyebrow` `font-size: 10px`, `.nav-link` `11px`, `.btn-luxury` `11px`. Ends with the unlayered rule `[dir="rtl"] body *:not([dir="ltr"]):not([dir="ltr"] *) { letter-spacing: normal; }`. |
| `src/lib/fonts.ts` | `getFontVariables(locale)` mounts Cinzel + Inter for `en`, Amiri + IBM Plex Sans Arabic for `ar`, under the same two CSS variable names. |
| `src/app/[locale]/page.tsx` | Line 84 computes `island = ltrIsland(activeLocale)`. Line 128–130: `<h1 className="… tracking-[0.3em] …">KHEM</h1>` — **not** spread with `island`. Line 125 renders the logo via a static import, which is the pattern to copy. |
| `src/components/i18n/LanguageSwitcher.tsx` | `labelClass("en")` returns `uppercase tracking-[0.2em]`; the `EN` label carries `lang="en"` but **not** `dir="ltr"`, so on an Arabic page the tracking rule strips it. |

### Measured evidence

```
/ar/logo/name-logo-transparent.svg  → 404  text/html  56811 bytes
/icon.svg                           → 404  text/html  62741 bytes
/favicon-32x32.png                  → 404  text/html  62759 bytes
/apple-touch-icon.png               → 404  text/html  62765 bytes
/site.webmanifest                   → 404  text/html  62757 bytes
/favicon.ico                        → 200  image/x-icon
/opengraph-image.png                → 200  image/png
```

Five full App Router renders per Arabic page view; four per English page view.

### Pixel-size literals in scope

76 `text-[Npx]` occurrences across 20 files, distributed:

| Literal | Count |
| :--- | ---: |
| `text-[11px]` | 27 |
| `text-[10px]` | 24 |
| `text-[13px]` | 14 |
| `text-[9px]` | 7 |
| `text-[15px]` / `text-[17px]` / `text-[160px]` | 1 / 1 / 2 |

---

## Decisions and assumptions

1. **Static imports, not corrected string paths.** Fixing `"logo/…"` → `"/logo/…"` repairs today's bug but leaves the class of bug open. Import the asset instead — `import nameLogo from "@/public/logo/name-logo-transparent.svg"` — exactly as `src/app/[locale]/page.tsx` already does for the hero mark. The bundler resolves the path, so a relative URL becomes unrepresentable, and intrinsic dimensions come from the file (drop the manual `width`/`height`).
2. **Delete the dead icon declarations rather than author assets.** Confirmed with the user. Remove the whole `icons` object and the `manifest` field from `generateMetadata`. Next's file-convention metadata then emits the icon link from `src/app/favicon.ico` on its own — explicit `metadata.icons` *overrides* the convention, which is why the current block must go rather than shrink. Do **not** invent SVG/PNG favicons by downscaling the logo. Re-adding entries is a one-line change once real assets land in `public/`.
3. **`appleWebApp` stays.** It declares capability and status-bar style; it does not reference the missing `apple-touch-icon.png`.
4. **The Arabic type scale is one central CSS block**, not 76 call-site edits. Confirmed with the user. It mirrors the technique already proven by the letter-spacing rule: unlayered so it outranks Tailwind's `@layer utilities`, and scoped to skip `[dir="ltr"]` islands so embedded English copy keeps its original scale.
5. **Scope the scale to `[lang="ar"]`, not `[dir="rtl"]`.** Both attributes are set together on `<html>`, so they select identically today — but the *reason* differs. Tracking is a direction problem; size is a font problem. Keying each rule to the attribute that explains it means a future LTR language with a small-x-height face, or an RTL language sharing the Latin faces, lands in the right bucket.
6. **Only sizes ≤ 15px are bumped.** The optical deficit hurts legibility at label sizes; display headings at `text-4xl` and up are already large enough that Amiri reads correctly, and rescaling them would break the editorial composition. `text-[160px]` (the wordmark) is explicitly untouched.
7. **`text-xs` (12px) is included in the bump.** It is used for body-adjacent Arabic copy where 12px Amiri is genuinely hard to read. Flag this one for visual review — if it inflates the layout, it is the first rule to drop.
8. **Latin-in-Arabic strings become islands.** The `KHEM` wordmark, the social platform names, and the `EN` switcher label are all Latin text living on an Arabic page. Marking them `dir="ltr" lang="en"` restores their tracking *and* is the semantically correct annotation for screen readers — one fix, two wins. Use the existing `ltrIsland()` helper wherever a locale is already in scope.
9. **No proxy/matcher change.** Widening the matcher or short-circuiting extension-like paths in `[...rest]` would mask broken links app-wide instead of fixing them, and would make the next dead asset silent. The catch-all's current behavior (a properly localized 404) is correct; the defect is that nothing should be requesting those URLs.

---

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/components/Footer.tsx` | Static logo import; `dir`/`lang` on the social links. |
| `src/components/Nav.tsx` | Correct the commented-out `<Image>` so it is right when revived. |
| `src/app/[locale]/layout.tsx` | Remove `icons` and `manifest` from `generateMetadata`. |
| `src/app/globals.css` | Add the unlayered `[lang="ar"]` type-scale block. |
| `src/app/[locale]/page.tsx` | Spread `island` onto the `KHEM` `<h1>`. |
| `src/components/i18n/LanguageSwitcher.tsx` | `dir="ltr"` on Latin labels. |

No data, type, service, dependency, or config change. `public/` gains no files.

---

## Implementation requirements

### A. Asset paths

1. In `src/components/Footer.tsx`, add `import nameLogo from "@/public/logo/name-logo-transparent.svg";` and render `<Image src={nameLogo} alt={dict.footer.logoAlt} className="h-16 w-auto" />`. Remove the literal `width`/`height` — the static import supplies them, and keeping only `h-16 w-auto` avoids the "width or height modified, but not the other" warning already present in the dev log.
2. Apply the identical correction inside the commented-out block in `src/components/Nav.tsx`, including the import (commented alongside it, so uncommenting is a single contiguous edit).
3. In `src/app/[locale]/layout.tsx`, delete the entire `icons: { … }` object and the `manifest: "/site.webmanifest"` line from the returned metadata. Leave every other field, including `appleWebApp`, untouched.

### B. Arabic type scale

Append to `src/app/globals.css`, **outside** any `@layer`, immediately after the existing RTL tracking rule and sharing its comment style. The comment must state the cause (Amiri/IBM Plex Sans Arabic apparent size + tracking removal), not merely the effect.

```css
[lang="ar"] .eyebrow   { font-size: 12px; }
[lang="ar"] .nav-link  { font-size: 13px; }
[lang="ar"] .btn-luxury { font-size: 12px; }

[lang="ar"] .text-\[9px\]:not([dir="ltr"]):not([dir="ltr"] *)  { font-size: 11px; }
[lang="ar"] .text-\[10px\]:not([dir="ltr"]):not([dir="ltr"] *) { font-size: 12px; }
[lang="ar"] .text-\[11px\]:not([dir="ltr"]):not([dir="ltr"] *) { font-size: 13px; }
[lang="ar"] .text-\[13px\]:not([dir="ltr"]):not([dir="ltr"] *) { font-size: 15px; }
[lang="ar"] .text-\[15px\]:not([dir="ltr"]):not([dir="ltr"] *) { font-size: 17px; }
[lang="ar"] .text-xs:not([dir="ltr"]):not([dir="ltr"] *)       { font-size: 13px; }
```

- The three component classes need no `:not()` guard: `.eyebrow`, `.nav-link`, and `.btn-luxury` are always chrome, never embedded English copy.
- Do **not** add a rule for `text-[160px]`, `text-[17px]` on display elements, `text-sm`, or anything larger.
- Do not touch `line-height`; Tailwind's arbitrary font-size utilities do not set one, and the named utilities' leading remains proportionally correct at these deltas.

### C. Latin islands under RTL

1. `src/app/[locale]/page.tsx` — spread the already-computed `island` onto the wordmark:
   ```tsx
   <h1 {...island} className="mb-4 font-heading text-6xl … tracking-[0.3em] …">
     KHEM
   </h1>
   ```
2. `src/components/Footer.tsx` — the social links are Latin proper nouns (the existing comment says so). Add `dir="ltr" lang="en"` to each `<a>`, or to a single wrapping element covering all three, whichever reads cleaner against the current markup.
3. `src/components/i18n/LanguageSwitcher.tsx` — add `dir="ltr"` alongside the existing `lang={LOCALE_HTML_TAG[locale]}` on both the active `<span>` and the `<Link>`, but **only when the label is Latin**. The `ع` short label and `العربية` full label must not be marked LTR. Derive this from the locale being rendered, next to the existing `labelClass(locale)` branch — do not hardcode a second locale check that could drift from it.

### D. Constraints

- Zero `any`. No new runtime dependencies. No new files.
- Do not alter the existing `[dir="rtl"] … letter-spacing: normal` rule — it is correct; the fix is to mark the exceptions.
- Do not change `src/lib/fonts.ts`. The font choice stands; only its rendered size is compensated.
- Do not touch any `src/data/*.ts` record or any `ltrIsland()` call site that wraps `src/data` content.

---

## Security requirements

- The static import in step A.1 removes an attacker-irrelevant but correctness-critical path ambiguity; no user input reaches any path constructed here.
- Removing `icons`/`manifest` must not remove `metadataBase`, `alternates`, or `robots` — those govern canonical URLs and indexing.
- The new CSS selectors must not use attribute values derived from anything but the literal `ar` / `ltr` strings.
- `src/proxy.ts` and its matcher are unchanged, so the same-origin rewrite guarantee documented there still holds.

---

## Acceptance criteria

1. `curl -s -o /dev/null -w "%{http_code} %{content_type}" http://localhost:3000/ar/logo/name-logo-transparent.svg` no longer describes any URL the app requests — the Footer logo on `/ar` resolves to `/_next/static/media/…svg` and returns **200 with an image content type**.
2. Loading `/ar`, `/ar/craftsmanship`, and `/ar/journal` produces **zero** requests that return `text/html` for an image, script, or manifest destination.
3. `/icon.svg`, `/favicon-32x32.png`, `/apple-touch-icon.png`, and `/site.webmanifest` are no longer referenced by the served HTML on either locale.
4. `/favicon.ico` still resolves 200 and the tab icon still renders, sourced from the file convention.
5. On `/ar`, nav links, eyebrows, footer labels, and legal/microcopy are visibly larger than before and legible at 100% zoom; on `/`, every one of those elements is **pixel-identical** to the current build.
6. On `/ar`, the hero `KHEM` retains its `0.3em` letter-spacing and matches the English rendering; the surrounding Arabic tagline still has `letter-spacing: normal`.
7. English copy embedded in Arabic pages (anything inside an `ltrIsland()`) keeps its original font sizes and tracking — the `:not([dir="ltr"] *)` guards hold.
8. `Instagram / Facebook / Pinterest` and the `EN` switcher label render with their intended tracking on `/ar`; `العربية` and `ع` render with none.
9. No new hydration warnings, and no new `next/image` dimension warnings, in the dev log.

---

## Checks to run

```bash
npm run lint
npx tsc --noEmit
npm run build          # must prerender both locale trees with no new warnings
```

Then, with the dev server running:

```bash
for p in /ar/logo/name-logo-transparent.svg /icon.svg /site.webmanifest /favicon.ico; do
  printf "%-40s " "$p"
  curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "http://localhost:3000$p"
done
```

---

## Exact manual test steps

1. `npm run dev`, then open DevTools → Network with "Preserve log" on.
2. Load `http://localhost:3000/` — filter by `Doc`. Confirm exactly one HTML document; no image or manifest request returns `text/html`.
3. Screenshot the desktop nav and the footer. Keep this as the English baseline.
4. Load `http://localhost:3000/ar`. Confirm again: no image/manifest request returns `text/html`, and the footer wordmark renders instead of showing a broken-image glyph.
5. Watch the dev server terminal while navigating `/ar` → `/ar/craftsmanship` → `/ar/journal` → `/ar/about`. Confirm each route compiles once and the server goes quiet between navigations — no repeating render churn.
6. On `/ar`, inspect the hero `<h1>`: computed `letter-spacing` must be ≈ `0.3em × font-size`, and the element must carry `dir="ltr" lang="en"`.
7. On `/ar`, inspect a nav link, an `.eyebrow`, and a footer link: computed `font-size` must be 13px / 12px / 12–13px respectively, not 11px / 10px / 10–11px.
8. On `/ar/craftsmanship`, inspect a craft-step body (English content inside an `ltrIsland`): computed `font-size` must be **unchanged** from the English page, confirming the `:not()` guard.
9. Return to `http://localhost:3000/` and diff against the step-3 screenshots — the English tree must be untouched.
10. Open the mobile drawer at 375px on `/ar`: labels legible, `العربية` unspaced, `English` spaced.
11. Confirm the browser tab icon still appears on both locales.
