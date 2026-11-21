# Umami — count every visitor (cookieless analytics, no consent gate)

## Goal

Umami currently loads only after a visitor turns on Analytics in the cookie
banner, so visitors who decline or never answer are invisible. Umami sets no
cookies and stores no personal data, so the house has decided to count every
visit regardless of the banner. Every privacy protection that `UmamiAnalytics`
already applies stays exactly as it is.

This follows `prompts/umami-analytics.md`, which shipped the consent-gated
version, and reverses its Decision §4 on purpose.

## Skills read

- `AGENTS.md` (§2 workflow, §8 revalidation, §9 migrations, §12 checklist).
- No `.agents/skills/*` apply: there is no auth, no AI and no Supabase API
  change. One data migration follows the existing `supabase/sql/` convention.
  The prompt hook auto-suggested Vercel AI SDK / AI Gateway skills, which are
  irrelevant here and were skipped.

## Existing code inspected

| File | Finding |
| :--- | :--- |
| `src/components/analytics/UmamiAnalytics.tsx` | Gate is `isHydrated && record?.analytics === true`, plus a `gate.granted` check inside `beforeSend` |
| `src/lib/analytics/umami.ts` | `shouldSendPath()`, `EXCLUDED_PATH_PREFIXES` (`/admin`, `/account`, `/sign-in`, `/sign-up`, `/unsubscribe`). Unchanged |
| `src/lib/consent.ts`, `src/providers/consent-provider.tsx` | `ConsentCategory = "preferences" \| "analytics"`. `CONSENT_CATEGORIES` drives the banner's toggles. **Umami is the only reader of `record.analytics`; nothing else on the site is consent-gated** (no pixels, no other tags) |
| `src/components/consent/CookieConsent.tsx` L311–330 | Maps `CONSENT_CATEGORIES` to toggles, with `copy.categories[category]` |
| `src/lib/i18n/dictionaries/{en,ar}.ts` `cookieConsent` | `body` says cookies help "understand which pages are read". `categories.analytics` holds the toggle copy |
| `supabase/seed/directory.json` → `legalDocuments[cookie-policy]` | Mirrors the live row. EN+AR "How We Use Them" table lists **three** categories including Analytics. "Managing Cookies" mentions "analytics cookies". `updatedAt` is `2026-08-09` |
| `supabase/sql/0003`, `0008` | `"LegalDocument"(sections jsonb, sections_ar jsonb, "updatedAt" date)`. The migration convention for 0073+ is "applied directly, single transaction" (header of `0079`) |
| `app/[locale]/cookie-policy/page.tsx` | `revalidate = 604800` (7 days). An admin save revalidates it; a migration does not. A redeploy re-prerenders it |
| Other legal documents | No mention of analytics or cookies, so they don't change |
| `scripts/*.test.ts` | Repo test convention: `node:test` + `assert/strict`, run with `npx tsx --test scripts/*.test.ts` |
| Umami v3.5.0 tracker source (`src/tracker/index.ts`) | **No `document.cookie`, no `setItem`, no `sessionStorage`, no IndexedDB.** The only storage access is one *read*, `localStorage.getItem('umami.disabled')`, an operator opt-out switch. Session replay (`recorder.js`) is never loaded |

## Decisions (user-confirmed on 2026-11-21)

1. **Umami ignores consent.** The tracker loads on every page of the `[locale]`
   tree, whatever the stored decision is: none, declined or accepted.
2. **The banner's Analytics toggle is removed.** It would control nothing. The
   banner shows Essential (locked) and Preferences only.
   - The stored record keeps its `analytics` field and `CONSENT_VERSION` stays
     1, so **no visitor is re-prompted** and every stored record stays valid.
   - The field becomes inert and is documented as reserved for a future
     cookie-setting tool, which would bring the toggle back and bump the version.
3. **`/checkout` stays counted.** Its URL holds no personal data, because query
   strings are stripped. `EXCLUDED_PATH_PREFIXES` is unchanged.
4. **Every protection stays:**
   - `data-exclude-search` and `data-exclude-hash`
   - the excluded-path filter and the scrubbing of excluded referrers
   - `data-domains` (no localhost)
   - `data-do-not-track`: a DNT browser is still not counted. That is a privacy
     protection, and the user asked to keep them all.
   - the `/hk.js` and `/api/hk` first-party paths
   - the nginx IP-header hardening
   - no `identify()`

   No nginx or Docker file changes.
5. **The other consent-gated scripts are untouched.** There are none today; the
   Preferences category and the banner mechanics are unchanged.
6. **The Cookie Policy changes through a guarded data migration**, not by
   overwriting admin edits. `0080_cookie_policy_cookieless_analytics.sql`
   replaces `sections` and `sections_ar` **only if both still equal the seeded
   text exactly**. If an admin has edited the policy since, it changes nothing,
   raises a `NOTICE`, and the runbook tells the operator to make the same edit in
   the admin legal editor. `supabase/seed/directory.json` is updated to the same
   content so a fresh seed agrees.
7. A note for the record, not a blocker: the tracker *reads* one localStorage
   key (`umami.disabled`) and never writes. That read is the opt-out mechanism
   itself, and it is documented in the runbook.

## Files likely to change

- `src/components/analytics/UmamiAnalytics.tsx`:
  - remove `useConsent`, `useLayoutEffect` and the `gate` object
  - render the `<Script>` whenever `isUmamiConfigured()`
  - `beforeSend` keeps the path filter and the referrer scrub, but no longer
    checks consent
  - rewrite the doc comment
- `src/app/[locale]/layout.tsx`: move `<UmamiAnalytics />` out of
  `<ConsentProvider>`, just inside `<SessionProvider>` / `<I18nProvider>` or
  directly in `<body>`, since it no longer needs the context. Update the comment.
- `src/lib/consent.ts`:
  - add `BANNER_CATEGORIES` (`["preferences"] as const`), the toggles the banner
    shows
  - `CONSENT_CATEGORIES` and the record shape are unchanged
  - comments: Analytics is a stored, reserved field. Umami does not read it.
- `src/providers/consent-provider.tsx`: comment only. Nothing reads
  `record.analytics`, and Umami deliberately does not.
- `src/components/consent/CookieConsent.tsx`: map `BANNER_CATEGORIES` instead of
  `CONSENT_CATEGORIES`. The `analytics` value in the draft passes through
  untouched: Accept All still writes `true`, Decline writes `false`, Save keeps
  whatever was stored.
- `src/lib/i18n/dictionaries/en.ts`, `ar.ts`:
  - remove `cookieConsent.categories.analytics`
  - reword `body` and `bodyShort` so analytics is no longer described as a
    cookie use. Example EN body: "We use a small number of cookies to keep your
    bag intact and remember your preferences. Visits are counted anonymously,
    without cookies. We run no advertising cookies and work with no ad networks.
    Your browsing is never sold or shared."
  - `ar.ts` mirrors it, and the `Dictionary` type stays identical across both.
- `supabase/sql/0080_cookie_policy_cookieless_analytics.sql` (**new**): the
  guarded update above, with `"updatedAt" = '2026-11-21'`, in a single
  transaction. No schema change, so no PostgREST reload is needed, though it is
  harmless.
- `supabase/seed/directory.json`: the cookie-policy entry gets the same new
  sections (EN+AR) and `updatedAt`.
- `scripts/umami-analytics.test.ts` (**new**, `node:test`):
  - the 14 `shouldSendPath` cases from the previous task, verbatim
  - `beforeSend`: an excluded page is dropped, an excluded referrer is blanked,
    and a public page is returned unchanged
  - **Consent-independence:** the component's load decision is extracted as a
    pure `shouldLoadUmami(): boolean` in `umami.ts`. The test asserts it is
    `true` when configured, for each consent state (none, declined, accepted).
    It takes no consent input, so the test pins that it never will.
  - A source guard asserts `UmamiAnalytics.tsx` does not import
    `consent-provider` or `useConsent`. That is the regression this change must
    not undo.
  - `beforeSend` and `shouldLoadUmami` move into `umami.ts`, so they are
    testable without React.
- **Browser verification** (performed during implementation, not committed): run
  `next dev` with a placeholder website ID, use a headless browser (the
  agent-browser CLI, if available), and confirm a `/hk.js` request:
  1. on first load with the banner unanswered
  2. after **Decline** + reload
  3. after **Accept** + reload

  Also confirm `document.cookie`, `localStorage` and `sessionStorage` gain no
  Umami entries. If no headless browser is available, say so; the manual
  DevTools steps below cover it.
- `src/docs/umami-analytics.md`:
  - "What is and is not counted" (the trade-offs section): every visitor except
    DNT, no consent gate, and why that is acceptable. The `umami.disabled` read
    is mentioned.
  - "Health checks": the browser steps become: tracker requested before any
    answer, after Decline and after Accept; nothing on excluded pages; no
    cookie or storage entries.
  - "First-time setup" step 9 now points at migration 0080.
- `prompts/umami-analytics.md`: a one-line note under Decision §4:
  "Superseded 2026-11-21 by `prompts/umami-count-every-visitor.md`."
- `AGENTS.md` §6 Analytics row: "Consent-gated" becomes "Cookieless, counts every
  visit (not consent-gated)".

## New Cookie Policy content

**EN:**
- "How We Use Them": "Two categories, and no others:", with table rows
  Essential and Preferences (the Analytics row is removed).
- New section after it, `id: "visitor-statistics"`, title "Visitor Statistics,
  Without Cookies":
  - text: "We count visits with Umami, a cookieless, privacy-friendly analytics
    tool that we run on our own server in Germany. It collects anonymous visit
    statistics — which pages are read, which website referred you, your
    country, and your type of device and browser — without cookies and without
    personal data. It stores nothing on your device, keeps no IP address, and
    cannot recognise you here or on any other website."
  - note: "Because it uses no cookies, Umami is not affected by your choice in
    the cookie banner — it counts every visit the same way. It never sees your
    account, your orders or anything you type, and nothing it collects is shared
    with anyone. If your browser sends a Do Not Track signal, your visits are not
    counted at all."
- "Managing Cookies", second paragraph: "Blocking preference cookies costs you
  nothing but a little convenience. …"

**AR:** the same three edits, translated in the register of the existing
Arabic text (e.g. "فئتان، لا غير:" and "إحصاءات الزيارات، بلا ملفات تعريف
ارتباط").

## Security & privacy requirements

- No new data is collected. Only *who* is counted changes, not *what*.
- The excluded paths, query/hash stripping, DNT, domain lock, first-party paths
  and IP-header hardening are all unchanged and covered by the test.
- No cookie or web-storage write by Umami. Verified in source and checked in the
  browser.
- The migration cannot overwrite an admin's edit (exact-match guard).

## Acceptance criteria

1. With a website ID configured, `/hk.js` is requested on first load with the
   banner unanswered, after Decline, and after Accept.
2. `/admin`, `/account`, `/sign-in`, `/sign-up` and `/unsubscribe` (both locales)
   send no `POST /api/hk`. `/checkout` does. URLs carry no query string.
3. After a visit, `document.cookie`, `localStorage` and `sessionStorage` hold no
   Umami entry.
4. The banner shows Essential and Preferences only. A visitor with an existing
   stored decision is **not** re-prompted.
5. The Cookie Policy (EN and AR) reads as specified once 0080 is applied and the
   site redeployed.
6. `npx tsc --noEmit`, `npm run lint`, `npx tsx --test scripts/*.test.ts` and
   `npm run build` all pass, and the `[locale]` pages are still ● SSG.
7. Nothing is committed.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npx tsx --test scripts/*.test.ts
npm run build
```

## Manual steps after implementation

**Local (DevTools):**
1. `.env.local`: `NEXT_PUBLIC_UMAMI_WEBSITE_ID=00000000-0000-0000-0000-000000000000`,
   then `npm run dev`.
2. Private window → DevTools → Network, filter `hk`, "Preserve log" on.
3. Load `/` without touching the banner. `hk.js` should be requested. It is a
   404 locally (no nginx), which is expected, and localhost never posts.
4. Click **Decline**, then reload. `hk.js` is requested again.
5. Application tab → Cookies / Local Storage / Session Storage: no Umami entry.
6. Open Cookie Settings. Only Essential and Preferences are shown.
7. Remove the env line when you are done.

**Production:**
1. Apply `supabase/sql/0080_cookie_policy_cookieless_analytics.sql` (SQL editor
   or `psql`, single transaction).
   - If it prints the "edited since seeding" `NOTICE`, make the same edits in
     `/admin` → legal pages instead.
2. Deploy (`deploy.sh`). The rebuild re-prerenders `/cookie-policy` and ships the
   new tracker behaviour.
3. In a private window on the live site, with Network filtered to `hk`, you
   should see `hk.js` followed by `POST /api/hk` without answering the banner.
   The Umami Realtime view shows the visit.
