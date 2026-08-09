# Prompt — Transform `/contact` into a Next.js route + centralize its data

## Goal

Same transformation as `/about`, `/heritage`, `/journal`, `/ingredients`, with one addition specific to this page: **it is not a route at all today.** The file sits at `src/contact/page.tsx`, outside the App Router tree, so `/contact` 404s.

1. Move it to `src/app/contact/page.tsx` and delete `src/contact/`.
2. Rewrite as a Server Component (theme tokens, `<Reveal />`, `metadata`, `revalidate`, responsive layout).
3. Move every hardcoded record — boutique address, email, telephone, hours, enquiry subjects, social profiles — into the data centre (`src/data/` → `src/types/` → `src/services/`).
4. Isolate the form into a `'use client'` component with real validation, accessible labels, and error reporting.

---

## Skills read

- `AGENTS.md` — §1 rules, §2 design language, §3.2 input/button aesthetics, §5 prompt files, §6 stack, §7 structure, §11 component standards, §12 checklist.
- No `.agents/skills/*` applies: no Clerk, no Supabase call, no AI SDK. (Session hook suggested `vercel-agent` on keyword match — not relevant.)
- Prior prompts `prompts/about-page-nextjs-transform.md` and `prompts/heritage-journal-ingredients-nextjs-transform.md` — same transformation, reused where it applies.

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/contact/page.tsx` | 158 lines. **Outside `src/app/`** → not routable. `useState` with no `'use client'`. Two module-scope `React.CSSProperties` objects. Two inline record arrays (contact details, social links) and an inline subject list. Focus styling applied by mutating `e.currentTarget.style` in `onFocus`/`onBlur`. Submit is `setSent(true)` — no validation, no transport. |
| `src/components/home/NewsletterForm.tsx` | **The precedent for forms in this repo:** client component, `noValidate`, regex email check, `aria-invalid` + `aria-describedby`, error paragraph in `text-danger`, success block with `role="status"`, and a TODO naming the future Zod schema + Server Action + Resend. |
| `src/components/Footer.tsx` | Has its own `socialLinks = ["Instagram", "Facebook", "Pinterest"]` — a *different* platform list from this page (Instagram, Pinterest, TikTok) and without handles. |
| `src/services/content.ts` | Query-layer pattern: `async`, returns the exact projection, carries its future Supabase query as a comment. `ALL_FILTER` + `toFilterOptions` helpers live here. |
| `src/data/content.ts`, `src/data/products.ts` | Data centre is split by domain, one file per domain. |
| `package.json` | **No `zod`, no `resend`, no `@prisma/client`, no `@supabase/supabase-js`.** |
| `src/app/globals.css` | `.eyebrow`, `.gold-line`, `.btn-luxury`, `.btn-luxury-fill` available; `--color-danger` token defined. |

### Defects to fix

1. **File is not a route** — must move under `src/app/`.
2. `useState` in a file with no `'use client'`.
3. Focus ring implemented by mutating `.style.borderColor` on focus/blur — must be `focus:border-gold` CSS, which also removes JS from the styling path.
4. Same for the `onMouseEnter`/`onMouseLeave` color mutation on the email link.
5. **`<label>` elements have no `htmlFor` and inputs have no `id`** — clicking a label does nothing and screen readers announce the fields unlabelled. Also no `name`, no `autoComplete`.
6. **Submit does nothing and validates nothing** — `setSent(true)` fires even on an empty message, and the user's typed message is silently discarded.
7. `inputStyle` / `labelStyle` `CSSProperties` objects + inline `style` on every element; raw hexes throughout; `fontFamily: "'Cinzel', serif"` bypassing `--font-heading`.
8. Not responsive: `padding: '100px 80px'`, `gridTemplateColumns: '1fr 1fr'` and `'1fr 500px'` with no breakpoints.
9. `paddingTop: '80px'` hardcodes the Nav height into the page.
10. Social links point at `href="#"` — a placeholder that is also a no-op for keyboard users.
11. No `metadata`, no `revalidate`.
12. The success state replaces the form entirely with no `role="status"`, so the change is not announced.

---

## Decisions and assumptions

1. **New data domain, not an extension of `content.ts`.** Contact details are not editorial content, so they get their own trio: `src/data/contact.ts`, types in `src/types/contact.ts`, queries in `src/services/contact.ts`. This mirrors the existing `products` / `content` split.

2. **New types:** `ContactChannel { id, label, value, href | null }` (`value` keeps its `\n` line breaks, rendered with `whitespace-pre-line`), `SocialProfile { id, platform, handle, url }`, and `EnquirySubject` as a plain `string[]`.

3. **New service functions**, each carrying its future Supabase query comment: `getContactChannels()`, `getSocialProfiles()`, `getEnquirySubjects()`.

4. **Form validation follows the `NewsletterForm` precedent, not a new dependency.** AGENTS.md §6 mandates Zod, but `zod` is not installed and adding a dependency is outside what this task authorizes. The form therefore validates client-side (required fields + the same email pattern) and carries an explicit TODO naming the future `schemas/contact.ts` + `actions/contact.ts` + Resend wiring — identical in shape to the newsletter TODO. **Flagged: installing `zod` and adding the Server Action is the natural follow-up, and the message is not transmitted or stored until then.** The success copy already says "We will respond within 24 hours", which will only be true once that wiring exists.

5. **Client boundary:** only `src/components/contact/ContactForm.tsx`. The header, contact-details column, consultation card, and social list stay Server Components.

6. **Caching:** `export const revalidate = 3600`, matching the other editorial routes.

7. **Copy, addresses, and handles preserved verbatim**, including `enquiries@khemfragrance.com`, `concierge@khemfragrance.com`, `+20 11 234 5678`, and the Place Vendôme boutique address. The `href="#"` social URLs are kept as-is (no real profile URLs exist to substitute) but each link gets `aria-label` text naming the platform.

8. **`Footer.tsx` is left alone.** It lists a different set of platforms (Facebook rather than TikTok) and no handles; making it consume `getSocialProfiles()` would change what the footer displays, which is a content decision the task does not cover. Flagged as a follow-up.

9. **Color mapping** as in the previous prompts; `rgba(255,255,255,0.03)` field fill → `bg-ivory/3`, `#111` panels → `bg-surface`, error text → `text-danger`.

---

## Files likely to change

| File | Change |
| :--- | :--- |
| `src/contact/page.tsx` | **deleted** (directory removed) |
| `src/app/contact/page.tsx` | new — Server Component page |
| `src/components/contact/ContactForm.tsx` | new — client component |
| `src/types/contact.ts` | new — `ContactChannel`, `SocialProfile` |
| `src/data/contact.ts` | new — `CONTACT_CHANNELS`, `SOCIAL_PROFILES`, `ENQUIRY_SUBJECTS` |
| `src/services/contact.ts` | new — three query functions |

No dependency, schema, middleware, route-handler, or `next.config.ts` change.

---

## Implementation requirements

### `src/app/contact/page.tsx` (Server Component)
- `export const metadata` (title `"Contact"`, description, `alternates.canonical`, `openGraph`) + `export const revalidate = 3600`.
- Awaits `getContactChannels()`, `getSocialProfiles()`, `getEnquirySubjects()` via `Promise.all`.
- **Header:** `border-b border-border`, radial gold wash via a `pointer-events-none absolute inset-0` div using `bg-[radial-gradient(...)]` with `--color-gold` through `color-mix`, matching the home hero's idiom. Grid `grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20`. Left: eyebrow "We Are Here", `<h1>` "Contact / KHEM" (second line `text-gold`), `gold-line`, intro copy. Right: the channel list.
- **Channel list:** `<dl>` — each row `flex gap-7 border-b border-border pb-8`, `<dt>` the gold uppercase label (`flex-none w-25`), `<dd>` the value; `href` present → `<a>` with `hover:text-gold`, otherwise a `<p className="whitespace-pre-line">`.
- **Body:** grid `grid-cols-1 lg:grid-cols-[1fr_500px] gap-12 lg:gap-25`, `px-6 md:px-20`, `py-24 md:py-30`. Left column: eyebrow, `<h2>` "How can we / assist you?", then `<ContactForm subjects={subjects} />`. Right column: the consultation card and the social card, each `border border-border bg-surface p-10 md:p-12`.
- **Social list:** `<ul>`, each `<a>` `flex justify-between border-b border-border py-3.5`, platform in `font-heading text-ivory`, handle in `text-gold/60`, plus `aria-label={`KHEM on ${platform}`}`.
- Remove the hardcoded `paddingTop: '80px'`.
- Sections wrapped in `<Reveal>`; no `delay` beyond `index * STAGGER_STEP` for the two right-hand cards.

### `src/components/contact/ContactForm.tsx` (`'use client'`)
- Props: `{ subjects: string[] }`.
- Controlled state for `name`, `email`, `subject` (defaults to `subjects[0]`), `message`; plus `errors: Partial<Record<Field, string>>` and `isSent`.
- `noValidate` on the form; validation on submit: name non-empty, email matches the same pattern used by `NewsletterForm`, message non-empty. First invalid field receives focus.
- Every field: `id` + `htmlFor` label, `name`, `autoComplete` (`name`, `email`), `aria-invalid`, `aria-describedby` pointing at its error `<p className="text-danger">`. Errors clear as the user types.
- Field styling: `w-full border border-border bg-ivory/3 px-5 py-4 text-[13px] tracking-wide text-ivory transition-colors focus:border-gold/40 focus:outline-none`; `<select>` gets `appearance-none cursor-pointer` and its `<option>`s `bg-surface`; `<textarea>` `rows={6} resize-none`.
- Labels: `mb-2.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-ivory/35`.
- Submit: `btn-luxury btn-luxury-fill self-start min-w-50 justify-center`.
- Success state replaces the form: gold-bordered panel, `bg-gold/5`, circular check (inline `<svg>` with `stroke="currentColor"` and `aria-hidden`), "Message Received" + the 24-hour copy, wrapped in `role="status"`.
- The TODO comment must name `schemas/contact.ts`, `actions/contact.ts`, and Resend, and state plainly that nothing is transmitted or stored yet.

## Security requirements

- The form collects a name, an email address, and free text. **Nothing is transmitted or persisted** in this change — no network call, no logging of field values, no third party. This is stated in a comment so the gap is not mistaken for working transport.
- When the Server Action lands: validate with Zod **server-side** (client checks are UX only), rate-limit the action, never interpolate submitted text into HTML, and treat the message body as untrusted when it reaches an email template.
- `mailto:` / `tel:` hrefs are built from constants, never from user input.
- No `dangerouslySetInnerHTML`. External social links keep their placeholder `#` href; when real URLs land they need `rel="noopener noreferrer"` with `target="_blank"`.
- No secrets, no env vars, no route handler added.

## Acceptance criteria

- [ ] `src/contact/` no longer exists; `/contact` builds and prerenders from `src/app/contact/page.tsx`.
- [ ] Page is a Server Component with `metadata` + `revalidate = 3600`; `'use client'` appears only in `ContactForm.tsx`.
- [ ] Zero inline `style` props, zero `CSSProperties` objects, zero raw hex/rgba on the route.
- [ ] Channel list, enquiry subjects, and social profiles all resolve through `src/services/contact.ts`; no record arrays remain in the page.
- [ ] Every input has a matching `id`/`htmlFor` label, a `name`, and an error region wired via `aria-describedby`.
- [ ] Submitting an empty form shows per-field errors and does **not** show the success panel.
- [ ] Focus styling is CSS-only; no `.style` mutation anywhere.
- [ ] No horizontal overflow at 375px, 768px, 1024px, 1440px.
- [ ] `npx tsc --noEmit` clean; `npx eslint src` clean; `npm run build` succeeds with `/contact` listed.

## Checks to run

```bash
npx tsc --noEmit
npx eslint src
npm run build
```

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/contact` — the route resolves (it 404s before this change).
2. Header renders in two columns on desktop and stacks at 375px; the boutique address and hours keep their line breaks; no horizontal scrollbar at any width.
3. Click the **Email** value → mail client opens for `enquiries@khemfragrance.com`; **Telephone** → dialer.
4. Submit the form empty → three field errors appear, the first invalid field takes focus, and no success panel shows.
5. Enter `not-an-email` in the email field → email error only; fix it and watch the error clear as you type.
6. Fill all fields validly and submit → the gold "Message Received" panel replaces the form and is announced as a status.
7. Click each `<label>` → focus moves into its field (proves `htmlFor`/`id` are wired).
8. Tab through the form and the social links → visible gold focus states throughout, no keyboard trap.
9. Enable "Reduce Motion" and reload → sections appear immediately with no transition.
10. Tab title reads "Contact | KHEM Perfumes".
