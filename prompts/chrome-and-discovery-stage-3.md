# Stage 3 — Chrome & discovery

Part of the whole-app redesign (stage list in `prompts/storefront-redesign-stage-2.md`
hand-off; working agreement: self-audit → build → self-test → local commit →
wait for OK to push). Visual language: Stage 1 (account) and Stage 2
(storefront). No canvas mock this stage; the user asked for a self-audit.

## Goal

Bring the parts every page shares, and the discovery pages around the buying
path, into the Stage 1/2 language, mobile first, EN + AR: the phone menu, the
desktop mega menus, the search panel and `/search`, the footer, the cookie
banner, the offer popup, the `/cart` page, the order-confirmed page and 404.

## Skills read

`AGENTS.md` (§2.2, §3, §8 + `src/lib/admin/revalidate.ts` rule, §8.1 prelaunch
guards, §10.2 no Clerk on public pages). No routing, caching-mode or boundary
changes; Clerk/Supabase/AI SDK skills not needed.

## Audit (390×844 and 1440×900, 2026-11-21)

1. **Phone menu**: one long flat list (≈1,500px), 12 headings; repeats search
   and bag, which the header already has; nothing visual.
2. **Mega menus**: the "Featured" and "From the Journal" tiles are hard-coded:
   a marble photo captioned "NOIR" and a fixed article title (AGENTS: UI shows
   stored data only). The images only start loading when the menu opens, so
   the tile is blank for a moment.
3. **Search panel**: suggestions stacked one per line (a screen and a half of
   chips); the Cinzel placeholder is clipped ("DESCRIBE THE SCENT YO").
4. **`/cart`**: titled "The Cart" while the drawer says "Your bag"; the
   free-delivery nudge is pale gold on sand (fails contrast); no progress bar;
   line layout differs from the drawer; no sticky action on phones.
5. **Cookie banner**: covers ~half a phone screen.
6. **Offer popup**: a 224px image and roomy body on a phone.
7. **Footer**: logo box not aligned with the text under it; otherwise sound
   (accordions already).
8. **404 / order not found**: fine, but a dead end: no search or way back
   into the shop beyond two buttons.
9. **Search quality (not UI; noted for the user)**: "oud" returns all 28
   products, because semantic ranking returns everything. Changing that is
   search logic and needs the user's say.

## Decisions

1. **Phone menu** (`Nav.tsx` drawer): a featured new-arrival card at the top
   (real product: image, name, link); "Shop" as accordion rows (existing tree,
   52px rows, chevrons); Quick access as pill chips; Discover as plain rows;
   bottom: Stockists, Account and language/country. Search and bag rows go
   (they are in the header). Same data, same prelaunch guards.
2. **Mega menus**: the featured tiles read real data, passed from the layout:
   the current new arrival (`getNewArrivals`, first) and the latest journal
   article (`getLatestArticles`, first). Hidden when absent. Images preload on
   the first pointer-enter of the nav links, so the tile is painted on open.
   `revalidateProduct` (NEW_ARRIVAL branch) and `revalidateArticle` also
   revalidate the `[locale]` layout, per AGENTS §8.
3. **Search panel**: suggestion chips wrap as pills; input in the body font;
   tighter spacing. `/search` header compacted like the collection hero.
4. **`/cart`**: "Your bag" heading; the drawer's line layout; shared
   `DeliveryProgress` (extracted from the drawer) with readable nudge; perks
   as the PDP's icon card; phone sticky "Checkout · total" bar (hides at the
   footer). Same pricing functions as today.
5. **Cookie banner**: a compact bottom sheet on phones (short copy already
   exists in the dictionary where available; buttons side by side; manage
   preferences stays). Consent logic untouched.
6. **Offer popup**: phone image 160px, tighter body.
7. **Footer**: logo aligned to the text column; small spacing pass.
8. **404 and not-found order**: add a search field and the best-sellers
   2-up row under the message (real data, same service as the home band).
9. **Not in scope**: search ranking (item 9 above) — reported, not changed.

## Security requirements

No new routes, actions, cookies or storage keys; consent and popup gates
unchanged; no Clerk on public pages; layout reads are public catalogue/journal
data through existing services.

## Acceptance criteria

- Phone menu ≤ ~1.3 screens with Shop groups closed; every destination it had
  is still reachable (except search and bag, which are in the header).
- Mega-menu tiles show the real new arrival and latest article, painted on
  open; nothing hard-coded remains in them.
- `/cart` at 390px: progress bar, lines like the drawer, sticky checkout.
- Cookie banner ≤ ~40% of a 844px screen.
- 360/390px: no horizontal overflow on the touched pages, EN + AR.
- `tsc --noEmit` and ESLint clean; reduced motion respected.

## Checks

`npx tsc --noEmit`, ESLint on changed files, agent-browser captures at
390×844 and 1440×900 EN + AR of: menu, mega menus, search panel, `/search`,
`/cart` (below/above threshold), cookie banner, popup, footer, 404, order
confirmed (a real order number read from the database).

## Outcome (built 2026-11-21)

- Phone menu: new-arrival card, ruled accordion rows, quick-access chips,
  Discover rows, a boutique card (Stockists, Account, sign out), language.
  ~1,190px tall with groups closed (was ~1,500px). Search and bag rows gone.
- Mega menus: real new arrival (Kyphi today) and latest article, painted
  within 250ms of opening (images warmed on first pointer/focus on the menu
  links). `getNavFeatures()` in `services/navigation.ts`, read in the layout;
  `revalidateProduct` (NEW_ARRIVAL) and `revalidateArticle` now revalidate the
  `[locale]` layouts. A product that *loses* the tag refreshes the menu on the
  layout's ISR window, not instantly.
- Search panel and `/search` form: pill chips, body-font field on phones,
  tighter spacing.
- `/cart`: "Your Bag", the drawer's progress strip (`DeliveryProgress`, now
  shared) and line layout, readable nudge, icon perks, phone sticky
  "Checkout · total" that hides at the footer. `CartLine` deleted (unused).
- `PageHeader` compact on phones (checkout, cart, search).
- Offer popup: 160px image and tighter body on phones; ink button.
- Footer: wordmark aligned with the text column (the file's own padding).
- 404: a search field above the two buttons. (`not-found` gets no locale on
  the server, so a product row was not possible there.)
- Order confirmed: the bright yellow junk-mail notice is now an ivory note
  with a gold rule.
- Cookie banner: measured at ~30% of an 844px screen; left as is.
- Not changed, reported: semantic search returns every product for short
  queries ("oud" → 28 results).

Checks: tsc + ESLint clean; captures at 390×844 / 1440×900 EN + AR; 360px
overflow sweep on cart, search, 404, order confirmed, heritage (EN + AR).
