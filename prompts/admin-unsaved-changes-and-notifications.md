# Admin Unsaved-Changes Protection & Notification Centre (Priority 4)

## Goal

Deliver **Priority 4** of `src/docs/customer-experience.md` §12–15, in two stages:

**Stage 1 — the desk stops losing work.** Detect an edited-but-unsaved form, and
intercept navigation away from it with a Cancel / Discard / Save dialog. Guard
browser refresh and tab-close too.

**Stage 2 — notifications split in two.** Transient feedback becomes a toast that
disappears; anything worth coming back to lives in a bell in the admin header.

Stage 1 is delivered and verified before Stage 2 begins.

## Skills read

- `AGENTS.md` §1–2, §3 (motion: no bounce), §11–12.
- `src/docs/customer-experience.md` §12 (unsaved changes), §13–15 (notifications),
  §19 Priority 4.
- **Next.js docs, read from `node_modules/next/dist/docs`** — `<Link onNavigate>`
  (`01-app/03-api-reference/02-components/link.md`) is the App Router's supported
  hook for intercepting a client-side navigation: the handler receives an event
  with `preventDefault()`. Its documented limits matter here and are stated below.

## Existing code inspected

- `src/components/admin/AdminShell.tsx` — the rail, its `<Link>`s, the sticky
  header strip, and the "View storefront" link. Every in-dashboard navigation
  starts here.
- `src/components/admin/fields.tsx` — `AdminField`, `AdminInput`, `AdminSelect`,
  `AdminToggle`, `AdminStringList`, `AdminButton`, and **`AdminNotice`**: a
  `role="status"` banner rendered *above the form*, used for both success and
  failure by every editor.
- The editors themselves — `ProductForm` (23 pieces of `useState`), `ArticleForm`,
  `CollectionForm`, `IngredientForm`, `StockistForm`, `MerchPageForm`,
  `DiscountForm`, `HouseSettingsForm`, `OrderForm`, `ContentRowsEditor`,
  `ContactChannelsEditor`, `SocialProfilesEditor`. **Every one of them already
  builds a single `payload` object inside `submit()`** — which is the whole
  reason dirty-tracking can be cheap here; see decision 2.
- `src/components/admin/CreditAdjustForm.tsx`, `InviteCustomerForm.tsx` — short
  forms that clear on success. Deliberately out of scope for the guard.
- **`supabase/sql/0023_order_opened.sql`** — the house already has a read-state
  precedent, and its header is the argument this phase follows for Stage 2: one
  stamp, claimed once in SQL, answering "has anyone seen this" rather than "who
  has seen this". `countUnopenedOrders()` is already on the dashboard.
- `src/lib/inventory.ts` — `LOW_STOCK_THRESHOLD`, already the site's definition.
- `src/services/admin/orders.ts`, `customers.ts`, `discounts.ts`, `credits.ts` —
  the rows a notification feed would read.

## Decisions and assumptions

1. **`onNavigate` is the interception mechanism, and its limits are stated, not
   papered over.** It covers a click on a `<Link>` — which is every navigation
   inside the dashboard. It does **not** cover:
   - `router.push()` from code. Handled separately: the forms that push do so
     only *after* a successful save, when the form is no longer dirty.
   - **Browser Back/Forward.** A popstate cannot be cancelled after the fact, and
     the usual workaround — pushing a sentinel history entry and re-pushing on
     popstate — corrupts the history stack and traps the user. I am **not**
     shipping that. §12.3's "where technically appropriate" is the licence to
     leave it, and the limitation goes in the component header rather than in a
     silent gap.
   - Full page loads. Covered by `beforeunload`.
2. **Dirtiness is derived from the payload each form already builds.** The object
   literal inside `submit()` moves up into the render body, and a hook compares it
   against the value it had on first render. No form grows a `dirty` flag it has
   to remember to set, and no field can be edited without the comparison seeing
   it — which is exactly the failure mode a hand-maintained flag has.
3. **`beforeunload` shows the browser's own dialog, and cannot show ours.** Every
   browser replaced custom text with a fixed string years ago. The KHEM dialog is
   for in-app navigation; refresh and tab-close get the native one. Saying so here
   stops somebody later "fixing" it.
4. **Save-then-navigate must not navigate on a failed save.** The dialog's Save
   awaits the form's own submit and continues only if it reported success —
   otherwise it stays open with the error. A dialog that navigates away from a
   failed save is worse than no dialog.
5. **Stage 2's feed is derived, and only read-state is stored.** Following 0023's
   reasoning exactly: a notification row per order would be a second record of a
   fact `"Order"` already holds. So the bell reads the source tables — new orders,
   new accounts, voucher redemptions, credits earned — and a small
   `admin_notification_reads` table holds nothing but `(kind, entityId, readAt)`.
6. **Low stock is a standing condition, not an event.** A product goes low, is
   restocked, goes low again; a notification that could be dismissed would hide
   the second occurrence. It appears in the bell as a live section that clears
   itself when stock is replenished, and cannot be marked read.
7. **Toasts carry successes; failures stay inline.** A success is transient
   confirmation and belongs in a toast that leaves. A failure is something the
   editor must act on, next to the field it concerns — `AdminNotice` keeps that
   job. This is a rule, not a preference, and it means no editor loses an error
   message to a timer.
8. **No new dependency.** No toast library, no dialog library. `<dialog>` and a
   small provider, in the house's own register.

## Files likely to change

### Stage 1
**New**
- `src/providers/unsaved-changes-provider.tsx` — holds the active form's dirty
  state and its save function; exposes `confirmNavigation()`.
- `src/hooks/useUnsavedGuard.ts` — what an editor calls: takes its payload, its
  submit, and whether a save is in flight.
- `src/components/admin/UnsavedChangesDialog.tsx` — Cancel / Discard Changes /
  Save Changes, in KHEM's register.
- `src/components/admin/AdminLink.tsx` — `<Link>` plus `onNavigate` interception.

**Modified**
- `src/components/admin/AdminShell.tsx` — mounts the provider and the dialog;
  its rail links and "View storefront" become `AdminLink`.
- The twelve editors listed above — payload hoisted, one hook call each.

### Stage 2
**New**
- `supabase/sql/0031_admin_notifications.sql` — `admin_notification_reads`, and a
  function to mark one or all read.
- `src/services/admin/notifications.ts` — the derived feed.
- `src/actions/admin/notifications.ts` — mark read / mark all read.
- `src/components/admin/NotificationBell.tsx` + `NotificationPanel.tsx`.
- `src/providers/admin-toast-provider.tsx` + `src/components/admin/AdminToaster.tsx`.
- `src/types/notification.ts`, `src/schemas/db/notifications.ts`.

**Modified**
- `AdminShell.tsx` — the bell in the sticky header, the toaster at the root.
- The editors — success path calls `toast()` instead of setting a success notice.

## Implementation requirements

### Stage 1
- The hook takes `{ payload, submit, pending }` and registers with the provider
  while mounted, unregistering on unmount — so leaving a form always leaves it
  clean, and two forms can never both claim to be the dirty one.
- Comparison is a stable serialisation of the payload. Key order must not matter;
  a changed array element must count.
- The provider exposes `isDirty` and `requestNavigation(proceed)`. `AdminLink`
  calls it inside `onNavigate`, and `preventDefault()`s when the answer is "ask".
- The dialog: `<dialog>` with a blurred obsidian backdrop, hairline gold border,
  Cinzel micro-labels, 300–500ms `ease-luxury-bezier`, no bounce. Focus moves to
  it on open and returns to the trigger on close. `Escape` = Cancel.
- **Cancel** stays. **Discard Changes** proceeds and clears the dirty state.
  **Save Changes** awaits `submit()`, and proceeds only on success.
- `beforeunload` is registered only while dirty, and removed the moment it is not
  — a listener left attached prompts on every reload forever.
- A save in flight disables all three buttons rather than queueing a second one.

### Stage 2
- `admin_notification_reads (kind, entityId, readAt)`, primary key `(kind, entityId)`,
  written with `on conflict do nothing` so marking twice is a no-op.
- The feed is one bounded read per source, capped (50 total, newest first), each
  item carrying `kind`, `entityId`, a title, a line of detail, a timestamp, and a
  link to the thing itself.
- Unread count = feed items with no read row. The bell shows it; zero shows no dot.
- Mark as read, mark all as read, and open-related-item, per §15.1.
- Toasts: top-right, stacked, auto-dismiss ~4s, dismissible, `aria-live="polite"`,
  pause on hover, and never covering the sticky header controls.
- Same trust posture as every admin surface: `requireAdmin()` first in every
  action, secret-key reads only, RLS on with no policy, `execute` revoked.

## Security requirements

- The notification feed is admin-only: `requireAdmin()` in the page/layout and at
  the top of every action, and every read through `getSupabaseAdmin()`.
- Feed items carry no customer address, phone, or full order contents — an order
  number, a display name, and a link. The bell is a pointer, not a data export.
- `admin_notification_reads` grants nothing to the public roles.
- No customer PII in any log line, unchanged from every other admin module.
- The unsaved-changes work touches no data path and adds no endpoint: it is
  entirely client-side state over forms that already exist.

## Acceptance criteria

### Stage 1
- [ ] Editing any guarded form and clicking a rail link opens the dialog.
- [ ] Cancel stays on the page with edits intact.
- [ ] Discard leaves and does not save.
- [ ] Save saves, then leaves — and on a failed save, stays with the error shown.
- [ ] An unedited form never prompts.
- [ ] Saving, then navigating, never prompts.
- [ ] Refresh and tab-close prompt while dirty and not otherwise.
- [ ] Keyboard: Escape cancels, focus is trapped in the dialog and returns after.

### Stage 2
- [ ] The bell shows an unread count and opens the panel.
- [ ] New orders, new accounts, redemptions and earned credits appear, newest first.
- [ ] Mark as read and mark all as read both persist across a reload.
- [ ] Low stock appears while it is true and disappears when restocked.
- [ ] A saved product raises a toast that disappears; a failed save shows an
      inline error that does not.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` clean throughout.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run db:migrate     # Stage 2 only
```

## Manual test steps (Stage 1 first)

1. `npm run dev`, open `/admin/products/<slug>`.
2. Change the subtitle. Click **Journal** in the rail → the dialog appears.
3. Cancel → still on the product, subtitle still changed.
4. Repeat → **Discard** → Journal loads, and returning shows the old subtitle.
5. Repeat → **Save Changes** → it saves, then Journal loads.
6. Break the save deliberately (clear a required field), edit something, navigate,
   press Save → the dialog stays and the error is visible.
7. With edits pending, press ⌘R → the browser's own prompt appears. Cancel it.
8. Save, then navigate → no prompt.
9. Load a form and navigate without touching anything → no prompt.
10. Repeat 2–5 on `/admin/journal/<slug>` and `/admin/settings`.

## Open questions for the user

1. **Stage 1 then Stage 2, in two passes?** That is what I recommend and how this
   prompt is written — the unsaved-changes work is what stops real losses today,
   and the notification centre is the larger half. Say the word if you want them
   in one pass instead.
2. **Which editors get the guard.** I propose the twelve long-form editors listed
   above, and deliberately *not* `CreditAdjustForm` or `InviteCustomerForm`, which
   are two fields that clear on success — guarding those would prompt somebody for
   abandoning a half-typed email address.
3. **Browser Back is not intercepted** (decision 1). I can add the history-sentinel
   hack if you want it, but I recommend against it and would rather the limitation
   be documented than the history stack be corrupted.
4. **Toast placement**: top-right, per §14's "top-right or bottom-right". The
   admin header is sticky, so bottom-right is also available if you prefer it.
