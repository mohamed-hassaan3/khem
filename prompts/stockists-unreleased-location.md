# Prompt — Add an unreleased Dubai location to the stockist directory

Addendum to `prompts/stockists-page-nextjs-transform.md`, which is already implemented and shipped. Everything there still holds; this changes only what a stockist record is allowed to omit.

## Goal

Add a Dubai boutique that is **announced but not open**, carrying no contact information: no phone, no hours, no directions, no address. It appears in the directory and on the map rail as a forthcoming location, and nowhere on the page does it pretend to be somewhere a visitor can go today.

---

## Skills read

Same as the parent prompt — no `.agents/skills/*` skill applies. The session hooks suggested `chat-sdk` and `vercel-queues` on a lexical match; neither has anything to do with a store record, and neither is invoked.

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/types/stockist.ts` | `address`, `phone`, `phoneHref`, `hours`, `mapsUrl` are **all required `string`**. There is no way to express "not open yet" — this is the change. |
| `src/data/stockists.ts` | One record, `cairo-flagship`. |
| `src/services/stockists.ts` | `getStockistRegions()` derives regions from presence. Dubai is `middleEast`, so the region bar is unchanged. |
| `src/components/stockists/StockistDirectory.tsx` | Every row is an expandable `<button>` whose panel renders address / phone / hours / directions via `StockistDetails`. The map chips are `<button>`s that toggle the same selection. The count line reads `filtered.length`. |
| `src/app/[locale]/stockists/page.tsx` | `solo = stockists.length === 1` drives the editorial-feature-vs-grid switch. `StockistCard` renders address and hours unconditionally. |
| `src/lib/i18n/dictionaries/en.ts` | Has `common.comingSoon: "Coming Soon..."` — a generic string with an ellipsis, wrong register for a badge. The `stockists` block gets its own key. |

---

## Decisions and assumptions

1. **`status: "open" | "comingSoon"` on the record**, not a nullable-field sniff. "Is this store open" is a fact about the store; deriving it from whether someone remembered to leave `phone` blank would make a data-entry slip silently change how a location renders.
2. **The four contact fields become `string | null`.** `address`, `phone`, `phoneHref`, `hours`, `mapsUrl` — an unopened boutique has none of them, and `""` is not "absent". `null` is explicit and typecheck-enforced at every read site.
3. **A coming-soon row does not expand.** It renders as a plain `<div>`, not a `<button>` — no `aria-expanded`, no `aria-controls`, no chevron, no focus stop. A control that opens an empty panel is worse than no control: it promises information that does not exist. Same for its map chip, which becomes a `<span>`.
4. **The count line counts open locations only.** *"1 Location Worldwide"* stays truthful with two records, because a boutique you cannot visit is not a location worldwide. Dubai is still visible in the list and on the rail, labelled.
5. **The partner section renders open locations only.** Its heading is "World-Class Retail Partners" — a store that has not opened is not yet one. Practically this also preserves Cairo's editorial feature treatment: the `solo` switch keys off the *open* count, so adding an announcement does not demote the flagship into a two-card grid.
6. **Dubai is `type: "boutique"`, `region: "middleEast"`.** The region bar therefore does not change shape — Dubai joins the region Cairo already occupies, which is the correct outcome and worth confirming rather than assuming.
7. **No invented photograph.** The image reuses an Unsplash slug already present in this repo (`photo-1709666414115-47ecd5143293`, the craftsmanship hero). Inventing a slug 404s through `next/image`.
8. **No new dependency, no schema migration** — `Stockist` is not a Prisma model (AGENTS.md §9 defines no table for it yet).

---

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/types/stockist.ts` | `+ StockistStatus`; `status` field; five fields become `string \| null`. |
| `src/data/stockists.ts` | `+ dubai-boutique`; `status: "open"` on Cairo. |
| `src/services/stockists.ts` | `+ getOpenStockists()`. |
| `src/components/stockists/StockistDirectory.tsx` | Non-expandable coming-soon row and chip; count reads open locations. |
| `src/app/[locale]/stockists/page.tsx` | Partner section and `solo` switch read open locations; `StockistCard` tolerates null address/hours. |
| `src/lib/i18n/dictionaries/en.ts` / `ar.ts` | `+ stockists.comingSoon`, `+ stockists.comingSoonFor`. |

---

## Implementation requirements

### 1. Types

```ts
/** Whether a location is trading today. A coming-soon location has no contact
 *  details and renders as an announcement, not a destination. */
export type StockistStatus = "open" | "comingSoon";
```

On `Stockist`: `status: StockistStatus`, and `address` / `phone` / `phoneHref` / `hours` / `mapsUrl` typed `string | null`, each with a doc line saying `null` means "not published yet".

### 2. Data

```ts
{
  id: "dubai-boutique",
  name: "KHEM Dubai",
  city: "Dubai",
  country: "United Arab Emirates",
  region: "middleEast",
  type: "boutique",
  status: "comingSoon",
  address: null,
  phone: null,
  phoneHref: null,
  hours: null,
  mapsUrl: null,
  image: {
    url: "https://images.unsplash.com/photo-1709666414115-47ecd5143293?w=1200&h=800&fit=crop&auto=format",
    alt: "A darkened atelier interior awaiting its opening",
  },
}
```

Cairo gains `status: "open"`. A comment on the Dubai record states that the nulls are deliberate and that filling them in plus flipping `status` is the entire launch change.

### 3. Service

```ts
/** Locations trading today. The count line and the partner grid read this —
 *  an announced boutique is not yet somewhere you can go.
 *  → supabase.from('Stockist').select('*').eq('status', 'open').order('sortOrder') */
export async function getOpenStockists(): Promise<Stockist[]>
```

`getStockists()` keeps returning everything: the directory lists announcements too.

### 4. `StockistDirectory`

- `openCount = filtered.filter(s => s.status === "open").length` feeds the `countOne` / `countOther` line.
- **Chip**: `status === "comingSoon"` → a `<span>` (no button, no `aria-pressed`) at `border-dashed border-gold/15 text-ivory/25`, with an `sr-only` suffix reading `dict.stockists.comingSoon` so a screen reader hears the status the dashed border conveys visually.
- **Row**: `status === "comingSoon"` → the header is a `<div>`, not a `<button>`. No chevron, no expansion, no selection. The badge slot shows `dict.stockists.comingSoon` in place of the type badge — an unopened store's category is not the useful fact about it — styled `border-dashed border-gold/25 text-gold/50`. The whole row sits at reduced emphasis (`text-ivory/60` on the name) so the open locations lead.
- `toggleSelected` is never wired to a coming-soon id, so `selectedId` can never point at one. The initial-selection rule stays `stockists.length === 1`, which no longer fires — correct, since with two records the visitor chooses.

### 5. Page

- `const openStockists = await getOpenStockists()` (add to the `Promise.all`).
- `solo = openStockists.length === 1 ? openStockists[0] : null`; the grid maps `openStockists`.
- `StockistCard` renders `address` and `hours` only when non-null, so it stays correct if an open record is ever missing one.

### 6. Dictionaries

```
comingSoon: "Opening Soon",          // ar: "قريبًا"
comingSoonFor: "{name} — opening soon",  // ar: "{name} — يفتح قريبًا"
```

`comingSoonFor` is the `sr-only` text on the chip. Not reusing `common.comingSoon` ("Coming Soon...") — the ellipsis and the tense are wrong for a location badge.

---

## Security requirements

Unchanged from the parent prompt. One addition: **no `href` is ever emitted from a null field.** `mapsUrl` and `phoneHref` are read only inside a `status === "open"` branch, so `href={null}` — which React renders as an attribute-less anchor that navigates to the current page — cannot occur.

---

## Acceptance criteria

- [ ] `/stockists` lists **two** locations: Cairo (expandable, full details) and Dubai (marked **Opening Soon**).
- [ ] The count line still reads **"1 Location Worldwide"** — singular, counting open locations only.
- [ ] The Dubai row is not focusable, has no chevron, and cannot be expanded; it exposes no `aria-expanded`.
- [ ] The Dubai chip is not a button and carries an `sr-only` "opening soon" annotation.
- [ ] No phone number, no hours, no address, and no directions link appear anywhere for Dubai.
- [ ] The region bar is unchanged: **All Regions · Middle East**. Filtering to Middle East shows both rows.
- [ ] The partner section still renders Cairo's **editorial two-column feature**, not a two-card grid.
- [ ] Arabic: the status badge and the `sr-only` annotation are Arabic; the Dubai name and city stay in LTR islands.
- [ ] `Stockist.address` etc. are `string | null` and every read site narrows — no `!`, no `??  ""` papering over the absence.
- [ ] Strict TypeScript, no `any`.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/stockists`.
2. Map panel reads **"1 Location Worldwide"** with two chips: **Cairo** (interactive) and **Dubai** (dimmed, dashed, inert).
3. The directory shows two rows. Cairo expands and collapses; Dubai carries an **Opening Soon** badge and does nothing on click.
4. Tab through the list: focus lands on the Cairo row and skips the Dubai row entirely.
5. **Our Partners** still shows the single editorial feature for Cairo — no Dubai card, no two-card grid.
6. `http://localhost:3000/ar/stockists` — the badge reads **قريبًا**, the layout mirrors, and "KHEM Dubai" / "Dubai, United Arab Emirates" stay left-to-right.
7. Inspect the Dubai row in DevTools: it is a `<div>`, has no `aria-expanded`, and contains no `<a>`.
8. **Launch check**: temporarily set Dubai's `status` to `"open"` and fill the four fields → it becomes expandable, the count reads *"2 Locations Worldwide"*, and the partner section switches to the card grid. Revert.
