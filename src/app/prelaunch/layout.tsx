import { getFontVariables } from "@/src/lib/fonts";

import "../globals.css";
import "./prelaunch.css";

/**
 * ⚠️ TEMPORARY — the pre-launch cover. Delete this folder at launch.
 *
 * A **sibling root layout**, and the reason this feature can be switched off
 * without a scar. There is no `app/layout.tsx` in this project;
 * `app/[locale]/layout.tsx` is the root layout for the entire application, and
 * this is a second one for a single branch of the tree.
 *
 * ## What that buys
 *
 * The cover inherits none of the application shell: no `<Nav>`, no `<Footer>`,
 * no `<AnnouncementBar>`, no `<CartDrawer>`, no `<CookieConsent>`, no
 * `<CinematicIntro>` — and none of the eight providers. Three consequences, each
 * of which the brief asks for by name:
 *
 *  - §3, "no visible page underneath": there is no page underneath. The cover is
 *    not an overlay on the site, it is a different document.
 *  - §8, "the current KHEM subscription popup must remain untouched":
 *    `<OfferPopup>` is mounted in the `[locale]` layout, so it cannot render
 *    here. That is achieved by *where this file sits*, not by a flag added to
 *    the popup — which is why `OfferPopup.tsx` is not in this feature's diff.
 *  - §17, "do not load unnecessary JavaScript": none of the providers'
 *    client bundles are in this route's graph.
 *
 * ## What it costs, and why that is the right trade
 *
 * No i18n provider, so the cover cannot read the dictionaries through context.
 * The copy is English (a product decision, recorded in
 * `prompts/temporary-pre-launch-cover.md`) and the two form strings that must
 * match the rest of the site are imported from the English dictionary on the
 * server and passed down as props. An Arabic visitor at `/ar` sees this same
 * English cover; `dir` is `ltr` here for that reason and must not be made
 * dynamic without translating the copy first.
 *
 * ## Metadata
 *
 * Deliberately not declared in this layout. When the flag is on, this document
 * is what a request for `/` receives, so it has to answer with the *home page's*
 * identity — title, description and canonical — rather than with a title of its
 * own that would rename the front page in every search result. `page.tsx` builds
 * that per branch. See its `generateMetadata`.
 */
export default function PrelaunchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body className={`${getFontVariables("en")} font-body antialiased`}>
        {children}
      </body>
    </html>
  );
}
