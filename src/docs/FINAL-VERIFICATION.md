# KHEM — Final Verification Checklist

The browser checks that close `ADMIN-CMS-FINAL-ARCHITECTURE.md`. Everything that could
be verified without a signed-in browser already has been; this is only what needs a
human at the keyboard.

**Base URL:** `http://localhost:3000` (`npm run dev`)
**Branch:** `fix/gallery-editor-field-loss` — nine commits, not merged to `main`.

> **English is unprefixed.** The dashboard is at `/admin`, not `/en/admin`.
> `/en/anything` 404s by design — it is rewritten to `/en/en/…` and falls to the
> catch-all. Arabic *is* prefixed: `/ar/admin`, `/ar/heritage`.

Sign in as an admin before starting. Open DevTools → Console and leave it open for
check 10.

---

## 1. Admin rail — five groups and the second level

| | |
| --- | --- |
| **URL** | `/admin` |
| **You should see** | A left rail with **Dashboard** alone at the top, then five headed groups: **Commerce** (Orders, Customers, Products, Collections, Inventory, Stockists) · **Marketing** (Promotions, Discounts, Credits, Campaigns, Newsletter, Announcements) · **Content** (Landing Page, World of KHEM) · **Analytics** (Analytics) · **System** (Settings). No second level under World of KHEM yet. |
| **Action** | Click **Content → World of KHEM**. |
| **Expected** | Five indented children appear beneath it — Heritage, Craftsmanship, Ingredients, Journal, About KHEM — and the World of KHEM row is highlighted. The children stay visible while you are anywhere in Content, and disappear when you go to, say, Orders. |

- [ ] Pass  - [ ] Fail — notes:

**Also check (same screen):** collapse the rail with the toggle above the panel, reload
the page, and confirm it is still collapsed. Then narrow the window below ~1024px and
confirm the rail becomes an off-canvas drawer over a scrim that closes when you tap a
link or press Escape.

- [ ] Pass  - [ ] Fail — notes:

---

## 2. Content → Landing Page

| | |
| --- | --- |
| **URL** | `/admin/content/landing` |
| **You should see** | A back link to **Content**, then a numbered list of the home page's ten bands in reading order: Hero, Collections, Essences, Story, **Craft pillars**, Featured fragrance, Ingredients, Journal, Testimonials, Newsletter. Each says where it is edited. "Craft pillars" is highlighted and reads "Edited below." Below the list, a **Craft pillars** editor with four rows: Rare Ingredients, Master Perfumers, and two more. |
| **Action** | Read the source line for **Featured fragrance** and for **Hero**. |
| **Expected** | Featured fragrance points at *System → Settings*; Hero is marked code-owned. Nothing on this screen offers to edit hero text. |

- [ ] Pass  - [ ] Fail — notes:

---

## 3. Content → World of KHEM

| | |
| --- | --- |
| **URL** | `/admin/content/world` |
| **You should see** | A back link to **Content** and five cards: Heritage, Craftsmanship, Ingredients, Journal, About KHEM. |
| **Action** | Click **Ingredients**, then use its back link. Return and click **Journal**. |
| **Expected** | Ingredients opens the existing list at `/admin/content/ingredients` (Oud, Frankincense, …) and its back link returns you to World of KHEM. Journal opens `/admin/journal` — the URL is deliberately unchanged even though it sits under World of KHEM here. |

- [ ] Pass  - [ ] Fail — notes:

---

## 4. Content → Heritage

| | |
| --- | --- |
| **URL** | `/admin/content/heritage` |
| **You should see** | Two editors: **Heritage timeline** (6 rows, first is `3000 BC — The Birth of Kyphi`) and **Brand values** (3 rows, first is `Reverence`). Craft pillars must **not** be here. |
| **Action** | Expand the first timeline row. |
| **Expected** | Fields Year, Year — Arabic, Title, Title — Arabic, Description, Description — Arabic. The Arabic fields are empty. |

- [ ] Pass  - [ ] Fail — notes:

---

## 5. Content → Craftsmanship

| | |
| --- | --- |
| **URL** | `/admin/content/craftsmanship` |
| **You should see** | Three editors: **Atelier stages** (6 rows, first `01 — Ingredient Sourcing`), **Craft figures** (4 rows, first `300+ — Formulation Trials Per Fragrance`), **Perfumer's quote** (1 row, author `Mohamed Hassaan`, Published on). |
| **Action** | Confirm the quote list holds exactly one row. |
| **Expected** | One quote. The duplicate `leila-hassan` was removed; the survivor is the only published quote, so `/craftsmanship` renders it deterministically. |

- [ ] Pass  - [ ] Fail — notes:

---

## 6. Content → About KHEM

| | |
| --- | --- |
| **URL** | `/admin/content/about` |
| **You should see** | One editor, **Mission statements**, with 2 rows: `Mission — To Honor the Ancient` and `Vision — A New Egyptian Luxury`. |
| **Action** | Expand the Mission row. |
| **Expected** | Label, Label — Arabic, Title, Title — Arabic, Text, Text — Arabic. |

- [ ] Pass  - [ ] Fail — notes:

---

## 7. Round trip — edit, save, persist, publish, both languages

This is the check that matters most. It proves the CMS write path reaches the public
site in both languages.

**Current value, so you can restore it:**

```
Heritage timeline, first row
  Year     3000 BC
  Title    The Birth of Kyphi
  Title — Arabic   (empty)
```

### 7a — change and save

| | |
| --- | --- |
| **URL** | `/admin/content/heritage` |
| **Action** | In the first timeline row set **Title** to `The Birth of Kyphi (test)` and **Title — Arabic** to `ولادة الكايفي`. Save. |
| **Expected** | A success toast. No error notice. |

- [ ] Pass  - [ ] Fail — notes:

### 7b — persists across a reload

| | |
| --- | --- |
| **Action** | Hard-reload `/admin/content/heritage` (⌘⇧R). |
| **Expected** | Both new values are still there. |

- [ ] Pass  - [ ] Fail — notes:

### 7c — live on the English page

| | |
| --- | --- |
| **URL** | `/heritage` |
| **Action** | Scroll to **A Timeline of Scent**. |
| **Expected** | The first entry reads `The Birth of Kyphi (test)`. If it still shows the old text, hard-reload once — the page is cached for an hour and the save revalidates it. |

- [ ] Pass  - [ ] Fail — notes:

### 7d — live on the Arabic page

| | |
| --- | --- |
| **URL** | `/ar/heritage` |
| **Action** | Scroll to the timeline. |
| **Expected** | The first entry reads `ولادة الكايفي` — the Arabic you typed, not the English. The page is right-to-left. Before this edit it showed the English title, because an empty Arabic field falls back rather than rendering blank; this proves the Arabic column is now both written and read. |

- [ ] Pass  - [ ] Fail — notes:

### 7e — restore

| | |
| --- | --- |
| **Action** | Set Title back to `The Birth of Kyphi` and clear Title — Arabic. Save. Confirm `/heritage` shows the original text and `/ar/heritage` falls back to English again. |
| **Expected** | Original state restored. |

- [ ] Pass  - [ ] Fail — notes:

---

## 8. Promotion wording

| | |
| --- | --- |
| **URL** | `/admin/promotions` |
| **You should see** | Heading **Promotions**. The button top-right reads **New promotion** — *not* "New campaign". The table's first column header is **Promotion**. One row: `HOLY RAMADAN`. |
| **Action** | Open `HOLY RAMADAN`, then open **New promotion**. |
| **Expected** | On both screens: the section heading is **The promotion**; the two label fields read **Badge label — English** and **Badge label — Arabic**; the submit button reads **Save promotion** / **Create promotion**. The word "campaign" appears nowhere. Hints mention "two promotions", "a promotion stops pricing", "without touching the promotion". |

- [ ] Pass  - [ ] Fail — notes:

---

## 9. Campaign UI wording and Send Specific

Use the **draft**, not a sent one — a sent campaign shows a frozen record instead of the
sending panel.

| | |
| --- | --- |
| **URL** | `/admin/campaigns` → open **OPENING DAY** (status DRAFT) |
| **You should see** | Three panels above the editor: **Audience**, **Named addresses**, **Sending**. Audience has two switches — **Subscribers** (on, "The Inner Circle on the English list — N addresses as selected") and **Customers** (off). Named addresses has an empty list with **+ Add another email**. Sending says "This will write to N addresses. It cannot be undone." and the button reads **Send Campaign**. |
| **Action 1** | Turn **Customers** on. A **Save audience** button appears — click it. |
| **Expected** | Toast. The Sending line's total updates. The Customers switch description now shows a count "not already counted above". |

- [ ] Pass  - [ ] Fail — notes:

| | |
| --- | --- |
| **Action 2** | Add `not-an-email` as a named address and click Save. Then correct it to a real address you own, add it a **second time**, and save again. |
| **Expected** | The invalid address is refused with "That is not a valid email address." The duplicate is refused with "That address is already on the list." Neither saves. |

- [ ] Pass  - [ ] Fail — notes:

| | |
| --- | --- |
| **Action 3** | Leave one valid named address saved, turn **both** audience switches off, save, then press **Send Campaign** — but **click Cancel** at the confirmation. |
| **Expected** | The confirmation names the campaign, lists **Named addresses: 1**, and shows **Total unique recipients: 1** on its own line. Cancel returns without sending. This is the "Send Specific" behaviour: both switches off means only the typed addresses receive it. |

- [ ] Pass  - [ ] Fail — notes:

| | |
| --- | --- |
| **Action 4** | Turn Subscribers back on with the named address still listed, save, and press Send Campaign again — **Cancel** again. |
| **Expected** | The summary lists Subscribers and Named addresses separately, and **Total unique recipients is not necessarily their sum** — an address on both is counted once. Restore the audience to how you found it (Subscribers on, Customers off, named addresses cleared) and save. |

- [ ] Pass  - [ ] Fail — notes:

---

## 10. Console and runtime errors

| | |
| --- | --- |
| **Action** | With DevTools → Console open, revisit each screen above once more. |
| **Expected** | No red errors. Two warnings are known and harmless: Clerk's "development keys" notice, and `next/image` quality/aspect-ratio warnings. A hydration error, a failed Server Action, or a 500 is a real failure — record the message. |

- [ ] Pass  - [ ] Fail — notes:

---

# Known Non-Blocking Items

Recorded deliberately. **Not fixed, and not to be fixed as part of this task.**

1. **EN/AR opening-hours mismatch** — the flagship stockist's Arabic hours read
   `10:00AM–12:00AM` while the English read `Mon–Sat 10:00–20:00`.
2. **Clerk instance-key warning** — the server logs "your Clerk instance keys do not
   match". It did not affect any check performed.
3. **Product embeddings not generated** — `db:verify` notes `0/28 products carry an
   embedding`; `npm run embed` has never been run.
4. **`Testimonial` has no admin editor** — it is database-backed and renders on the home
   page, but is only editable in Supabase directly.

---

# TASK CLOSURE SUMMARY

## Implemented

- **Admin rail** regrouped from seventeen flat rows into Dashboard plus five business
  groups, with a second level for World of KHEM. No route renamed or removed.
- **CMS arranged by page**: `/admin/content` is a hub; Landing Page, World of KHEM, and
  per-page editors for Heritage, Craftsmanship and About. Ingredients and Journal keep
  their existing URLs.
- **Campaign audiences**: migration `0036_campaign_audiences.sql` re-keys
  `campaign_sends` on the address, adds `campaign_recipients` and `email_suppressions`,
  gives every send its own unsubscribe token, and extends the frozen-record trigger.
  UI for audience selection, named addresses and a confirmation summary.
- **Promotion terminology** corrected throughout the Promotions screens.
- **Seed guard**: `npm run db:seed` refuses a non-local database unless its host is named.
- **Gallery editor data-loss bug** fixed — it no longer clears `alt_ar`, `caption` or
  `caption_ar` when saving; the three damaged rows were restored from git history.
- Nine commits on `fix/gallery-editor-field-loss`.

## Verified technically

- Migration applied; 33 structural checks; `db:verify` **38/38**.
- Deduplication proven with a synthetic customer sharing a subscriber's address —
  both audiences selected yields 3 recipients, not 4; a second dispatch claims 0.
- Consent honoured; suppressions subtracted from every source.
- Unsubscribe proven end-to-end in a browser, including a per-send token.
- Validation: invalid addresses, case-duplicates and the 200-address cap all refused.
- Security: every admin route redirects anonymous requests to sign-in in both locales;
  the anon key is refused (`42501`) on all new tables and functions; public content
  still readable.
- Public pages render in EN and AR with RTL.
- Seed history audited across all committed versions — **no historical field loss**;
  the 24 captioned images are the intended set.
- The fixed gallery editor verified against a real reorder performed in the dashboard.
- A real campaign was sent through the UI, exercising the named-address path.

## Requires your browser

Checks 1–10 above: the rail, the five Content screens, the edit→save→live round trip in
both languages, promotion wording, campaign wording and Send Specific, and console
cleanliness.

## Explicitly deferred

Not built, by agreement:

- **Editable SEO** (Phase 9) — no per-page title/description/OG fields anywhere.
- **Per-section Landing Page editing** (Phase 3) — the screen maps the home page and
  names what is code-owned; hero, intro and CTA copy still need a developer.
- **Hero and SEO fields** on the World of KHEM pages.
- **Content → Navigation and Global/SEO Content** (Phase 2) — nothing to edit until the
  dictionary copy is migrated.
- **Analytics sub-pages** — deliberately not created; the brief forbids empty pages.
- **An EN|AR admin language switcher** (Phase 8) — the existing paired-field pattern is
  used instead, as the brief asks that no second translation system be introduced.

Two deviations from the brief, both exercised in a real send and left in place:
Send Specific is additive (both switches off = only typed addresses) rather than a
separate mode, and the button reads **Send Campaign** rather than "Send Subscribers",
which is no longer accurate.
