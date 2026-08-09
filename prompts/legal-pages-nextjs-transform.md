# Prompt — Rebuild the four legal routes (`/privacy-policy`, `/terms-conditions`, `/return-exchange`, `/cookie-policy`)

## Goal

Replace four unstyled `<div>` text dumps with a single, shared, production-grade **legal document system**:

1. A typed content layer (`types/legal.ts` → `data/legal.ts` → `services/legal.ts`) holding all four documents as structured sections — mirroring the existing `content.ts` / `contact.ts` contract.
2. Two shared presentation components (`LegalHero`, `LegalDocumentBody`) so all four routes render through one layout.
3. Four thin Server Component routes that fetch a document and render it.

**And**: scrub every piece of copy that does not belong to KHEM. The current text is lifted from at least three unrelated companies (an Italian S.p.A., a French SASU, and generic boilerplate). This is the substantive half of the task — the redesign is the other half.

---

## Skills read

- `AGENTS.md` — §1 core rules, §2 design language, §3 tokens + component aesthetics, §6 stack, §7 directory structure, §8 routing matrix, §12 checklist.
- **No `.agents/skills/*` skill applies.** These are static editorial routes: no Clerk auth, no Supabase call, no AI SDK. Session hooks suggested `ai-sdk`, `chat-sdk`, `nextjs`, `next-cache-components`, and `react-best-practices` on lexical/path matching — all false positives for static legal pages. App Router patterns were verified against the installed `next@16.2.12` and the routes already shipped in this repo.

---

## Existing code inspected

| File | Relevant facts |
| :--- | :--- |
| `src/app/privacy-policy/page.tsx` | 172 lines. Single `<div>`, zero markup, zero styling, `const page = () => {}` + `export default page` (lowercase). Text is an **Italian company's** privacy policy. |
| `src/app/terms-conditions/page.tsx` | 96 lines, same shape. Text is a **French SASU's** terms. |
| `src/app/return-exchange/page.tsx` | 93 lines, same shape. Text is the **Italian** entity's returns policy. |
| `src/app/cookie-policy/page.tsx` | 56 lines, same shape. Generic unbranded boilerplate. |
| `src/app/about/page.tsx` | Reference idiom: Server Component, `export const revalidate = 3600`, `export const metadata` with `alternates.canonical` + `openGraph`, `next/image` `fill` + `sizes` + `priority`, `<Reveal delay={index * STAGGER_STEP}>`, `{/* ── SECTION ── */}` banners, `eyebrow` / `gold-line` / `btn-luxury` classes, `text-ivory/50` opacity scale. |
| `src/app/contact/page.tsx` | Reference for the service-layer route: `await Promise.all([...])` of `get*()` calls, `max-w-350`, `px-6 py-24 md:px-20 md:py-30`, `<dl>`/`<dt>`/`<dd>` detail rows, `whitespace-pre-line` for `\n` values, radial gold wash via `bg-[radial-gradient(...)]` + `aria-hidden`. |
| `src/services/contact.ts`, `src/data/contact.ts`, `src/types/contact.ts` | The exact three-file contract to copy: types file explains why it is not a Prisma model, data file is "the only place these values are hardcoded", service file exposes `async` getters with a `/** → supabase.from('X')... */` comment above each. |
| `src/components/animation/Reveal.tsx` | Client boundary around Motion. Props `children`, `className`, `delay` (seconds), `as` (`div` \| `section` \| `article`). Honors `useReducedMotion`. Tween-only on `--ease-luxury-bezier`. |
| `src/app/globals.css` | `@theme` tokens + `.eyebrow`, `.gold-line`, `.btn-luxury`, `.btn-luxury-fill`, `.grain`, `.section-divider`, `.card-lift`, `.note-pill`. `body` already sets background/color/font. |
| `src/app/layout.tsx` | `metadataBase: https://khemperfumes.vercel.app`, title template `"%s | KHEM Perfumes"`, renders `<Nav />` + children + `<Footer />`. |
| `src/components/Footer.tsx` | `legalLinks` all point at `href="#"` (dead), and `accountLinks` sends "Returns & Exchanges" to `/contact` instead of `/return-exchange`. |
| `src/data/contact.ts` | Uses `@khemfragrance.com` addresses — **contradicts** the `khemperfumes.com` brand domain. See "Decisions" §2. |
| `next.config.ts` | `images.remotePatterns` allows `images.unsplash.com` only. No change needed. |
| `package.json` | `next 16.2.12`, `react 19.2.4`, `motion ^13`, `lucide-react ^1.30`. Scripts: `dev`, `build`, `start`, `lint`. No test runner, no `typecheck` script. |

### Defects in the four current files

1. **Foreign-company content** — the dominant defect, itemized in "Content audit" below.
2. No `metadata` export on any of the four → all inherit the site-wide title/description; no canonical, no `robots`, no OG.
3. No `revalidate` export.
4. Zero styling: raw `<div>` on the default body background, no headings, no semantic structure. The document titles ("Cookie Policy", "Terms and Conditions of Sale (CGV)") are bare text nodes, not `<h1>`.
5. Section headings ("1. Scope", "2. Seller Information") are plain text — not `<h2>`, so no document outline for screen readers or SEO.
6. Lists are newline-separated prose, not `<ul>`/`<ol>`.
7. Unescaped typographic characters (`’`, `“`, `”`, `—`) sit directly in JSX; several would trip `react/no-unescaped-entities` under the project ESLint config.
8. `const page = () => ...` — lowercase component name, non-descriptive; four modules all export a symbol called `page`.
9. "download here" (return policy, twice) and "Zendesk Privacy Policy" / "WhatsApp Privacy Policy" (privacy policy) are written as link text with **no link** — dangling references to files and pages that do not exist.
10. `terms-conditions` §6 cites a "Shipping and Delivery" page; no such route exists.
11. No `Last updated` date on any document — a basic requirement for a policy that users are told to "periodically review".
12. Unreachable in the UI: `Footer.tsx` legal links are `href="#"`, so all four routes are orphaned.

### Content audit — what is not KHEM's

**`privacy-policy` — replace wholesale (≈100% foreign).**
`khemperfumes Group S.p.A.` · registered office `Via Tenivelli 29, 10024 Moncalieri (TO), Italy` · operational HQ `Via Torino 15, 10044 Pianezza (TO)` · `REA TO 106649` · `VAT 09547650011` · phones `(+39) 011 4143616` / `(+39) 011 5534737` · certified mail `pec@pec.khemperfumes.com` (an Italian PEC address) · named DPO **"Mr./Dr. Federico Capello"** — a real person's name on a policy that is not theirs · "As an Italian company…" · GDPR Art. 13/14, UK DPA 2018, CCPA, UAE Federal Decree Law 45/2021 · processors that this stack does not use: **Shopify** (×3), **Zendesk** (×5), **Mapp Cloud** (×2), **HubSpot**, **WhatsApp/Meta**, **Klarna**, **Sofort** · social links to **Spotify**, **YouTube**, **TikTok**, **LinkedIn**, **Facebook** · a "Work with us" / CV-recruitment section for a careers process that does not exist · Italian civil-law retention periods (10-year fiscal, 24-month support, 2-year CV).

**`terms-conditions` — replace ≈80%.**
`KHEM PERFUMES **SASU**` (a French legal form) at `NEW CAIRO CAIRO EGYPT` with `VAT number EG123456789` — an invented, self-evidently fake tax ID · "In accordance with **French law**" · "These Terms are governed by **French law**" + "the competent **French courts**" · `articles L.217-4 to L.217-14 of the French Consumer Code` and `articles 1641 to 1649 of the French Civil Code` · "Prices are displayed in **EUR**" · "Customs duties for orders outside the **EU**" · "We offer only original products from KHEM Perfumes **and NOIR Perfumes**" — Noir is a KHEM *collection* (`src/constants/navigation-pages.ts`), not a second brand · §4 ends "we cannot guarantee complete satisfaction", which reads as a disclaimer of the product itself.

**`return-exchange` — replace ≈70%.**
WhatsApp `+39 331 633 2177` (Italian mobile) · `customer@khemperfumes.com` (×7 — wrong local part vs. the rest of the site) · `khemperfumes Group S.P.A` · `Art. 55 of the Consumer Code` and `Art. 128 and ff` — Italian Consumer Code citations · "any member state of the **European Union**" as the withdrawal boundary · "download here" withdrawal form (×2) that does not exist · the whole §6 is a wall of undifferentiated conditions.

**`cookie-policy` — rewrite ≈50%.**
No foreign entity, but nothing KHEM-specific either: no named cookies, no consent tool, no link to the privacy policy, and a flat "13 months" retention. Claims "We allow third-party companies, such as advertising networks… to use cookies" and "**advertising cookies**… on partner websites" — describing an ad-tech posture this site does not have.

---

## Decisions and assumptions

*(1)–(4) were confirmed with the user before this prompt was written.*

1. **Jurisdiction: Egypt, with unknowns marked as placeholders.** Entity is `KHEM Fragrance House`, Cairo, Egypt; governing law is Egyptian; disputes go to the competent Egyptian courts. Prices in **EGP** with currency conversion at checkout. Registration number and tax ID are rendered as visible, clearly-marked placeholders (`Commercial Registration — pending publication`) and carry a `// TODO:` in `data/legal.ts`. **Do not invent a registration number, VAT number, DPO name, or street address.** A plain-language "Your rights over your data" section is kept (it is good practice and covers international customers) without claiming EU establishment.
2. **Email domain: `khemperfumes.com`** — matching the brand domain in `AGENTS.md` and `layout.tsx`. Use `privacy@khemperfumes.com` (data requests), `legal@khemperfumes.com` (terms/disputes), `care@khemperfumes.com` (returns, cancellations, damages). **`src/data/contact.ts` is deliberately left untouched** this round even though it uses `@khemfragrance.com`; the mismatch is a content decision for the user, and is recorded as a `NOTE:` comment in `data/legal.ts` rather than silently resolved.
3. **Shared data/services layer**, three new files + one shared component pair. Four documents, one renderer.
4. **Banner images: remote Unsplash URLs already proven in this repo** — no new binaries committed, and `next.config.ts` already allowlists the host. Assignments (all four IDs are in active use elsewhere in `src/`, so none can 404):
   | Route | Photo ID | Why |
   | :--- | :--- | :--- |
   | `/privacy-policy` | `photo-1613549026666-73c9c9083c62` | Dark glass, low-key |
   | `/terms-conditions` | `photo-1615885108069-7d5bef9a7e22` | Formal, architectural |
   | `/return-exchange` | `photo-1607506740211-ff3d6b933dda` | Packaging/boxed object |
   | `/cookie-policy` | `photo-1631189944771-466264f05965` | Abstract texture |
   Query string follows the `about` hero: `?w=1800&h=800&fit=crop&auto=format`, `quality={80}`, `sizes="100vw"`, `priority`, `alt=""` (decorative), `className="object-cover brightness-[0.22] saturate-50"`.
5. **`revalidate = 86400`** (24h) on all four — legal copy changes far less often than editorial content, and the routes are not in the §8 matrix.
6. **`updatedAt` is `"2026-08-09"`**, stored ISO-8601 and formatted at render (`en-GB`, `day: "numeric", month: "long", year: "numeric"`) — per the `data/content.ts` rule that storage never holds display strings.
7. **`LegalBlock` is a discriminated union**, not raw HTML strings — no `dangerouslySetInnerHTML` anywhere. Four variants cover every document: `text`, `list`, `note`, `table`.
8. **Footer wiring is in scope.** Dead `href="#"` legal links are pointed at the real routes and "Returns & Exchanges" is repointed from `/contact` to `/return-exchange`; otherwise this work ships unreachable.
9. **Not in scope**: a cookie consent banner / preference tool, a downloadable withdrawal form, a `/shipping-delivery` route. The copy must therefore not promise any of them — where the old text referenced them, describe browser-level cookie control and an email-based withdrawal request instead.
10. **Legal disclaimer**: this produces well-structured, honest, brand-consistent policy copy for a pre-launch site. It is not legal advice and must be reviewed by counsel before the store transacts. State this once, to the user, on completion — do **not** put a "this is not legal advice" line on the pages themselves.

---

## Files likely to change

**New (6)**
- `src/types/legal.ts`
- `src/data/legal.ts`
- `src/services/legal.ts`
- `src/components/legal/LegalHero.tsx`
- `src/components/legal/LegalDocumentBody.tsx`
- `src/lib/format.ts` — **only if it does not already exist**; if it does, add `formatLegalDate` to it rather than creating a second formatter module.

**Rewritten (4)**
- `src/app/privacy-policy/page.tsx`
- `src/app/terms-conditions/page.tsx`
- `src/app/return-exchange/page.tsx`
- `src/app/cookie-policy/page.tsx`

**Edited (1)**
- `src/components/Footer.tsx` — `legalLinks` hrefs + one `accountLinks` path.

No schema, migration, route handler, middleware, `next.config.ts`, or dependency changes. **No new npm packages.**

---

## Implementation requirements

### A. `src/types/legal.ts`

Open with a doc comment in the house voice explaining these are not Prisma models (no `LegalDocument` table in `AGENTS.md` §9) and that the service layer absorbs a future CMS/Supabase swap — mirroring the header in `types/contact.ts`.

```ts
export type LegalDocumentSlug =
  | "privacy-policy"
  | "terms-conditions"
  | "return-exchange"
  | "cookie-policy";

/** A two-column reference table, e.g. cookie categories or retention periods. */
export interface LegalTable {
  head: readonly [string, string];
  rows: readonly (readonly [string, string])[];
}

/**
 * One renderable unit inside a section. A closed union rather than an HTML
 * string: every document is typechecked, and nothing reaches
 * `dangerouslySetInnerHTML`.
 */
export type LegalBlock =
  | { kind: "text"; text: string }
  | { kind: "list"; items: readonly string[] }
  /** Gold-bordered callout for the one thing a reader must not miss. */
  | { kind: "note"; text: string }
  | { kind: "table"; table: LegalTable };

export interface LegalSection {
  /** Anchor + `key`; kebab-case, unique within the document. */
  id: string;
  title: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  slug: LegalDocumentSlug;
  /** Uppercase kicker above the title, e.g. "Legal". */
  eyebrow: string;
  title: string;
  /** One-sentence plain-language summary, shown in the hero and reused as the meta description. */
  lede: string;
  /** ISO-8601 date, formatted at render — never a display string. */
  updatedAt: string;
  banner: ContentImage;      // reuse the existing type from `types/content.ts`
  sections: readonly LegalSection[];
  /** Address for questions about this specific document. */
  contactEmail: string;
}
```

Import `ContentImage` from `@/src/types/content` rather than redeclaring it.

### B. `src/data/legal.ts`

- Header comment in the `data/contact.ts` voice: only place these values are hardcoded, shaped for a straight Supabase insert later.
- One `TODO:` noting the pending commercial registration / tax ID.
- One `NOTE:` recording the `khemperfumes.com` vs `khemfragrance.com` mismatch with `data/contact.ts`, and that unifying them is a content decision.
- Export `const LEGAL_DOCUMENTS: Record<LegalDocumentSlug, LegalDocument>`.

**Voice for all copy**: plain, calm, direct, second person ("we" / "you"). Short sentences. No legalese theatre, no Latin, no article citations. It should read like the rest of the site — confident and unhurried — while still saying something specific enough to be useful. Every section title is sentence-case-free, Cinzel-friendly title case.

**`privacy-policy` — 8 sections**, ~1 short lede + these:
`who-we-are` (KHEM Fragrance House, Cairo; the registration placeholder as a `note` block; `privacy@khemperfumes.com`) · `what-we-collect` (`list`: account details, order + delivery details, payment confirmation — never full card numbers, since Stripe holds those; messages you send us; anonymous usage data) · `why-we-use-it` (`list` mapping each purpose to a reason) · `who-we-share-it-with` — a `table` of the **actual** `AGENTS.md` §6 stack and nothing else:
| Partner | What they handle |
| :--- | :--- |
| Stripe | Payment processing |
| Clerk | Account sign-in and security |
| Supabase | Database hosting |
| Cloudinary | Product imagery |
| Resend | Order and account emails |
| Vercel | Website hosting and delivery |
· `how-long-we-keep-it` (`table`: account data — while your account is open; order records — as long as Egyptian tax and commercial law requires; support messages — 24 months; marketing consent — until you withdraw it) · `your-rights` (`list`: access, correct, delete, export, object, withdraw consent — with the one-address instruction) · `security` (encryption in transit, no card storage, access limited to staff who need it) · `changes-to-this-policy`.
**Explicitly absent**: profiling, ad networks, CV/recruitment, PEC, any named individual.

**`terms-conditions` — 10 sections**: `who-you-are-buying-from` (Egypt entity + registration placeholder `note`) · `orders-and-acceptance` · `pricing-and-payment` (EGP; taxes; Stripe; the pricing-error clause, kept — it is fair and correct) · `shipping-and-delivery` (business days, courier, **no** link to a page that does not exist) · `returns` (short — link to `/return-exchange` for detail, no duplication) · `product-information` (images and note pyramids are indicative; natural materials vary batch to batch — a *reason*, unlike the old "we cannot guarantee complete satisfaction") · `fragrance-safety` (allergens listed on packaging; patch test; `note` block for the flammability/heat-and-flame warning — this is the one item a reader must not miss) · `intellectual-property` (KHEM name, marks, imagery, and editorial content) · `governing-law` (Egyptian law; amicable resolution first; competent Egyptian courts) · `contact` (`legal@khemperfumes.com`).

**`return-exchange` — 7 sections**: `cancelling-an-order` (6-hour window, kept; `care@khemperfumes.com`; **no** Italian WhatsApp number) · `samples-and-discovery-sets` (final sale, kept) · `returning-a-product` (14 days from delivery; unopened, sealed, original packaging, cellophane intact; email first for authorization; a prepaid label is issued so the flacons travel with an approved courier — the *reason*, kept from the original because it is genuinely brand-appropriate) · `what-we-cannot-accept` (`list`: opened or used fragrance — hygiene; personalized/bespoke pieces unless faulty; unauthorized returns; makeshift packaging) · `damaged-or-incorrect-orders` (`note`: inspect on delivery, report within 48 hours with photographs, **do not discard the product before contacting us** — the highest-consequence instruction) · `exchanges` · `refunds` (original payment method, within 14 days of the return being received and inspected).

**`cookie-policy` — 6 sections**: `what-a-cookie-is` · `how-we-use-them` — a `table` of the categories this site actually has:
| Category | What it does |
| :--- | :--- |
| Essential | Keeps you signed in and your bag intact. Cannot be switched off. |
| Preferences | Remembers your region, currency, and recently viewed fragrances. |
| Analytics | Anonymous, aggregated data on which pages are read and where visitors get stuck. |
· `what-we-do-not-do` — a `note` block stating plainly: **no advertising cookies, no ad networks, no selling or sharing of browsing data with third-party advertisers.** (This is the "creative" beat of the document — an honest negative is more distinctive than another paragraph of consent boilerplate, and it is *true* of this stack.) · `managing-cookies` (browser-level control; disabling essential cookies breaks the bag and checkout) · `how-long-they-last` (session vs. up to 12 months) · `more-information` (points to `/privacy-policy`).

### C. `src/services/legal.ts`

Mirror `services/contact.ts` exactly — same header comment, same `// NOTE: add "server-only"` line, a `/** → supabase.from('LegalDocument')... */` comment above each getter:

```ts
export async function getLegalDocument(slug: LegalDocumentSlug): Promise<LegalDocument>
export async function getLegalDocuments(): Promise<LegalDocument[]>
```

`getLegalDocument` indexes the record — the `LegalDocumentSlug` union makes a miss impossible at compile time, so no runtime `notFound()` is needed. `getLegalDocuments()` returns the four in nav order; it exists for a future `/legal` index and the sitemap.

### D. `formatLegalDate`

In `src/lib/format.ts`. Pure function, `(iso: string) => string`, `Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" })`. Must be deterministic on server and client (fixed locale, no `undefined` locale) to avoid a hydration mismatch.

### E. `src/components/legal/LegalHero.tsx` — Server Component

Props: `{ eyebrow, title, lede, updatedAt, banner }`.

- `<section className="relative flex h-[60vh] min-h-100 items-end overflow-hidden">` — deliberately shorter than the 85vh `about` hero: a policy page should not make the reader scroll past a full screen of atmosphere.
- `next/image` `fill` + `priority` + `sizes="100vw"` + `quality={80}` + `alt=""`, `className="object-cover brightness-[0.22] saturate-50"`.
- Two overlays, both `aria-hidden`: `bg-linear-to-t from-background via-background/80 to-transparent` (bottom fade into the page body) and the `grain` class for texture.
- Content block `relative z-10 px-6 pb-16 md:px-20 md:pb-20`, `max-w-3xl`: `eyebrow` → `<h1 className="mb-6 font-heading text-4xl font-normal leading-tight text-ivory sm:text-5xl md:text-6xl">` → `gold-line` → lede in `text-sm leading-loose text-ivory/50` → `<p className="mt-8 font-body text-[10px] uppercase tracking-[0.25em] text-gold/50">Last updated {formatLegalDate(updatedAt)}</p>`.
- Wrap the text block in `<Reveal>`.

### F. `src/components/legal/LegalDocumentBody.tsx` — Server Component

Props: `{ sections, contactEmail }`.

Layout: `<div className="mx-auto max-w-350 px-6 py-20 md:px-20 md:py-28">` containing `<div className="grid grid-cols-1 gap-14 lg:grid-cols-[260px_1fr] lg:gap-24">`.

**Left — contents index** (`<nav aria-label="Contents">`), `hidden lg:block` with `sticky top-30 self-start`:
- `eyebrow` reading "Contents".
- Ordered list of anchor links `href={`#${section.id}`}`, each row: a gold two-digit index (`01`, `02`, … via `String(i + 1).padStart(2, "0")`) in `font-heading text-[10px] text-gold/40`, then the title in `text-xs text-ivory/45`, `transition-colors duration-300 hover:text-gold`. Border-bottom hairlines between rows.
- Purely CSS/anchor-based — **no `'use client'`, no scroll-spy.**

**Right — the document** (`<article>`), sections separated by `border-t border-border pt-12 first:border-t-0 first:pt-0`, `mb-14` between:
- Each section is a `<Reveal as="section" id={section.id} className="scroll-mt-30">` (offset clears the fixed nav).
- Section header: the same gold two-digit numeral above `<h2 className="mb-8 font-heading text-xl font-normal leading-snug text-ivory sm:text-2xl">`.
- Block rendering, one `switch` on `block.kind`:
  - `text` → `<p className="mb-5 text-sm leading-loose text-ivory/50">`
  - `list` → `<ul className="mb-6 flex flex-col gap-3.5">`, each `<li className="flex gap-4 text-sm leading-loose text-ivory/50">` with a decorative gold marker `<span aria-hidden="true" className="mt-2.5 h-px w-4 flex-none bg-gold/40" />` — a hairline rule, matching `gold-line`, not a bullet character.
  - `note` → `<aside className="mb-6 border-l-2 border-gold bg-surface/60 px-6 py-5 text-sm leading-loose text-ivory/70">` — reuses the founder-quote treatment from `about/page.tsx`.
  - `table` → wrapped in `<div className="mb-6 overflow-x-auto">`; `<table className="w-full min-w-125 border-collapse text-left">`; `<th>` in `border-b border-border pb-3 font-body text-[10px] uppercase tracking-[0.2em] text-gold/60`; `<td>` in `border-b border-border py-4 pr-6 align-top text-[13px] leading-relaxed text-ivory/50`, first column `text-ivory/80`. **The table must scroll inside its own container — the page body must never scroll horizontally.**
- Footer of the article: a `border border-border bg-surface p-10` card — `eyebrow` "Questions" → one line of copy → `<a href={`mailto:${contactEmail}`} className="btn-luxury inline-flex">Email Us</a>`.

Use a small `SECTION_STAGGER = 0.06` for `Reveal delay` — smaller than the editorial pages, since sections are dense and a long stagger reads as lag.

### G. The four routes

Each becomes ~30 lines and is structurally identical:

```tsx
import type { Metadata } from "next";

import LegalDocumentBody from "@/src/components/legal/LegalDocumentBody";
import LegalHero from "@/src/components/legal/LegalHero";
import { getLegalDocument } from "@/src/services/legal";

/** ISR, 24 hours — legal copy changes far less often than editorial content. */
export const revalidate = 86400;

export const metadata: Metadata = { /* title, description = lede, alternates.canonical, openGraph */ };

export default async function PrivacyPolicy() {
  const doc = await getLegalDocument("privacy-policy");

  return (
    <div className="min-h-screen bg-background text-ivory">
      <LegalHero {...} />
      <LegalDocumentBody sections={doc.sections} contactEmail={doc.contactEmail} />
    </div>
  );
}
```

- Named, PascalCase, default-exported components: `PrivacyPolicy`, `TermsConditions`, `ReturnExchange`, `CookiePolicy`. No more `const page`.
- `metadata` is a literal object per route (not derived from the document at module scope) so the strings are greppable; `title` is the short form ("Privacy Policy") since `layout.tsx` appends `| KHEM Perfumes`.
- Add `robots: { index: true, follow: false }` — these pages should be indexable but should not pass link equity.

### H. `src/components/Footer.tsx`

```ts
const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-conditions" },
  { label: "Returns & Exchanges", href: "/return-exchange" },
  { label: "Cookie Policy", href: "/cookie-policy" },
] as const;
```

Render with `next/link` (`<Link href>`) instead of `<a href>` now that they are internal routes. Also change the `accountLinks` "Returns & Exchanges" entry from `/contact` to `/return-exchange`. Leave everything else in the file alone.

---

## Design requirements

**Interpretation.** A legal page in a museum. The reader arrives slightly guarded and expecting a wall of grey text; the page should feel like the same house that made the fragrance — quiet, spacious, precise — and should be genuinely *readable*. The creativity is in restraint and in structure (numbered index, gold hairline markers, a two-column reference table), not in ornament.

- **Type scale**: `h1` `text-4xl sm:text-5xl md:text-6xl` Cinzel `font-normal`; `h2` `text-xl sm:text-2xl` Cinzel; body `text-sm leading-loose` Inter; micro-labels `text-[10px] uppercase tracking-[0.2em]–[0.3em]`.
- **Measure**: body copy must not exceed ~72ch. The `[260px_1fr]` grid at `max-w-350` already produces this; do not widen it.
- **Color**: only `@theme` tokens. Body copy `text-ivory/50`, emphasized `text-ivory/70–80`, headings `text-ivory`, all accents `gold` at 40–60% opacity. **Zero raw hex values, zero inline `style` objects, zero `font-family` overrides.**
- **Spacing**: `py-20 md:py-28` sections, `mb-14` between document sections, `mb-5/6` between blocks.
- **Motion**: `<Reveal>` only. Tween, `--ease-luxury-bezier`, no spring, no bounce, no layout shift. Reduced-motion is already handled inside `Reveal`.
- **Responsive**: single column below `lg` with the contents index hidden; `px-6` at mobile, `md:px-20`. Hero `h-[60vh] min-h-100` so it cannot collapse on short viewports. Verify at 375 / 768 / 1024 / 1440 / 1920. **No horizontal body scroll at any width** — tables scroll inside their own container.
- **Pixel-perfect expectations**: all four pages must be visually indistinguishable in rhythm — identical hero height, identical section spacing, identical numeral treatment. A reader moving between them should feel one document set, not four pages.
- **Accessibility**: one `<h1>` per page; sections are `<section>` with `<h2>`; the index is `<nav aria-label="Contents">`; decorative images `alt=""`, decorative spans `aria-hidden="true"`; anchor targets carry `scroll-mt-30`; contrast of `text-ivory/50` on `#0d0d0d` is ≈7:1 — do not go below `/45` for body copy.

---

## Security requirements

- No `dangerouslySetInnerHTML` — the `LegalBlock` union exists precisely so no HTML string is ever rendered.
- No user input, no forms, no Server Actions, no route handlers on these pages → no Zod schema and no CSRF surface.
- All four routes are public. Confirm they are covered by the public-route matcher when `middleware.ts` is added (it does not exist yet — do **not** create it in this task).
- Do not publish personal data: no named DPO, no individual's phone number, no personal email. Company addresses only.
- Do not invent a registration number, VAT number, or licence number — a fabricated tax ID on a live commerce site is a real liability. Placeholders only.
- `mailto:` links only; no external `href` is introduced. If any external link is later added, it needs `target="_blank" rel="noopener noreferrer"`.
- Nothing secret enters these files; no env var is read.

---

## Acceptance criteria

- [ ] `npx tsc --noEmit` passes; **zero `any`**, zero `@ts-expect-error`, zero non-null assertions.
- [ ] `npm run lint` passes with no new warnings (including `react/no-unescaped-entities` — use `&apos;` / `&ldquo;` / `&rdquo;` or the `’ “ ”` characters consistently with `about/page.tsx`).
- [ ] `npm run build` succeeds and all four routes are reported as static/ISR, not dynamic.
- [ ] Zero occurrences, across `src/`, of: `S.p.A`, `SASU`, `Moncalieri`, `Pianezza`, `Tenivelli`, `Federico Capello`, `+39`, `pec@`, `REA`, `09547650011`, `EG123456789`, `French`, `Shopify`, `Zendesk`, `Mapp`, `HubSpot`, `Klarna`, `Sofort`, `Spotify`, `TikTok`, `NOIR Perfumes`, `customer@khemperfumes.com`, `Consumer Code`, `L.217`, `download here`. Verify with a single `grep -rniE` over `src/` and paste the (empty) result.
- [ ] Every `@khemperfumes.com` address in `src/data/legal.ts` is one of `privacy@`, `legal@`, `care@`.
- [ ] Each of the four pages renders: hero with banner + `Last updated 9 August 2026`, a sticky numbered contents index at `lg`, numbered `<h2>` sections, and the closing "Questions" card.
- [ ] Every contents-index link scrolls to its section with the heading clear of the fixed nav.
- [ ] No horizontal scrollbar on `<body>` at 375, 768, 1024, 1440, and 1920 px; the two reference tables scroll within their own containers.
- [ ] All four legal links in the footer navigate correctly; "Returns & Exchanges" under My Account lands on `/return-exchange`.
- [ ] `prefers-reduced-motion: reduce` renders every section in its final state with no transition.
- [ ] No raw hex color, no inline `style`, no `'use client'` in any new file except by way of the existing `Reveal`.
- [ ] Lighthouse on `/privacy-policy`: Performance ≥ 95, Accessibility 100, SEO 100.

---

## Checks to run

```bash
npx tsc --noEmit
npm run lint
npm run build
grep -rniE 'S\.p\.A|SASU|Moncalieri|Pianezza|Federico Capello|\+39|pec@|EG123456789|French|Shopify|Zendesk|Mapp|HubSpot|Klarna|Sofort|Spotify|TikTok|NOIR Perfumes|customer@khemperfumes|Consumer Code|L\.217|download here' src/
```

The last command must return nothing. There is no test runner configured in `package.json`, so no unit tests are added.

---

## Manual test steps

1. `npm run dev`, open `http://localhost:3000/privacy-policy`.
2. **Hero** — banner image loads (not a broken tile), headline is Cinzel gold-and-ivory, `Last updated 9 August 2026` sits below a gold hairline.
3. **Index** — at ≥1024 px a numbered contents list is pinned on the left. Scroll the article; the index stays put. Click `06 Your Rights` — the section heading lands clear of the nav bar, not under it.
4. **Blocks** — confirm all four renderers appear: paragraphs, a hairline-marker list, the gold-bordered "who we share it with" table, and at least one gold-bar `note` callout.
5. **Content** — read the "Who we share it with" table: it must list only Stripe, Clerk, Supabase, Cloudinary, Resend, and Vercel. No Shopify, no Zendesk, no Mapp.
6. Repeat 2–4 on `/terms-conditions`, `/return-exchange`, `/cookie-policy`. The four must feel identical in rhythm — same hero height, same spacing, same numerals.
7. **Terms check** — `/terms-conditions` names KHEM Fragrance House in Cairo, states Egyptian governing law, quotes EGP, and carries a visible registration placeholder. No mention of France, EUR, or a second "NOIR" brand.
8. **Returns check** — `/return-exchange` gives `care@khemperfumes.com` and no phone number; the damaged-goods `note` says do not discard the product before contacting us.
9. **Cookie check** — `/cookie-policy` carries the "no advertising cookies, no ad networks" note and links to `/privacy-policy`.
10. **Responsive** — DevTools at 375 px: single column, index hidden, no horizontal page scroll. Drag the share/retention tables sideways — they scroll inside their own box while the page does not.
11. **Footer** — from any page, click each of the four links in the footer legal bar; each resolves. Under "My Account", "Returns & Exchanges" now goes to `/return-exchange`.
12. **Reduced motion** — enable *Emulate CSS `prefers-reduced-motion: reduce`* and reload: content is fully visible immediately, nothing fades or travels.
13. `npm run build && npm start`, reload `/cookie-policy` — identical output, no hydration warning in the console (validates the `Intl` date formatting).
