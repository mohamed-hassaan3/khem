# Profile address form — match the checkout's delivery form

## Goal

Make the "Add / Edit address" form in the profile (`/account/profile`,
`<AddressBook>`) match the checkout's delivery step, so a customer sees one
address form across the app: the same fields, order, labels, placeholders,
city chooser and country chooser. The direction was confirmed by the owner:
**the profile changes to match checkout, not the other way round**, and City
becomes **the checkout's dropdown + "Other city" in both**.

This is part of the uncommitted work that also holds
`prompts/checkout-saved-address-prefill.md` and `prompts/country-short-list.md`.
It is committed with them.

## Skills read

- `AGENTS.md` (workflow, §2/§3 design, §12 checklist). No Clerk, Supabase or
  AI SDK surface is touched, and there is no migration.

## Existing code inspected

| File | Finding |
| :--- | :--- |
| `src/components/checkout/CheckoutField.tsx` | `CheckoutField` / `CheckoutSelect`. Uses `field field-underline` and a gold uppercase label, the same classes the profile form already uses, so the *look* of a single input is already identical. |
| `src/components/checkout/DeliveryStep.tsx` | Field set: Street address → Landmark → City (dropdown from `DELIVERY_CITIES` + "Other city" text field) → Country (Egypt + "Elsewhere" + "Another country") → Delivery instructions. Governorate and Postal code are commented out. Owns the `otherCity` state and `isUnlistedCity()`. |
| `src/components/account/AddressBook.tsx` | Field set: Label → Recipient → Street address → Landmark → **City (free text)** → **Governorate** → **Postal code** → Country (same list, no "Another country"). It has its own `field()` renderer and native `<select>`, its own copy (`account.addresses.form.*`: "Street address", "Landmark", "Optional , beside, behind, opposite"), and a small inline "Deliver here by default" checkbox. |
| `src/components/account/AddressCard.tsx` | Prints `` `${city}, ${state} ${postalCode}` ``. With an empty governorate it would read "Maadi, ". |
| `src/schemas/address.ts` | `state` is `min(1)`, so it is required. The DB column is `not null` with only a max-length check, so `""` is valid there. |
| `src/actions/checkout.ts` | `saveCheckoutAddress` copies the city into `state` only because the address book required it. |
| `src/app/[locale]/layout.tsx` | `I18nProvider` wraps every `[locale]` page, so `useDictionary()` works inside the profile too. |

## Decisions

1. **One shared component, `<AddressFields>`**, in
   `src/components/checkout/AddressFields.tsx`. It renders exactly the
   checkout's address block: Street address, Landmark, City (dropdown +
   "Other city"), Country. It uses `CheckoutField` / `CheckoutSelect` and the
   `checkout.delivery.*` copy, so the two forms cannot drift. `DeliveryStep`
   and `AddressBook` both render it. The delivery note stays in
   `DeliveryStep`, because it belongs to an order, not to an address.
2. **Governorate and Postal code leave the profile form**, as they already
   have at checkout.
   - `addressInputSchema.state` becomes optional (`max(80)`, default `""`),
     like `postalCode`.
   - Editing an address that already has a governorate or postal code
     **keeps** those values. The draft carries them and the form simply does
     not show them. Nothing is lost.
   - Checkout's `state: order.state || order.city` workaround is removed. The
     saved governorate is now whatever the order carried (usually `""`).
3. **Label and Recipient stay in the profile form**, above the shared fields,
   because only the address book needs them:
   - Label names the address on the checkout chips ("Home", "Office").
   - Recipient is printed on the address card.

   They are rendered with `CheckoutField`, so they look like the rest.
4. **City: dropdown in both.** The profile gets the same `DELIVERY_CITIES`
   list and "Other city". A saved city not on the list (older free-text
   entries, for example "Luxor") opens as "Other city" with the text filled
   in, so it is never shown blank or changed.
5. **"Other city" is derived, not stored**, so the chip and edit cases need no
   special handling:

   ```
   showOther = isUnlistedCity(country, city) || (choseOther && city === "")
   ```

   `choseOther` is set when "Other city" is picked and cleared when a listed
   city is picked. This replaces `DeliveryStep`'s `handleApplySaved`
   workaround. A chip, an edit, or a prefill shows the right control on the
   first render.
6. **Country chooser:** the same component and grouped list. Checkout passes
   "Another country"; the profile does not, and passes the stored country as
   `keep` (behaviour from `country-short-list.md`, unchanged).
7. **The "Deliver here by default" checkbox** gets the same bordered row style
   as checkout's "Save this address to my profile" (native input,
   `accent-gold`, `border border-ground-border px-5 py-4`).
8. **Profile form frame:** the bordered `bg-stone` panel, its heading, and its
   Save/Cancel buttons stay. They are the profile's container, as the
   numbered section is checkout's. The grid inside uses the checkout
   section's grid classes (`grid-cols-1 sm:grid-cols-2`,
   `gap-x-4 md:gap-x-6 gap-y-4 md:gap-y-7`).
9. **`AddressCard`** joins city, governorate and postal code without empty
   parts, giving "Maadi" rather than "Maadi, ". In Arabic the parts are joined
   with "، ".
10. **Errors:** the profile still receives error codes from its action. It
    resolves them through its existing `account.addresses.form.errors` copy
    and passes the resolved text into `<AddressFields>`, which, like
    `CheckoutField`, takes already-translated strings.
11. **Unused copy:** `account.addresses.form.line1`, `line2`,
    `line2Placeholder`, `city`, `state`, `postalCode`, `postalCodePlaceholder`,
    `country` and `countryGroup` are removed from `en.ts` and `ar.ts` once
    nothing reads them. The `Dictionary` type catches any reader that remains.

## Files likely to change

- `src/components/checkout/AddressFields.tsx` (**new**)
- `src/components/checkout/DeliveryStep.tsx`: renders `<AddressFields>`;
  loses its own city/country code and `otherCity`.
- `src/components/account/AddressBook.tsx`: Label + Recipient through
  `CheckoutField`, then `<AddressFields>`, then the restyled default
  checkbox; the `field()` helper and native `<select>` are removed.
- `src/components/account/AddressCard.tsx`: joined city line.
- `src/schemas/address.ts`: `state` optional.
- `src/actions/checkout.ts`: drop the `state || city` fallback.
- `src/lib/i18n/dictionaries/en.ts`, `ar.ts`: remove the now-unused profile
  form keys. **Keep the owner's unrelated uncommitted edits intact.**

## Implementation requirements

- `AddressFields` props: `idPrefix`, `values: { line1, line2, city, country }`,
  `onChange(field, value)`, `errors: Partial<Record<field, string>>`,
  `countryHint?`, `includeOtherCountry: boolean`, `keepCountry?: string`.
  - It renders fragments as direct grid children, so it sits in either
    parent's grid.
  - Ids are `${idPrefix}-line1` and so on. Checkout passes `"checkout"`, so
    its existing ids (`checkout-line1`, …) and any tests or anchors keep
    working.
- The country-change rule stays inside `AddressFields`: switching country
  empties a city that the new country does not list.
- Strict TS, no `any`, and no effects for derived state.
- No visual change to checkout itself. After this change it renders the same
  DOM as now, apart from a `key` or two.

## Security requirements

- No change to what the server accepts beyond `state` becoming optional. The
  bounds still mirror the DB `check` constraints.
- `saveAddress` ownership scoping and the legacy-country rule are untouched.

## Acceptance criteria

- [ ] `/account/profile` → Add address shows: Label, Recipient, Street
      address, Landmark, City (dropdown), Country (Egypt + Elsewhere), then
      "Deliver here by default". The fields under Recipient look and read
      exactly like the checkout's.
- [ ] Picking "Other city" in the profile shows the city text field, as at
      checkout.
- [ ] Editing a saved address whose city is unlisted shows "Other city" with
      the text filled in. Saving unchanged keeps it.
- [ ] Editing an address that has a governorate and postal code, then saving,
      keeps both in the database.
- [ ] A new address saves with no governorate, and its card reads "Maadi",
      not "Maadi, ".
- [ ] Checkout looks and behaves exactly as before, including chips, the
      prefill, "Other city" from a chip, and the save checkbox.
- [ ] Arabic `/ar/account/profile`: the same copy as `/ar/checkout`, RTL
      correct.
- [ ] 375px: one column, no horizontal scroll, 44px tap targets.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev` and sign in.
2. Open `/account/profile`, then **Add address**, and compare it side by side
   with `/checkout`'s Delivery section. The fields, labels, placeholders, city
   dropdown and country list match.
3. Add an address with city "Maadi" and save. The card reads "Maadi" on its
   own line above "Egypt".
4. Add another with **Other city** → "Luxor". Save, then Edit it: "Other
   city" is selected and "Luxor" is filled in.
5. In Supabase, give one address `state = 'Cairo'` and
   `postalCode = '11511'`. Edit its street in the profile and save. Both
   values are still in the row.
6. At `/checkout`, the chips for both addresses work. The Luxor chip shows
   "Other city / Luxor", and the Maadi chip switches back to the dropdown.
7. Repeat steps 2 and 6 in `/ar/…`, and at 375px width.
