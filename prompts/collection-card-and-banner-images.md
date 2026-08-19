# Collection card image + banner image (storefront & admin)

## Goal

A collection currently carries **one** photograph (`bannerUrl` / `bannerAlt`), used
for two very different jobs:

- the **portrait 3:4 card** on the home page grid (`<CollectionCard>`), and
- the **landscape 60vh hero banner** on `/collections/[slug]` and on the four
  category routes (`/body-care`, `/room-fragrance`, `/discovery`, `/gift-set`).

One crop cannot serve both. Give `Collection` a **second, dedicated card image**
(`cardUrl` / `cardAlt` + `cardAlt_ar`), keep `bannerUrl` as the banner, and expose
both pairs in the admin collection form (create and edit), which already exists at
`/admin/collections/new` and `/admin/collections/[slug]`.

## Skills read

- `.agents/skills/supabase` — additive migration, idempotent SQL, service-role
  writes, `parseList` dedupe/drop rules.
- `node_modules/next/dist/docs/` — Server/Client boundaries, `next/image`
  `remotePatterns`, ISR revalidation from Server Actions.
- Not read: `clerk` (no auth surface changes — admin RBAC already gates these
  routes via `middleware.ts` / `proxy.ts`), `ai-sdk` (no AI in this task; the
  session hook that suggested it is a lexical false positive).

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `supabase/sql/0001_catalog.sql` | `"Collection"` table — `text` PK, quoted camelCase columns, `bannerUrl` / `bannerAlt` `not null` |
| `supabase/sql/0008_i18n_content.sql` | `_ar` twins added as nullable via `add column if not exists` |
| `src/types/catalog.ts` | `Collection` interface (resolved, no `_ar` fields) |
| `src/schemas/db/catalog.ts` | `collectionRowSchema`, `COLLECTION_COLUMNS`, `toCollection()` — parse-not-assert, `_ar` resolved through `resolveText` |
| `src/schemas/db/admin.ts` | `adminCollectionRowSchema`, `ADMIN_COLLECTION_COLUMNS`, `toAdminCollection()` |
| `src/schemas/admin.ts` | `imageUrlField` (https + allowed host), `collectionFields`, `createCollectionSchema`, `updateCollectionSchema` |
| `src/actions/admin/catalog.ts` | `createCollection` / `updateCollection` — Zod parse, service-role write, `revalidateCollection(slug, kind)` |
| `src/services/admin/catalog.ts` | `listAdminCollections`, `getAdminCollection` |
| `src/components/admin/CollectionForm.tsx` | Single form for create + edit, local state + `useTransition`, `fieldErrors` from the action |
| `src/components/home/CollectionCard.tsx` | Portrait card, `aspect-3/4`, renders `bannerUrl` today |
| `src/components/ecommerce/CollectionView.tsx` | Landscape hero, renders `collection.bannerUrl`, `ALL_HERO_IMAGE` fallback |
| `src/app/[locale]/{body-care,room-fragrance,discovery,gift-set}/page.tsx` | Category heroes reading `bannerUrl` |
| `scripts/db-seed.ts` + `supabase/seed/catalog.json` | Collection upsert rows |
| `next.config.ts` | `remotePatterns`: `images.unsplash.com`, `res.cloudinary.com`, `img.clerk.com` |

## Decisions / assumptions

1. **New columns are `cardUrl` / `cardAlt` / `cardAlt_ar`, all nullable.** The
   banner stays `not null`. Nullable is what makes the migration safe on a live
   table with seeded rows and no back-fill.
2. **The card falls back to the banner.** `cardUrl ?? bannerUrl` — a collection
   with no card image looks exactly as it does today, so this ships without a
   content pass. Alt falls back the same way (`cardAlt ?? bannerAlt`).
3. **Fallback resolution lives in `src/schemas/db/catalog.ts`,** not in the view.
   `toCollection()` already resolves locale there; the view layer keeps taking a
   plain `string`. `Collection.cardUrl` / `cardAlt` are therefore typed
   `string` (non-null, already fallen back), matching how `bannerAlt` is exposed.
4. **The admin form keeps card image optional** — empty string means "use the
   banner", stored as `null`. `imageUrlField` is reused for the URL, wrapped so
   blank passes.
5. **No new image host.** Both fields validate against the same allowed hosts
   already in `next.config.ts`; no `next.config.ts` change.
6. `name_ar` has no card equivalent to add — only the alt text is translatable,
   consistent with `bannerAlt_ar`.
7. **Seed JSON gains `cardUrl` / `cardAlt` / `cardAlt_ar` as explicit `null`**
   for the existing collections rather than inventing new stock photography;
   editors set real card crops from the dashboard.

## Files likely to change

**Database**
- `supabase/sql/0010_collection_card_image.sql` *(new)* — additive, idempotent:
  ```sql
  alter table public."Collection"
    add column if not exists "cardUrl"    text,
    add column if not exists "cardAlt"    text,
    add column if not exists "cardAlt_ar" text;
  ```
  (Confirm the next free migration number at implementation time — `0007` is
  absent from `supabase/sql/`, so use the next number after the highest present.)

**Types & parsing**
- `src/types/catalog.ts` — `Collection` gains `cardUrl: string; cardAlt: string;`
  documented as "already fallen back to the banner".
- `src/schemas/db/catalog.ts` — `collectionRowSchema` gains the three nullable
  columns; `COLLECTION_COLUMNS` gains `"cardUrl", "cardAlt", "cardAlt_ar"`;
  `toCollection()` resolves `cardAlt` through `resolveText` **after** the
  fallback, so an Arabic banner alt is reused when the card has none.
- `src/schemas/db/admin.ts` — `adminCollectionRowSchema` gains
  `cardUrl: z.string().nullable().default(null)` and `cardAlt` likewise;
  `ADMIN_COLLECTION_COLUMNS` extended. The admin row keeps the **raw** nulls —
  the form must show an empty field, not the inherited banner value.
- `src/schemas/admin.ts` — `collectionFields` gains
  `cardUrl: optionalImageUrlField` and `cardAlt` (blank → `null`, else 3–200
  chars). Add a small `emptyToNull` preprocess helper next to `imageUrlField`
  rather than duplicating the host check.

**Writes**
- `src/actions/admin/catalog.ts` — `createCollection` / `updateCollection` write
  `cardUrl` / `cardAlt` (`null` when blank). No change to `revalidateCollection`.

**UI**
- `src/components/admin/CollectionForm.tsx` — a second image pair under the
  existing banner pair, in its own labelled group:
  - **Banner image** (`bannerUrl`, `bannerAlt`) — hint: "Landscape. Used as the
    hero on the collection page, ~1800×900."
  - **Card image** (`cardUrl`, `cardAlt`) — hint: "Portrait 3:4, ~900×1200. Used
    on the home page grid. Leave blank to reuse the banner."
- `src/components/home/CollectionCard.tsx` — `src={collection.cardUrl}`,
  `alt={collection.cardAlt}`.
- `CollectionView.tsx` and the four category pages — **unchanged**; they keep
  reading `bannerUrl`. Verify only.

**Seed**
- `supabase/seed/catalog.json` — add the three keys (`null`) to each collection.
- `scripts/db-seed.ts` — carry the new keys through the `"Collection"` upsert and
  extend `CollectionSeedRow` if the raw-row type needs the nullable twins.

## Implementation requirements

- Zero `any`. Every new column parsed by Zod, never asserted.
- `add column if not exists` only — no destructive DDL, no direct Postgres edit
  outside `supabase/sql/`.
- One malformed row is still dropped, the list survives: the new columns must be
  `.nullable().default(null)` so a pre-migration row never blanks the grid.
- No `_ar` column may leak into an RSC payload — `toCollection()` destructures
  `cardAlt_ar` out exactly as it does `bannerAlt_ar`.
- Admin form stays a Client Component; all validation re-runs inside the action.
- Card image keeps `aspect-3/4`, `sizes="(min-width: 768px) 50vw, 100vw"`, and the
  existing tone/zoom treatment — no layout shift, no new motion.

## Security requirements

- `cardUrl` passes the same `imageUrlField` gate: `https` only, host on the
  allow-list. A URL on any other host is rejected by the schema before the write,
  which also keeps `next/image` from throwing at render.
- Writes stay behind the existing admin Server Actions (service-role client +
  actor check in `src/actions/admin/shared.ts`); no new route handler, no client
  ever holding the service key.
- `cardAlt` is length-capped and rendered as an `alt` attribute only.
- Failures log through the existing `[admin]` console path with the actor email;
  the Postgres message is not returned verbatim to the browser.

## Acceptance criteria

1. Migration applies cleanly twice in a row (idempotent) on a seeded database.
2. Before setting any card image, the home page and every collection page look
   **byte-identical** to today (fallback works).
3. Setting a card image in the admin form changes only the home page grid card;
   the collection hero still uses the banner.
4. Clearing the card image field reverts that collection to the banner.
5. A non-allow-listed or non-https card URL is rejected inline with a field-level
   error, on both create and edit.
6. Arabic tree: `cardAlt_ar` is used when set; otherwise `bannerAlt_ar`; otherwise
   the English alt. No `_ar` key appears in the page payload.
7. `npx tsc --noEmit` and `npm run lint` are clean.

## Checks to run

```bash
npm run lint
npx tsc --noEmit
npm run db:migrate   # applies supabase/sql/*.sql in order
npm run db:seed      # verifies the seed still upserts
npm run build
```

## Manual test steps

1. `npm run db:migrate && npm run db:seed`, then `npm run dev`.
2. Open `/en` — the collections grid renders as before (cards show banner images).
3. Open `/en/collections/noir` — hero unchanged.
4. Open `/en/admin/collections` → edit **Signature**. Confirm two image groups:
   Banner (filled) and Card (empty, with the "leave blank" hint).
5. Paste a portrait Unsplash URL (e.g.
   `https://images.unsplash.com/photo-1541643600914-78b084683601?w=900&h=1200&fit=crop&auto=format`)
   into **Card image URL**, add alt text, save. Expect a success notice.
6. Reload `/en` → the Signature card now shows the new portrait. Reload
   `/en/collections/signature` → the hero is still the original banner.
7. Paste `http://example.com/x.jpg` into Card image URL and save → inline field
   error, nothing written.
8. Clear the card fields, save, reload `/en` → back to the banner image.
9. `/en/admin/collections/new` → create a throwaway collection with **both**
   images set; confirm the redirect to its edit page and that both persist.
   Delete it afterwards.
10. Repeat step 6 on `/ar` and confirm the Arabic alt resolution (inspect the
    card `<img alt>` in DevTools).
