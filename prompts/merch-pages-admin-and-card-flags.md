# Merchandising pages in the dashboard, and a flag on the card

Follows `prompts/merch-collection-pages-and-filter-state.md`, which shipped `/collections/best-sellers` and `/collections/limited-edition`. Two changes.

## Goal

1. **The two merchandising pages become editable from the dashboard, like any other collection.** Today their name, description and hero photograph are frozen in code — the dictionary plus a `MERCH_PAGE_BANNERS` constant — so the one thing an editor most wants to change (the hero) needs a deploy. They get a row, a listing entry beside the collections, and an edit form.
2. **A product wearing one of the two merchandising flags says so on its card**, in the same gold badge `<DiscoverySetCard>` already prints — on all three card types.

## Skills read

`AGENTS.md` (§1 protocols, §3 tokens, §6 stack, §8 routing matrix, §9 schema). `.agents/skills/supabase` for the migration, RLS and grant shape. No `clerk` surface (the dashboard's gate is unchanged) and no `ai-sdk` surface — the auto-suggested `ai-sdk` / `ai-gateway` skills were not read, and neither library is touched.

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `src/lib/facets.ts` | `MERCH_PAGE_FACETS = ["best-sellers", "limited-edition"]`, `parseMerchPageFacet()`, `productFacets()` — the membership rule, and the reason these cannot be `Collection` rows. |
| `src/app/[locale]/collections/[slug]/page.tsx` | `renderMerchPage()` builds a `CollectionHeader` from `dict.collections.merchPages[facet]` and `MERCH_PAGE_BANNERS`; the route resolves a real collection first, then a merchandising slug, then 404s. |
| `supabase/sql/0001_catalog.sql` | Table conventions: `text` primary keys holding slugs, quoted camelCase columns, `create … if not exists`, RLS enabled with a select-only policy and `grant select … to anon, authenticated`. |
| `supabase/sql/0006_privileges.sql` | Public roles hold **no** write grant; every write goes through the service key. `scripts/db-verify.ts` asserts it. |
| `supabase/sql/0008_i18n_content.sql` | Translations are nullable `_ar` sibling columns; `Collection` carries `name_ar`, `description_ar`, `"bannerAlt_ar"`. |
| `src/schemas/db/admin.ts` | Wider projections for the dashboard, explicit column lists, `parseList`, `toAdmin*` returning `null` on a malformed row. |
| `src/schemas/admin.ts` | `slugField`, `imageUrlField` and the `ALLOWED_IMAGE_HOSTS` gate; sentences rather than error codes, because the dashboard is English by construction. |
| `src/actions/admin/catalog.ts` | `requireAdmin()` as the first statement of every action, `getSupabaseAdmin()`, `postgresFailure()` / `fieldErrorsFrom()`, revalidate on success. |
| `src/lib/admin/revalidate.ts` | Both locales always; `revalidateProduct()` currently revalidates home, `/collections`, the collection page, the category path, the PDP and `/new-arrival`. |
| `src/components/admin/CollectionForm.tsx` | The form shape this one mirrors: local state, `useTransition`, `AdminNotice` from the action result. |
| `src/app/[locale]/admin/collections/page.tsx`, `.../[slug]/page.tsx` | The listing table and the edit route the merchandising pages join. |
| `src/components/ecommerce/DiscoverySetCard.tsx:71` | The badge to copy: `absolute end-5 top-5 z-2 bg-gold px-3 py-1.5 font-heading text-[9px] font-semibold tracking-[0.2em] text-background`. Heart at `start-5 top-5`. |
| `src/components/ecommerce/MerchCard.tsx`, `ProductCard.tsx` | No badge at all today. `MerchCard`'s heart sits at `end-5 top-5`; `ProductCard` is an async Server Component with no controls in the image. |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | `collections.facets["best-sellers" \| "limited-edition"]` already carry the labels in both languages — the chip strings. |

## Decisions and assumptions

- **D1 — A new `"MerchPage"` table, not a `Collection` row.** A product points at exactly one collection (`"Product"."collectionSlug"`), so seeding "best sellers" as a collection would take those fragrances out of Signature and Noir. Membership stays derived by `productFacets()`; the new table stores only the *page's* presentation — name, description, banner — which is exactly the part that is currently hard-coded.
- **D2 — The table is a closed set of two rows.** `check (slug in ('best-sellers','limited-edition'))` and no create/delete in the dashboard. These pages exist because `MERCH_PAGE_FACETS` routes them; a third row would be a page with no route, and a deleted row would be a live URL with no copy. The code is the authority on which pages exist, the table on what they say.
- **D3 — The row is an override, never a dependency.** `renderMerchPage()` reads the row and falls back to today's dictionary copy and banner constant when it is missing, unparseable, or the read fails. A menu link must not 500 because a table is empty. The constants and dictionary blocks therefore stay exactly where they are.
- **D4 — They are edited from `/admin/collections/[slug]`, not a new section.** The public route already branches "real collection, else merchandising slug"; the admin route gets the same branch, so the dashboard URL matches the storefront URL and the nav grows nothing. They also appear as rows in the `/admin/collections` table with kind `MERCHANDISING`.
- **D5 — The dashboard index is left alone.** *(Revised after review; the first pass added a tile per merchandising page.)* The two pages live under Collections and nowhere else: `/admin` keeps its three doors, and an editor reaches Best Sellers and Limited Edition the same way they reach Noir — through the Collections list. The live count each cut holds is still printed, on the page where it is actionable: the header of the edit screen. `countMerchPageProducts()` therefore stays, with that screen as its only caller.
- **D6 — Arabic is stored, English is edited.** The table carries `_ar` siblings like every other translatable table, seeded from today's `ar` dictionary; the form edits the English columns only, exactly as `CollectionForm` does. Nothing in the dashboard has ever edited Arabic.
- **D7 — One badge per card, and the free-text `badge` wins.** Precedence: `product.badge` → `LIMITED_EDITION` → `isBestseller` → nothing. A merchandiser who typed "Most Popular" meant it to be the badge, and two stacked pills in one corner is not a design.
- **D8 — The badge takes the *start* corner; the wishlist heart takes the *end* corner.** `<MerchCard>`'s heart is already at `end-5`, so the badge has to go opposite it. For the two client cards to agree, `<DiscoverySetCard>`'s two controls swap: badge `start-5`, heart `end-5`. **This moves an existing control** — flagged deliberately; the alternative is the badge on a different side depending on which card you are looking at. `<ProductCard>` has no heart, and its badge also takes `start-5 top-5` for the same reason.
- **D9 — No suppression on the merchandising pages themselves.** Every card on `/collections/best-sellers` will wear the Best Seller badge. One rule, applied everywhere, is worth more than a special case that makes the badge mean something subtly different depending on the page.
- **D10 — Product writes revalidate the two merchandising pages.** An existing gap: flipping the Bestseller toggle leaves `/collections/best-sellers` stale for up to ten minutes, and an editor concludes the save failed. Cheap to fix here — two paths, both locales, on every product write.

## Files likely to change

**New**

- `supabase/sql/0012_merch_page.sql` — table, check constraint, RLS, grant, and the two seed rows.
- `src/components/admin/MerchPageForm.tsx`
- `src/components/ecommerce/ProductFlag.tsx`

**Edited**

- `src/lib/facets.ts` — `productFlag()`.
- `src/schemas/db/catalog.ts` — `MERCH_PAGE_COLUMNS`, `toMerchPage()`.
- `src/schemas/db/admin.ts` — `ADMIN_MERCH_PAGE_COLUMNS`, `AdminMerchPage`, `toAdminMerchPage()`.
- `src/schemas/admin.ts` — `updateMerchPageSchema`.
- `src/services/products.ts` — `getMerchPage()`.
- `src/services/admin/catalog.ts` — `listAdminMerchPages()`, `getAdminMerchPage()`, `countMerchPageProducts()`.
- `src/actions/admin/catalog.ts` — `updateMerchPage()`.
- `src/lib/admin/revalidate.ts` — `revalidateMerchPage()`, plus the merchandising paths inside `revalidateProduct()`.
- `src/types/catalog.ts` — `MerchPage`.
- `src/app/[locale]/admin/collections/page.tsx` — the two rows.
- `src/app/[locale]/admin/collections/[slug]/page.tsx` — the branch.
- `src/app/[locale]/collections/[slug]/page.tsx` — read the row, fall back to the constants.
- `src/components/ecommerce/{ProductCard,MerchCard,DiscoverySetCard}.tsx` — the badge.

## Implementation requirements

### 1. `supabase/sql/0012_merch_page.sql`

Idempotent, in the house style of `0001`:

```sql
create table if not exists public."MerchPage" (
  slug            text primary key
    constraint merch_page_known_slug check (slug in ('best-sellers', 'limited-edition')),
  name            text not null,
  name_ar         text,
  description     text not null,
  description_ar  text,
  "bannerUrl"     text not null,
  "bannerAlt"     text not null,
  "bannerAlt_ar"  text,
  "updatedAt"     timestamptz not null default now()
);
```

- `alter table … enable row level security`; one `for select to anon, authenticated using (true)` policy named `"MerchPage is publicly readable"`, dropped-then-created like its siblings; `grant select on public."MerchPage" to anon, authenticated`. **No insert/update/delete policy and no write grant** — `0006_privileges.sql` is the argument, and `db:verify` asserts it.
- Two `insert … on conflict (slug) do nothing` rows carrying **exactly** today's English and Arabic copy from `collections.merchPages` in both dictionaries, and the two URLs currently in `MERCH_PAGE_BANNERS`. Applying the migration must change nothing a visitor sees.
- A file header explaining D1 and D2 — why this is not a `Collection`, and why the slug is a closed set.

### 2. Storefront read, with the constants as the floor

- `src/types/catalog.ts` gains `MerchPage { slug: MerchPageFacet; name; description; bannerUrl; bannerAlt }` — the resolved, single-language shape.
- `src/schemas/db/catalog.ts` gains `MERCH_PAGE_COLUMNS` (explicit list, `_ar` siblings included) and `toMerchPage(row, locale)`, resolving through `resolveText()` from `src/lib/i18n/resolve.ts` like every other localized row.
- `src/services/products.ts` gains `getMerchPage(locale, facet): Promise<MerchPage | null>` — `getSupabasePublic()`, `.eq("slug", facet).maybeSingle()`, `null` and a `console.error` on failure. RLS-scoped like every other public read.
- `renderMerchPage()` in `src/app/[locale]/collections/[slug]/page.tsx` builds its `CollectionHeader` from the row when there is one, and from `dict.collections.merchPages[facet]` + `MERCH_PAGE_BANNERS[facet]` when there is not — field by field is unnecessary; row-or-fallback wholesale is enough. `generateMetadata()` keeps reading the dictionary: `meta` is SEO copy, has no column, and is not what this change makes editable.

### 3. Dashboard reads

`src/services/admin/catalog.ts`:

```ts
export async function listAdminMerchPages(): Promise<AdminMerchPage[]>
export async function getAdminMerchPage(slug: string): Promise<AdminMerchPage | null>
export async function countMerchPageProducts(): Promise<Record<MerchPageFacet, number>>
```

`countMerchPageProducts()` is two `{ count: "exact", head: true }` queries over `"Product"`, both filtered `isArchived = false` and `deletedAt is null`: `.eq("isBestseller", true)` and `.contains("tags", ["LIMITED_EDITION"])`. Zero on failure, with the usual `logFailure`. `AdminMerchPage` mirrors the row including the `_ar` columns raw — the form does not edit them, but the list should not silently drop a row whose translation is present.

### 4. Dashboard writes

- `src/schemas/admin.ts` — `updateMerchPageSchema`: `slug` narrowed with `z.enum(MERCH_PAGE_FACETS)` (not `slugField`; the set is closed), `name` 2–120, `description` trimmed 1–`LONG_TEXT_MAX`, `bannerUrl` through `imageUrlField` (the host gate matters — an unlisted host throws inside `next/image` at render), `bannerAlt` 2–200.
- `src/actions/admin/catalog.ts` — `updateMerchPage(input)`: `requireAdmin()` first, parse, `getSupabaseAdmin()`, `.update({...,"updatedAt": new Date().toISOString()}).eq("slug", slug)`, `revalidateMerchPage(slug)`, and the same actor/action/slug log line the neighbours write. No `createMerchPage`, no `deleteMerchPage` — D2.
- `src/lib/admin/revalidate.ts` — `revalidateMerchPage(slug)` revalidates `/collections/${slug}` in both locales. `revalidateProduct()` additionally revalidates both merchandising paths on every product write (D10); a path never rendered is a no-op, and conditioning on the flag would miss the case where a flag was just *removed*.

### 5. `MerchPageForm`

Mirrors `CollectionForm` in structure and tone — `useState` per field, `useTransition`, `AdminNotice` from the result, `AdminInput` / `AdminTextarea` — with four fields: Name, Description, Banner URL, Banner alt text. Slug is displayed read-only. Above the fields, an `AdminNotice`-free line of context in the dashboard's voice: this page's products are chosen by the Bestseller toggle / Limited edition tag on each product, not here. On success, `router.refresh()`; there is no create flow to redirect out of.

### 6. Where they appear in the dashboard

- **`/admin/collections`** — after the collection rows, the merchandising rows in the same `<AdminTable>`: Name, slug muted, kind `MERCHANDISING`, Home page `—`, Order `—`, Edit → `/admin/collections/<slug>`. They pass through the same `matchesTerm()` search as the collections. The page description gains one clause noting that the last two are cuts across the catalogue rather than collections a product belongs to.
- **`/admin/collections/[slug]`** — when `getAdminCollection()` returns `null`, try `parseMerchPageFacet()` before `notFound()`, and render `<MerchPageForm>` under an `AdminPageHeader` titled with the page's name. Real collections resolve first, so no seeded slug can be shadowed. `/admin/collections/new` is untouched.
- **`/admin/page.tsx`** — unchanged (D5). The count of live products in each cut appears in the `AdminPageHeader` of the edit screen instead, where a `0` reads as a fact about that page rather than as a broken tile.

### 7. The card flag

`src/lib/facets.ts`:

```ts
/** The one merchandising flag a card prints, or `null`. Limited runs outrank volume. */
export function productFlag(product: ProductCardData): MerchPageFacet | null
```

`src/components/ecommerce/ProductFlag.tsx` — a presentational component with no hooks, so both the Server and the Client cards can render it:

```tsx
export default function ProductFlag({ label, island }: { label: string; island?: boolean })
```

Markup and classes are `<DiscoverySetCard>`'s badge verbatim, except the inset: `absolute start-5 top-5 z-2 bg-gold px-3 py-1.5 font-heading text-[9px] font-semibold tracking-[0.2em] text-background`. `island` applies `ltrIsland(locale)` for the database's English `badge` text; a dictionary label takes `dir="auto"` instead, because an untranslated string falls back to English and only the rendered text can decide which way it runs.

Each card resolves, in order: `product.badge` (island), else `productFlag(product)` → `dict.collections.facets[flag]` (no island), else nothing.

- `<ProductCard>` — server; label from `getDictionary(locale)`, already awaited.
- `<MerchCard>` — client; `useDictionary()`. Badge `start-5`, heart stays `end-5`.
- `<DiscoverySetCard>` — client; badge moves `end-5` → `start-5`, heart moves `start-5` → `end-5` (D8). Its `absolute` insets are logical, so both mirror correctly in Arabic and still never collide.

No dictionary keys are added: `collections.facets` already carries both labels in both languages, and reusing them keeps one spelling for the chip, the page title and the badge.

## Security requirements

- `updateMerchPage()` opens with `requireAdmin()` and parses its input before a value reaches a query — a Server Action is a public endpoint, and the form's checks are affordances.
- The `slug` is narrowed by `z.enum(MERCH_PAGE_FACETS)` in the action *and* by a check constraint in the database, so no write can invent a page.
- `bannerUrl` passes `ALLOWED_IMAGE_HOSTS`; no new remote pattern is added to `next.config.ts`.
- `"MerchPage"` gets RLS with a select-only policy and a select-only grant. No write policy for `anon` / `authenticated` — writes are service-role only, matching `0006_privileges.sql`, which `npm run db:verify` enforces.
- The storefront reads the row through `getSupabasePublic()`, subject to that policy; only the dashboard uses `getSupabaseAdmin()`.
- `/admin/collections/[slug]` inherits the layout's `requireAdmin()` gate; the new branch adds no unauthenticated surface.

## Acceptance criteria

1. `npm run db:migrate` applies `0012` cleanly, twice in a row, and `npm run db:verify` passes — including "the public roles hold no write grant".
2. Immediately after the migration, `/collections/best-sellers` and `/collections/limited-edition` render byte-identical copy and hero images to before, in both locales.
3. Deleting both rows from the table leaves both pages rendering the dictionary copy and the constant banners — no 404, no 500.
4. `/admin/collections` lists nine rows: seven collections and two `MERCHANDISING` entries; searching "limited" finds the merchandising one.
5. `/admin/collections/best-sellers` opens the merchandising form; `/admin/collections/signature` still opens the collection form; `/admin/collections/nonsense` still 404s.
6. Editing the Best Sellers banner URL and saving changes the hero on `/collections/best-sellers` on the next reload, in **both** locales. A URL on an unlisted host is refused with the host message, and the page is untouched.
7. `/admin` is unchanged — three tiles, no merchandising entries. The count in each edit screen's header equals the product count on the matching storefront page.
8. Toggling Bestseller on a product and saving changes `/collections/best-sellers` on the next reload — no ten-minute wait.
9. A limited-edition product shows a **Limited Edition** badge on its card in `/collections`, on a body-care card, and on a discovery set card; the same product in Arabic shows `إصدار محدود`. A product with a free-text `badge` shows that instead, never both.
10. On every card the badge sits at the top-inline-start corner and the wishlist heart at the top-inline-end, mirrored correctly at `/ar`, with no overlap at 375 px.
11. `npx tsc --noEmit`, `npm run lint` and `npm run build` are clean; no dictionary key is added or orphaned.

## Checks to run

```bash
npm run db:migrate
npm run db:migrate        # idempotence
npm run db:verify
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run db:migrate && npm run db:verify`.
2. `npm run build && PORT=3005 npm run start`.
3. `/collections/best-sellers` and `/ar/collections/limited-edition` — same copy, same hero, same counts as before the change.
4. `/admin` — three tiles, exactly as before.
5. `/admin/collections` — nine rows, the last two marked `MERCHANDISING`. Search `limited`.
6. Open `/admin/collections/limited-edition`, change the banner alt text and the description, save. Reload `/collections/limited-edition` and `/ar/collections/limited-edition` — English changed, Arabic unchanged (the `_ar` columns still hold the seeded translation).
7. Paste `https://example.com/x.jpg` into Banner URL and save — refused, with the allowed-hosts message; reload and confirm nothing was written.
8. `/admin/products/<a fragrance>` — turn Bestseller on, save, reload `/collections/best-sellers`: the product is there, and the count in `/admin/collections/best-sellers`'s header has gone up by one.
9. That product's card in `/collections` now wears a **Best Sellers** badge; tag another product Limited edition and confirm the Limited Edition badge outranks it on a product carrying both.
10. `/collections/body-care` and `/collections/discovery` at 375 px and at 1440 px, `/` and `/ar` — badge inline-start, heart inline-end, neither clipped, no horizontal overflow.

---

## Verification record (post-implementation)

Production build against the live Supabase project, plus direct PostgREST probes for the access-control checks.

| Check | Result |
| :--- | :--- |
| `npm run db:migrate`, twice | applies clean and is a no-op on the second run |
| `npm run db:verify` | 38/38, including "the public roles hold no write grant" |
| Seeded rows | both present with exactly the copy and banners the pages rendered before |
| Anon `select` on `"MerchPage"` | returns both rows including the `_ar` columns |
| Anon `insert` / `update` | `42501 permission denied` — RLS + the revoked grant, not a policy alone |
| Third slug (`staff-picks`), service key | `23514 merch_page_known_slug` — the closed set holds in the database |
| Row is actually read | row name set to a marker → prerendered `/collections/best-sellers` `<h1>` reads the marker; `/ar/…` still reads `name_ar`, untouched |
| Fallback | both rows deleted → both pages still prerender, dictionary copy + constant banners, both locales, no 404 and no 500 |
| Cut counts | `countMerchPageProducts()` filters give 5 and 6 — the same numbers the two storefront pages print, and what each edit screen's header states |
| Prerender | 18 paths under `/collections/[slug]` = 9 slugs × 2 locales, unchanged |
| Admin routes signed out | `/admin/collections/best-sellers` and `…/limited-edition` 307 to sign-in, like every other admin path |
| Rejected admin slug | `/admin/collections/staff-picks` 307 (gate first), and behind the gate `parseMerchPageFacet()` 404s it |
| Card badges | `/collections` 14 of 28 cards badged (stored `badge` where set, else the flag); `/ar/collections` the same 14, Arabic labels; `/collections/discovery` 3; `/collections/body-care` 0 |
| Precedence | Sapphire (`NEW_ARRIVAL` + `LIMITED_EDITION`, stored badge "New · Limited") prints the stored badge, not the flag; Kyphi and Mendesian (bestseller *and* limited) print **Limited Edition** |
| Placement | badge `start-5 top-5` on all three cards; wishlist heart `end-5 top-5` — including the heart `<CollectionGrid>` overlays on `/collections`, which is why the badge takes the start corner |
| `npx tsc --noEmit`, `npm run lint`, `npm run build` | clean |

### Defect found and fixed during verification

Adding `import type { MerchPageFacet }` to `src/types/catalog.ts` closed a cycle with `src/lib/facets.ts`, which already reads `ProductCardData` from that module. Type-only or not, the bundler kept the edge, and `MERCH_PAGE_FACETS` evaluated as `undefined` inside `z.enum(...)` at module-evaluation time — logged as `ReferenceError: MERCH_PAGE_FACETS is not defined` at `src/schemas/db/catalog.ts:136`. `MerchPage.slug` is now a plain `string`; the narrow union stays in `facets.ts` and `toMerchPage()` still narrows the value at the boundary.

### Not verified

The save path through the dashboard UI was not exercised end to end — it needs a signed-in Clerk admin session, which this environment has no way to establish. What *was* verified directly: the Zod schema, the closed-slug constraint, the image-host gate's presence in the shared `imageUrlField`, and that no key but the service key can write the table.

Two pre-existing behaviours, unchanged by this round and noted for accuracy: an unknown `/collections/<slug>` renders the not-found page with a `200` status rather than a `404`, and `generateMetadata()` for the two merchandising pages still reads the dictionary — `meta` has no column, by design.

### Revision after review

The dashboard index tiles were removed at the user's request: the merchandising pages belong under Collections and nowhere else. `src/app/[locale]/admin/page.tsx` is now byte-identical to what it was before this round — those two tiles were its only change. `countMerchPageProducts()` keeps its one remaining caller, the edit screen's header. Re-checked after the removal: `npx tsc --noEmit`, `npm run lint` and `npm run build` clean, `/admin` renders its original three tiles.
