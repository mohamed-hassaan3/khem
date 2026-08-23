# PDP — Sticky Buy Bar, Buy Now, Star Ratings & Comment Photos

## Goal

Four changes to the product detail pages (`/perfume/[slug]` **and** `/ritual/[slug]`, which share
`<ProductPurchase>` and `<ProductComments>`):

1. **Sticky purchase bar.** Once the visitor scrolls past the in-page buy block, a slim fixed bar
   appears centred at the bottom of the viewport carrying the product, the price and the two buy
   controls. It disappears again when the buy block is back on screen.
2. **Buy Now.** A second control beside *Add to Cart* — in the buy block and in the sticky bar,
   side by side at every breakpoint including the narrowest phone. It adds the line and goes
   straight to `/checkout`.
3. **Star rating.** A quick way to leave feedback without writing anything: an elegant 1–5 star
   control above the comment field, plus an average-rating summary at the head of the section. A
   rating alone is a valid submission; a comment alone stays valid too.
4. **Photos on comments.** An image control beside *Post Comment*, up to 3 images per comment.
   Clicking a thumbnail in the thread opens a simple lightbox carousel with the comment body
   printed under the image.

## Skills read

- `AGENTS.md` (§1 operational rules, §2 workflow, §3 design system, §6 stack, §8 routing, §9 schema,
  §12 checklist).
- No `.agents/skills/*` skill applies: this touches no Clerk configuration beyond the existing
  `getViewer()`/`useUser()` calls, no AI SDK, and only the already-established Supabase patterns
  (`getSupabaseAdmin()` + secret key on the server, publishable key never touching a write).
  The session hook suggested `ai-sdk` and `vercel-services`; neither has any bearing on this task.

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `src/app/[locale]/perfume/[slug]/page.tsx` | ISR 300s; `<ProductGallery>` + `<ProductPurchase>` in a 2-col section, `<ProductComments>` below it. |
| `src/app/[locale]/ritual/[slug]/page.tsx` | Same two components, different body — every change must serve both. |
| `src/components/ecommerce/ProductPurchase.tsx` | `"use client"`, `PurchasableProduct` pick, `useCart().addLine`, quantity stepper, `justAdded` confirmation, `btn-luxury btn-luxury-fill` full-width button, stock label, trust badges. |
| `src/components/ecommerce/AddToBagButton.tsx` | Card-level bag control; opens the drawer via `useCartDrawer()`. |
| `src/components/ecommerce/ProductComments.tsx` | Server Component; returns `null` when Supabase is unconfigured; passes `storedIds` to the form. |
| `src/components/ecommerce/CommentForm.tsx` | `"use client"`; honeypot, optimistic `posted` list, dictionary-resolved error codes, `startTransition`. |
| `src/components/ecommerce/CommentRow.tsx` | Hook-free, rendered on both server and client; body escaped as text. |
| `src/actions/comments.ts` | Honeypot → throttle → Zod → slug check → insert → `revalidatePath` per locale. |
| `src/services/comments.ts` | `COMMENT_COLUMNS`, `toComment()`, `getCommentsForProduct()`, `MAX_COMMENTS = 50`. |
| `src/schemas/comments.ts` | `productCommentSchema`, `commentRowSchema`, code-not-sentence field errors. |
| `supabase/sql/0005_comments.sql` | `public.product_comment`; RLS read-only for `anon`/`authenticated`, writes only via the secret key. |
| `src/components/ecommerce/CartDrawer.tsx` | The modal pattern to copy for the lightbox: always mounted, `inert` when closed, focus trap on the `FOCUSABLE` selector, restore focus to the trigger, `end`-anchored, explicit RTL transform. |
| `src/components/ecommerce/ProductGallery.tsx` | The carousel pattern: scroll-snap track, IntersectionObserver-derived `activeIndex`, `scrollIntoView` (never `scrollLeft` arithmetic), `dir`-aware arrow icons. |
| `src/providers/cart-provider.tsx` | `addLine(productId, quantity, maxQuantity)`, id+quantity only. |
| `src/app/[locale]/checkout/page.tsx` | `force-dynamic`, guest checkout supported — a Buy Now landing there needs no session. |
| `src/lib/i18n/config.ts` | `localizePath(locale, path)` for the Buy Now navigation. |
| `src/app/globals.css` | `.btn-luxury`, `.btn-luxury-fill`, `.eyebrow`, `.gold-line`, and the `[lang="ar"]` letter-spacing resets. |
| `next.config.ts` | `images.remotePatterns` — unsplash, cloudinary, `img.clerk.com`. |
| `scripts/db-migrate.ts` | Applies `supabase/sql/*.sql` in filename order, all in one transaction, every file idempotent. Next free number is `0018`. |

## Decisions and assumptions

1. **Image storage = Supabase Storage.** There are no Cloudinary credentials in `.env.local`
   (`res.cloudinary.com` is only a `remotePatterns` entry for seeded catalog URLs), and Supabase is
   already the write path for comments with `SUPABASE_SECRET_KEY` held server-side. Uploads go
   through the Server Action holding that key — the browser never talks to Storage directly and no
   upload policy is granted to `anon`.
2. **Bucket `comment-images`, public.** Public buckets serve `/storage/v1/object/public/…` without
   RLS, so reads need no policy. Created by the migration with an idempotent insert into
   `storage.buckets` inside a `DO` block that swallows an insufficient-privilege error and raises a
   `NOTICE` telling the operator to create it in the dashboard — the migration must never take the
   transaction down over it.
3. **Rating lives on `product_comment`**, not on a separate table and not on the `Review` model in
   AGENTS.md §9 (which, like `Wishlist`, was never migrated — do not create it). A rating and a
   comment are one act by one visitor; splitting them would need a join to render a single row.
4. **A submission needs a rating *or* a body**, not both. `body` therefore becomes nullable and its
   `CHECK` moves to "null, or 2–1200 chars", with a table-level check that at least one of
   `rating`/`body` is present.
5. **Ratings are not deduplicated per visitor.** Nothing in the current model does — comments are
   not deduplicated either, and the rate limit is the only ceiling. Out of scope; flagged, not built.
6. **Buy Now = add the line, then `router.push(localizePath(locale, "/checkout"))`.** No drawer, no
   separate express-checkout path. Guest checkout already works, so it needs no sign-in gate.
7. **Sold out disables both controls.** Buy Now inherits every guard Add to Cart has.
8. **Limits:** 3 images per comment, 5 MB each, `image/jpeg`, `image/png`, `image/webp` only.
   Enforced in the schema, re-checked in the action (magic-byte sniff on the first bytes, not the
   client-declared MIME), and by the bucket's own allowed-MIME/size settings.

## Files likely to change

**New**

- `supabase/sql/0018_comment_rating_images.sql` — `rating` column, `body` nullable + checks,
  `product_comment_image` table with RLS/grants matching `0005`, `comment-images` bucket.
- `src/components/ecommerce/StickyPurchaseBar.tsx` — client, the fixed bar.
- `src/components/ecommerce/BuyNowButton.tsx` — client, shared by the buy block and the bar.
- `src/components/ecommerce/StarRating.tsx` — one component, `readonly` and interactive modes.
- `src/components/ecommerce/RatingSummary.tsx` — average + count at the head of the section.
- `src/components/ecommerce/CommentImageUploader.tsx` — file picker, previews, remove, validation.
- `src/components/ecommerce/CommentLightbox.tsx` — the modal carousel.
- `src/lib/comment-images.ts` — shared limits, accepted types, magic-byte sniff, public URL builder.

**Changed**

- `src/components/ecommerce/ProductPurchase.tsx` — controls row, `ref` on the block for the sticky
  observer, renders `<StickyPurchaseBar>`.
- `src/components/ecommerce/ProductComments.tsx` — fetches ratings summary, passes it down.
- `src/components/ecommerce/CommentForm.tsx` — star control, uploader, new submit rules.
- `src/components/ecommerce/CommentRow.tsx` — stars in the header, thumbnail strip, lightbox trigger.
- `src/actions/comments.ts` — accept `rating` + `images`, upload, insert image rows, rollback.
- `src/services/comments.ts` — select rating + images, `getProductRatingSummary()`.
- `src/schemas/comments.ts` — rating + image schemas, relaxed body rule.
- `src/types/comments.ts` — `rating`, `images`, `ProductRatingSummary`.
- `src/lib/i18n/dictionaries/en.ts`, `src/lib/i18n/dictionaries/ar.ts` — all new copy, both trees.
- `next.config.ts` — `remotePatterns` entry for the Supabase Storage host.

## Implementation requirements

### 1. Database — `supabase/sql/0018_comment_rating_images.sql`

- Header comment in the voice of `0005_comments.sql`: what changed, why the trust model is unchanged.
- `alter table public.product_comment add column if not exists rating smallint;`
  with a named check `rating is null or rating between 1 and 5`.
- Drop the existing body length check and re-add as
  `body is null or char_length(body) between 2 and 1200`; `alter column body drop not null`.
- Table check `product_comment_has_content`: `rating is not null or body is not null`.
- `public.product_comment_image` — `id uuid pk`, `comment_id uuid not null references
  public.product_comment(id) on delete cascade`, `storage_path text not null`, `width int`,
  `height int`, `sort_order int not null default 0`, `created_at timestamptz not null default now()`,
  index on `(comment_id, sort_order)`.
- RLS on, `select` policy `to anon, authenticated` restricted to images whose parent comment is
  published (`exists (select 1 from public.product_comment c where c.id = comment_id and
  c.is_published)`), `grant select` only — no insert/update/delete grant, exactly as `0005`.
- Bucket creation as decided above (`public = true`, `file_size_limit`, `allowed_mime_types`),
  wrapped so a privilege failure is a `NOTICE`, not a transaction abort.
- Every statement idempotent (`if not exists`, `drop … if exists` before `create`), because
  `db-migrate` re-runs the whole directory.

### 2. Schemas — `src/schemas/comments.ts`

- `COMMENT_MAX_IMAGES = 3`, `COMMENT_MAX_IMAGE_BYTES = 5 * 1024 * 1024`,
  `COMMENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]`.
- `productCommentSchema`: `body` becomes optional (`""` normalises to `undefined`);
  `rating: z.number().int().min(1).max(5).optional()`;
  `images: z.array(commentImageUploadSchema).max(COMMENT_MAX_IMAGES).optional()`;
  a `.refine()` requiring `body` or `rating` with the code `contentRequired`.
- `commentImageUploadSchema` — `{ dataUrl | base64: string, type: enum, size: number }`; codes
  `imageTooLarge`, `imageType`, `imageCount`. Keep emitting **codes, not sentences**.
- `commentRowSchema` gains `rating: z.number().nullable()` and an optional nested image array;
  add `commentImageRowSchema` for the joined rows.

### 3. Action — `src/actions/comments.ts`

Order stays: honeypot → throttle → Zod → slug check → identity → write. Additions:

- Decode each image server-side, sniff the leading bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`,
  WEBP `RIFF`+`WEBP`) and reject a mismatch with `imageType`. The client-declared MIME is a hint.
- Upload to `comment-images/<productSlug>/<commentId>/<index>.<ext>` with `upsert: false`,
  `contentType` from the sniff. Insert the comment row first so the id is real.
- If any upload or image-row insert fails, delete the uploaded objects **and** the comment row, then
  return `{ ok: false, error: "delivery" }`. A half-written comment with missing photos is worse than
  a clean failure.
- Return the full projection (rating + images) on success so the optimistic row matches the stored one.
- Keep the privacy rule: never log a body, an author name, or an image path.

### 4. Service — `src/services/comments.ts`

- Extend `COMMENT_COLUMNS` to `id, author_name, body, rating, created_at,
  product_comment_image(id, storage_path, width, height, sort_order)` and sort images by
  `sort_order` in `toComment()`. Still no `author_clerk_id`.
- `getProductRatingSummary(slug)` → `{ average: number; count: number; distribution: Record<1|2|3|4|5, number> }`,
  computed over published rows with a non-null rating. Returns a zeroed summary on every failure, the
  same degradation `getCommentsForProduct()` already promises.
- Build public URLs through `src/lib/comment-images.ts`, never by string-concatenating in a component.

### 5. UI — buy controls

`<ProductPurchase>`:

- Replace the single full-width button with a two-column row:
  `grid grid-cols-2 gap-3` at **every** breakpoint (the user asked for side-by-side on mobile too).
  Add to Cart keeps `btn-luxury btn-luxury-fill`; Buy Now uses `btn-luxury` (outlined) so the primary
  action still reads as primary. Both `justify-center`, both disabled and `opacity-40` when sold out.
- Attach a `ref` to the controls row and observe it with an IntersectionObserver
  (`threshold: 0`, `rootMargin: "0px"`). Bar visible ⟺ the row is **not** intersecting **and** it has
  been scrolled past (`boundingClientRect.top < 0`) — never when the visitor is still above the block.
- Render `<StickyPurchaseBar>` from here so it inherits the same product, quantity and handlers.

`<StickyPurchaseBar>`:

- `fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4` with a `mx-auto w-full max-w-3xl`
  panel: `border border-border-gold/40 bg-background/85 backdrop-blur-md shadow-luxury`,
  `rounded-none` (sharp, per §3.2).
- Content: product name (`font-heading`, truncated to one line) + price on the start side, the two
  buttons on the end side. On `< sm`, the name row collapses out and only the price and the two
  buttons remain, still side by side.
- Motion: `translate-y-full opacity-0` → `translate-y-0 opacity-100`,
  `transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]`. No spring.
  Always mounted, `inert` + `pointer-events-none` when hidden, so the exit transition plays and the
  buttons never take focus while invisible. Honour `prefers-reduced-motion` (fade only).
- Must not cover the cart drawer or the lightbox — keep `z-40` below their z-index; verify against
  `CartDrawer`'s.
- Add `pb-[env(safe-area-inset-bottom)]` so it clears the iOS home indicator.

`<BuyNowButton>`:

- `addLine(productId, quantity, inventory)` then `router.push(localizePath(locale, "/checkout"))`.
- Disabled when sold out; `aria-busy` while the transition runs.

### 6. UI — ratings

- `<StarRating>` — `value`, `max = 5`, `readonly`, `onChange`, `size`. Interactive mode is a
  `radiogroup` of five labelled radios (real inputs, keyboard-operable with arrows, visually hidden)
  with `<Star>` from lucide at `strokeWidth={1.25}`; filled stars `fill-gold text-gold`, empty
  `text-ivory/25`, hover/focus preview via `peer`/state. Readonly mode renders a plain
  `role="img"` with an `aria-label` carrying the interpolated "{rating} out of 5".
- `<RatingSummary>` — sits directly under the section heading in `<ProductComments>`: the average to
  one decimal in `font-heading text-3xl text-gold` (`tabular-nums`), a readonly star row, and the
  count. Renders nothing when `count === 0`. Wrap the numerals in `ltrIsland(locale)`.
- In `<CommentForm>`, the star control sits **above** the textarea with its own uppercase gold label
  and an optional-marker in the copy. Submitting is enabled when `rating > 0` **or** the trimmed body
  clears `COMMENT_MIN_LENGTH`. When only a rating is sent, the submit label switches to the
  "Post Rating" string.
- `<CommentRow>` prints a readonly star row in its header, after the author name, when
  `comment.rating !== null`. It must stay hook-free — it is rendered on the server too.

### 7. UI — comment photos

- `<CommentImageUploader>` — an icon-only button (`ImagePlus`, `strokeWidth={1.25}`) sitting in the
  same flex row as *Post Comment*, styled as a `size-11` bordered square matching `AddToBagButton`'s
  frame. Hidden `<input type="file" multiple accept="image/jpeg,image/png,image/webp">`.
  Client-side: reject over-count / over-size / wrong-type with the dictionary message, read to a data
  URL, show `size-16` previews with a small `X` remove control and an `aria-label` per preview.
  Revoke nothing (data URLs) but clear state on a successful post.
- `<CommentRow>` renders a thumbnail strip under the body: `flex flex-wrap gap-2`, each a
  `next/image` in a `size-20` frame with `border border-border`, a subtle
  `hover:border-gold transition-colors duration-300 ease-out`, wrapped in a `<button>` that opens the
  lightbox at that index. Never a bare `<img>`.
- `<CommentLightbox>` — copy `<CartDrawer>`'s modal mechanics exactly: always mounted, `inert` when
  closed, `role="dialog" aria-modal="true"`, labelled by the comment author, Escape closes, focus
  trapped on `FOCUSABLE`, focus restored to the trigger thumbnail, backdrop
  `bg-background/85 backdrop-blur-md` closing on click. The carousel copies
  `<ProductGallery>`'s mechanics: scroll-snap track, `scrollIntoView` (no `scrollLeft` arithmetic),
  IntersectionObserver-derived index, `dir`-aware previous/next icons, arrow-key handling by logical
  direction. The **comment body prints under the image**, centred, `max-w-2xl`, with the author and
  date above the counter ("2 / 3"). Single-image comments hide the arrows and the counter.

### 8. i18n

Every new string in **both** `en.ts` and `ar.ts` under `product.comments` and `product`, with no
English fallback in the Arabic tree. New keys at minimum: `buyNow`, `rating`, `ratingLabel`,
`ratingOptional`, `ratingOutOf`, `ratingAverage`, `ratingCount`, `submitRating`, `contentRequired`,
`addPhotos`, `removePhoto`, `photoLimit`, `photoTooLarge`, `photoType`, `photoAlt`, `viewPhoto`,
`lightboxLabel`, `photoCounter`, `close`, `previous`, `next`. Numerals inside `ltrIsland(locale)`
wherever they sit in a sentence, as `<ProductPurchase>` already does.

### 9. `next.config.ts`

Add a `remotePatterns` entry for the Supabase Storage host, scoped as tightly as the others:
`{ protocol: "https", hostname: "<project>.supabase.co", pathname: "/storage/v1/object/public/comment-images/**" }`.
Derive the hostname from `NEXT_PUBLIC_SUPABASE_URL` at config time rather than hard-coding it, and
fall back to skipping the entry when the variable is absent so a checkout without credentials still
builds.

## Security requirements

- `SUPABASE_SECRET_KEY` stays server-only. No upload grant for `anon`/`authenticated`; the browser
  never holds an upload token.
- Attribution stays server-derived from `getViewer()`. `rating` and `images` are payload; the author
  is not.
- Sniff image bytes server-side; never trust the declared MIME. Reject anything that is not a real
  JPEG/PNG/WEBP.
- Cap total decoded payload per submission (3 × 5 MB) and reject before any network call to Storage.
- Object paths are built from a server-generated comment id and an index — never from a client
  filename, which would allow traversal and collisions.
- The existing rate limit (5 per 10 minutes) covers the new fields; do not raise it.
- Comment bodies stay plain escaped text. Nothing renders `dangerouslySetInnerHTML`.
- Never log bodies, author names, or storage paths — the current logs' discipline.
- `/checkout` stays unprotected (guest checkout); Buy Now adds no auth requirement.

## Acceptance criteria

- [ ] Scrolling past the buy block on `/perfume/[slug]` and `/ritual/[slug]` reveals the sticky bar;
      scrolling back up hides it. It never appears above the block, and never on a page without one.
- [ ] The bar is centred, bottom, glass-dark, sharp-cornered, and does not cause layout shift.
- [ ] Add to Cart and Buy Now sit side by side in the buy block **and** in the bar at 320 px width.
- [ ] Buy Now adds the current quantity and lands on `/checkout` with the line present, in both locales.
- [ ] Both controls are disabled and dimmed when `inventory === 0`.
- [ ] A visitor can pick 1–5 stars and post with no text; the row appears with stars and no body.
- [ ] A visitor can post text with no stars, exactly as before this change.
- [ ] Posting neither shows the `contentRequired` message and writes nothing.
- [ ] The average, star row and count render above the form and update after revalidation.
- [ ] Up to 3 images attach, preview, and can be removed before posting; a 4th, an oversized file,
      or a non-image is refused with a translated message.
- [ ] Thumbnails render in the thread; clicking one opens the lightbox at that image with the comment
      body underneath; arrows, swipe, Escape and the focus trap all work, RTL included.
- [ ] Arabic tree: no English leaks, the bar mirrors to the correct edge, the lightbox arrows point
      the logical way.
- [ ] Zero `any`. `npm run lint` and `npx tsc --noEmit` clean.
- [ ] No spring/bounce anywhere; every transition is `ease-out` or the luxury bezier.
- [ ] With Supabase unconfigured the pages still build and render; the comments section stays absent
      and the sticky bar still works.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run db:migrate   # applies 0018 with the rest of the directory
npm run build
```

## Manual test steps

1. `npm run db:migrate`, then confirm in Supabase that `product_comment.rating` exists,
   `product_comment_image` exists, and the `comment-images` bucket is present and public. If the
   migration printed the bucket NOTICE, create the bucket in the dashboard (public, 5 MB,
   jpeg/png/webp) before continuing.
2. `npm run dev`, open `/perfume/<slug>`.
3. Scroll slowly past the buy block → the bar rises from the bottom, centred. Scroll back → it drops.
4. At 320 px width, confirm both buttons share the row in the bar and in the buy block.
5. Set quantity to 2, press **Buy Now** → `/checkout` with 2 units of that product.
6. Back on the PDP, pick 4 stars, leave the textarea empty, post → the row shows 4 stars, no body,
   and the summary average moves.
7. Post a comment with text and 2 photos → thumbnails appear under the body.
8. Click a thumbnail → lightbox opens on that image, the comment body reads underneath; arrow keys,
   drag/swipe and the counter behave; Escape closes and focus returns to the thumbnail.
9. Try a 4th photo, a >5 MB file, and a `.pdf` renamed to `.png` → each refused with a translated
   message and nothing written.
10. Repeat 3–8 on `/ritual/<slug>` and on the `/ar` tree, checking mirroring throughout.
11. Sign out and repeat 6–8 as a guest → attribution reads "Guest" / "ضيف".
