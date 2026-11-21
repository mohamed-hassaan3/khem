# Checkout — prefill the delivery address from the customer's address book

## Goal

A signed-in customer's name and email are already prefilled at `/checkout`.
Do the same for the delivery address, using the address book that already
exists at `/account/addresses` (`public."Address"`).

1. A signed-in customer with a saved address sees it filled in at checkout.
2. They can edit it at checkout without changing the saved address.
3. A **"Save this address to my profile"** checkbox lets them keep what they
   typed.
4. No saved address → checkout behaves exactly as it does today.
5. Guests are not affected at all.
6. Mobile-friendly, matching the current checkout design.

## Skills read

- `AGENTS.md` (workflow, §8 routing, §10.2 Clerk, §12 checklist).
- No new Clerk or Supabase APIs are needed. The feature reuses the patterns
  already in the repo: `getViewer()` / `getUserId()` from `src/lib/auth.ts` for
  identity, and `getSupabaseAdmin()` behind the `userId` filter for
  `"Address"`. `.agents/skills/clerk` and `.agents/skills/supabase` should be
  consulted only if implementation goes beyond those existing calls.
- No schema migration, so no PostgREST cache reload is needed.

## Existing code inspected

| File | What matters |
| :--- | :--- |
| `src/app/[locale]/checkout/page.tsx` | `force-dynamic`. Reads `getViewer()` and passes `{ fullName, primaryEmail }` to `CheckoutView`. Credits, vouchers and rewards are loaded per viewer in the same way. That is the pattern to follow. |
| `src/components/checkout/CheckoutView.tsx` | Holds `address` state (`Record<DeliveryField,string>`). `country` is an ISO code and is converted with `countryLabel()` at submit. Calls `placeCustomerOrder(...)`. |
| `src/components/checkout/DeliveryStep.tsx` | Address fields. `state` and `postalCode` are commented out (hidden). It has a local `otherCity` state for cities not in `DELIVERY_CITIES`. Its doc comment already plans for "a row of chips above these fields that fill them in", but that comment is stale and says there is no `"Address"` table. |
| `src/actions/checkout.ts` | `placeCustomerOrder`: honeypot → rate limit → `checkoutSchema` → `place_order()` RPC. It already uses `after()` for best-effort work after the response. Identity comes from `getUserId()`. |
| `src/schemas/checkout.ts`, `src/types/checkout.ts` | `checkoutSchema` / `CheckoutFormInput`. `state` and `postalCode` may be `""`. |
| `src/actions/addresses.ts` | `saveAddress(input)` validates with `addressInputSchema`, resolves the `"User"` row with `ensureUserRowId`, and scopes every write with `.eq("userId", …)`. The first address saved becomes the default automatically. |
| `src/schemas/address.ts` | `addressInputSchema`: `label` 1–60, `recipient` 2–120, **`state` min 1**, `postalCode` may be `""`, `country` min 1. |
| `src/services/account.ts` | `getAddressesForUser(clerkId)` returns rows default first, then oldest. `ensureUserRowId(viewer)` is defined here. |
| `src/types/account.ts` | `SavedAddress { id, label, recipient, line1, line2, city, state, postalCode, country, isDefault }` |
| `src/components/account/AddressBook.tsx` | Stores `country` as an **ISO code**, the same vocabulary the checkout dropdown uses, so no mapping is needed. |
| `src/lib/shipping.ts` | `SHIPPING_COUNTRY = "EG"`. The checkout refuses any other country. |
| `src/components/auth/SignUpForm.tsx` | The existing house checkbox pattern: native input, `accent-gold`, a bordered `label` row. |

## Decisions and assumptions

1. **Which address is prefilled.** The default address if its country is `EG`.
   Otherwise the first `EG` address. If there is none, nothing is prefilled.
   Prefilling a non-Egyptian address would close the checkout on load (the
   house delivers only within Egypt), and requirement 4 says checkout must
   look as it does today.
2. **More than one Egyptian address.** A compact row of chips appears above
   the fields, one per saved address labelled with its `label` ("Home",
   "Office"). Clicking a chip refills the fields. With exactly one saved
   address, no chips are shown. This is the picker that `DeliveryStep`'s own
   comment planned for.
3. **Editing never writes.** The prefill copies values into local form state.
   Nothing about the saved row is sent to the server: no address id crosses
   into the order payload. Editing the fields can only change this order's
   `ship*` snapshot.
4. **"Save this address to my profile" adds a new address and never
   overwrites one.** This keeps requirement 2 strict. A customer who edits
   their prefilled address and ticks the box gets a second entry, which they
   can tidy up in `/account/addresses`. Before inserting, the server skips the
   save if an address with the same `line1`, `line2`, `city` and `country`
   already exists (trimmed, case-insensitive), so ticking it on an unchanged
   address does nothing.
5. **When the checkbox is shown.** Only to signed-in customers, and only while
   the current fields do not match a saved address under the same comparison
   as decision 4. It starts **unchecked**. A customer who saves nothing loses
   nothing.
6. **Default status.** A newly saved address becomes the default only if it is
   the customer's first one. `saveAddress()` already does this. An existing
   default is never changed from checkout.
7. **Hidden fields the address book requires.**
   - `state` (Governorate) is hidden at checkout but required (`min 1`) in the
     address book. When the submitted `state` is empty, use the `city` value.
     Every listed `DELIVERY_CITIES` entry is a Cairo or Giza locality, and the
     customer can correct it in the address book.
   - `label`: the city name (for example "Maadi"). It is truthful, and the
     customer can rename it.
   - `recipient`: the order's `customerName`.
   - `country`: `SHIPPING_COUNTRY` (`"EG"`). It is the only country the schema
     lets through, and storing the code keeps the address book's vocabulary.
   - `postalCode`: whatever was submitted (usually `""`, which is valid).
8. **When the save happens.** On the server, inside `placeCustomerOrder`, only
   after `place_order()` has succeeded, in `after()`. It is best-effort and can
   never fail or slow down the order. A card order is saved when it is placed,
   not when it is paid. This is acceptable because the customer explicitly
   asked for the address to be saved.
9. **Identity.** The save runs only when `getUserId()` returns a session. The
   flag from a guest is ignored. The owner is never in the payload, so the
   existing `saveAddress()` and `ensureUserRowId()` path is reused unchanged.

## Files likely to change

- `src/app/[locale]/checkout/page.tsx`: load the viewer's addresses and pass a
  trimmed, Egypt-only projection.
- `src/types/checkout.ts`: add a `CheckoutSavedAddress` type, and
  `saveAddress: boolean` on `CheckoutFormInput`.
- `src/schemas/checkout.ts`: `saveAddress: z.boolean().default(false)`.
- `src/actions/checkout.ts`: best-effort save in `after()`.
- `src/services/account.ts` (or a small `src/lib/address-match.ts`): a pure
  `sameAddress(a, b)` comparison shared by the client (checkbox visibility)
  and the server (dedupe). It must be importable from a client component, so
  it lives in `src/lib/`, not in a server-only service.
- `src/components/checkout/CheckoutView.tsx`: initial `address` from the
  prefill, a `saveToProfile` state, and both passed to `DeliveryStep` and into
  the action call.
- `src/components/checkout/DeliveryStep.tsx`: saved-address chips, the
  checkbox, `otherCity` initialisation for a prefilled city that is not in the
  list, and an update to the stale doc comment.
- `src/lib/i18n/dictionaries/en.ts`, `ar.ts`: new `checkout.delivery` keys.
  **Both files have unrelated uncommitted edits in the working tree. Edit
  surgically and do not revert them.**

No migration. No new route. No change to `"Order"`, `place_order()` or the
address-book actions.

## Implementation requirements

### Server: `page.tsx`

- Fetch addresses only when `viewer` exists:
  `viewer ? getAddressesForUser(viewer.id) : []`. Run it together with the
  other viewer-keyed reads where that is natural. It must not add a
  sequential round trip for guests.
- Filter to `country === SHIPPING_COUNTRY` and keep the existing order
  (default first).
- Project to `{ id, label, line1, line2, city, state, postalCode }`. `id` is
  used only as a React key and chip identity. It is never posted back.
- Pass it as `savedAddresses` to `CheckoutView`. It is `[]` for guests.

### Client: `CheckoutView.tsx`

- New prop `savedAddresses: readonly CheckoutSavedAddress[]`.
- Initial `address` state: if `savedAddresses[0]` exists, take `line1`,
  `line2 ?? ""`, `city`, `state`, `postalCode` from it and `country:
  SHIPPING_COUNTRY`. Otherwise use today's initial value unchanged. `note`
  stays `""`.
- `const [saveToProfile, setSaveToProfile] = useState(false)`.
- `applySavedAddress(saved)`: replace `line1`, `line2`, `city`, `state`,
  `postalCode`, set `country` to `EG`, keep `note`, and clear any field errors
  on those fields.
- Send `saveAddress: viewer !== null && saveToProfile && !matchesSaved` in
  `placeCustomerOrder(...)`.
- Pass `savedAddresses`, `onApplySaved`, `canSave` (`viewer !== null &&
  !matchesSaved`), `saveToProfile` and `onSaveToProfileChange` to
  `DeliveryStep`.

### Client: `DeliveryStep.tsx`

- **Chips** (only when `savedAddresses.length > 1`): rendered first in the
  section, full-width (`sm:col-span-2`). A small label "Saved addresses" in
  the section's existing micro-label style, then a wrapping row of buttons.
  - Each is a `type="button"`, `rounded-none`, `border` button: `font-heading
    text-[10px] uppercase tracking-[0.2em]`, `px-4 py-2`, with a minimum
    44px touch height on mobile.
  - The active chip (the one whose values match the fields, using
    `sameAddress`) has a gold border and gold text (`border-ground-accent
    text-ground-accent`) and `aria-pressed="true"`. The others use
    `border-ground-border text-ground-muted`, with a gold border on hover.
  - A `transition-colors duration-500` and the house ease. No scale, no
    bounce.
  - Arabic: the row follows `dir` naturally. Use `gap-*` and logical spacing
    only, with no `ml`/`mr`.
- **Prefill notice** (when `savedAddresses.length >= 1`): one quiet line under
  the chips or at the top, `text-[11px] text-ground-muted`, reading "Filled in
  from your saved addresses. Changes here apply to this order only." This
  covers requirement 2 in words, not just in behaviour.
- **`otherCity`**: initialise with a lazy `useState` to `true` when
  `values.city !== ""` and the city is not in `DELIVERY_CITIES[values.country]`.
  This stops a prefilled custom city leaving the select blank. When a chip is
  applied, recompute it in the same handler (do not use an effect; the repo's
  lint refuses setState-in-effect cascades).
- **Checkbox** (only when `canSave`): placed after the delivery-note field,
  full-width. It follows the `SignUpForm` pattern: a `<label>` row with
  `flex items-start gap-3 border border-ground-border px-5 py-4`, a native
  `<input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer
  accent-gold">` and the text "Save this address to my profile" in
  `text-xs text-ground-muted`. Below it is a smaller hint: "Added to your
  address book after you place the order." It sits inside the existing
  `fieldset`, so it freezes with the rest of the form once an order exists.
- Replace the stale "No saved-address picker yet" comment with an accurate
  description of the prefill, chips and save behaviour.

### Server: `actions/checkout.ts`

- Read `parsed.data.saveAddress`. After the order number is confirmed (both
  the CASH and CARD branches; place the code once, before the branch), if
  `saveAddress && clerkUserId`, schedule:

  ```ts
  after(async () => {
    try { await saveCheckoutAddress(parsed.data); }
    catch (cause) { console.error(`[checkout] ${orderNumber} address save failed:`, cause instanceof Error ? cause.message : "unknown error"); }
  });
  ```
- `saveCheckoutAddress` is a module-private helper. It:
  1. Reads `getAddressesForUser(clerkUserId)`. If any match `sameAddress`, it
     returns early.
  2. Calls the existing `saveAddress({ label: city, recipient: customerName,
     line1, line2, city, state: state || city, postalCode, country:
     SHIPPING_COUNTRY, isDefault: false })` from `src/actions/addresses.ts`.
     That action re-derives identity from the session, validates with
     `addressInputSchema` and scopes by `userId`, so no ownership logic is
     duplicated. Truncate `label` to 60 characters.
  3. If it returns `ok: false`, logs **only the error code**.
- Logging rule from the file header: never log the name, address or phone.

### Shared: `sameAddress`

- Pure function in `src/lib/` comparing `line1`, `line2 ?? ""`, `city` and
  `country`: trimmed, lowercased, with internal whitespace collapsed. No
  server imports.

### Copy (`checkout.delivery`)

| Key | en | ar |
| :--- | :--- | :--- |
| `savedHeading` | Saved Addresses | العناوين المحفوظة |
| `savedNotice` | Filled in from your saved addresses. Changes here apply to this order only. | مُعبّأ من عناوينك المحفوظة. أي تعديل هنا يخص هذا الطلب فقط. |
| `saveToProfile` | Save this address to my profile | احفظ هذا العنوان في ملفي الشخصي |
| `saveToProfileHint` | Added to your address book after you place the order. | يُضاف إلى دفتر عناويني بعد إتمام الطلب. |

The Arabic `Dictionary` type must stay in step. A missing key is a compile
error.

## Security requirements

- No address id, `userId`, `clerkId` or email is accepted from the client for
  the save. Identity comes from the session (`getUserId()` in the checkout
  action, `getViewer()` inside `saveAddress`).
- Only the projection listed above crosses into the client bundle. No
  `recipient`, no `isDefault`, no `createdAt`.
- The flag is ignored for guests on the server, whatever the client sends.
- A failed save never changes the order result and never surfaces to the
  customer as an error.
- No PII in logs.

## Acceptance criteria

- [ ] A signed-in customer with one Egyptian saved address opens `/checkout`
      and sees street, landmark and city filled in. The country is Egypt.
- [ ] A customer with two or more Egyptian addresses sees chips. The default
      is active, and clicking another refills the fields.
- [ ] A saved city not in the dropdown list shows as "Other city" with its
      text field filled. It is never shown as an empty select.
- [ ] Editing the fields and placing the order leaves the saved address
      unchanged in `/account/addresses`. The order carries the edited
      address.
- [ ] Ticking the checkbox on an edited address adds a **new** entry to the
      address book after the order is placed. The previous default stays the
      default.
- [ ] A customer with no saved addresses who ticks the box gets their first
      address, and it is marked default.
- [ ] The checkbox is hidden while the fields match a saved address.
- [ ] A signed-in customer with no saved address sees the same empty form as
      today, plus the unchecked checkbox.
- [ ] Guest checkout is unchanged: no chips, no notice, no checkbox, and no
      address read.
- [ ] Arabic `/ar/checkout` renders the new copy in RTL with correct
      alignment.
- [ ] At 375px width the chips wrap, every tap target is at least 44px, and
      there is no horizontal scroll.
- [ ] The order still succeeds if the address save fails (simulate by
      throwing in the helper).

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`, then add any product to the bag.
2. **Guest:** sign out. Open `/checkout` and confirm the form is identical to
   before, with no checkbox.
3. **Signed in, no addresses:** sign in with an account whose address book is
   empty (`/account/addresses`). The fields are empty and the checkbox is
   shown unchecked. Fill in an address, tick the box, and place a **Cash on
   Delivery** order. Reload `/account/addresses`: the address is there,
   labelled with the city, and marked default.
4. **Prefill:** add some products and go back to `/checkout`. The address is
   filled in, the notice is shown, and the checkbox is hidden.
5. **Edit without saving:** change the street and place the order without
   ticking. The address book is unchanged. The order (in `/account` order
   detail or the admin order page) shows the edited street.
6. **Edit and save:** change the street again, tick the box, and place the
   order. The address book now has two entries, and the original is still
   default.
7. **Chips:** reopen `/checkout`. Two chips appear and the default is active.
   Click the other one and the fields change. Click back.
8. **Other city:** in `/account/addresses`, edit an address so the city is
   something not in the list (for example "Luxor"). At checkout, choose it:
   the city shows as "Other city" with "Luxor" filled in.
9. **Arabic:** repeat step 4 at `/ar/checkout`.
10. **Mobile:** use DevTools at 375×812 and repeat steps 4 and 7.
