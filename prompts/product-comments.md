# Product Comments — visitor reflections on the PDP

## Goal

Let any visitor leave a written comment on a product detail page
(`src/app/[locale]/perfume/[slug]/page.tsx`), signed in or not.

- **Signed in** → the comment is attributed to their Clerk display name.
- **Signed out** → the comment is attributed to **Guest** (`ضيف` in Arabic). No
  name field, no email field: they type the comment and post it.
- **No comments yet** → render the form only. No "no comments yet" panel, no
  empty heading, no reserved space.

Comments persist in Supabase (decided with the user) so they are visible to
every visitor, not just their author.

## Skills read

- `.agents/skills/supabase/SKILL.md` — RLS rules, key exposure rules, migration
  workflow, Data API grants. Its security checklist drives §Security below.
- `.agents/skills/clerk` — session read on the server (`currentUser()`), already
  wrapped by `src/lib/auth.ts`; no new Clerk surface is introduced.
- The auto-injected `ai-sdk` / `chat-sdk` suggestions were **not** followed: they
  were a lexical false positive ("comment"/"chat"). This feature contains no
  model call.

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `src/app/[locale]/perfume/[slug]/page.tsx` | ISR 300s, `generateStaticParams` over locale × slug, section rhythm, `Reveal` wrapping |
| `src/actions/contact.ts` | Server Action shape: honeypot → rate limit → Zod → side effect → `FormActionResult` |
| `src/schemas/contact.ts` | Errors as **codes**, never sentences; honeypot as `z.string().max(0).optional()` |
| `src/lib/email/rate-limit.ts` | `isRateLimited(scope, await clientKey(), { limit, windowMs })`, in-process fixed window |
| `src/components/contact/ContactForm.tsx` | Client form idiom: `useTransition`, `useDictionary()`, `FIELD_CLASS` / `LABEL_CLASS` / `ERROR_CLASS`, codes resolved against the dictionary |
| `src/lib/auth.ts` | `getViewer()` — the only module that answers "who is this?" |
| `src/components/ecommerce/ProductIngredients.tsx` | Server component that returns `null` when it has nothing to show — the exact precedent for the empty-state requirement |
| `src/services/products.ts` | Service layer is the swap seam; components never query |
| `supabase/sql/product-search.sql`, `supabase/README.md` | SQL house style, `security invoker`, `set search_path = ''`, "not a migration" convention |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | `dict.product.*` namespace the new copy joins |
| `src/lib/format.ts` | Date formatting lives here and nowhere else |

## Decisions and assumptions

1. **Supabase table, written server-side only.** Clerk is the identity provider,
   so `auth.uid()` is always null here and RLS cannot express "this comment is
   mine". Therefore RLS grants `anon`/`authenticated` **select only**; there is
   no insert policy for those roles. All writes go through the Server Action
   using the **secret (service-role) key**, which never touches a
   `NEXT_PUBLIC_` variable. Identity is stamped by the server from the Clerk
   session — the client never sends a name or a user id.
2. **New env var required:** `SUPABASE_SECRET_KEY` (server-only) in `.env.local`
   and `.env.example`. `NEXT_PUBLIC_SUPABASE_URL` already exists and is reused.
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is **not** used by this feature.
3. **Unconfigured = invisible.** If URL or secret key is missing, the section
   renders nothing at all. A form that cannot store anything must never be
   shown; this also keeps `npm run build` and preview deploys green without
   credentials, matching how the committed embeddings avoid build-time secrets.
4. **Display name is snapshotted** into `author_name` at insert time (from
   Clerk), so rendering a page never fans out to the Clerk Backend API.
   `author_clerk_id` is stored alongside it for future moderation/ownership and
   is never returned to the browser.
5. **Guest is a render-time fallback, not stored text.** A guest row has
   `author_name = null`; the UI substitutes `dict.product.comments.guest`, so
   the same row reads "Guest" in English and "ضيف" in Arabic.
6. **No FK to a product row** — the catalog is still static in `src/data/`. The
   column is `product_slug text not null`, and the Server Action validates the
   slug against `getProductBySlug()` before inserting, so an arbitrary slug
   cannot seed rows for a product that does not exist. A comment on
   `SQL`-side `Product` FK becomes a migration when the catalog lands in Postgres.
7. **Freshness under ISR.** The page is `revalidate = 300`. A successful post
   calls `revalidatePath` for the product path in **both** locales, so the new
   comment is public immediately; the client also appends it optimistically so
   the author never watches a spinner wondering if it worked.
8. **No ratings, no replies, no edit/delete** in this pass — the request was a
   comment. `rating`/`parent_id` are deliberately absent rather than nullable
   dead columns.

## Files likely to change

**New**

- `supabase/sql/product-comments.sql` — table, indexes, RLS, grants (design file, per the `supabase/README.md` convention; migration name is generated, never invented)
- `src/lib/supabase.ts` — server-only client factory + `isSupabaseConfigured()`
- `src/types/comments.ts` — `ProductComment`, `CommentActionResult`
- `src/schemas/comments.ts` — `productCommentSchema`
- `src/services/comments.ts` — `getCommentsForProduct(slug)`
- `src/actions/comments.ts` — `postProductComment(input)`
- `src/components/ecommerce/ProductComments.tsx` — Server Component (section + list)
- `src/components/ecommerce/CommentForm.tsx` — Client Component (`"use client"`)

**Modified**

- `src/app/[locale]/perfume/[slug]/page.tsx` — render the section
- `src/lib/i18n/dictionaries/en.ts`, `.../ar.ts` — `product.comments.*`
- `src/lib/format.ts` — `formatCommentDate(iso, locale)`
- `.env.example` — `SUPABASE_SECRET_KEY`
- `package.json` / lockfile — `@supabase/supabase-js` (pinned exact version, lockfile committed)

## Implementation requirements

### Schema — `supabase/sql/product-comments.sql`

```sql
create table if not exists public.product_comment (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null,
  author_clerk_id text,          -- null for guests
  author_name text,              -- null for guests; UI renders "Guest"
  body text not null check (char_length(body) between 2 and 1200),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists product_comment_slug_created_idx
  on public.product_comment (product_slug, created_at desc)
  where is_published;

alter table public.product_comment enable row level security;

-- Public read of published rows. No insert/update/delete policy for anon or
-- authenticated: every write arrives through the Server Action on the secret
-- key, which bypasses RLS by design.
create policy "product_comment_public_read"
  on public.product_comment for select
  to anon, authenticated
  using (is_published);

grant select on public.product_comment to anon, authenticated;
```

Header comment must state, in the file's own voice, that this is a **design
file, not a migration**, and point at `supabase/README.md` for the
`supabase migration new` sequence. Do not hand-write a timestamped filename.

### `src/lib/supabase.ts`

- `isSupabaseConfigured(): boolean` — both `NEXT_PUBLIC_SUPABASE_URL` and
  `SUPABASE_SECRET_KEY` present.
- `getSupabaseAdmin()` — memoised `createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })`, returning `null` when unconfigured (mirrors `getEmailClient()`).
- Module comment must state that this client bypasses RLS and must never be
  imported from a Client Component; add `import "server-only"` only if the
  package is already a dependency — otherwise leave the same NOTE comment
  `src/services/products.ts` carries.

### `src/schemas/comments.ts`

```ts
export const COMMENT_MIN_LENGTH = 2;
export const COMMENT_MAX_LENGTH = 1_200;   // must equal the SQL CHECK
```

`productCommentSchema` = `{ slug: string (trim, 1..120), body: trimmed
min/max with codes bodyRequired | bodyTooShort | bodyTooLong, company:
honeypot, locale: string }`. Codes only — the client owns the copy.

### `src/services/comments.ts`

`getCommentsForProduct(slug: string): Promise<ProductComment[]>`

- Returns `[]` when unconfigured or on error (log the message only, never row
  contents), so a Supabase outage degrades to "no comments", not a 500 PDP.
- `select("id, author_name, body, created_at")` — **never** `author_clerk_id`;
  it must not reach the browser.
- `.eq("product_slug", slug).eq("is_published", true).order("created_at", { ascending: false }).limit(50)`.
- Maps rows to `ProductComment { id, authorName: string | null, body, createdAt }`.

### `src/actions/comments.ts`

`"use server"`, `postProductComment(input: { slug, body, company, locale })`,
returning `CommentActionResult = { ok: true; comment: ProductComment } | { ok: false; error: "validation" | "rateLimited" | "delivery"; fieldErrors?: Record<string,string> }`.

Order, matching `actions/contact.ts` exactly:

1. Honeypot non-empty → `{ ok: true }`-shaped success with no write (return a
   synthetic result the client discards; do not tell the bot).
2. `isRateLimited("comment", await clientKey(), { limit: 5, windowMs: 10*60*1000 })`.
3. Zod parse → field error codes.
4. `getProductBySlug(parsed.slug)` → unknown slug is `{ ok: false, error: "validation" }`.
5. Identity from the **server**: `const viewer = await getViewer()` →
   `author_clerk_id = viewer?.id ?? null`, `author_name = viewer?.fullName?.trim() || null`.
   Never read a name from `input`.
6. Insert with `.select("id, author_name, body, created_at").single()`; on
   error log `error.message` only and return `{ ok: false, error: "delivery" }`.
7. `revalidatePath(\`/en/perfume/${slug}\`)` and `` `/ar/perfume/${slug}` ``.
8. Return the inserted row mapped to `ProductComment`.

Never log the comment body — same privacy rule the contact action states.

### `src/components/ecommerce/ProductComments.tsx` (Server Component)

- Props: `{ slug: string; locale: Locale }`.
- `if (!isSupabaseConfigured()) return null;`
- Fetches comments, awaits the dictionary.
- Renders a full-width `<section>` sitting between the product grid and
  `RelatedProducts`.
- **Empty state:** when `comments.length === 0`, render the heading + form and
  **nothing else** — no list container, no divider below the heading, no
  placeholder text, and no empty flex gap.
- Renders `<CommentForm slug={slug} guestLabel={...} />` below the list.

### `src/components/ecommerce/CommentForm.tsx` (Client Component)

- Single `<textarea>` (rows 4, `maxLength={COMMENT_MAX_LENGTH}`), a hidden
  honeypot input (`tabIndex={-1}`, `aria-hidden`, off-screen), and a submit
  button styled as the page's other primary actions.
- `useTransition`, `useDictionary()`, `useLocale()`; error codes resolved
  against `dict.product.comments.*`, exactly as `ContactForm` does.
- Uses `useUser()` from `@clerk/nextjs` **only** to render the byline preview
  above the field ("Posting as Amira" / "Posting as Guest"). This is cosmetic;
  the action re-derives identity server-side and does not trust it.
- On success: clear the field, prepend the returned comment to a local
  `optimistic` list rendered above the server list, show a brief confirmation
  line. On failure: inline error, field keeps its text.
- Disable the button while pending and when the trimmed body is shorter than
  `COMMENT_MIN_LENGTH`.

### Page wiring

```tsx
<ProductComments slug={product.slug} locale={activeLocale} />
<RelatedProducts products={related} locale={activeLocale} />
```

Wrap in `<Reveal>` only if it does not introduce a gap row when the component
returns `null` — otherwise place the `Reveal` **inside** `ProductComments`,
after its own null guard (the `ProductIngredients` precedent).

### Dictionary keys (`product.comments`)

`heading` (EN "Reflections" / AR "انطباعات"), `placeholder`, `submit`,
`submitting`, `postingAs`, `guest`, `sent`, `bodyRequired`, `bodyTooShort`,
`bodyTooLong`, `rateLimited`, `deliveryError`, `srLabel`. Arabic must be real
Arabic copy, not transliteration.

## Visual interpretation

- Section: `py-24 lg:py-32`, container matching `RelatedProducts`' horizontal
  padding (`px-6 sm:px-8 lg:px-14 xl:px-20`) so the two stack on one gutter.
- Heading: `font-heading uppercase tracking-[0.2em] text-ivory` at the same
  scale the PDP's other section headings use, with the existing gold hairline
  divider beneath it.
- Comment row: author name in `font-heading text-[11px] uppercase
  tracking-[0.2em] text-gold`, date in `text-[11px] text-ivory/35` on the same
  line (`ltrIsland` for the date in Arabic), body in `text-[13px]/relaxed
  text-ivory/70`, rows separated by `border-t border-border`, `py-7` each. No
  avatars, no bubbles, no cards — editorial ledger, not a chat thread.
- Form: reuse `ContactForm`'s `FIELD_CLASS` treatment on the textarea (border
  `border-border`, `bg-ivory/3`, focus `border-gold/40`, no webkit ring).
  Button: gold-bordered obsidian, `uppercase tracking-[0.2em]`, 500ms ease-out.
- Motion: fade/translate ≤ 8px on newly posted rows, `duration-500`,
  `ease-luxury-bezier`. Zero spring, zero bounce.
- RTL: the whole section inherits `dir` from the layout; only the timestamp is
  wrapped in `ltrIsland`.
- Responsive: single column throughout; textarea full width; at `lg` the
  section's max width matches the related-products grid so nothing looks
  orphaned on 1440px+.

## Security requirements

- `SUPABASE_SECRET_KEY` is server-only; it must never appear in a
  `NEXT_PUBLIC_` name, in a Client Component, or in a log line.
- RLS enabled on the table with **select-only** policies for `anon` /
  `authenticated`, plus the explicit `grant select` (Data API exposure is
  separate from RLS).
- Author identity is derived from the Clerk session inside the action. A
  client-supplied name or user id is impossible by construction — the input
  type has no such field.
- Body is validated with Zod on the server regardless of client checks; length
  is bounded in the schema **and** by a SQL `CHECK`.
- Honeypot + 5-per-10-minutes-per-client throttle before any database call.
- `author_clerk_id` is never selected into a client payload.
- Comment bodies are rendered as text (React escaping); no `dangerouslySetInnerHTML`,
  no markdown, no auto-linking.
- Never log comment bodies or author names.

## Acceptance criteria

- [ ] A signed-out visitor can post; the comment appears attributed to "Guest"
      (`ضيف` on `/ar`).
- [ ] A signed-in visitor's comment is attributed to their Clerk name.
- [ ] With zero comments the page shows the heading and form only — no empty
      panel and no extra vertical gap where a list would be.
- [ ] A posted comment survives a hard reload and is visible in a different
      browser (real persistence, not local state).
- [ ] With `SUPABASE_SECRET_KEY` unset the whole section is absent and the page
      renders and builds normally.
- [ ] Sixth post within ten minutes returns the throttle message, not a write.
- [ ] A 1,201-character body is rejected with `bodyTooLong` in the page's language.
- [ ] `author_clerk_id` appears nowhere in the HTML payload or client bundle.
- [ ] `npx tsc --noEmit` clean, `npm run lint` clean, zero `any`.
- [ ] No layout shift on post; motion has no spring.

## Checks to run

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Plus, after applying the SQL: `supabase db advisors` (or MCP `get_advisors`)
and fix everything it reports before committing.

## Manual test steps

1. Add to `.env.local`: `SUPABASE_SECRET_KEY=<service-role/secret key from the
   Supabase dashboard → Project Settings → API keys>`. `NEXT_PUBLIC_SUPABASE_URL`
   is already set.
2. Apply the schema:
   ```bash
   supabase migration new product_comments   # generates the filename
   # paste supabase/sql/product-comments.sql into the generated file
   supabase db push                          # or run the SQL in the dashboard SQL editor
   supabase db advisors
   ```
3. `npm run dev`, open `http://localhost:3000/en/perfume/<any-slug>`.
4. Signed out: confirm the byline reads "Posting as Guest", post a comment,
   confirm it appears immediately and after a hard reload.
5. Sign in with Clerk, post again, confirm the byline and the stored row carry
   the account name.
6. Open `/ar/perfume/<same-slug>`: same comments, "ضيف" for the guest row, RTL
   layout intact, timestamp still reading left-to-right.
7. Post six times in a row: the sixth shows the throttle message.
8. Paste 1,300 characters: rejected client-side and, with the length check
   removed from the DOM via devtools, rejected server-side too.
9. Comment out `SUPABASE_SECRET_KEY`, restart, reload the PDP: the section is
   gone and nothing else on the page changed.
10. View source and search for `user_2` / `author_clerk_id`: no matches.
