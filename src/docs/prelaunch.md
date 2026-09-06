# KHEM Pre-Launch Cover — Developer Handbook

> ⚠️ **Temporary feature.** It exists to hold the storefront closed until KHEM
> opens, and it is designed to be deleted afterwards. See
> [Removing it permanently](#removing-it-permanently).

The implementation prompt of record is
`prompts/temporary-pre-launch-cover.md`. This file is the operating manual.

---

## 1. The one switch

```env
KHEM_PRELAUNCH=false   # normal KHEM website  ← the default, and production today
KHEM_PRELAUNCH=true    # Coming Soon cover
```

That is the whole configuration. There are no modes, no tokens, no cookies and
no second switch to keep in step.

**Anything that is not the word `true` means off**, and off means the site
behaves exactly as it did before this feature existed. `false`, empty, unset,
`1`, `yes`, a typo — all off. The value is trimmed and lower-cased first, so
`TRUE` and a stray trailing space still read as on: somebody who writes those
plainly meant yes.

It is **server-only** (no `NEXT_PUBLIC_` prefix). A public variable would be
compiled into the JavaScript every visitor downloads, and the only thing that
reads this is `src/proxy.ts`, which runs on the server.

> **Changing it on Vercel requires a redeploy.** Not because the value is baked
> into the bundle — it is read at runtime, verified locally with `next start` —
> but because Vercel binds environment variables to a *deployment*. Editing the
> value in the dashboard leaves the running deployment on its old value until you
> redeploy. Locally, restarting the server is enough.

### What each state does

| Route | `KHEM_PRELAUNCH=false` | `KHEM_PRELAUNCH=true` |
| :--- | :--- | :--- |
| `/`, `/ar` | Home page | **The cover** |
| `/perfume/*`, `/collections*`, `/set/*`, `/ritual/*`, `/cart`, `/checkout`, `/search`, `/new-arrival` | Normal | **307 → `/`** (or `/ar`) |
| `/heritage`, `/craftsmanship`, `/ingredients`, `/journal*`, `/about`, `/stockists`, legal pages | Normal | Normal — open on purpose |
| `/admin*`, `/account*`, `/sign-in*`, `/sign-up*`, `/unsubscribe`, `/api/*` | Normal | Normal — never covered |
| `/prelaunch` | 404, **except for an admin** (see §3) | The cover |

The redirects are **307 (temporary)**, never 301/308, so no browser or crawler
caches the closed shop past launch.

---

## 2. Running it locally

```bash
# .env.local
KHEM_PRELAUNCH=true
```

```bash
npm run dev
# → http://localhost:3000/   the cover
```

Set it back to `false` (or delete the line) for the normal site. No other step,
and no cache to clear.

---

## 3. Previewing on production without showing anyone

This is the point of §12 of the original brief, and it costs **no extra
configuration**: production stays at `KHEM_PRELAUNCH=false` — every customer
keeps getting the real website — and you open

```
https://khemperfumes.com/prelaunch
```

You will see the deployed cover if, and only if, you are signed in with a
verified email address on the `ADMIN_EMAILS` allowlist — the same check that
guards `/admin`, via `getAdminActor()` in `src/lib/admin/auth.ts`. Everyone else
gets a 404, which does not even confirm that the address exists.

So the workflow is:

```
edit → deploy → visit /prelaunch as an admin → verify → customers still see the shop
```

There is no secret to store, rotate or leak, because the preview reuses the
authentication the project already has.

---

## 4. Replacing the video

The cover ships with an **authored light field** — six layers of CSS: an
ivory-to-sand ground, a sun drifting on a 48s arc, a champagne bloom, faint
vertical fluting, a sand haze and film grain. It costs no network payload and no
client JavaScript, and it is the shipped default.

**The house film is currently configured** (`.env.local`):

```env
KHEM_PRELAUNCH_VIDEO_URL=https://res.cloudinary.com/co1xzkhf/video/upload/q_auto,c_limit,w_1280/KHEM-ESSENCE-indoor.mp4
```

Note the `q_auto,c_limit,w_1280` segment. That is a Cloudinary *delivery*
transformation — the stored asset is untouched — and it takes the file from
**14.59 MB to 1.56 MB**. Removing that segment serves the original at full size;
there is no reason to.

To play a different film, set **one variable**:

```env
# a file you added under public/
KHEM_PRELAUNCH_VIDEO_URL=/prelaunch/khem-cover.mp4

# …or anything remote
KHEM_PRELAUNCH_VIDEO_URL=https://res.cloudinary.com/<cloud>/video/upload/q_auto,c_limit,w_1280/<asset>.mp4
```

Unset it and the light field renders alone again.

**That is the entire procedure.** No component, route or stylesheet changes
either way — which is the requirement the architecture was built around.

Notes worth having when you swap one in:

- **No poster image is needed, ever.** The light field renders *underneath* the
  film permanently and the video fades in only once its first frame decodes, so
  there is never a black rectangle and never a blank frame.
- **Nothing is tuned to one frame.** The veil over the film
  (`.khem-cover-veil`) is calibrated for an arbitrary *bright* film, not for the
  shipped field, so the charcoal type stays legible without re-tuning.
- **Keep it light.** KHEM is a light-first brand; a dark, high-contrast film will
  fight the charcoal type and the ivory veil. Warm ivory, sand, soft natural
  light, slow movement.
- **Compress it.** Serve roughly 1–2 MB, not 15. On Cloudinary,
  `q_auto,c_limit,w_1280` is a delivery transformation — it does not alter the
  stored asset.
- The element is `autoPlay muted loop playsInline preload="metadata"`, so the
  film must work silently. Audio is never unmuted.

---

## 5. Editing the cover's content

All of it is English and lives in two files:

| What | Where |
| :--- | :--- |
| "Coming Soon", the copyright line, the layout, the logo | `src/components/prelaunch/PrelaunchCover.tsx` |
| "World of KHEM", "Join the Inner Circle", "Close", and the five editorial links | `src/components/prelaunch/PrelaunchPanels.tsx` |
| The signup form's words | not here — read from `src/lib/i18n/dictionaries/en.ts` so the cover cannot drift from the site |
| The moving background, the veil, the entrance | `src/app/prelaunch/prelaunch.css` |

The **KHEM** and **The Essence of Heritage** lines are not text — they are inside
`public/logo/full-logo-transparent.webp`. Do not retype them beneath the mark.

`/ar` shows this same English cover. If it is ever translated, the `dir="ltr"` in
`src/app/prelaunch/layout.tsx` and the hardcoded `locale: "en"` in
`PrelaunchSubscribe.tsx` both have to change with it.

---

## 6. Files this feature owns

Safe to edit — nothing else imports them:

```
src/lib/prelaunch.ts                             the flag, the path lists
src/app/prelaunch/layout.tsx                     sibling root layout
src/app/prelaunch/page.tsx                       flag check + admin preview + metadata
src/app/prelaunch/prelaunch.css                  the light field, veil, motion
src/components/prelaunch/PrelaunchCover.tsx      composition
src/components/prelaunch/PrelaunchFilm.tsx       background layers
src/components/prelaunch/PrelaunchVideo.tsx      the optional film
src/components/prelaunch/PrelaunchPanels.tsx     the two doors
src/components/prelaunch/PrelaunchSubscribe.tsx  the signup form
src/docs/prelaunch.md                            this file
```

### Files this feature touches — change with care

```
src/proxy.ts                  two blocks, both marked ⚠️ TEMPORARY
src/app/[locale]/layout.tsx   reads the flag, passes it to Nav and Footer
src/components/Nav.tsx        a `prelaunch` prop and six guards
src/components/Footer.tsx     a `prelaunch` prop and one guard
src/app/robots.ts             one entry, marked ⚠️ TEMPORARY
.env.example                  two variables
```

**Why the header and footer had to change.** They are not covered by the cover:
a visitor reading `/heritage` while the shop is closed still sees them. Left
alone, the header went on offering search, the Collections menu and the bag —
every one of which the proxy answers with a redirect back to Coming Soon. It
presented as a bug ("search finds perfumes but won't open them") because that is
what it is from the outside.

So while the flag is on, the header drops the Collections trigger, the search
control and the bag (in the desktop bar *and* the mobile drawer, plus the
drawer's two shop sections and their dividers), and the footer drops its
Collections column. Everything else — World of KHEM, Stockists, the locale
switcher, the account icon, the whole footer besides that one column — is
untouched.

Each block is wrapped in a guard that is `false` in every normal deployment, so
with the flag off these three files render exactly what they rendered before.
Verified both ways.

**What is deliberately *not* trimmed:** links inside editorial page *content*.
`/heritage`, for example, has eight in-body links to collections in its own
copy. Those still bounce to the cover. Changing them means editing page content
rather than chrome, which is out of this feature's scope — and they are far less
prominent than a search box in the header.

### Files you must NOT edit for this feature

The cover deliberately reuses these and duplicates none of them. If you find
yourself editing one to make the cover work, the change is in the wrong place:

```
src/actions/newsletter.ts                the subscription mechanism
src/components/home/NewsletterForm.tsx   the home page's form
src/components/marketing/OfferPopup.tsx  the existing popup
src/components/Nav.tsx, Footer.tsx       the existing navigation
src/app/[locale]/**                      the entire real website
src/app/sitemap.ts                       untouched on purpose
prisma/, supabase/                       no schema change belongs to this feature
```

**Why the popup needs no change:** `<OfferPopup>` is mounted in
`app/[locale]/layout.tsx`. The cover is a *sibling root layout*, so it is a
different document and the popup cannot render over it. That is achieved by
where the cover sits, not by a flag — which is why the popup is not in this
feature's diff and must not be.

**Why the subscription needs no change:** `PrelaunchSubscribe` calls the existing
`subscribeToNewsletter()` action, so it inherits the same rate limit, honeypot,
validation, subscriber row and welcome letter. There is no second subscriber
system anywhere in this feature.

---

## 6b. One thing the flag does *not* touch: the announcement bar

The bar above the header is house content, not chrome, so the cover leaves it
alone — and it will happily go on advertising "a complimentary 5 ml miniature
with the purchase of any fragrance" while there is nothing to purchase.

That is a switch you already own, and it needs no code change:
**Admin → Marketing → announcements**, or turn the bar off entirely with
`announcementsEnabled`. Left on, consider rewording it to something that suits a
house that has not opened yet.

---

## 7. Launch checklist

1. Vercel → Settings → Environment Variables → `KHEM_PRELAUNCH` = `false`
   (or delete it).
2. **Redeploy.**
3. Check `/`, one `/perfume/<slug>`, and `/cart` — all normal.
4. Done. The shop is open.

Nothing else changes: no database migration, no ecommerce code, no sitemap, no
`robots.txt` rewrite, no page edits.

### Removing it permanently

Once you are sure it will not be needed again, one commit deletes the whole
thing:

```bash
rm -rf src/app/prelaunch src/components/prelaunch src/lib/prelaunch.ts \
       src/docs/prelaunch.md public/prelaunch
```

then remove:

- the two ⚠️ TEMPORARY blocks and the `./lib/prelaunch` import in `src/proxy.ts`
  (also drop `localizePath` from that import if nothing else there uses it);
- the `/prelaunch` entry in `src/app/robots.ts`;
- `KHEM_PRELAUNCH` and `KHEM_PRELAUNCH_VIDEO_URL` from `.env.example` and from
  Vercel;
- the pre-launch section in `AGENTS.md`.

That is the complete footprint. Nothing else in the repository references it.

---

## 8. SEO, stated plainly

- **While off:** literally nothing changes. The block in `src/proxy.ts`
  short-circuits on one string comparison.
- **While on:** a crawler requesting `/` receives the cover *at* `/` — a rewrite,
  not a redirect — and that response carries the **home page's own** title,
  description and canonical, so the front page keeps its identity and stays
  indexable. Product and collection URLs answer 307, so they leave the index for
  the duration and return on their own afterwards. This is unavoidable if the
  shop is to be closed, and it is why the redirects are temporary rather than
  permanent.
- `sitemap.xml` and `robots.txt` are **not** rewritten. While the cover is up the
  sitemap lists URLs that temporarily redirect, which is expected and harmless.
- `/prelaunch` itself is disallowed in `robots.txt` and sends `noindex` on the
  admin-preview branch, so it never becomes a second address for the front page.

---

## 9. Accessibility and performance notes

- The background is `aria-hidden` and untabbable — decorative in full.
- The logo is the page's only `<h1>`; its accessible name comes from `alt`.
- Every control is a real `<button>` or `<a>`, with a gold-deep focus ring.
- `prefers-reduced-motion: reduce` freezes the field mid-drift (a composed still,
  not a blank one), cancels every entrance, and pauses any configured film.
- With no film configured the cover ships **no** background asset and **no**
  background JavaScript; the only client code is the two panels and the form.
- While the cover is up, `/` is a dynamic render rather than a cached page. It
  performs **zero** database reads, so the cost is the JSX and nothing else.
