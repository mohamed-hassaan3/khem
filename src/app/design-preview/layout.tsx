import type { Metadata } from "next";

import { getFontVariables } from "@/src/lib/fonts";

import "./preview.css";

/**
 * ⚠️ TEMPORARY — design review surface. Not part of the product.
 *
 * A **sibling root layout**. There is no `app/layout.tsx` in this project;
 * `app/[locale]/layout.tsx` is the root layout for the entire application, and
 * this is a second one for a single branch of the tree.
 *
 * That is the whole point. Living outside `[locale]` means this page inherits
 * none of the application shell — no `<Nav>`, no `<Footer>`, no
 * `<AnnouncementBar>`, no `<OfferPopup>`, no `<CookieConsent>`, and none of the
 * five providers — so a specimen drawn here cannot be confused with the real
 * component, and nothing drawn here can reach a production surface. It also
 * loads its own stylesheet, so the sitewide dark body gradient never applies.
 *
 * ## Removing it
 *
 * Delete this folder and the `/design-preview` bypass in `src/proxy.ts`. That
 * is the complete footprint; nothing else in the repository references it.
 */

export const metadata: Metadata = {
  title: "KHEM — Design Preview",
  description: "Proposed design system. Internal review surface.",
  // A review surface has no business in an index, and `robots.ts` does not
  // know about this route.
  robots: { index: false, follow: false },
};

export default function DesignPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" className={getFontVariables("en")}>
      <body className="khem-preview antialiased">{children}</body>
    </html>
  );
}
