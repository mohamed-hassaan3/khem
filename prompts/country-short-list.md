# Country dropdown — a short, curated list with Egypt first

## Goal

The country `<select>` at `/checkout` and in `/account/addresses` lists about
250 countries (`src/constants/countries.ts`). KHEM delivers only within Egypt,
and the list exists mainly so that a visitor the edge places in the wrong
country (VPN, corporate proxy, carrier homed abroad) can switch back to Egypt.

Replace it with a short list that has Egypt first and reads as a boutique's
list, not a form library's. Detection, saved addresses, validation and Arabic
must all keep working.

## Skills read

- `AGENTS.md` (workflow, §2 design, §8, §12).
- No Clerk, Supabase or AI SDK surface is touched. There is no migration.

## Existing code inspected (every place a country is handled)

| Where | What it does today |
| :--- | :--- |
| `src/constants/countries.ts` | `COUNTRY_CODES`, ~250 ISO alpha-2 codes. It is imported **only** by `src/lib/shipping.ts`. |
| `src/lib/shipping.ts` | `SHIPPING_COUNTRY = "EG"` and `SHIPPING_COUNTRY_NAME` (house spelling "Egypt" / "مصر"). `isEgypt()` is the server gate. `detectedCountryCode()` normalises the header. `countryName()` / `countryLabel()` use `Intl.DisplayNames`. `countryOptions(locale)` returns all codes sorted by `Intl.Collator`. `selectableCountry(code)` returns the detected code if it is in the list, otherwise EG with `detected: false`. |
| `src/lib/geo.ts` | `visitorCountry()` reads `x-khem-country`, which only nginx sets. |
| `src/app/[locale]/checkout/page.tsx` | Passes `detectedCountry` to the form. |
| `src/components/checkout/CheckoutView.tsx` | `selectableCountry(detectedCountry)` sets the starting value. `shipsHere = country === "EG"` closes the form. `countryLabel(code, locale)` is posted as the order's `shipCountry`. A saved-address prefill (just shipped) always starts at EG. |
| `src/components/checkout/DeliveryStep.tsx` | `CheckoutSelect` over `countryOptions(locale)`. Shows the "Chosen from your location" hint and the "We deliver within Egypt" notice. |
| `src/schemas/checkout.ts` | `country` must pass `isEgypt()`. This is the real boundary. |
| `src/components/account/AddressBook.tsx` | Native `<select>` over the same `countryOptions(locale)`. New drafts start at EG. |
| `src/components/account/AddressCard.tsx` | Prints a stored code through `countryLabel()`. Non-code legacy text is printed as written. |
| `src/schemas/address.ts` | `country: z.string().trim().min(1).max(80)`, with no shape check. |
| `src/lib/currency.ts` + `src/proxy.ts` + currency provider | Use the country **only** for the display-currency guess, through their own `COUNTRY_CURRENCY` map. They are independent of `COUNTRY_CODES` and **not affected**. |
| Region switcher (`dict.*.label: "Language and country"`) | Its own closed list (`PRICED_COUNTRIES` + "International"). It is a currency control, not an address field, so it is **out of scope** and left as is. |

## Recommended list

The list has 21 entries: Egypt pinned first, then 19 countries in a labelled
group, then "Another country".

**Pinned:** Egypt (EG). It always comes first, uses the house spelling (Egypt /
مصر), and is never sorted.

**Group "Elsewhere"** (sorted by name in the reader's language, using
`Intl.Collator`):

| Region | Countries | Why |
| :--- | :--- | :--- |
| Gulf | AE, SA, KW, QA, BH, OM | The largest Egyptian diaspora, and the strongest luxury-fragrance market in the region. Three of these are already currency markets (AED, SAR). |
| Levant & Maghreb | JO, LB, MA | Arabic-speaking neighbours with a strong perfumery culture. |
| Europe | GB, FR, DE, IT, NL, CH, ES | The fragrance capitals, and the most common VPN exit countries (NL, DE, GB). |
| North America | US, CA | Diaspora, and the most common VPN exit (US). |
| Other | TR | A common carrier and VPN route, and a regional luxury market. |

This list is about **who is likely to be standing behind the request**, not
about where the house ships. The house still ships only to Egypt. The list is
a constant, so adding or removing a country is a one-line change.

**"Another country"** (en) / **"دولة أخرى"** (ar) comes last. It is a
sentinel value (`"OTHER"`), never a real country. See edge case 1.

### Why this shape

- **Egypt first and on its own** says where the house is from and where it
  delivers before the customer reads anything else.
- **A short group with a label** (`<optgroup>`) reads as curated. iOS and
  Android show the group label as a section header in the native picker, so
  it stays phone-friendly with no custom dropdown.
- **"Another country" instead of 230 more names**: if the house cannot deliver
  there, naming it precisely is no help. The notice below the field already
  says what to do.
- **Native `<select>` kept** (`CheckoutSelect` and the address book's select).
  It is accessible, RTL-correct and works with the mobile picker for free.

## Edge cases and decisions

1. **Detected country not on the list** (for example Brazil, `T1` from Tor, or
   `XK`). Today `selectableCountry` picks the code if the long list has it.
   New rules:
   - Detected and on the list → that code, shown with the "Chosen from your
     location" hint.
   - Detected, a valid two-letter code, but not on the list → **"Another
     country"**, also with the hint. The "We deliver within Egypt" notice
     shows, as it does today for any non-Egyptian country. Choosing Egypt
     reopens the checkout. Nothing pretends to be Egypt.
   - Header absent, empty or malformed (`XX`, `T1`) → **Egypt**, with no
     hint. This is the same as today's "unknown means unknown, never
     elsewhere" rule.
   - The notice text says "the country above", which still reads correctly
     when "Another country" is selected. No copy change is needed.
2. **"OTHER" must never reach a database.**
   - At checkout, the submit is already blocked whenever `country !== "EG"`
     (disabled button, `handleSubmit` guard, and `isEgypt()` on the server).
     As a guard, `countryLabel("OTHER")` is never called, because the
     submit path returns early first.
   - In the address book, "Another country" is **not offered**. See 3.
3. **The address book.** It uses the same short list (Egypt pinned + group),
   **without** "Another country". The book exists to fill the checkout, and
   the checkout takes only Egypt, so saving "another country" has no use.
4. **A saved address whose country is not on the list.** The book has offered
   ~250 countries until now, so such rows can exist. When editing one, the
   current code is **added as an extra option** at the top of the group (named
   by `countryLabel`). The select then shows the real value instead of going
   blank, and saving without touching the field leaves it unchanged. Non-code
   legacy text (for example "Egypt" typed by hand) gets the same treatment,
   shown as written. `AddressCard` is unchanged: it already prints any code or
   text.
5. **Saved non-Egyptian addresses at checkout.** These are already filtered
   out by the prefill shipped today (`page.tsx`), so there is nothing new to
   handle.
6. **Server validation for the address book.** Tighten `country` from "any
   string" to: a two-letter code, **or** the value already stored on that row.
   - Simpler alternative (recommended): accept `^[A-Z]{2}$` plus existing
     non-code legacy text up to 80 characters. That keeps legacy rows
     editable, refuses arbitrary new free text (the UI can no longer produce
     it), and does not reject a code just because it is off the current list.
     If the list later shrinks, old rows stay valid.
   - The sentinel `"OTHER"` is refused explicitly.
7. **Checkout validation** is unchanged: `isEgypt()` remains the only gate.
8. **Arabic / RTL.** Names come from `Intl.DisplayNames(["ar"])`, Egypt from
   `SHIPPING_COUNTRY_NAME.ar`, and order from `Intl.Collator("ar")`, all as
   today. New dictionary keys are added in `en.ts` and `ar.ts`:
   `checkout.delivery.countryGroup` ("Elsewhere" / "دول أخرى") and
   `checkout.delivery.countryOther` ("Another country" / "دولة أخرى"). The
   address book reuses the same keys. Native selects follow `dir="rtl"`
   automatically.
9. **The full 250-code list is deleted.** After this change nothing needs it.
   Detection only needs "is it a well-formed code" (already done by
   `detectedCountryCode`), and naming any code is `Intl`'s job.
   `src/constants/countries.ts` keeps only the short list, with its rationale
   in the doc comment.
10. **Currency, region switcher, proxy, prelaunch:** untouched (see the table
    above).

## Files likely to change

- `src/constants/countries.ts`: replace `COUNTRY_CODES` with
  `FEATURED_COUNTRIES` (the 19 codes) and `OTHER_COUNTRY = "OTHER"`.
- `src/lib/shipping.ts`:
  - `countryOptions(locale, { includeOther?, keep? })` returns
    `{ pinned: CountryOption, group: CountryOption[], other?: CountryOption }`.
    `keep` adds a legacy value to the group.
  - `selectableCountry(code)` follows the rules in edge case 1.
  - Update the module doc ("a dropdown of every country").
- `src/components/checkout/CheckoutField.tsx`: `CheckoutSelect` gains optional
  `groups` support (`<optgroup>`). Existing callers are unchanged.
- `src/components/checkout/DeliveryStep.tsx`: build the pinned / group / other
  structure; `handleCountryChange` already copes with an unlisted value.
- `src/components/checkout/CheckoutView.tsx`: no logic change beyond the new
  `selectableCountry` return. Check the doc comment on `country`.
- `src/components/account/AddressBook.tsx`: pinned + group, no "other", and
  keep the draft's current value.
- `src/schemas/address.ts`: tighten `country` as in edge case 6.
- `src/lib/i18n/dictionaries/en.ts`, `ar.ts`: the two new keys.

## Implementation requirements

- No new dependency, no custom dropdown, and `CheckoutSelect` styling stays as
  it is (gold label, hairline rule, chevron).
- Option order: Egypt, then `<optgroup label="Elsewhere">` with the countries
  sorted, then "Another country" as the last option inside that group (it
  belongs to "elsewhere").
- `countryOptions` stays pure and client-safe. It is built once per locale in
  `useMemo`, as today.
- Strict TypeScript, no `any`.

## Security requirements

- `isEgypt()` stays the only checkout gate. Nothing about the list is trusted
  on the server.
- The detected header is still used only as a key into a fixed list and is
  never echoed into markup unchecked.
- The address-book schema refuses the sentinel and arbitrary new free text.

## Acceptance criteria

- [ ] `/checkout` shows Egypt first, then an "Elsewhere" group of 19
      countries sorted by name, then "Another country". The same holds in
      Arabic, sorted in Arabic order.
- [ ] Header `EG`, `AE`, `US` → that country is selected and the hint is
      shown.
- [ ] Header `BR` → "Another country" is selected, the hint is shown, the
      notice is shown, and the button is disabled. Choosing Egypt reopens the
      form.
- [ ] Header absent or `T1` → Egypt is selected, with no hint.
- [ ] A signed-in customer with a saved Egyptian address → Egypt, prefilled
      (unchanged from today).
- [ ] The address book offers Egypt plus the group, with no "Another country".
- [ ] Editing an old saved address in `BR` shows "Brazil" selected, and saving
      unchanged keeps `BR`.
- [ ] A forged `saveAddress({ country: "OTHER" })` or free-text country is
      refused.
- [ ] Display currency and the region switcher behave exactly as before.
- [ ] At 375px the native picker opens with section headers on iOS and
      Android, with no layout change to the field.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Manual test steps

1. `npm run dev`, add a product, then open `/checkout`. Check the order and
   the group label.
2. Simulate detection. In development nothing sets `x-khem-country`, so send
   it with a header extension such as ModHeader. Set it to `AE`, `BR` and
   `T1` in turn and confirm edge case 1 each time.
3. Choose "Another country": the notice appears and the button is disabled.
   Choose Egypt: it reopens.
4. `/ar/checkout`: confirm Arabic names, Arabic order, and RTL.
5. `/account/addresses` → Add: confirm there is no "Another country".
6. In the database (Supabase table editor), set one of your addresses'
   `country` to `BR`. Edit it in `/account/addresses`: Brazil is selected.
   Save: it stays `BR`.
7. Switch the region/currency switcher. Nothing has changed there.
8. On a phone (or Safari/Chrome device emulation), open the country picker
   and confirm the section header.
