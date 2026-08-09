import type { Metadata } from "next";

import LegalDocumentBody from "@/src/components/legal/LegalDocumentBody";
import LegalHero from "@/src/components/legal/LegalHero";
import { getLegalDocument } from "@/src/services/legal";

/** ISR, 24 hours — legal copy changes far less often than editorial content. */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Every cookie KHEM uses and what it does — essential, preferences, and anonymous analytics. No advertising cookies, no ad networks.",
  alternates: { canonical: "/cookie-policy" },
  // Indexable, but a policy page should not pass link equity onward.
  robots: { index: true, follow: false },
  openGraph: {
    title: "Cookie Policy | KHEM",
    description:
      "A short page, because we use few cookies. Here is every one of them and what it does.",
  },
};

export default async function CookiePolicy() {
  const doc = await getLegalDocument("cookie-policy");

  return (
    <div className="min-h-screen bg-background text-ivory">
      <LegalHero
        eyebrow={doc.eyebrow}
        title={doc.title}
        lede={doc.lede}
        updatedAt={doc.updatedAt}
        banner={doc.banner}
      />
      <LegalDocumentBody
        sections={doc.sections}
        contactEmail={doc.contactEmail}
      />
    </div>
  );
}
