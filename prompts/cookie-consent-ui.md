# Cookie Consent — Banner, Preferences Panel & Consent Store

## Goal

Ship a production-grade cookie consent experience for KHEM: a non-blocking,
bottom-anchored consent banner with an inline preferences panel, backed by a
persisted consent record, fully localised (EN/AR + RTL), and reopenable from the
footer. Motion and typography must read as luxury editorial, not as a generic
GDPR widget.

## Skills read

- None of `.agents/skills/{clerk,supabase,ai-sdk}` apply — this feature touches
  no auth, no database, and no AI. The `ai-sdk` / `chat-sdk` skills auto-suggested
  by the prompt hook matched lexically ("cookie" ↔ "chat") and are irrelevant;
  deliberately skipped.
- Existing project patterns used instead, per AGENTS.md §4.

## Existing code inspected

| File | What it establishes |
| :--- | :--- |
| `src/lib/storage.ts` | Guarded `localStorage` access, versioned keys, type-guard validation of untrusted stored blobs, cross-tab `storage` subscription. |
| `src/lib/persistent-store.ts` | `createPersistentStore()` — `useSyncExternalStore`-shaped store; `getServerSnapshot` returns the empty value so SSR and hydration agree. |
| `src/hooks/use-is-hydrated.ts` | `useIsHydrated()` — `false` on server + hydration render, `true` after. |
| `src/providers/wishlist-provider.tsx` | The exact provider shape to mirror: module-level store, stable module-level mutators, `useMemo` context value, throwing `use*` hook. |
| `src/providers/i18n-provider.tsx` | `useDictionary()`, `useLocale()`, `useDir()`. |
| `src/app/[locale]/layout.tsx` | Provider nesting order: Clerk → I18n → Cart → Wishlist → Nav / children / Footer. |
| `src/components/search/SearchOverlay.tsx` | Overlay conventions: stays mounted + `inert` when closed, logical `start`/`end` anchoring, explicit RTL transform handling, focus management inside `requestAnimationFrame`. |
| `src/components/animation/Reveal.tsx` | Motion contract: `motion/react` behind a `"use client"` boundary, tween only, `EASE_LUXURY = [0.16, 1, 0.3, 1]`, `useReducedMotion()` renders the final state instantly. |
| `src/components/Footer.tsx` (L64–67, L193) | `legalLinks` array where the "Cookie Settings" trigger will join Privacy / Terms / Cookie Policy. |
| `src/data/legal.ts` (L511–620) | The published Cookie Policy — **the source of truth for the categories**: Essential (cannot be switched off), Preferences, Analytics. No advertising cookies, no ad networks. |
| `src/lib/i18n/dictionaries/en.ts` / `ar.ts` | Dictionary shape; `Dictionary` type is inferred from `en.ts`, so `ar.ts` must gain identical keys. |
| `src/app/globals.css` | `@theme` tokens: `--color-gold`, `--color-champagne`, `--color-ivory`, `--color-surface`, `--color-border-gold`, `--shadow-luxury`, `--ease-luxury-bezier`. |
| z-index survey | `z-998` mega-menu scrim, `z-1000` nav + mobile scrim, `z-1001` mobile drawer, `z-1099/1100` search overlay. The banner takes **`z-990`** — above page content, beneath every nav/search surface. |

## Decisions & assumptions

1. **Three categories, mirroring the published policy exactly**: `essential`
   (always on, non-toggleable), `preferences`, `analytics`. Inventing a fourth
   (e.g. marketing) would contradict `src/data/legal.ts`, which states plainly
   that KHEM runs no advertising cookies.
2. **Persisted to `localStorage`, not to a cookie.** Nothing on the server reads
   consent today — there are no analytics or marketing scripts to gate at SSR
   time — and `createPersistentStore` already solves the hydration, validation,
   and cross-tab problems. A cookie would additionally be sent on every request
   for no benefit. Documented in the module so a future server-gated script can
   revisit it deliberately.
3. **Versioned consent record.** Stored shape carries `version`; bumping
   `CONSENT_VERSION` invalidates old records and re-prompts, which is what a
   policy change legally requires. A record with a different version is treated
   as "no decision yet".
4. **Non-blocking, non-modal.** No scrim, no focus trap, no scroll lock. The
   banner is a `role="region"` landmark (not `role="dialog"`) so a visitor can
   keep browsing and reading the linked policy before deciding. This is both
   the better luxury UX and avoids the dark pattern of holding the site hostage.
5. **No dismiss-as-consent.** There is no bare "×". The three exits are
   **Accept All**, **Decline** (essential only), and **Save Preferences** from
   the expanded panel. `Escape` is *not* wired to dismiss, because a silent
   dismissal would leave the consent record ambiguous.
6. **Appearance delay of 900 ms** after hydration, so the banner arrives after
   the page has settled rather than competing with the hero — deliberate, not
   accidental. Reduced-motion users get it immediately with no transition.
7. Consent is read by nothing yet. The provider exposes `consent.analytics` /
   `consent.preferences` as the future gate; wiring an analytics script is out of
   scope for this task.

## Files likely to change

**New**

- `src/lib/consent.ts` — consent types, `CONSENT_STORAGE_KEY`, `CONSENT_VERSION`,
  the `isStoredConsent` type guard, `ESSENTIAL_ONLY` / `ALL_ACCEPTED` constants.
- `src/providers/consent-provider.tsx` — `ConsentProvider`, `useConsent()`.
- `src/components/consent/CookieConsent.tsx` — banner + inline preferences panel.
- `src/components/consent/ConsentToggle.tsx` — the gold switch primitive.
- `src/components/consent/CookieSettingsButton.tsx` — footer trigger that reopens
  the panel.

**Modified**

- `src/app/[locale]/layout.tsx` — mount `<ConsentProvider>` and `<CookieConsent />`.
- `src/components/Footer.tsx` — add the "Cookie Settings" trigger to the legal row.
- `src/lib/i18n/dictionaries/en.ts` — new `cookieConsent` block.
- `src/lib/i18n/dictionaries/ar.ts` — the same keys in Arabic.

## Implementation requirements

### `src/lib/consent.ts`

```ts
export const CONSENT_STORAGE_KEY = "khem.consent.v1";
export const CONSENT_VERSION = 1;

export type ConsentCategory = "preferences" | "analytics";

export interface ConsentRecord {
  version: number;
  /** Epoch ms of the decision — shown in the reopened panel. */
  decidedAt: number;
  preferences: boolean;
  analytics: boolean;
}
```

- `isStoredConsent(value: unknown): value is ConsentRecord` — rejects anything
  that is not an object with `version === CONSENT_VERSION`, a finite positive
  `decidedAt`, and two booleans. A stale-version or malformed blob resolves to
  `null`, i.e. "undecided", per `storage.ts` conventions.
- `null` is the empty value of the store (no decision recorded).
- No React, no Next imports — importable anywhere.

### `src/providers/consent-provider.tsx`

- `"use client"`. Mirror `wishlist-provider.tsx` structurally.
- Module-level `createPersistentStore<ConsentRecord | null>(CONSENT_STORAGE_KEY, isStoredConsent, null)`.
- Module-level mutators `accept(prefs)` / `decline()` so the context value stays
  referentially stable.
- Context value:
  ```ts
  interface ConsentContextValue {
    record: ConsentRecord | null;
    /** `true` once a valid, current-version record exists. */
    hasDecided: boolean;
    isHydrated: boolean;
    /** Banner visibility, incl. reopen-from-footer. */
    isOpen: boolean;
    acceptAll: () => void;
    declineAll: () => void;
    save: (choices: Record<ConsentCategory, boolean>) => void;
    open: () => void;
    close: () => void;
  }
  ```
- `isOpen` = `isHydrated && (!hasDecided || wasReopened)` — `wasReopened` is
  local `useState`, reset by `close()` and by any of the three commit actions.
- Every commit writes `version: CONSENT_VERSION` and `decidedAt: Date.now()`.
- Cross-tab: inherited free from `createPersistentStore` — accepting in one tab
  dismisses the banner in the other.
- Throwing `useConsent()` hook, matching the wishlist/i18n precedent.

### `src/components/consent/CookieConsent.tsx`

**Structure**

```
fixed inset-x-0 bottom-0 z-990  (pointer-events-none wrapper)
└── mx-auto w-full max-w-5xl px-4 pb-4 sm:px-6 sm:pb-6  (pointer-events-auto)
    └── article  — the card
        ├── hairline gold top rule (gradient, transparent → gold/50 → transparent)
        ├── header row: Cinzel title + lede paragraph
        ├── collapsible preferences panel (three rows)
        └── action row: Decline · Manage / Hide · Accept All | Save Preferences
```

**Card surface**

- `bg-[color-mix(in_srgb,var(--color-surface)_92%,transparent)] backdrop-blur-xl`
- `border border-border-gold/40`, `rounded-lg` (`--radius-lg`), `shadow-luxury`
- Inner padding `p-6 sm:p-8`; generous line-height on the lede.

**Typography**

- Eyebrow: `font-body text-[0.65rem] uppercase tracking-[0.3em] text-gold`.
- Title: `font-heading text-lg sm:text-xl tracking-[0.12em] text-ivory`.
- Body: `font-body text-sm leading-relaxed text-ivory/65`, `max-w-2xl`.
- Buttons: uppercase, `tracking-[0.2em]`, `text-[0.7rem]`, per the
  `<LuxuryButton />` aesthetic in AGENTS.md §11 (there is no shared button
  component in the repo yet — style locally, do **not** invent a new primitive
  unless it is reused here more than twice).

**Buttons**

- *Accept All* — gold fill (`bg-gold text-black`), hover `bg-champagne` with a
  soft gold glow (`shadow-gold`), `duration-500 ease-out`.
- *Decline* — ghost: transparent, `border border-white/12`, hover
  `border-gold/50 text-gold`. Visually equal in weight to Accept (no dark
  pattern: the reject path must be one click, same prominence tier).
- *Manage preferences* — plain text button with a gold underline that grows from
  the logical start edge on hover; chevron rotates 180° on expand.

**Preferences panel**

- Expands **inline inside the card**, not as a second modal — one continuous
  surface, no stacked layers.
- Animate with Motion `height: 0 → "auto"` + `opacity`, `duration 0.5`,
  `EASE_LUXURY`, `overflow-hidden`. Under `useReducedMotion()`, render expanded
  state with no transition.
- Three rows, each: label (Cinzel, small caps) + one-line description
  (`text-ivory/55`) + the toggle, separated by `divide-y divide-white/[0.06]`.
- Essential row: toggle rendered `checked` + `disabled`, with a small
  `text-gold/70` "Always active" tag replacing the interactive control.
- When reopened with an existing record, initialise the toggles from
  `record`, and show a footnote: "Last updated {date}" using the locale-aware
  formatter conventions already used in `src/lib/format.ts`.

**Motion (entry/exit)**

- `AnimatePresence` + `motion.div`: `initial {opacity: 0, y: 32}` →
  `animate {opacity: 1, y: 0}` → `exit {opacity: 0, y: 24}`.
- `duration: 0.7` in, `0.45` out, `ease: [0.16, 1, 0.3, 1]`. **Zero spring, zero
  bounce** (AGENTS.md §2.2).
- Reduced motion: opacity-only crossfade at `duration: 0.2`, no travel.
- 900 ms entry delay via a cleaned-up `setTimeout` in an effect (skipped entirely
  when reopened from the footer — that must feel instant).

**Accessibility**

- Wrapper `role="region"` + `aria-label` from the dictionary; the card
  `aria-labelledby` the title id (`useId()`).
- Toggles are real `<button role="switch" aria-checked>` elements with visible
  `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/60`
  rings — never the default webkit ring.
- On open, move focus to the card only when reopened from the footer (a
  deliberate user action); the first-visit banner must **not** steal focus.
- Every interactive element reachable by keyboard in DOM order; no focus trap.

**RTL**

- Logical properties throughout (`ps-*`, `pe-*`, `text-start`, `justify-end`
  with flex `flex-row-reverse` avoided in favour of logical ordering).
- The `y`-axis entry transform is direction-agnostic, so no RTL transform
  mirroring is needed — unlike the search drawer. State that in a comment so the
  next reader does not "fix" it.
- Verify the Arabic build with `dir="rtl"`: chevron rotation, underline growth,
  and the divider rhythm must all mirror correctly.

**Responsiveness**

- ≤ 640 px: full-width card flush to the bottom with `pb-4`; buttons stack
  full-width in a `flex-col-reverse` so *Accept All* sits under the thumb.
- ≥ 640 px: buttons inline, right-aligned to the logical end.
- ≥ 1024 px: card capped at `max-w-5xl`, centred, `pb-6`.
- Nothing may overlap the fixed nav; nothing may cause CLS — the banner is
  `fixed`, so it never participates in document flow.

### `src/components/consent/CookieSettingsButton.tsx`

- `"use client"`, calls `useConsent().open()`.
- Styled to match the existing footer legal links exactly (same size, colour,
  hover) so the row reads as four peers, not three links and a button.

### Dictionary (`cookieConsent` block, EN + AR)

```
eyebrow, title, body, acceptAll, decline, managePreferences, hidePreferences,
savePreferences, regionLabel, lastUpdated (with {date} placeholder),
policyLink, alwaysActive,
categories: {
  essential: { name, description },
  preferences: { name, description },
  analytics: { name, description },
}
```

- English copy must echo the tone of `src/data/legal.ts` — plain, confident,
  editorial. Explicitly reuse the policy's own claim that KHEM runs no
  advertising cookies; it is a genuine differentiator and belongs in the banner.
- Arabic must be a real translation in the register used elsewhere in `ar.ts`,
  not transliteration.
- `{date}` interpolation goes through `src/lib/i18n/interpolate.ts`.
- Include a `LocaleLink` to `/cookie-policy` inside the body copy.

### Layout & Footer wiring

- `<ConsentProvider>` nests inside `<I18nProvider>` (it needs the dictionary
  downstream) and outside `<CartProvider>`; `<CookieConsent />` renders as the
  last child, after `<Footer />`.
- Footer gains the settings trigger in the `legalLinks` row without disturbing
  the existing spacing or separators.

## Security requirements

- Stored consent is untrusted input: it passes through `isStoredConsent` before
  reaching state — a crafted blob must degrade to "undecided", never crash a
  render (`storage.ts` doctrine).
- No `dangerouslySetInnerHTML` anywhere in the banner, including the policy link
  inside body copy — compose it from JSX nodes.
- No third-party script, no network call, no PII collected or transmitted. The
  record holds two booleans, a version, and a timestamp.
- The `/cookie-policy` href is built through `LocaleLink` → `localizePath`, which
  already rejects protocol-relative and off-origin paths.
- Zero `any`; strict TypeScript throughout.

## Acceptance criteria

- [ ] First visit: banner fades up 900 ms after load; no CLS; page fully usable
      behind it.
- [ ] *Accept All* → record `{version:1, preferences:true, analytics:true}`
      persisted; banner exits smoothly and does not return on reload.
- [ ] *Decline* → both categories `false`, persisted, banner gone.
- [ ] *Manage preferences* expands inline with a smooth height transition; per
      category toggles work; *Save Preferences* persists exactly what is shown.
- [ ] Essential row is visibly locked and cannot be toggled.
- [ ] Footer "Cookie Settings" reopens the panel instantly (no delay), pre-filled
      from the stored record, showing the last-updated date.
- [ ] Accepting in one tab dismisses the banner in a second open tab.
- [ ] A corrupt or stale-version `khem.consent.v1` value re-prompts rather than
      throwing.
- [ ] `prefers-reduced-motion: reduce` → no travel, no height animation.
- [ ] Arabic (`/ar`) renders mirrored and correctly translated; no clipped text.
- [ ] Keyboard-only: every control reachable and operable, visible gold focus
      rings, no trap; screen reader announces the region and switch states.
- [ ] Banner sits above content but below nav drawer (`z-1001`) and search
      overlay (`z-1100`).
- [ ] 320 px, 768 px, 1440 px all clean.

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three must pass with zero errors and no new warnings.

## Manual test steps

1. `npm run dev`, open `http://localhost:3000` in a **fresh private window**.
2. Confirm the banner rises ~1 s after load; scroll the page — it stays put and
   the page scrolls normally underneath.
3. Click *Manage preferences*; confirm the smooth inline expansion, the locked
   Essential row, and two working toggles.
4. Toggle Analytics off, Preferences on, *Save Preferences*. In DevTools →
   Application → Local Storage, confirm `khem.consent.v1` holds
   `{"version":1,"decidedAt":…,"preferences":true,"analytics":false}`.
5. Reload — no banner.
6. Scroll to the footer, click *Cookie Settings*: the panel reopens immediately
   with the saved toggle states and a last-updated date.
7. Open a second tab, click *Accept All* there, return to the first tab — its
   banner is gone.
8. In Local Storage, replace the value with `{"version":0}` and reload — the
   banner returns.
9. Visit `http://localhost:3000/ar` in a fresh private window; verify Arabic copy,
   RTL mirroring, and that the chevron and underline animate on the correct side.
10. Enable *Reduce motion* (macOS System Settings → Accessibility → Display) and
    reload — the banner appears with no travel and the panel expands instantly.
11. Tab through the banner with the keyboard only; confirm gold focus rings,
    `Space`/`Enter` on the switches, and that `Tab` escapes into the page.
12. Open the mobile nav drawer and the search overlay with the banner visible —
    both must render above it.
13. Throttle to *Slow 4G* + Lighthouse on `/`: Performance ≥ 95, Accessibility 100,
    no CLS regression versus the pre-change baseline.
```
