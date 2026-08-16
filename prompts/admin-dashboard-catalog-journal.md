# Prompt — Admin dashboard: catalog and journal authoring, no CMS

## Goal

Give the house a first-party authoring surface at `/admin`, reachable only by
`khem.official@outlook.com`, so collections, products (with their gallery) and
journal articles can be **created, edited and retired from the website itself**
rather than from the Supabase dashboard or a SQL file.

Scope agreed with the owner:

| In | Out (explicit non-goals) |
| :--- | :--- |
| `Collection`, `Product`, `ProductImage` | Testimonials, ingredients, timeline, craft records |
| `Article` (the journal) | Stockists, contact channels, legal documents, boutique settings |
| Full CRUD — list, create, edit, archive/unpublish | Orders, customers, comment moderation |
| Paste external image URLs | File upload / Supabase Storage / Cloudinary |
| English-only admin UI | Arabic translation of admin chrome |
| | An audit-log table |

Everything out of scope keeps working exactly as it does today; nothing public
changes shape.

---

## Skills read

- `AGENTS.md` — §1 execution rules, §5 prompt-file contract, §6 layer separation
  (services own reads, thin actions own writes, UI displays stored data only),
  §9 schema, §10 access control, §11 component aesthetics, §12 checklist.
- `.agents/skills/supabase` — service-role usage, RLS reasoning, schema/query
  conventions. **The relevant conclusion for this pass: no new SQL is needed.**
- `.agents/skills/clerk` — session access from Server Components; `currentUser()`
  and email-address verification state.
- `.agents/skills/ai-sdk` — `embed()` / `embedMany()` through the AI Gateway, for
  the product-embedding step (§ "Search embeddings" below).
- Not read: no Next.js routing question here is novel to the repo; the admin
  tree reuses the `[locale]` + proxy behaviour already established.

---

## Existing code inspected

| File | What it settles for this prompt |
| :--- | :--- |
| `supabase/sql/0001_catalog.sql` | Text (slug-shaped) primary keys; `"Product"."collectionSlug"` is an FK onto `"Collection"(slug)`; `product_strength_or_format` check; unique `slug`/`sku`; `product_image_one_primary_idx` (at most one primary image per product); RLS grants the public roles **select only**, and every write is expected to travel through the service role. |
| `supabase/sql/0002_content.sql` | `"Article"` columns, `isPublished` / `isFeatured`, `readTimeMinutes > 0` check, `publishedAt` is a `date`. |
| `supabase/sql/0004_search.sql` | `search_document` and `search_vector` are **generated** columns — never written by hand. `product_embedding_invalidation` nulls `embedding` whenever `search_document` changes on update. `related_products()` and `hybrid_search_products()` degrade to lexical when a vector is null. |
| `supabase/sql/0006_privileges.sql` | `anon`/`authenticated` hold no write grant, deliberately. Confirms: the dashboard must write with `SUPABASE_SECRET_KEY`, and no policy should be added to make it otherwise. |
| `src/lib/supabase.ts` | `getSupabasePublic()` (RLS applies, every read path) vs `getSupabaseAdmin()` (RLS bypassed, "the comment write action alone" today). Both `null` when unconfigured; callers degrade, never throw. |
| `src/lib/auth.ts` | `getViewer()` / `getUserId()` own "who is this?". Its closing NEXT STEP comment describes exactly this task and prescribes Clerk metadata; §"Decisions" below explains why an email allowlist is used instead, and that comment must be rewritten rather than left contradicting the code. |
| `src/proxy.ts` | Everything is rewritten into `/[locale]/…`; `/account` gets an early, explicitly **non-authoritative** shed, with the real check in the layout. `/admin` follows the same shape. |
| `src/actions/comments.ts` | The write-action template: validate at the boundary with Zod, return a discriminated result, check the `{ data, error }` tuple (never assume the await means success), `revalidatePath` for **both** locales, log the provider message and never row contents. |
| `src/services/products.ts`, `src/services/content.ts` | Read conventions: explicit column lists, never `select('*')`, `parseList` drops a malformed row rather than blanking a page, failure returns `[]`/`null` and logs. |
| `src/schemas/db/catalog.ts`, `src/schemas/db/content.ts` | Rows are **parsed, never asserted**. `PRODUCT_COLUMNS` deliberately omits `embedding`/`search_*`. |
| `src/components/contact/ContactForm.tsx` | The client-form pattern: `useTransition`, local field errors, server re-validates, `FIELD_CLASS` / `LABEL_CLASS` / `ERROR_CLASS` styling constants. |
| `scripts/embed-catalog.ts`, `src/lib/search/config.ts` | `embedMany` via AI Gateway, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, pgvector's `[0.1,…]` text literal, and the rule that writing `embedding` alone does not retrigger invalidation. |
| `src/app/robots.ts`, `src/app/sitemap.ts` | Both locale trees are listed literally in `DISALLOWED`; the sitemap enumerates collections, fragrance product slugs, legal docs and articles from the services. |
| `next.config.ts` | `next/image` remote hosts: `images.unsplash.com`, `res.cloudinary.com`, `img.clerk.com`. |

Two structural facts that shape the whole design:

1. **Admin reads cannot use the public client.** RLS hides archived products and
   unpublished articles — precisely the rows an editor must see. Admin reads
   therefore go through `getSupabaseAdmin()`, in their own service module.
2. **No migration is required.** Every table, constraint and trigger this
   dashboard needs already exists, and the service role already bypasses RLS.
   Adding a write policy for `authenticated` would undo `0006_privileges.sql`
   and must not be done.

---

## Decisions and assumptions

1. **Authorization is an email allowlist, checked server-side.**
   `ADMIN_EMAILS` (comma-separated, optional) defaults to the single address
   `khem.official@outlook.com`. The check compares, case-insensitively, against
   the Clerk user's **primary email address, and only if that address is
   verified** — an unverified address is not an identity claim.
   *Why not `publicMetadata.role` as `src/lib/auth.ts` prescribes:* that path
   needs a Clerk dashboard edit plus a JWT-claims customization before it can
   ever pass, so a fresh clone or a new Clerk instance silently locks the owner
   out of their own dashboard. The email is already verified by Clerk, is the
   thing the owner actually named, and is checked on the server on every request
   and every action — never in the browser, never from a cookie or payload.
   The NEXT STEP comment in `src/lib/auth.ts` is updated to say so; the role
   route is documented as the upgrade path for a second admin.
2. **The layout is not the boundary — every action re-checks.** A Server Action
   is a public HTTP endpoint. `requireAdmin()` is the first statement in every
   admin action, not an inherited property of the page that rendered the form.
3. **Non-admins get `notFound()`, not a redirect.** A 404 does not confirm that
   `/admin` exists. The proxy's early shed for signed-out requests is a cost
   optimisation only, exactly as it is for `/account`.
4. **Admin routes live under `src/app/[locale]/admin/`.** The proxy rewrites
   every unprefixed path into the locale tree, so a top-level `app/admin/` would
   404. The tree renders **English only** — no dictionary keys, no Arabic. The
   "no English strings on an Arabic page" rule protects customer-facing pages;
   this surface has one reader. `/ar/admin` is not linked and renders the same
   English UI.
5. **Money is entered in EGP, stored in piastres.** The form takes `1470.00` and
   writes `147000`. Parsing is done once, in the Zod schema, via a `z.coerce`
   + rounding transform — never with floating-point multiplication scattered
   through the UI.
6. **Retire, don't delete.**
   - Product → `isArchived` toggle (the column RLS already filters on).
   - Article → `isPublished` toggle.
   - Collection → editable, and deletable **only when empty**; the FK from
     `"Product"."collectionSlug"` is left to reject the rest, and its error is
     surfaced as a readable message rather than a stack trace.
   - `ProductImage` rows are genuinely deletable — they are subordinate data,
     and an unused image row has no meaning.
   Hard-deleting a product is out of scope: order history will point at it.
7. **Ids are derived from the slug.** `Collection.id`, `Product.id` and
   `Article.id` are set to the slug on create (matching every seeded row), so
   ids stay human-readable. `ProductImage.id` is `crypto.randomUUID()` — there
   is no natural key. **Slugs are immutable after creation**: the cart and the
   wishlist persist product ids in `localStorage` (see `0001_catalog.sql`'s
   header), so a rename would empty a returning visitor's bag. The edit form
   renders the slug as read-only text and the update action never accepts it as
   a mutable field.
8. **Generated columns are never written.** The insert/update payloads exclude
   `search_document` and `search_vector`; PostgREST would reject them.
9. **The dashboard's own reads are uncached.** Every admin route sets
   `export const dynamic = "force-dynamic"` and `robots: { index: false }`. An
   editor must never be shown a stale ISR copy of the row they just saved.

---

## Files likely to change

**New**

```
src/lib/admin.ts                              # isAdminEmail, requireAdmin, adminActorEmail
src/schemas/admin.ts                          # Zod input schemas + EGP→piastre transform
src/schemas/db/admin.ts                       # admin row projections (archived/unpublished visible)
src/services/admin/catalog.ts                 # service-role reads: collections, products, images
src/services/admin/journal.ts                 # service-role reads: articles
src/actions/admin/catalog.ts                  # create/update/archive collection, product, images
src/actions/admin/journal.ts                  # create/update/publish article
src/lib/search/embed.ts                       # single-document embedding, shared with the script
src/lib/admin/revalidate.ts                   # the one revalidation map (see below)
src/components/admin/AdminShell.tsx           # sidebar + header chrome
src/components/admin/fields.tsx               # AdminInput/Textarea/Select/Toggle/TagList/StringList
src/components/admin/AdminTable.tsx           # list table primitive
src/components/admin/CollectionForm.tsx       # client form
src/components/admin/ProductForm.tsx          # client form
src/components/admin/ProductImageEditor.tsx   # gallery rows: add/remove/reorder/set-primary
src/components/admin/ArticleForm.tsx          # client form
src/components/admin/ArchiveToggle.tsx        # confirm-then-toggle control
src/app/[locale]/admin/layout.tsx             # requireAdmin() + shell
src/app/[locale]/admin/page.tsx               # counts, missing-embedding count, quick links
src/app/[locale]/admin/collections/page.tsx
src/app/[locale]/admin/collections/new/page.tsx
src/app/[locale]/admin/collections/[slug]/page.tsx
src/app/[locale]/admin/products/page.tsx
src/app/[locale]/admin/products/new/page.tsx
src/app/[locale]/admin/products/[slug]/page.tsx
src/app/[locale]/admin/journal/page.tsx
src/app/[locale]/admin/journal/new/page.tsx
src/app/[locale]/admin/journal/[slug]/page.tsx
```

**Edited**

```
src/proxy.ts          # early shed for /admin, mirroring the account block
src/app/robots.ts     # "/admin" and "/ar/admin" into DISALLOWED
src/lib/auth.ts       # rewrite the NEXT STEP comment to match what shipped
src/lib/supabase.ts   # the "today that is comments alone" line is no longer true
scripts/embed-catalog.ts  # import the extracted embedding helper, no behaviour change
.env.example (or README) # document ADMIN_EMAILS
```

No file under `supabase/sql/` changes.

---

## Implementation requirements

### 1. `src/lib/admin.ts`

```ts
export function isAdminEmail(email: string | null | undefined): boolean
export async function getAdminActor(): Promise<AdminActor | null>  // null when not an admin
export async function requireAdmin(): Promise<AdminActor>          // notFound() when not
```

- Allowlist parsed once from `process.env.ADMIN_EMAILS`, split on `,`, trimmed,
  lowercased, empty entries dropped; falls back to `["khem.official@outlook.com"]`.
- `getAdminActor()` uses Clerk `currentUser()`, reads `primaryEmailAddress`, and
  requires `verification?.status === "verified"`.
- `requireAdmin()` calls `notFound()` from `next/navigation` — including for a
  signed-out visitor.
- `server-only` import at the top.

### 2. `src/proxy.ts`

Beside the existing account block, using `stripLocale`'s `path`: when the path
is `/admin` or starts with `/admin/` and `userId === null`, redirect to sign-in
via `signInPathWithReturn`. Extend the doc comment to say this is a
cost/UX optimisation and that `admin/layout.tsx` plus every action hold the
actual boundary. Do not attempt an email check here.

### 3. Admin reads — `src/services/admin/*.ts`

- `import "server-only"` and use `getSupabaseAdmin()`.
- Each module opens with a comment stating why it may bypass RLS: the editor
  must see archived and unpublished rows, which the public policies hide by
  design.
- Explicit column lists (new constants in `src/schemas/db/admin.ts`), never
  `select('*')` — that would drag the 1536-float embedding into the payload.
- Rows parsed with new Zod schemas that extend the public ones with
  `isArchived`, `deletedAt`, `isPublished`, `sortOrder`, `createdAt`,
  `updatedAt`. `parseList` is reused from `src/schemas/db/catalog.ts`.
- Functions: `listAdminCollections()`, `getAdminCollection(slug)`,
  `countProductsInCollection(slug)`, `listAdminProducts()`,
  `getAdminProduct(slug)` (with images), `listAdminArticles()`,
  `getAdminArticle(slug)`, `countProductsMissingEmbedding()`,
  `getAdminCounts()`.
- Failure returns `[]`/`null` and logs `[admin] <fn> failed: <message>`.

### 4. Admin writes — `src/actions/admin/*.ts`

Every exported action:

1. `"use server"` at the top of the module.
2. `const actor = await requireAdmin();` as the **first** statement.
3. Parse input with the matching Zod schema from `src/schemas/admin.ts`; on
   failure return `{ ok: false, error: "validation", fieldErrors }` built the
   same way `actions/comments.ts` builds it.
4. `getSupabaseAdmin()`; `null` → `{ ok: false, error: "unconfigured" }`.
5. Check the `{ data, error }` tuple explicitly. Map known Postgres codes to
   readable messages rather than leaking the raw string:
   - `23505` unique violation → which field, from the constraint name
     (`Product_slug_key`, `Product_sku_key`, `product_image_one_primary_idx`).
   - `23503` foreign key violation → "That collection no longer exists" on
     insert; "This collection still has products" on collection delete.
   - `23514` check violation → `product_strength_or_format` becomes
     "A product needs either a concentration or a format."
6. Revalidate via `src/lib/admin/revalidate.ts` (below).
7. Return a discriminated result; never throw across the boundary.
8. Log `[admin] <action> by <actor email> → <slug>` on success, provider message
   on failure. Never log a full row body.

Actions:

```
createCollection / updateCollection / deleteCollection
createProduct / updateProduct / setProductArchived
saveProductImages          # whole-gallery replace, transactional in spirit: delete-then-insert
createArticle / updateArticle / setArticlePublished
```

`saveProductImages` must enforce **at most one primary** before writing, and
must default the first row to primary when the editor set none — otherwise the
partial unique index rejects the write and the grid falls back to the
placeholder.

### 5. Search embeddings

Extract from `scripts/embed-catalog.ts` into `src/lib/search/embed.ts`:

```ts
export function hasGatewayCredentials(): boolean
export function toVectorLiteral(vector: readonly number[]): string
export async function embedDocument(document: string): Promise<number[] | null>
```

`embedDocument` uses `embed()` from `ai` with `EMBEDDING_MODEL`,
`providerOptions: { openai: { dimensions: EMBEDDING_DIMENSIONS } }`, verifies
the returned width against `EMBEDDING_DIMENSIONS`, and returns `null` on any
failure (missing credentials, gateway error, wrong width). The script keeps its
batched `embedMany` path and imports the two helpers so the literal format and
the credential check exist once.

After a successful product insert or update, the action:

1. selects `search_document` back for that slug (it is generated, so only the
   database knows its final value),
2. calls `embedDocument()`,
3. on a non-null vector, `update({ embedding: literal }).eq('slug', slug)`.

This step is **best-effort**. A failure is logged and the action still returns
`ok` — the row is saved, search degrades to lexical for that product exactly as
it does on a fresh database, and the dashboard surfaces the backlog.

> Verify during implementation that PostgREST accepts the `[0.1,…]` text literal
> for the `extensions.vector` column. If it does not, drop the inline write,
> leave `embedding` null, and rely on the dashboard's "N products awaiting an
> embedding — run `npm run embed`" panel. Do not add an SQL RPC for it in this
> pass, and do not report the feature as working if this branch is taken.

`AI_GATEWAY_API_KEY` must exist in the Vercel environment for the inline path to
work in production; note this in the test steps.

### 6. Revalidation — `src/lib/admin/revalidate.ts`

One module, so no action invents its own list. For each locale in `LOCALES`:

| Write | Paths revalidated |
| :--- | :--- |
| Collection | `/`, `/collections`, `/collections/<slug>` |
| Product | `/`, `/perfumes`-equivalent grids, `/collections/<collectionSlug>`, `/perfume/<slug>`, the category path for the collection's kind (`productHref` / `CATEGORY_PATH` in `src/lib/routes.ts`), `/new-arrival` when `NEW_ARRIVAL` is among its tags |
| Article | `/`, `/journal` |

Plus `revalidatePath('/sitemap.xml')` on any create, publish or archive, since
the sitemap enumerates products and articles.

Resolve the category path from `src/lib/routes.ts` rather than hard-coding
strings, so a fifth `CollectionKind` fails to compile here too.

### 7. Validation — `src/schemas/admin.ts`

Mirror the database constraints; the database is the backstop, not the first
line. Notable rules:

- `slug`: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, 2–64 chars.
- `priceEgp`: coerced number ≥ 0, ≤ 1_000_000, transformed to
  `Math.round(value * 100)` piastres.
- `volumeMl`: integer > 0. `inventory`: integer ≥ 0.
- `concentration` nullable enum, `format` nullable string, with a
  `superRefine` requiring at least one — the TypeScript twin of
  `product_strength_or_format`.
- `topNotes`/`heartNotes`/`baseNotes`/`includes`/`facts`: `string[]`, each entry
  trimmed and non-empty, empty array allowed, max 12 entries.
- `tags`: array of `"NEW_ARRIVAL" | "LIMITED_EDITION"`, deduped.
- Image `url`: `z.url()` **and** a hostname check against the `next.config.ts`
  remote patterns, with the error naming the allowed hosts — a URL from an
  unlisted host renders as a broken `next/image`, and catching it at the form is
  the difference between a clear message and a mystery.
- `publishedAt`: `YYYY-MM-DD`. `readTimeMinutes`: integer ≥ 1, ≤ 120.
- Every free-text field gets a maximum length.

### 8. UI

Server Components fetch and render; forms are Client Components taking the row
as a prop and calling the action through `useTransition`, following
`ContactForm`'s structure (local affordance validation, server-authoritative
re-validation, inline field errors, a form-level error line, disabled+labelled
pending state). Reuse `ContactForm`'s `FIELD_CLASS` / `LABEL_CLASS` /
`ERROR_CLASS` by lifting them into `src/components/admin/fields.tsx` rather than
copying the strings.

- Shell: obsidian background, a left rail (Dashboard · Collections · Products ·
  Journal) with a gold hairline active marker, header showing the actor's email
  and a link back to the site.
- Typography: `font-heading` uppercase `tracking-[0.2em]` for section titles and
  table headers; `font-sans` for field values.
- Tables: `border-border` hairlines, hover `bg-ivory/3`, a status pill —
  gold for live, muted for archived/draft.
- Buttons: the §3.2 language — `rounded-none`, gold border, uppercase
  `tracking-[0.2em]`. Destructive actions (delete collection, archive product)
  use `--color-danger` on the border only, and require a confirm step.
- Motion: opacity/`translateY` fades on the existing `--ease-luxury-bezier`
  only. No spring, no layout-shifting entrance on a table.
- Every list has a real empty state ("No articles yet" + a create link), and
  every form shows a success line naming the saved record with a link to its
  public page.
- Responsive down to 768px: the rail collapses to a top row of links; tables
  scroll inside their own `overflow-x-auto`, and the page body never scrolls
  horizontally.

---

## Security requirements

1. `requireAdmin()` is the first statement of **every** admin Server Action and
   of `admin/layout.tsx`. No action trusts the caller having rendered a page.
2. `SUPABASE_SECRET_KEY` never leaves the server: all admin modules import
   `server-only`, and no admin client component imports a service module.
3. The allowlist is read from `process.env` on the server only. It is never
   sent to the browser, never put in a `NEXT_PUBLIC_` variable, and the actor's
   email is rendered as text only after the server has already authorized them.
4. No RLS policy, grant, or default privilege is added anywhere.
   `npm run db:verify`'s "the public roles hold no write grant" check must still
   pass afterwards.
5. Untrusted input never reaches a query un-parsed: route params (`[slug]`) are
   used as equality filters only, and all bodies pass Zod first.
6. Generated columns (`search_document`, `search_vector`) are never in a write
   payload; `embedding` is written only by the dedicated follow-up update.
7. `/admin` and `/ar/admin` are added to `robots.ts`'s `DISALLOWED`, every admin
   page exports `robots: { index: false, follow: false }` metadata, and no admin
   route appears in `sitemap.ts`.
8. Logs carry the actor's email, the action, the slug and the provider's error
   message — never a row body and never a key.
9. A non-admin signed-in user hitting any admin URL or invoking any admin action
   directly gets a 404 / `notFound()` result, with no row data in the response.

---

## Acceptance criteria

- [ ] Signed in as `khem.official@outlook.com`, `/admin` renders the dashboard
      with live counts and a missing-embedding figure.
- [ ] Signed in as any other account, `/admin`, `/admin/products` and
      `/ar/admin` all render the 404 page. Signed out, they redirect to sign-in
      and return to the requested admin URL afterwards.
- [ ] A product created in the dashboard appears on its collection page, its
      category grid and (for a fragrance) its `/perfume/<slug>` detail page
      within one reload — no manual redeploy, no `npm run db:*`.
- [ ] Editing a product's price updates every surface that quotes it, in both
      locales, and the price is stored in piastres (`147000` for EGP 1,470.00).
- [ ] Archiving a product removes it from every public grid, its detail page
      404s, and the row still appears in the admin list marked archived.
- [ ] Gallery editing: adding, removing, reordering and re-designating the
      primary image all persist, and the grid card follows the primary flag.
- [ ] A duplicate slug or SKU produces a readable inline field error, not a 500
      and not a swallowed no-op.
- [ ] A product saved with neither concentration nor format is rejected at the
      form with the "concentration or format" message, and the database check is
      never reached.
- [ ] Deleting a collection that still has products fails with a readable
      message; deleting an empty one succeeds.
- [ ] An article created as a draft is absent from `/journal`; publishing it
      makes it appear, and it enters `/sitemap.xml`.
- [ ] Slug fields are read-only on every edit form.
- [ ] Either newly created products carry an embedding (verify via `npm run
      embed -- --check`), or the fallback branch was taken and the dashboard
      shows the backlog with instructions — stated explicitly in the report,
      not left ambiguous.
- [ ] `npx tsc --noEmit` clean, zero `any`, `npm run lint` clean,
      `npm run build` succeeds, `npm run db:verify` still passes.
- [ ] No file under `supabase/sql/` was modified.

---

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run db:verify
npm run embed -- --check     # expect 0 pending after creating a product
```

---

## Manual test steps

1. Add `ADMIN_EMAILS=khem.official@outlook.com` to `.env.local` (optional — it
   is the default), confirm `SUPABASE_SECRET_KEY` and `AI_GATEWAY_API_KEY` are
   present, then `npm run dev`.
2. Visit `http://localhost:3000/admin` **signed out** → expect a redirect to
   `/sign-in`, and after signing in as the admin, a landing back on `/admin`.
3. Sign in with any non-admin account → `/admin` shows the 404 page. Also try
   `/ar/admin` and `/admin/products/new`.
4. Sign in as `khem.official@outlook.com` → the dashboard lists counts for
   collections, products (live/archived) and articles.
5. **Collections** → New. Name "Test Chapter", slug `test-chapter`, kind
   `FRAGRANCE`, banner URL from `images.unsplash.com`, save. Confirm it appears
   at `/collections` and at `/collections/test-chapter`.
6. **Products** → New. Assign it to `test-chapter`, price `1470.00`, volume
   `100`, concentration `EAU_DE_PARFUM`, three notes per tier, one image marked
   primary, save. Confirm:
   - `/collections/test-chapter` shows the card at the right price,
   - `/perfume/<slug>` renders the pyramid and gallery,
   - `/ar/perfume/<slug>` renders too.
7. Try saving a second product with the same SKU → inline field error, no crash.
8. Try saving a product with neither concentration nor format → form-level
   error, nothing written.
9. Edit the product's price to `1650.00` and add a second image; reorder the
   gallery and move the primary flag to the second image. Reload the detail page
   and the collection grid and confirm both followed.
10. Search for the product's name in the site search overlay. Then run
    `npm run embed -- --check` and record whether the inline embedding landed.
11. Archive the product → it disappears from `/collections/test-chapter`,
    `/perfume/<slug>` 404s, and the admin list still shows it as archived.
12. Try deleting the `test-chapter` collection while the archived product still
    references it → readable failure. Unarchive-and-reassign or remove the
    product, then delete again → succeeds.
13. **Journal** → New article, leave it unpublished → absent from `/journal`.
    Publish it → present, and listed in `http://localhost:3000/sitemap.xml`.
14. `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/robots.txt` and
    confirm `/admin` and `/ar/admin` are disallowed in the body.
15. Narrow the browser to 768px and walk every admin page — no horizontal body
    scroll, tables scroll inside their own container.
16. Clean up the test rows before finishing.
