# Admin — Collapsible Left Rail, Responsive Dashboard, Order Control Fixes

## Goal

Three related desk-facing changes, all inside the `/admin` tree:

1. **Collapsible left sidebar.** The rail that lists Dashboard, Orders, Inventory,
   Analytics, Collections, Products, Journal must sit on the **left at every
   breakpoint** and be **toggleable — hide and appear**. Today it collapses into a
   horizontal scrolling strip below `lg`, which is neither a sidebar nor
   dismissible. The dashboard index itself must read correctly from 360px up.
2. **New order defaults to `ONLINE`.** `src/components/admin/OrderForm.tsx`
   initialises `channel` to `"OFFLINE"`; it must initialise to `"ONLINE"`.
3. **Fulfilment keeps every option.** `OrderStatusControl` currently renders only
   the *allowed next* statuses, so an option disappears from the group once it is
   selected. It must behave like the Payment group directly beneath it: all six
   statuses always rendered, the current one flagged as active, nothing removed.

## Skills read

None of the three approved skills (`clerk`, `supabase`, `ai-sdk`) apply — this is
presentation and client-state work over existing Server Actions. No schema, no
query, no auth change. `node_modules/next/dist/docs/` server/client boundary rules
apply and are already satisfied by the current split.

## Existing code inspected

- `src/app/[locale]/admin/layout.tsx` — runs `requireAdmin()`, renders `<AdminShell>`.
- `src/components/admin/AdminShell.tsx` — the rail. `"use client"` for `usePathname()`.
  Grid `lg:grid-cols-[260px_1fr]`, `pt-20` / `sticky top-20` because the storefront
  `<Nav>` from `src/app/[locale]/layout.tsx` is fixed and 5rem tall above it.
- `src/app/[locale]/admin/page.tsx` — the dashboard index: four tiles, revenue chart,
  latest-orders table, stock warning, three catalog tiles.
- `src/components/admin/AdminTable.tsx` — `AdminPageHeader` (flex-wrap, `items-end`),
  `AdminTable` (its own `overflow-x` wrapper).
- `src/components/admin/charts/RangeTabs.tsx` — three links, server component.
- `src/components/admin/OrderForm.tsx` — `useState("OFFLINE")` at the channel field.
- `src/components/admin/OrderStatusControl.tsx` — two button groups; fulfilment is
  driven by `allowedTransitions(status)`.
- `src/schemas/orders.ts` — `orderStatusValues`, `paymentStatusValues`,
  `allowedTransitions`, `canTransition`, `TRANSITIONS`.
- `src/actions/admin/orders.ts` — `updateOrderStatus` re-reads the row and re-checks
  `canTransition` server-side; a same-status call already returns
  `{ ok: true, message: "Nothing to change." }`.

## Decisions and assumptions

- **The rail is the sidebar, so the work lands in `AdminShell`, not only in
  `page.tsx`.** The request names the dashboard screen, but the sidebar it describes
  is shared chrome; fixing it in the shell fixes every admin screen at once and is
  the only place a toggle can live without being duplicated seven times.
- **Two behaviours, one control.**
  - `lg` and up: the rail is a persistent column. The toggle collapses it, and the
    panel widens to fill the freed space (grid template swaps to `[0px_1fr]` —
    implemented as a class swap between `lg:grid-cols-[260px_1fr]` and
    `lg:grid-cols-[1fr]`, not an animated width, so no layout thrash on the chart).
  - Below `lg`: the rail is an off-canvas drawer sliding in from the inline-start
    edge over a `backdrop-blur-md bg-black/60` scrim, closing on scrim click, on
    `Escape`, and on navigation. This replaces the horizontal scroll strip.
- **The open/closed state is client state in `AdminShell`,** persisted to
  `localStorage` under `khem.admin.rail` so a desk that collapses the rail keeps it
  collapsed across navigations. Default: open on `lg`+, closed below it. Read in an
  effect (never during render) so the server and first client render agree and there
  is no hydration mismatch.
- **RTL-safe:** logical properties (`border-s`, `ps-`, `start-0`) throughout, matching
  the existing rail.
- **Fulfilment: render all six, disable what cannot be reached.** "Keep all options"
  is read as: the button group never changes membership. A status that
  `TRANSITIONS` forbids from the current one is rendered `disabled` with a `title`
  saying why, rather than dropped — that keeps the group stable while still not
  offering a click the server will refuse. The current status is `aria-pressed` and
  gold-flagged exactly like the active Payment chip.
- **The confirm-then-restock step stays** for `CANCELLED` and `REFUNDED`. Those two
  return units to the shelf; a stable button group makes a stray click *more* likely,
  not less, so the second press stays required.
- **`allowedTransitions` is kept and still used** — to decide `disabled`, not
  membership. No schema or action change: `canTransition` on the server remains the
  authority, and a closed order (`CANCELLED` / `REFUNDED`, empty transition list)
  renders the whole group disabled with the existing closed-order sentence above it.
- **Channel: form default only.** `createOrderSchema.channel` keeps its `OFFLINE`
  default — that default protects a request that omits the field, and the form always
  sends one. The select's options are reordered so Online reads first, matching the
  new default.

## Files likely to change

- `src/components/admin/AdminShell.tsx` — rewritten rail: fixed left drawer below
  `lg`, collapsible column at `lg`+, toggle button, scrim, persisted state.
- `src/app/[locale]/admin/page.tsx` — responsive pass on the dashboard index.
- `src/components/admin/AdminTable.tsx` — `AdminPageHeader` only, if the header's
  action needs to stack cleanly under the title on narrow screens.
- `src/components/admin/OrderForm.tsx` — channel default + option order.
- `src/components/admin/OrderStatusControl.tsx` — fulfilment group.

No changes to `src/schemas/orders.ts`, `src/actions/admin/orders.ts`, `supabase/`,
or the admin layout.

## Implementation requirements

### 1. `AdminShell`

- Keep `"use client"`, keep `usePathname()`, keep `localizePath` hrefs, keep the
  `isActive` rule (`/admin` exact, every other section owns its subtree).
- Keep `pt-20` / `top-20` offsets — the storefront `<Nav>` is fixed above.
- A toggle button, always visible, in a slim admin top bar that also carries the
  "KHEM · Boutique Desk" wordmark on small screens. Icon: `PanelLeft` /
  `PanelLeftClose` (lucide, `strokeWidth={1.25}`), `aria-expanded`, `aria-controls`
  pointing at the rail's `id`, accessible name "Show navigation" / "Hide navigation".
- Drawer (below `lg`): `fixed`, `inset-y-0 start-0`, `w-[280px]`, translated by
  `-translate-x-full` when closed (`rtl:translate-x-full` handled via logical
  transform or an `[dir=rtl]` variant), `transition-transform duration-500
  ease-[cubic-bezier(0.16,1,0.3,1)]`, `z-40`; scrim `z-30`. No spring, no bounce.
- Closes on: scrim click, `Escape`, and pathname change (effect on `pathname`).
- `aria-hidden` and `inert`-equivalent handling: when closed below `lg`, the rail
  must not be reachable by keyboard (`hidden` toggled after the transition is not
  required — `pointer-events-none` plus `tabIndex={-1}` on links is acceptable; a
  simple conditional render of the drawer is also acceptable and preferred for
  clarity).
- The "Signed in as" block and "View storefront" link move into the rail body so they
  are reachable on mobile, no longer `hidden`.
- Main panel keeps `px-5 sm:px-8 lg:px-14`, and must not scroll horizontally at
  360px.

### 2. Dashboard index (`page.tsx`)

- Trade tiles: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` is fine; reduce tile
  padding from `p-8` to `p-6 sm:p-8` and the figure from `text-4xl` to
  `text-3xl sm:text-4xl` so a compact `egpCompact` value never wraps at 360px.
- `AdminPageHeader` action (`RangeTabs`) must sit below the title on narrow screens
  rather than squeezing it.
- The latest-orders table already scrolls inside `AdminTable`; verify no cell forces
  the page wider.
- Stock-warning and search-vector panels: `p-5 sm:p-6`.
- No copy changes, no data changes, no new queries.

### 3. `OrderForm`

- `useState("ONLINE")`.
- Options: `ONLINE` first ("Online — placed through the site"), then `OFFLINE`.
- Hint text unchanged.

### 4. `OrderStatusControl`

- Fulfilment maps `orderStatusValues` (all six), not `allowedTransitions(status)`.
- Per button: `active` when `value === status` → gold flag, `aria-pressed`,
  `disabled`. Otherwise `disabled` when `!canTransition(status, value)` **or**
  `isPending`, with `title` explaining the refusal.
- Restocking statuses keep the arm/confirm two-press flow and the danger styling.
- Import `canTransition` and `orderStatusValues` from `@/src/schemas/orders`.
- The closed-order sentence still renders when `allowedTransitions(status).length === 0`,
  above (not instead of) the now-disabled group.

## Security requirements

- No change to `requireAdmin()`, to any Server Action, or to any Zod schema.
- The shell continues to receive `actorEmail` as a prop and never resolves identity
  itself.
- `localStorage` holds a single UI boolean — no identifiers, no order data.
- The fulfilment group renders more buttons but grants no new authority:
  `updateOrderStatus` still re-reads the row and re-checks `canTransition` server-side,
  so a disabled button that is forced enabled in devtools is refused with the existing
  message.

## Acceptance criteria

- The sidebar is on the left at every breakpoint and can be hidden and shown by an
  always-visible toggle.
- At `lg`+, hiding the rail widens the panel; the state survives navigation.
- Below `lg`, the rail is a drawer over a scrim; it closes on scrim click, `Escape`,
  and after tapping a section.
- `/admin` has no horizontal page scroll at 360px, 768px, 1024px, 1440px.
- The active section is still gold-flagged and carries `aria-current="page"`.
- Recording a new order shows Channel = Online before any interaction.
- On an order page, all six fulfilment statuses are visible; selecting one flags it
  and removes nothing; cancel/refund still ask twice.
- `npm run lint` and `npx tsc --noEmit` clean, zero `any`.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` if the two above pass

## Manual test steps

1. `npm run dev`, sign in as an admin, open `/admin`.
2. Resize to 360px: the rail is hidden, a toggle sits in the admin top bar. Tap it —
   the drawer slides in from the left over a blurred scrim. Press `Escape`, it closes.
   Reopen, tap **Orders** — it navigates and closes.
3. Resize to 1440px: the rail is a column. Click the toggle — it hides and the panel
   widens. Navigate to **Products** — it is still hidden. Toggle back.
4. Scroll `/admin` at each breakpoint: no sideways page scroll; tiles, chart, and the
   latest-orders table all readable.
5. `/admin/orders/new`: Channel reads **Online — placed through the site** on load.
   Record a one-line order and confirm it lands on the order page.
6. On that order: the Fulfilment group shows Pending, Processing, Shipped, Delivered,
   Cancelled, Refunded. Pending is flagged. Click **Shipped** — it becomes flagged,
   the group still shows six, and Refunded is disabled. Click **Cancelled** — the
   button arms ("Confirm — restocks"); click again and the order closes, the group
   renders disabled, and the stock-returned panel appears.
