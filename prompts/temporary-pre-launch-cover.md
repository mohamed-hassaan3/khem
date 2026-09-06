# Temporary Pre-Launch Cover

Implementation prompt for `src/docs/Temporary-Pre-Launch-Cover.md`.

> **Status: SHIPPED and verified — 2026-09-06.**
> Decisions changed twice: once at approval, once after testing. Both are marked
> **[ADJUSTED]** where they appear, and the later reversals are recorded rather
> than tidied away, because the reasoning is the useful part.
>
> 1. **The film.** Withdrawn at approval, then **restored**. The cover was built
>    around an authored CSS light field with a swappable film source; the
>    Cloudinary reel is now configured through that seam —
>    `KHEM_PRELAUNCH_VIDEO_URL`, one variable, no component change. The
>    architecture was never tied to the video, which is exactly why putting it
>    back cost nothing.
> 2. **Configuration** collapses to one boolean, `KHEM_PRELAUNCH`. The
>    three-state mode, the preview token and the staff cookie are all gone; the
>    private production preview reuses `getAdminActor()` and needs no config.
> 3. **Navigation.** "Leave `Nav.tsx` untouched" did not survive contact: the
>    bounce reads as a broken search box. The header and footer now shed their
>    shop controls while the flag is on.

---

## Goal

A temporary, fully isolated **Coming Soon** cover for the KHEM storefront,
mounted so it switches on and off from a single boolean and disappears in one
commit when the house opens.

While it is active:

- `/` and `/ar` render the cover instead of the home page.
- Commerce routes (products, collections, sets, rituals, cart, checkout, search,
  new arrivals) send the visitor back to the cover.
- Editorial routes — the World of KHEM — stay open and unchanged.
- `/admin`, `/account`, the auth routes, `/unsubscribe` and `/api/*` are never
  touched.

When it is off, **every route behaves exactly as it does today**, byte for byte.

---

## Skills read

None of the three approved skills (`.agents/skills/clerk`, `supabase`, `ai-sdk`)
bear on this task and none were read: the cover writes no schema, calls no model,
and changes no authentication. `src/proxy.ts`'s existing `clerkMiddleware()`
wrapper is preserved untouched — the new gate is a plain branch inside the
handler Clerk already wraps, and it reads no session.

The reference actually used was the repository: `src/proxy.ts`,
`src/app/design-preview/` (the sibling-root-layout precedent),
`src/lib/admin/auth.ts` (the existing authorisation mechanism the private
preview reuses), `src/app/globals.css` (design tokens) and
`src/docs/khem-ui-design-system.md`.

---

## Existing code inspected

| File | What it settled |
| :--- | :--- |
| `src/proxy.ts` | The only routing chokepoint. Clerk wrap → account/admin early shed → locale rewrite (`/x` → `/en/x`, `/ar/*` passes through) → currency cookie. Already carries a documented bypass for `/design-preview`, which is the exact shape the cover's bypass takes. |
| `src/app/[locale]/layout.tsx` | The **only** root layout: Nav, Footer, CartDrawer, AnnouncementBar, OfferPopup, CookieConsent, CinematicIntro and eight providers. Anything rendered under it inherits all of that. |
| `src/app/design-preview/{layout,page}.tsx`, `preview.css` | Proof that a **sibling root layout** outside `[locale]/` is an established pattern here, inherits none of the shell, and is removed by deleting one folder plus one bypass. |
| `src/lib/admin/auth.ts` | `getAdminActor(): Promise<AdminActor \| null>` — session present, primary email **verified**, address on `ADMIN_EMAILS` (defaulting to `khem.official@outlook.com`). Server-only. **This is the existing authentication mechanism §12 asks us to prefer, and it is what makes the private production preview need zero new configuration.** |
| `src/actions/newsletter.ts` | `subscribeToNewsletter({ email, company, locale })` → `FormActionResult`. Writes a real row via `subscribe()`, sends the welcome once, rate-limits 5 per 10 min, honeypot field `company`. **This is the existing subscription mechanism and the cover calls exactly it.** |
| `src/components/home/NewsletterForm.tsx` | The client-side contract for that action: email pattern pre-check, honeypot, `isPending`, success/error copy keys. The cover's form mirrors this and adds nothing. |
| `src/components/marketing/OfferPopup.tsx` | Mounted in the `[locale]` layout, gated on `offerPopupEnabled` + consent answered. Because the cover has its own root layout, **the popup cannot render over it** — no code change is needed to keep it off the cover, and none is made. |
| `src/app/globals.css` | The live token set. KHEM is **one light environment**: ivory `#f7f5f0`, stone `#efebe4`, sand `#e8e1d5`, ink `#242321`, gold `#b08d57`, and `--color-gold-deep #8a6a3f` — the *only* gold permitted as text on a light ground (4.9:1; plain `--color-gold` is 2.6:1 and fails). Also ships the `.field` input class the cover reuses. |
| `src/lib/i18n/config.ts` | `stripLocale()` → `{ locale, path }`, `localizePath()`. The gate is written against `stripLocale` so `/cart` and `/ar/cart` cannot fall out of step — the same discipline the account shed already follows. |
| `src/lib/fonts.ts` | `getFontVariables("en")` — Cinzel (`--font-heading`) + Inter (`--font-body`), `preload: false`. |
| `src/app/robots.ts` | Literal-path disallow list, both locale trees listed explicitly. |
| `public/logo/*` | `full-logo-transparent.webp` (2000×1089) is falcon + **KHEM** + **The Essence of Heritage**, gold on transparent — it already carries two of the brief's three lines, so the third is the only one set as type. |
| `next.config.ts`, `vercel.json` | No change required by this work. |

---

## [ADJUSTED] 1 · The film

### The asset: withdrawn, then restored

`https://res.cloudinary.com/co1xzkhf/video/upload/KHEM-ESSENCE-indoor.mp4` —
1920×1080, 16.07s, 14.59 MB, flowing ivory silk in a warm interior — was pulled
at approval and reinstated afterwards. **The UI is still not built around it.**

That distinction is the whole point of the seam described below: the cover
renders the authored light field, a configured film layers over it, and no part
of the composition is tuned to any frame of any video. Restoring the reel was
therefore a one-line environment change, not a redesign — and swapping it for a
different film later will be the same.

It is served through a Cloudinary **delivery** transformation,
`q_auto,c_limit,w_1280`, which leaves the stored asset untouched and takes the
download from **14.59 MB to 1.56 MB**. Verified playing: `readyState` 4,
1280×720, no error.

### What can actually be produced here — tooling audit

Encoding a real `.mp4` from this environment was investigated before choosing an
approach. The result:

| Tool | Present |
| :--- | :--- |
| `ffmpeg` / `avconv` / `gst-launch-1.0` | **no** |
| `avconvert` (macOS) | yes — transcodes existing media only, cannot build from frames |
| ImageMagick (`convert` / `magick`) | **no** |
| Python `numpy` / `PIL` / `pyobjc` | **no** (system Python 3.9, no site packages) |
| `node_modules` encoders | none (`sharp` is stills only) |
| Homebrew | present, but installing `ffmpeg` is a slow, machine-wide change and is **not** taken unilaterally |

So a genuine video file cannot be authored in this session without modifying the
developer's machine. The brief anticipates exactly this and permits the fallback:
*"create the implementation so it uses a suitable generated placeholder or clearly
defined local asset location that can be replaced later without changing the
component architecture."*

### What ships instead: the light field

An **authored CSS/SVG motion layer**, written here to the KHEM direction — warm
ivory and sand, soft natural light, champagne accents, slow editorial movement.
Concretely, six stacked layers inside the film box:

1. **Ground** — `linear-gradient(160deg, #faf8f4, #f2ede3 42%, #e8e1d5 78%, #ded4c4)`.
2. **Sun drift** — a 140vmax warm-white radial travelling a shallow arc on a 48s
   alternating loop. Light moving across a limestone wall.
3. **Champagne bloom** — a 90vmax `rgba(208,178,122,.26)` radial counter-drifting
   on 64s, `mix-blend-mode: soft-light`, so the gold reads as light and not paint.
4. **Fluting** — `repeating-linear-gradient(90deg, transparent 0 118px, rgba(36,35,33,.03) 118px 120px)`,
   radially masked to fade at the edges, panning ~40px over 90s. Temple columns
   and pleated linen, at the threshold of visibility.
5. **Haze** — a soft sand vignette holding the corners.
6. **Grain** — an inline `feTurbulence` SVG as a data URI, 180px tile, `opacity:.05`,
   `mix-blend-mode: multiply`, jittered on a 2-step 8fps loop so it reads as film
   rather than as a texture.

Only `transform` and `opacity` animate, on 48–96s alternating loops with no
bounce. Under `prefers-reduced-motion: reduce` every layer freezes at its
mid-point, which is a composed still rather than an absence.

This costs **≈0 KB** of network payload against ~1.5 MB for a video, cannot flash
black while loading, and needs no poster asset.

### Swapping in a real video later — the whole procedure

`src/lib/prelaunch.ts` exports one value:

```ts
/** A film to play over the light field, or `null` to use the field alone. */
export const PRELAUNCH_FILM_SRC: string | null =
  process.env.KHEM_PRELAUNCH_VIDEO_URL ?? null;
```

- **Local file:** drop it at `public/prelaunch/khem-cover.mp4` and set
  `KHEM_PRELAUNCH_VIDEO_URL=/prelaunch/khem-cover.mp4`.
- **Remote (Cloudinary, Blob, anywhere):** set the variable to the full URL.

`<PrelaunchFilm>` renders the light field **always**, and layers the `<video>`
over it only when a source is configured, fading it in on `canplay`. So:

- there is never a black frame — the light field *is* the poster, which is why no
  poster asset is required;
- no frame of any particular video is baked into the composition;
- replacing the film touches one environment variable and no component, no route,
  and no styling.

The veil and the type scrim below are tuned to guarantee legibility over an
*arbitrary* bright film, not over the light field specifically — that is what
keeps the design from being hardcoded around one frame.

---

## [ADJUSTED] 2 · Configuration — one boolean

### What you manage

```env
KHEM_PRELAUNCH=false   # normal KHEM website (default)
KHEM_PRELAUNCH=true    # Coming Soon cover
```

That is the entire surface. **No** modes, **no** token, **no** cookie, **no**
second switch. The uncommitted `NEXT_PUBLIC_KHEM_PRELAUNCH=` line currently in
`.env.example` is deleted and replaced by this one.

**Server-only, not `NEXT_PUBLIC_`** — per your instruction to take the safer
option. A `NEXT_PUBLIC_` value is compiled into the JavaScript every visitor
downloads, so the site would advertise its own pre-launch switch to anyone who
opened the bundle; and the gate runs in the proxy, which has no need of a client
value.

### Fail-safe parsing

`prelaunchEnabled()` returns `true` **only** for an exact `"true"` after
trimming and lower-casing. Unset, empty, `"false"`, `"1"`, `"yes"`, `"TRUE "`
with a stray space — trimmed and folded, so `"TRUE"` and `" true "` do work,
because a value the owner clearly meant as yes should not silently mean no.
Anything that is not the word *true* means **off**, and off means the site
behaves precisely as it does today. There is no configuration mistake that can
produce a half-covered site: the flag is read once, and every consequence hangs
off that single boolean.

### The private production preview — no configuration at all

The brief's §12 asks for a way to see the cover on the deployed site without
showing it to customers, and says to **prefer an existing authentication
mechanism**. This project has a strong one, so the preview uses it and adds
nothing:

```
KHEM_PRELAUNCH=false  (the default, and how production sits today)
        │
        ├── anybody          → /prelaunch answers 404
        └── signed-in admin  → /prelaunch renders the full cover
```

`/prelaunch` calls `getAdminActor()` from `src/lib/admin/auth.ts`; a `null`
answer is `notFound()`. Admin means *session present, primary email verified,
address on `ADMIN_EMAILS`* — the same bar as the dashboard, checked server-side
against `currentUser()` and never against anything the browser sent.

So the deployed production URL `https://khemperfumes.com/prelaunch` shows you the
live cover while every customer continues to get the normal website, and there is
no secret to store, rotate or leak.

When `KHEM_PRELAUNCH=true`, `/` rewrites to `/prelaunch` and the page renders for
everyone **without** calling Clerk at all — the auth check exists only on the
`false` branch, so covering the site never makes the home page auth-dependent.

### Full behaviour table

| `KHEM_PRELAUNCH` | Visitor | Signed-in admin |
| :--- | :--- | :--- |
| unset / `false` / anything not `true` | Site exactly as today. `/prelaunch` → 404 | Site as today. `/prelaunch` → **the cover** (private preview) |
| `true` | `/` → cover; commerce → 307 to `/`; editorial open | Same, plus `/admin` and `/account` untouched as always |

---

## [ADJUSTED] 3 · Navigation — *revised after testing*

**First decision (superseded):** leave `Nav.tsx` and `Footer.tsx` untouched and
let shop links bounce to the cover.

**What testing showed:** the bounce is indistinguishable from a bug. It was
reported as "search shows the perfumes and prices but won't navigate to the
PDP" — which was the gate working exactly as designed, seen from outside. The
search overlay calls `/api/search`, which the proxy never touches, so results
render; the click then lands on `/perfume/<slug>` and is redirected home.

**Second decision (approved, shipped):** while the flag is on, the header sheds
the Collections trigger, the search control and the bag — in the desktop bar and
in the mobile drawer, plus the drawer's two shop sections and their dividers —
and the footer sheds its Collections column. Implemented as a `prelaunch` prop
from the `[locale]` layout and seven guards that are `false` in every normal
deployment; with the flag off all three files render exactly what they did
before, verified in both states.

Deliberately **not** trimmed: links inside editorial page *content* (`/heritage`
carries eight in-body collection links). Those still bounce to the cover. Fixing
them means editing content rather than chrome, and is out of this feature's
scope.

---

## Remaining decisions and assumptions

1. **Mount point: a sibling root layout at `src/app/prelaunch/`, reached by
   rewrite.** Not a conditional branch inside `[locale]/page.tsx` — that inherits
   Nav, Footer, CartDrawer, OfferPopup, CinematicIntro and eight providers, i.e.
   exactly the "page underneath" §3 forbids, and it could not cover anything but
   `/`. The sibling layout inherits none of it, and `design-preview/` already
   proves the pattern works in this app.

2. **Copy is English only.** It is hardcoded in the cover components rather than
   added to the dictionaries — the cover lives outside `I18nProvider` entirely,
   so dictionary keys would buy nothing, and `src/lib/i18n/dictionaries/{en,ar}.ts`
   are currently modified by the in-flight hero-slider work and **must not be
   touched**. `/ar` renders the same English cover. The subscribe form's status
   strings are read from the English dictionary on the server and passed as props,
   so the cover cannot drift from the site's own wording.

3. **`/unsubscribe` is never gated.** It is the address in every marketing email
   the house has already sent. Gating it would be a compliance problem, not a
   cosmetic one.

4. **The commerce list is explicit, not a denylist.** A fixed list of today's
   commerce prefixes, so no editorial or legal page can be blocked by accident and
   so "when disabled, everything behaves exactly as today" is trivially true.

5. **Changing the flag requires a redeploy.** Environment variables referenced in
   the proxy are resolved at build time for the edge bundle. The launch checklist
   says so rather than pretending a dashboard toggle is instant.

6. **SEO.** In the covered state every product and collection URL answers **307**
   — temporary, deliberately never 308 or 301 — so nothing is cached past launch
   and the index recovers on its own. The sitemap and `robots.txt` are not
   rewritten, per §20. The cover carries the home page's own title, description
   and canonical when it is serving `/`, so the homepage keeps its identity; it
   carries `noindex` only in the admin-preview case, which no crawler can reach.

---

## Files

### New

| Path | Role |
| :--- | :--- |
| `src/lib/prelaunch.ts` | The whole policy in one file: `prelaunchEnabled()`, `PRELAUNCH_PATH`, `PRELAUNCH_FILM_SRC`, path classification. Imported by the proxy and the page so the two cannot disagree. |
| `src/app/prelaunch/layout.tsx` | Sibling root layout — `<html lang="en" dir="ltr">`, font variables, own metadata. Imports `../globals.css` so the cover uses the real tokens. |
| `src/app/prelaunch/prelaunch.css` | Cover-only classes: the six light-field layers and their keyframes, the veil, the staged entrance, the underline sweep. Plain CSS on `--color-*` variables; does not re-import Tailwind. |
| `src/app/prelaunch/page.tsx` | Server Component. Flag on → render for everyone. Flag off → `getAdminActor()`, render for an admin, `notFound()` otherwise. Metadata by branch. |
| `src/components/prelaunch/PrelaunchCover.tsx` | Server Component. Composition: film, veil, logo, COMING SOON, the two CTAs, the quiet footer line. |
| `src/components/prelaunch/PrelaunchFilm.tsx` | Client, small. The light field always; a `<video>` faded in over it when `PRELAUNCH_FILM_SRC` is set; both stilled under `prefers-reduced-motion`. |
| `src/components/prelaunch/PrelaunchPanels.tsx` | Client. Owns which of the three states the CTA slot is in — idle / World of KHEM / Inner Circle — plus Esc-to-close and focus return. |
| `src/components/prelaunch/PrelaunchSubscribe.tsx` | Client. The Inner Circle form; calls `subscribeToNewsletter` and nothing else. |
| `src/docs/prelaunch.md` | The permanent "How to use this later" handbook (§27). |

*(No preview endpoint, no cookie module, no token — deleted from the plan by
adjustment 2.)*

### Modified

| Path | Change |
| :--- | :--- |
| `src/proxy.ts` | One bypass for `/prelaunch`, one gate block before the locale rewrite. Nothing existing is reordered or rewritten. |
| `src/app/robots.ts` | `/prelaunch` added to `DISALLOWED`. |
| `.env.example` | `NEXT_PUBLIC_KHEM_PRELAUNCH=` removed; `KHEM_PRELAUNCH` and the optional `KHEM_PRELAUNCH_VIDEO_URL` documented. |
| `AGENTS.md` | A short subsection pointing at `src/docs/prelaunch.md`, marked temporary, listing the exact removal footprint. |

**Nothing else.** In particular: no change to `Nav.tsx`, `Footer.tsx`,
`OfferPopup.tsx`, `NewsletterForm.tsx`, `actions/newsletter.ts`, `sitemap.ts`,
`next.config.ts`, `vercel.json`, any Supabase SQL, or any file under
`src/app/[locale]/`. The four files currently modified in the working tree by the
hero-slider task (`page.tsx`, `Hero.tsx`, both dictionaries) must be left exactly
as they are.

---

## Implementation requirements

### `src/lib/prelaunch.ts`

```ts
export const PRELAUNCH_PATH = "/prelaunch";
export const PRELAUNCH_FILM_SRC: string | null;
export function prelaunchEnabled(): boolean;
export function isPrelaunchExempt(path: string): boolean;
export function isGatedCommercePath(path: string): boolean;
```

- `prelaunchEnabled()` — `true` only when `KHEM_PRELAUNCH`, trimmed and
  lower-cased, is exactly `"true"`.
- `isPrelaunchExempt(path)` — never gated, checked first: `/admin`, `/account`,
  `/sign-in`, `/sign-up`, `/unsubscribe`, `/prelaunch`, `/design-preview`. Prefix
  matches must respect segment boundaries, so `/accounts-payable` does not match
  `/account`.
- `isGatedCommercePath(path)` — exactly these, as `===` or `${p}/` prefix:
  `/perfume`, `/collections`, `/set`, `/ritual`, `/cart`, `/checkout`, `/search`,
  `/new-arrival`.
- Every branch carries a comment saying what a wrong answer would cost, in the
  register the rest of the repository uses.

### `src/proxy.ts`

Two additions, both minimal:

1. Beside the `DESIGN_PREVIEW_PATH` bypass, let `/prelaunch` through without the
   locale rewrite (it lives outside `[locale]/`, so the rewrite would 404 it).
2. After the account/admin shed and **before** `localeRewrite(request)`:

```
if prelaunchEnabled() and not isPrelaunchExempt(path):
    if path === "/"                   → rewrite  to PRELAUNCH_PATH
    else if isGatedCommercePath(path) → redirect to localizePath(locale, "/"), 307
```

- **Rewrite** for `/` so the address bar keeps the canonical home URL.
- **307** for the redirects — temporary, explicitly never 308 or 301.
- Destinations are built from the request's own origin and a locale that came out
  of `stripLocale`, so no crafted path can steer one off-site.
- The result still passes through `withCurrencyCookie()`, like every other return
  in the file.
- When the flag is off the branch short-circuits before `stripLocale`, so the
  default configuration costs one string comparison per request and nothing else.

### `src/app/prelaunch/page.tsx`

- Flag on → render the cover; **no** Clerk call on this path.
- Flag off → `await getAdminActor()`; render for an admin, `notFound()` otherwise.
- `export const dynamic = "force-dynamic";` — the response depends on a server
  variable and, on the off branch, on a session. The cover performs **zero**
  database reads, so a covered home page is a trivial render; that is the whole
  cost, and it is worth stating given this repository's Vercel-usage history.
- Metadata: serving `/` → the home page's title, description and
  `alternates.canonical = ${SITE_URL}/`, indexable. Admin preview → `noindex,
  nofollow`.

### Reuse of the subscription mechanism

`PrelaunchSubscribe.tsx` imports `subscribeToNewsletter` from
`@/src/actions/newsletter` and calls it with `{ email, company, locale: "en" }`.
That is the whole integration. It creates **no** new action, table, endpoint,
audience, email template, discount or storage key, and it inherits the existing
rate limit, honeypot, validation, row write and welcome letter unchanged.

---

## Visual specification

### Composition

```
┌──────────────────────────────────────────────┐
│                                              │
│                    [ falcon ]                │  full-logo-transparent.webp
│                     K H E M                  │  (falcon + wordmark + tagline
│              The Essence of Heritage         │   are all in the artwork)
│                                              │
│                      ────                    │  gold hairline, 64px
│                                              │
│                  C O M I N G   S O O N       │  Cinzel, ink, 0.42em tracking
│                                              │
│                                              │
│              WORLD OF KHEM  →                │  primary, gold underline sweep
│                                              │
│              JOIN THE INNER CIRCLE           │  secondary, quieter
│                                              │
│         © 2026 KHEM Fragrance House          │  ink-subtle, 11px
└──────────────────────────────────────────────┘
      light field (or film) full-bleed behind everything
```

### Layers

1. **Film** — `absolute inset-0`, `overflow-hidden`. The light field described
   above; plus, when configured, `<video autoPlay muted loop playsInline
   preload="metadata">` at `object-cover`, `opacity 0 → 1` over 600ms on
   `canplay`. `aria-hidden="true"`, `tabIndex={-1}`, no `controls`.
2. **Veil** — `absolute inset-0`, `pointer-events-none`, two gradients, tuned for
   an *arbitrary* bright film rather than for the light field:
   - warm wash `linear-gradient(180deg, rgba(247,245,240,.52) 0%, rgba(247,245,240,.22) 38%, rgba(232,225,213,.50) 100%)`
   - vignette `radial-gradient(120% 90% at 50% 45%, transparent 42%, rgba(36,35,33,.16) 100%)`
   Plus a soft ivory radial directly behind the type column, so the words hold
   even if a future film is busy exactly there.
3. **Content** — centred column, `max-w-[46rem]`, `px-6`, `min-h-[100svh]`,
   `justify-center`, bottom padding `max(2rem, env(safe-area-inset-bottom))`.

### Type

| Element | Spec |
| :--- | :--- |
| Logo | `next/image`, **static import** (never a string path — a relative `src` resolves against the URL directory, the bug documented in `Nav.tsx`), `priority`, `sizes="(min-width: 768px) 420px, 72vw"`, width `clamp(232px, 58vw, 420px)`. `alt="KHEM — The Essence of Heritage"`, wrapped in the page's single `<h1>`. |
| Gold rule | 1px × 64px, `background: var(--color-gold)`, opacity .55, `margin: 2.5rem auto`. |
| COMING SOON | `font-heading` (Cinzel) 500, uppercase, `letter-spacing: .42em` with matching `text-indent` so the optical centre is true, `clamp(.75rem, 1.6vw, 1rem)`, `color: var(--color-ink)`. |
| WORLD OF KHEM | Cinzel 500, uppercase, `.26em`, `clamp(.8rem,1.4vw,.9rem)`, `--color-ink`, trailing `→` in an `aria-hidden` span. |
| JOIN THE INNER CIRCLE | Inter 500, uppercase, `.22em`, `.7rem`, `--color-ink-muted`, → `--color-gold-deep` on hover. |
| Footer line | Inter, `.65rem`, `.18em`, `--color-ink-subtle`. |

Gold as **text** uses `--color-gold-deep` only, per the accessibility rule
`globals.css` states outright. `--color-gold` appears solely as the hairline rule
and the underline — non-text, where 2.6:1 is fine.

### Panels

Both replace the CTA pair in place — no modal, no overlay, no focus trap.

- **World of KHEM** — five links, stacked, 60ms stagger, Cinzel `.25em`:
  Our Heritage → `/heritage`, Craftsmanship → `/craftsmanship`,
  Ingredients → `/ingredients`, Journal → `/journal`, About KHEM → `/about`.
  No perfume or collection link appears — that is the "delete the perfumes links"
  note, and it is also what the gate enforces. Plain `<a href>`, since the cover
  is outside the app's `<LocaleLink>` provider and these are English URLs by
  definition. A quiet `Close` control returns to the CTA pair.
- **Inner Circle** — one email field using the existing `.field` class, the
  submit button copied in dimensions from `NewsletterForm`'s (`border-transparent`
  + `leading-6`, for the reason documented there), the off-screen honeypot, and
  the success panel in `--color-gold` on `gold/5`.
- Esc closes either; focus returns to the trigger that opened it; opening moves
  focus to the first control inside.

### Motion

- Entrance, CSS only, `cubic-bezier(0.16, 1, 0.3, 1)`, 700ms, `opacity 0→1` +
  `translateY(8px→0)`: logo 0ms, rule 140ms, COMING SOON 260ms, CTAs 400ms.
- Hover: underline `scaleX(0→1)` from the inline start, 300ms ease-out. No bounce,
  no spring, no parallax, no spinner.
- `@media (prefers-reduced-motion: reduce)`: entrances become instant opacity 1,
  the light field freezes mid-drift, and any configured video is paused.

### Responsive

| | Behaviour |
| :--- | :--- |
| ≥1024px | As drawn. Logo 420px. `100svh`, no scrollbar, no horizontal overflow. |
| 768–1023px | Logo `min(58vw, 360px)`, spacing steps down one notch, hierarchy unchanged. |
| ≤767px | Logo `min(72vw, 300px)`, tracking relaxed to `.28em` so no CTA wraps, CTAs stacked with 1.25rem between, column shifted below centre, `100svh` + safe-area padding. Not a shrunk desktop layout. |

### Accessibility

Semantic `<main>`; one `<h1>` (the logo, carrying the name in `alt`); real
`<button>` and `<a>`; the film `aria-hidden` and untabbable; visible
`:focus-visible` ring in `--color-gold-deep` at 2px with 2px offset;
`role="status"` on the subscribe result; ink-on-veil contrast ≥ 7:1 everywhere
type sits.

---

## Security requirements

1. The gate never inspects a session and changes no authentication or
   authorisation path. `/admin`, `/account`, `/sign-in`, `/sign-up`,
   `/unsubscribe` and `/api/*` are exempt before any other check runs.
2. The private preview reuses `getAdminActor()` unchanged — verified primary
   email against `ADMIN_EMAILS`, server-side, never from a cookie or header. No
   new secret is introduced, so there is none to leak or rotate.
3. `/prelaunch` answers `notFound()` for a non-admin while the flag is off, so the
   surface does not exist in the default configuration.
4. Redirects are built from the request's own origin, so no crafted path can steer
   one off-site.
5. `KHEM_PRELAUNCH` is server-only and never reaches the client bundle.

---

## Acceptance criteria

- [ ] With `KHEM_PRELAUNCH` unset, every route answers exactly as it does on
      `main` today, and the proxy does one extra string comparison per request.
- [ ] `KHEM_PRELAUNCH=true`: `/` and `/ar` render the cover; `/perfume/x`,
      `/collections`, `/cart`, `/checkout`, `/search`, `/set/x`, `/ritual/x`,
      `/new-arrival` answer 307 to `/`; `/heritage`, `/craftsmanship`,
      `/ingredients`, `/journal`, `/about`, `/stockists` and the legal pages render
      normally; `/admin`, `/account`, `/sign-in`, `/unsubscribe` are untouched.
- [ ] `KHEM_PRELAUNCH=false` + signed-in admin → `/prelaunch` renders the cover.
- [ ] `KHEM_PRELAUNCH=false` + anyone else → `/prelaunch` 404s.
- [ ] `KHEM_PRELAUNCH=1` / `yes` / `TRUE ` behave correctly (the last is `true`;
      the first two are off).
- [ ] The cover ships the real logo asset — no CSS or text reconstruction of it.
- [ ] The cover renders no Nav, Footer, CartDrawer, AnnouncementBar, CookieConsent,
      OfferPopup or CinematicIntro, and mounts none of the eight providers.
- [ ] Setting `KHEM_PRELAUNCH_VIDEO_URL` plays a film over the light field with no
      component edit; unsetting it returns to the field.
- [ ] Subscribing from the cover writes the same row and sends the same welcome as
      the home page form; `git diff` touches neither `actions/newsletter.ts` nor
      `NewsletterForm.tsx` nor `OfferPopup.tsx`.
- [ ] No horizontal scrollbar and no layout shift at 320, 375, 768, 1024, 1440,
      1920.
- [ ] `prefers-reduced-motion: reduce` stills the field and every entrance.
- [ ] `lint`, `tsc --noEmit` and `build` all pass, with zero `any`.

---

## Checks to run

```bash
npm run lint
npx tsc --noEmit
npm run build
```

There is no `typecheck` script in `package.json`; `npx tsc --noEmit` is the
equivalent, and `next build` type-checks as well. There is no test runner in this
repository, so no test command is claimed. Results get reported as executed —
including failures.

---

## Manual test steps

```bash
# 1 — default: nothing changed
#   (KHEM_PRELAUNCH absent from .env.local)
npm run dev
#   → /            normal home page
#   → /prelaunch   404 (signed out) · the cover (signed in as an ADMIN_EMAILS user)
#   → /cart        normal cart

# 2 — the cover
#   .env.local:  KHEM_PRELAUNCH=true
npm run dev
#   → /                     the cover
#   → /ar                   the cover (English)
#   → /perfume/<slug>       307 → /
#   → /cart /checkout /search /collections /new-arrival /set/x /ritual/x  307 → /
#   → /heritage /craftsmanship /ingredients /journal /about /stockists   normal
#   → /admin                normal dashboard
#   → /account              normal (sign-in redirect if anonymous)
#   → /unsubscribe?token=…  normal

# 3 — the panels
#   click WORLD OF KHEM        → five editorial links, no perfume links
#   press Esc                  → returns to the CTA pair, focus back on the trigger
#   click JOIN THE INNER CIRCLE, submit a real address
#     → success panel; confirm the row in Supabase "NewsletterSubscriber" and the
#       welcome email — the same path the home page form takes

# 4 — swapping the film
#   .env.local:  KHEM_PRELAUNCH_VIDEO_URL=/prelaunch/khem-cover.mp4
#   (with any .mp4 at that path)
#   → the film fades in over the light field; no black frame at any point
#   unset it → the light field alone, unchanged composition

# 5 — reduced motion
#   macOS: System Settings → Accessibility → Display → Reduce motion
#   → the field holds still; nothing animates in

# 6 — responsive
#   320 / 375 / 768 / 1024 / 1440 / 1920 — no horizontal scroll, no CTA wrap,
#   logo and both CTAs visible without scrolling at every width
```

Production preview after deploy, with `KHEM_PRELAUNCH=false` still set:

```
https://khemperfumes.com/prelaunch   → the cover, for a signed-in admin only
```

---

## Launch procedure

1. Vercel → Project → Settings → Environment Variables → set `KHEM_PRELAUNCH`
   to `false` (or delete it).
2. Redeploy — the value is resolved at build time, so a redeploy is required.
3. Verify `/`, `/perfume/<slug>` and `/cart` answer normally.
4. Later, when it is certainly no longer wanted, delete in one commit:
   `src/app/prelaunch/`, `src/components/prelaunch/`, `src/lib/prelaunch.ts`,
   `src/docs/prelaunch.md`, `public/prelaunch/` if used, the two blocks in
   `src/proxy.ts`, the `/prelaunch` line in `robots.ts`, the entries in
   `.env.example`, and the AGENTS.md subsection. That is the complete footprint —
   nothing else in the repository will reference it.
