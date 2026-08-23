# Product Card — Hover Image Cross-Fade & Sold-Out Label

## Goal

Two additions to `<ProductCard>`:

1. **Hover cross-fade.** Hovering a product card fades the primary photograph
   out and a second gallery photograph in. No slide, no crop change, no layout
   shift — an opacity cross-fade only, on the existing luxury easing.
2. **Sold-out label.** A product with `inventory === 0` states so on the card
   itself, rather than only through the disabled bag control in the corner.

## Skills read

None of the three approved skills (`clerk`, `supabase`, `ai-sdk`) apply — this
is a presentational change to one Server Component plus the card projection that
feeds it. No auth, no schema, no AI. No new query is issued.

The session hook suggested `ai-sdk` and `vercel-functions`; both are false
lexical matches on a UI task and are deliberately not read.

## Existing code inspected

- `src/components/ecommerce/ProductCard.tsx` — async Server Component, whole
  surface is a `<LocaleLink>`, carries `img-zoom group` and a single
  `<Image fill className="object-cover brightness-75">` in an `aspect-3/4` box.
- `src/components/ecommerce/ProductFlag.tsx` — the gold corner pill, shared by
  all three card types, `absolute start-5 top-5 z-2`.
- `src/components/ecommerce/AddToBagButton.tsx` — overlaid by the *grid*, not by
  the card, at `absolute end-5 top-5 z-2`; already disables at `inventory === 0`.
- `src/types/catalog.ts` — `ProductCardData` = narrow `Pick<Product, …>` plus
  `collectionName`, `collectionKind`, `primaryImage`. Already carries
  `inventory`.
- `src/schemas/db/catalog.ts` — `PRODUCT_CARD_COLUMNS` **already selects the full
  `images:ProductImage(...)` relation**; `toProductCard()` collapses it to one
  image via `resolvePrimaryImage()`. `PLACEHOLDER_IMAGE` is the missing-photo
  fallback.
- `src/app/globals.css:199-206` — `.img-zoom img` / `.img-zoom:hover img` apply
  `transform: scale(1.04)` over `0.8s var(--ease-luxury-bezier)` to **every**
  `img` inside the container.
- `src/lib/i18n/dictionaries/{en,ar}.ts` — `product.soldOut` already exists
  ("Sold Out" / "نفدت الكمية"). No new dictionary key is needed.

## Decisions / assumptions

1. **The hover image comes from the data already in hand.** Add
   `hoverImage: ProductImage | null` to `ProductCardData`, resolved by a new
   `resolveHoverImage()` beside `resolvePrimaryImage()`: sort by `sortOrder`,
   drop the resolved primary, take the first survivor, else `null`. No column is
   added to `PRODUCT_CARD_COLUMNS` and no query changes — the rows are already
   being fetched and thrown away.
2. **A one-image product simply does not cross-fade.** `hoverImage` is `null` and
   the card renders exactly what it renders today. It must not fall back to
   `PLACEHOLDER_IMAGE` — a stock photo fading in over a real flacon is worse than
   no effect at all.
3. **Sold out takes the corner slot from the merchandising flag.** A product that
   cannot be bought has no business advertising "Best Seller" first. Resolution
   order on the card becomes: sold out → stored `badge` → `productFlag()`.
4. **The sold-out pill is muted, not gold.** Gold is KHEM's affirmative accent
   (price, CTA, badge); an unavailability notice must read as a withdrawal.
   `<ProductFlag>` gains a `tone?: "gold" | "muted"` prop defaulting to `"gold"`,
   so the two other cards that use it are untouched.
5. **Scope is `<ProductCard>` only.** `<MerchCard>` and `<DiscoverySetCard>` sell
   straight from the card and already print `dict.product.soldOut` on their
   own buttons; they are out of scope for this request.
6. The card stays a Server Component. Both effects are pure CSS `group-hover` —
   no `"use client"`, no state, no hook.

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/types/catalog.ts` | `+ hoverImage: ProductImage \| null` on `ProductCardData`, documented |
| `src/schemas/db/catalog.ts` | `+ resolveHoverImage()`; `toProductCard()` populates `hoverImage` |
| `src/components/ecommerce/ProductFlag.tsx` | `+ tone?: "gold" \| "muted"` |
| `src/components/ecommerce/ProductCard.tsx` | stacked cross-fade images; sold-out label + dimming |

## Implementation requirements

### Cross-fade

- The `aspect-3/4` box keeps `relative overflow-hidden bg-card`. Both images are
  `fill`, `object-cover`, share the same `sizes` prop, and stack in the same box
  — so the frame's height is fixed by the aspect ratio and nothing reflows.
- Primary: `opacity-100 group-hover:opacity-0`. Hover: `opacity-0
  group-hover:opacity-100`, plus `aria-hidden` — it is the same product, and a
  screen reader must not hear the flacon described twice.
- Both: `transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]`.
  700ms sits just inside the existing 800ms `img-zoom` scale, so the swap
  finishes while the zoom is still settling rather than after it.
- `brightness-75` stays on both, so the two frames are graded identically and the
  fade reads as one continuous image rather than a lighting change.
- The hover image is rendered only when `hoverImage` is non-null.

### Sold out

- `const isSoldOut = product.inventory === 0;`
- Corner slot: `isSoldOut` → `<ProductFlag label={dict.product.soldOut} tone="muted" />`,
  else the existing `badge` → `flag` chain, unchanged.
- Muted tone: `bg-background/85 text-ivory/70 backdrop-blur-sm border border-white/10`,
  keeping the exact geometry, font, and tracking of the gold tone so the two pills
  occupy an identical footprint.
- The image box gets `opacity-55 grayscale-[0.35]` while sold out — the
  established museum reading of a piece not currently on show. Applied to the
  image wrapper, not the card, so name, price, and pills stay fully legible.
- The label is translated text, so it takes `dir="auto"` — i.e. it must pass
  `island` as `false` (the default), unlike a stored English `badge`.

## Security requirements

None beyond the existing posture: no new input, no new query, no user-supplied
data reaching the DOM that was not already rendered. `hoverImage.url` comes from
the same validated `imageRowSchema` as `primaryImage.url` and flows through
`next/image`, whose `remotePatterns` allowlist in `next.config.ts` already gates
every host the gallery can serve.

## Acceptance criteria

- [ ] Hovering a card with ≥2 images cross-fades to the second image and back on
      leave, with no jump, no reflow, and no flash of empty box.
- [ ] A card with exactly one image is visually identical to today on hover.
- [ ] The existing `img-zoom` scale still runs, on both frames together.
- [ ] `inventory === 0` renders a muted "Sold Out" pill in the start corner, in
      place of any badge or merchandising flag.
- [ ] The Arabic tree mirrors the pill to the top-right and prints
      "نفدت الكمية"; it never collides with the bag control at the opposite inset.
- [ ] Sold-out imagery is dimmed; name, price, volume, and pills remain legible.
- [ ] `<MerchCard>` and `<DiscoverySetCard>` render exactly as before.
- [ ] Zero `any`; the card stays a Server Component; no new network round trip.

## Checks to run

```
npx tsc --noEmit
npx next lint
npm run build
```

## Manual test steps

1. `npm run dev`, open `/en/collections`.
2. Hover several cards — the photograph should cross-fade to a second shot over
   ~0.7s and return on leave. Watch the grid's baseline: nothing may shift.
3. Find a product whose gallery has one image only; confirm it just zooms.
4. In Supabase, set one product's `inventory` to `0`. Reload `/en/collections`:
   that card shows the muted "Sold Out" pill, its image is dimmed, and the bag
   control in the opposite corner is already disabled.
5. Open `/ar/collections` and confirm the pill sits top-right, reads
   "نفدت الكمية", and does not overlap the bag control.
6. Restore the inventory value.
