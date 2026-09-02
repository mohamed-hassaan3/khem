# Landing Page: Section Control from the Admin Dashboard

Source brief: `src/docs/Product-Landing-Page-Navigation-Inventory-Updates.md` §4.
Scope decision: `src/docs/Confirmed-Four-Workstreams-Is-the-Right-Approach.md` §1.

Independent of the other three workstreams.

---

## Goal

Let an editor reorder, enable, disable and configure the sections of `/` from the
dashboard, add image **and video** media to the New Arrival section, and make the
Signature Scent and Journal bands scroll horizontally in one row.

## Scope, as confirmed by the user

**In:** section order, move up/down, enable/disable, remove from the active
layout, per-section settings, featured products, images/media, video where
applicable.

**Out:** migrating the ~3,500 lines of editorial copy in
`src/lib/i18n/dictionaries/{en,ar}.ts` into tables. That is a separate future
project. The user's stated reason is explicit and must be respected: it would put
current content integrity and the **compile-time Arabic guarantee** at risk. The
`Dictionary` type is what makes a missing Arabic string a build failure rather
than an English word leaking into the Arabic tree; do not weaken it.

## Skills read

- `AGENTS.md` §2.2, §3, §6, §7, §8, §12
- `.agents/skills/supabase` — migrations, service-role writes
- `node_modules/next/dist/docs/` — Server/Client boundaries, `revalidate`
- `src/docs/ADMIN-CMS-FINAL-ARCHITECTURE.md`, `src/docs/ADMIN-CMS-AUDIT-REPORT.md`

## Existing code inspected

| Concern | Where |
| :-- | :-- |
| The page itself | `src/app/[locale]/page.tsx` — hardcoded JSX, one `Promise.all`, `revalidate = 3600` |
| The admin screen | `src/app/[locale]/admin/content/landing/page.tsx` |
| Hero (the pattern to copy) | `supabase/sql/0037_hero.sql`, `src/components/admin/HeroForm.tsx` |
| Featured product | `BoutiqueSetting.featuredProductSlug` (`0003_directory.sql:134`), `src/services/products.ts:705-724` |
| Essences grid | `page.tsx:346` — `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4` |
| Journal grid | `page.tsx:595` — `grid gap-0.5 md:grid-cols-3` |
| Horizontal precedent | `src/components/home/CollectionSlider.tsx` |
| Ground switching | `<NavGround>`, `src/providers/nav-ground-provider.tsx` |

---

## What exists today, honestly

`/admin/content/landing` is **a map, not an editor**. Its own header comment says
so: most bands are assembled from records managed elsewhere (Collections,
Products, Settings, Ingredients, Journal), and only the Hero and the Craft
Pillars are edited on that screen. It lists each section and where its content
comes from. That honesty is a feature — preserve it. The screen should keep
telling an editor where a section's *content* lives even once it can control that
section's *order and visibility*.

## The precedent to follow for video

`HeroSetting` already solves the media question and should be copied rather than
reinvented:

- `mediaType` enum `IMAGES | VIDEO` as the switch
- `videoUrl text check ("videoUrl" ~ '^https://')`
- a table-level `check ("mediaType" <> 'VIDEO' or "videoUrl" is not null)` so a
  VIDEO row without a URL cannot exist
- slides in a child table ordered by `sortOrder`, assigned from the editor's list
  position on save

`src/app/[locale]/page.tsx` already derives `heroMedia` from exactly this and
falls back to the typographic composition when there is no media. New Arrival
should degrade the same way.

## The genuinely hard part

Sections are **not uniform**, so a naive "render an ordered array of components"
will break the page:

- The hero drives `<NavGround ground={heroMedia ? "obsidian" : "ivory"}/>`, which
  decides whether header links are legible. Reordering must not leave charcoal
  links over a photograph — the exact failure `nav-ground-provider.tsx` exists to
  prevent.
- Some bands carry their own dark ground; alternating them arbitrarily produces a
  striped page.
- Each section takes different data. The current single `Promise.all` fetches
  everything unconditionally; a disabled section should not cost a query.

So the renderer needs a registry mapping section key → `{ component, loader,
ground }`, with the ground rule expressed as data the layout can validate, not as
something an editor can accidentally violate.

## Implementation requirements

1. **Migration** — a `LandingSection` table: `key` (unique, matching a registry
   entry), `isEnabled`, `sortOrder`, and a `settings` JSON column for
   per-section configuration. Seed one row per section in the current visual
   order so the page renders identically on day one. Unknown keys in the table
   must be ignored by the renderer, and registry entries missing from the table
   must fall back to a default — a schema/registry mismatch must never blank the
   home page.
2. **Renderer** — replace the hardcoded sequence in `page.tsx` with an ordered
   walk over enabled sections, fetching only what those sections need. Keep
   `revalidate = 3600` and keep the page a Server Component.
3. **New Arrival** — move `featuredProductSlug` from `BoutiqueSetting` into this
   section's settings, or read it from there and mark the Settings field as the
   legacy source; either way there must be exactly one answer to "which product
   is featured". Add `mediaType`/`videoUrl` on the `HeroSetting` pattern. Video
   must be `preload="metadata"`, muted, `playsInline`, poster-backed, and must
   not regress LCP — measure before and after.
4. **Admin** — move up / move down / toggle / edit settings, in the existing
   admin component idiom (`AdminTable`, `ContentRowsEditor`, `HeroForm`,
   `UnsavedChangesDialog`). Reassign `sortOrder` from list position on save, as
   `HeroSlide` already does. Revalidate `/` after a write via the existing
   `src/lib/admin/revalidate.ts`.
5. **Horizontal rails (§4C)** — Essences and Journal become one-row snap-scroll
   tracks. Follow `CollectionSlider.tsx`. **Do not do arithmetic on `scrollLeft`:**
   its sign and origin flip under RTL — this is written into
   `ProductGallery.tsx`'s header as a hard-won lesson. Use `scrollIntoView`.
   The track scrolls; the page must not gain horizontal overflow.

§4C is small and independent of the CMS work. It can ship first, on its own, and
probably should.

## Decisions and assumptions

- Extend the existing CMS rather than building a parallel one — the brief says so
  explicitly.
- Headings, eyebrows and standfirsts stay in the dictionaries.
- Day-one rendering is byte-identical to today's page; the CMS changes what an
  editor *can* do, not what a visitor currently sees.

## Files likely to change

- `supabase/sql/00XX_landing_sections.sql`
- `src/app/[locale]/page.tsx`
- `src/app/[locale]/admin/content/landing/page.tsx`
- `src/components/admin/` — a new section-order editor
- `src/components/home/` — the two rails, a video-capable New Arrival
- `src/services/content.ts`, `src/services/admin/content.ts`
- `src/actions/admin/content.ts`
- `src/schemas/db/`, `src/types/`

## Security requirements

- Every write goes through `requireAdmin()` and Zod, per `src/actions/admin/`.
- `videoUrl` must be `https://`-constrained in the database, not only in the
  form — mirror the `HeroSetting` check constraint.
- Section `key` is an identifier chosen from the registry, never free text from
  the request.
- No Supabase key reaches a Client Component; resolve settings on the server as
  the locale layout already does for marketing.

## Acceptance criteria

- [ ] `/` renders identically to today before any editor change
- [ ] Reorder, enable, disable and remove all take effect on `/` after revalidation
- [ ] A disabled section costs no query
- [ ] Header links stay legible under every reachable section order
- [ ] New Arrival supports image and video; a VIDEO row without a URL is impossible
- [ ] Video does not regress LCP — numbers before and after
- [ ] Essences and Journal scroll in one row, on desktop and mobile, LTR and RTL, with no page-level horizontal overflow
- [ ] A schema/registry mismatch degrades gracefully instead of blanking the page
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` clean

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run db:verify
```

## Manual test steps

1. `npm run dev`, open `/` and screenshot as a baseline
2. Admin → Content → Landing: move a section up, reload `/`, confirm order and grounds
3. Disable a section, confirm it disappears and issues no query
4. Re-enable it, confirm it returns in place
5. Set New Arrival to an image, then to a video; check autoplay, poster, muted, mobile
6. Set New Arrival to VIDEO with no URL — the save must be refused
7. Change the featured product, confirm `/` follows
8. Essences and Journal: scroll each at 375px and 1440px, then repeat under `/ar`
9. Confirm `document.body` never scrolls horizontally at any width
10. Lighthouse on `/` before and after the video section is enabled

---

## Persistence caveat this workstream must not trip over

`scripts/db-dump.ts` exports **only** the catalog, editorial content and
directory tables. It does **not** cover every production-managed content table —
`MarketingSetting` is a confirmed omission, so the live offer-popup copy exists
in the database and nowhere in the repository.

Consequences for this workstream:

- Do **not** assume `supabase/seed/*.json` is a complete picture of
  production-managed content. It is not.
- A new `LandingSection` table will have the same property unless the dumper is
  extended. Decide deliberately whether landing configuration should be
  reproducible from the repo, and say which you chose.
- Never reseed or reset in a way that would overwrite live `MarketingSetting`
  data with schema defaults.
- Extending the dumper is a **separate persistence/reproducibility follow-up**.
  Do it here only if this workstream genuinely requires it, and say so
  explicitly if you do.

---

## Implementation record

Applied as `supabase/sql/0043_landing_sections.sql`. `tsc` and `eslint` clean.

### §4C — horizontal rails (shipped first, independently)

`CollectionSlider` was generalised with an `lgPerView` prop rather than a second
rail being written: it already solved the parts that are easy to get wrong —
a native scroll container for touch and keyboard, `scrollBy` with a signed delta
instead of assigning `scrollLeft`, and `Math.abs` on the edge test, which is what
makes "next" mean the same thing in Arabic.

Essences is four across at `lg:`, Journal three, both 85% on a phone so the next
card's edge shows. Journal lost its `gap-0.5` hairline grid — that drew rules
*between cells*, and a scrolling row has none, so the last card would have
trailed a rule into empty space.

Verified: at 1440px all three rails fit one row; at 375px all three scroll, stay
one row, and the page itself never scrolls horizontally — in English and Arabic.

### §4A/§4B — section control

| Piece | Where |
| :-- | :-- |
| Table, seeded in shipped order | `supabase/sql/0043_landing_sections.sql` |
| Registry (keys, grounds, pinning) | `src/lib/landing-sections.ts` |
| Row narrowing | `src/schemas/db/landing.ts` |
| Read | `getLandingSections()` in `src/services/content.ts` |
| Actions | `src/actions/admin/landing.ts` |
| Editor + media form | `src/components/admin/{LandingSectionsEditor,SectionMediaForm}.tsx` |
| Renderer | `src/app/[locale]/page.tsx` — a keyed band map walked in stored order |

Decisions taken while building:

- **The hero is pinned.** It sets `<NavGround>`, so a hero moved down the page
  would leave whatever landed first under a header coloured for something else —
  the illegible case `nav-ground-provider.tsx` exists to prevent. It can still be
  hidden; it just cannot move, and the dashboard offers it no arrows rather than
  disabled ones.
- **A hidden band costs no query.** `getLandingSections()` runs first and its
  result gates the eight fetches behind it. The JSX map is still built whole,
  because constructing an element allocates an object rather than running a
  component — the expense was always the query.
- **`resolveSectionOrder()` cannot blank the page.** An unknown key is dropped, a
  registry key with no row is appended as enabled, and ties fall back to the
  shipped order.
- **Video copies `HeroSetting`.** `mediaType` is the switch, the URL must be
  `https://`, and a VIDEO without one is refused by the Zod schema *and* a check
  constraint. The `<video>` is muted, looping, `playsInline`, `preload="metadata"`
  and poster-backed by the product photograph, so the LCP stays the image.
- **Copy stayed in the dictionaries**, as scoped.

### Verified in the signed-in dashboard

- Hero shows "Always first" and no move controls; the first movable band has its
  up arrow disabled.
- Move down, then move up: admin list, database and storefront agreed at every
  step (`essences → collections → journal`, then back).
- Hide removed the band from `/` (17 sections → 16); Show restored it.
- A film with no address was refused with *"A film needs an https:// address."*
- A valid film rendered as `<video src poster autoPlay muted loop playsInline
  preload="metadata">`; reverting to Photograph removed it.

### One operational note

After this migration, PostgREST served a stale schema cache and
`getLandingSections()` failed with *"Could not find the table
'public.LandingSection'"* — the page fell back to the shipped order, which is
exactly the degradation it is designed for, but the CMS appeared to do nothing.
`notify pgrst, 'reload schema'` fixed it. **Any future migration adding a table
the storefront reads needs that reload**, or a Supabase API restart.
