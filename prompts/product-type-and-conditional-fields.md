# Product type, and fields that follow from it

## Goal

Give the dashboard a **product type** — Perfume, Gift, Box, Antique, Decorative
— so the house can list objects that are not fragrances (a Sphinx piece, a
Pyramid piece) without lying about them in the fields.

Then make the form's requirements follow from that type. Chiefly: **a Gift, Box,
Antique or Decorative item must not be forced to state a volume in millilitres.**

## Skills read

None of the three approved skills (`clerk`, `supabase`, `ai-sdk`) is load-bearing
here beyond house practice already visible in the files below: this is a schema
column, a Zod schema, a form, and the read paths that carry the column. No auth
boundary moves and no model is called.

## Existing code inspected

- `supabase/sql/0041_product_type.sql` — `public."ProductType"` already exists as
  an enum of `BODY_MIST`, `ROOM_SPRAY`, on `"Product"."productType"`, nullable,
  with a `product_type_matches_kind` trigger tying each value to a
  `CollectionKind`, and a partial index. Its header states the column's meaning
  exactly: *"`format` says what the object is like, `"productType"` says what it
  is."* That is the column this task wants.
- `supabase/sql/0001_catalog.sql:109` — `"volumeMl" int not null check ("volumeMl" > 0)`.
- `supabase/sql/0001_catalog.sql:91-93` — the `product_strength_or_format` check:
  a row needs a `concentration` **or** a `format`.
- `src/schemas/admin.ts:458-543` — `productFields`, `volumeMl` as
  `z.coerce.number().int().positive()`, and `requireStrengthOrFormat`.
- `src/components/admin/ProductForm.tsx` — the whole form. No control writes
  `productType` today.
- `src/schemas/db/catalog.ts` — `productRowSchema.volumeMl: z.number()`,
  `PRODUCT_COLUMNS`, `productCardRowSchema`, `PRODUCT_CARD_COLUMNS`.
- `src/schemas/db/admin.ts` — `ADMIN_PRODUCT_COLUMNS`, `volumeMl: z.number()`.
- `src/types/catalog.ts` — `Product.volumeMl: number`, `ProductCardData`.
- `src/lib/format.ts:160` — `formatVolume(volumeMl: number)`.
- `src/lib/product-types.ts` — the TS union `ProductType` and the `PRODUCT_TYPES`
  table, which is now vocabulary plus range membership, no longer routing.
- Six render sites calling `formatVolume`: `ProductCard`, `MerchCard`,
  `CartLine`, `CartDrawerLine`, `ArrivalShowcase`, `DiscoveryComparison`,
  `ProductPurchase`.
- `scripts/db-seed.ts`, `scripts/db-dump.ts`, `scripts/db-verify.ts`,
  `scripts/seed-types.ts`, `supabase/seed/catalog.json`.

## Decisions

1. **Extend `public."ProductType"`** with `PERFUME`, `GIFT`, `BOX`, `ANTIQUE`,
   `DECORATIVE` rather than adding a second column. Confirmed with the user. The
   column already means "what this object is"; a second one would be two
   overlapping answers an editor has to keep in step.
2. **The trigger is relaxed, not removed.** `BODY_MIST` still requires a `BODY`
   collection and `ROOM_SPRAY` a `HOME` one — `/collections/body-mist` depends on
   that, and `0046_range_collections.sql` built two real collection rows on it.
   The five new values are unconstrained by kind: an Antique may be sold from any
   shelf the house decides on.
3. **`volumeMl` becomes nullable**, and the requirement moves into the type: a
   `PERFUME`, `BODY_MIST` or `ROOM_SPRAY` row must carry one; the other four may
   not have one to carry. Enforced in the same trigger, so the rule lives beside
   the rule it belongs with rather than in a check constraint that cannot see the
   type it depends on.
4. **`format` carries the requirement for typed non-fragrances.** The existing
   `product_strength_or_format` check is untouched. A Gift, Box, Antique or
   Decorative item has no concentration, so its format line ("Alabaster Sphinx",
   "Gift Box — 3 Vials") is what satisfies the constraint. The Zod schema says so
   in a sentence instead of leaving the editor to discover it.
5. **`productType` stays nullable.** Thousands of existing rows have none and a
   backfill that guessed would be worse than a blank. A null type is read as *not
   stated*, and keeps today's rule — volume required — so no existing product
   becomes editable-but-invalid.

## Assumptions

- Admin copy is English only, matching every other admin component.
- The storefront does not print the type anywhere. This task adds no storefront
  surface; `PRODUCT_TYPES` in `src/lib/product-types.ts` keeps listing only the
  two range types, because only those two have a page.
- Nothing in the checkout or inventory paths reads `volumeMl`; verified by grep.

## Files likely to change

**Database**

- `supabase/sql/0052_product_type_and_volume.sql` — new, idempotent:
  - `alter type public."ProductType" add value if not exists` × 5.
  - `alter table public."Product" alter column "volumeMl" drop not null;`
  - drop the old positive check, add
    `check ("volumeMl" is null or "volumeMl" > 0)`.
  - `create or replace function public.product_type_matches_kind()` — keep the
    two existing kind rules, add: `PERFUME`/`BODY_MIST`/`ROOM_SPRAY` require
    `"volumeMl" is not null`, raising a named error. Re-create the trigger with
    `before insert or update of "productType", "collectionSlug", "volumeMl"`.
  - Note in the header: `alter type … add value` cannot run in the same
    transaction as a statement that *uses* the new value in Postgres. Confirm
    against `scripts/db-migrate.ts`, which wraps **all** files in one
    transaction — if it fails, split the enum additions into their own file
    (`0052_product_type_values.sql`) applied before `0053_volume_optional.sql`,
    and say so in both headers rather than working around it in the runner.

**Schema / types**

- `src/lib/product-types.ts` — widen the `ProductType` union to seven values;
  add a `PRODUCT_TYPE_LABELS: Record<ProductType, string>` and a
  `TYPES_REQUIRING_VOLUME` set; document that `PRODUCT_TYPES` (the range table)
  is deliberately a subset.
- `src/schemas/admin.ts` — a `productTypeField` (`z.enum` ∪ `""` → null, like
  `concentration`); `volumeMl` becomes optional/nullable; a `superRefine` that
  requires a volume for the volume-bearing types and clears it for the others,
  and that requires `format` when the type is one of the four non-fragrances.
  Extend `requireStrengthOrFormat` rather than duplicating it.
- `src/schemas/db/catalog.ts` — `volumeMl: z.number().nullable()`; add
  `productType` to `productRowSchema`, `PRODUCT_COLUMNS`,
  `productCardRowSchema` and `PRODUCT_CARD_COLUMNS` **only if** a render site
  needs it; if none does, leave the projections alone and say so in the header.
- `src/schemas/db/admin.ts` — `volumeMl: z.number().nullable()`, add
  `productType` to `ADMIN_PRODUCT_COLUMNS` and the row schema.
- `src/types/catalog.ts` — `volumeMl: number | null`, with the comment saying
  which types carry one.

**Form**

- `src/components/admin/ProductForm.tsx`:
  - A **Type** `AdminSelect` at the top of the Character section, above
    Concentration, options `("" = Not stated) | Perfume | Gift | Box | Antique |
    Decorative | Body Mist | Room Spray`.
  - Volume: `required` becomes conditional on the selected type; when the type
    does not take one, the input is hidden and its state cleared, so a stale
    number cannot be submitted invisibly.
  - Concentration: hidden for the four non-fragrance types; the Format line
    picks up `required` in that state, with the hint saying so.
  - The three note lists and the pyramid: hidden for `ANTIQUE`, `DECORATIVE`,
    `GIFT`, `BOX` — an antique has no top note. Cleared when hidden, same rule
    as volume.
  - Set contents (`includes`): keep visible for `GIFT` and `BOX` with its
    current hint; hidden for `ANTIQUE`/`DECORATIVE`.
  - `payload` gains `productType`, so `useUnsavedGuard` watches it — the file's
    existing rule that what reaches the server reaches the comparison.

**Reads**

- `src/lib/format.ts` — `formatVolume(volumeMl: number | null): string | null`,
  returning `null` for a typeless object. Do **not** return `""`: the call sites
  print a `·` separator beside it and an empty string leaves a dangling dot.
- The six render sites — guard the volume and its separator. `ProductPurchase`
  and the two cart lines print `{formatProductType(...)} · {formatVolume(...)}`;
  those become a joined array of the non-null parts.
- `src/actions/admin/catalog.ts` — carry `productType` through create and update;
  map the trigger's `raise exception` (Postgres `P0001`) onto a field error
  naming `volumeMl` or `productType`, the way `settingsFailure()` maps `23503`.

**Scripts / seed**

- `scripts/seed-types.ts`, `db-seed.ts`, `db-dump.ts`, `db-verify.ts` —
  `volumeMl` nullable and `productType` carried, so a dump round-trips.
  `supabase/seed/catalog.json` keeps its existing volumes; no seed row changes
  type.

## Security requirements

- `productType` is a closed enum on both sides. No free text reaches the column.
- Every write stays behind `requireAdmin()` in `src/actions/admin/catalog.ts`.
  No new action, no new route handler, no client-side database access.
- The trigger is the authority; the Zod refinement exists to produce a sentence,
  not to be the only check. A payload that bypasses the form still cannot write
  a Perfume with no volume.
- No RLS policy changes: `"Product"` writes already go through the service role.

## Acceptance criteria

1. A new product typed **Antique**, with a format line and no volume, saves.
2. A new product typed **Perfume** with the volume blank is refused, and the
   message names the Volume field — not a constraint name.
3. An existing fragrance opens with its volume intact, its type blank, and saves
   unchanged.
4. `/perfumes`, the PDP, the cart, the drawer and `/new-arrival` render an
   object with no volume without a dangling `·` and without `null ML`.
5. `/collections/body-mist` and `/collections/room-spray` still list exactly
   what they list today.
6. A `BODY_MIST` product moved to a `HOME` collection is still refused.
7. `npm run db:migrate` is a no-op on a second run.

## Checks to run

```
npm run lint
npx tsc --noEmit
npm run db:migrate     # then confirm the PostgREST reload line printed
npm run db:verify
npm run build
```

`db:migrate` prints "PostgREST schema cache reload signalled". Without it a new
column reads as absent and the services degrade to a fallback silently — see
`supabase/README.md` and AGENTS.md §9.

## Manual test steps

1. `npm run dev`, sign in as an admin, open `/admin/products/new`.
2. Choose **Type → Antique**. Confirm Volume, Concentration and the three note
   lists disappear, and Format line reads as required.
3. Fill name, collection, description, format line ("Alabaster Sphinx"), price,
   SKU. Save. Confirm the redirect to the gallery editor.
4. Reopen it. Confirm the type is still Antique and no volume is shown.
5. Add a photograph, then open the product's collection page on the storefront
   and confirm the card prints without a volume and without a stray separator.
6. Add it to the bag; confirm the cart page and the drawer both render the line.
7. Back in the dashboard, create a product typed **Perfume** with the volume
   blank and confirm the refusal names Volume.
8. Open an existing fragrance, confirm it is unchanged, save it, confirm it is
   still unchanged.
