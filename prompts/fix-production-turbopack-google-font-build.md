# Fix production Turbopack build failure from Google Fonts

## Goal

Make production builds independent of Google Fonts' build-time CSS/font response format, which caused the Vercel deployment for `c723d83` to fail inside Turbopack. Keep the current English and Arabic typefaces, locale switching, weights, subsets, display behavior, and visual typography.

## Skills read

- No Clerk, Supabase, or AI SDK skill applies.
- Read Next.js's installed font guides:
  - `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`

## Existing code inspected

- `src/lib/fonts.ts` imports `Amiri`, `Cinzel`, `IBM_Plex_Sans_Arabic`, and `Inter` from `next/font/google`, with explicit weights and locale-specific CSS variables.
- `src/app/[locale]/layout.tsx` uses `getFontVariables(locale)` for both locale trees.
- `src/app/prelaunch/layout.tsx` also calls `getFontVariables("en")`.
- `src/app/globals.css` consumes `--font-heading` and `--font-body` throughout the site.
- `package.json` and `package-lock.json` pin the installed Next.js line to `^16.3.4`; installed Next.js is 16.3.4 and `next build` defaults to Turbopack.
- No existing local font files were found under `public/` or `src/`.
- The working tree contains unrelated uncommitted ingredient/catalog changes. Do not alter or stage them.

## Diagnosis and decision

The reported failure is in `next/font/google`'s Turbopack pipeline, not in the admin stock/product code. Next.js issue [#99114](https://github.com/vercel/next.js/issues/99114) documents the same pair of errors when Google Fonts returns a valid but extensionless `/l/font?kit=...&skey=...&v=...` URL. The `&` characters are parsed as multiple Turbopack query entries, yielding `next/font/google queries have exactly one entry` and the misleading unresolved internal font module. A fresh Google Fonts response can therefore make an otherwise unchanged build fail.

Replace the four remote Google font imports with `next/font/local` references to checked-in, properly licensed WOFF2 assets. This removes a mutable external response from the production build and preserves Next's local font optimization. Do not work around this by switching the whole project back to Webpack, retrying builds, downgrading Next.js, or changing the brand fonts.

## Decisions and assumptions

- Preserve Cinzel and Inter for English and Amiri and IBM Plex Sans Arabic for Arabic.
- Preserve currently requested weights: Cinzel 400/500/600; Inter 400/500/600; Amiri 400/700; IBM Plex Sans Arabic 400/500/600.
- Preserve current subsets (`latin` for English faces, `arabic` for Arabic faces), `display: "swap"`, `preload: false`, CSS variable names, and the `getFontVariables()` interface.
- Obtain font files from the official Google Fonts repository or another verifiable upstream with the same family/version. Retain each font's OFL license and required copyright/attribution notices alongside the assets.
- Prefer variable WOFF2 files only when the exact family supports the needed range and renders the specified weights correctly; otherwise use discrete files with explicit local weight mappings. Do not claim a variable range for static files.
- Keep font assets minimal: include only the required language subsets and weights. Do not add regular/latin-ext/Arabic files unless the actual site text requires them.
- This is an isolated build reliability fix. It does not modify or stage the existing unrelated working-tree changes.

## Files likely to change

- `src/lib/fonts.ts`
- New local WOFF2 assets under a clearly named directory such as `src/app/fonts/` or `src/lib/fonts/`
- A license/attribution file colocated with the new font assets

No database schema, migration, route, API, authentication, or product behavior changes are expected.

## Implementation requirements

1. Vendor the verified font binaries and their license notices into the repository.
2. Change `src/lib/fonts.ts` to use `next/font/local`, keeping exports, CSS variables, locale selection, display mode, and preload settings stable.
3. Define local source paths and weights accurately. For multiple static weights, use explicit `{ path, weight }` sources per Next.js local-font API.
4. Avoid changes to layout class composition or global typography unless required to make the existing variable names work.
5. Do not remove or modify any unrelated edits already present in the working tree.

## Security and licensing requirements

- Verify asset provenance and license before adding binaries; preserve the upstream OFL license text and copyright notices.
- Do not download font files from arbitrary mirrors or add opaque binaries without a verifiable source.
- Do not add remote font URLs or external runtime font requests as a fallback.
- Do not expose environment variables, credentials, or deployment secrets.

## Acceptance criteria

- `src/lib/fonts.ts` has no imports from `next/font/google`.
- All four current families render from local checked-in assets; English and Arabic still select the correct heading/body pair.
- All currently used weights and glyph coverage are retained, with `font-display: swap` and `preload: false` unchanged.
- A clean production build no longer contacts Google Fonts and does not emit the reported Turbopack font import-map errors.
- Font assets include their verifiable license and attribution.
- No unrelated working-tree changes are modified or staged.

## Checks to run

- `npx tsc --noEmit`
- `npm run build` in an environment where the project build can complete. Confirm logs show Turbopack and do not show Google Fonts fetches or `@vercel/turbopack-next/internal/font/google/font` resolution errors.
- Inspect the generated CSS/assets to confirm local font URLs and expected weight declarations are emitted.
- Review `git diff --check` and `git status --short` to ensure only this fix's files changed in this implementation.

## Exact manual test steps

1. Run `npm run dev` and open the English home page; confirm Cinzel headings and Inter body copy render.
2. Open the Arabic home page at `/ar`; confirm Amiri headings and IBM Plex Sans Arabic body copy render with RTL layout intact.
3. In browser DevTools Network, filter for `font`; confirm font files load from the KHEM origin and there are no requests to `fonts.googleapis.com` or `fonts.gstatic.com`.
4. Open representative admin and editorial pages in both locales and confirm headings, UI labels, and body text retain their existing typography and weights.
5. Run a production deployment preview and inspect the build log for successful Turbopack compilation without the reported font-resolution errors.
